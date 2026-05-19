import { getToday } from "../../lib/utils";

// --- Planilla del Día (Daily Balance Sheet) logic ---

export function calcularPlanillaDelDia(
  fecha: string,
  movimientos: any[],
  pagos: any[],
  pagosProv: any[],
  cuentas: any[],
  proveedores: any[],
  historialCierres: any[],
  cuentasPatrimonioIds: any[],
  conceptos: any[] = []
) {
  const f = fecha;
  const filas: any[] = [];

  // Para no duplicar sumas, obtenemos qué pagos tienen ya un movimiento
  const movIdsConRecibo = new Set(movimientos.filter((m: any) => m.reciboId != null).map((m: any) => String(m.reciboId)));
  const movIdsConPagoProv = new Set(movimientos.filter((m: any) => m.pagoProvId != null).map((m: any) => String(m.pagoProvId)));

  let saldoAnterior = 0;

  const cierresAnteriores = historialCierres
    .filter((c: any) => c.fecha < f)
    .sort((a: any, b: any) => b.fecha.localeCompare(a.fecha));

  if (cierresAnteriores.length > 0) {
    const cierreBase = cierresAnteriores[0];
    const fechaBase = cierreBase.fecha;

    const movIntermedios = movimientos
      .filter((m: any) => m.fecha > fechaBase && m.fecha < f && cuentasPatrimonioIds.includes(m.cuentaId) && !m.informativo)
      .reduce((s: number, m: any) => m.tipo === "ingreso" ? s + m.monto : s - m.monto, 0);

    const cobrosIntermedios = pagos
      .filter((p: any) => !p.anulado && p.fecha > fechaBase && p.fecha < f && p.cuentaId && cuentasPatrimonioIds.includes(p.cuentaId) && !movIdsConRecibo.has(String(p.id)))
      .reduce((s: number, p: any) => s + p.monto, 0);

    const pagosProvIntermedios = pagosProv
      .filter((p: any) => !p.anulado && p.fecha > fechaBase && p.fecha < f && p.cuentaId && cuentasPatrimonioIds.includes(p.cuentaId) && !movIdsConPagoProv.has(String(p.id)))
      .reduce((s: number, p: any) => s + p.monto, 0);

    saldoAnterior = (cierreBase.saldoActual || 0) + movIntermedios + cobrosIntermedios - pagosProvIntermedios;

  } else {
    const movAntesDeF = movimientos
      .filter((m: any) => m.fecha < f && cuentasPatrimonioIds.includes(m.cuentaId) && !m.informativo)
      .reduce((s: number, m: any) => m.tipo === "ingreso" ? s + m.monto : s - m.monto, 0);

    const cobrosAntesDeF = pagos
      .filter((p: any) => !p.anulado && p.fecha < f && p.cuentaId && cuentasPatrimonioIds.includes(p.cuentaId) && !movIdsConRecibo.has(String(p.id)))
      .reduce((s: number, p: any) => s + p.monto, 0);

    const pagosProvAntesDeF = pagosProv
      .filter((p: any) => !p.anulado && p.fecha < f && p.cuentaId && cuentasPatrimonioIds.includes(p.cuentaId) && !movIdsConPagoProv.has(String(p.id)))
      .reduce((s: number, p: any) => s + p.monto, 0);

    saldoAnterior = movAntesDeF + cobrosAntesDeF - pagosProvAntesDeF;
  }

  // Filas de cobranzas
  pagos.filter((p: any) => !p.anulado && p.fecha === f).forEach((p: any) => {
    const cuenta = cuentas.find((c: any) => c.id === p.cuentaId);
    const prov = proveedores.find((x: any) => x.id === p.proveedorId);
    let cleanObs = p.obs || "";
    if (cleanObs.includes("Importado Ingresos") || cleanObs.includes("Cobro vendedor") || cleanObs === "Cobro" || cleanObs.startsWith("Cobro cliente")) {
      cleanObs = ""; 
    }
    filas.push({
      concepto: "Cobranzas a Clientes",
      detalle: p.cliente + (cleanObs ? ` · ${cleanObs}` : ""),
      destino: cuenta?.nombre || prov?.nombre || "—",
      ingreso: p.monto, egreso: 0,
      origen: "cobro", id: p.id,
      opId: "pago_" + p.id,
      cuentaId: p.cuentaId,
      proveedorId: p.proveedorId
    });
    if (cuenta && cuenta.tipo !== "caja") {
      const enPatrimonio = cuentasPatrimonioIds.includes(cuenta.id);
      filas.push({
        concepto: "Cobranzas a Clientes",
        detalle: `→ Transferencia bancaria (${p.cliente})`,
        destino: "—",
        ingreso: 0, egreso: enPatrimonio ? 0 : p.monto,
        monto: p.monto, informativo: enPatrimonio, origen: "cobro-deposito", id: p.id + "_dep",
        opId: "pago_" + p.id,
        cuentaId: p.cuentaId,
        proveedorId: p.proveedorId
      });
    } else if (prov) {
      filas.push({
        concepto: "Cobranzas a Clientes",
        detalle: `→ Pago de proveedor (${p.cliente})`,
        destino: "—",
        ingreso: 0, egreso: p.monto, origen: "cobro-prov", id: p.id + "_prov",
        opId: "pago_" + p.id,
        cuentaId: p.cuentaId,
        proveedorId: p.proveedorId
      });
    }
  });

  // Filas de pagos a proveedores
  const idsYaIncluidos = new Set();
  pagosProv.filter((p: any) => !p.anulado && p.fecha === f && !p.reciboId && !p._desdeRecibo).forEach((p: any) => {
    const prov = proveedores.find((x: any) => x.id === p.proveedorId);
    const cuenta = cuentas.find((c: any) => c.id === p.cuentaId);
    const esPagoBancario = cuenta && cuenta.tipo === "banco";
    idsYaIncluidos.add(p.id);
    filas.push({
      concepto: "Pagos a Proveedores",
      detalle: (prov?.nombre || "Proveedor") + (p.obs ? ` — ${p.obs}` : ""),
      destino: cuenta?.nombre || "—",
      ingreso: 0, egreso: esPagoBancario ? 0 : p.monto,
      monto: p.monto, informativo: esPagoBancario, origen: "pagoprov", id: p.id,
      opId: p.grupoId || ("pagoprov_" + p.id),
      cuentaId: p.cuentaId,
      proveedorId: p.proveedorId
    });
  });

  movimientos.filter((m: any) => m.fecha === f && m.pagoProvId && !m._esImputacion && !idsYaIncluidos.has(m.pagoProvId)).forEach((m: any) => {
    const prov = proveedores.find((x: any) => pagosProv.find((p: any) => p.id === m.pagoProvId)?.proveedorId === x.id);
    const cuenta = cuentas.find((c: any) => c.id === m.cuentaId);
    const esPagoBancarioR = cuenta && cuenta.tipo === "banco";
    filas.push({
      concepto: "Pagos a Proveedores",
      detalle: m.concepto.replace("Pago proveedor — ", ""),
      destino: cuenta?.nombre || "—",
      ingreso: 0, egreso: esPagoBancarioR ? 0 : m.monto,
      monto: m.monto, informativo: esPagoBancarioR, origen: "pagoprov", id: m.id,
      opId: m.grupoId || m.pagoProvId || ("mov_" + m.id),
      cuentaId: m.cuentaId,
      proveedorId: prov?.id || null
    });
  });

  // Filas de movimientos manuales
  movimientos.filter((m: any) => {
    if (m.fecha !== f || m.pagoProvId || m.reciboId) return false;
    if (!cuentasPatrimonioIds.includes(m.cuentaId)) return false;
    // Si tiene grupoId y parece ser un cobro agrupado de clientes/proveedores, lo saltamos porque ya está en los loops anteriores
    if (m.grupoId && (m.concepto.startsWith("Cobro dividido") || m.concepto.startsWith("Cobranzas a Clientes") || m.concepto.startsWith("Cobro →") || m.concepto.startsWith("Auto-Ingreso"))) return false;
    return true;
  }).forEach((m: any) => {
    const cuenta = cuentas.find((c: any) => String(c.id) === String(m.cuentaId));
    
    // Si es una transferencia propia, la omitimos de las filas si ambos lados están en patrimonio
    const esTransf = m.concepto.startsWith("Transf.") || m.concepto.toLowerCase().includes("transferencia") || m.concepto.toLowerCase().includes("traspaso");
    
    filas.push({
      concepto: m.conceptoId ? (conceptos.find((c:any) => c.id === m.conceptoId)?.nombre || m.concepto.split(" — ")[0]) : (esTransf ? "Transferencia" : "Movimiento Manual"),
      detalle: (m.concepto.includes(" — ") ? m.concepto.split(" — ").slice(1).join(" — ") : (esTransf ? m.concepto : "")) + (m.unidadNegocio && m.unidadNegocio !== "General" ? ` [${m.unidadNegocio}]` : ""),
      destino: cuenta?.nombre || "—",
      ingreso: m.tipo === "ingreso" ? m.monto : 0,
      egreso: m.tipo === "egreso" ? m.monto : 0,
      monto: m.monto, informativo: m.informativo || false, origen: "manual", id: m.id,
      opId: m.grupoId || ("mov_" + m.id),
      cuentaId: m.cuentaId,
      proveedorId: null
    });
  });

  // Calcular cantidad de filas por cada opId para detectar agrupaciones ("misma operación")
  const opCounts: Record<string, number> = {};
  filas.forEach(f => {
    if (f.opId) {
      opCounts[f.opId] = (opCounts[f.opId] || 0) + 1;
    }
  });

  // Modificar orden según solicitud:
  // 1. "mismo ingreso/egreso correspondiente a la misma operación" (opId compartido por >1 fila)
  // 2. Banco BBVA (cuentaId = 5 o que contenga BBVA/FRANCES)
  // 3. Caja efectivo (cuentaId = 1 o que contenga CAJA/EFECTIVO)
  const filasOrdenadas = filas.map((f, idx) => ({ ...f, _idx: idx })).sort((a, b) => {
    const aIsSame = !!(a.opId && opCounts[a.opId] > 1);
    const bIsSame = !!(b.opId && opCounts[b.opId] > 1);
    
    if (aIsSame && !bIsSame) return -1;
    if (!aIsSame && bIsSame) return 1;
    
    if (aIsSame && bIsSame) {
      if (a.opId !== b.opId) {
        return String(a.opId).localeCompare(String(b.opId));
      }
      return a._idx - b._idx;
    }
    
    // Si no son de la misma operación, verificamos BBVA
    const aIsBBVA = String(a.cuentaId) === "5" || !!(a.destino && (a.destino.toUpperCase().includes("BBVA") || a.destino.toUpperCase().includes("FRANCES")));
    const bIsBBVA = String(b.cuentaId) === "5" || !!(b.destino && (b.destino.toUpperCase().includes("BBVA") || b.destino.toUpperCase().includes("FRANCES")));
    
    if (aIsBBVA && !bIsBBVA) return -1;
    if (!aIsBBVA && bIsBBVA) return 1;
    
    // Si no son BBVA, verificamos Caja/Efectivo
    const aIsCaja = String(a.cuentaId) === "1" || !!(a.destino && (a.destino.toUpperCase().includes("CAJA") || a.destino.toUpperCase().includes("EFECTIVO")));
    const bIsCaja = String(b.cuentaId) === "1" || !!(b.destino && (b.destino.toUpperCase().includes("CAJA") || b.destino.toUpperCase().includes("EFECTIVO")));
    
    if (aIsCaja && !bIsCaja) return -1;
    if (!aIsCaja && bIsCaja) return 1;
    
    // Mantener orden relativo original
    return a._idx - b._idx;
  }).map(({ _idx, ...f }) => f);

  const totalIngreso = filasOrdenadas.reduce((s, f) => s + (f.ingreso || 0), 0);
  const totalEgreso = filasOrdenadas.reduce((s, f) => s + (f.egreso || 0), 0);
  const resultado = totalIngreso - totalEgreso;
  const saldoActual = saldoAnterior + resultado;

  return { filas: filasOrdenadas, saldoAnterior, totalIngreso, totalEgreso, resultado, saldoActual };
}

// --- Movimientos por Tabla (Filtering and Balance calculation) ---

export function calcularMovimientosTabla(
  movimientos: any[],
  pagos: any[],
  cuentaSel: any,
  filtros: { tipo: string, desde: string, hasta: string, busq: string }
) {
  const movIdsConRecibo = new Set(movimientos.filter((m: any) => m.reciboId != null).map((m: any) => String(m.reciboId)));
  const movIdsConGrupo = new Set(movimientos.filter((m: any) => m.grupoId != null && m.tipo === "ingreso").map((m: any) => String(m.grupoId)));
  
  const cobrosVirtuales = cuentaSel
    ? pagos.filter((p: any) => !p.anulado && p.cuentaId === cuentaSel.id && !movIdsConRecibo.has(String(p.id)) && (!p.grupoId || !movIdsConGrupo.has(String(p.id))))
        .map((p: any) => ({
          id: "pago_" + p.id, cuentaId: p.cuentaId, tipo: "ingreso", monto: p.monto,
          fecha: p.fecha, hora: p.hora || "00:00", reciboId: p.id,
          concepto: `Cobro — ${p.cliente}${p.obs ? " · " + p.obs : ""}`,
          _esCobro: true
        }))
    : [];

  const base = [...movimientos.filter((m: any) => cuentaSel ? m.cuentaId === cuentaSel.id : true), ...cobrosVirtuales];
  let filtered = base;
  
  if (filtros.tipo !== "todos") filtered = filtered.filter(m => m.tipo === filtros.tipo);
  if (filtros.desde) filtered = filtered.filter(m => m.fecha >= filtros.desde);
  if (filtros.hasta) filtered = filtered.filter(m => m.fecha <= filtros.hasta);
  if (filtros.busq) filtered = filtered.filter(m => m.concepto?.toLowerCase().includes(filtros.busq.toLowerCase()));
  
  const ordenados = [...filtered].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || (a.hora || "").localeCompare(b.hora || ""));
  
  let saldoPartida = 0;
  if (cuentaSel && filtros.desde) {
    saldoPartida = base
      .filter(m => m.fecha < filtros.desde)
      .reduce((s, m) => m.tipo === "ingreso" ? s + m.monto : s - m.monto, 0);
  }
  
  let saldoAcum = saldoPartida;
  const conSaldo = ordenados.map(m => {
    saldoAcum = m.tipo === "ingreso" ? saldoAcum + m.monto : saldoAcum - m.monto;
    return { ...m, _saldo: saldoAcum };
  });
  
  return conSaldo.reverse(); 
}


// --- Conciliation Logic ---

export const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/ +/g, " ").trim();

export const quitarPref = (s: string) => s.replace(/^(cr por debin - var-|cr trans inm home banking \d+ |dep en efectivo tas inteligent - \d+ |dep\.? efec atm buzon nocturno - \d* ?)/i, "").trim();

export function findConciliationCandidates(mov: any, recibos: any[], clientes: any[]) {
    const nBanco = norm(mov.nombreBanco);
    const tolerancia = (mov.esBuzon || mov.esTas) ? 0.05 : 0;

    return recibos.filter(p => {
        const nCliente = norm(p.cliente || "");
        const cli = clientes.find(c => c.id === p.clienteId);
        const nContacto = norm(cli?.personaContacto || "");
        const nCV = norm(cli?.nombreCV || "");
        const aliases = (cli?.nombresPlanilla || []).map(a => norm(a));
        const palabrasBanco = nBanco.split(" ").filter(w => w.length > 2);
        const matchNombre = palabrasBanco.length > 0 && palabrasBanco.every(w => nCliente.includes(w) || nContacto.includes(w) || nCV.includes(w) || aliases.some(a => a.includes(w)));
        const diff = Math.abs(p.monto - mov.monto);
        const matchMonto = tolerancia > 0 ? diff <= (mov.monto > 0 ? mov.monto : -mov.monto) * tolerancia : Math.abs(diff) < 0.01;
        return matchNombre && matchMonto;
    });
}

export function parseExtractoData(raw: any[]) {
    const rawStr = raw.map((r: any) => (Array.isArray(r) ? r.join("|") : "")).join("\n").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const esPatagonia = rawStr.includes("banco patagonia") || rawStr.includes("var 2") || rawStr.includes("credito");
    const esSanJuan = rawStr.includes("banco san juan") || rawStr.includes("cr por debin") || rawStr.includes("nro. comprobante");
    
    return { esPatagonia, esSanJuan };
}

export function parsePatagonia(raw: any[]) {
    const movs: any[] = [];
    const gastosBancarios: any[] = [];
    
    let headerRow = -1;
    for (let i = 0; i < Math.min(raw.length, 15); i++) {
        const r: any = raw[i];
        if (!Array.isArray(r)) continue;
        const rowStr = r.map((c: any) => String(c || "").trim().toLowerCase()).join("|");
        if (rowStr.includes("fecha") && (rowStr.includes("descripci") || rowStr.includes("credito"))) {
            headerRow = i; break;
        }
    }
    if (headerRow < 0) headerRow = 9;
    
    const hdrPat: any[] = (raw[headerRow] as any[]).map((c: any) => String(c || "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
    const iFecha = hdrPat.findIndex(h => h.includes("fecha"));
    const iDesc = hdrPat.findIndex(h => h.includes("descrip") || h.includes("concepto"));
    const iRef = hdrPat.findIndex(h => h.includes("ref") || h.includes("referencia"));
    const iDeb = hdrPat.findIndex(h => h.includes("debit") || h.includes("debito"));
    const iCred = hdrPat.findIndex(h => h.includes("credit") || h.includes("credito"));
    
    const cF = iFecha >= 0 ? iFecha : 1;
    const cD = iDesc >= 0 ? iDesc : 2;
    const cR = iRef >= 0 ? iRef : 3;
    const cDb = iDeb >= 0 ? iDeb : 4;
    const cCr = iCred >= 0 ? iCred : 5;

    for (let i = headerRow + 1; i < raw.length; i++) {
        const r: any = raw[i];
        if (!Array.isArray(r)) continue;
        const fechaStr = String(r[cF] || "").trim();
        if (!fechaStr) continue;
        let fecha = "";
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) fecha = fechaStr.split("/").reverse().join("-");
        else if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) fecha = fechaStr;
        else continue;
        
        const desc = String(r[cD] || "").trim();
        const ref = String(r[cR] || "").trim();
        const deb = parseFloat(String(r[cDb] || "").replace(/\./g, "").replace(",", ".")) || 0;
        const cred = parseFloat(String(r[cCr] || "").replace(/\./g, "").replace(",", ".")) || 0;
        if (deb <= 0 && cred <= 0) continue;
        
        const nombreBanco = quitarPref(ref) || quitarPref(desc) || desc || "—";
        if (deb > 0) {
            const lowerDesc = desc.toLowerCase();
            const esPrestamo = lowerDesc.includes("prestamo") || lowerDesc.includes("préstamo") || lowerDesc.includes("amort.");
            const esIva = lowerDesc.includes("iva") || lowerDesc.includes("i.v.a");
            const esMantenimiento = lowerDesc.includes("mantenimiento") || lowerDesc.includes("comision") || lowerDesc.includes("com transf") || lowerDesc.includes("sircreb") || lowerDesc.includes("ingresos");
            if (esPrestamo || esIva || esMantenimiento) {
                gastosBancarios.push({ fecha, concepto: desc, monto: deb, ref, esPrestamo });
                continue;
            }
        }
        if (cred > 0) {
            movs.push({ id: `pat_${i}`, fecha, concepto: desc, ref, nombreBanco, monto: cred, tipo: "credito", esBuzon: /buzon|nocturno/i.test(desc), esTas: /autoservicio|inteligent/i.test(desc) });
        }
        if (deb > 0 && /transf/i.test(desc) && !gastosBancarios.some((g: any) => g.monto === deb && g.ref === ref)) {
            movs.push({ id: `pat_deb_${i}`, fecha, concepto: desc, ref, nombreBanco: desc, monto: -deb, tipo: "debito", esBuzon: false, esTas: false });
        }
    }
    return { movs, gastosBancarios };
}

export function parseSanJuan(raw: any[]) {
    const movs: any[] = [];
    const gastosBancarios: any[] = [];
    let headerRow = -1;
    for (let i = 0; i < Math.min(raw.length, 20); i++) {
        if (!Array.isArray(raw[i])) continue;
        const c0 = String(raw[i][0] || "").trim().toLowerCase();
        const r: any = raw[i];
        const c2 = String(r[2] || "").trim().toLowerCase();
        if (c0.includes("fecha") && c2.includes("concepto")) { headerRow = i; break; }
    }
    if (headerRow < 0) headerRow = 14;
    let fechaActual = "";
    for (let i = headerRow + 1; i < raw.length; i++) {
        const r: any = raw[i];
        if (!Array.isArray(r)) continue;
        const f = String(r[0] || "").trim();
        const concepto = String(r[2] || "").trim();
        const ref = String(r[3] || "").trim();
        const monto = parseFloat(String(r[4] || "").replace(/\./g, "").replace(",", ".")) || 0;
        if (f.match(/\d{2}\/\d{2}\/\d{4}/)) fechaActual = f.split("/").reverse().join("-");
        else if (f.match(/\d{4}-\d{2}-\d{2}/)) fechaActual = f;
        if (!concepto || !fechaActual) continue;
        
        const lowerConcepto = concepto.toLowerCase();
        const esPrestamo = lowerConcepto.includes("prestamo") || lowerConcepto.includes("préstamo") || lowerConcepto.includes("amort.");
        const esGasto = /^com transf|^i\.v\.a\.|^iva |^mantenimiento/i.test(concepto) || esPrestamo || lowerConcepto.includes("sircreb") || lowerConcepto.includes("ingresos brutos");
        if (esGasto && monto < 0) {
            gastosBancarios.push({ fecha: fechaActual, concepto, monto: Math.abs(monto), ref, esPrestamo });
            continue;
        }
        if (monto <= 0) continue;
        const esCr = /^cr |deposito|dep |dep\./i.test(concepto);
        if (!esCr) continue;
        movs.push({ id: `bsj_${i}`, fecha: fechaActual, concepto, ref, nombreBanco: quitarPref(concepto) || concepto, monto, tipo: "credito", esBuzon: /buzon nocturno|atm/i.test(concepto), esTas: /tas inteligent/i.test(concepto) });
    }
    return { movs, gastosBancarios };
}

export function calcularTotalesDiaConcil(dia: string, movsNorm: any[], pagos: any[], movimientos: any[], cuentaId: any) {
    const movsDia = movsNorm.filter(m => m.fecha === dia);
    const bancoDia = movsDia.reduce((s, m) => s + m.monto, 0);
    const cobrosDia = pagos.filter(p => !p.anulado && p.fecha === dia && p.cuentaId === cuentaId).reduce((s, p) => s + p.monto, 0);
    const movsDia_ingreso = (movimientos || []).filter(m => m.fecha === dia && m.cuentaId === cuentaId && m.tipo === "ingreso" && !m.reciboId).reduce((s, m) => s + (m.monto || 0), 0);
    const sistemaDia = cobrosDia + movsDia_ingreso;
    const diferenciaDia = bancoDia - sistemaDia;
    const pendDia = movsDia.filter(m => m.estado !== "conciliado");
    const concDia = movsDia.filter(m => m.estado === "conciliado");
    return { bancoDia, sistemaDia, diferenciaDia, movsDia, pendDia, concDia };
}

// --- Historical Closures ---

export function checkRequiereRevision(fecha: string, hoy: string, historialCierres: any[]) {
    if (fecha >= hoy) return null;
    const cierre = historialCierres.find((c: any) => c.fecha === fecha && !c.requiereRevision);
    if (!cierre) return null;
    return { ...cierre, requiereRevision: true };
}
