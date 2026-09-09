import { useState, useEffect, useCallback } from 'react';
import { storage } from './storage.js';
import { calcularTotalesTarjetas } from './utils.js';
import { SkeletonHero, SkeletonRow } from './components/ui.jsx';
import ControlGastos from './apps/ControlGastos.jsx';
import Control       from './apps/Control.jsx';
import Gastos        from './apps/Gastos.jsx';
import UberDiDi      from './apps/UberDiDi.jsx';
import Tarjetas      from './apps/Tarjetas.jsx';
import CierreReal    from './apps/CierreReal.jsx';

const SK_URL     = 'script_url_v1';
const SK_USUARIO = 'usuario_v1';
const SK_META    = 'meta_ahorro_v1';
const EMPTY_DATA = () => ({
  monthly:{}, categories:{}, uberDiDi:[],
  gastosRecurrentes:{}, saldoJulieta:{}, dolarTarjeta:{}
});

function isLastTuesdayOfMonth() {
  const hoy = new Date();
  if (hoy.getDay() !== 2) return false;
  const proxSemana = new Date(hoy);
  proxSemana.setDate(hoy.getDate() + 7);
  return proxSemana.getMonth() !== hoy.getMonth();
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

export default function App() {
  const [activeApp,    setActiveApp]    = useState('principal');
  const [scriptUrl,    setScriptUrl]    = useState(()=>storage.get(SK_URL)?.value     || '');
  const [usuario,      setUsuario]      = useState(()=>storage.get(SK_USUARIO)?.value || 'german');
  const [metaAhorro,   setMetaAhorro]   = useState(()=>storage.get(SK_META)?.value    || '');
  const [appData,      setAppData]      = useState(EMPTY_DATA());
  const [zapiaData,    setZapiaData]    = useState([]);
  const [tarjetasData, setTarjetasData] = useState([]);
  const [tarjetasLoading, setTarjetasLoading] = useState(true);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [syncStatus,   setSyncStatus]   = useState('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const showBanner = isLastTuesdayOfMonth() && !bannerDismissed;

  const loadData = useCallback(async (url) => {
    if (!url) { setLoading(false); setTarjetasLoading(false); return; }
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${url}?tipo=appdata`), fetch(`${url}?tipo=zapia`), fetch(`${url}?tipo=tarjetas`)
      ]);
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      if (d1.status==='ok' && d1.data) {
        setAppData({
          monthly:           d1.data.monthly           || {},
          categories:        d1.data.categories        || {},
          uberDiDi:          d1.data.uberDiDi          || [],
          gastosRecurrentes: d1.data.gastosRecurrentes  || {},
          saldoJulieta:      d1.data.saldoJulieta       || {},
          dolarTarjeta:      d1.data.dolarTarjeta       || {},
        });
      }
      if (d2.status==='ok' && d2.data) setZapiaData(d2.data);
      if (d3.status==='ok' && d3.data) setTarjetasData(d3.data);
    } catch(e) { console.error('Error cargando:', e); }
    setLoading(false); setTarjetasLoading(false);
  }, []);

  const reloadTarjetas = useCallback(async () => {
    if (!scriptUrl) return;
    setTarjetasLoading(true);
    try {
      const res = await fetch(`${scriptUrl}?tipo=tarjetas`);
      const data = await res.json();
      if (data.status==='ok') setTarjetasData(data.data || []);
    } catch(e) { console.error('Error recargando tarjetas:', e); }
    setTarjetasLoading(false);
  }, [scriptUrl]);

  useEffect(() => {
    loadData(scriptUrl);
    const onVisible = () => { if (!document.hidden && scriptUrl) loadData(scriptUrl); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [scriptUrl]);

  const saveData = useCallback(async (newData) => {
    if (!scriptUrl) { setShowSettings(true); return; }
    setSyncing(true); setSyncStatus('idle');
    setAppData(newData);
    const totalesTarjetas = calcularTotalesTarjetas(tarjetasData, newData.dolarTarjeta);
    try {
      const res = await fetch(scriptUrl, {
        method: 'POST', headers: {'Content-Type':'text/plain'},
        body: JSON.stringify({
          allData:           newData.monthly,
          categories:        newData.categories,
          uberDiDi:          newData.uberDiDi,
          gastosRecurrentes: newData.gastosRecurrentes,
          saldoJulieta:      newData.saldoJulieta,
          dolarTarjeta:      newData.dolarTarjeta,
          totalesTarjetas,
        })
      });
      const r = await res.json().catch(()=>({}));
      setSyncStatus(r.status==='ok'||res.ok?'ok':'error');
      if (r.status==='ok'||res.ok) setTimeout(()=>setSyncStatus('idle'),3000);
    } catch(e) { setSyncStatus('error'); }
    setSyncing(false);
  }, [scriptUrl]);

  const saveSettings = (url, usr, meta) => {
    setScriptUrl(url); setUsuario(usr); setMetaAhorro(meta);
    storage.set(SK_URL, url); storage.set(SK_USUARIO, usr); storage.set(SK_META, meta);
    setShowSettings(false); setLoading(true); loadData(url);
  };

  if (loading) {
    if (!scriptUrl) return (
      <div className="flex flex-col items-center justify-center h-screen text-muted gap-4 bg-paper">
        {showSettings && <SettingsModal scriptUrl={scriptUrl} usuario={usuario} metaAhorro={metaAhorro} onSave={saveSettings} onClose={()=>setShowSettings(false)}/>}
        <div className="text-5xl">💰</div>
        <div className="text-sm">Configurá el Apps Script para empezar</div>
        <button onClick={()=>setShowSettings(true)}
          className="px-6 py-3 border-none rounded-xl bg-ink text-white font-bold text-sm cursor-pointer touch-manipulation">⚙️ Configurar</button>
      </div>
    );
    // Ya sabemos que hay datos en camino (hay scriptUrl configurado) — en vez de
    // un texto suelto, mostramos la silueta de la pantalla que va a aparecer.
    // Esto se "siente" más rápido porque el usuario ya ve la forma del contenido.
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

  const NAV = [
    { key:'principal', emoji:'💰', label:'Principal',   colorVar:'--color-tab-principal' },
    { key:'control',   emoji:'📊', label:'Control',     colorVar:'--color-tab-control' },
    { key:'gastos',    emoji:'🏷️', label:'Gastos',      colorVar:'--color-tab-gastos' },
    { key:'tarjetas',  emoji:'💳', label:'Tarjetas',    colorVar:'--color-tab-tarjetas' },
    { key:'ganancias', emoji:'🚗', label:'Ganancias',   colorVar:'--color-tab-ganancias' },
    { key:'cierre',    emoji:'🧮', label:'Cierre Real', colorVar:'--color-tab-cierre' },
  ];

  const commonProps = { appData, saveData, zapiaData, syncing, syncStatus, usuario, onRefresh:()=>loadData(scriptUrl) };

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
        <ControlGastos {...commonProps} metaAhorro={metaAhorro} tarjetasData={tarjetasData}
          onForceSync={()=>loadData(scriptUrl)} onOpenSettings={()=>setShowSettings(true)}/>
      </div>
      <div className={activeApp==='control'?'block':'hidden'}><Control {...commonProps}/></div>
      <div className={activeApp==='gastos'?'block':'hidden'}><Gastos {...commonProps} movimientos={tarjetasData} loading={false}/></div>
      <div className={activeApp==='tarjetas'?'block':'hidden'}>
        <Tarjetas appData={appData} saveData={saveData} movimientos={tarjetasData} loading={tarjetasLoading} onRefresh={reloadTarjetas}/>
      </div>
      <div className={activeApp==='ganancias'?'block':'hidden'}><UberDiDi {...commonProps}/></div>
      <div className={activeApp==='cierre'?'block':'hidden'}>
        <CierreReal appData={appData} zapiaData={zapiaData} tarjetasData={tarjetasData} onRefresh={()=>loadData(scriptUrl)}/>
      </div>

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
              <span className={`text-[8px] tracking-wide ${isActive?'font-bold':'font-medium'}`}>{a.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
