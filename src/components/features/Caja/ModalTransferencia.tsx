import React, { useState } from "react";
import { OverlaySheet, Fld, Inp, Sel, Btn, Ic, InpMoney } from "../../common/UIBase";
import { parseMoney, getToday } from "../../../lib/utils";

export default function ModalTransferencia({
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
  const [formT, setFormT] = useState({ origen: cuentaOrigenPreseleccionada || "", destino: "", monto: "", concepto: "", fecha: today });

  React.useEffect(() => {
    if (open) setFormT(prev => ({ ...prev, origen: cuentaOrigenPreseleccionada || prev.origen }));
  }, [open, cuentaOrigenPreseleccionada]);

  const hora = () => { const n = new Date(); return n.getHours().toString().padStart(2, "0") + ":" + n.getMinutes().toString().padStart(2, "0"); };

  const fmtMoney = (v: any) => "$" + (parseFloat(v)||0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!open) return null;

  const guardarTransf = () => {
    if (!formT.origen || !formT.destino || !formT.monto || formT.origen === formT.destino) return;
    const monto = parseMoney(formT.monto);
    const fecha = formT.fecha || today;
    const orig = cuentas.find((c: any) => c.id === parseInt(formT.origen));
    const dest = cuentas.find((c: any) => c.id === parseInt(formT.destino));
    
    setCuentas(cuentas.map((c: any) => { if (c.id === parseInt(formT.origen)) return { ...c, saldo: c.saldo - monto }; if (c.id === parseInt(formT.destino)) return { ...c, saldo: c.saldo + monto }; return c; }));
    
    const h = hora();
    const transExtrOut = { id: Date.now(), cuentaId: parseInt(formT.origen), concepto: `Transf. a ${dest?.nombre}${formT.concepto ? ` · ${formT.concepto}` : ""}`, tipo: "egreso", monto, fecha, hora: h };
    const transExtrIn = { id: Date.now() + 1, cuentaId: parseInt(formT.destino), concepto: `Transf. desde ${orig?.nombre}${formT.concepto ? ` · ${formT.concepto}` : ""}`, tipo: "ingreso", monto, fecha, hora: h };

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
       if (orig) cloudSync.saveToCloud("cuentas", { ...orig, saldo: orig.saldo - monto });
       if (dest) cloudSync.saveToCloud("cuentas", { ...dest, saldo: dest.saldo + monto });
    }

    if (marcarCierreAfectado) marcarCierreAfectado(fecha);
    setFormT({ origen: "", destino: "", monto: "", concepto: "", fecha: today }); 
    onClose();
  };

  return (
    <OverlaySheet open={open} onClose={() => { onClose(); setFormT({ origen: "", destino: "", monto: "", concepto: "", fecha: today }); }} title="Transferencia entre Cuentas" width={420}>
      <Fld label="Cuenta Origen (Descuenta)">
        <Sel value={formT.origen} onChange={(e: any) => setFormT({ ...formT, origen: e.target.value })}>
          <option value="">Seleccionar...</option>
          {cuentas.map((c: any) => <option key={c.id} value={c.id}>{c.nombre} (Saldo: {fmtMoney(c.saldo)})</option>)}
        </Sel>
      </Fld>
      <Fld label="Cuenta Destino (Ingresa)">
        <Sel value={formT.destino} onChange={(e: any) => setFormT({ ...formT, destino: e.target.value })}>
          <option value="">Seleccionar...</option>
          {cuentas.map((c: any) => <option key={c.id} value={c.id} disabled={formT.origen === String(c.id)}>{c.nombre} (Saldo: {fmtMoney(c.saldo)})</option>)}
        </Sel>
      </Fld>
      <div style={{ display: "flex", gap: 12 }}>
        <Fld label="Monto a transferir" half><InpMoney value={formT.monto} onChange={(e: any) => setFormT({ ...formT, monto: e.target.value })} /></Fld>
        <Fld label="Fecha" half><Inp type="date" value={formT.fecha} onChange={(e: any) => setFormT({ ...formT, fecha: e.target.value })} /></Fld>
      </div>
      <Fld label="Nota interna (Opcional)"><Inp value={formT.concepto} onChange={(e: any) => setFormT({ ...formT, concepto: e.target.value })} placeholder="Ej: Fondeo quincena" /></Fld>
      
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn v="ghost" onClick={() => { onClose(); setFormT({ origen: "", destino: "", monto: "", concepto: "", fecha: today }); }} full>Cancelar</Btn>
        <Btn onClick={guardarTransf} disabled={!formT.origen || !formT.destino || !formT.monto || formT.origen === formT.destino} full><Ic n="check" s={14} />Confirmar transf.</Btn>
      </div>
    </OverlaySheet>
  );
}
