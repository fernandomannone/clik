import React, { useState } from "react";
import { OverlaySheet, Fld, Inp, Sel, Btn, Ic, InpMoney } from "../../common/UIBase";
import { parseMoney, getToday } from "../../../lib/utils";

export default function ModalPagoProveedorCaja({
  open,
  onClose,
  cuentaOrigenPreseleccionada,
  cuentas,
  proveedores,
  pagosProv,
  setPagosProv,
  movimientos,
  setMovimientos,
  setCuentas,
  marcarCierreAfectado,
  cloudSync,
  t
}: any) {
  const today = getToday();
  const [formPP, setFormPP] = useState({ proveedorId: "", cuentaId: cuentaOrigenPreseleccionada || "", monto: "", obs: "", fecha: today, _bancoId: "" });

  React.useEffect(() => {
    if (open) setFormPP(prev => ({ ...prev, cuentaId: cuentaOrigenPreseleccionada || prev.cuentaId }));
  }, [open, cuentaOrigenPreseleccionada]);

  const hora = () => { const n = new Date(); return n.getHours().toString().padStart(2, "0") + ":" + n.getMinutes().toString().padStart(2, "0"); };

  const fmtMoney = (v: any) => "$" + (parseFloat(v)||0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!open) return null;

  const guardarPagoProv = () => {
    if (!formPP.proveedorId || !formPP.cuentaId || !formPP.monto) return;
    const prov = proveedores.find((p: any) => p.id === parseInt(formPP.proveedorId));
    if (!prov) return;
    const monto = parseMoney(formPP.monto);
    if(monto <= 0) return;
    const cId = parseInt(formPP.cuentaId);
    const cuenta = cuentas.find((c: any) => c.id === cId);
    const h = hora();
    const pagoId = Date.now();
    
    const nuevoPago = {
      id: pagoId,
      proveedorId: prov.id,
      tipo: (cuenta && (cuenta.tipo === "banco" || cuenta.tipo === "inversion")) ? "Transferencia" : "Efectivo",
      monto,
      fecha: formPP.fecha || today,
      hora: h,
      obs: formPP.obs || "",
      anulado: false,
      cuentaId: cId
    };

    const mov = { 
      id: pagoId + 1, 
      cuentaId: cId, 
      concepto: `Pago proveedor — ${prov.nombre}${formPP.obs ? ` · ${formPP.obs}` : ""}`, 
      tipo: "egreso", 
      monto, 
      fecha: nuevoPago.fecha, 
      hora: h, 
      pagoProvId: pagoId 
    };

    if(cloudSync?.executeCloudBatch) {
      const ops = [
        { type: "set", collection: "pagosProv", id: String(nuevoPago.id), data: nuevoPago },
        { type: "set", collection: "movimientos", id: String(mov.id), data: mov }
      ];
      if(cuenta) {
        ops.push({ type: "set", collection: "cuentas", id: String(cuenta.id), data: { ...cuenta, saldo: cuenta.saldo - monto } });
      }
      cloudSync.executeCloudBatch(ops);
    } else if (cloudSync?.saveToCloud) {
      cloudSync.saveToCloud("pagosProv", nuevoPago);
      cloudSync.saveToCloud("movimientos", mov);
      if(cuenta) cloudSync.saveToCloud("cuentas", { ...cuenta, saldo: cuenta.saldo - monto });
    }

    setPagosProv([...pagosProv, nuevoPago]);
    setMovimientos([mov, ...movimientos]);
    setCuentas(cuentas.map((c: any) => c.id === cId ? { ...c, saldo: c.saldo - monto } : c));
    if (marcarCierreAfectado) marcarCierreAfectado(formPP.fecha);

    setFormPP({ proveedorId: "", cuentaId: "", monto: "", obs: "", fecha: today, _bancoId: "" });
    onClose();
  };

  return (
    <OverlaySheet open={open} onClose={() => { onClose(); setFormPP({ proveedorId: "", cuentaId: "", monto: "", obs: "", fecha: today, _bancoId: "" }); }} title="Registrar Pago a Proveedor" width={440}>
      <Fld label="Proveedor">
        <Sel value={formPP.proveedorId} onChange={(e: any) => setFormPP({ ...formPP, proveedorId: e.target.value })}>
          <option value="">Seleccionar...</option>
          {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Sel>
      </Fld>
      <div style={{ display: "flex", gap: 12 }}>
        <Fld label="Cuenta de Pago" style={{ flex: 2 }}>
          <Sel value={formPP.cuentaId} onChange={(e: any) => setFormPP({ ...formPP, cuentaId: e.target.value })}>
            <option value="">Seleccionar cuenta...</option>
            {cuentas.map((c: any) => <option key={c.id} value={c.id}>{c.nombre} (Disp: {fmtMoney(c.saldo)})</option>)}
          </Sel>
        </Fld>
        <Fld label="Monto" style={{ flex: 1 }}><InpMoney value={formPP.monto} onChange={(e: any) => setFormPP({ ...formPP, monto: e.target.value })} autoFocus /></Fld>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Fld label="Fecha de Pago" half><Inp type="date" value={formPP.fecha} onChange={(e: any) => setFormPP({ ...formPP, fecha: e.target.value })} /></Fld>
        <div style={{ flex: 1 }}></div>
      </div>
      <Fld label="Observaciones (Opcional)"><Inp value={formPP.obs} onChange={(e: any) => setFormPP({ ...formPP, obs: e.target.value })} placeholder="Dato del comprobante, etc." /></Fld>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn v="ghost" onClick={() => { onClose(); setFormPP({ proveedorId: "", cuentaId: "", monto: "", obs: "", fecha: today, _bancoId: "" }); }} full>Cancelar</Btn>
        <Btn onClick={guardarPagoProv} disabled={!formPP.proveedorId || !formPP.cuentaId || !formPP.monto} full><Ic n="check" s={14} />Registrar Pago</Btn>
      </div>
    </OverlaySheet>
  );
}
