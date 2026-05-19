export function buildImportacionVentas(
  preview: any,
  facturasExistentes: any[],
  clientes: any[],
  articulos: any[],
  artsEditadosPorId: any,
  nombresCFFis: any,
  letraFac: string,
  condPago: string,
  userNombre: string,
  fileName: string,
  fechasSeleccionadas: string[],
  precioListaFn: (art: any, lista: number) => number,
  parseMoneyFn: (val: any) => number,
  getTodayFn: () => string
) {
  const TIPOS_KARDEX = {
    ENTRADA_DEVOLUCION: "Entrada (Devolución)",
    SALIDA_VENTA: "Salida (Venta)"
  };

  const nuevas: any[] = [];
  const kardexNuevosFis: any[] = [];
  const nextArtsEditadosPorId = { ...artsEditadosPorId };
  const facturasHistoricasPorCliente: Record<number, any[]> = {};
  
  const prefijoFac = `FAC ${letraFac} 0001-`;
  const prefijoNC = `NC ${letraFac} 0001-`;
  
  let baseNumFac = (() => {
    const existentes = facturasExistentes.filter((x: any) => x.numero?.startsWith(prefijoFac)).map((x: any) => parseInt(x.numero.replace(prefijoFac, "")) || 0);
    return existentes.length ? existentes.reduce((m: number, c: number) => Math.max(m, c), 0) + 1 : 1;
  })();
  
  let baseNumNC = (() => {
    const existentes = facturasExistentes.filter((x: any) => x.numero?.startsWith(prefijoNC)).map((x: any) => parseInt(x.numero.replace(prefijoNC, "")) || 0);
    return existentes.length ? existentes.reduce((m: number, c: number) => Math.max(m, c), 0) + 1 : 1;
  })();

  const generarFactura = (clienteIdInt: number, itemsFac: any[], fecha: string, nombreCFParam?: string) => {
    if(!itemsFac.length) return;

    const itemsNetosMap: any = {};
    itemsFac.forEach((it: any) => {
      const key = it.art ? it.art.id : it.codigo;
      if (!itemsNetosMap[key]) {
        itemsNetosMap[key] = { ...it, cantidad: 0 };
      }
      itemsNetosMap[key].cantidad += (parseFloat(it.cantidad) || 0);
    });

    const itemsAgrupados = Object.values(itemsNetosMap).filter((it: any) => it.cantidad !== 0);
    if (!itemsAgrupados.length) return;

    const cli = clientes.find((c: any) => String(c.id) === String(clienteIdInt));
    const isManual = cli?.precioManual;
    const lista = cli?.listaPrecios ? parseInt(cli.listaPrecios) : (isManual ? null : 1);

    const itemsFinales = itemsAgrupados.map((it: any, idx: number) => {
      const cant = it.cantidad;
      let precio = 0;
      if(it.art) {
        if (!isManual && lista) {
          precio = precioListaFn(it.art, lista);
        }
        if (!precio) {
          if (!facturasHistoricasPorCliente[clienteIdInt]) {
            facturasHistoricasPorCliente[clienteIdInt] = facturasExistentes
              .filter((f: any) => String(f.clienteId) === String(clienteIdInt) && !f.anulada && f.fecha)
              .sort((a: any, b: any) => b.fecha.localeCompare(a.fecha));
          }
          
          const ultFac = facturasHistoricasPorCliente[clienteIdInt]
            .find((f: any) => f.items?.some((i: any) => i.artId === it.art?.id || i.codigo === it.art?.codigo));
            
          if (ultFac) {
            const ultItem = ultFac.items.find((i: any) => i.artId === it.art?.id || i.codigo === it.art?.codigo);
            precio = parseMoneyFn(ultItem?.precio) || 0;
          }
        }
        if (!precio && it.art) {
           const pre1 = precioListaFn(it.art, 1);
           if (pre1 > 0) precio = pre1;
        }
      }

      return {
        id: idx+1,
        nombre: it.art ? it.art.nombre : `Artículo ${it.codigo}`,
        codigo: it.art ? it.art.codigo : it.codigo,
        artId:  it.art ? it.art.id : null,
        cantidad: String(cant),
        precio: String(precio),
        costoUnit: it.art?.costo || 0,
        costo: it.art?.costo || 0,
        bonif: "", total: cant * precio
      };
    });

    const subtotalNeto = itemsFinales.reduce((s,it)=>s + (parseFloat(it.cantidad)||0)*(parseMoneyFn(it.precio)||0), 0);
    if (Math.abs(subtotalNeto) < 0.01) return;

    const esNC = subtotalNeto < 0;
    let numero = "";
    if (esNC) {
       numero = `${prefijoNC}${String(baseNumNC++).padStart(8,"0")}`;
    } else {
       numero = `${prefijoFac}${String(baseNumFac++).padStart(8,"0")}`;
    }
    
    itemsFinales.forEach(it => {
      if (it.artId) {
        const baseArt = nextArtsEditadosPorId[it.artId] || articulos.find((a: any) => a.id === it.artId);
        if (baseArt) {
          const cantReporte = parseFloat(it.cantidad) || 0;
          const stockAct = baseArt.stock || 0;
          const stockResultante = stockAct - cantReporte;
          
          kardexNuevosFis.push({
            id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
            artId: baseArt.id,
            tipo: (cantReporte < 0) ? TIPOS_KARDEX.ENTRADA_DEVOLUCION : TIPOS_KARDEX.SALIDA_VENTA,
            cantidad: Math.abs(cantReporte),
            costoUnitario: baseArt.costo || 0,
            ppp: baseArt.costo || 0,
            stockAnterior: stockAct,
            stockResultante,
            fecha: fecha || getTodayFn(),
            documentoTipo: (cantReporte < 0) ? "nc_cliente" : "venta_fisica",
            documentoNumero: numero,
            usuario: userNombre,
            observacion: `Importación: ${cli?.nombre || "Cliente"}`
          });

          nextArtsEditadosPorId[baseArt.id] = { ...baseArt, stock: stockResultante };
        }
      }
    });

    const totalCosto = itemsFinales.reduce((s, it) => s + (Math.abs(parseFloat(it.cantidad) || 0)) * (it.costoUnit || 0), 0);

    nuevas.push({
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      clienteId: clienteIdInt, numero, letra: letraFac,
      tipo: esNC ? "nc" : "factura", 
      total: Math.abs(subtotalNeto), 
      subtotal: Math.abs(subtotalNeto), 
      costo: totalCosto,
      ganancia: Math.abs(subtotalNeto) - totalCosto,
      descuento: 0,
      condPago, fecha, vendedor: userNombre,
      items: itemsFinales, 
      obs: `Importada Físicos${esNC ? " (NET NC)" : ""}`,
      estado: "pendiente", origenImport: "fisicos",
      ...(nombreCFParam ? {nombreCF: nombreCFParam} : {}),
      esHistorico: false
    });
  };

  preview.conMatch.forEach((m: any) => {
    generarFactura(m.clienteId, m.items, m.fecha, nombresCFFis[m.nombreExcel]);
  });

  const nuevoH = {
    id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
    tipo: "fisicos",
    fileName,
    cantFacturas: nuevas.length,
    facturasIds: nuevas.map((f: any) => f.id),
    fechas: [...fechasSeleccionadas].sort(),
    detalle: nuevas.map((f: any) => ({ clienteNombre: f.clienteNombre, monto: f.importeTotal })),
    usuario: userNombre,
    timestamp: Date.now()
  };

  return { nuevas, kardexNuevosFis, nextArtsEditadosPorId, nuevoH };
}
