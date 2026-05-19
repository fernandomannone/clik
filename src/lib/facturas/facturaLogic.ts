import { parseMoney, precioLista, getSiguienteNumero, registrarMovimientoKardex, getToday } from "../../lib/utils";
import { TIPOS_KARDEX, CODIGOS_A_FISICO } from "../../constants";

export function nuevaNumFac(facturas: any[], letra: string) {
  const prefijo = `FAC ${letra} 0001-`;
  const existentes = facturas
    .filter((f) => f.numero?.startsWith(prefijo))
    .map((f) => parseInt(f.numero.replace(prefijo, "")) || 0);
  const baseSeq = existentes.length ? Math.max(...existentes) + 1 : 1;
  let next = baseSeq;
  const existSet = new Set(existentes);
  while (existSet.has(next)) next++;
  return `${prefijo}${String(next).padStart(8, "0")}`;
}

export function parseCant(v: any) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim();
  if (s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
}

export function calcItem(i: any) {
  const cant = parseCant(i.cantidad);
  const prec = parseMoney(i.precio);
  const bon = parseFloat(i.bonif) || 0;
  return cant * prec * (1 - bon / 100);
}

export function precioParaCliente(art: any, lista: any, facturas: any[], clienteId: string | number) {
  if (lista) return precioLista(art, lista);
  const ultimaFac = facturas
    .filter(
      (f) =>
        String(f.clienteId) === String(clienteId) &&
        f.tipo === "factura" &&
        f.items?.length
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .find((f) =>
      f.items.some(
        (i: any) =>
          (art.id && i.artId === art.id) ||
          (art.codigo && i.codigo === art.codigo) ||
          (i.nombre && art.nombre && i.nombre.trim().toLowerCase() === art.nombre.trim().toLowerCase())
      )
    );
  if (ultimaFac) {
    const itemPrev = ultimaFac.items.find(
      (i: any) =>
        (art.id && i.artId === art.id) ||
        (art.codigo && i.codigo === art.codigo) ||
        (i.nombre && art.nombre && i.nombre.trim().toLowerCase() === art.nombre.trim().toLowerCase())
    );
    const precioHist = itemPrev?.precio ? parseMoney(String(itemPrev.precio)) : 0;
    if (precioHist > 0) return precioHist;
  }
  if (art.costo && art.costo > 0) return art.costo;
  return null;
}

const registrarAuditoria = (tipo: string, num: string, accion: string, user: string) => {
  console.log(`Auditoria: ${user} realizó ${accion} en ${tipo} ${num}`);
};

export async function emitirFacturaLogic(opts: {
  items: any[];
  articulos: any[];
  facturas: any[];
  cliente: any;
  tipoComp: string;
  editando: any;
  letra: string;
  condPago: string;
  descGlobal: string;
  fecha: string;
  vendedor: string;
  user: any;
  cloudSync: any;
  nombreCF: string;
  forzarSeparar?: boolean;
}) {
  const {
    items, articulos, facturas, cliente, tipoComp,
    editando, letra, condPago, descGlobal, fecha, vendedor,
    user, cloudSync, nombreCF, forzarSeparar = false
  } = opts;

  let finalFacturas = [...facturas];
  let finalArticulos = [...articulos];

  const itemsFiltrados = items
    .filter((i) => i.nombre && parseCant(i.cantidad) > 0)
    .map((i) => {
      const art = finalArticulos.find((a: any) => a.id === i.artId || a.codigo === i.codigo || a.nombre === i.nombre);
      return { ...i, costoUnit: art ? art.costo : 0 };
    });

  const esNC = tipoComp === "nc";

  const generarUnaFac = async (clienteId: number, itemsFac: any[]) => {
    if (!itemsFac.length) return;
    const numero = editando ? editando.numero : nuevaNumFac(finalFacturas, letra);
    const numeroComp = editando
      ? editando.numero
      : tipoComp === "factura"
        ? numero
        : getSiguienteNumero((tipoComp === "nc" ? "nc" : "factura") as any, finalFacturas);

    const totalFac = itemsFac.reduce((s, i) => s + calcItem(i), 0);
    const descMonto = totalFac * ((parseFloat(descGlobal) || 0) / 100);
    const total = totalFac - descMonto;

    const cbteId = editando ? editando.id : Date.now() + "_" + Math.random().toString(36).substr(2, 9);

    const nuevaFac = {
      id: cbteId,
      clienteId,
      numero: numeroComp,
      letra,
      tipo: tipoComp === "nc" ? "nc" : tipoComp === "nd" ? "nd" : "factura",
      total,
      subtotal: totalFac,
      descuento: parseFloat(descGlobal) || 0,
      condPago,
      fecha,
      vendedor,
      items: itemsFac,
      obs: condPago,
      estado: "pendiente",
      ...(cliente?.esConsumidorFinal && nombreCF ? { nombreCF } : {}),
    };

    if (editando) {
      finalFacturas = finalFacturas.map((f) => (f.id === cbteId ? nuevaFac : f));
    } else {
      finalFacturas = [nuevaFac, ...finalFacturas];
    }

    if (cloudSync && cloudSync.saveToCloud) {
      cloudSync.saveToCloud("facturas", nuevaFac);
    }
    registrarAuditoria(tipoComp === "nc" ? "nc" : "factura", nuevaFac.numero || "", editando ? "edicion" : "creacion", user?.nombre);

    if (itemsFiltrados.length || (editando && editando.items?.length)) {
      finalArticulos = finalArticulos.map((a: any) => {
        let stockTemporal = a.stock || 0;
        let costoPond = a.costo || 0;
        let changed = false;
        const esService = a.llevaStock === 0 || a.llevaStock === false || a.codigo === "044";

        if (editando && editando.items) {
          const oldItems = editando.items.filter((i: any) => i.artId === a.id || (i.codigo && i.codigo === a.codigo) || i.nombre === a.nombre);
          oldItems.forEach((oldIt: any) => {
            const oldCant = parseCant(oldIt.cantidad);
            const esNCOld = editando.tipo === "nc";
            const stockAnt = stockTemporal;
            if (!esService) {
              stockTemporal = esNCOld ? stockTemporal - oldCant : stockTemporal + oldCant;
              changed = true;
            }

            registrarMovimientoKardex({
              artId: a.id,
              tipo: TIPOS_KARDEX.ENTRADA_AJUSTE,
              cantidad: oldCant,
              costoUnitario: costoPond,
              stockAnterior: stockAnt,
              stockResultante: esService ? null : stockTemporal,
              fecha,
              documentoTipo: "ajuste",
              documentoNumero: `REVERT-${editando.numero}`,
              usuario: user?.nombre || "Sistema",
              observacion: `Reversión por edición ${editando.numero}`,
            }).then((m) => {
              if (m && cloudSync?.saveToCloud) cloudSync.saveToCloud("kardex", m);
            });
          });
        }

        const itemVenta = itemsFac.find((i: any) => i.artId === a.id || i.codigo === a.codigo || i.nombre === a.nombre);
        if (itemVenta) {
          const cantNueva = parseCant(itemVenta.cantidad);
          const stockAct = stockTemporal;
          if (!esService) {
            stockTemporal = esNC ? stockAct + cantNueva : stockAct - cantNueva;
            changed = true;
          }

          registrarMovimientoKardex({
            artId: a.id,
            tipo: esNC ? TIPOS_KARDEX.ENTRADA_DEVOLUCION : TIPOS_KARDEX.SALIDA_VENTA,
            cantidad: cantNueva,
            costoUnitario: costoPond,
            ppp: costoPond,
            stockAnterior: stockAct,
            stockResultante: esService ? null : stockTemporal,
            fecha,
            documentoTipo: esNC ? "nc_cliente" : "venta",
            documentoNumero: numeroComp,
            usuario: user?.nombre || "Sistema",
            observacion: esNC ? `NC Cliente: ${cliente.nombre}` : `Venta Cliente: ${cliente.nombre}`,
          }).then((m) => {
            if (m && cloudSync?.saveToCloud) cloudSync.saveToCloud("kardex", m);
          });
        }

        if (changed && stockTemporal !== a.stock) {
          const nuevoArt = { ...a, stock: stockTemporal };
          if (cloudSync && cloudSync.saveToCloud) cloudSync.saveToCloud("articulos", nuevoArt);
          return nuevoArt;
        }
        return a;
      });
    }
  };

  const clienteFisicoId = cliente?.clienteFisicoId;
  if (forzarSeparar && clienteFisicoId && tipoComp === "factura" && !editando) {
    const itemsCIG = itemsFiltrados.filter((i: any) => !CODIGOS_A_FISICO.some((c) => parseInt(c) === parseInt(i.codigo)));
    const itemsFisico = itemsFiltrados.filter((i: any) => CODIGOS_A_FISICO.some((c) => parseInt(c) === parseInt(i.codigo)));
    await generarUnaFac(cliente.id, itemsCIG);
    await generarUnaFac(clienteFisicoId, itemsFisico);
  } else {
    await generarUnaFac(cliente.id, itemsFiltrados);
  }

  return { finalFacturas, finalArticulos };
}

export async function eliminarFacturaLogic(opts: {
  facturas: any[];
  articulos: any[];
  editando: any;
  tipoComp: string;
  cloudSync: any;
  user: any;
}) {
  const { facturas, articulos, editando, tipoComp, cloudSync, user } = opts;
  if (!editando) return { finalFacturas: facturas, finalArticulos: articulos };

  let finalFacturas = facturas.filter((f) => f.id !== editando.id);
  let finalArticulos = [...articulos];

  if (cloudSync && cloudSync.deleteFromCloud) {
    cloudSync.deleteFromCloud("facturas", String(editando.id));
  }
  registrarAuditoria(tipoComp === "nc" ? "nc" : "factura", editando.numero || "", "eliminacion", user?.nombre);

  if (editando.items?.length) {
    finalArticulos = finalArticulos.map((a: any) => {
      let stockTemporal = a.stock || 0;
      let costoPond = a.costo || 0;
      const esService = a.llevaStock === 0 || a.llevaStock === false || a.codigo === "044";

      const oldItems = editando.items.filter((i: any) => i.artId === a.id || (i.codigo && i.codigo === a.codigo) || i.nombre === a.nombre);
      if (oldItems.length > 0) {
        oldItems.forEach((oldIt: any) => {
          const oldCant = parseCant(oldIt.cantidad);
          const esNCOld = editando.tipo === "nc";
          const stockAnt = stockTemporal;
          if (!esService) {
            stockTemporal = esNCOld ? stockTemporal - oldCant : stockTemporal + oldCant;
          }
          registrarMovimientoKardex({
            artId: a.id,
            tipo: TIPOS_KARDEX.ENTRADA_AJUSTE,
            cantidad: oldCant,
            costoUnitario: costoPond,
            stockAnterior: stockAnt,
            stockResultante: esService ? null : stockTemporal,
            fecha: getToday(),
            documentoTipo: "ajuste",
            documentoNumero: `REVERT-${editando.numero}`,
            usuario: user?.nombre || "Sistema",
            observacion: `Reversión por eliminación ${editando.numero}`,
          }).then((m) => {
            if (m && cloudSync?.saveToCloud) cloudSync.saveToCloud("kardex", m);
          });
        });
        if (!esService) {
          const nuevoArt = { ...a, stock: stockTemporal };
          if (cloudSync && cloudSync.saveToCloud) cloudSync.saveToCloud("articulos", nuevoArt);
          return nuevoArt;
        }
      }
      return a;
    });
  }
  return { finalFacturas, finalArticulos };
}

export function confirmarFacturaLogic(opts: {
  tipoComp: string;
  cliente: any;
  editando: any;
  facturas: any[];
  pagos: any[];
  total: number;
  items: any[];
}) {
  const { tipoComp, cliente, editando, facturas, pagos, total, items } = opts;

  if (tipoComp === "factura" && cliente.creditoMax > 0 && !cliente.permitirExcederLimite && !editando) {
    const saldoActual = facturas
      .filter((f: any) => String(f.clienteId) === String(cliente.id) && f.tipo === "factura")
      .reduce((s, f: any) => s + f.total, 0) -
      pagos
        .filter((p: any) => String(p.clienteId) === String(cliente.id) && !p.anulado)
        .reduce((s, p: any) => s + p.monto, 0) +
      (cliente.saldoInicial || 0);

    const saldoNuevo = saldoActual + total;
    if (saldoNuevo > cliente.creditoMax) {
      return { showAlert: true, requiresSeparation: false };
    }
  }

  const itemsFiltrados = items.filter((i) => i.nombre && parseCant(i.cantidad) > 0);
  const tieneFisico = cliente?.clienteFisicoId && tipoComp === "factura";
  const itemsParaFisico = itemsFiltrados.filter((i) => CODIGOS_A_FISICO.includes(String(i.codigo)));

  if (tieneFisico && itemsParaFisico.length > 0 && !editando) {
    return { showAlert: false, requiresSeparation: true };
  }

  return { showAlert: false, requiresSeparation: false };
}
