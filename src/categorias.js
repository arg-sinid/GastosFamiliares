// Reglas de categorización. Las palabras clave cortas (≤4 letras) se comparan
// como palabra completa para evitar falsos positivos ("pantalon" ≠ "pan",
// "medialunas" ≠ "dia"). Las largas siguen buscándose como subcadena.
const REGLAS=[
  {categoria:'Supermercado',emoji:'🛒',palabras:['chino','super','supermercado','coto','carrefour','disco','walmart','dia','vea','jumbo','almacen','mercado','kiosco','minimarket','maxiconsumo','mayorista','changomas','chango mas','la anonima','punto pack','autoservicio','yaguar','vital','josimar']},
  {categoria:'Carnicería',emoji:'🥩',palabras:['carniceria','carne','asado','pollo','vacio','costilla','chorizo','morcilla','pescaderia','fiambreria','matarife','achuras','milanesa']},
  {categoria:'Verdulería',emoji:'🥬',palabras:['verduleria','verdura','fruta','fruteria','papa','tomate','cebolla','lechuga','organico']},
  {categoria:'Panadería',emoji:'🥐',palabras:['panaderia','pan','factura','medialunas','torta','pasteleria','confiteria']},
  // Auto se divide en tres categorías consultables desde la sección Auto.
  // "Auto" queda como resto (patente, cochera, etc.) y como bucket "por clasificar".
  {categoria:'Combustible',emoji:'⛽',palabras:['nafta','gnc','combustible','ypf','shell','axion','petrobras','estacion','puma energy']},
  {categoria:'Peajes/TelePASE',emoji:'🛣️',palabras:['telepase','peaje','peajes','autopista','autopistas','camino pque','au buenos aires la plata','panamericana','acceso oeste','au ricchieri']},
  {categoria:'Mantenimiento',emoji:'🔧',palabras:['mecanico','taller','repuesto','neumatico','gomeria','lavadero','aceite','lubricentro','bateria','service','vtv']},
  {categoria:'Auto',emoji:'🚗',palabras:['patente','seguro auto','cochera','estacionamiento','parquimetro']},
  {categoria:'Farmacia',emoji:'💊',palabras:['farmacia','medicamento','remedio','drogueria','pastilla','jarabe','farmacity','vitaminas','farmaonline']},
  {categoria:'Salud',emoji:'🏥',palabras:['medico','doctor','consulta','laboratorio','optica','dentista','clinica','hospital','turno','radiografia','ecografia','kinesiologia','psicologia','ceb salud','obra social','swiss medical','osde','galeno','ioma','sanatorio','fisioterapia','nutricionista']},
  {categoria:'Comidas',emoji:'🍕',palabras:['delivery','pedidos','restaurant','restaurante','pizza','hamburguesa','sushi','empanada','rotiseria','bar','cafe','cafeteria','lomiteria','rappi','pedidosya','mcdonalds','burger','mostaza','gochiso','heladeria','helado','kfc','starbucks','subway','grido','freddo','parrilla','choripan','food']},
  {categoria:'Indumentaria',emoji:'👕',palabras:['ropa','zapato','zapateria','indumentaria','remera','pantalon','calzado','zapatillas','jean','campera','cartera','medias','ropa interior','adidas','nike','topper','mimo','kosiuko']},
  {categoria:'Hogar',emoji:'🏠',palabras:['ferreteria','limpieza','electricidad','plomero','pintura','mueble','bazar','electrodomestico','detergente','lavandina','escoba','easy','sodimac','barugel','pintureria','gasista','tornillo','cerrajero']},
  {categoria:'Tecnología',emoji:'📱',palabras:['celular','computadora','notebook','tablet','auricular','cable','cargador','electronica','garbarino','fravega','megatone','mercadolibre','mercado libre','musimundo','compumundo','iphone','samsung','pc factory']},
  {categoria:'Entretenimiento',emoji:'🎭',palabras:['cine','teatro','show','recital','entrada','juego','deporte','netflix','spotify','disney','streaming','tuentrada','cine fan black','ticketek','plateanet','boliche','fiesta','cumpleanos','salon de fiestas']},
  {categoria:'Educación',emoji:'📚',palabras:['colegio','escuela','libreria','cuaderno','libro','universidad','curso','guardapolvo','jardin','cuota colegio','instituto','fotocopias','uba']},
  {categoria:'Mascotas',emoji:'🐾',palabras:['veterinaria','veterinario','vacuna','antipulgas','balanceado','petshop','zoocopet','pet shop','peluqueria canina']},
  {categoria:'Servicios',emoji:'🧾',palabras:['edenor','edesur','metrogas','aysa','claro','movistar','personal','telecentro','fibertel','factura','tarjeta naranja','directv','flow','expensas','abl','rentas','municipalidad','tasa','arba','afip','monotributo']},
  {categoria:'Transporte',emoji:'🚕',palabras:['cabify','uber','didi','remis','taxi','sube','colectivo','tren','subte','tren sarmiento']},
  {categoria:'Perfumería',emoji:'💄',palabras:['perfumeria','perfumerias','perfume','maquillaje','cosmetica']},
  {categoria:'Cuidado personal',emoji:'💇',palabras:['peluqueria','barberia','manicura','spa','estetica','depilacion','gimnasio','sportclub']},
  {categoria:'Seguros',emoji:'🛡️',palabras:['seguro','poliza','sancor seguros','federacion patronal','zurich','mapfre','aseguradora']},
  {categoria:'Regalos',emoji:'🎁',palabras:['regalo','regalos','juguete','jugueteria','floreria']},
  {categoria:'Suscripciones',emoji:'📱',palabras:['google','netflix','spotify','disney','hbo','youtube premium','apple music','amazon prime','icloud','chatgpt','claude','paramount','hbo max']},
];
export const TODAS_CATEGORIAS=[...REGLAS.map(r=>({categoria:r.categoria,emoji:r.emoji})),{categoria:'Otros',emoji:'📦'}];

// Categorías que alimentan la sección Auto (se cargan UNA vez en Gastos).
// "Peajes/Autopistas" es el nombre histórico: se sigue leyendo para no perder registros.
export const GRUPOS_AUTO = {
  combustible:   { label:'Combustible',        emoji:'⛽', categorias:['Combustible'] },
  peajes:        { label:'Peajes y TelePASE',  emoji:'🛣️', categorias:['Peajes/TelePASE','Peajes/Autopistas'] },
  mantenimiento: { label:'Mantenimiento',      emoji:'🔧', categorias:['Mantenimiento'] },
  sinClasificar: { label:'Auto (por clasificar)', emoji:'🚗', categorias:['Auto'] },
};

// Los resúmenes de tarjeta traen nombres "sucios": prefijos de procesadoras
// (MERPAGO*, MP*...), "*" y códigos numéricos largos. Se limpian antes de comparar.
const PREFIJOS_RUIDO = [
  'merpago*','mercadopago*','mp*','pagomiscuentas','pago mis cuentas',
  'decidir*','pagofacil*','pago facil*','rapipago*','todopago*','todo pago*','debin',
];
export const norm=s=>{
  let d = String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  PREFIJOS_RUIDO.forEach(p => { if (d.startsWith(p)) d = d.slice(p.length).trim(); });
  d = d.replace(/\*/g,' ').replace(/\b\d{4,}\b/g,' ').replace(/\s{2,}/g,' ').trim();
  return d;
};

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const coincide = (d, palabra) => {
  const p = palabra.trim();
  if (p.length <= 4) return new RegExp(`(^|[^a-z0-9])${esc(p)}([^a-z0-9]|$)`).test(d);
  return d.includes(p);
};

export const categorizarUno=desc=>{
  const d=norm(desc);
  for(const r of REGLAS){ if(r.palabras.some(p=>coincide(d,p))) return {categoria:r.categoria,emoji:r.emoji}; }
  return {categoria:'Otros',emoji:'📦'};
};
export const categorizarNuevos=(items,catMap)=>{const mapa={};[...new Set(items.map(i=>i.que).filter(Boolean))].filter(d=>!catMap[d]).forEach(d=>{mapa[d]=categorizarUno(d);});return mapa;};

// Tipos de movimiento de tarjeta que van al bloque "Pagos/Impuestos/Intereses"
export const TIPOS_FINANCIEROS = ['pago','interes','impuesto','comision'];

// Clasifica un movimiento de tarjeta con la MISMA prioridad en todos lados:
// 1) cuotas → "Cuotas"  2) financiero → "Pagos/Impuestos/Intereses"  3) resto → categoría guardada o por reglas.
export const categorizarMovimientoTarjeta = ({ comercio, cuotas, tipoMovimiento }, categories) => {
  if (cuotas && cuotas.trim() !== '') return { categoria:'Cuotas', emoji:'\uD83E\uDD9E' };
  if (TIPOS_FINANCIEROS.includes(tipoMovimiento)) return { categoria:'Pagos/Impuestos/Intereses', emoji:'\uD83D\uDCB0' };
  return categories[comercio] || categorizarUno(comercio);
};

// Un solo punto de entrada para categorizar cualquier ítem de Gastos (Zapia o tarjeta).
export const categorizarItem = (item, categories) => item.origen === 'tarjeta'
  ? categorizarMovimientoTarjeta({ comercio:item.key, cuotas:item.cuotas, tipoMovimiento:item.tipoMovimiento }, categories)
  : (categories[item.key] || categorizarUno(item.key));

// Variantes de nombre que deben mapear al mismo emoji
const ALIAS_CATEGORIA = {
  'suscripcion':'Suscripciones', 'suscripciones':'Suscripciones',
  'peajes':'Peajes/TelePASE', 'autopistas':'Peajes/TelePASE', 'peajes/autopistas':'Peajes/TelePASE', 'telepase':'Peajes/TelePASE',
  'perfumeria':'Perfumería', 'perfumerias':'Perfumería',
  'mascota':'Mascotas', 'veterinaria':'Mascotas',
  'tecnologia':'Tecnología', 'educacion':'Educación', 'indumentaria':'Indumentaria',
};

export const emojiCorrectoParaCategoria = (nombreCategoria) => {
  const key = norm(nombreCategoria);
  const directo = TODAS_CATEGORIAS.find(c => norm(c.categoria) === key);
  if (directo) return directo.emoji;
  const aliasNombre = ALIAS_CATEGORIA[key];
  if (aliasNombre) {
    const viaAlias = TODAS_CATEGORIAS.find(c => c.categoria === aliasNombre);
    if (viaAlias) return viaAlias.emoji;
  }
  return null;
};
