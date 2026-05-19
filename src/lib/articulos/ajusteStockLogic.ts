import { getToday } from "../../lib/utils";

export function buildAjusteStock(
  articulo: any,
  stockFisico: number,
  motivo: string,
  fecha: string,
  esInicial: boolean,
  conceptos: any[]
) {
  const diferencia = stockFisico - (articulo.stock || 0);
  const costo = articulo.costo || 0;
  const valorizacion = Math.abs(diferencia) * costo;
  const fechaToUse = fecha || getToday();

  // 1. Updated Articulo
  const updatedArticulo = { ...articulo, stock: Math.max(0, stockFisico) };

  // 2. Kardex Movimiento
  const nKardex = {
    tipo: diferencia > 0 ? "ENTRADA_AJUSTE" : "SALIDA_AJUSTE",
    documentoTipo: "AJUSTE",
    documentoNumero: motivo,
    fecha: fechaToUse,
    artId: articulo.id,
    cantidad: Math.abs(diferencia),
    stockResultante: stockFisico,
    esInicial,
    id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString()
  };

  // 3. Finance Movimiento (if not inicial)
  let nMov = null;
  if (!esInicial) {
    let conceptoGastoId =
      conceptos?.find(
        (c: any) =>
          c.nombre.toLowerCase().includes("merma") ||
          c.nombre.toLowerCase().includes("ajuste") ||
          c.nombre.toLowerCase().includes("stock")
      )?.id || null;
    if (!conceptoGastoId) conceptoGastoId = conceptos?.[0]?.id || 1;

    const conceptoLabel =
      diferencia > 0
        ? `Sobrante de stock: ${articulo.nombre}`
        : `Pérdida/Merma de stock: ${articulo.nombre}`;

    nMov = {
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      cuentaId: "virtual_resultados",
      conceptoId: conceptoGastoId,
      concepto: conceptoLabel,
      detalle: motivo,
      tipo: diferencia > 0 ? "ingreso" : "egreso",
      monto: valorizacion,
      fecha: fechaToUse,
      informativo: true,
      _esAjusteStock: true,
    };
  }

  return { updatedArticulo, nKardex, nMov };
}

export function buildControlStockBatch(
  itemsParaAjustar: any[],
  motivoGeneral: string,
  fecha: string,
  esInicial: boolean,
  totalDiferenciaValor: number,
  conceptos: any[]
) {
  const hoy = getToday();
  const hora = new Date().toLocaleTimeString("en-US", { hour12: false });
  const fechaToUse = fecha || hoy;

  // 1. Array of Articles Updates
  const artsUpdateMap: Record<string, number> = {};
  
  // 2. Array of Kardex Records
  const kardexMovs = itemsParaAjustar.map((a: any) => {
    artsUpdateMap[a.id] = a.fisicoNum;
    
    return {
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      tipo: a.dif > 0 ? "ENTRADA_AJUSTE" : "SALIDA_AJUSTE",
      documentoTipo: "CONTROL",
      documentoNumero: motivoGeneral,
      fecha: fechaToUse,
      artId: a.id,
      cantidad: Math.abs(a.dif),
      stockResultante: a.fisicoNum,
      esInicial,
      createdAt: new Date().toISOString()
    };
  });

  // 3. Finance Movimiento (if not inicial)
  let nMov = null;
  if (!esInicial && kardexMovs.length > 0) {
    let conceptoId =
      conceptos?.find(
        (c: any) =>
          c.nombre.toLowerCase().includes("merma") ||
          c.nombre.toLowerCase().includes("ajuste")
      )?.id || 8;

    nMov = {
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      cuentaId: "virtual_resultados",
      concepto: `Ajuste Masivo: ${itemsParaAjustar.length} ítems · ${motivoGeneral}`,
      conceptoId: conceptoId,
      tipo: totalDiferenciaValor >= 0 ? "ingreso" : "egreso",
      monto: Math.abs(totalDiferenciaValor),
      fecha: fechaToUse,
      hora: hora,
      unidadNegocio: "AjusteStock",
      esAjusteStock: true,
    };
  }

  return { artsUpdateMap, kardexMovs, nMov };
}
