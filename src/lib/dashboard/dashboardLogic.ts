import { facturasConAlerta, getToday } from "../../lib/utils";

export function calcSaldo(cid: string | number, clientes: any[], facturas: any[], pagos: any[]) {
  const cli = clientes.find((c: any) => String(c.id) === String(cid)); 
  const ini = cli?.saldoInicial || 0;
  const movsFac = facturas.filter((f: any) => String(f.clienteId) === String(cid) && !f.anulada).reduce((s: number, f: any) => s + (f.total || 0), 0);
  const movsPag = pagos.filter((p: any) => String(p.clienteId) === String(cid) && !p.anulado).reduce((s: number, p: any) => s + (p.monto || 0), 0);
  return ini + movsFac - movsPag;
}

export function getUltimaFactura(cid: string | number, facturas: any[]) {
  const facs = facturas.filter((f: any) => String(f.clienteId) === String(cid) && f.tipo === "factura" && f.fecha);
  if (!facs.length) return null;
  return facs.reduce((a: any, b: any) => (a.fecha || "") > (b.fecha || "") ? a : b, facs[0]).fecha || null;
}

export function getClientesInactivosAuto(clientes: any[], facturas: any[], today: string) {
  const hace30d = new Date(today + "T00:00:00");
  hace30d.setDate(hace30d.getDate() - 30);
  const hace30dStr = hace30d.toISOString().slice(0, 10);
  
  return clientes.filter((c: any) => {
    if (c.estado === "archivado") return false;
    if (c.estado === "inactivo") {
      const ult = getUltimaFactura(c.id, facturas);
      if (ult && ult >= hace30dStr) return false;
      return true;
    }
    return false;
  });
}

export function getStockCritico(articulos: any[]) {
  return (articulos || []).filter((a: any) => {
    if (a.llevaStock === false) return false;
    if (a.familia === "CIG.") return (a.stock || 0) < 250;
    if (a.familia === "TAB.") return (a.stock || 0) < 10;
    return (a.minimo || 0) > 0 && (a.stock || 0) <= a.minimo;
  }).sort((a: any, b: any) => (a.stock || 0) - (b.stock || 0));
}

export function getCvFacturadoHoy(facturas: any[], today: string) {
  let total = 0;
  facturas.filter((f: any) => f.fecha === today && !f.anulada && (f.tipo === "factura" || f.tipo === "nc")).forEach((f: any) => {
    const signo = f.tipo === "nc" ? -1 : 1;
    (f.items || []).forEach((it: any) => {
      const esCV = it.codigo === "044" || it.codigo === "CV" || it.nombre === "Carga Virtual SEAC" || it.nombre === "SALDO CV";
      if (esCV) {
        total += signo * (parseFloat(it.total) || (parseFloat(it.cantidad) * parseFloat(it.precio)) || 0);
      }
    });
  });
  return total;
}

export function getTotalFacturadoHoy(facturas: any[], today: string) {
  return facturas
    .filter((f: any) => f.fecha === today && !f.anulada && (f.tipo === "factura" || f.tipo === "nc"))
    .reduce((s: number, f: any) => s + (f.total || 0), 0);
}

export function getGananciaDia(facturas: any[], articulos: any[], utilidadesFCI: any[], today: string) {
  const facsHoy = facturas.filter((f: any) => f.fecha === today && !f.anulada && (f.tipo === "factura" || f.tipo === "nc"));
  let ganancia = 0;
  
  facsHoy.forEach((f: any) => {
    const signo = f.tipo === "nc" ? -1 : 1;
    if (f.items?.length) {
      f.items.forEach((it: any) => {
        const art = articulos.find((a: any) => a.id === it.artId || a.codigo === it.codigo || a.nombre === it.nombre);
        const esCV = art?.llevaStock === false || it.codigo === "044" || it.codigo === "CV" || it.nombre === "SALDO CV" || it.nombre === "Carga Virtual SEAC";
        if (esCV) return;
        const costo = parseFloat(it.costoUnit) || parseFloat(it.costo) || art?.costo || 0;
        const cant = parseFloat(it.cantidad) || 0;
        const precio = parseFloat(it.precio) || 0;
        ganancia += signo * (precio - costo) * cant;
      });
    } else {
      ganancia += signo * (parseFloat(f.subtotal) || parseFloat(f.total) || 0) * 0.1;
    }
  });
  
  utilidadesFCI.filter((u: any) => u.fecha === today).forEach((u: any) => { ganancia += parseFloat(u.monto) || 0; });
  return ganancia;
}

export function getGananciaMes(facturas: any[], articulos: any[], utilidadesFCI: any[], primerDiaMes: string) {
  let gan = 0, costo = 0, ingreso = 0;
  
  facturas.filter((f: any) => (f.tipo === "factura" || f.tipo === "nc") && !f.anulada && f.fecha >= primerDiaMes).forEach((f: any) => {
    const signo = f.tipo === "nc" ? -1 : 1;
    (f.items || []).forEach((it: any) => {
      const art = articulos.find((a: any) => a.id === it.artId || a.codigo === it.codigo || a.nombre === it.nombre);
      const esCV = art?.llevaStock === false || it.codigo === "044" || it.codigo === "CV" || it.nombre === "SALDO CV" || it.nombre === "Carga Virtual SEAC";
      if (esCV) return;
      const cant = parseFloat(it.cantidad) || 0;
      const precio = (parseFloat(it.precio) || 0) * (1 - (parseFloat(it.bonif) || 0) / 100);
      const c = parseFloat(it.costoUnit) || (parseFloat(art?.costo) || 0);
      
      ingreso += signo * precio * cant;
      costo += signo * c * cant;
      gan += signo * (precio - c) * cant;
    });
  });
  
  const fci = utilidadesFCI.filter((u: any) => u.fecha >= primerDiaMes).reduce((s: number, u: any) => s + (parseFloat(u.monto) || 0), 0);
  const margen = ingreso > 0 ? ((gan / ingreso) * 100).toFixed(1) : "0";
  return { gananciasMes: gan + fci, margenMes: margen, ingreso, costo };
}

export function getTopArticulos(facturas: any[], articulos: any[], mesEnCursoStr: string) {
  const conteo: Record<string, { nombre: string, cant: number }> = {};
  facturas.filter((f: any) => f.fecha?.startsWith(mesEnCursoStr) && !f.anulada && (f.tipo === "factura" || f.tipo === "nc") && f.items?.length).forEach((f: any) => {
    const signo = f.tipo === "nc" ? -1 : 1;
    f.items.forEach((i: any) => {
      if (!i.nombre || i.codigo === "044" || i.codigo === "CV" || i.nombre === "Carga Virtual SEAC" || i.nombre === "SALDO CV") return;
      const art = articulos.find((a: any) => a.id === i.artId || (i.codigo && a.codigo === i.codigo) || a.nombre === i.nombre);
      if (art && art.llevaStock === false) return;
      const key = i.artId ? `id:${i.artId}` : i.nombre;
      if (!conteo[key]) conteo[key] = { nombre: i.nombre, cant: 0 };
      conteo[key].cant += signo * (parseFloat(i.cantidad) || 0);
    });
  });
  return Object.values(conteo).filter((v: any) => v.cant > 0).sort((a: any, b: any) => b.cant - a.cant).slice(0, 5).map((v: any) => [v.nombre, v.cant]);
}

export function getSeacEquiposKPI(seacMovs: any[]) {
  const debitos = seacMovs.filter((m: any) => m.tipo === "Perdida de POS" || m.tipo === "Perdida de LG");
  const devoluciones = seacMovs.filter((m: any) => m.tipo === "NC Cargos Generico" && m.serial);
  
  const pendientes = debitos.filter((d: any) => {
    const serial = (d.serial || "").toUpperCase();
    return !devoluciones.some((r: any) => r.serial && r.serial.toUpperCase() === serial);
  });
  
  const devSinDebito = devoluciones.filter((r: any) => {
    const serial = (r.serial || "").toUpperCase();
    return !debitos.some((d: any) => d.serial && d.serial.toUpperCase() === serial);
  });
  
  const pos = pendientes.filter((p: any) => p.tipo === "Perdida de POS").length;
  const lg  = pendientes.filter((p: any) => p.tipo === "Perdida de LG").length;
  const total = pendientes.length + devSinDebito.length;
  
  return { pendientes, devSinDebito, pos, lg, total, activo: total > 0 };
}
