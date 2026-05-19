export function buildImportacionCV(
  filas: any[],
  facturasExistentes: any[],
  articulos: any[],
  clientesCV: any[],
  nombresCF: any,
  letraFac: string,
  condPago: string,
  fechaFac: string,
  userNombre: string,
  fileName: string,
  TIPOS_KARDEX: any
) {
  const porCliente: any = {};
  filas
    .filter((f) => f.clienteId !== null && f.clienteId !== undefined)
    .forEach((f) => {
      const cliIdNum = Number(f.clienteId);
      const esCF = cliIdNum === 0;
      const esNeg = f.importe < 0;
      const key = esCF
        ? `CF_${f.nombreCV}`
        : esNeg
          ? `NC_${cliIdNum}_${f.nombreCV}`
          : cliIdNum;
      if (!porCliente[key]) {
        porCliente[key] = {
          clienteId: cliIdNum,
          clienteNombre: f.clienteNombre,
          importe: 0,
          nombresCV: [],
          nombreCF: esCF ? nombresCF[f.nombreCV] || "" : null,
        };
      }
      porCliente[key].importe += f.importe;
      porCliente[key].nombresCV.push(f.nombreCV);
    });

  const prefijoFac = `FAC ${letraFac} 0001-`;
  const prefijoNC = `NC ${letraFac} 0001-`;
  const baseNum = (() => {
    const existentes = facturasExistentes
      .filter((x) => x.numero?.startsWith(prefijoFac))
      .map((x) => parseInt(x.numero.replace(prefijoFac, "")) || 0);
    return existentes.length
      ? existentes.reduce((m, c) => Math.max(m, c), 0) + 1
      : 1;
  })();
  const baseNumNC = (() => {
    const existentes = facturasExistentes
      .filter((x) => x.numero?.startsWith(prefijoNC))
      .map((x) => parseInt(x.numero.replace(prefijoNC, "")) || 0);
    return existentes.length
      ? existentes.reduce((m, c) => Math.max(m, c), 0) + 1
      : 1;
  })();

  const art044 = (articulos || []).find((a: any) => a.codigo === "044");
  const artId = art044 ? art044.id : 30;
  const artNombre = art044 ? art044.nombre : "SALDO CV";

  let iFC = 0, iNC = 0;
  const nuevasWrap = Object.values(porCliente).map((g: any) => {
    const esNC = g.importe < 0;
    const monto = Math.abs(g.importe);
    const numero = esNC
      ? `${prefijoNC}${String(baseNumNC + iNC++).padStart(8, "0")}`
      : `${prefijoFac}${String(baseNum + iFC++).padStart(8, "0")}`;

    const fNueva = {
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      clienteId: g.clienteId,
      fecha: fechaFac,
      tipo: esNC ? "nc" : "factura",
      letra: letraFac,
      numero,
      total: esNC ? -monto : monto,
      subtotal: esNC ? -monto : monto,
      descuento: 0,
      condPago,
      vendedor: userNombre,
      obs: `${esNC ? "NC" : "Importado"} CV`,
      estado: "pendiente",
      origenImport: "cv",
      items: [
        {
          id: 1,
          codigo: "044",
          nombre: artNombre,
          cantidad: String(monto),
          precio: String(esNC ? -1 : 1),
          bonif: "0",
          artId,
          costoUnit: art044?.costo || 0,
          costo: art044?.costo || 0,
          total: monto * (esNC ? -1 : 1)
        },
      ],
      costo: monto * (art044?.costo || 0),
      ganancia: (monto * (esNC ? -1 : 1)) - (monto * (art044?.costo || 0)),
      ...(g.nombreCF ? { nombreCF: g.nombreCF } : {}),
      esHistorico: false
    };

    const kardexInfo = {
      artId: artId,
      tipo: esNC
        ? TIPOS_KARDEX.ENTRADA_DEVOLUCION
        : TIPOS_KARDEX.SALIDA_VENTA,
      cantidad: monto,
      costoUnitario: 0,
      ppp: 0,
      stockAnterior: null,
      stockResultante: null,
      fecha: fechaFac,
      documentoTipo: esNC ? "nc_cliente" : "venta",
      documentoNumero: numero,
      usuario: userNombre,
      observacion: esNC
        ? `NC Cliente: ${g.clienteNombre}`
        : `Venta Cliente: ${g.clienteNombre}`,
    };

    return { fNueva, kardexInfo };
  });

  const nuevasConNum = nuevasWrap.map((w) => w.fNueva);
  const kardexNuevos = nuevasWrap.map((w) => {
    const internalId =
      Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    return {
      ...w.kardexInfo,
      id: internalId,
      createdAt: new Date().toISOString(),
    };
  });

  const nuevoH = {
    id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
    tipo: "cv",
    fileName,
    cantFacturas: nuevasConNum.length,
    facturasIds: nuevasConNum.map((f: any) => f.id),
    fechas: [fechaFac],
    detalle: nuevasConNum.map((f: any) => ({
      clienteNombre: f.nombreCF || f.clienteId, 
      monto: f.total,
    })),
    usuario: userNombre,
    timestamp: Date.now(),
  };

  return { nuevasConNum, kardexNuevos, nuevoH };
}
