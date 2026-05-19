export function calcularKardexComputado(articulo: any, kardex: any[]) {
  if (!articulo || !kardex) return [];

  const artId = articulo.id;
  const sorted = [...kardex]
    .filter((k: any) => k.articuloId === artId || k.artId === artId)
    .map((k: any, i: number) => ({ ...k, _ogIndex: i }))
    .sort((a: any, b: any) => {
      const c = b.fecha.localeCompare(a.fecha);
      if (c !== 0) return c;
      if (a.createdAt && b.createdAt) {
        const tCmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (tCmp !== 0) return tCmp;
      }
      return b._ogIndex - a._ogIndex;
    });

  let runningStock = Number(articulo.stock || 0);

  return sorted.map((m: any) => {
    const esIngreso = String(m.tipo).toUpperCase().startsWith("ENTRADA");
    const computedStock = runningStock;

    if (esIngreso) {
      runningStock -= Number(m.cantidad || 0);
    } else {
      runningStock += Number(m.cantidad || 0);
    }

    return { ...m, stockResultanteComputado: computedStock, _esIngreso: esIngreso };
  });
}

export function calcularValorizacion(articulos: any[], kardex: any[], fecha: string, baseValuacion: string, canVerCostos: boolean, precioListaFn: (a: any, l: number) => number) {
  return articulos.map((art: any) => {
    // Movimientos de este articulo hasta la fecha seleccionada
    const movs = (kardex || [])
      .filter((m: any) => m.artId === art.id && m.fecha && m.fecha <= fecha)
      .sort((a: any, b: any) => {
        if (a.fecha === b.fecha) return String(a.id).localeCompare(String(b.id)); // Desempate por id/tiempo
        return a.fecha.localeCompare(b.fecha);
      });

    let stockAFecha = 0;
    let costoAFecha = art.costo || 0; // fallback

    if (movs.length === 0) {
      const tienePosteriores = kardex.some((m: any) => m.artId === art.id && m.fecha > fecha);
      stockAFecha = tienePosteriores ? 0 : (art.stock || 0);
    } else {
      const ultimo = movs[movs.length - 1];
      stockAFecha = ultimo.stockResultante;
      const ultCompra = [...movs].reverse().find(m => m.tipo?.includes("COMPRA"));
      costoAFecha = ultimo.ppp || ultCompra?.costoUnitario || art.costo || 0;
    }

    let precioVal;
    if (baseValuacion === "costo" && canVerCostos) precioVal = costoAFecha;
    else {
      const numLista = parseInt(baseValuacion.replace("lista", ""));
      precioVal = precioListaFn(art, numLista);
    }

    return {
      ...art,
      _stockAFecha: stockAFecha,
      _costoAFecha: costoAFecha,
      _precioVal: precioVal,
      _valorTotal: stockAFecha * precioVal
    };
  }).filter((a: any) => a._stockAFecha !== 0); // Ocultar los de 0 stock a la fecha
}

export function formatKardexConcepto(m: any, t: any = {}) {
  let tipoLabel = String(m.tipo).toUpperCase().startsWith("SALIDA") ? "SALIDA" : "ENTRADA";
  let color = t.purple || "#A855F7";
  const baseTipo = String(m.documentoTipo || m.tipo || "").toLowerCase();
  const isReversal = baseTipo.includes("annul") || baseTipo.includes("revert") || baseTipo.includes("reverso");
  
  if (baseTipo.includes("venta")) { tipoLabel = "VENTA"; color = t.teal || "#14B8A6"; }
  else if (baseTipo.includes("nc_cliente")) { tipoLabel = "DEV. CLI"; color = t.amber || "#F59E0B"; }
  else if (baseTipo.includes("compra")) { tipoLabel = "COMPRA"; color = t.blue || "#3B82F6"; }
  else if (baseTipo.includes("nc_proveedor")) { tipoLabel = "DEV. PROV"; color = t.amber || "#F59E0B"; }
  else if (baseTipo.includes("ajuste")) { tipoLabel = "AJUSTE"; color = t.sub || "#9CA3AF"; }
  else if (isReversal) { tipoLabel = "ANULACIÓN"; color = t.red || "#EF4444"; }

  const conceptoStr = `${tipoLabel} ${m.documentoNumero || ""}`.trim();
  
  // For excel export we sometimes just want the pure string, so we provide string formats too
  let tipoStrExcel = "MOV";
  if (baseTipo.includes("venta")) tipoStrExcel = "VENTA";
  else if (baseTipo.includes("nc_cliente")) tipoStrExcel = "DEVOLUCIÓN CLIENTE";
  else if (baseTipo.includes("compra")) tipoStrExcel = "COMPRA";
  else if (baseTipo.includes("nc_proveedor")) tipoStrExcel = "DEVOLUCIÓN PROVEEDOR";
  else if (baseTipo.includes("ajuste")) tipoStrExcel = "AJUSTE";

  const conceptoStrExcel = `${tipoStrExcel} ${m.documentoNumero || ""}`.trim();

  return { tipoLabel, color, isReversal, conceptoStr, conceptoStrExcel };
}
