import React, { useState } from "react";
import { OverlaySheet, Fld, Inp, Sel, Btn, Ic, InpMoney } from "../../common/UIBase";
import { parseMoney, getToday } from "../../../lib/utils";

const UNIDADES_NEGOCIO = ["General"]; 
// Ideally should come from props or global constants

export default function ModalRegistrarMovimiento({
  open,
  onClose,
  tipoMovimiento,
  cuentaPreseleccionada,
  cuentas,
  conceptos,
  movimientos,
  setMovimientos,
  setCuentas,
  marcarCierreAfectado,
  cloudSync,
  unidadesNegocio,
  t
}: any) {
  const today = getToday();
  const [form, setForm] = useState({ 
    cuentaId: cuentaPreseleccionada || "", 
    tipo: tipoMovimiento || "ingreso", 
    monto: "", 
    concepto: "", 
    conceptoId: null as any, 
    detalle: "", 
    fecha: today, 
    unidadNegocio: "General" 
  });

  // Keep it sync if props change
  React.useEffect(() => {
    if (open) {
      setForm(prev => ({ 
        ...prev, 
        tipo: tipoMovimiento || "ingreso",
        cuentaId: cuentaPreseleccionada || prev.cuentaId
      }));
    }
  }, [open, tipoMovimiento, cuentaPreseleccionada]);

  const hora = () => { const n = new Date(); return n.getHours().toString().padStart(2, "0") + ":" + n.getMinutes().toString().padStart(2, "0"); };

  if (!open) return null;

  const guardarMov = () => {
    if (!form.cuentaId || !form.monto || !form.conceptoId) return;
    const monto = parseMoney(form.monto);
    const conceptoLabel = form.concepto + (form.detalle ? ` — ${form.detalle}` : "");
    const nuevaId = Date.now();
    const cId = parseInt(form.cuentaId);
    
    const mov = { id: nuevaId, cuentaId: cId, concepto: conceptoLabel, conceptoId: form.conceptoId, tipo: form.tipo, monto, fecha: form.fecha, hora: hora(), unidadNegocio: form.unidadNegocio || "General" };
    
    // Cloud Sync
    if (cloudSync?.executeCloudBatch) {
       const ops: any[] = [{ type: "set", collection: "movimientos", id: String(mov.id), data: mov }];
       const targetC = cuentas.find((c:any) => c.id === cId);
       if (targetC) {
          ops.push({ type: "set", collection: "cuentas", id: String(targetC.id), data: { ...targetC, saldo: form.tipo === "ingreso" ? targetC.saldo + monto : targetC.saldo - monto } });
       }
       cloudSync.executeCloudBatch(ops);
    } else if (cloudSync?.saveToCloud) {
       cloudSync.saveToCloud("movimientos", mov);
       const targetC = cuentas.find((c:any) => c.id === cId);
       if (targetC) {
         cloudSync.saveToCloud("cuentas", { ...targetC, saldo: form.tipo === "ingreso" ? targetC.saldo + monto : targetC.saldo - monto });
       }
    }

    setCuentas(cuentas.map((c: any) => c.id === cId ? { ...c, saldo: form.tipo === "ingreso" ? c.saldo + monto : c.saldo - monto } : c));
    setMovimientos([mov, ...movimientos]);
    if (marcarCierreAfectado) marcarCierreAfectado(form.fecha);
    setForm({ cuentaId: "", tipo: "ingreso", monto: "", concepto: "", conceptoId: null, detalle: "", unidadNegocio: "General", fecha: today }); 
    onClose();
  };

  return (
    <OverlaySheet open={open} onClose={() => { onClose(); setForm({ cuentaId: "", tipo: "ingreso", monto: "", concepto: "", conceptoId: null, detalle: "", unidadNegocio: "General", fecha: today }); }} title={form.tipo === "ingreso" ? "Registrar Ingreso" : "Registrar Gasto"} width={420}>
      <Fld label="Cuenta donde ingresa / egresa">
        <Sel value={form.cuentaId} onChange={(e: any) => setForm({ ...form, cuentaId: e.target.value })}>
          <option value="">Seleccionar cuenta...</option>
          {cuentas.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Sel>
      </Fld>
      <div style={{ display: "flex", gap: 12 }}>
        <Fld label="Monto" style={{ flex: 1 }}><InpMoney value={form.monto} onChange={(e: any) => setForm({ ...form, monto: e.target.value })} autoFocus /></Fld>
        <Fld label="Tipo" style={{ width: 120 }}>
          <Sel value={form.tipo} onChange={(e: any) => {
            const nextTipo = e.target.value;
            setForm({ ...form, tipo: nextTipo, concepto: "", conceptoId: null });
          }}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </Sel>
        </Fld>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Fld label={form.tipo === "ingreso" ? "Concepto de Ingreso" : "Concepto de Egreso"} style={{ flex: 2 }}>
          <Sel value={form.conceptoId || ""} onChange={(e: any) => {
            const val = e.target.value;
            if (!val) { setForm({ ...form, conceptoId: null, concepto: "" }); return; }
            const cObj = conceptos.find((x: any) => String(x.id) === val);
            if (cObj) setForm({ ...form, conceptoId: Number(val), concepto: cObj.nombre });
          }}>
            <option value="">Seleccionar...</option>
            {conceptos.filter((c: any) => c.tipo === form.tipo && c.activo).map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Sel>
        </Fld>
      </div>
      <Fld label="Detalle (Opcional)"><Inp value={form.detalle} onChange={(e: any) => setForm({ ...form, detalle: e.target.value })} placeholder="Ej: Honorarios mes en curso..." /></Fld>
      <div style={{ display: "flex", gap: 12 }}>
        <Fld label="Unidad de Negocio" half>
          <Sel value={form.unidadNegocio} onChange={(e: any) => setForm({ ...form, unidadNegocio: e.target.value })}>
            {(unidadesNegocio || UNIDADES_NEGOCIO).map((un: string) => <option key={un} value={un}>{un}</option>)}
          </Sel>
        </Fld>
        <Fld label="Fecha" half><Inp type="date" value={form.fecha} onChange={(e: any) => setForm({ ...form, fecha: e.target.value })} /></Fld>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn v="ghost" onClick={() => { onClose(); setForm({ cuentaId: "", tipo: "ingreso", monto: "", concepto: "", conceptoId: null, detalle: "", unidadNegocio: "General", fecha: today }); }} full>Cancelar</Btn>
        <Btn onClick={guardarMov} disabled={!form.cuentaId || !form.monto || !form.conceptoId} full><Ic n="check" s={14} />{form.tipo === "ingreso" ? "Reg. Ingreso" : "Reg. Gasto"}</Btn>
      </div>
    </OverlaySheet>
  );
}
