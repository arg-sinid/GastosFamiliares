import { useState, useEffect, useCallback, useRef } from 'react';
import { storage } from './storage.js';
import {
  calcularTotalesTarjetas, desfaseTarjetas, calcularFilasControl, calcularHojasExtra, dedupePorId, EMPTY_DATA, setOcultarMontos, hoy,
} from './utils.js';
import { SyncEngine } from './sync.js';
import { SkeletonHero, SkeletonRow } from './components/ui.jsx';
import ControlGastos from './apps/ControlGastos.jsx';
import Gastos        from './apps/Gastos.jsx';
import Auto          from './apps/Auto.jsx';

const SK_URL     = 'script_url_v1';
const SK_USUARIO = 'usuario_v1';
const SK_META    = 'meta_ahorro_v1';
const SK_OCULTAR = 'ocultar_montos_v1';

function isLastTuesdayOfMonth() {
  const hoyD = new Date();
  if (hoyD.getDay() !== 2) return false;
  const proxSemana = new Date(hoyD);
  proxSemana.setDate(hoyD.getDate() + 7);
  return proxSemana.getMonth() !== hoyD.getMonth();
}

function SettingsModal({ scriptUrl, usuario, metaAhorro, onSave, onClose }) {
  const [url,  setUrl]  = useState(scriptUrl);
  const [usr,  setUsr]  = useState(usuario);
  const [meta, setMeta] = useState(metaAhorro);

  const userBtn = (active, tone) => `flex-1 py-2.5 rounded-lg font-bold text-[13px] border-[1.5px] touch-manipulation cursor-pointer transition-colors
    ${active
      ? tone === 'pink' ? 'border-[#D53F8C] bg-[#D53F8C]/10 text-[#D53F8C]' : 'border-accent bg-accent-soft text-accent-strong'
      : 'border-border bg-white text-muted'}`;

  return (
    <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-[480px] shadow-lg">
        <div className="font-extrabold text-[17px] mb-4 text-ink">⚙️ Configuración</div>

        <div className="text-[11px] font-bold text-muted uppercase mb-2">¿Quién sos?</div>
        <div className="flex gap-2 mb-5">
          <button onClick={()=>setUsr('german')}  className={userBtn(usr==='german')}>👨 Germán</button>
          <button onClick={()=>setUsr('julieta')} className={userBtn(usr==='julieta','pink')}>👩 Julieta</button>
        </div>

        <div className="text-[11px] font-bold text-muted uppercase mb-1.5">Meta de ahorro mensual</div>
        <div className="flex items-center gap-1.5 mb-5">
          <span className="text-muted-light font-semibold">$</span>
          <input type="number" inputMode="numeric" min="0" value={meta} onChange={e=>setMeta(e.target.value)} placeholder="Ej: 200000"
            className="flex-1 px-3 py-2.5 rounded-lg border-[1.5px] border-border text-base outline-none focus:border-accent"/>
        </div>

        <div className="text-[11px] font-bold text-muted uppercase mb-1.5">URL del Apps Script</div>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec"
          className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[11px] mb-1.5 outline-none font-mono focus:border-accent"/>
        <div className="text-[11px] text-muted-light mb-5">Usá la misma URL en ambos dispositivos.</div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 border-[1.5px] border-border rounded-lg bg-white cursor-pointer font-semibold text-muted text-[13px] touch-manipulation">Cancelar</button>
          <button onClick={()=>onSave(url,usr,meta)}
            className="flex-[2] py-2.5 border-none rounded-lg bg-ink cursor-pointer font-bold text-white text-[13px] touch-manipulation">Guardar</button>
        </div>
      </div>
    </div>
  );
}

const leerJson = async (res) => { try { return await res.json(); } catch { return { status:'error', msg:'Respuesta inválida del servidor' }; } };

export default function App() {
  const [activeApp,    setActiveApp]    = useState('principal');
  const [scriptUrl,    setScriptUrl]    = useState(()=>storage.get(SK_URL)?.value     || '');
  const [usuario,      setUsuario]      = useState(()=>storage.get(SK_USUARIO)?.value || 'german');
  const [metaAhorro,   setMetaAhorro]   = useState(()=>storage.get(SK_META)?.value    || '');
  const [ocultar,      setOcultar]      = useState(()=>storage.get(SK_OCULTAR)?.value === '1');
  const [appData,      setAppData]      = useState(EMPTY_DATA());
  const [zapiaData,    setZapiaData]    = useState([]);
  const [tarjetasData, setTarjetasData] = useState([]);
  const [tarjetasLoading, setTarjetasLoading] = useState(true);
  const [loading,      setLoading]      = useState(true);
  const [loadedOk,     setLoadedOk]     = useState(false);
  const [loadError,    setLoadError]    = useState('');
  const [syncing,      setSyncing]      = useState(false);
  const [syncStatus,   setSyncStatus]   = useState('idle');
  const [syncMsg,      setSyncMsg]      = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [navGastos,    setNavGastos]    = useState(null);     // { tarjeta, mes, n } para abrir una tarjeta desde Principal
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Todos los importes de la app respetan este interruptor (ver utils.$$).
  setOcultarMontos(ocultar);
  const toggleOcultar = () => setOcultar(v => { storage.set(SK_OCULTAR, v ? '0' : '1'); return !v; });

  const showBanner = isLastTuesdayOfMonth() && !bannerDismissed;

  // Refs para que el motor de sincronización use siempre lo último sin recrearse.
  const urlRef = useRef(scriptUrl);      urlRef.current = scriptUrl;
  const zapiaRef = useRef(zapiaData);    zapiaRef.current = zapiaData;
  const tarjetasRef = useRef(tarjetasData); tarjetasRef.current = tarjetasData;
  const loadedRef = useRef(false);       loadedRef.current = loadedOk;

  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = new SyncEngine({
      store: storage,
      post: async ({ baseVersion, data, extra }) => {
        const res = await fetch(urlRef.current, {
          method:'POST', headers:{'Content-Type':'text/plain'},
          body: JSON.stringify({ baseVersion, data, ...extra }),
        });
        return leerJson(res);
      },
      // Las filas de la hoja "Control 2026" se calculan ACÁ con las mismas funciones
      // que usa la pantalla; el servidor no recalcula nada.
      buildExtra: (data) => {
        const totalesTarjetas = calcularTotalesTarjetas(tarjetasRef.current, data.dolarTarjeta, desfaseTarjetas(data.ajustes));
        const ctx = { monthly:data.monthly, gastosRecurrentes:data.gastosRecurrentes, totalesTarjetas,
          uberDiDi:data.uberDiDi, zapiaData:zapiaRef.current, saldoJulieta:data.saldoJulieta, hoyStr:hoy(), ajustes:data.ajustes };
        return {
          filasControl: calcularFilasControl(ctx, new Date().toLocaleString('es-AR')),
          hojasExtra: calcularHojasExtra(data, zapiaRef.current),      // tablas legibles: Ganancias Auto, Saldos Uala, Conciliaciones, Ahorros
        };
      },
      onStatus: (s, msg) => {
        setSyncing(s === 'syncing');
        if (s === 'ok') { setSyncStatus('ok'); setSyncMsg(''); setTimeout(()=>setSyncStatus(p => p === 'ok' ? 'idle' : p), 3000); }
        else if (s === 'error') { setSyncStatus('error'); setSyncMsg(msg || ''); }
        else setSyncStatus('idle');
      },
      onData: (d) => setAppData(d),
    });
  }
  const engine = engineRef.current;

  const cargarExternos = useCallback(async (url) => {
    try {
      const [r2, r3] = await Promise.all([ fetch(`${url}?tipo=zapia`), fetch(`${url}?tipo=tarjetas`) ]);
      const [d2, d3] = await Promise.all([ leerJson(r2), leerJson(r3) ]);
      if (d2.status==='ok' && d2.data) setZapiaData(d2.data);
      if (d3.status==='ok' && d3.data) setTarjetasData(dedupePorId(d3.data));
    } catch(e) { console.error('Error cargando datos externos:', e); }
    setTarjetasLoading(false);
  }, []);

  // Carga inicial (o al cambiar la URL): lee el estado del servidor UNA vez.
  const cargarTodo = useCallback(async (url) => {
    if (!url) { setLoading(false); setTarjetasLoading(false); return; }
    setLoadError('');
    try {
      const d1 = await leerJson(await fetch(`${url}?tipo=appdata`));
      if (d1.status !== 'ok' || !d1.data) throw new Error(d1.msg || 'No se pudieron leer los datos.');
      if (typeof d1.version !== 'number') throw new Error('El Apps Script todavía no está actualizado a la versión 6.');
      setAppData(engine.init({ version:d1.version, data:d1.data }));
      setLoadedOk(true);
      await cargarExternos(url);
      if (engine.hayPendiente) engine.flush();       // cambios que habían quedado sin enviar
    } catch(e) {
      setLoadError(String(e.message || e));
      setTarjetasLoading(false);
    }
    setLoading(false);
  }, [cargarExternos]);

  const reloadTarjetas = useCallback(async () => {
    if (!scriptUrl) return;
    setTarjetasLoading(true);
    await cargarExternos(scriptUrl);
  }, [scriptUrl, cargarExternos]);

  useEffect(() => { cargarTodo(scriptUrl); }, [scriptUrl]);

  // Al volver a la app: NO se reemplaza el estado a ciegas. Si hay cambios sin
  // enviar se reintenta el envío; si no, se consulta la versión y solo se adopta
  // el estado del servidor cuando cambió.
  useEffect(() => {
    const alVolver = async () => {
      const url = urlRef.current;
      if (document.hidden || !url || !loadedRef.current) return;
      if (engine.hayPendiente) { engine.flush(); return; }
      try {
        const v = await leerJson(await fetch(`${url}?tipo=version`));
        if (v.status === 'ok' && v.version !== engine.version) {
          const s = await leerJson(await fetch(`${url}?tipo=appdata`));
          if (s.status === 'ok' && s.data) engine.adoptarServidor({ version:s.version, data:s.data });
        }
      } catch {}
      cargarExternos(url);
    };
    const alConectar = () => { if (engine.hayPendiente) engine.flush(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alConectar);
    return () => { document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('online', alConectar); };
  }, [cargarExternos]);

  // Guardado: se aplica en pantalla, se persiste en el dispositivo y recién se
  // informa "sincronizado" cuando el servidor lo confirmó. Devuelve true/false.
  const saveData = useCallback(async (newData) => {
    if (!urlRef.current) { setShowSettings(true); return false; }
    if (!loadedRef.current) {
      setSyncStatus('error'); setSyncMsg('Los datos no se cargaron: no se guarda nada para no pisar lo que hay en la nube.');
      return false;
    }
    setAppData(newData);
    const r = await engine.save(newData);
    return r.ok;
  }, []);

  const retry = () => engine.flush();
  const irATarjeta = (tarjeta, mes) => { setNavGastos({ tarjeta, mes, n: Date.now() }); setActiveApp('gastos'); };

  const saveSettings = (url, usr, meta) => {
    setUsuario(usr); setMetaAhorro(meta);
    storage.set(SK_URL, url); storage.set(SK_USUARIO, usr); storage.set(SK_META, meta);
    setShowSettings(false);
    if (url !== scriptUrl) { setScriptUrl(url); setLoadedOk(false); setLoading(true); }
  };

  if (loading || (!loadedOk && scriptUrl)) {
    if (!scriptUrl || (!loading && loadError)) return (
      <div className="flex flex-col items-center justify-center h-screen text-muted gap-4 bg-paper px-6 text-center">
        {showSettings && <SettingsModal scriptUrl={scriptUrl} usuario={usuario} metaAhorro={metaAhorro} onSave={saveSettings} onClose={()=>setShowSettings(false)}/>}
        <div className="text-5xl">{loadError ? '⚠️' : '💰'}</div>
        <div className="text-sm">{loadError || 'Configurá el Apps Script para empezar'}</div>
        <div className="flex gap-2">
          {loadError && <button onClick={()=>{ setLoading(true); cargarTodo(scriptUrl); }}
            className="px-5 py-3 border-none rounded-xl bg-tab-tarjetas text-white font-bold text-sm cursor-pointer touch-manipulation">Reintentar</button>}
          <button onClick={()=>setShowSettings(true)}
            className="px-5 py-3 border-none rounded-xl bg-ink text-white font-bold text-sm cursor-pointer touch-manipulation">⚙️ Configurar</button>
        </div>
      </div>
    );
    return (
      <div className="max-w-[640px] mx-auto p-4 bg-paper min-h-screen">
        <div className="rounded-2xl px-5 py-4.5 mb-4.5 bg-tab-principal/10">
          <div className="animate-pulse bg-tab-principal/20 h-5 w-32 rounded mb-2"/>
          <div className="animate-pulse bg-tab-principal/15 h-3 w-20 rounded"/>
        </div>
        <div className="mb-3.5"><SkeletonHero/></div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <SkeletonRow/><SkeletonRow/><SkeletonRow/>
        </div>
      </div>
    );
  }

  // 3 accesos principales. Control, Historial, Ahorros y Cierre viven dentro de Principal;
  // Tarjetas dentro de Gastos; Ganancias y gastos del vehículo dentro de Auto.
  const NAV = [
    { key:'principal', emoji:'💰', label:'Principal', colorVar:'--color-tab-principal' },
    { key:'gastos',    emoji:'🏷️', label:'Gastos',    colorVar:'--color-tab-gastos' },
    { key:'auto',      emoji:'🚗', label:'Auto',      colorVar:'--color-tab-ganancias' },
  ];

  const onRefresh = () => cargarExternos(scriptUrl);
  const commonProps = { appData, saveData, zapiaData, tarjetasData, syncing, syncStatus, usuario, onRefresh, ocultar, onToggleOcultar:toggleOcultar };

  return (
    <div className="font-sans bg-paper min-h-screen pb-[70px]">
      {showSettings && <SettingsModal scriptUrl={scriptUrl} usuario={usuario} metaAhorro={metaAhorro} onSave={saveSettings} onClose={()=>setShowSettings(false)}/>}

      {showBanner && (
        <div className="bg-ink text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50 shadow-md">
          <span className="text-[22px]">📎</span>
          <div className="flex-1">
            <div className="font-bold text-[13px]">¡Recordatorio de tarjetas!</div>
            <div className="text-[11px] opacity-80 mt-0.5">Es el último martes del mes. Mandá los resúmenes de ICBC y Banco Nación por el chat.</div>
          </div>
          <button onClick={()=>setBannerDismissed(true)}
            className="border-none bg-white/15 rounded-lg text-white px-2.5 py-1.5 cursor-pointer font-bold text-xs touch-manipulation">OK</button>
        </div>
      )}

      <div className={activeApp==='principal'?'block':'hidden'}>
        <ControlGastos {...commonProps} metaAhorro={metaAhorro} syncMsg={syncMsg}
          onRetry={retry} onOpenSettings={()=>setShowSettings(true)} onIrATarjeta={irATarjeta}/>
      </div>
      <div className={activeApp==='gastos'?'block':'hidden'}>
        <Gastos {...commonProps} loadingTarjetas={tarjetasLoading} onRefreshTarjetas={reloadTarjetas} nav={navGastos}/>
      </div>
      <div className={activeApp==='auto'?'block':'hidden'}><Auto {...commonProps}/></div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex shadow-[0_-2px_12px_rgba(0,0,0,0.08)] z-[100]"
           style={{ paddingBottom:'env(safe-area-inset-bottom)' }}>
        {NAV.map(a => {
          const isActive = a.key === activeApp;
          return (
            <button key={a.key} onClick={()=>setActiveApp(a.key)}
              className="flex-1 pt-2 pb-1.5 border-none bg-transparent cursor-pointer flex flex-col items-center gap-0.5 touch-manipulation transition-colors"
              style={{
                color: isActive ? `var(${a.colorVar})` : 'var(--color-muted-light)',
                borderTop: `2.5px solid ${isActive ? `var(${a.colorVar})` : 'transparent'}`,
              }}>
              <span className="text-lg">{a.emoji}</span>
              <span className={`text-[10px] tracking-wide ${isActive?'font-bold':'font-medium'}`}>{a.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
