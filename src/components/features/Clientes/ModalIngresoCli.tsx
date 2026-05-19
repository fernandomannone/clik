import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Fld, Sel, Inp, InpMoney, Btn, Ic, BuscadorSelect, OverlaySheet } from "../../common/UIBase";
import { parseMoney, getToday, fmtMoney } from "../../../lib/utils";
import { BuscadorCliente } from "./BuscadorCliente";

const today = getToday();

export function ModalIngresoCli({ open, onClose, clientes, cuentas, setCuentas, proveedores, pagos, setPagos, movimientos, setMovimientos, pagosProv, setPagosProv, user, cloudSync, onSwitchMasivo }: any) {
  const { t } = useApp();
  const FORM0 = { clienteId: "", monto: "", tipo: "Transferencia", destino: "cuenta", cuentaId: "", proveedorId: "", obs: "", fecha: today };
  const IMPUT0 = { clienteId: "", monto: "" };
  const [form, setForm] = useState(FORM0);
  const [imputaciones, setImputaciones] = useState([IMPUT0]);
  const [modoForm, setModoForm] = useState("simple");
  const [busqCli, setBusqCli] = useState("");
  const [errForm, setErrForm] = useState<any>({});

  React.useEffect(() => { if (open) { setForm({ ...FORM0, fecha: today }); setImputaciones([IMPUT0]); setModoForm("simple"); setBusqCli(""); setErrForm({}); } }, [open]);

  const esDividir = modoForm === "dividir";
  const totalImputado = imputaciones.reduce((s, i) => s + parseMoney(i.monto), 0);
  const updateImput = (idx: number, k: string, v: any) => setImputaciones(prev => prev.map((im, i) => i === idx ? { ...im, [k]: v } : im));
  const resetModo = (modo: string) => { setModoForm(modo); setImputaciones([IMPUT0, ...(modo === "dividir" ? [IMPUT0] : [])].slice(0, modo === "simple" ? 1 : 2)); };

  const crearMovCaja = (recibo: any, targetOps?: any[], targetSt?: any) => {
    if (!recibo.cuentaId) return;
    const mov = { id: Date.now() + "_" + Math.random().toString(36).substr(2, 9), cuentaId: recibo.cuentaId, concepto: `Cobro \u2014 ${recibo.cliente}${recibo.obs ? " \u00b7 " + recibo.obs : ""}`, tipo: "ingreso", monto: recibo.monto, fecha: recibo.fecha, hora: recibo.hora, reciboId: recibo.id, grupoId: recibo.grupoId };
    
    if (targetOps) targetOps.push({ type: "set", collection: "movimientos", id: String(mov.id), data: mov });
    else {
      setMovimientos((prev: any) => [mov, ...prev]);
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("movimientos", mov);
    }
    
    const cIdx = cuentas.findIndex((c: any) => c.id === recibo.cuentaId);
    if (cIdx >= 0) {
       const nuevaC = { ...cuentas[cIdx], saldo: cuentas[cIdx].saldo + recibo.monto };
       if (targetOps) {
          targetOps.push({ type: "set", collection: "cuentas", id: String(nuevaC.id), data: nuevaC });
          if(targetSt) targetSt.cuenta = nuevaC;
       } else {
          setCuentas((prev: any) => prev.map((c: any) => c.id === recibo.cuentaId ? nuevaC : c));
          if (cloudSync?.saveToCloud) cloudSync.saveToCloud("cuentas", nuevaC);
       }
    }
    if (targetSt) targetSt.movimiento = mov;
  };
  const crearPagoProv = (recibo: any, targetOps?: any[], targetSt?: any) => {
    if (!recibo.proveedorId) return;
    const prov = proveedores.find((p: any) => p.id === recibo.proveedorId);
    const pid = Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const pp = { id: pid, proveedorId: recibo.proveedorId, tipo: recibo.tipo || "Transferencia", monto: recibo.monto, fecha: recibo.fecha, hora: recibo.hora, obs: `Cobro cliente ${recibo.cliente}${recibo.obs ? " \u00b7 " + recibo.obs : ""}`, anulado: false, reciboId: recibo.id, _desdeRecibo: true, grupoId: recibo.grupoId };
    
    if (targetOps) targetOps.push({ type: "set", collection: "pagosProv", id: String(pp.id), data: pp });
    else {
      setPagosProv((prev: any) => [pp, ...prev]);
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("pagosProv", pp);
    }
    
    if (targetSt) targetSt.pp = pp;

    if (setMovimientos) {
       const movI = { id: pid + "_I", cuentaId: null, concepto: `Auto-Ingreso (Cobro cliente) \u2014 ${recibo.cliente}`, tipo: "ingreso", monto: recibo.monto, fecha: recibo.fecha, hora: recibo.hora, informativo: true, reciboId: recibo.id, grupoId: recibo.grupoId };
       const movE = { id: pid + "_E", cuentaId: null, concepto: `Cobro \u2192 ${prov?.nombre || "Proveedor"} \u2014 ${recibo.cliente}`, tipo: "egreso", monto: recibo.monto, fecha: recibo.fecha, hora: recibo.hora, informativo: true, reciboId: recibo.id, pagoProvId: pp.id, grupoId: recibo.grupoId };
       
       if (targetOps) {
         targetOps.push({ type: "set", collection: "movimientos", id: String(movI.id), data: movI });
         targetOps.push({ type: "set", collection: "movimientos", id: String(movE.id), data: movE });
       } else {
         setMovimientos((prev: any) => [movI, movE, ...prev]);
         if (cloudSync?.saveToCloud) {
           cloudSync.saveToCloud("movimientos", movI);
           cloudSync.saveToCloud("movimientos", movE);
         }
       }
       if (targetSt) {
         targetSt.movI = movI;
         targetSt.movE = movE;
       }
    }
  };

  const guardar = async () => {
    const errs: any = {};
    if (!form.destino) errs.destino = "Requerido";
    if (form.destino === "cuenta" && !form.cuentaId) errs.cuenta = "Seleccion\u00e1 cuenta";
    if (form.destino === "proveedor" && !form.proveedorId) errs.cuenta = "Seleccion\u00e1 proveedor";
    const imputsValidas = imputaciones.filter(im => im.clienteId && parseMoney(im.monto) > 0);
    if (!imputsValidas.length) errs.cliente = "Ingres\u00e1 cliente y monto";
    if (Object.keys(errs).length) { setErrForm(errs); return; }
    const h = new Date().getHours() + ":" + String(new Date().getMinutes()).padStart(2, "0");
    const base_id = Date.now();
    
    const batchOps: any[] = [];
    const st: any = { pagos: [], movs: [], pps: [] };

    if (esDividir && imputsValidas.length > 1) {
      const grupoId = base_id;
      const total = imputsValidas.reduce((s, im) => s + parseMoney(im.monto), 0);
      const nuevos = imputsValidas.map((im, i) => { 
        const cl = clientes.find((c: any) => c.id === parseInt(im.clienteId)); 
        return { 
          id: base_id + "_" + i, 
          grupoId, 
          clienteId: cl?.id, 
          cliente: cl?.nombre || "—", 
          nombreCV: cl?.nombreCV || "", 
          monto: parseMoney(im.monto), 
          tipo: form.tipo, 
          estadoCV: "pendiente", 
          fecha: form.fecha, 
          hora: h, 
          obs: form.obs || "", 
          anulado: false, 
          cuentaId: form.destino === "cuenta" ? parseInt(form.cuentaId) : null, 
          proveedorId: form.destino === "proveedor" ? parseInt(form.proveedorId) : null 
        }; 
      });
      st.pagos = nuevos;
      nuevos.forEach(n => batchOps.push({ type: "set", collection: "pagos", id: String(n.id), data: n }));

      if (form.destino === "cuenta" && form.cuentaId) {
        const cid = parseInt(form.cuentaId);
        const mov = { id: base_id + "_M", grupoId, cuentaId: cid, concepto: `Cobro dividido \u2014 ${nuevos.map((n: any) => n.cliente).join(", ")}`, tipo: "ingreso", monto: total, fecha: form.fecha, hora: h };
        st.movs.push(mov);
        batchOps.push({ type: "set", collection: "movimientos", id: String(mov.id), data: mov });

        const cIdx = cuentas.findIndex((c: any) => c.id === cid);
        if (cIdx >= 0) {
           const nuevaC = { ...cuentas[cIdx], saldo: cuentas[cIdx].saldo + total };
           st.cuenta = nuevaC;
           batchOps.push({ type: "set", collection: "cuentas", id: String(nuevaC.id), data: nuevaC });
        }
      } else if (form.destino === "proveedor" && form.proveedorId) {
        const pid = base_id + "_PP";
        const pp = { id: pid, grupoId, proveedorId: parseInt(form.proveedorId), tipo: form.tipo, monto: total, fecha: form.fecha, hora: h, obs: form.obs || "", anulado: false, _desdeRecibo: true };
        st.pps.push(pp);
        batchOps.push({ type: "set", collection: "pagosProv", id: String(pp.id), data: pp });

        const prov = proveedores.find((p: any) => p.id === parseInt(form.proveedorId));
        const movE = { 
           id: base_id + "_ME", 
           grupoId, 
           cuentaId: null, 
           concepto: `Cobro \u2192 ${prov?.nombre || "Proveedor"} \u2014 ${nuevos.map(n => n.cliente).join(", ")}`, 
           tipo: "egreso", 
           monto: total, 
           fecha: form.fecha, 
           hora: h, 
           informativo: true,
           pagoProvId: pp.id
        };
        st.movs.push(movE);
        batchOps.push({ type: "set", collection: "movimientos", id: String(movE.id), data: movE });
      }
    } else {
      const cl = clientes.find((c: any) => c.id === parseInt(imputsValidas[0].clienteId));
      if (!cl) return;
      const base = { id: base_id, clienteId: cl.id, cliente: cl.nombre, nombreCV: cl.nombreCV, monto: parseMoney(imputsValidas[0].monto), tipo: form.tipo, estadoCV: "pendiente", fecha: form.fecha, hora: h, obs: form.obs || "", anulado: false, grupoId: base_id };
      if (form.destino === "cuenta") (base as any).cuentaId = parseInt(form.cuentaId);
      else (base as any).proveedorId = parseInt(form.proveedorId);
      st.pagos.push(base);
      batchOps.push({ type: "set", collection: "pagos", id: String(base.id), data: base });

      if (form.destino === "cuenta") crearMovCaja(base, batchOps, st);
      else crearPagoProv(base, batchOps, st);
    }
    
    if (cloudSync?.executeCloudBatch && batchOps.length > 0) {
      const success = await cloudSync.executeCloudBatch(batchOps);
      if (!success) {
         alert("Error de red: no se pudo guardar el cobro.");
         return;
      }
    } else if (cloudSync?.saveToCloud) {
       // fallback for non-batch
    }

    const mergedIds = (arr1: any[], arr2: any[]) => {
      const ids = new Set(arr1.map(i => String(i.id)));
      return [...arr1, ...arr2.filter(i => !ids.has(String(i.id)))];
    };

    if (st.pagos.length) setPagos((prev: any) => mergedIds(st.pagos, prev));
    if (st.movs.length) setMovimientos((prev: any) => mergedIds(st.movs, prev));
    if (st.movI) setMovimientos((prev: any) => mergedIds([st.movI], prev));
    if (st.movE) setMovimientos((prev: any) => mergedIds([st.movE], prev));
    if (st.movimiento) setMovimientos((prev: any) => mergedIds([st.movimiento], prev));
    if (st.pps.length) setPagosProv((prev: any) => mergedIds(st.pps, prev));
    if (st.pp) setPagosProv((prev: any) => mergedIds([st.pp], prev));
    if (st.cuenta) setCuentas((prev: any) => prev.map((c: any) => String(c.id) === String(st.cuenta.id) ? st.cuenta : c));

    onClose();
  };

  if (!open) return null;
  return (
    <OverlaySheet open={true} onClose={onClose} title="Registrar Cobro" sub={onSwitchMasivo ? <span style={{ fontSize: 12, color: "inherit" }}>Cobro recibido de cliente · <button onClick={onSwitchMasivo} style={{ background: "none", border: "none", cursor: "pointer", color: "#ffffff", fontWeight: 600, fontSize: 12, padding: 0, fontFamily: "inherit", textDecoration: "underline" }}>Ir a Cobro Masivo</button></span> : "Cobro recibido de cliente"} width={520}>
      <div style={{ display: "flex", gap: 12 }}>
        <Fld label="Tipo" half><Sel value={form.tipo} onChange={(e: any) => { const tipo = e.target.value; if (tipo === "Efectivo") { const caja = cuentas.find((c: any) => c.tipo === "caja"); setForm({ ...form, tipo, cuentaId: caja ? String(caja.id) : form.cuentaId, destino: "cuenta" }); } else setForm({ ...form, tipo }); }}>{["Transferencia", "Efectivo"].map(x => <option key={x}>{x}</option>)}</Sel></Fld>
        <Fld label="Fecha" half><Inp type="date" value={form.fecha} onChange={(e: any) => setForm({ ...form, fecha: e.target.value })} /></Fld>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Fld label={<>Destino{errForm.destino && <span style={{ color: t.red, marginLeft: 6, fontSize: 11 }}>{errForm.destino}</span>}</>} half>
          <Sel value={form.destino} onChange={(e: any) => { setForm({ ...form, destino: e.target.value }); setErrForm((p: any) => ({ ...p, destino: undefined })); }}>
            <option value="cuenta">Cuenta propia</option>
            <option value="proveedor">Proveedor directo</option>
          </Sel>
        </Fld>
        {form.destino === "cuenta"
          ? <Fld label={<>Cuenta{errForm.cuenta && <span style={{ color: t.red, marginLeft: 6, fontSize: 11 }}>{errForm.cuenta}</span>}</>} half>
            <BuscadorSelect 
              opciones={cuentas.filter((c: any) => c.tipo !== "inversion").sort((a: any, b: any) => {
                if ((a.nombre || "").toLowerCase().includes("bbva")) return 1;
                if ((b.nombre || "").toLowerCase().includes("bbva")) return -1;
                return 0;
              })}
              valor={form.cuentaId}
              onChange={(id: any) => { setForm({ ...form, cuentaId: id }); setErrForm((p: any) => ({ ...p, cuenta: undefined })); }}
              placeholder="Seleccioná cuenta..."
            />
          </Fld>
          : <Fld label={<>Proveedor{errForm.cuenta && <span style={{ color: t.red, marginLeft: 6, fontSize: 11 }}>{errForm.cuenta}</span>}</>} half>
            <BuscadorSelect
              opciones={proveedores.filter((p: any) => p.estado !== "archivado")}
              valor={form.proveedorId}
              onChange={(id: any) => { setForm({ ...form, proveedorId: id }); setErrForm((p: any) => ({ ...p, cuenta: undefined })); }}
              placeholder="Seleccioná proveedor..."
            />
          </Fld>
        }
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: t.sub, letterSpacing: "0.8px", textTransform: "uppercase" }}>Cliente e importe</label>
          <div style={{ display: "flex", gap: 6 }}>
            {modoForm === "simple" && <button onClick={() => resetModo("dividir")} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 6, border: `1px solid ${t.accent}44`, background: t.accentBg, color: t.accent, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>Dividir entre 2</button>}
            {modoForm !== "simple" && <button onClick={() => resetModo("simple")} style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${t.border}`, background: "none", color: t.muted, fontSize: 11, cursor: "pointer", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>Pago simple</button>}
          </div>
        </div>
        {!esDividir && <>
          <div style={{ position: "relative", marginBottom: 6 }}>
            <Ic n="search" s={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.muted, pointerEvents: "none" }} />
            <input value={busqCli} onChange={e => setBusqCli(e.target.value)} placeholder="Buscar cliente..." style={{ width: "100%", paddingLeft: 32, padding: "8px 12px 8px 32px", background: t.surf2, border: `1px solid ${busqCli ? t.accent : t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: "none", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", boxSizing: "border-box" }} />
            {busqCli && <button onClick={() => setBusqCli("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.muted, fontSize: 14 }}>\u00d7</button>}
          </div>
          {busqCli && <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, maxHeight: 140, overflowY: "auto", marginBottom: 6, background: t.surf }}>
            {clientes.filter((c: any) => c.estado !== "archivado" && c.nombre.toLowerCase().includes(busqCli.toLowerCase())).slice(0, 10).map((c: any) => (
              <div key={c.id} onClick={() => { updateImput(0, "clienteId", String(c.id)); setBusqCli(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${t.border}22`, fontSize: 13, color: t.text, fontWeight: imputaciones[0]?.clienteId === String(c.id) ? 700 : 400, background: imputaciones[0]?.clienteId === String(c.id) ? t.accentBg : "none" }}>{c.nombre}</div>
            ))}
          </div>}
          {imputaciones[0]?.clienteId && !busqCli && <div style={{ padding: "6px 10px", background: t.accentBg, borderRadius: 7, fontSize: 12, color: t.accent, fontWeight: 600, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span>{clientes.find((c: any) => String(c.id) === String(imputaciones[0].clienteId))?.nombre || "\u2014"}</span>
            <button onClick={() => updateImput(0, "clienteId", "")} style={{ background: "none", border: "none", cursor: "pointer", color: t.accent, fontSize: 12 }}>\u2715</button>
          </div>}
          <InpMoney value={imputaciones[0]?.monto || ""} onChange={(e: any) => updateImput(0, "monto", e.target.value)} placeholder="Monto $" />
        </>}
        {esDividir && <>
          {imputaciones.map((im, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <div style={{ flex: 3 }}><BuscadorCliente clientes={clientes.filter((c: any) => c.estado !== "archivado")} valor={im.clienteId ? parseInt(im.clienteId) : null} onChange={(id: any) => updateImput(idx, "clienteId", id ? String(id) : "")} t={t} placeholder={`Cliente ${idx + 1}...`} /></div>
              <div style={{ flex: 2 }}><InpMoney value={im.monto} onChange={(e: any) => updateImput(idx, "monto", e.target.value)} placeholder="Monto $" /></div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Total: <strong style={{ color: t.text }}>{fmtMoney(totalImputado)}</strong></div>
        </>}
        {errForm.cliente && <div style={{ color: t.red, fontSize: 12, marginTop: 4 }}>{errForm.cliente}</div>}
      </div>
      <Fld label="Observaciones"><Inp placeholder="Notas..." value={form.obs} onChange={(e: any) => setForm({ ...form, obs: e.target.value })} /></Fld>
      {form.fecha !== today && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fef3c7", border: "1px solid #f59e0b44", fontSize: 12, color: "#92400e", fontWeight: 600, marginBottom: 8 }}>\u26a0 Fecha {form.fecha}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Btn v="ghost" onClick={onClose} full>Cancelar</Btn>
        <Btn onClick={guardar} full><Ic n="check" s={14} />Guardar</Btn>
      </div>
    </OverlaySheet>
  );
}
