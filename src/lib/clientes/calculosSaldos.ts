import { getToday } from "../../lib/utils";

export function getCcCliente(clienteId: string | number, clienteObj: any, facturas: any[], pagos: any[]) {
  const fechaIni = clienteObj?.fechaSaldoInicial;
  
  const f = facturas.filter((x: any) => 
    String(x.clienteId) === String(clienteId) && 
    !x.anulada && 
    (!fechaIni || x.fecha.substring(0, 10) > fechaIni.substring(0, 10))
  );
  
  const p = pagos.filter((x: any) => 
    String(x.clienteId) === String(clienteId) && 
    !x.anulado && 
    (!fechaIni || x.fecha.substring(0, 10) > fechaIni.substring(0, 10))
  );
  
  return [...f, ...p.map((x: any) => ({ ...x, tipo: "recibo", total: x.monto }))]
    .sort((a: any, b: any) => b.fecha.localeCompare(a.fecha));
}

export function calcularSaldosMap(clientes: any[], facturas: any[], pagos: any[]) {
  const facPorCliente: Record<string, number> = {};
  const pagPorCliente: Record<string, number> = {};

  facturas.forEach((f: any) => {
    if (!f.anulada) {
      const cId = String(f.clienteId);
      if (!facPorCliente[cId]) facPorCliente[cId] = 0;
      facPorCliente[cId] += (f.tipo === "factura" || f.tipo === "nd") ? Math.abs(f.total || 0) : -Math.abs(f.total || 0);
    }
  });

  pagos.forEach((p: any) => {
    if (!p.anulado) {
      const cId = String(p.clienteId);
      if (!pagPorCliente[cId]) pagPorCliente[cId] = 0;
      pagPorCliente[cId] += p.monto;
    }
  });

  const m: Record<string, number> = {};
  clientes.forEach((c: any) => {
    const cid = String(c.id);
    const ini = parseFloat(c.saldoInicial) || 0;
    const fechaIni = c.fechaSaldoInicial;
    let movsFac = 0;
    let movsPag = 0;
    
    if (fechaIni) {
      movsFac = facturas
        .filter((f: any) => String(f.clienteId) === cid && !f.anulada && f.fecha.substring(0, 10) > fechaIni.substring(0, 10))
        .reduce((s: number, f: any) => (f.tipo === "factura" || f.tipo === "nd") ? s + Math.abs(f.total || 0) : s - Math.abs(f.total || 0), 0);
      movsPag = pagos
        .filter((p: any) => String(p.clienteId) === cid && !p.anulado && p.fecha.substring(0, 10) > fechaIni.substring(0, 10))
        .reduce((s: number, p: any) => s + p.monto, 0);
    } else {
      movsFac = facPorCliente[cid] || 0;
      movsPag = pagPorCliente[cid] || 0;
    }

    m[cid] = ini + movsFac - movsPag;
  });
  return m;
}

export function calcularSaldosHistoricosMap(clientes: any[], facturas: any[], pagos: any[], fechaSaldo: string) {
  const m: Record<string, number> = {};
  
  clientes.forEach((c: any) => {
    const raw = getCcCliente(c.id, c, facturas, pagos);
    const sorted = [...raw].sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
    let running = parseFloat(c.saldoInicial) || 0;
    let val = running;
    
    for (const mov of sorted) {
      if (mov.fecha.substring(0, 10) > fechaSaldo.substring(0, 10)) break;
      const db = (mov.tipo === "factura" || mov.tipo === "nd") ? Math.abs(mov.total || 0) : 0;
      const cr = (mov.tipo === "recibo" || mov.tipo === "nc") ? Math.abs(mov.total || mov.monto || 0) : 0;
      running = running + db - cr;
      val = running;
    }
    
    m[String(c.id)] = val;
  });
  
  return m;
}

export function buildCcLineas(clienteObj: any, rawMovs: any[]) {
  const sorted = [...rawMovs].sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  let running = parseFloat(clienteObj?.saldoInicial) || 0;
  return sorted.map((m: any) => {
    const db = (m.tipo === "factura" || m.tipo === "nd") ? Math.abs(m.total || 0) : 0;
    const cr = (m.tipo === "recibo" || m.tipo === "nc") ? Math.abs(m.total || m.monto || 0) : 0;
    running = running + db - cr;
    return { ...m, _running: running, _db: db, _cr: cr };
  }).reverse();
}
