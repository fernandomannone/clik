import { parseMoney } from "../../lib/utils";

export function mapFamToUN_Logic(articulos: any[], familias: any[], aId: any, aCod: any, aNom: any) {
  const art = articulos.find((a:any) => a.id === aId || a.codigo === aCod || a.nombre === aNom);
  const famName = art ? (typeof art.familia === "string" ? art.familia : (art.familia?.nombre || "")) : "";
  
  const fObj = familias?.find((f:any) => (typeof f === "string" ? f : f.nombre) === famName);
  if (fObj && fObj.unidadNegocio) return fObj.unidadNegocio;

  const n = famName.toUpperCase();
  if (aCod === "044" || aCod === "CV" || aNom === "SALDO CV" || n.includes("VIRTUAL") || n.includes("CARGA VIRTUAL SEAC")) return "Carga Virtual";
  if (n.includes("CIG") || n.includes("TAB")) return "Cigarrillos y Tabaquería";
  if (n.includes("LOG") || n.includes("ENCOM")) return "Logística";
  if (!famName || famName === "Sin clasificar") return "General";
  return "Kiosco";
}

export function getCMVGData(
  facsPeriodo: any[],
  articulos: any[],
  familias: any[],
  kardex: any[],
  filtros: {
    cliente: string;
    familia: string;
    un: string;
    proveedor: string;
    desde: string;
    hasta: string;
  }
) {
  const mapa: any = {};
  const facsCMVG = facsPeriodo.filter(f => filtros.cliente === "Todos" || f.clienteId === parseInt(filtros.cliente));
  
  facsCMVG.forEach(f => {
    (f.items || []).forEach((it: any) => {
      const art = articulos.find(a => a.id === it.artId || a.nombre === it.nombre || (it.codigo && a.codigo === it.codigo));
      const itemCodigo = it.codigo || art?.codigo;
      const esCVItem = itemCodigo === "044" || itemCodigo === "CV" || it.nombre === "SALDO CV" || (typeof art?.familia === "string" ? art.familia : art?.familia?.nombre || "").toUpperCase().includes("VIRTUAL");
      const familiaDelArt = art ? (typeof art.familia === "string" ? art.familia : art.familia?.nombre) : null;
      const familiaReal = familiaDelArt || (esCVItem ? "Carga Virtual" : "Sin clasificar");
      const unReal = mapFamToUN_Logic(articulos, familias, it.artId, itemCodigo, it.nombre);
      
      if (filtros.familia !== "Todas" && familiaReal !== filtros.familia) return;
      if (filtros.un !== "Todas" && unReal !== filtros.un) return;
      if (!esCVItem && filtros.proveedor !== "Todos" && String(art?.proveedorId || art?.proveedor || "") !== filtros.proveedor) return;
      
      const esNC = f.tipo === "nc";
      const cantAbs = parseMoney(it.cantidad) || 0;
      const cant = esNC ? -cantAbs : cantAbs;
      const precioUnit = Math.abs(parseMoney(it.precio) || 0);
      const bonif = parseFloat(it.bonif) || 0;
      const precioNeto = precioUnit * (1 - bonif / 100);
      const costoUnit = esCVItem ? 0 : (parseFloat(it.costoUnit) || art?.costo || 0);
      const ingreso = esNC ? -(precioNeto * cantAbs) : precioNeto * cantAbs;
      const costo = esNC ? -(costoUnit * cantAbs) : costoUnit * cantAbs;
      const is666or667 = itemCodigo === "666" || itemCodigo === "667";
      const esServicio = (esCVItem || art?.llevaStock === false) && !is666or667;
      const key = itemCodigo || it.nombre || art?.codigo || art?.nombre || "—";
      const nombreMostrar = esCVItem ? (art?.nombre || it.nombre || "SALDO CV") : (art?.nombre || it.nombre || "—");
      
      if (!mapa[key]) mapa[key] = { codigo: itemCodigo || art?.codigo || "—", nombre: nombreMostrar, familia: familiaReal, unidades: 0, ingreso: 0, costo: 0, esServicio };
      
      mapa[key].unidades += cant;
      mapa[key].ingreso  += ingreso;
      mapa[key].costo    += costo;
    });
  });

  if (filtros.cliente === "Todos") {
    const vKardex = kardex || [];
    const ajustesPeriodo = vKardex.filter((m: any) => 
      (m.tipo === "ENTRADA_AJUSTE" || m.tipo === "SALIDA_AJUSTE") &&
      m.fecha >= filtros.desde && m.fecha <= filtros.hasta &&
      !m.esInicial
    );

    ajustesPeriodo.forEach((m: any) => {
      const art = articulos.find((a: any) => a.id === m.artId);
      const familia = typeof art?.familia === "string" ? art.familia : art?.familia?.nombre || "Sin clasificar";
      const unReal = mapFamToUN_Logic(articulos, familias, m.artId, "", "");
      if (filtros.familia !== "Todas" && familia !== filtros.familia) return;
      if (filtros.un !== "Todas" && unReal !== filtros.un) return;
      
      const valorAjuste = (m.cantidad || 0) * (art?.costo || 0);
      const esMerma = m.tipo === "SALIDA_AJUSTE";
      
      const key = `ADJ_${familia}`;
      if (!mapa[key]) {
        mapa[key] = { 
          codigo: "AJUSTE", 
          nombre: "Ajustes de Inventario / Mermas", 
          familia: familia, 
          unidades: 0, 
          ingreso: 0, 
          costo: 0, 
          esServicio: false,
          esAjusteVirtual: true 
        };
      }
      
      mapa[key].costo += esMerma ? valorAjuste : -valorAjuste;
      mapa[key].unidades += esMerma ? -m.cantidad : m.cantidad;
    });
  }

  return Object.values(mapa)
    .map((r: any) => ({
      ...r,
      ganancia: r.esServicio ? 0 : r.ingreso - r.costo,
      margen:   r.esServicio ? null : (r.ingreso > 0 ? (r.ingreso - r.costo) / r.ingreso * 100 : 0),
      precioPromPond: r.unidades > 0 ? r.ingreso / r.unidades : 0,
    }))
    .filter((r: any) => !r.esServicio || r.familia === "Carga Virtual" || r.codigo === "044")
    .sort((a: any, b: any) => (a.familia || "").localeCompare(b.familia || "", "es") || b.ingreso - a.ingreso);
}

export function getRentabilidadFactura(
  facsPeriodo: any[],
  clientes: any[],
  articulos: any[],
  filtRentCliente: string,
  skRent: string,
  sdRent: string
) {
  return facsPeriodo.filter(f => !f.esHistorico && (filtRentCliente === "Todos" || f.clienteId === parseInt(filtRentCliente))).map(f => {
    const cli = clientes.find(c => c.id === f.clienteId);
    const esNC = f.tipo === "nc";
    const signo = esNC ? -1 : 1;
    let costo = 0;
    let ingresoConMargen = 0;
    (f.items || []).forEach((it: any) => {
      const cant = parseMoney(it.cantidad) || 0;
      const art = articulos.find(a => a.id === it.artId || a.nombre === it.nombre || (it.codigo && a.codigo === it.codigo));
      const is666or667 = it.codigo === "666" || it.codigo === "667";
      const esServicio = (art?.llevaStock === false || (typeof art?.familia === "string" ? art.familia : art?.familia?.nombre) === "Servicios") && !is666or667 && it.codigo !== "044" && it.nombre !== "SALDO CV";
      if (esServicio) return;
      const precioUnit = parseFloat(it.precio) || 0;
      const bonif = parseFloat(it.bonif) || 0;
      const costoUnit = parseFloat(it.costoUnit) || (art?.costo || 0);
      costo += signo * costoUnit * cant;
      ingresoConMargen += signo * precioUnit * (1 - bonif / 100) * cant;
    });
    const ingreso = signo * (f.total || 0);
    const ganancia = ingresoConMargen - costo;
    const margen = ingresoConMargen > 0 ? ganancia / ingresoConMargen * 100 : 0;
    return { ...f, clienteNombre: cli?.nombre || "—", costo, ganancia, margen, ingresoConMargen };
  }).sort((a: any, b: any) => {
    const sign = sdRent === "asc" ? 1 : -1;
    if (skRent === "numero") return sign * (a.numero || "").localeCompare(b.numero || "");
    if (skRent === "clienteNombre") return sign * a.clienteNombre.localeCompare(b.clienteNombre);
    if (skRent === "total") return sign * (a.total - b.total);
    if (skRent === "ganancia") return sign * (a.ganancia - b.ganancia);
    if (skRent === "margen") return sign * (a.margen - b.margen);
    return sign * a.fecha.localeCompare(b.fecha);
  });
}

export function getComprasProveedor(
  factProv: any[],
  proveedores: any[],
  desde: string,
  hasta: string
) {
  const mapa: any = {};
  factProv.filter(f => f.tipo === "factura" && !f.anulada && f.fecha >= desde && f.fecha <= hasta).forEach(f => {
    const prov = proveedores.find(p => p.id === f.proveedorId);
    const nombre = prov?.nombre || "—";
    if (!mapa[f.proveedorId]) mapa[f.proveedorId] = { nombre, facturas: 0, total: 0 };
    mapa[f.proveedorId].facturas++;
    mapa[f.proveedorId].total += f.total || 0;
  });
  return Object.values(mapa).sort((a: any, b: any) => b.total - a.total);
}

export function getGastosConcepto(
  movimientos: any[],
  conceptos: any[],
  desde: string,
  hasta: string
) {
  const mapa: any = {};
  movimientos.filter(m => m.tipo === "egreso" && m.conceptoId && m.fecha >= desde && m.fecha <= hasta).forEach(m => {
    const conc = conceptos?.find(c => c.id === m.conceptoId);
    const nombre = conc?.nombre || m.concepto || "—";
    if (!mapa[nombre]) mapa[nombre] = { concepto: nombre, cantidad: 0, total: 0 };
    mapa[nombre].cantidad++;
    mapa[nombre].total += m.monto || 0;
  });
  return Object.values(mapa).sort((a: any, b: any) => b.total - a.total);
}

export function getEvolucionMensual(
  facturas: any[],
  articulos: any[],
  familias: any[],
  utilidadesFCI: any[],
  evMeses: string,
  evDesde: string,
  evHasta: string,
  today: string
) {
  const hoy = new Date(today + "T00:00:00");
  let mesInicio, mesFin;
  if(evMeses === "custom" && evDesde && evHasta) {
    mesInicio = evDesde;
    mesFin = evHasta;
  } else {
    const n = parseInt(evMeses) || 6;
    const ini = new Date(hoy.getFullYear(), hoy.getMonth() - n + 1, 1);
    mesInicio = ini.toISOString().slice(0, 7);
    mesFin = today.slice(0, 7);
  }

  const famNormalize = (f: string) => {
    if (!f) return "Sin clasificar";
    const val = f.trim();
    const low = val.toLowerCase();
    
    const existMatch = (familias || []).find((fam: any) => {
      const fn = (typeof fam === "string" ? fam : fam.nombre).toLowerCase();
      return low === fn || low.startsWith(fn + " ") || low.startsWith(fn + ".");
    });
    if (existMatch) return typeof existMatch === "string" ? existMatch : existMatch.nombre;

    if (low.includes("virtual") || low === "044" || low === "saldo cv" || low === "cv" || low.includes("carga virtual seac")) return "Carga Virtual";
    if (low.startsWith("cig.") || low.includes("cigarrillo")) return "Cigarrillos";
    if (low.startsWith("tab.") || low.includes("tabaco")) return "Tabaco";
    if (low === "varios") return "Varios";
    if (low === "servicio interno") return "Servicio Interno";
    
    return val;
  };

  const familiasMes: any = {};
  const familasSet = new Set<string>();
  
  (familias || []).forEach(f => {
    let nom = typeof f === "object" ? f.nombre : f;
    familasSet.add(famNormalize(nom));
  });

  facturas.filter(f => (f.tipo === "factura" || f.tipo === "nc" || (f.tipo === "fa" && f.isHistoricalCMV)) && !f.anulada).forEach(f => {
    const mes = f.fecha?.slice(0, 7);
    if (!mes || mes < mesInicio || mes > mesFin) return;
    const esNC = f.tipo === "nc";
    if (!familiasMes[mes]) familiasMes[mes] = {};
    (f.items || []).forEach((it: any) => {
      const art = articulos.find(a => a.id === it.artId || a.nombre === it.nombre || (it.codigo && a.codigo === it.codigo));
      const esCV = it.codigo === "044" || it.codigo === "CV" || it.nombre === "SALDO CV" || famNormalize(it.nombre) === "Carga Virtual";
      const is666or667 = it.codigo === "666" || it.codigo === "667";

      if (!f.isHistoricalCMV && !esCV && (!art || (art.llevaStock === false && !is666or667))) return; 

      const familiaDelArt = art ? (typeof art.familia === "string" ? art.familia : art.familia?.nombre) : null;
      let familia = famNormalize(familiaDelArt || (esCV ? "Carga Virtual" : it.nombre));
      
      familasSet.add(familia);
      const cantAbs = parseMoney(it.cantidad) || 0;
      const cant = esNC ? -cantAbs : cantAbs;
      const precioNeto = (parseMoney(it.precio) || 0) * (1 - (parseFloat(it.bonif) || 0) / 100);
      const costoUnit = parseFloat(it.costoUnit) || (art?.costo || 0);
      const ingreso = esNC ? -(precioNeto * cantAbs) : precioNeto * cantAbs;
      const costo = esNC ? -(costoUnit * cantAbs) : costoUnit * cantAbs;
      if (!familiasMes[mes][familia]) familiasMes[mes][familia] = { ingreso: 0, costo: 0, unidades: 0 };
      familiasMes[mes][familia].ingreso += ingreso;
      familiasMes[mes][familia].costo   += costo;
      familiasMes[mes][familia].unidades += cant;
    });
  });

  utilidadesFCI.forEach(u => {
    const mes = u.fecha?.slice(0, 7);
    if (!mes || mes < mesInicio || mes > mesFin) return;
    if (!familiasMes[mes]) familiasMes[mes] = {};
    if (!familiasMes[mes]["📈 Utilidad FCI"]) familiasMes[mes]["📈 Utilidad FCI"] = { ingreso: 0, costo: 0, unidades: 0 };
    familiasMes[mes]["📈 Utilidad FCI"].ingreso += u.monto || 0;
    familasSet.add("📈 Utilidad FCI");
  });

  const mesesLista = [];
  const cur = new Date(mesInicio + "-01T00:00:00");
  const fin = new Date(mesFin + "-01T00:00:00");
  while(cur <= fin) {
    mesesLista.push(cur.toISOString().slice(0, 7));
    cur.setMonth(cur.getMonth() + 1);
  }

  return {
    meses: mesesLista,
    familias: [...familasSet].sort(),
    datos: familiasMes
  };
}

export function getMovimientosConcepto(
  movimientos: any[],
  conceptos: any[],
  desde: string,
  hasta: string
) {
  const mapa: any = {};
  movimientos.filter(m => m.tipo === "egreso" && m.conceptoId && m.fecha >= desde && m.fecha <= hasta).forEach(m => {
    const conc = conceptos?.find(c => c.id === m.conceptoId);
    const nombre = conc?.nombre || m.concepto || "—";
    if (!mapa[nombre]) mapa[nombre] = [];
    mapa[nombre].push(m);
  });
  return mapa;
}



export function getVentasFamilia(
  facsPeriodo: any[],
  articulos: any[],
  familias: any[],
  filtUN: string
) {
  const mapa: any = {};
  facsPeriodo.forEach(f => {
    (f.items || []).forEach((it: any) => {
      const art = articulos.find(a => a.id === it.artId || a.nombre === it.nombre || (it.codigo && a.codigo === it.codigo));
      const esCVItem = it.codigo === "044" || it.codigo === "CV" || it.nombre === "SALDO CV" || (typeof art?.familia === "string" ? art.familia : art?.familia?.nombre || "").toUpperCase().includes("VIRTUAL");
      const familiaDelArt = art ? (typeof art.familia === "string" ? art.familia : art.familia?.nombre) : null;
      const familia = familiaDelArt || (esCVItem ? "Carga Virtual" : "Sin clasificar");
      const unReal = mapFamToUN_Logic(articulos, familias, it.artId, it.codigo, it.nombre);
      if (filtUN !== "Todas" && unReal !== filtUN) return;

      const cant = parseMoney(it.cantidad) || 0;
      const precioUnit = parseFloat(it.precio) || 0;
      const bonif = parseFloat(it.bonif) || 0;
      const ingreso = precioUnit * (1 - bonif / 100) * cant;
      const costoUnit = esCVItem ? 0 : (parseFloat(it.costoUnit) || (art?.costo || 0));
      const costo = costoUnit * cant;
      const is666or667 = it.codigo === "666" || it.codigo === "667";
      const esServicio = (esCVItem || art?.llevaStock === false) && !is666or667;
      if (!mapa[familia]) mapa[familia] = { familia, unidades: 0, ingreso: 0, costo: 0, esServicio };
      mapa[familia].unidades += cant;
      mapa[familia].ingreso += ingreso;
      mapa[familia].costo += costo;
      if (esServicio) mapa[familia].esServicio = true;
    });
  });
  return Object.values(mapa)
    .map((r: any) => ({ ...r, ganancia: r.esServicio ? 0 : r.ingreso - r.costo, margen: r.esServicio ? null : (r.ingreso > 0 ? (r.ingreso - r.costo) / r.ingreso * 100 : 0) }))
    .sort((a: any, b: any) => b.ingreso - a.ingreso);
}

export function getRankingClientes(
  facsPeriodo: any[],
  clientes: any[],
  articulos: any[],
  skRank: string,
  sdRank: string
) {
  const mapa: any = {};
  facsPeriodo.forEach(f => {
    const cli = clientes.find(c => c.id === f.clienteId);
    const nombre = cli?.nombre || f.cliente || "—";
    const esNC = f.tipo === "nc";
    const signo = esNC ? -1 : 1;
    if (!mapa[f.clienteId]) mapa[f.clienteId] = { nombre, facturas: 0, ingreso: 0, costo: 0, ingresoConMargen: 0 };
    mapa[f.clienteId].facturas++;
    mapa[f.clienteId].ingreso += signo * ((f as any).total || 0);
    (f.items || []).forEach((it: any) => {
      const cant = parseMoney(it.cantidad) || 0;
      const art = articulos.find(a => a.id === it.artId || a.nombre === it.nombre || (it.codigo && a.codigo === it.codigo));
      const itemCodigo = it.codigo || art?.codigo;
      const is666or667 = itemCodigo === "666" || itemCodigo === "667";
      const esServicio = (art?.llevaStock === false || (typeof art?.familia === "string" ? art.familia : art?.familia?.nombre) === "Servicios") && !is666or667 && itemCodigo !== "044" && it.nombre !== "SALDO CV";
      if (esServicio) return; // excluir servicios
      const precioUnit = parseFloat(it.precio) || 0;
      const bonif = parseFloat(it.bonif) || 0;
      const costoUnit = parseFloat(it.costoUnit) || (art?.costo || 0);
      mapa[f.clienteId].costo += signo * costoUnit * cant;
      mapa[f.clienteId].ingresoConMargen += signo * precioUnit * (1 - bonif / 100) * cant;
    });
  });
  return Object.values(mapa)
    .map((r: any) => ({ ...r, ganancia: r.ingresoConMargen - r.costo, margen: r.ingresoConMargen > 0 ? (r.ingresoConMargen - r.costo) / r.ingresoConMargen * 100 : 0 }))
    .sort((a: any, b: any) => {
      const sign = sdRank === "desc" ? -1 : 1;
      if (skRank === "ganancia") return sign * (b.ganancia - a.ganancia);
      if (skRank === "margen") return sign * (b.margen - a.margen);
      if (skRank === "nombre") return sign * a.nombre.localeCompare(b.nombre);
      if (skRank === "facturas") return sign * (b.facturas - a.facturas);
      return sign * (b.ingreso - a.ingreso);
    });
}

