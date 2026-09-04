import { useState, useEffect, useCallback } from 'react';
import { storage } from './storage.js';
import { calcularTotalesTarjetas } from './utils.js';
import ControlGastos from './apps/ControlGastos.jsx';
import Control       from './apps/Control.jsx';
import Gastos        from './apps/Gastos.jsx';
import UberDiDi      from './apps/UberDiDi.jsx';
import Tarjetas      from './apps/Tarjetas.jsx';

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
  const btn = (active, c='#2B6CB0') => ({
    flex:1,padding:10,border:`1.5px solid ${active?c:'#CBD5E0'}`,borderRadius:8,
    cursor:'pointer',fontWeight:700,fontSize:13,
    background:active?c+'18':'#fff',color:active?c:'#718096',touchAction:'manipulation'
  });
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:480,boxShadow:'0 8px 32px rgba(0,0,0,0.2)'}}>
        <div style={{fontWeight:800,fontSize:17,marginBottom:16,color:'#1A365D'}}>⚙️ Configuración</div>
        <div style={{fontSize:11,fontWeight:700,color:'#4A5568',textTransform:'uppercase',marginBottom:8}}>¿Quién sos?</div>
        <div style={{display:'flex',gap:8,marginBottom:20}}>
          <button onClick={()=>setUsr('german')}  style={btn(usr==='german')}>👨 Germán</button>
          <button onClick={()=>setUsr('julieta')} style={btn(usr==='julieta','#D53F8C')}>👩 Julieta</button>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:'#4A5568',textTransform:'uppercase',marginBottom:6}}>Meta de ahorro mensual</div>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:20}}>
          <span style={{color:'#A0AEC0',fontWeight:600}}>$</span>
          <input type="number" inputMode="numeric" min="0" value={meta} onChange={e=>setMeta(e.target.value)} placeholder="Ej: 200000"
            style={{flex:1,padding:'10px 12px',borderRadius:8,border:'1.5px solid #CBD5E0',fontSize:16,outline:'none'}}/>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:'#4A5568',textTransform:'uppercase',marginBottom:6}}>URL del Apps Script</div>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec"
          style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #CBD5E0',fontSize:11,marginBottom:6,boxSizing:'border-box',outline:'none',fontFamily:'monospace'}}/>
        <div style={{fontSize:11,color:'#A0AEC0',marginBottom:20}}>Usá la misma URL en ambos dispositivos.</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:11,border:'1.5px solid #CBD5E0',borderRadius:9,background:'#fff',cursor:'pointer',fontWeight:600,color:'#4A5568',fontSize:13,touchAction:'manipulation'}}>Cancelar</button>
          <button onClick={()=>onSave(url,usr,meta)} style={{flex:2,padding:11,border:'none',borderRadius:9,background:'#2B6CB0',cursor:'pointer',fontWeight:700,color:'white',fontSize:13,touchAction:'manipulation'}}>Guardar</button>
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

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Segoe UI,sans-serif',color:'#718096',gap:16}}>
      {showSettings && <SettingsModal scriptUrl={scriptUrl} usuario={usuario} metaAhorro={metaAhorro} onSave={saveSettings} onClose={()=>setShowSettings(false)}/>}
      <div style={{fontSize:48}}>💰</div>
      <div style={{fontSize:14}}>{scriptUrl?'Cargando datos...':'Configurá el Apps Script para empezar'}</div>
      {!scriptUrl && (
        <button onClick={()=>setShowSettings(true)}
          style={{padding:'12px 24px',border:'none',borderRadius:10,background:'#2B6CB0',color:'white',fontWeight:700,fontSize:14,cursor:'pointer',touchAction:'manipulation'}}>⚙️ Configurar</button>
      )}
    </div>
  );

  const NAV = [
    { key:'principal', emoji:'💰', label:'Principal', color:'#1A365D' },
    { key:'control',   emoji:'📊', label:'Control',   color:'#2D3748' },
    { key:'gastos',    emoji:'🏷️', label:'Gastos',    color:'#744210' },
    { key:'tarjetas',  emoji:'💳', label:'Tarjetas',  color:'#2B6CB0' },
    { key:'ganancias', emoji:'🚗', label:'Ganancias', color:'#1A4731' },
  ];

  const commonProps = { appData, saveData, zapiaData, syncing, syncStatus, usuario, onRefresh:()=>loadData(scriptUrl) };

  return (
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",background:'#F7FAFC',minHeight:'100vh',paddingBottom:70}}>
      {showSettings && <SettingsModal scriptUrl={scriptUrl} usuario={usuario} metaAhorro={metaAhorro} onSave={saveSettings} onClose={()=>setShowSettings(false)}/>}

      {showBanner && (
        <div style={{background:'linear-gradient(135deg,#2B6CB0,#2C5282)',color:'white',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,
                     position:'sticky',top:0,zIndex:50,boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
          <span style={{fontSize:22}}>📎</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>¡Recordatorio de tarjetas!</div>
            <div style={{fontSize:11,opacity:.85,marginTop:2}}>Es el último martes del mes. Mandá los resúmenes de ICBC y Banco Nación por el chat.</div>
          </div>
          <button onClick={()=>setBannerDismissed(true)}
            style={{border:'none',background:'rgba(255,255,255,0.2)',borderRadius:8,color:'white',padding:'6px 10px',cursor:'pointer',fontWeight:700,fontSize:12,touchAction:'manipulation'}}>OK</button>
        </div>
      )}

      <div style={{display:activeApp==='principal'?'block':'none'}}>
        <ControlGastos {...commonProps} metaAhorro={metaAhorro} tarjetasData={tarjetasData}
          onForceSync={()=>loadData(scriptUrl)} onOpenSettings={()=>setShowSettings(true)}/>
      </div>
      <div style={{display:activeApp==='control'?'block':'none'}}><Control {...commonProps}/></div>
      <div style={{display:activeApp==='gastos'?'block':'none'}}><Gastos {...commonProps} movimientos={tarjetasData} loading={false}/></div>
      <div style={{display:activeApp==='tarjetas'?'block':'none'}}>
        <Tarjetas appData={appData} saveData={saveData} movimientos={tarjetasData} loading={tarjetasLoading} onRefresh={reloadTarjetas}/>
      </div>
      <div style={{display:activeApp==='ganancias'?'block':'none'}}><UberDiDi {...commonProps}/></div>

      <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'white',borderTop:'1px solid #E2E8F0',display:'flex',
                   boxShadow:'0 -2px 12px rgba(0,0,0,0.08)',zIndex:100,paddingBottom:'env(safe-area-inset-bottom)'}}>
        {NAV.map(a => {
          const isActive = a.key === activeApp;
          return (
            <button key={a.key} onClick={()=>setActiveApp(a.key)} style={{
              flex:1,padding:'8px 0 6px',border:'none',background:'transparent',cursor:'pointer',
              display:'flex',flexDirection:'column',alignItems:'center',gap:2,
              color:isActive?a.color:'#A0AEC0', borderTop:`2.5px solid ${isActive?a.color:'transparent'}`,
              transition:'all .15s',touchAction:'manipulation'
            }}>
              <span style={{fontSize:18}}>{a.emoji}</span>
              <span style={{fontSize:8,fontWeight:isActive?700:500,letterSpacing:.2}}>{a.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
