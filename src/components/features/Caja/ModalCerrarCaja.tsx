import React, { useState } from "react";
import { OverlaySheet, Fld, Inp, Btn, Ic } from "../../common/UIBase";
import { parseMoney } from "../../../lib/utils";

export default function ModalCerrarCaja({
  open,
  onClose,
  fechaPlanilla,
  totalIngreso,
  totalEgreso,
  resultado,
  saldoCajaReal,
  cuentasEnPatrimonio,
  clientes,
  facturas,
  pagos,
  proveedores,
  factProv,
  pagosProv,
  historialCierres,
  setHistorialCierres,
  cloudSync,
  t
}: any) {
  const [notaCierre, setNotaCierre] = useState("");

  if (!open) return null;

  const fmtMoney = (v: any) => "$" + (parseFloat(v)||0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <OverlaySheet open={open} onClose={() => { onClose(); setNotaCierre(""); }} title={`Cerrar caja — ${fechaPlanilla}`} width={500}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: t.surf2, padding: "16px", borderRadius: 8, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Ingresos del día</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.green }}>{fmtMoney(totalIngreso)}</div>
        </div>
        <div style={{ background: t.surf2, padding: "16px", borderRadius: 8, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Egresos del día</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.red }}>{fmtMoney(totalEgreso)}</div>
        </div>
        <div style={{ background: t.surf2, padding: "16px", borderRadius: 8, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Resultado</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: resultado >= 0 ? t.green : t.red }}>{fmtMoney(resultado)}</div>
        </div>
        <div style={{ background: t.surf2, padding: "16px", borderRadius: 8, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Saldo de caja</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#e87c00" }}>{fmtMoney(saldoCajaReal)}</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Saldo por cuenta operativa</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {cuentasEnPatrimonio.map((c: any) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 14, color: t.text }}>{c.nombre}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.tipo === "efectivo" ? "#a855f7" : "#3b82f6" }}>{fmtMoney(c.saldo)}</div>
            </div>
          ))}
        </div>
      </div>

      <Fld label="Nota (Opcional)"><Inp value={notaCierre} onChange={(e: any) => setNotaCierre(e.target.value)} placeholder="Observaciones del cierre..." /></Fld>
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <Btn v="ghost" onClick={() => { onClose(); setNotaCierre(""); }} full>Cancelar</Btn>
        <Btn onClick={() => {
          
          // Snapshot de saldos de clientes
          const saldosClientes: any = {};
          clientes.forEach((c: any) => {
            const ini = c.saldoInicial || 0;
            const movsFac = facturas.filter((f: any) => String(f.clienteId) === String(c.id) && !f.anulada && f.fecha <= fechaPlanilla).reduce((s: number, f: any) => f.tipo === "factura" ? s + f.total : s - f.total, 0);
            const movsPag = pagos.filter((p: any) => String(p.clienteId) === String(c.id) && !p.anulado && p.fecha <= fechaPlanilla).reduce((s: number, p: any) => s + p.monto, 0);
            const saldo = ini + movsFac - movsPag;
            if (Math.abs(saldo) > 0.01) saldosClientes[c.id] = saldo;
          });

          // Snapshot de saldos de proveedores
          const saldosProveedores: any = {};
          proveedores.forEach((p: any) => {
            const ini = p.saldoInicial || 0;
            const facs = factProv.filter((f: any) => f.proveedorId === p.id && !f.anulada && f.fecha <= fechaPlanilla).reduce((s: number, f: any) => (f.tipo === "factura" || f.tipo === "nd") ? s + (f.total || 0) : s - (f.total || 0), 0);
            const pags = pagosProv.filter((x: any) => x.proveedorId === p.id && !x.anulado && x.fecha <= fechaPlanilla).reduce((s: number, x: any) => s + (x.monto || 0), 0);
            const saldo = ini + facs - pags;
            if (Math.abs(saldo) > 0.01) saldosProveedores[p.id] = saldo;
          });

          const nuevo = { 
            id: Date.now(), 
            fecha: fechaPlanilla, 
            saldoActual: saldoCajaReal, 
            totalIngreso, 
            totalEgreso, 
            resultado, 
            nota: notaCierre, 
            cerradoEn: new Date().toISOString(),
            saldosClientes,
            saldosProveedores
          };
          // Persistir cierre en Firestore (crítico — sin esto onSnapshot lo borra)
          if (cloudSync?.saveToCloud) {
            cloudSync.saveToCloud("historialCierres", nuevo, String(nuevo.id));
          }
          setHistorialCierres([...historialCierres.filter((c: any) => c.fecha !== fechaPlanilla), nuevo]);
          setNotaCierre("");
          onClose();
        }} full><Ic n="check" s={14} />Confirmar cierre</Btn>
      </div>
    </OverlaySheet>
  );
}
