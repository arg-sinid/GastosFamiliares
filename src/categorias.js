const REGLAS=[
  {categoria:'Supermercado',emoji:'🛒',palabras:['chino','super','supermercado','coto','carrefour','disco','walmart','dia','vea','jumbo','almacen','mercado','kiosco','minimarket','maxiconsumo','mayorista','changomas','chango mas','la anonima','punto pack','autoservicio','yaguar','vital','josimar']},
  {categoria:'Carnicería',emoji:'🥩',palabras:['carniceria','carne','asado','pollo','vacio','costilla','chorizo','morcilla','pescaderia','fiambreria','matarife','achuras','milanesa']},
  {categoria:'Verdulería',emoji:'🥬',palabras:['verduleria','verdura','fruta','fruteria','papa','tomate','cebolla','lechuga','organico']},
  {categoria:'Panadería',emoji:'🥐',palabras:['panaderia','pan','factura','medialunas','torta','pasteleria','confiteria']},
  {categoria:'Auto',emoji:'🚗',palabras:['mecanico','taller','repuesto','nafta','gnc','combustible','neumatico','gomeria','lavadero','peaje','autopista','aceite','lubricentro','bateria','service','ypf','shell','axion','petrobras','estacion','puma energy','vtv','patente','seguro auto','cochera','estacionamiento','parquimetro']},
  {categoria:'Farmacia',emoji:'💊',palabras:['farmacia','medicamento','remedio','drogueria','pastilla','jarabe','farmacity','vitaminas','farmaonline']},
  {categoria:'Salud',emoji:'🏥',palabras:['medico','doctor','consulta','laboratorio','optica','dentista','clinica','hospital','turno','radiografia','ecografia','kinesiologia','psicologia','ceb salud','obra social','swiss medical','osde','galeno','ioma','sanatorio','fisioterapia','nutricionista']},
  {categoria:'Comidas',emoji:'🍕',palabras:['delivery','pedidos','restaurant','restaurante','pizza','hamburguesa','sushi','empanada','rotiseria','bar','cafe','cafeteria','lomiteria','rappi','pedidosya','mcdonalds','burger','mostaza','gochiso','heladeria','helado','kfc','starbucks','subway','grido','freddo','parrilla','choripan','food']},
  {categoria:'Indumentaria',emoji:'👕',palabras:['ropa','zapato','zapateria','indumentaria','remera','pantalon','calzado','zapatillas','jean','campera','cartera','medias','ropa interior','adidas','nike','topper','mimo','kosiuko']},
  {categoria:'Hogar',emoji:'🏠',palabras:['ferreteria','limpieza','electricidad','plomero','pintura','mueble','bazar','electrodomestico','detergente','lavandina','escoba','easy','sodimac','barugel','pinturería','gasista','tornillo','cerrajero']},
  {categoria:'Tecnología',emoji:'📱',palabras:['celular','computadora','notebook','tablet','auricular','cable','cargador','electronica','garbarino','fravega','megatone','mercadolibre','mercado libre','musimundo','compumundo','iphone','samsung','pc factory']},
  {categoria:'Entretenimiento',emoji:'🎭',palabras:['cine','teatro','show','recital','entrada','juego','deporte','netflix','spotify','disney','streaming','tuentrada','cine fan black','ticketek','plateanet','boliche','fiesta','cumpleanos','salon de fiestas']},
  {categoria:'Educación',emoji:'📚',palabras:['colegio','escuela','libreria','cuaderno','libro','universidad','curso','guardapolvo','jardin','cuota colegio','instituto','fotocopias','uba']},
  {categoria:'Mascotas',emoji:'🐾',palabras:['veterinaria','veterinario','vacuna','antipulgas','balanceado','petshop','zoocopet','pet shop','peluqueria canina']},
  {categoria:'Servicios',emoji:'🧾',palabras:['edenor','edesur','metrogas','aysa','claro','movistar','personal','telecentro','fibertel','factura','tarjeta naranja','directv','flow','expensas','abl','rentas','municipalidad','tasa','arba','afip','monotributo']},
  {categoria:'Peajes/Autopistas',emoji:'🛣️',palabras:['autopista','autopistas','peaje','camino pque','au buenos aires la plata','panamericana','acceso oeste','au ricchieri']},
  {categoria:'Transporte',emoji:'🚕',palabras:['cabify','uber ','didi ','remis','taxi','sube','colectivo','tren','subte','tren sarmiento']},
  {categoria:'Perfumería',emoji:'💄',palabras:['perfumeria','perfumerias','perfume','maquillaje','cosmetica']},
  {categoria:'Cuidado personal',emoji:'💇',palabras:['peluqueria','barberia','manicura','spa','estetica','depilacion','gimnasio','sportclub']},
  {categoria:'Seguros',emoji:'🛡️',palabras:['seguro','poliza','sancor seguros','federacion patronal','zurich','mapfre','aseguradora']},
  {categoria:'Regalos',emoji:'🎁',palabras:['regalo','regalos','juguete','juguetería','floreria']},
  {categoria:'Suscripciones',emoji:'📱',palabras:['google','netflix','spotify','disney','hbo','youtube premium','apple music','amazon prime','icloud','chatgpt','claude','paramount','hbo max']},
];
export const TODAS_CATEGORIAS=[...REGLAS.map(r=>({categoria:r.categoria,emoji:r.emoji})),{categoria:'Otros',emoji:'📦'}];
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
export const categorizarUno=desc=>{const d=norm(desc);for(const r of REGLAS){if(r.palabras.some(p=>d.includes(p)))return{categoria:r.categoria,emoji:r.emoji};}return{categoria:'Otros',emoji:'📦'};};
export const categorizarNuevos=(items,catMap)=>{const mapa={};[...new Set(items.map(i=>i.que).filter(Boolean))].filter(d=>!catMap[d]).forEach(d=>{mapa[d]=categorizarUno(d);});return mapa;};

// Tipos de movimiento de tarjeta que van al bloque "Pagos/Impuestos/Intereses" (no son consumo real)
export const TIPOS_FINANCIEROS = ['pago','interes','impuesto','comision'];

// Nombres alternativos que deberían mapear al mismo emoji correcto (variantes con/sin tilde, singular/plural)
const ALIAS_CATEGORIA = {
  'suscripcion':'Suscripciones', 'suscripciones':'Suscripciones',
  'peajes':'Peajes/Autopistas', 'autopistas':'Peajes/Autopistas', 'peajes/autopistas':'Peajes/Autopistas',
  'perfumeria':'Perfumería', 'perfumerias':'Perfumería',
  'mascota':'Mascotas', 'veterinaria':'Mascotas',
  'tecnologia':'Tecnología',
  'educacion':'Educación',
  'indumentaria':'Indumentaria',
};

// Dado el nombre de una categoría ya guardada, busca si existe un emoji "correcto" conocido
// (por coincidencia exacta o por alias), para poder reparar entradas con emoji genérico/roto.
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
