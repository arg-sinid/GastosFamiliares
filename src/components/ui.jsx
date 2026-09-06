// Componentes UI compartidos. Las pantallas (Control, ControlGastos, Gastos,
// Tarjetas, UberDiDi) están escritas con JSX propio; MoneyInput es el único
// componente realmente compartido entre ellas.

// Formatea con puntos de miles mientras se escribe (sin símbolo $), ej: 45000 -> 45.000
const formatMiles = (digits) => {
  if (!digits) return '';
  return new Intl.NumberFormat('es-AR').format(parseInt(digits, 10));
};
const soloDigitos = (str) => String(str||'').replace(/\D/g, '');

// Input de dinero con puntuación de miles visible mientras se tipea
export function MoneyInput({ value, onChange, placeholder='0', width=130, border, background }) {
  const digits = soloDigitos(value);
  return (
    <input
      type="text" inputMode="numeric"
      value={formatMiles(digits)}
      onChange={e => onChange(soloDigitos(e.target.value))}
      placeholder={placeholder}
      style={{width,padding:'7px 10px',borderRadius:8,fontSize:14,textAlign:'right',
              border: border || '1.5px solid #E2E8F0', outline:'none', background: background || '#FAFAFA'}}
    />
  );
}
