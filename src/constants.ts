export const THEMES: Record<string, any> = {
  clik: {
    bg: "#f4f3f2", surf: "#ffffff", surf2: "#f2f3f9", border: "#d8dae0",
    text: "#1c1b1f", sub: "#49454f", muted: "#79747e", accent: "#d97757",
    accentBg: "rgba(217, 119, 87, 0.15)", accentGlow: "rgba(217, 119, 87, 0.25)",
    red: "#ba1a1a", redBg: "#ffdad6", green: "#006d3a", greenBg: "#96f7b4",
    amber: "#d97757", amberBg: "rgba(217, 119, 87, 0.15)", purple: "#9300a1", shadow: "0 4px 12px rgba(217, 119, 87, 0.05)"
  },
  clik_dark: {
    bg: "#0f172a", surf: "#1e293b", surf2: "#334155", border: "#475569",
    text: "#f8fafc", sub: "#cbd5e1", muted: "#94a3b8", accent: "#d97757",
    accentBg: "rgba(217, 119, 87, 0.1)", accentGlow: "rgba(217, 119, 87, 0.2)",
    red: "#ff5449", redBg: "rgba(255, 84, 73, 0.1)", green: "#10b981", greenBg: "rgba(16, 185, 129, 0.1)",
    amber: "#d97757", amberBg: "rgba(217, 119, 87, 0.1)", purple: "#bd93f9", shadow: "0 8px 30px rgba(0, 0, 0, 0.4)"
  }
};

export const THEME_PAIRS: Record<string, string> = {
  clik: "clik_dark",
};

export const LIGHT = THEMES.clik;
export const DARK = THEMES.clik_dark;
export const TERRA = THEMES.clik; // Fallback or distinct if needed

export const USERS_INIT = [
  { id: 1, nombre: "Administrador", usuario: "admin", password: "4415", rol: "maestro", permisos: { caja: true, estadisticas: true, costos: true, editarCC: true, borrarClientes: true, agregarConceptos: true, anularPagos: true, cuentasVisibles: [], widgetsVisibles: [] } },
  { id: 2, nombre: "Fernando", usuario: "ferna", password: "4415", rol: "maestro", permisos: { caja: true, estadisticas: true, costos: true, editarCC: true, borrarClientes: true, agregarConceptos: true, anularPagos: true, cuentasVisibles: [], widgetsVisibles: [] } },
  { id: 3, nombre: "Ana", usuario: "ana", password: "4415", rol: "maestro", permisos: { caja: true, estadisticas: true, costos: true, editarCC: true, borrarClientes: true, agregarConceptos: true, anularPagos: true, cuentasVisibles: [], widgetsVisibles: [] } },
  { id: 4, nombre: "Denise", usuario: "denise", password: "1234", rol: "usuario", permisos: { caja: false, estadisticas: false, costos: false, editarCC: false, borrarClientes: false, agregarConceptos: false, anularPagos: false, cuentasVisibles: [], widgetsVisibles: [] } },
];

export const CLIENTE_CF = { id: 0, codigo: "CF", nombre: "Consumidor Final", telefono: "", email: "", direccion: "", localidad: "", provincia: "", nombreCV: "", listaPrecios: null, creditoMax: 0, saldoInicial: 0, estado: "activo", esConsumidorFinal: true };

export const CLIENTES_INIT = [
  CLIENTE_CF,
  { id: 1, codigo: "0049", nombre: "Adaro Carina Beatriz", telefono: "2646718770", email: "", direccion: "", localidad: "", provincia: "San Juan", nombreCV: "", listaPrecios: null, creditoMax: 0, saldoInicial: 0, estado: "activo" },
  { id: 2, codigo: "0149", nombre: "Adaro Valeria", telefono: "", email: "", direccion: "", localidad: "", provincia: "San Juan", nombreCV: "", listaPrecios: null, creditoMax: 0, saldoInicial: 0, estado: "activo" },
  { id: 3, codigo: "0001", nombre: "Aguero José Antonio", telefono: "2644143488", email: "", direccion: "", localidad: "", provincia: "San Juan", nombreCV: "", listaPrecios: null, creditoMax: 0, saldoInicial: 0, estado: "activo" },
  { id: 12, codigo: "0074", nombre: "CIG. Aguero José", telefono: "", email: "", direccion: "", localidad: "", provincia: "San Juan", nombreCV: "", listaPrecios: null, creditoMax: 0, saldoInicial: 0, estado: "activo", nombresPlanilla: ["CIG. AGUERO JOSE"], clienteFisicoId: 3 },
  // ... (Trunced for brevity, in real usage would be full)
];

export const PROVEEDORES_INIT = [
  { id: 1, codigo: "0004", nombre: "AL NORTE DISTRIBUCIONES", cuit: "", telefono: "2613611276", email: "", direccion: "", localidad: "", provincia: "MENDOZA", obs: "", estado: "activo" },
  { id: 6, codigo: "0018", nombre: "N&H Mayoristas", cuit: "30-71685748-0", telefono: "2616585751", email: "", direccion: "Parque Industrial Maipú", localidad: "", provincia: "", obs: "", estado: "activo" },
  { id: 9, codigo: "0001", nombre: "RGP - SEAC", cuit: "", telefono: "", email: "", direccion: "FITZ ROY 1440", localidad: "CABA", provincia: "BUENOS AIRES", obs: "Proveedor Carga Virtual", estado: "activo" },
];

export const FAMILIAS_INIT = ["CIG.", "TAB.", "Varios", "Servicios"];

export const ARTICULOS_INIT = [
  { id: 1, codigo: "110", nombre: "CIG. RED POINT KS X 20U", familia: "CIG.", proveedor: 1, costo: 1300, utilidad: [5.38, 7.69, 3.85, 4.62], stock: 0, minimo: 0 },
  { id: 28, codigo: "099", nombre: "TARJETA SUBE", familia: "Varios", proveedor: 1, costo: 1990, utilidad: [0, 0, 0, 0], stock: 0, minimo: 0, diasAlerta: 2 },
  { id: 30, codigo: "044", nombre: "SALDO CV", familia: "Servicios", proveedor: 9, costo: 0, utilidad: [0, 0, 0, 0], stock: 0, minimo: 0, llevaStock: false, precio1: 1, precio2: 1, precio3: 1, precio4: 1 },
];

export const CUENTAS_INIT = [
  { id: 1, nombre: "Caja", tipo: "caja", saldo: 0, color: "#f59e0b" },
  { id: 2, nombre: "Banco San Juan", tipo: "banco", saldo: 0, color: "#4f7cff" },
  { id: 3, nombre: "Banco Patagonia", tipo: "banco", saldo: 0, color: "#a855f7" },
  { id: 4, nombre: "Fondo FCI", tipo: "inversion", saldo: 0, color: "#22c55e" },
  { id: 5, nombre: "Banco BBVA", tipo: "banco", saldo: 0, color: "#0066cc" },
];

export const CONCEPTOS_INIT = [
  { id: 1, nombre: "Alquiler", tipo: "egreso", activo: true },
  { id: 2, nombre: "Servicios", tipo: "egreso", activo: true },
  { id: 3, nombre: "Combustible", tipo: "egreso", activo: true },
  { id: 4, nombre: "Estacionamiento", tipo: "egreso", activo: true },
  { id: 5, nombre: "Sueldos", tipo: "egreso", activo: true },
  { id: 6, nombre: "Carlos", tipo: "egreso", activo: true },
  { id: 7, nombre: "Comisiones Vendedores", tipo: "egreso", activo: true },
  { id: 8, nombre: "Gastos Bancarios", tipo: "egreso", activo: true },
  { id: 9, nombre: "Medicina Prepaga", tipo: "egreso", activo: true },
  { id: 10, nombre: "Encomiendas", tipo: "egreso", activo: true },
  { id: 11, nombre: "Gastos Varios", tipo: "egreso", activo: true },
  { id: 12, nombre: "Préstamos", tipo: "egreso", activo: true },
  { id: 13, nombre: "Reintegros", tipo: "ingreso", activo: true },
  { id: 14, nombre: "Otros Ingresos", tipo: "ingreso", activo: true },
  { id: 15, nombre: "Préstamo", tipo: "egreso", activo: true },
  { id: 16, nombre: "Otro Egreso", tipo: "egreso", activo: true },
  { id: 17, nombre: "Mantenimiento de Cuenta", tipo: "egreso", activo: true },
  { id: 18, nombre: "Ajuste Salida", tipo: "egreso", activo: true },
  { id: 19, nombre: "Ajuste Entrada", tipo: "ingreso", activo: true },
  { id: 20, nombre: "Recupero Alquiler", tipo: "ingreso", activo: true },
  { id: 21, nombre: "ARCA", tipo: "egreso", activo: true }
];

export const UNIDADES_NEGOCIO = [
  "General",
  "Kiosco",
  "Cigarrillos y Tabaquería",
  "Carga Virtual",
  "Logística"
];

export const COND_PAGO = ["Contado", "72 Horas", "8 Días", "15 Días", "30 Días", "Financiado"];
export const COND_DIAS: Record<string, number | null> = { "Contado": 0, "72 Horas": 3, "8 Días": 8, "15 Días": 15, "30 Días": 30, "Financiado": null };
export const CODIGOS_A_FISICO = ["044", "049", "099"];

export const DEST_CUENTA: Record<string, number> = {
  "BSJ": 2, "BANCO SAN JUAN": 2,
  "PAT": 3, "PATAGONIA": 3, "BANCO PATAGONIA": 3,
  "BBVA": 5, "BANCO BBVA": 5,
  "CAJA": 1, "EFECTIVO": 1
};

export const DEST_PROVEEDOR: Record<string, number> = {
  "ALNTE": 1, "AL NORTE": 1,
  "RGP-SEAC": 2, "RGP-SUBE": 2,
  "ESPERT": 3,
  "N&H": 4
};

export const TIPOS_KARDEX = {
  ENTRADA_COMPRA: "entrada_compra",
  SALIDA_VENTA: "salida_venta",
  ENTRADA_AJUSTE: "entrada_ajuste",
  SALIDA_AJUSTE: "salida_ajuste",
  ENTRADA_DEVOLUCION: "entrada_devolucion",
};

export const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", 
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", 
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
  "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

export const LOCALIDADES_POR_PROVINCIA: Record<string, string[]> = {
  "San Juan": ["San Juan (Capital)", "Rivadavia", "Santa Lucía", "Rawson", "Chimbas", "Pocito", "Caucete", "Jáchal", "Albardón", "Sarmiento", "25 de Mayo", "9 de Julio", "San Martín", "Angaco", "Zonda", "Ullum", "Iglesia", "Valle Fértil", "Calingasta"],
  "Mendoza": ["Mendoza (Capital)", "Guaymallén", "Godoy Cruz", "Las Heras", "Maipú", "Luján de Cuyo", "San Rafael", "San Martín", "Rivadavia", "Junín", "Santa Rosa", "La Paz", "Tunuyán", "Tupungato", "San Carlos", "General Alvear", "Malargüe", "Lavalle"],
  "San Luis": ["San Luis (Capital)", "Villa Mercedes", "Merlo", "La Punta", "Juana Koslay", "Justo Daract", "Quines", "La Toma", "Tilisarao", "Concarán"],
  "CABA": ["Agronomía", "Almagro", "Balvanera", "Barracas", "Belgrano", "Boedo", "Caballito", "Chacarita", "Coghlan", "Colegiales", "Constitución", "Flores", "Floresta", "La Boca", "La Paternal", "Liniers", "Mataderos", "Monte Castro", "Montserrat", "Nueva Pompeya", "Nuñez", "Palermo", "Parque Avellaneda", "Parque Chacabuco", "Parque Chas", "Parque Patricios", "Puerto Madero", "Recoleta", "Retiro", "Saavedra", "San Cristóbal", "San Nicolás", "San Telmo", "Vélez Sársfield", "Versalles", "Villa Crespo", "Villa del Parque", "Villa Devoto", "Villa General Mitre", "Villa Lugano", "Villa Luro", "Villa Ortúzar", "Villa Pueyrredón", "Villa Real", "Villa Riachuelo", "Villa Santa Rita", "Villa Soldati", "Villa Urquiza"],
  "Buenos Aires": ["La Plata", "Mar del Plata", "Bahía Blanca", "San Nicolás", "Tandil", "Zárate", "Pergamino", "Olavarría", "Junín", "Luján", "Campana", "Necochea", "Chivilcoy", "Pilar", "Escobar", "Tigre", "San Isidro", "Vicente López", "Avellaneda", "Lanús", "Quilmes", "Lomas de Zamora", "La Matanza", "Morón", "Moreno", "Merlo", "Florencio Varela", "Berazategui", "Almirante Brown", "Esteban Echeverría", "San Miguel", "Jose C. Paz", "Malvinas Argentinas", "Ituzaingó", "Tres de Febrero", "San Martin", "Hurlingham"],
  "Córdoba": ["Córdoba (Capital)", "Río Cuarto", "Villa María", "Villa Carlos Paz", "San Francisco", "Alta Gracia", "Río Tercero", "Bell Ville", "La Calera", "Jesús María", "Villa Allende"],
  "Santa Fe": ["Santa Fe (Capital)", "Rosario", "Rafaela", "Venado Tuerto", "Villa Constitución", "Reconquista", "Santo Tomé", "Esperanza", "Granadero Baigorria", "San Lorenzo"],
  "Tucumán": ["San Miguel de Tucumán", "Yerba Buena", "Tafí Viejo", "Concepción", "Banda del Río Salí", "Lules", "Monteros", "Aguilares", "Famaillá"],
  "Salta": ["Salta (Capital)", "San Ramón de la Nueva Orán", "Tartagal", "General Güemes", "San José de Metán", "Rosario de la Frontera"],
  "Jujuy": ["San Salvador de Jujuy", "San Pedro", "Palpalá", "Libertador General San Martín", "Perico"],
  "Entre Ríos": ["Paraná", "Concordia", "Gualeguaychú", "Concepción del Uruguay", "Villaguay", "Chajarí", "Victoria", "Gualeguay"],
  "Chaco": ["Resistencia", "Presidencia Roque Sáenz Peña", "Villa Ángela", "Charata", "General José de San Martín", "Juan José Castelli"],
  "Corrientes": ["Corrientes (Capital)", "Goya", "Paso de los Libres", "Curuzú Cuatiá", "Mercedes", "Bella Vista", "Monte Caseros", "Santo Tomé"],
  "Misiones": ["Posadas", "Oberá", "Eldorado", "Puerto Iguazú", "Apóstoles", "Leandro N. Alem"],
  "Santiago del Estero": ["Santiago del Estero (Capital)", "La Banda", "Termas de Río Hondo", "Frías", "Añatuya"],
  "Catamarca": ["San Fernando del Valle de Catamarca", "Valle Viejo", "Recreo", "Andalgalá", "Belén"],
  "La Rioja": ["La Rioja (Capital)", "Chilecito", "Aimogasta", "Chamical", "Chepes"],
  "La Pampa": ["Santa Rosa", "General Pico", "Toay", "General Acha", "Eduardo Castex"],
  "Neuquén": ["Neuquén (Capital)", "Cutral Có", "Plaza Huincul", "Centenario", "Plottier", "San Martín de los Andes", "Zapala"],
  "Río Negro": ["Viedma", "San Carlos de Bariloche", "General Roca", "Cipolletti", "Villa Regina", "Cinco Saltos"],
  "Chubut": ["Rawson", "Comodoro Rivadavia", "Trelew", "Puerto Madryn", "Esquel"],
  "Santa Cruz": ["Río Gallegos", "Caleta Olivia", "El Calafate", "Puerto Deseado", "Las Heras"],
  "Tierra del Fuego": ["Ushuaia", "Río Grande", "Tolhuin"],
  "Formosa": ["Formosa (Capital)", "Clorinda", "Pirané", "El Colorado", "Las Lomitas"]
};

// --- Billing Helpers moved to utils.ts ---

