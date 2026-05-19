import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Fld, Sel, Inp, InpMoney, Btn, Ic, BuscadorSelect, OverlaySheet } from "../../common/UIBase";
import { parseMoney, getToday, fmtMoney } from "../../../lib/utils";

const today = getToday();

export function ModalMasivoCli({ open, onClose, clientes, cuentas, setCuentas, proveedores, pagos, setPagos, movimientos, setMovimientos, pagosProv, setPagosProv, user, cloudSync, onSwitchIndividual }: any) {
  const { t } = useApp();
  const [busqM, setBusqM] = useState("");
  const [selM, setSelM] = useState<number[]>([]);
  const [montosM, setMontosM] = useState<any>({});
  const [tipoM, setTipoM] = useState("Transferencia");
  const [cuentaM, setCuentaM] = useState("");
  const [destM, setDestM] = useState("cuenta");
  const [provM, setProvM] = useState("");
  const [fechaM, setFechaM] = useState(today);
  const [confirmar, setConfirmar] = useState(false);
  React.useEffect(() => { if (open) { setSelM([]); setMontosM({}); setConfirmar(false); setBusqM(""); setFechaM(today); } }, [open]);

  const guardar = () => {
    const h = new Date().getHours() + ":" + String(new Date().getMinutes()).padStart(2, "0");
    const f = fechaM || today;
    const nuevos: any[] = [];
    let ts = Date.now();
    selM.forEach(cid => {
      const cl = clientes.find((c: any) => c.id === cid);
      if (!cl) return;
      const montos = Array.isArray(montosM[cid]) ? montosM[cid] : [montosM[cid] || "0"];
      montos.forEach((monto: any) => {
        const m = parseMoney(monto || 0);
        if (!m) return;
        ts += 1;
        const base = { id: ts, clienteId: cl.id, cliente: cl.nombre, nombreCV: cl.nombreCV || "", monto: m, tipo: tipoM, estadoCV: "pendiente", fecha: f, hora: h, obs: "Carga masiva", anulado: false };
        if (destM === "cuenta" && cuentaM) (base as any).cuentaId = parseInt(cuentaM);
        else if (destM === "proveedor" && provM) (base as any).proveedorId = parseInt(provM);
        nuevos.push(base);
      });
    });
    if (!nuevos.length) { alert("No hay montos para registrar."); return; }
    setPagos((prev: any) => [...nuevos, ...prev]);
    if (cloudSync?.saveBatchToCloud) cloudSync.saveBatchToCloud("pagos", nuevos);
    else if (cloudSync?.saveToCloud) nuevos.forEach(n => cloudSync.saveToCloud("pagos", n));

    const pagosCuenta = nuevos.filter(p => p.cuentaId);
    if (pagosCuenta.length) {
      const cuentaId = pagosCuenta[0].cuentaId;
      const totalCuenta = pagosCuenta.reduce((s: number, p: any) => s + p.monto, 0);
      let tsM = Date.now() + 500;
      const movsNuevos = pagosCuenta.map((p: any) => ({ id: tsM++, cuentaId: p.cuentaId, concepto: `Cobro \u2014 ${p.cliente}`, tipo: "ingreso", monto: p.monto, fecha: p.fecha, hora: p.hora, reciboId: p.id }));
      setMovimientos((prev: any) => [...movsNuevos, ...prev]);
      if (cloudSync?.saveBatchToCloud) cloudSync.saveBatchToCloud("movimientos", movsNuevos);

      const cIdx = cuentas.findIndex((c: any) => c.id === cuentaId);
      if (cIdx >= 0) {
         const nuevaC = { ...cuentas[cIdx], saldo: cuentas[cIdx].saldo + totalCuenta };
         setCuentas((prev: any) => prev.map((c: any) => c.id === cuentaId ? nuevaC : c));
         if (cloudSync?.saveToCloud) cloudSync.saveToCloud("cuentas", nuevaC);
      }
    }
    const pagosProv_ = nuevos.filter(p => p.proveedorId);
    if (pagosProv_.length) {
      let tsP = Date.now() + 1000;
      const nuevosProv = pagosProv_.map((p: any) => ({ id: tsP++, proveedorId: p.proveedorId, tipo: p.tipo || "Transferencia", monto: p.monto, fecha: p.fecha, hora: p.hora, obs: `Cobro \u2014 ${p.cliente}`, anulado: false, reciboId: p.id, _desdeRecibo: true }));
      setPagosProv((prev: any) => [...nuevosProv, ...prev]);
      if (cloudSync?.saveBatchToCloud) cloudSync.saveBatchToCloud("pagosProv", nuevosProv);
    }
    onClose();
  };

  const clientesFiltrados = clientes.filter((c: any) => c.estado !== "archivado" && (!busqM || c.nombre.toLowerCase().includes(busqM.toLowerCase())));
  const totalSelM = selM.reduce((s, cid) => { const montos = Array.isArray(montosM[cid]) ? montosM[cid] : [montosM[cid] || "0"]; return s + montos.reduce((a: any, m: any) => a + parseMoney(m || 0), 0); }, 0);

  if (!open) return null;
  return (
    <OverlaySheet open={true} onClose={onClose} title={confirmar ? "Confirmar recibos" : "Carga Masiva de Recibos"} sub={<span>{confirmar ? "Revis\u00e1 el listado antes de registrar" : "Seleccion\u00e1 clientes y complet\u00e1 los montos"}{!confirmar && onSwitchIndividual && <>{" \u00b7 "}<button onClick={onSwitchIndividual} style={{ background: "none", border: "none", cursor: "pointer", color: "#ffffff", fontWeight: 600, fontSize: 12, padding: 0, fontFamily: "inherit" }}>Ingreso Individual</button></>}</span>} width={820}>
      {!confirmar && <>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <Fld label="Tipo" half><Sel value={tipoM} onChange={(e: any) => setTipoM(e.target.value)}>{["Transferencia", "Efectivo"].map(x => <option key={x}>{x}</option>)}</Sel></Fld>
          <Fld label="Destino" half><Sel value={destM} onChange={(e: any) => setDestM(e.target.value)}><option value="cuenta">Cuenta propia</option><option value="proveedor">Proveedor</option></Sel></Fld>
          {destM === "cuenta" && <Fld label="Cuenta" half><BuscadorSelect opciones={cuentas.filter((c: any) => c.tipo !== "inversion")} valor={cuentaM} onChange={setCuentaM} placeholder="Seleccioná cuenta..." /></Fld>}
          {destM === "proveedor" && <Fld label="Proveedor" half><BuscadorSelect opciones={proveedores.filter((p: any) => p.estado !== "archivado")} valor={provM} onChange={setProvM} placeholder="Seleccioná proveedor..." /></Fld>}
          <Fld label="Fecha" half><Inp type="date" value={fechaM} onChange={(e: any) => setFechaM(e.target.value)} /></Fld>
        </div>
        <input value={busqM} onChange={e => setBusqM(e.target.value)} placeholder="Buscar cliente..." style={{ width: "100%", padding: "8px 12px", background: t.surf2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: "none", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", marginBottom: 10, boxSizing: "border-box" }} />
        <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${t.border}`, borderRadius: 8 }}>
          {clientesFiltrados.map((cl: any) => {
            const sel = selM.includes(cl.id);
            const montos = montosM[cl.id] || (sel ? [""] : []);
            return (
              <div key={cl.id} onClick={(e: any) => { if (e.target.type === "number" || e.target.tagName === "INPUT" && e.target.type !== "checkbox") return; const check = !sel; if (check) { setSelM(p => [...p, cl.id]); setMontosM((p: any) => ({ ...p, [cl.id]: [""] })) } else { setSelM(p => p.filter(x => x !== cl.id)); setMontosM((p: any) => { const n = { ...p }; delete n[cl.id]; return n; }); } }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${t.border}22`, background: sel ? t.accentBg : "none", cursor: "pointer" }}>
                <input type="checkbox" checked={sel} onChange={() => { }} style={{ cursor: "pointer", pointerEvents: "none" }} />
                <span style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: sel ? 600 : 400 }}>{cl.nombre}</span>
                {sel && <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <InpMoney value={Array.isArray(montosM[cl.id]) ? montosM[cl.id][0] : montosM[cl.id] || ""} onChange={(e: any) => { setMontosM((p: any) => ({ ...p, [cl.id]: [e.target.value] })); }} placeholder="Monto $" />
                  </div>
                </div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <span style={{ fontSize: 13, color: t.sub }}>{selM.length} clientes \u00b7 Total: <strong style={{ color: t.text }}>{fmtMoney(totalSelM)}</strong></span>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => setConfirmar(true)} disabled={!selM.length || !totalSelM}><Ic n="check" s={13} />Revisar</Btn>
          </div>
        </div>
      </>}
      {confirmar && <>
        <div style={{ maxHeight: 360, overflowY: "auto", border: `1px solid ${t.border}`, borderRadius: 8, marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: t.surf2 }}><th style={{ padding: "8px 12px", textAlign: "left", color: t.sub, fontWeight: 600 }}>Cliente</th><th style={{ padding: "8px 12px", textAlign: "right", color: t.sub, fontWeight: 600 }}>Monto</th></tr></thead>
            <tbody>{selM.map(cid => { const cl = clientes.find((c: any) => c.id === cid); const montos = Array.isArray(montosM[cid]) ? montosM[cid] : [montosM[cid] || "0"]; return montos.filter((m: any) => parseMoney(m) > 0).map((m: any, i: number) => (<tr key={`${cid}-${i}`} style={{ borderBottom: `1px solid ${t.border}22` }}><td style={{ padding: "7px 12px", color: t.text }}>{cl?.nombre}{montos.filter((x: any) => parseMoney(x) > 0).length > 1 && <span style={{ fontSize: 11, color: t.muted, marginLeft: 4 }}>({i + 1})</span>}</td><td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 600, color: t.accent, fontFamily: "'Consolas','Courier New',monospace" }}>{fmtMoney(parseMoney(m))}</td></tr>)); })}</tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn v="ghost" onClick={() => setConfirmar(false)}>Volver</Btn>
          <Btn onClick={guardar}><Ic n="check" s={13} />Confirmar y registrar</Btn>
        </div>
      </>}
    </OverlaySheet>
  );
}
