// Sincronización entre dispositivos con control de concurrencia optimista.
// El servidor (Apps Script) guarda una versión entera; cada guardado envía la
// versión sobre la que se basó. Si otro dispositivo guardó antes, el servidor
// responde "conflict" con su estado y acá se hace un merge de TRES vías
// (base confirmada / lo mío / lo del servidor), registro por registro, y se
// reintenta. Nunca se pisa un cambio ajeno con una copia vieja.
import { normalizarAppData } from './utils.js';

const MAP_FIELDS  = ['monthly','categories','gastosRecurrentes','saldoJulieta','dolarTarjeta','autoDetalle','vencimientos','gastoVehiculo','pagosFijos','ajustes'];
const LIST_FIELDS = { uberDiDi:'fecha', ahorroMovimientos:null, vehiculos:null }; // campo de orden desc (o null)

const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x,i)=>deepEqual(x,b[i]));
  if (isPlain(a)) {
    if (!isPlain(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => k in b && deepEqual(a[k], b[k]));
  }
  return false;
};

// Merge de tres vías para objetos anidados: lo que cambié yo gana sobre la base;
// lo que cambió el otro dispositivo se conserva; si ambos tocaron lo mismo, gana lo mío.
export const merge3 = (base, mine, theirs) => {
  if (deepEqual(mine, base)) return theirs;
  if (deepEqual(theirs, base)) return mine;
  if (isPlain(mine) && isPlain(theirs) && (isPlain(base) || base === undefined)) {
    const b = base || {}, out = {};
    new Set([...Object.keys(b), ...Object.keys(mine), ...Object.keys(theirs)]).forEach(k => {
      const v = merge3(b[k], mine[k], theirs[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  return mine;
};

const idOf = it => (it && it.id != null) ? String(it.id) : JSON.stringify(it);
const porId = arr => new Map((arr||[]).map(it => [idOf(it), it]));

// Merge de listas de registros con id: altas, bajas y ediciones de ambos lados,
// sin duplicar un registro que ya está en los dos.
export const mergeLista = (base, mine, theirs, ordenDesc = null) => {
  const B = porId(base), M = porId(mine), T = porId(theirs);
  const deMiasNuevas = [], deTheirs = [];
  for (const [id, t] of T) {
    const b = B.get(id), m = M.get(id);
    if (b === undefined) deTheirs.push(m !== undefined ? m : t);               // alta de ellos (o de ambos: gana la mía, mismo id)
    else if (m === undefined) { if (!deepEqual(t, b)) deTheirs.push(t); }      // yo borré; si ellos lo editaron se conserva
    else deTheirs.push(deepEqual(m, b) ? t : m);                               // si lo edité yo, gana lo mío
  }
  for (const [id, m] of M) {
    if (T.has(id)) continue;
    const b = B.get(id);
    if (b === undefined || !deepEqual(m, b)) deMiasNuevas.push(m);             // alta mía, o edité algo que ellos borraron
  }
  const out = [...deMiasNuevas, ...deTheirs];
  if (ordenDesc) out.sort((a,b) => String(b[ordenDesc]||'').localeCompare(String(a[ordenDesc]||'')));
  return out;
};

export const mergeAppData = (base, mine, theirs) => {
  const b = normalizarAppData(base), m = normalizarAppData(mine), t = normalizarAppData(theirs);
  const out = {};
  MAP_FIELDS.forEach(f => { out[f] = merge3(b[f], m[f], t[f]) ?? {}; });
  Object.entries(LIST_FIELDS).forEach(([f, ord]) => { out[f] = mergeLista(b[f], m[f], t[f], ord); });
  return out;
};

const KEY_PENDIENTE = 'pending_sync_v2';

export class SyncEngine {
  // post({baseVersion, data, extra}) → Promise<{status:'ok',version} | {status:'conflict',version,data} | {status:'error',msg}>
  // Un rechazo de la promesa (sin red) se informa como error y NO como guardado.
  constructor({ post, store = null, buildExtra = () => ({}), onStatus = () => {}, onData = () => {}, maxConflictos = 4 }) {
    Object.assign(this, { post, store, buildExtra, onStatus, onData, maxConflictos });
    this.version = 0; this.base = normalizarAppData(null); this.mine = this.base;
    this.pending = false; this._p = null; this.status = 'idle';
  }
  init({ version, data }) {
    this.version = version; this.base = normalizarAppData(data); this.mine = this.base; this.pending = false;
    const g = this.store?.get(KEY_PENDIENTE);
    if (g) {
      try {
        const p = JSON.parse(g.value);
        this.mine = mergeAppData(p.base, p.mine, this.base);   // cambios que quedaron sin enviar
        this.pending = !deepEqual(this.mine, this.base);
        if (!this.pending) this.store.remove(KEY_PENDIENTE);
      } catch { this.store.remove(KEY_PENDIENTE); }
    }
    return this.mine;
  }
  get hayPendiente() { return this.pending; }
  _persist() { this.store?.set(KEY_PENDIENTE, JSON.stringify({ base:this.base, mine:this.mine })); }
  _limpiar() { this.store?.remove(KEY_PENDIENTE); }
  _estado(s, msg) { this.status = s; this.onStatus(s, msg); }

  save(data) { this.mine = data; this.pending = true; this._persist(); return this.flush(); }
  flush() {
    if (!this._p) this._p = this._run().finally(() => { this._p = null; });
    return this._p;
  }
  async _run() {
    this._estado('syncing');
    let conflictos = 0;
    while (this.pending) {
      const snapshot = this.mine;
      let res;
      try { res = await this.post({ baseVersion: this.version, data: snapshot, extra: this.buildExtra(snapshot) }); }
      catch (e) { this._estado('error', 'Sin conexión: los cambios quedaron guardados en este dispositivo.'); return { ok:false, error:'network' }; }

      if (res && res.status === 'ok') {
        this.version = res.version; this.base = snapshot;
        if (this.mine === snapshot) { this.pending = false; this._limpiar(); }
        continue;
      }
      if (res && res.status === 'conflict') {
        if (++conflictos > this.maxConflictos) { this._estado('error', 'Hubo cambios simultáneos que no se pudieron combinar. Reintentá.'); return { ok:false, error:'conflict' }; }
        const theirs = normalizarAppData(res.data);
        const merged = mergeAppData(this.base, this.mine, theirs);
        this.version = res.version; this.base = theirs; this.mine = merged;
        this.onData(merged);
        if (deepEqual(merged, theirs)) { this.pending = false; this._limpiar(); } else this._persist();
        continue;
      }
      this._estado('error', res?.msg || 'El servidor no confirmó el guardado.');
      return { ok:false, error:'server' };
    }
    this._estado('ok');
    return { ok:true };
  }

  // Aplica el estado del servidor SOLO si no hay nada pendiente de enviar.
  adoptarServidor({ version, data }) {
    if (this.pending || this._p) return { aplicado:false };
    if (version === this.version) return { aplicado:false };
    this.version = version; this.base = normalizarAppData(data); this.mine = this.base;
    this.onData(this.mine);
    return { aplicado:true };
  }
}
