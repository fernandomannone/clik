import React, { useState } from "react";
import { OverlaySheet, Fld, Inp, Sel, Btn, Ic, InpMoney } from "../../common/UIBase";
import { parseMoney, getToday } from "../../../lib/utils";

const CUENTA_COLORES = ["#f59e0b","#4f7cff","#a855f7","#22c55e","#14b8a6","#ef4444","#ec4899","#f97316"];
const CUENTA0 = { nombre: "", tipo: "banco", color: "#4f7cff", saldo: "", enPatrimonio: false, numeroCuenta: "", nroCuentaCorriente: "", alias: "", titular: "", tipoCuentaBancaria: "Caja de Ahorro", aliasImportacion: "" };

export default function ModalGestionCuentas({ 
  open, 
  onClose,
  cuentas, 
  setCuentas, 
  movimientos, 
  setMovimientos,
  cuentasPatrimonio,
  setCuentasPatrimonio,
  cloudSync,
  t,
  hora
}: any) {
  const [editandoCuenta, setEditandoCuenta] = useState<any>(null);
  const [formCuenta, setFormCuenta] = useState(CUENTA0);
  const [errElimCuenta, setErrElimCuenta] = useState("");

  if (!open) return null;

  const fmtMoney = (v: any) => "$" + (parseFloat(v)||0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = getToday();

  const abrirNuevaCuenta = () => { setFormCuenta({ ...CUENTA0, nombre: formCuenta?.nombre || "" }); setEditandoCuenta({ id: 0 }); };
  const abrirEditarCuenta = (c: any) => { setEditandoCuenta({ ...c }); }; 

  const guardarCuenta = () => {
    if (!formCuenta.nombre) return;
    if (editandoCuenta && editandoCuenta.id !== 0) {
      const nextCuenta = { ...editandoCuenta, nombre: formCuenta.nombre, tipo: formCuenta.tipo, color: formCuenta.color, numeroCuenta: formCuenta.numeroCuenta, nroCuentaCorriente: formCuenta.nroCuentaCorriente, alias: formCuenta.alias, titular: formCuenta.titular, tipoCuentaBancaria: formCuenta.tipoCuentaBancaria, aliasImportacion: formCuenta.aliasImportacion };
      setCuentas((prev: any[]) => prev.map(c => c.id === editandoCuenta.id ? nextCuenta : c));
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("cuentas", nextCuenta);
      setCuentasPatrimonio((prev: any[]) => {
        let next = prev;
        if (formCuenta.enPatrimonio && !prev.includes(editandoCuenta.id)) next = [...prev, editandoCuenta.id];
        else if (!formCuenta.enPatrimonio && prev.includes(editandoCuenta.id)) next = prev.filter(x => x !== editandoCuenta.id);
        try { localStorage.setItem("gp_cuentas_patrimonio", JSON.stringify(next)); } catch { }
        return next;
      });
    } else {
      const saldoInit = parseMoney(String(formCuenta.saldo)) || 0;
      const nuevaId = Date.now();
      const nuevaCuenta = { id: nuevaId, nombre: formCuenta.nombre, tipo: formCuenta.tipo, color: formCuenta.color, saldo: saldoInit, numeroCuenta: formCuenta.numeroCuenta, nroCuentaCorriente: formCuenta.nroCuentaCorriente, alias: formCuenta.alias, titular: formCuenta.titular, tipoCuentaBancaria: formCuenta.tipoCuentaBancaria, aliasImportacion: formCuenta.aliasImportacion };
      setCuentas((prev: any[]) => [...prev, nuevaCuenta]);
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("cuentas", nuevaCuenta);
      if (saldoInit > 0) {
        const movInit = { id: nuevaId + 1, cuentaId: nuevaId, concepto: "Saldo inicial", tipo: "ingreso", monto: saldoInit, fecha: today, hora: hora() };
        setMovimientos((prev: any[]) => [movInit, ...prev]);
        if (cloudSync?.saveToCloud) cloudSync.saveToCloud("movimientos", movInit);
      }
      if (formCuenta.enPatrimonio) {
        setCuentasPatrimonio((prev: any[]) => {
          const next = [...prev, nuevaId];
          try { localStorage.setItem("gp_cuentas_patrimonio", JSON.stringify(next)); } catch { }
          return next;
        });
      }
    }
    setEditandoCuenta(null);
  };
  
  const eliminarCuenta = (id: number) => {
    const stringId = String(id);
    const tieneMovsReales = movimientos.some((m: any) => String(m.cuentaId) === stringId && m.concepto !== "Saldo inicial");
    if (tieneMovsReales) { setErrElimCuenta("No se puede eliminar: la cuenta tiene movimientos registrados."); return; }
    setErrElimCuenta("");
    
    // Also remove the "Saldo inicial" movement if there is one
    const saldoInicialMov = movimientos.find((m: any) => String(m.cuentaId) === stringId && m.concepto === "Saldo inicial");
    if(saldoInicialMov && cloudSync?.deleteFromCloud) {
       cloudSync.deleteFromCloud("movimientos", String(saldoInicialMov.id));
    }
    if (cloudSync?.deleteFromCloud) cloudSync.deleteFromCloud("cuentas", stringId);

    setCuentas((prev: any[]) => prev.filter(c => String(c.id) !== stringId));
    setMovimientos((prev: any[]) => prev.filter(m => String(m.cuentaId) !== stringId));
    setCuentasPatrimonio((prev: any[]) => prev.filter(pid => String(pid) !== stringId));
  };

  return (
    <OverlaySheet open={open} onClose={() => { onClose(); setEditandoCuenta(null); }} title="Gestión de Cuentas" width={520}>
      {editandoCuenta ? (
        <div>
          <div style={{ display: "flex", gap: 12 }}>
            <Fld label="Nombre Cuenta" style={{ flex: 2 }}><Inp value={formCuenta.nombre} onChange={(e: any) => setFormCuenta({ ...formCuenta, nombre: e.target.value })} /></Fld>
            <Fld label="Tipo" style={{ flex: 1 }}>
              <Sel value={formCuenta.tipo} onChange={(e: any) => setFormCuenta({ ...formCuenta, tipo: e.target.value })}>
                <option value="caja">Caja Efectivo</option>
                <option value="banco">Cuenta Bancaria</option>
                <option value="inversion">Inversión / Billetera</option>
              </Sel>
            </Fld>
          </div>
          {formCuenta.tipo === "banco" && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <Fld label="Titular de Cuenta" half><Inp value={formCuenta.titular || ""} onChange={(e: any) => setFormCuenta({ ...formCuenta, titular: e.target.value })} placeholder="Ej: Juan Pérez" /></Fld>
                <Fld label="Tipo de Cuenta Bco." half>
                  <Sel value={formCuenta.tipoCuentaBancaria || "Caja de Ahorro"} onChange={(e: any) => setFormCuenta({ ...formCuenta, tipoCuentaBancaria: e.target.value })}>
                    <option value="Caja de Ahorro">Caja de Ahorro</option>
                    <option value="Cuenta Corriente">Cuenta Corriente</option>
                  </Sel>
                </Fld>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Fld label="CBU/CVU (22 dígitos)" half><Inp value={formCuenta.numeroCuenta || ""} onChange={(e: any) => setFormCuenta({ ...formCuenta, numeroCuenta: e.target.value })} placeholder="Ej: 03403004..." /></Fld>
                <Fld label="Alias" half><Inp value={formCuenta.alias || ""} onChange={(e: any) => setFormCuenta({ ...formCuenta, alias: e.target.value })} placeholder="Ej: mi.alias.banco" /></Fld>
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <Fld label="Nro de Cuenta Bancaria" half><Inp value={formCuenta.nroCuentaCorriente || ""} onChange={(e: any) => setFormCuenta({ ...formCuenta, nroCuentaCorriente: e.target.value })} placeholder="Ej: 123-456789/0" /></Fld>
                <div style={{ flex: 1 }} />
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            {editandoCuenta.id === 0 && <Fld label="Saldo Inicial" half><InpMoney value={formCuenta.saldo} onChange={(e: any) => setFormCuenta({ ...formCuenta, saldo: e.target.value })} /></Fld>}
            <Fld label="Color" half>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {CUENTA_COLORES.map(c => <div key={c} onClick={() => setFormCuenta({ ...formCuenta, color: c })} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: formCuenta.color === c ? `3px solid ${t.text}` : "none", cursor: "pointer" }} />)}
              </div>
            </Fld>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, marginTop: 10 }}>
            <input type="checkbox" checked={formCuenta.enPatrimonio} onChange={(e: any) => setFormCuenta({ ...formCuenta, enPatrimonio: e.target.checked })} />
            Incluir en Patrimonio Operativo
          </label>
          <div style={{ marginTop: 12 }}>
            <Fld label="Abreviaturas en Planilla Excel / Alias (Separados por coma)"><Inp value={formCuenta.aliasImportacion || ""} onChange={(e: any) => setFormCuenta({ ...formCuenta, aliasImportacion: e.target.value })} placeholder="Ej: CAJA, EFECTIVO, EFE" /></Fld>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn v="ghost" onClick={() => setEditandoCuenta(null)} full>Cancelar</Btn>
            <Btn onClick={guardarCuenta} disabled={!formCuenta.nombre} full><Ic n="check" s={14} />Guardar</Btn>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", background: t.surf2, padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Fld label="Nueva Cuenta" style={{ flex: 2 }}><Inp value={formCuenta.nombre || ""} onChange={(e: any) => setFormCuenta({ ...formCuenta, nombre: e.target.value })} /></Fld>
            <Fld label="Tipo" style={{ flex: 1 }}>
              <Sel value={formCuenta.tipo || "caja"} onChange={(e: any) => setFormCuenta({ ...formCuenta, tipo: e.target.value })}>
                <option value="caja">Caja Efectivo</option>
                <option value="banco">Cuenta Bancaria</option>
                <option value="inversion">Inversión / Billetera</option>
              </Sel>
            </Fld>
            <Btn onClick={abrirNuevaCuenta} style={{ marginBottom: 4 }} disabled={!formCuenta.nombre}><Ic n="plus" s={14} /> Agregar</Btn>
          </div>
          {errElimCuenta && <div style={{ fontSize: 12, color: t.red, marginBottom: 16 }}>{errElimCuenta}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto", marginBottom: 24 }}>
            {cuentas.map((c: any) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: t.surf2, borderRadius: 8, border: `1px solid ${c.color}55` }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: c.color }} />
                <div style={{ flex: 1, fontWeight: 600 }}>{c.nombre} <span style={{ fontSize: 11, color: t.muted }}>({c.tipo})</span></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.sub }}>{fmtMoney(c.saldo)}</div>
                <Btn v="ghost" onClick={() => { setFormCuenta({ nombre: c.nombre, tipo: c.tipo, color: c.color, saldo: "", enPatrimonio: cuentasPatrimonio.includes(c.id), numeroCuenta: c.numeroCuenta || "", nroCuentaCorriente: c.nroCuentaCorriente || "", alias: c.alias || "", titular: c.titular || "", tipoCuentaBancaria: c.tipoCuentaBancaria || "Caja de Ahorro" }); abrirEditarCuenta(c); }} style={{ padding: "4px 8px" }}><Ic n="edit" s={14} /></Btn>
                <Btn v="danger-ghost" onClick={() => eliminarCuenta(c.id)} style={{ padding: "4px 8px" }}><Ic n="delete" s={14} /></Btn>
              </div>
            ))}
          </div>
        </div>
      )}
    </OverlaySheet>
  );
}
