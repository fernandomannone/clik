import React, { useState, useMemo, useRef, Fragment } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Tbl, Tr, Td, Bdg, Btn, Ic, Fld, Inp, Sel, InpMoney, BtnEliminarConClave, OverlaySheet } from "../../common/UIBase";
import { fmtMoney, fmtFechaCC, parseMoney } from "../../../lib/utils";
import { ModalEditCobroCompuesto } from "./ModalEditCobroCompuesto";
import { exportarAExcel } from "../../../lib/excelExport";
import { buildCcLineas } from "../../../lib/clientes/calculosSaldos";
import FacturaVistaPrevia from "../Facturas/FacturaVistaPrevia";

export default function ModalCC({ cliente, clientes, onClose, ccCliente, saldoCliente, pagos, setPagos, facturas, setFacturas, cuentas, setCuentas, movimientos, setMovimientos, pagosProv, setPagosProv, user, articulos, editarReciboUnif, eliminarReciboUnif, proveedores, onEditFactura, cloudSync }: any) {
  const { t } = useApp();
  const movs = useMemo(() => {
    const raw = ccCliente(cliente.id);
    return buildCcLineas(cliente, raw);
  }, [cliente.id, ccCliente, facturas, pagos]);

  const saldoActual = saldoCliente(cliente.id);

  const [editando, setEditando] = useState<any>(null);
  const [vistaPreviaFactura, setVistaPreviaFactura] = useState<any>(null);
  const [formEdit, setFormEdit] = useState<any>({});
  const formRef = useRef<any>({});

  const setFormVals = (v: any) => { formRef.current = v; setFormEdit(v); };

  const abrirEditar = (m: any, e: any) => {
    e.stopPropagation();
    if (m.tipo !== "recibo" && m.tipo !== "pago" && onEditFactura) {
      onEditFactura(m);
      return;
    }
    setFormVals({
      numero: m.numero || "",
      fecha: m.fecha,
      total: String(m.total || m.monto),
      obs: m.obs || "",
      destinoId: m.cuentaId ? `C_${m.cuentaId}` : m.proveedorId ? `P_${m.proveedorId}` : ""
    });
    setEditando(m);
  };

  const guardarCambios = () => {
    const fv = formRef.current;
    const nuevoTotal = parseMoney(fv.total) || editando.total || editando.monto;
    const nuevaFecha = (fv.fecha !== undefined && fv.fecha !== "") ? fv.fecha : editando.fecha;
    const nuevoObs = fv.obs || editando.obs || "";

    if (editando.tipo === "recibo") {
      const nuevaCuentaId = fv.destinoId?.startsWith("C_") ? parseInt(fv.destinoId.replace("C_", "")) : null;
      const nuevoProvId = fv.destinoId?.startsWith("P_") ? parseInt(fv.destinoId.replace("P_", "")) : null;

      const batchOps: any[] = [];
      const isChangedDestino = editando.cuentaId !== nuevaCuentaId || editando.proveedorId !== nuevoProvId;

      const updatedPago = { ...editando, monto: nuevoTotal, fecha: nuevaFecha, obs: nuevoObs, cuentaId: nuevaCuentaId, proveedorId: nuevoProvId };
      batchOps.push({ type: "set", collection: "pagos", id: String(updatedPago.id), data: updatedPago });

      setPagos((prev: any[]) => prev.map(p => {
        if (p.id !== editando.id) return p;
        return updatedPago;
      }));

      if (setMovimientos) {
        setMovimientos((prev: any[]) => {
          let resto = prev;
          const existiaDirecto = prev.some(m => m.reciboId === editando.id);
          const movDirecto = prev.find(m => m.reciboId === editando.id);

          // Si es parte de un agrupado (vendedores) y no tenía un mov directo:
          if (!existiaDirecto && editando.grupoId) {
             resto = resto.map(m => {
               if (m.grupoId === editando.grupoId && m.reciboId == null && m.cuentaId === editando.cuentaId && m.tipo === "ingreso") {
                 const upd = { ...m, monto: m.monto - editando.monto };
                 batchOps.push({ type: "set", collection: "movimientos", id: String(upd.id), data: upd });
                 return upd;
               }
               if (m.grupoId === editando.grupoId && m.reciboId == null && m.pagoProvId != null && m.tipo === "egreso" && editando.proveedorId) {
                 const upd = { ...m, monto: m.monto - editando.monto };
                 batchOps.push({ type: "set", collection: "movimientos", id: String(upd.id), data: upd });
                 return upd;
               }
               return m;
             }).filter(m => {
               if (m.monto <= 0) {
                 batchOps.push({ type: "delete", collection: "movimientos", id: String(m.id) });
                 return false;
               }
               return true;
             });
          }

          // Si tenía mov directo, actualiza / borra:
          if (existiaDirecto) {
            resto = isChangedDestino ? resto.filter(m => {
              if (m.reciboId === editando.id) {
                batchOps.push({ type: "delete", collection: "movimientos", id: String(m.id) });
                return false;
              }
              return true;
            }) 
            : resto.map(m => {
                if (m.reciboId !== editando.id) return m;
                const upd = { ...m, monto: nuevoTotal, fecha: nuevaFecha };
                batchOps.push({ type: "set", collection: "movimientos", id: String(upd.id), data: upd });
                return upd;
            });
          }
            
          if (isChangedDestino || !existiaDirecto) {
             if (nuevaCuentaId) {
               const nId = "M" + Date.now();
               const nMov = {
                 id: nId,
                 grupoId: editando.grupoId || "E" + Date.now(),
                 cuentaId: nuevaCuentaId,
                 concepto: `Cobro — ${cliente.nombre}`,
                 tipo: "ingreso", 
                 monto: nuevoTotal, 
                 fecha: nuevaFecha, 
                 reciboId: editando.id
               };
               resto.push(nMov);
               batchOps.push({ type: "set", collection: "movimientos", id: String(nMov.id), data: nMov });
             }
             if (nuevoProvId) {
               const nId = "M" + (Date.now() + 1);
               const nMov = {
                 id: nId,
                 grupoId: editando.grupoId || "E" + Date.now(),
                 cuentaId: null,
                 concepto: `Transferencia directa a Proveedor por Cobro - ${cliente.nombre}`,
                 tipo: "egreso",
                 monto: nuevoTotal,
                 fecha: nuevaFecha,
                 reciboId: editando.id
               };
               resto.push(nMov);
               batchOps.push({ type: "set", collection: "movimientos", id: String(nMov.id), data: nMov });
             }
          }
          return resto;
        });
      }

      if (setPagosProv) {
        setPagosProv((prev: any[]) => {
          let resto = prev;
          const existiaDirecto = prev.some(p => p.reciboId === editando.id);

          if (!existiaDirecto && editando.grupoId && editando.proveedorId) {
             resto = resto.map(p => {
               if (p.grupoId === editando.grupoId && p.reciboId == null && p.proveedorId === editando.proveedorId) {
                 const upd = { ...p, monto: p.monto - editando.monto };
                 batchOps.push({ type: "set", collection: "pagosProv", id: String(upd.id), data: upd });
                 return upd;
               }
               return p;
             }).filter(p => {
               if (p.monto <= 0) {
                 batchOps.push({ type: "delete", collection: "pagosProv", id: String(p.id) });
                 return false;
               }
               return true;
             });
          }

          if (existiaDirecto) {
            resto = isChangedDestino ? resto.filter(p => {
              if (p.reciboId === editando.id) {
                batchOps.push({ type: "delete", collection: "pagosProv", id: String(p.id) });
                return false;
              }
              return true;
            })
            : resto.map(p => {
               if (p.reciboId !== editando.id) return p;
               const upd = { ...p, monto: nuevoTotal, fecha: nuevaFecha };
               batchOps.push({ type: "set", collection: "pagosProv", id: String(upd.id), data: upd });
               return upd;
            });
          }

          if (isChangedDestino || !existiaDirecto) {
            if (nuevoProvId) {
               const nId = "PP" + Date.now();
               const nPP = {
                 id: nId,
                 grupoId: editando.grupoId || "E" + Date.now(),
                 proveedorId: nuevoProvId,
                 tipo: "Transferencia",
                 monto: nuevoTotal,
                 fecha: nuevaFecha,
                 obs: `Cobro cliente ${cliente.nombre}`,
                 anulado: false,
                 reciboId: editando.id,
                 _desdeRecibo: true
               };
               resto.push(nPP);
               batchOps.push({ type: "set", collection: "pagosProv", id: String(nPP.id), data: nPP });
            }
          }
          return resto;
        });
      }

      // Sync to cloud
      if (cloudSync?.executeCloudBatch && batchOps.length > 0) {
        cloudSync.executeCloudBatch(batchOps);
      }
    } else {
      const updatedFac = { ...editando, total: nuevoTotal, fecha: nuevaFecha, obs: nuevoObs, numero: fv.numero };
      setFacturas((prev: any[]) => prev.map(f => {
        if (f.id !== editando.id) return f;
        return updatedFac;
      }));
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("facturas", updatedFac);
    }
    setEditando(null);
  };

  const handleExportar = () => {
    try {
      const filas = movs.map(m => {
        const checkDb = m._db || 0;
        const checkCr = m._cr || 0;
        
        const numStr = m.numero || `REC-${String(m.id).slice(-6)}`;
        let conceptoStr = "";
        if (m.tipo === "factura") {
          conceptoStr = numStr.toUpperCase().includes("FAC") ? numStr : `FAC ${m.letra || "B"} ${numStr}`;
        } else if (m.tipo === "nc") {
          conceptoStr = numStr.toUpperCase().includes("NC") ? numStr : `NC ${m.letra || "B"} ${numStr}`;
        } else if (m.tipo === "nd") {
          conceptoStr = numStr.toUpperCase().includes("ND") ? numStr : `ND ${m.letra || "B"} ${numStr}`;
        } else if (m.tipo === "pago") {
          conceptoStr = numStr.toUpperCase().includes("RECIBO") ? numStr : `RECIBO ${numStr}`;
        }

        if (m.obs && m.obs !== "Contado") conceptoStr += ` (${m.obs.replace(/Importado.*? — /g, '').trim()})`;

        return [
          m.fecha,
          conceptoStr,
          checkDb !== 0 ? checkDb : "",
          checkCr !== 0 ? checkCr : "",
          m._running || 0
        ];
      });

      exportarAExcel({
        titulo: `Cuenta Corriente — ${cliente.nombre}`,
        columnas: ["FECHA", "CONCEPTO", "DEBE", "HABER", "SALDO"],
        filas: filas,
        fileName: `CC_${cliente.nombre.replace(/\s+/g, '_')}.xlsx`,
        sheetName: "CC"
      });
    } catch (err) {
      console.error(err);
      alert("Error al exportar Excel.");
    }
  };

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const movsFiltrados = useMemo(() => {
    let res = movs;
    if (fechaDesde) res = res.filter(m => m.fecha >= fechaDesde);
    if (fechaHasta) res = res.filter(m => m.fecha <= fechaHasta + "T23:59:59");
    return res;
  }, [movs, fechaDesde, fechaHasta]);

  const setRango = (range: string) => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().split('T')[0];
    if (range === "hoy") { setFechaDesde(iso(now)); setFechaHasta(iso(now)); }
    else if (range === "mes") { 
      const ini = new Date(now.getFullYear(), now.getMonth(), 1);
      setFechaDesde(iso(ini)); setFechaHasta(iso(now));
    }
    else if (range === "ayer") {
      const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
      setFechaDesde(iso(ayer)); setFechaHasta(iso(ayer));
    }
    else { setFechaDesde(""); setFechaHasta(""); }
  };

  return (
    <OverlaySheet open={true} onClose={onClose} title={`Cuenta Corriente: ${cliente.nombre}`} sub={
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
        <span style={{ color: "#FFF", fontWeight: 700 }}>
          Saldo Actual: {fmtMoney(Math.abs(saldoActual))} {saldoActual > 0 ? "(Debe)" : "(A favor)"}
        </span>
        <Btn v="ghost" onClick={handleExportar} style={{ padding: "4px 8px", fontSize: 11, background: "rgba(255,255,255,0.2)", color: "#fff" }} title="Exportar"><Ic n="transfer" s={12}/></Btn>
      </div>
    } width="1000px">

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-end", background: t.surf2, padding: "12px 16px", borderRadius: 10 }}>
        <Fld label="Desde" style={{marginBottom:0}}><Inp type="date" value={fechaDesde} onChange={(e:any)=>setFechaDesde(e.target.value)} style={{padding:"6px 8px"}}/></Fld>
        <Fld label="Hasta" style={{marginBottom:0}}><Inp type="date" value={fechaHasta} onChange={(e:any)=>setFechaHasta(e.target.value)} style={{padding:"6px 8px"}}/></Fld>
        <div style={{display:"flex", gap:6}}>
          <Btn v="ghost" onClick={() => setRango("hoy")} style={{padding:"6px 10px", fontSize:11}}>Hoy</Btn>
          <Btn v="ghost" onClick={() => setRango("ayer")} style={{padding:"6px 10px", fontSize:11}}>Ayer</Btn>
          <Btn v="ghost" onClick={() => setRango("mes")} style={{padding:"6px 10px", fontSize:11}}>Mes</Btn>
          <Btn v="ghost" onClick={() => setRango("todo")} style={{padding:"6px 10px", fontSize:11}}>Todo</Btn>
        </div>
      </div>

      <Tbl stickyTop={false} headers={["Fecha", "Concepto", "Debe", "Haber", "Saldo", ""]}>
        {movsFiltrados.map((m: any, i: number) => {
          const isFactura = m.tipo === "factura" || m.tipo === "nc" || m.tipo === "nd";
          
          const rawNumStr = m.numero || `REC-${String(m.id).slice(-6)}`;
          let numStr = String(rawNumStr).trim();
          if (numStr.startsWith("PAG-")) numStr = numStr.replace("PAG-", "");
          if (numStr.startsWith("REC-")) numStr = numStr.replace("REC-", "");
          if (numStr.includes("-")) {
            const p = numStr.split("-");
            p[1] = p[1].replace(/^0+/, "") || "0";
            numStr = p.join("-");
          } else {
            numStr = numStr.replace(/^0+/, "") || "0";
          }

          let conceptoPrincipal = "";
          if (m.tipo === "factura") {
            conceptoPrincipal = numStr.toUpperCase().includes("FAC") ? numStr : `FAC ${m.letra || "B"} ${numStr}`;
          } else if (m.tipo === "nc") {
            conceptoPrincipal = numStr.toUpperCase().includes("NC") ? numStr : `NC ${m.letra || "B"} ${numStr}`;
          } else if (m.tipo === "nd") {
            conceptoPrincipal = numStr.toUpperCase().includes("ND") ? numStr : `ND ${m.letra || "B"} ${numStr}`;
          } else if (m.tipo === "recibo" || m.tipo === "pago") {
            conceptoPrincipal = numStr.toUpperCase().includes("RECIBO") ? numStr : `RECIBO ${numStr}`;
          }
          
          const obsOriginal = m.obs ? m.obs.replace(/Importado.*? — /g, '').trim() : "";
          let obsLimpia = obsOriginal;
          if (cliente?.nombre) {
            // Eliminar 'Cobro cliente [Nombre]' o solo el nombre
            let rgx = new RegExp(`Cobro cliente ${cliente.nombre}`, 'i');
            obsLimpia = obsLimpia.replace(rgx, '').trim();
            rgx = new RegExp(`^${cliente.nombre}$`, 'i');
            obsLimpia = obsLimpia.replace(rgx, '').trim();
          }
          if (cliente?.nombreCV) {
            let rgx2 = new RegExp(`^${cliente.nombreCV}$`, 'i');
            obsLimpia = obsLimpia.replace(rgx2, '').trim();
          }
          if (obsLimpia === "Cobro cliente" || obsLimpia === "Cobro") obsLimpia = "";
          
          let cuentaNombre = "";
          if ((m.tipo === "recibo" || m.tipo === "pago") && m.cuentaId) {
            const cta = cuentas?.find((c: any) => String(c.id) === String(m.cuentaId));
            if (cta) cuentaNombre = `Cuenta: ${cta.nombre}`;
          } else if ((m.tipo === "recibo" || m.tipo === "pago") && m.proveedorId) {
            const prov = proveedores?.find((p: any) => String(p.id) === String(m.proveedorId));
            if (prov) cuentaNombre = `Proveedor: ${prov.nombre}`;
          }

          let observacionSecundaria = "";
          if (cuentaNombre) {
            observacionSecundaria = `${cuentaNombre}${obsLimpia ? " - " + obsLimpia.replace(/^[-—·\s]+|[-—·\s]+$/g, '') : ""}`;
          } else if (obsLimpia && obsLimpia !== "Contado") {
            observacionSecundaria = obsLimpia.replace(/^[-—·\s]+|[-—·\s]+$/g, '');
          }

          return (
            <Fragment key={m.id || i}>
              <Tr style={{ cursor: isFactura ? "pointer" : "default" }} onClick={(e: any) => { if(isFactura) setVistaPreviaFactura(m); }}>
                <Td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{fmtFechaCC(m.fecha)}</Td>
                <Td style={{ padding: "8px 12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                      {conceptoPrincipal}
                    </div>
                    {observacionSecundaria && (
                      <span style={{ fontSize: 11, color: t.muted, fontWeight: 500, lineHeight: 1.2 }}>
                        {observacionSecundaria}
                      </span>
                    )}
                  </div>
                </Td>
                <Td style={{ padding: "8px 12px", textAlign: "right", color: t.red }}>{m._db > 0 ? fmtMoney(m._db) : ""}</Td>
                <Td style={{ padding: "8px 12px", textAlign: "right", color: t.green }}>{m._cr > 0 ? fmtMoney(m._cr) : ""}</Td>
                <Td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: m._running > 0 ? t.red : t.green }}>{fmtMoney(Math.abs(m._running))}</Td>
                <Td style={{ padding: "8px 12px" }}>
                   <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                     {isFactura ? (
                       <Btn v="ghost" onClick={(e: any) => { e.stopPropagation(); setVistaPreviaFactura(m); }} style={{ padding: "4px 8px" }} title="Ver Comprobante"><Ic n="eye" s={13} /></Btn>
                     ) : (
                       <Btn v="ghost" onClick={(e: any) => abrirEditar(m, e)} style={{ padding: "4px 8px" }} title="Editar"><Ic n="edit" s={13} /></Btn>
                     )}
                   </div>
                </Td>
              </Tr>
            </Fragment>
          );
        })}
        {movs.length === 0 && (
          <Tr><Td colSpan={7} style={{ textAlign: "center", padding: 40, color: t.muted }}>No hay movimientos registrados</Td></Tr>
        )}
      </Tbl>

      {editando && editando.tipo === "recibo" ? (
        <ModalEditCobroCompuesto 
          grupoId={editando.grupoId || editando.id} 
          onClose={() => setEditando(null)} 
          clientes={clientes}
          cuentas={cuentas} setCuentas={setCuentas}
          proveedores={proveedores}
          pagos={pagos} setPagos={setPagos}
          movimientos={movimientos} setMovimientos={setMovimientos}
          pagosProv={pagosProv} setPagosProv={setPagosProv}
          cloudSync={cloudSync}
        />
      ) : editando && (
        <OverlaySheet open={true} onClose={() => setEditando(null)} title={`Editar ${editando.tipo}`} width={500}>
          {editando.tipo !== "recibo" && <Fld label="Número"><Inp value={formEdit.numero} onChange={(e: any) => setFormVals({ ...formEdit, numero: e.target.value })} disabled={!!editando.grupoId} /></Fld>}
          <div style={{ display: "flex", gap: 12 }}>
            <Fld label="Fecha" half><Inp type="date" value={formEdit.fecha} onChange={(e: any) => setFormVals({ ...formEdit, fecha: e.target.value })} disabled={!!editando.grupoId} /></Fld>
            <Fld label="Monto / Total" half><InpMoney value={formEdit.total} onChange={(e: any) => setFormVals({ ...formEdit, total: e.target.value })} disabled={!!editando.grupoId} /></Fld>
          </div>
          {editando.tipo === "recibo" && (
            <Fld label="Cuenta Destino / Proveedor">
              <Sel value={formEdit.destinoId} onChange={(e: any) => setFormVals({ ...formEdit, destinoId: e.target.value })} disabled={!!editando.grupoId}>
                <option value="">Seleccionar destino...</option>
                <optgroup label="Cuentas Propias">
                   {cuentas.map((c: any) => <option key={`C_${c.id}`} value={`C_${c.id}`}>{c.nombre}</option>)}
                </optgroup>
                <optgroup label="Proveedores">
                   {proveedores?.filter((p: any) => p.estado !== "archivado").map((p: any) => <option key={`P_${p.id}`} value={`P_${p.id}`}>{p.nombre}</option>)}
                </optgroup>
              </Sel>
            </Fld>
          )}
          <Fld label="Observaciones"><Inp value={formEdit.obs} onChange={(e: any) => setFormVals({ ...formEdit, obs: e.target.value })} disabled={!!editando.grupoId} /></Fld>
          
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <Btn v="ghost" onClick={() => setEditando(null)} full>Cancelar</Btn>
            <BtnEliminarConClave onConfirm={async () => {
              const batchOps: any[] = [];
              let accountToUpdate: any = null;

              if (editando.tipo === "recibo") {
                if (editando.grupoId) {
                  // DELETE ENTIRE GROUP
                  if (pagos) {
                    const pagosGrupo = pagos.filter((p: any) => p.grupoId === editando.grupoId);
                    
                    const mGroup = movimientos?.find((m:any) => m.grupoId === editando.grupoId);
                    if (mGroup && mGroup.cuentaId && cuentas) {
                       const targetC = cuentas.find((c:any) => String(c.id) === String(mGroup.cuentaId));
                       if (targetC) {
                          accountToUpdate = { ...targetC, saldo: targetC.saldo - mGroup.monto };
                          batchOps.push({ type: "set", collection: "cuentas", id: String(accountToUpdate.id), data: accountToUpdate });
                       }
                    }
                    
                    pagosGrupo.forEach((pagoGrp: any) => {
                      batchOps.push({ type: "delete", collection: "pagos", id: String(pagoGrp.id) });
                    });
                  }

                  if (movimientos) {
                    const mGroup = movimientos?.find((m:any) => m.grupoId === editando.grupoId);
                    if (mGroup) batchOps.push({ type: "delete", collection: "movimientos", id: String(mGroup.id) });
                  }

                  if (pagosProv) {
                    const ppGroup = pagosProv?.find((p:any) => p.grupoId === editando.grupoId);
                    if (ppGroup) batchOps.push({ type: "delete", collection: "pagosProv", id: String(ppGroup.id) });
                  }
                } else {
                  // SINGLE RECEIPT DELETION
                  if (editando.cuentaId && cuentas) {
                     const targetC = cuentas.find((cx:any) => String(cx.id) === String(editando.cuentaId));
                     if (targetC) {
                        accountToUpdate = { ...targetC, saldo: targetC.saldo - (editando.monto || editando.total || 0) };
                        batchOps.push({ type: "set", collection: "cuentas", id: String(accountToUpdate.id), data: accountToUpdate });
                     }
                  }
  
                  batchOps.push({ type: "delete", collection: "pagos", id: String(editando.id) });
                  
                  if (movimientos) {
                     const mIdABorrar = movimientos?.find((m:any) => m.reciboId === editando.id)?.id;
                     if (mIdABorrar) batchOps.push({ type: "delete", collection: "movimientos", id: String(mIdABorrar) });
                  }
                  if (pagosProv) {
                     const ppIdABorrar = pagosProv?.find((p:any) => p.reciboId === editando.id)?.id;
                     if (ppIdABorrar) batchOps.push({ type: "delete", collection: "pagosProv", id: String(ppIdABorrar) });
                  }
                }
              } else {
                batchOps.push({ type: "delete", collection: "facturas", id: String(editando.id) });
              }

              if (cloudSync?.executeCloudBatch && batchOps.length > 0) {
                 const ok = await cloudSync.executeCloudBatch(batchOps);
                 if (!ok) {
                    alert("Error al borrar en la nube.");
                    return;
                 }
              } else {
                 // Fallback if no batch available
                 batchOps.forEach(op => {
                    if (op.type === "delete" && cloudSync?.deleteFromCloud) {
                       cloudSync.deleteFromCloud(op.collection, op.id);
                    } else if (op.type === "set" && cloudSync?.saveToCloud) {
                       cloudSync.saveToCloud(op.collection, op.data);
                    }
                 });
              }

              // Update states
              if (editando.tipo === "recibo") {
                 if (editando.grupoId) {
                    if (setPagos) setPagos((prev: any[]) => prev.filter((p: any) => p.grupoId !== editando.grupoId));
                    if (setMovimientos) setMovimientos((prev: any[]) => prev.filter((m: any) => m.grupoId !== editando.grupoId));
                    if (setPagosProv) setPagosProv((prev: any[]) => prev.filter((p: any) => p.grupoId !== editando.grupoId));
                 } else {
                    if (setPagos) setPagos((prev: any[]) => prev.filter(p => p.id !== editando.id));
                    if (setMovimientos) setMovimientos((prev: any[]) => prev.filter(m => m.reciboId !== editando.id));
                    if (setPagosProv) setPagosProv((prev: any[]) => prev.filter(p => p.reciboId !== editando.id));
                 }
                 if (accountToUpdate && setCuentas) {
                    setCuentas((prev: any[]) => prev.map((c:any) => String(c.id) === String(accountToUpdate.id) ? accountToUpdate : c));
                 }
              } else {
                 if (setFacturas) setFacturas((prev: any[]) => prev.filter(f => f.id !== editando.id));
              }
              
              setEditando(null);
            }} />
            <Btn onClick={guardarCambios} full disabled={!!editando.grupoId}>Guardar cambios</Btn>
          </div>
        </OverlaySheet>
      )}

      {vistaPreviaFactura && (
        <FacturaVistaPrevia
          facturas={facturas}
          letra={vistaPreviaFactura.letra}
          tipoComp={vistaPreviaFactura.tipo}
          editando={vistaPreviaFactura}
          fecha={vistaPreviaFactura.fecha}
          cliente={cliente}
          condPago={vistaPreviaFactura.condPago}
          items={vistaPreviaFactura.items || []}
          descGlobal={vistaPreviaFactura.descGlobal}
          descMonto={vistaPreviaFactura.descMonto}
          total={vistaPreviaFactura.total}
          setVistaPrevia={setVistaPreviaFactura}
          soloLectura={true}
          onEdit={(m: any) => {
            setVistaPreviaFactura(null);
            abrirEditar(m, { stopPropagation: () => {} });
          }}
        />
      )}
    </OverlaySheet>
  );
}
