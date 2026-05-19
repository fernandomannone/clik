import React, { useState } from "react";
import { OverlaySheet, Fld, Inp, Sel, Btn, Ic, InpMoney } from "../../common/UIBase";
import { parseMoney, getToday } from "../../../lib/utils";

export default function ModalDeposito({
  open,
  onClose,
  cuentaOrigenPreseleccionada,
  cuentas,
  movimientos,
  setMovimientos,
  setCuentas,
  marcarCierreAfectado,
  cloudSync,
  t
}: any) {
  const today = getToday();
  const [formDeposito, setFormDeposito] = useState({ origen: cuentaOrigenPreseleccionada || "", destino: "", monto: "", concepto: "", fecha: today });

  React.useEffect(() => {
    if (open) setFormDeposito(prev => ({ ...prev, origen: cuentaOrigenPreseleccionada || prev.origen }));
  }, [open, cuentaOrigenPreseleccionada]);

  const hora = () => { const n = new Date(); return n.getHours().toString().padStart(2, "0") + ":" + n.getMinutes().toString().padStart(2, "0"); };

  const fmtMoney = (v: any) => "$" + (parseFloat(v)||0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!open) return null;

  const guardarDeposito = () => {
    if (!formDeposito.origen || !formDeposito.destino || !formDeposito.monto || formDeposito.origen === formDeposito.destino) return;
    const monto = parseMoney(formDeposito.monto);
    const fecha = formDeposito.fecha || today;
    const orig = cuentas.find((c: any) => c.id === parseInt(formDeposito.origen));
    const dest = cuentas.find((c: any) => c.id === parseInt(formDeposito.destino));
    
    setCuentas(cuentas.map((c: any) => { if (c.id === parseInt(formDeposito.origen)) return { ...c, saldo: c.saldo - monto }; if (c.id === parseInt(formDeposito.destino)) return { ...c, saldo: c.saldo + monto }; return c; }));
    
    const h = hora();
    const transExtrOut = { id: Date.now(), cuentaId: parseInt(formDeposito.origen), concepto: `Depósito en ${dest?.nombre}${formDeposito.concepto ? ` · ${formDeposito.concepto}` : ""}`, tipo: "egreso", monto, fecha, hora: h };
    const transExtrIn = { id: Date.now() + 1, cuentaId: parseInt(formDeposito.destino), concepto: `Depósito en efectivo desde ${orig?.nombre}${formDeposito.concepto ? ` · ${formDeposito.concepto}` : ""}`, tipo: "ingreso", monto, fecha, hora: h };
    
    setMovimientos([transExtrOut, transExtrIn, ...movimientos]);

    if(cloudSync?.executeCloudBatch) {
       const ops = [
         { type: "set", collection: "movimientos", id: String(transExtrOut.id), data: transExtrOut },
         { type: "set", collection: "movimientos", id: String(transExtrIn.id), data: transExtrIn },
       ];
       if (orig) ops.push({ type: "set", collection: "cuentas", id: String(orig.id), data: { ...orig, saldo: orig.saldo - monto } });
       if (dest) ops.push({ type: "set", collection: "cuentas", id: String(dest.id), data: { ...dest, saldo: dest.saldo + monto } });
       cloudSync.executeCloudBatch(ops);
    } else if (cloudSync?.saveToCloud) {
       cloudSync.saveToCloud("movimientos", transExtrOut);
       cloudSync.saveToCloud("movimientos", transExtrIn);
       if(orig) cloudSync.saveToCloud("cuentas", { ...orig, saldo: orig.saldo - monto });
       if(dest) cloudSync.saveToCloud("cuentas", { ...dest, saldo: dest.saldo + monto });
    }

    if (marcarCierreAfectado) marcarCierreAfectado(fecha);
    setFormDeposito({ origen: "", destino: "", monto: "", concepto: "", fecha: today }); 
    onClose();
  };

  return (
    <OverlaySheet open={open} onClose={() => { onClose(); setFormDeposito({ origen: "", destino: "", monto: "", concepto: "", fecha: today }); }} title="Depósito en banco" width={420}>
      <Fld label="Caja origen (Efectivo)">
        <Sel value={formDeposito.origen} onChange={(e: any) => setFormDeposito({ ...formDeposito, origen: e.target.value })}>
          <option value="">Seleccionar caja de origen...</option>
          {cuentas.filter((c: any) => c.tipo === "caja").map((c: any) => <option key={c.id} value={c.id}>{c.nombre} (Saldo: {fmtMoney(c.saldo)})</option>)}
        </Sel>
      </Fld>
      <Fld label="Banco destino">
        <Sel value={formDeposito.destino} onChange={(e: any) => setFormDeposito({ ...formDeposito, destino: e.target.value })}>
          <option value="">Seleccionar banco...</option>
          {cuentas.filter((c: any) => c.tipo === "banco").map((c: any) => <option key={c.id} value={c.id}>{c.nombre} (Saldo: {fmtMoney(c.saldo)})</option>)}
        </Sel>
      </Fld>
      <div style={{ display: "flex", gap: 12 }}>
        <Fld label="Monto depositado" half><InpMoney value={formDeposito.monto} onChange={(e: any) => setFormDeposito({ ...formDeposito, monto: e.target.value })} /></Fld>
        <Fld label="Fecha" half><Inp type="date" value={formDeposito.fecha} onChange={(e: any) => setFormDeposito({ ...formDeposito, fecha: e.target.value })} /></Fld>
      </div>
      <Fld label="Nota interna (Opcional)"><Inp value={formDeposito.concepto} onChange={(e: any) => setFormDeposito({ ...formDeposito, concepto: e.target.value })} placeholder="Nro de comprobante..." /></Fld>
      
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn v="ghost" onClick={() => { onClose(); setFormDeposito({ origen: "", destino: "", monto: "", concepto: "", fecha: today }); }} full>Cancelar</Btn>
        <Btn onClick={guardarDeposito} disabled={!formDeposito.origen || !formDeposito.destino || !formDeposito.monto || formDeposito.origen === formDeposito.destino} full><Ic n="check" s={14} />Confirmar depósito</Btn>
      </div>
    </OverlaySheet>
  );
}
