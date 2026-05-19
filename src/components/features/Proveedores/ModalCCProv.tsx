import React, { useState, Fragment } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Fld, Inp, Sel, Btn, Ic, Avatar, InpMoney, BtnEliminarConClave, Tbl, Tr, Td, OverlaySheet } from "../../common/UIBase";
import { fmtMoney, fmtFechaCC, parseMoney, getToday } from "../../../lib/utils";
import { exportarAExcel } from "../../../lib/excelExport";
import FacturaVistaPrevia from "../Facturas/FacturaVistaPrevia";

const today = getToday();

export function ModalCCProv({ proveedor, onClose, ccProv, saldoProv, factProv, setFactProv, pagosProv, setPagosProv, cuentas, setCuentas, user, onEditFactura, setMovimientos, movimientos, cloudSync, clientes, pagos, setPagos, proveedores }: any) {
  const { t } = useApp();

  const exportarExcel = () => {
    const filas = [...filtrados].reverse().map((m: any, i: number) => {
      const idxCrono = filtrados.length - 1 - i;
      const saldoAcum = saldoAnterior + filtrados.slice(0, idxCrono + 1).reduce((s: number, x: any) => {
        const tot = Math.abs(parseFloat(x.total) || 0);
        return (x.tipo === "factura" || x.tipo === "nd") ? s - tot : s + tot;
      }, 0);
      
      const vDebe = (m.tipo === "pago" || m.tipo === "nc") ? (m.total || m.monto || 0) : 0;
      const vHaber = (m.tipo === "factura" || m.tipo === "nd") ? (m.total || m.monto || 0) : 0;

      const rawNumStr = m.numero || `PAG-${String(m.id).slice(-6)}`;
      let numStr = String(rawNumStr).trim();
      if (numStr.startsWith("PAG-")) numStr = numStr.replace("PAG-", "");
      if (numStr.startsWith("NC-SEAC-")) numStr = numStr.split("-").pop() || numStr;
      if (numStr.includes("-")) {
        const p = numStr.split("-");
        p[1] = p[1].replace(/^0+/, "") || "0";
        numStr = p.join("-");
      } else {
        numStr = numStr.replace(/^0+/, "") || "0";
      }

      let conceptoStr = "";
      if (m.tipo === "factura") conceptoStr = `COMPRA ${m.letra || "A"} ${numStr}`;
      else if (m.tipo === "nc") conceptoStr = `NC PROV ${m.letra || "A"} ${numStr}`;
      else if (m.tipo === "nd") conceptoStr = `ND PROV ${m.letra || "A"} ${numStr}`;
      else if (m.tipo === "pago") conceptoStr = `PAGO ${numStr}`;

      if (m.obs) conceptoStr += ` (${m.obs})`;

      return [
        m.fecha,
        conceptoStr,
        vDebe !== 0 ? vDebe : "",
        vHaber !== 0 ? vHaber : "",
        Math.abs(saldoAcum)
      ];
    });

    exportarAExcel({
      titulo: `CC Proveedor — ${proveedor.nombre}`,
      columnas: ["Fecha", "Concepto", "Debe", "Haber", "Saldo"],
      filas: filas,
      fileName: `CC_${proveedor.nombre}_${today}.xlsx`,
      sheetName: "CC"
    });
  };
  const todosMovsProv = ccProv(proveedor.id);
  const primerMov = todosMovsProv.length
    ? todosMovsProv.reduce((min: any, m: any) => (!min || m.fecha < min) ? m.fecha : min, null) || today.slice(0, 7) + "-01"
    : today.slice(0, 7) + "-01";
  
  const fechaIniProv = proveedor.fechaSaldoInicial || null;
  const [desde, setDesde] = useState(fechaIniProv || primerMov);
  const [hasta, setHasta] = useState(today);
  const [editandoFac, setEditandoFac] = useState<any>(null);
  const [vistaPreviaFactura, setVistaPreviaFactura] = useState<any>(null);
  const [formFac, setFormFac] = useState<any>({});
  const formFacRef = React.useRef<any>({});

  const setFormFacAndRef = (v: any) => { formFacRef.current = v; setFormFac(v); };
  const [confirmarGuardarFac, setConfirmarGuardarFac] = useState(false);

  const abrirEditarFac = (f: any, e?: any) => {
    if (e) e.stopPropagation();
    if (f.tipo !== "pago" && onEditFactura) {
      onEditFactura(f);
      return;
    }
    const fv = {
      numero: f.numero, total: String(f.total), fecha: f.fecha,
      condPago: f.condPago || "30 Días", obs: f.obs || "",
      items: (f.items || []).map((i: any) => ({ ...i, cantidad: String(i.cantidad || 1), precio: String(i.precio || 0), costoUnit: String(i.costoUnit || i.precio || 0) }))
    };
    setFormFacAndRef(fv);
    setEditandoFac(f);
  };

  const parseCant = (v: any) => {
    if (v === null || v === undefined || v === "") return 0;
    const s = String(v).trim();
    if (s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    return parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  };

  const guardarFac = () => {
    const fv = formFacRef.current;
    
    if (editandoFac.tipo === "pago") {
      const nuevoTotal = parseMoney(fv.total) || editandoFac.total;
      const nuevaFecha = (fv.fecha !== undefined && fv.fecha !== "") ? fv.fecha : editandoFac.fecha;
      const nuevoObs = fv.obs || editandoFac.obs || "";
      
      setPagosProv((prev: any[]) => prev.map(p => {
        if (p.id !== editandoFac.id) return p;
        return { ...p, monto: nuevoTotal, fecha: nuevaFecha, obs: nuevoObs };
      }));
      
      if (setMovimientos) {
        setMovimientos((prev: any[]) => prev.map(m => {
          if (m.pagoProvId !== editandoFac.id) return m;
          return { ...m, monto: nuevoTotal, fecha: nuevaFecha };
        }));
      }
    } else {
      const itemsGuardar = (fv.items || []).map((i: any) => ({ ...i, cantidad: parseCant(i.cantidad) || 1, precio: parseMoney(i.precio) || 0, costoUnit: parseMoney(i.costoUnit) || parseMoney(i.precio) || 0 }));
      const totalCalc = itemsGuardar.length > 0 ? itemsGuardar.reduce((s: number, i: any) => s + (parseMoney(i.precio) || 0) * (i.cantidad || 1), 0) : parseMoney(fv.total) || editandoFac.total;
      
      const nuevoTotal = totalCalc;
      const nuevaFecha = (fv.fecha !== undefined && fv.fecha !== "") ? fv.fecha : editandoFac.fecha;

      setFactProv((prev: any[]) => prev.map(f => f.id === editandoFac.id ? { ...f, ...fv, fecha: nuevaFecha, total: nuevoTotal, items: itemsGuardar.length ? itemsGuardar : f.items } : f));
      
      if (setPagosProv && nuevaFecha !== editandoFac.fecha) {
        setPagosProv((prev: any[]) => prev.map(p => p.factProvId === editandoFac.id ? { ...p, fecha: nuevaFecha } : p));
      }
    }
    
    setEditandoFac(null);
    setConfirmarGuardarFac(false);
  };

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const todos = ccProv(proveedor.id).sort((a: any, b: any) => (a.fecha || "").localeCompare(b.fecha || ""));
  const filtrados = todos.filter((m: any) => m.fecha >= desde && m.fecha <= hasta);
  
  const _iniProv = proveedor.saldoInicial || 0;
  const _fechaIniProv = proveedor.fechaSaldoInicial || null;
  const _iniAplicaProv = !_fechaIniProv || _fechaIniProv <= hasta;

  const saldoAnterior = (_iniAplicaProv && (!_fechaIniProv || _fechaIniProv <= desde) ? _iniProv : 0)
    + todos.filter((m: any) => m.fecha < desde && (!_fechaIniProv || m.fecha >= _fechaIniProv)).reduce((s: number, m: any) => {
      const tot = Math.abs(parseFloat(m.total) || 0);
      return (m.tipo === "factura" || m.tipo === "nd") ? s - tot : s + tot;
    }, 0);

  const saldoReal = saldoProv(proveedor.id);

  return (
    <OverlaySheet open={true} onClose={onClose} title={`Cuenta Corriente: ${proveedor.nombre}`} width="1000px" sub={
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
        <span style={{ color: "#FFF", fontWeight: 700 }}>
          Saldo Actual: {fmtMoney(Math.abs(saldoReal))} {saldoReal > 0 ? "(Debés)" : "(A favor)"}
        </span>
        <Btn v="ghost" onClick={exportarExcel} style={{ padding: "4px 8px", fontSize: 11, background: "rgba(255,255,255,0.2)", color: "#fff" }} title="Exportar"><Ic n="transfer" s={12}/></Btn>
      </div>
    }>
      <div style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ marginBottom: 16, padding: "14px 16px", background: t.surf2, borderRadius: 10, border: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <Fld label="Desde" half><Inp type="date" value={desde} onChange={(e: any) => setDesde(e.target.value)} /></Fld>
          <Fld label="Hasta" half><Inp type="date" value={hasta} onChange={(e: any) => setHasta(e.target.value)} /></Fld>
        </div>
      </div>

      <Tbl stickyTop={false} headers={["Fecha", "Concepto", "Debe", "Haber", "Saldo", ""]}>
        {[...filtrados].reverse().map((m: any, i: number) => {
          const idxCrono = filtrados.length - 1 - i;
          const saldoAcum = saldoAnterior + filtrados.slice(0, idxCrono + 1).reduce((s: number, x: any) => {
            const tot = Math.abs(parseFloat(x.total) || parseFloat(x.monto) || 0);
            return (x.tipo === "factura" || x.tipo === "nd") ? s - tot : s + tot;
          }, 0);

          const rawNumStr = m.numero || `PAG-${String(m.id).slice(-6)}`;
          let numStr = String(rawNumStr).trim();
          if (numStr.startsWith("PAG-")) numStr = numStr.replace("PAG-", "");
          if (numStr.startsWith("NC-SEAC-")) numStr = numStr.split("-").pop() || numStr;
          if (numStr.includes("-")) {
            const p = numStr.split("-");
            p[1] = p[1].replace(/^0+/, "") || "0";
            numStr = p.join("-");
          } else {
            numStr = numStr.replace(/^0+/, "") || "0";
          }

          let conceptoLargo = "";
          if (m.tipo === "factura") conceptoLargo = `COMPRA ${m.letra || "A"} ${numStr}`;
          else if (m.tipo === "nc") conceptoLargo = `NC ${m.letra || "A"} ${numStr}`;
          else if (m.tipo === "nd") conceptoLargo = `ND ${m.letra || "A"} ${numStr}`;
          else if (m.tipo === "pago") conceptoLargo = `PAGO ${numStr}`;

          let obsLimpia = (m.obs || "").trim();
          if (proveedor?.nombre) {
            let rgx = new RegExp(`Pago proveedor [—-] ?${proveedor.nombre}`, 'i');
            obsLimpia = obsLimpia.replace(rgx, '').trim();
            rgx = new RegExp(`Pago proveedor [—-] ?RGP - SEAC`, 'i'); // Hardcoded in case they differ slightly
            obsLimpia = obsLimpia.replace(rgx, '').trim();
          }
          
          obsLimpia = obsLimpia.replace(/Cobro cliente/i, 'Cobro').trim();
          
          // Limpiar prefijo 'SEAC DD/MM/YYYY — NC automática'
          obsLimpia = obsLimpia.replace(/SEAC \d{2}\/\d{2}\/\d{4} [—-]\s*/i, '').trim();
          obsLimpia = obsLimpia.replace(/Factura SEAC \d{2}\/\d{2}\/\d{4}/i, 'Factura Automática').trim();
          
          if (obsLimpia === "Pago proveedor" || obsLimpia === "Pago") obsLimpia = "";

          let cuentaNombre = "";
          if (m.tipo === "pago" && m.cuentaId) {
            const cta = cuentas?.find((c: any) => c.id === m.cuentaId);
            if (cta) cuentaNombre = cta.nombre;
          }

          let observacionSecundaria = "";
          if (cuentaNombre) {
             observacionSecundaria = `${cuentaNombre}${obsLimpia ? " - " + obsLimpia.replace(/^[-—·\s]+|[-—·\s]+$/g, '') : ""}`;
          } else if (obsLimpia && obsLimpia !== "Contado") {
             observacionSecundaria = obsLimpia.replace(/^[-—·\s]+|[-—·\s]+$/g, '');
          }

          const isFactura = m.tipo === "factura" || m.tipo === "nc" || m.tipo === "nd";
          const canViewCosts = user?.rol === "maestro" || user?.permisos?.costos === true;
          const esDesdeRecibo = m.tipo === "pago" && (m._desdeRecibo || m.grupoId || m.reciboId);

          return (
            <Fragment key={m.id}>
              <Tr style={{ cursor: (isFactura && canViewCosts) ? "pointer" : "default" }} onClick={(e: any) => { if (isFactura && canViewCosts) setVistaPreviaFactura(m); }}>
                <Td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{fmtFechaCC(m.fecha)}</Td>
                <Td style={{ padding: "8px 12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                      {conceptoLargo}
                    </div>
                    {observacionSecundaria && (
                      <div style={{ fontSize: 11, color: t.muted, fontWeight: 500, lineHeight: 1.2 }}>{observacionSecundaria}</div>
                    )}
                  </div>
                </Td>
                <Td style={{ padding: "8px 12px", textAlign: "right", color: t.green }}>{(m.tipo === "pago" || m.tipo === "nc") ? fmtMoney(Math.abs(m.total || m.monto || 0)) : ""}</Td>
                <Td style={{ padding: "8px 12px", textAlign: "right", color: t.red }}>{(m.tipo === "factura" || m.tipo === "nd") ? fmtMoney(Math.abs(m.total || m.monto || 0)) : ""}</Td>
                <Td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: saldoAcum > 0 ? t.green : saldoAcum < 0 ? t.red : t.sub }}>{fmtMoney(Math.abs(saldoAcum))}</Td>
                <Td style={{ padding: "8px 12px" }}>
                   <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                     {esDesdeRecibo ? (
                       <div style={{ color: t.muted, padding: "4px 8px", cursor: "help", display: "inline-flex", alignItems: "center" }} title="Cobro de Cliente: Editar o borrar desde la Cuenta Corriente del Cliente para mantener la consistencia de caja.">
                         <Ic n="lock" s={14} />
                       </div>
                     ) : (isFactura && canViewCosts) ? (
                       <Btn v="ghost" onClick={(e: any) => { e.stopPropagation(); setVistaPreviaFactura(m); }} style={{ padding: "4px 8px" }} title="Ver Comprobante"><Ic n="eye" s={13} /></Btn>
                     ) : (
                       <Btn v="ghost" onClick={(e: any) => abrirEditarFac(m, e)} style={{ padding: "4px 8px" }} title="Editar"><Ic n="edit" s={13} /></Btn>
                     )}
                   </div>
                </Td>
              </Tr>
            </Fragment>
          );
        })}
      </Tbl>

      {vistaPreviaFactura && (
        <FacturaVistaPrevia
          facturas={factProv || []}
          letra={vistaPreviaFactura.letra}
          tipoComp={vistaPreviaFactura.tipo}
          editando={vistaPreviaFactura}
          fecha={vistaPreviaFactura.fecha}
          cliente={proveedor}
          condPago={vistaPreviaFactura.condPago}
          items={vistaPreviaFactura.items || []}
          descGlobal={vistaPreviaFactura.descGlobal}
          descMonto={vistaPreviaFactura.descMonto}
          total={vistaPreviaFactura.total || vistaPreviaFactura.monto}
          setVistaPrevia={setVistaPreviaFactura}
          soloLectura={true}
          onEdit={(m: any) => {
            setVistaPreviaFactura(null);
            abrirEditarFac(m, { stopPropagation: () => {} });
          }}
        />
      )}

      {editandoFac && (
        <OverlaySheet open={true} onClose={() => setEditandoFac(null)} title="Editar comprobante" width={600}>
          <Fld label="Número"><Inp value={formFac.numero} onChange={(e: any) => setFormFacAndRef({ ...formFac, numero: e.target.value })} /></Fld>
          {editandoFac.tipo === "pago" && (
              <Fld label="Cuenta Relacionada (opcional)">
                <Sel value={formFac.cuentaId || ""} onChange={(e:any) => setFormFacAndRef({...formFac, cuentaId: e.target.value})}>
                  <option value="">(Ninguna)</option>
                  {cuentas?.map((c:any)=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                </Sel>
              </Fld>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <Fld label="Fecha" half><Inp type="date" value={formFac.fecha} onChange={(e: any) => setFormFacAndRef({ ...formFac, fecha: e.target.value })} /></Fld>
            <Fld label="Total" half><InpMoney value={formFac.total} onChange={(e: any) => setFormFacAndRef({ ...formFac, total: e.target.value })} /></Fld>
          </div>
          <Fld label="Observaciones"><Inp value={formFac.obs} onChange={(e: any) => setFormFacAndRef({ ...formFac, obs: e.target.value })} /></Fld>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <Btn v="ghost" onClick={() => setEditandoFac(null)} full>Cancelar</Btn>
            <BtnEliminarConClave onConfirm={async () => {
              if (editandoFac.tipo === "pago") {
                let accountToUpdate: any = null;
                const mIdABorrar = movimientos?.find((m:any) => String(m.pagoProvId) === String(editandoFac.id))?.id;
                
                const batchOps: any[] = [];
                batchOps.push({ type: "delete", collection: "pagosProv", id: String(editandoFac.id) });
                if (mIdABorrar) batchOps.push({ type: "delete", collection: "movimientos", id: String(mIdABorrar) });
                
                if (editandoFac.cuentaId && cuentas) {
                   const c = cuentas.find((cx:any) => String(cx.id) === String(editandoFac.cuentaId));
                   if (c) {
                      accountToUpdate = { ...c, saldo: c.saldo + (editandoFac.total || editandoFac.monto || 0) };
                      batchOps.push({ type: "set", collection: "cuentas", id: String(c.id), data: accountToUpdate });
                   }
                }

                if (cloudSync?.executeCloudBatch) {
                    const ext = await cloudSync.executeCloudBatch(batchOps);
                    if (!ext) {
                        alert("Error de red: no se pudo borrar el pago.");
                        return;
                    }
                } else {
                    if (cloudSync?.deleteFromCloud) {
                       cloudSync.deleteFromCloud("pagosProv", String(editandoFac.id));
                       if(mIdABorrar) cloudSync.deleteFromCloud("movimientos", String(mIdABorrar));
                    }
                    if (accountToUpdate && cloudSync?.saveToCloud) cloudSync.saveToCloud("cuentas", accountToUpdate);
                }

                setPagosProv((prev: any[]) => prev.filter((p:any) => p.id !== editandoFac.id));
                if (setMovimientos) {
                   setMovimientos((prev: any[]) => prev.filter((m:any) => String(m.pagoProvId) !== String(editandoFac.id)));
                }
                if (setCuentas && accountToUpdate) {
                   setCuentas((prev: any[]) => prev.map((c:any) => String(c.id) === String(accountToUpdate.id) ? accountToUpdate : c));
                }
              } else {
                if (cloudSync?.deleteFromCloud) cloudSync.deleteFromCloud("factProv", String(editandoFac.id));
                setFactProv((prev: any[]) => prev.filter((f:any) => f.id !== editandoFac.id));
              }
              setEditandoFac(null);
            }} />
            <Btn onClick={guardarFac} full>Guardar cambios</Btn>
          </div>
        </OverlaySheet>
      )}
    </div>
    </OverlaySheet>
  );
}
