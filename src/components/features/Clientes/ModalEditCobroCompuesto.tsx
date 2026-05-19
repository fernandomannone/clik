import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../../context/AppContext";
import { Fld, Sel, Inp, InpMoney, Btn, Ic, BuscadorSelect, OverlaySheet, BtnEliminarConClave } from "../../common/UIBase";
import { parseMoney, fmtMoney } from "../../../lib/utils";
import { BuscadorCliente } from "./BuscadorCliente";

export function ModalEditCobroCompuesto({ grupoId, onClose, clientes, cuentas, setCuentas, proveedores, pagos, setPagos, movimientos, setMovimientos, pagosProv, setPagosProv, cloudSync }: any) {
  const { t } = useApp();
  const [form, setForm] = useState<any>({ fecha: "", tipo: "Transferencia", destino: "", cuentaId: "", proveedorId: "", obs: "" });
  const [imputaciones, setImputaciones] = useState<any[]>([]);
  const [errForm, setErrForm] = useState<any>({});
  
  // Base entities
  const [movsAsociados, setMovsAsociados] = useState<any[]>([]);
  const [provAsociado, setProvAsociado] = useState<any>(null);
  const [pagosOriginales, setPagosOriginales] = useState<any[]>([]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const getOriginalDestName = () => {
    const movConCuenta = movsAsociados.find((m: any) => m.cuentaId);
    if (movConCuenta) {
      const origC = cuentas.find((c: any) => c.id === movConCuenta.cuentaId);
      return `Cuenta propia: ${origC?.nombre || "Desconocida"}`;
    }
    if (provAsociado) {
      const origP = proveedores.find((p: any) => p.id === provAsociado.proveedorId);
      return `Proveedor: ${origP?.nombre || "Desconocido"}`;
    }
    return "Sin destino asignado";
  };

  const getNewDestName = () => {
    if (form.destino === "cuenta" && form.cuentaId) {
      const newC = cuentas.find((c: any) => String(c.id) === String(form.cuentaId));
      return `Cuenta propia: ${newC?.nombre || "Desconocida"}`;
    }
    if (form.destino === "proveedor" && form.proveedorId) {
      const newP = proveedores.find((p: any) => String(p.id) === String(form.proveedorId));
      return `Proveedor: ${newP?.nombre || "Desconocido"}`;
    }
    return "Sin destino seleccionado";
  };

  const getOriginalClientsText = () => {
    if (pagosOriginales.length === 0) return "Ninguno";
    return pagosOriginales.map((p: any) => `${p.cliente || "Cliente"} (${fmtMoney(p.monto)})`).join(", ");
  };

  const getNewClientsText = () => {
    const imputsValidas = imputaciones.filter(im => im.clienteId && parseMoney(im.monto) > 0);
    if (imputsValidas.length === 0) return "Ninguno";
    return imputsValidas.map((im: any) => {
      const cl = clientes.find((c: any) => String(c.id) === String(im.clienteId));
      return `${cl?.nombre || "Cliente"} (${fmtMoney(parseMoney(im.monto))})`;
    }).join(", ");
  };

  useEffect(() => {
    if (!grupoId) return;
    
    let pagosGrp = pagos.filter((p: any) => String(p.grupoId) === String(grupoId));
    if (pagosGrp.length === 0) {
      pagosGrp = pagos.filter((p: any) => String(p.id) === String(grupoId));
    }
    setPagosOriginales(pagosGrp);
    
    // Find the associated movements or provider payment
    let ms = movimientos?.filter((m: any) => String(m.grupoId) === String(grupoId)) || [];
    let pp = pagosProv?.find((p: any) => String(p.grupoId) === String(grupoId) || String(p.reciboId) === String(grupoId));

    if (pagosGrp.length === 1 && !pagosGrp[0].grupoId) {
      ms = movimientos?.filter((m: any) => String(m.reciboId) === String(grupoId) || String(m.grupoId) === String(grupoId)) || [];
      if (!pp) {
        pp = pagosProv?.find((p: any) => String(p.reciboId) === String(grupoId) || String(p.grupoId) === String(grupoId));
      }
    }
    
    setMovsAsociados(ms);
    setProvAsociado(pp);
    
    // Find a movement with a cuentaId to identify the "destino cuenta"
    const movConCuenta = ms.find((m: any) => m.cuentaId);
    
    // Initialize form
    const f = {
      fecha: pagosGrp[0]?.fecha || "",
      tipo: pagosGrp[0]?.tipo || "Transferencia",
      destino: (movConCuenta || pagosGrp[0]?.cuentaId) ? "cuenta" : ((pp || pagosGrp[0]?.proveedorId) ? "proveedor" : ""),
      cuentaId: movConCuenta?.cuentaId ? String(movConCuenta.cuentaId) : (pagosGrp[0]?.cuentaId ? String(pagosGrp[0].cuentaId) : ""),
      proveedorId: pp?.proveedorId ? String(pp.proveedorId) : (pagosGrp[0]?.proveedorId ? String(pagosGrp[0].proveedorId) : ""),
      obs: pagosGrp[0]?.obs || ""
    };
    setForm(f);
    
    // Initialize imputations
    setImputaciones(pagosGrp.map((p: any) => ({
      _id: p.id,
      clienteId: String(p.clienteId),
      monto: String(p.monto)
    })));
  }, [grupoId, pagos, movimientos, pagosProv]);

  const updateImput = (idx: number, k: string, v: any) => setImputaciones(prev => prev.map((im, i) => i === idx ? { ...im, [k]: v } : im));
  const addImputacion = () => setImputaciones(prev => [...prev, { _nuevo: true, clienteId: "", monto: "" }]);
  const removeImput = (idx: number) => {
    if (imputaciones.length <= 1) return;
    setImputaciones(prev => prev.filter((_, i) => i !== idx));
  };

  const totalImputado = imputaciones.reduce((s, i) => s + parseMoney(i.monto), 0);

  const eliminar = (batchOps?: any[]) => {
    // 1. Revert the original effect from cuenta
    let localBatchOps: any[] = batchOps || [];
    movsAsociados.forEach(m => {
      if (m.cuentaId && m.monto && setCuentas) {
        setCuentas((prev: any[]) => prev.map((c: any) => {
          if (String(c.id) === String(m.cuentaId)) {
            const revertido = c.saldo + (m.tipo === "egreso" ? m.monto : -m.monto);
            const finalC = { ...c, saldo: revertido };
            if (batchOps) {
               localBatchOps.push({ type: "set", collection: "cuentas", id: String(c.id), data: finalC });
            } else if (cloudSync?.saveToCloud) {
               cloudSync.saveToCloud("cuentas", finalC);
            }
            return finalC;
          }
          return c;
        }));
      }
      
      if (batchOps) localBatchOps.push({ type: "delete", collection: "movimientos", id: String(m.id) });
      else if (cloudSync?.deleteFromCloud) cloudSync.deleteFromCloud("movimientos", String(m.id));
    });

    const isSimple = pagosOriginales.length === 1 && !pagosOriginales[0].grupoId;
    
    // 2. Remove old pagos
    pagosOriginales.forEach(po => {
      if (batchOps) localBatchOps.push({ type: "delete", collection: "pagos", id: String(po.id) });
      else if (cloudSync?.deleteFromCloud) cloudSync.deleteFromCloud("pagos", String(po.id));
    });
    setPagos((prev: any[]) => prev.filter(p => isSimple ? String(p.id) !== String(grupoId) : String(p.grupoId) !== String(grupoId)));
    
    setMovimientos((prev: any) => prev.filter((m: any) => {
      if (isSimple) {
        return String(m.reciboId) !== String(grupoId) && String(m.grupoId) !== String(grupoId);
      } else {
        return String(m.grupoId) !== String(grupoId);
      }
    }));

    if (provAsociado) {
       if (batchOps) localBatchOps.push({ type: "delete", collection: "pagosProv", id: String(provAsociado.id) });
       else if (cloudSync?.deleteFromCloud) cloudSync.deleteFromCloud("pagosProv", String(provAsociado.id));
    }
    
    // Always filter pagosProv by all possible matches to be completely safe
    setPagosProv((prev: any) => prev.filter((p: any) => {
      const matchId = provAsociado && String(p.id) === String(provAsociado.id);
      const matchGrupo = String(p.grupoId) === String(grupoId);
      const matchRecibo = String(p.reciboId) === String(grupoId);
      return !matchId && !matchGrupo && !matchRecibo;
    }));

    if (!batchOps && localBatchOps.length > 0 && cloudSync?.executeCloudBatch) {
       cloudSync.executeCloudBatch(localBatchOps);
    }
  };

  const guardar = async () => {
    const errs: any = {};
    if (!form.destino) errs.destino = "Requerido";
    if (form.destino === "cuenta" && !form.cuentaId) errs.cuenta = "Seleccioná cuenta";
    if (form.destino === "proveedor" && !form.proveedorId) errs.cuenta = "Seleccioná proveedor";
    
    const imputsValidas = imputaciones.filter(im => im.clienteId && parseMoney(im.monto) > 0);
    if (!imputsValidas.length) errs.cliente = "Ingresá cliente y monto";
    if (Object.keys(errs).length) { setErrForm(errs); return; }

    setShowConfirmModal(true);
  };

  const ejecutarGuardar = async () => {
    const imputsValidas = imputaciones.filter(im => im.clienteId && parseMoney(im.monto) > 0);
    const batchOps: any[] = [];
    // First delete everything old
    eliminar(batchOps);

    // Now, apply the new effects as if it was a new creation
    const h = pagosOriginales[0]?.hora || (new Date().getHours() + ":" + String(new Date().getMinutes()).padStart(2, "0"));
    const base_id = Date.now();
    
    const nuevos = imputsValidas.map((im, i) => {
      const cl = clientes.find((c: any) => String(c.id) === im.clienteId);
      return { 
        id: im._id || base_id + "_" + i, 
        grupoId, 
        clienteId: cl?.id, 
        cliente: cl?.nombre, 
        nombreCV: cl?.nombreCV, 
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

    const mergedIds = (arr1: any[], arr2: any[]) => {
      const ids = new Set(arr1.map(i => String(i.id)));
      return [...arr1, ...arr2.filter(i => !ids.has(String(i.id)))];
    };

    setPagos((prev: any) => mergedIds(nuevos, prev));
    nuevos.forEach(n => batchOps.push({ type: "set", collection: "pagos", id: String(n.id), data: n }));

    const total = nuevos.reduce((s, n) => s + n.monto, 0);

    if (form.destino === "cuenta" && form.cuentaId) {
      const cid = parseInt(form.cuentaId);
      const mId = movsAsociados.find(m => m.cuentaId)?.id || base_id + "_M";
      const mov = { id: mId, grupoId, cuentaId: cid, concepto: `Cobro dividido \u2014 ${nuevos.map(n => n.cliente).join(", ")}`, tipo: "ingreso", monto: total, fecha: form.fecha, hora: h };
      setMovimientos((prev: any) => mergedIds([mov], prev));
      batchOps.push({ type: "set", collection: "movimientos", id: String(mov.id), data: mov });

      setCuentas((prev: any) => prev.map((c: any) => {
        if (c.id === cid) {
           const finalC = { ...c, saldo: c.saldo + total };
           batchOps.push({ type: "set", collection: "cuentas", id: String(finalC.id), data: finalC });
           return finalC;
        }
        return c;
      }));
    } else if (form.destino === "proveedor" && form.proveedorId) {
      const ppId = provAsociado ? provAsociado.id : base_id + "_PP";
      const pp = { 
        id: ppId, 
        grupoId, 
        reciboId: (pagosOriginales.length === 1 && !pagosOriginales[0].grupoId) ? grupoId : null,
        proveedorId: parseInt(form.proveedorId), 
        tipo: form.tipo, 
        monto: total, 
        fecha: form.fecha, 
        hora: h, 
        obs: form.obs || "", 
        anulado: false, 
        _desdeRecibo: true 
      };
      setPagosProv((prev: any) => mergedIds([pp], prev));
      batchOps.push({ type: "set", collection: "pagosProv", id: String(pp.id), data: pp });

      const prov = proveedores.find((p: any) => p.id === parseInt(form.proveedorId));
      
      const movI = { 
        id: base_id + "_MI", 
        grupoId, 
        cuentaId: null, 
        concepto: `Auto-Ingreso (Cobro cliente) \u2014 ${nuevos.map(n => n.cliente).join(", ")}`, 
        tipo: "ingreso", 
        monto: total, 
        fecha: form.fecha, 
        hora: h, 
        informativo: true 
      };
      const movE = { 
        id: base_id + "_ME", 
        grupoId, 
        cuentaId: null, 
        concepto: `Cobro \u2192 ${prov?.nombre || "Proveedor"} \u2014 ${nuevos.map(n => n.cliente).join(", ")}`, 
        tipo: "egreso", 
        monto: total, 
        fecha: form.fecha, 
        hora: h, 
        pagoProvId: pp.id,
        informativo: true 
      };
      setMovimientos((prev: any) => mergedIds([movI, movE], prev));
      batchOps.push({ type: "set", collection: "movimientos", id: String(movI.id), data: movI });
      batchOps.push({ type: "set", collection: "movimientos", id: String(movE.id), data: movE });
    }
    
    if (cloudSync?.executeCloudBatch && batchOps.length > 0) {
      const success = await cloudSync.executeCloudBatch(batchOps);
      if (!success) {
         alert("Hubo un error guardando el cobro compuesto en la nube.");
         return; // Optional: revert local state on error
      }
    } else if (cloudSync?.saveBatchToCloud) {
      cloudSync.saveBatchToCloud("pagos", nuevos);
      // Other saves... (fallback)
    }

    onClose();
  };

  const esCobroSimple = pagosOriginales.length <= 1;

  if (!grupoId) return null;

  return (
    <OverlaySheet open={true} onClose={onClose} title={esCobroSimple ? "Editar Cobro" : "Editar Cobro Dividido"} width={520}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <Fld label="Tipo" half>
          <Sel value={form.tipo} onChange={(e: any) => { 
            const tipo = e.target.value; 
            if (tipo === "Efectivo") { 
              const caja = cuentas.find((c: any) => c.tipo === "caja"); 
              setForm({ ...form, tipo, cuentaId: caja ? String(caja.id) : form.cuentaId, destino: "cuenta" }); 
            } else setForm({ ...form, tipo }); 
          }}>
            {["Transferencia", "Efectivo"].map(x => <option key={x}>{x}</option>)}
          </Sel>
        </Fld>
        <Fld label="Fecha" half><Inp type="date" value={form.fecha} onChange={(e: any) => setForm({ ...form, fecha: e.target.value })} /></Fld>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Fld label={<>Destino{errForm.destino && <span style={{ color: t.red, marginLeft: 6, fontSize: 11 }}>{errForm.destino}</span>}</>} half>
          <Sel value={form.destino} onChange={(e: any) => { setForm({ ...form, destino: e.target.value }); setErrForm((p: any) => ({ ...p, destino: undefined })); }}>
            <option value="cuenta">Cuenta propia</option>
            <option value="proveedor">Proveedor directo</option>
          </Sel>
        </Fld>
        {form.destino === "cuenta" ? (
          <Fld label={<>Cuenta{errForm.cuenta && <span style={{ color: t.red, marginLeft: 6, fontSize: 11 }}>{errForm.cuenta}</span>}</>} half>
            <BuscadorSelect 
              opciones={cuentas.filter((c: any) => c.tipo !== "inversion")}
              valor={form.cuentaId}
              onChange={(id: any) => { setForm({ ...form, cuentaId: id }); setErrForm((p: any) => ({ ...p, cuenta: undefined })); }}
              placeholder="Seleccioná cuenta..."
            />
          </Fld>
        ) : (
          <Fld label={<>Proveedor{errForm.cuenta && <span style={{ color: t.red, marginLeft: 6, fontSize: 11 }}>{errForm.cuenta}</span>}</>} half>
            <BuscadorSelect
              opciones={proveedores.filter((p: any) => p.estado !== "archivado")}
              valor={form.proveedorId}
              onChange={(id: any) => { setForm({ ...form, proveedorId: id }); setErrForm((p: any) => ({ ...p, cuenta: undefined })); }}
              placeholder="Seleccioná proveedor..."
            />
          </Fld>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: t.sub, letterSpacing: "0.8px", textTransform: "uppercase" }}>Clientes e importes</label>
        </div>
        
        {imputaciones.map((im, idx) => (
          <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <div style={{ flex: 3 }}>
              <BuscadorCliente 
                clientes={clientes.filter((c: any) => c.estado !== "archivado")} 
                valor={im.clienteId ? parseInt(im.clienteId) : null} 
                onChange={(id: any) => updateImput(idx, "clienteId", id ? String(id) : "")} 
                t={t} 
                placeholder={`Cliente ${idx + 1}...`} 
              />
            </div>
            <div style={{ flex: 2 }}>
              <InpMoney value={im.monto} onChange={(e: any) => updateImput(idx, "monto", e.target.value)} placeholder="Monto $" />
            </div>
            {(!esCobroSimple || imputaciones.length > 1) && (
              <button 
                onClick={() => removeImput(idx)} 
                title="Quitar" 
                style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}
              >
                <Ic n="trash" s={14} />
              </button>
            )}
          </div>
        ))}
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          {!esCobroSimple ? (
            <button 
              onClick={addImputacion} 
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: `1px dashed ${t.border}`, background: "none", color: t.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", WebkitUserSelect: "none" }}
            >
              ⊕ Agregar otro
            </button>
          ) : <div></div>}
          <div style={{ fontSize: 12, color: t.muted, fontWeight: 600 }}>Total: <strong style={{ color: t.text }}>{fmtMoney(totalImputado)}</strong></div>
        </div>
        {errForm.cliente && <div style={{ color: t.red, fontSize: 12, marginTop: 4 }}>{errForm.cliente}</div>}
      </div>

      <Fld label="Observaciones"><Inp placeholder="Notas..." value={form.obs} onChange={(e: any) => setForm({ ...form, obs: e.target.value })} /></Fld>

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <Btn v="ghost" onClick={onClose} full>Cancelar</Btn>
        <BtnEliminarConClave onConfirm={() => { eliminar(); onClose(); }} />
        <Btn onClick={guardar} full><Ic n="check" s={14} /> Guardar cambios</Btn>
      </div>

      {showConfirmModal && createPortal(
        <div 
          style={{ 
            position: "fixed", 
            inset: 0, 
            zIndex: 9999, 
            background: "rgba(0,0,0,0.4)", 
            display: "flex", 
            justifyContent: "flex-end", 
            backdropFilter: "blur(2px)", 
            animation: "fadeIn 0.2s ease" 
          }} 
          onClick={() => setShowConfirmModal(false)}
        >
          <div 
            style={{ 
              width: "480px", 
              maxWidth: "92vw", 
              height: "100%", 
              background: t.bg, 
              boxShadow: "-10px 0 50px rgba(0,0,0,0.2)", 
              animation: "slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)", 
              padding: "36px 28px", 
              display: "flex", 
              flexDirection: "column", 
              overflowY: "auto",
              borderLeft: `1px solid ${t.border}`
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.amberBg || "rgba(245,158,11,0.1)", color: t.amber || "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Ic n="alert" s={16} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.amber || "#d97706", textTransform: "uppercase", letterSpacing: "0.5px" }}>Confirmación requerida</span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0, letterSpacing: "-0.5px" }}>¿Confirmar modificación?</h3>
                <p style={{ fontSize: 13, color: t.sub || t.muted, margin: "4px 0 0 0" }}>Verificá los cambios antes de procesar el movimiento.</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, marginBottom: 32 }}>
               {/* Comparison containers */}
               <div style={{ background: t.surf, borderRadius: 12, border: `1px solid ${t.border}`, padding: 18 }}>
                 <div style={{ fontSize: 10, fontWeight: 800, color: t.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>Estado Original</div>
                 <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: `1px solid ${t.border}44` }}>
                     <span style={{ color: t.sub, fontWeight: 500 }}>Cliente(s)</span>
                     <span style={{ color: t.text, fontWeight: 600, textAlign: "right" }}>{getOriginalClientsText()}</span>
                   </div>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: `1px solid ${t.border}44` }}>
                     <span style={{ color: t.sub, fontWeight: 500 }}>Destino</span>
                     <span style={{ color: t.text, fontWeight: 600, textAlign: "right" }}>{getOriginalDestName()}</span>
                   </div>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: `1px solid ${t.border}44` }}>
                     <span style={{ color: t.sub, fontWeight: 500 }}>Fecha</span>
                     <span style={{ color: t.text, fontWeight: 600 }}>{pagosOriginales[0]?.fecha}</span>
                   </div>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, paddingTop: 4 }}>
                     <span style={{ color: t.sub, fontWeight: 700 }}>Total anterior</span>
                     <span style={{ color: t.text, fontWeight: 800 }}>{fmtMoney(pagosOriginales.reduce((sum: number, p: any) => sum + p.monto, 0))}</span>
                   </div>
                 </div>
               </div>

               {/* Separator icon */}
               <div style={{ display: "flex", justifyContent: "center", color: t.muted, margin: "-4px 0" }}>
                 <div style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", background: t.bg }}>
                   <span style={{ fontSize: 16 }}>↓</span>
                 </div>
               </div>

               {/* New state container */}
               <div style={{ background: t.accentBg || "rgba(59,130,246,0.05)", borderRadius: 12, border: `1px solid ${t.accent}33`, padding: 18 }}>
                 <div style={{ fontSize: 10, fontWeight: 800, color: t.accent, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>Nuevo Estado Propuesto</div>
                 <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: `1px solid ${t.accent}1f` }}>
                     <span style={{ color: t.sub, fontWeight: 500 }}>Cliente(s)</span>
                     <span style={{ color: t.accent, fontWeight: 700, textAlign: "right" }}>{getNewClientsText()}</span>
                   </div>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: `1px solid ${t.accent}1f` }}>
                     <span style={{ color: t.sub, fontWeight: 500 }}>Nuevo destino</span>
                     <span style={{ color: t.accent, fontWeight: 700, textAlign: "right" }}>{getNewDestName()}</span>
                   </div>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: `1px solid ${t.accent}1f` }}>
                     <span style={{ color: t.sub, fontWeight: 500 }}>Fecha</span>
                     <span style={{ color: t.accent, fontWeight: 700 }}>{form.fecha}</span>
                   </div>
                   <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, paddingTop: 4 }}>
                     <span style={{ color: t.text, fontWeight: 700 }}>Nuevo total</span>
                     <span style={{ color: t.accent, fontWeight: 800, fontSize: 16 }}>{fmtMoney(totalImputado)}</span>
                   </div>
                 </div>
               </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
              <button 
                type="button" 
                onClick={() => setShowConfirmModal(false)} 
                style={{ flex: 1, padding: "12px 16px", border: `1px solid ${t.border}`, background: t.surf, color: t.text, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = t.surf2}
                onMouseLeave={e => e.currentTarget.style.background = t.surf}
              >
                Volver a editar
              </button>
              <button 
                type="button" 
                onClick={() => { setShowConfirmModal(false); ejecutarGuardar(); }} 
                style={{ flex: 1, padding: "12px 16px", border: "none", background: t.accent, color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                <Ic n="check" s={14} /> Confirmar cambios
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </OverlaySheet>
  );
}
