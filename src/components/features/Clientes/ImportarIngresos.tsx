import React, { useState } from "react";
import { read, utils, SSF } from "xlsx";
import { useApp } from "../../../context/AppContext";
import { Btn, Ic, KPI } from "../../common/UIBase";
import { parseMoney as parseMoneyUtil, getToday, fmtMoney, normalizar, fmtFechaCC } from "../../../lib/utils";
import { procesarMatrizExcel, buildImportacionIngresos, resolverDest as resolverDestLogic } from "../../../lib/importing_logic/importIngresosLogic";

const today = getToday();

export function TabHistorialIngresos({ historial, t, setHistorialImport, setPagos, setPagosProv, setMovimientos, setCuentas, movimientos, cuentas, pagos, pagosProv, cloudSync }: any) {
  const [confirmarRev, setConfirmarRev] = React.useState<any>(null);
  const [revirtiendo, setRevirtiendo] = React.useState<any>(null);

  const borrarImportacion = async (h: any) => {
    const revId = h.id || h.timestamp;
    setRevirtiendo(revId);
    // Allow React state to update before blocking with heavy processing
    await new Promise(r => setTimeout(r, 50));
    try {
      if (cloudSync?.executeCloudBatch) {
         const batchOps: any[] = [];
         
         if (setPagos && pagos) {
           const hIdsSet = new Set((h.ids||[]).map(String));
           const toUpdatePagos: any[] = [];
           const nextPagos = pagos.map((p: any) => {
             if (hIdsSet.has(String(p.id)) && !p.anulado) {
               const anulado = { ...p, anulado: true };
               toUpdatePagos.push(anulado);
               batchOps.push({ type: "set", collection: "pagos", id: String(anulado.id), data: anulado });
               return anulado;
             }
             return p;
           });
           if (toUpdatePagos.length > 0) setPagos(nextPagos);
         }

         if (setPagosProv && pagosProv) {
           const hIdsProvStr = (h.idsPagoProv||[]).map(String);
           const toUpdateProv: any[] = [];
           const nextPagosProv = pagosProv.map((p: any) => {
             if (hIdsProvStr.includes(String(p.id)) && !p.anulado) {
               const anulado = { ...p, anulado: true };
               toUpdateProv.push(anulado);
               batchOps.push({ type: "set", collection: "pagosProv", id: String(anulado.id), data: anulado });
               return anulado;
             }
             return p;
           });
           if (toUpdateProv.length > 0) setPagosProv(nextPagosProv);
         }
         
          batchOps.push({ type: "delete", collection: "historialImport", id: String(h.id || h.timestamp) });
         
         if (setMovimientos && movimientos) {
            const hIdsMovSet = new Set((h.idsMov||[]).map(String));
            const toDelete = movimientos.filter((m: any) => hIdsMovSet.has(String(m.id)));
            const nextMovs = movimientos.filter((m: any) => !hIdsMovSet.has(String(m.id)));
            if (toDelete.length > 0) {
              setMovimientos(nextMovs);
              toDelete.forEach((m: any) => {
                batchOps.push({ type: "delete", collection: "movimientos", id: String(m.id) });
              });

              if (setCuentas && cuentas) {
                const nextCuentas = cuentas.map((c: any) => {
                  const addedToThisCuenta = toDelete
                    .filter((m: any) => String(m.cuentaId) === String(c.id) && m.tipo === "ingreso")
                    .reduce((s: number, m: any) => s + m.monto, 0);
                  
                  const subtractedFromThisCuenta = toDelete
                    .filter((m: any) => String(m.cuentaId) === String(c.id) && m.tipo === "egreso")
                    .reduce((s: number, m: any) => s + m.monto, 0);

                  if (addedToThisCuenta > 0 || subtractedFromThisCuenta > 0) {
                    const updatedCuenta = { ...c, saldo: c.saldo - addedToThisCuenta + subtractedFromThisCuenta };
                    batchOps.push({ type: "set", collection: "cuentas", id: String(c.id), data: updatedCuenta });
                    return updatedCuenta;
                  }
                  return c;
                });
                setCuentas(nextCuentas);
              }
            }
         }
         
         if (batchOps.length > 0) {
            const ok = await cloudSync.executeCloudBatch(batchOps);
            if (!ok) {
              alert("Error revirtiendo en la nube. Recarga la página.");
              setConfirmarRev(null);
              setRevirtiendo(null);
              return;
            }
         }
         
         if (setHistorialImport) {
           setHistorialImport((prev: any[]) => prev.filter((x: any) => {
             if (x.id && h.id) return String(x.id) !== String(h.id);
             return String(x.timestamp) !== String(h.timestamp);
           }));
         }
         
         setConfirmarRev(null);
         setRevirtiendo(null);
         return;
      }
      
      // Fallback si no hay executeCloudBatch
      if (setPagos && pagos) {
        const toUpdate: any[] = [];
        const hIdsSet = new Set((h.ids||[]).map(String));
        const nextPagos = pagos.map((p: any) => {
          if (hIdsSet.has(String(p.id)) && !p.anulado) {
            const anulado = { ...p, anulado: true };
            toUpdate.push(anulado);
            return anulado;
          }
          return p;
        });
        if (toUpdate.length > 0) {
          setPagos(nextPagos);
          if (cloudSync?.saveBatchToCloud) await cloudSync.saveBatchToCloud("pagos", toUpdate);
          else if (cloudSync?.saveToCloud) {
            for (const u of toUpdate) {
              await cloudSync.saveToCloud("pagos", u);
            }
          }
        }
      }

      if (setPagosProv && pagosProv) {
        const toUpdate: any[] = [];
        const hIdsProvStr = (h.idsPagoProv||[]).map(String);
        const nextPagosProv = pagosProv.map((p: any) => {
          if (hIdsProvStr.includes(String(p.id)) && !p.anulado) {
            const anulado = { ...p, anulado: true };
            toUpdate.push(anulado);
            return anulado;
          }
          return p;
        });
        if (toUpdate.length > 0) {
          setPagosProv(nextPagosProv);
          if (cloudSync?.saveBatchToCloud) await cloudSync.saveBatchToCloud("pagosProv", toUpdate);
          else if (cloudSync?.saveToCloud) {
            for (const u of toUpdate) {
              await cloudSync.saveToCloud("pagosProv", u);
            }
          }
        }
      }

      if (setMovimientos && movimientos) {
        const hIdsMovSet = new Set((h.idsMov||[]).map(String));
        const toDelete = movimientos.filter((m: any) => hIdsMovSet.has(String(m.id)));
        const nextMovs = movimientos.filter((m: any) => !hIdsMovSet.has(String(m.id)));
        
        if (toDelete.length > 0) {
          setMovimientos(nextMovs);
          
          if (cloudSync?.deleteBatchFromCloud) {
             await cloudSync.deleteBatchFromCloud("movimientos", toDelete.map((m: any) => String(m.id)));
          } else if (cloudSync?.deleteFromCloud) {
             for (const m of toDelete) {
               await cloudSync.deleteFromCloud("movimientos", String(m.id));
             }
          }

          if (setCuentas && cuentas) {
            const cuentasToUpdate: any[] = [];
            const nextCuentas = cuentas.map((c: any) => {
              const addedToThisCuenta = toDelete
                .filter((m: any) => String(m.cuentaId) === String(c.id) && m.tipo === "ingreso")
                .reduce((s: number, m: any) => s + m.monto, 0);
              
              const subtractedFromThisCuenta = toDelete
                .filter((m: any) => String(m.cuentaId) === String(c.id) && m.tipo === "egreso")
                .reduce((s: number, m: any) => s + m.monto, 0);

              if (addedToThisCuenta > 0 || subtractedFromThisCuenta > 0) {
                const updatedCuenta = { ...c, saldo: c.saldo - addedToThisCuenta + subtractedFromThisCuenta };
                cuentasToUpdate.push(updatedCuenta);
                return updatedCuenta;
              }
              return c;
            });

            if (cuentasToUpdate.length > 0) {
              setCuentas(nextCuentas);
              if (cloudSync?.saveBatchToCloud) await cloudSync.saveBatchToCloud("cuentas", cuentasToUpdate);
              else if (cloudSync?.saveToCloud) {
                for (const u of cuentasToUpdate) {
                  await cloudSync.saveToCloud("cuentas", u);
                }
              }
            }
          }
        }
      }

      if(setHistorialImport) {
        setHistorialImport((prev: any[]) => prev.filter(x => {
          if (x.id && h.id) return String(x.id) !== String(h.id);
          return String(x.timestamp) !== String(h.timestamp);
        }));
        if (cloudSync?.deleteFromCloud) {
          try {
            await cloudSync.deleteFromCloud("historialImport", String(h.id || h.timestamp));
          } catch (e: any) {
            console.error("Error specifically deleting from historialImport:", e);
          }
        }
      }
      
      setConfirmarRev(null);
    } catch (err: any) {
      console.error("Error revirtiendo importación:", err);
    } finally {
      setRevirtiendo(null);
    }
  };
  
  const [mesesAbH, setMesesAbH] = React.useState<Set<string>>(()=>new Set());

  const hist = (historial||[]).slice().reverse();
  if(hist.length === 0) return (
    <div style={{textAlign:"center",padding:"48px 0",color:t?.muted}}>
      <div style={{fontSize:32,marginBottom:12}}>📋</div>
      <div style={{fontSize:14,fontWeight:600,color:t?.sub}}>Sin importaciones registradas</div>
      <div style={{fontSize:12,color:t?.muted,marginTop:4}}>Cada vez que importes Cobranzas a Clientes y Pagos a Proveedores quedarán registradas aquí.</div>
    </div>
  );

  const mesActualH = new Date().toISOString().slice(0,7);
  const MESES_ES2 = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const labelMesH = (m: string) => { const [y,mo]=m.split("-"); return `${MESES_ES2[parseInt(mo)-1]} ${y}`; };

  // Agrupar por mes
  const gruposH: any = {};
  hist.forEach((h: any)=>{
    const f = h.fecha || h.fechas?.[0] || new Date(h.timestamp).toISOString().slice(0,10);
    const mes = f.slice(0,7);
    if(!gruposH[mes]) gruposH[mes]=[];
    gruposH[mes].push(h);
  });
  const mesesH = Object.keys(gruposH).sort((a,b)=>b.localeCompare(a));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:12,color:t.muted}}>{hist.length} importación{hist.length!==1?"es":""} registrada{hist.length!==1?"s":""}</div>
      </div>
      {mesesH.map(mes=>{
        const items = gruposH[mes];
        const esMesActual = mes===mesActualH;
        const abierto = mesesAbH.has(mes)||esMesActual;
        const totalRegs = items.reduce((s: number,h: any)=>s+(h.cantRegistros||0),0);
        return (
          <div key={mes} style={{marginBottom:8}}>
            <div onClick={()=>{ if(esMesActual) return; setMesesAbH(prev=>{const n=new Set(prev);n.has(mes)?n.delete(mes):n.add(mes);return n;}); }}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderRadius:10,background:esMesActual?t.accentBg:t.surf2,border:`1px solid ${esMesActual?t.accent:t.border}`,cursor:esMesActual?"default":"pointer",marginBottom:abierto?6:0,userSelect:"none"}}>
              <span style={{fontSize:13,fontWeight:700,color:esMesActual?t.accent:t.text}}>{labelMesH(mes)}</span>
              <span style={{fontSize:11,color:t.muted}}>{items.length} importación{items.length!==1?"es":""}</span>
              <span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:t.sub}}>{totalRegs} cobro{totalRegs!==1?"s":""}</span>
              {!esMesActual&&<span style={{fontSize:12,color:t.muted}}>{abierto?"▲":"▼"}</span>}
            </div>
            {abierto && (
              <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden",background:t.surf}}>
                {items.map((h: any, i: number)=>{
                  return (
                    <div key={h.id || h.timestamp || i}>
                      <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderBottom:i<items.length-1?`1px solid ${t.border}`:"none",background:i%2===0?t.surf:t.surf2}}>
                        <div style={{width:36,height:36,borderRadius:10,background:t.green+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                          {"💰"}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:13,color:t.text}}>
                            Cobranzas a Clientes
                            {h.fecha&&<span style={{fontWeight:400,color:t.sub,marginLeft:8,fontSize:12}}>{fmtFechaCC(h.fecha)}</span>}
                          </div>
                          <div style={{fontSize:11,color:t.muted,marginTop:2}}>{new Date(h.timestamp).toLocaleString("es-AR")} · {h.usuario||"—"}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0,marginRight:8}}>
                          <div style={{fontSize:16,fontWeight:800,color:t.green}}>{h.cantRegistros}</div>
                          <div style={{fontSize:11,color:t.muted}}>cobro{h.cantRegistros!==1?"s":""}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0,marginRight:8,minWidth:80}}>
                          <div style={{fontSize:15,fontWeight:700,color:t.text}}>{fmtMoney(h.total||0)}</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <button onClick={(e)=>{e.stopPropagation();setConfirmarRev(h);}} style={{background:"none",border:`1px solid ${t.red}44`,borderRadius:7,cursor:"pointer",color:t.red,padding:"5px 8px",display:"flex",alignItems:"center",flexShrink:0}}><Ic n="trash" s={13}/></button>
                        </div>
                      </div>
                      
                      {/* Inline Confirmation for Reverting */}
                      {confirmarRev?.timestamp === h.timestamp && (
                        <div style={{padding:"12px 14px",background:t.red+"11",borderTop:`1px solid ${t.red}44`}}>
                            <div style={{fontSize: 13, color: t.text, marginBottom: 10}}>
                                <strong>¿Revertir Importación de Cobranzas?</strong><br/>
                                Se anularán {h.cantRegistros} cobro{h.cantRegistros!==1?"s":""}, pagos y movimientos de caja.
                                {" Esta acción no se puede deshacer."}
                            </div>
                            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmarRev(null); }} style={{background:"none",border:`1px solid ${t.border}`,cursor:"pointer",color:t.sub,fontSize:12,padding:"6px 12px",borderRadius:6}} disabled={revirtiendo === (h.id || h.timestamp)}>Cancelar</button>
                                <button onClick={(e) => { e.stopPropagation(); borrarImportacion(h); }} style={{background:t.red,border:"none",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600,padding:"6px 14px",borderRadius:6,opacity:revirtiendo === (h.id || h.timestamp)?0.6:1}} disabled={revirtiendo === (h.id || h.timestamp)}>
                                   {revirtiendo === (h.id || h.timestamp) ? "Revirtiendo..." : "Sí, revertir"}
                                </button>
                            </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  );
}

export function ImportarIngresos({ clientes, setPagos, setPagosProv, setMovimientos, setCuentas, cuentas, proveedores, user, historialImport=[], setHistorialImport, cloudSync }: any) {
  const { t } = useApp();
  const [paso, setPaso] = useState(1);
  const [fecha, setFecha] = useState(getToday());
  const [registros, setRegistros] = useState<{ directos: any[], vendedores: any[] }>({ directos:[], vendedores:[] });
  const [alertas, setAlertas] = useState<any[]>([]);
  const [destManuales, setDestManuales] = useState<any>({});
  const [warningImport, setWarningImport] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [tabPreview, setTabPreview] = useState("directos");

  // Mapas de alias planilla → IDs del sistema
  const DEST_CUENTA_MAP: Record<string, number> = { BSJ:2, PAT:3, BBVA:5, CAJA:1 };
  const DEST_PROVEEDOR_MAP: Record<string, number> = {
    "ALNTE":1, "AL NORTE":1, "AL-NORTE":1,
    "RGP-SEAC":9, "RGP SEAC":9, "RGPSEAC":9,
    "RGP-SUBE":10, "RGP SUBE":10,
    "ESPERT":3, "FRAT":4, "SUBE":4, "N&H":6,
  };

  const resolverDest = (dest: string) => resolverDestLogic(dest, cuentas, proveedores);

  const buscarCliente = (id: string | number) => {
    const idNum = parseInt(String(id||""));
    if(isNaN(idNum)) return null;
    return clientes.find((c: any) => c.id === idNum) || null;
  };

  const procesarExcel = async (file: File) => {
    setError(""); setProcesando(true); setWarningImport(""); setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type:"array" });

      const res = procesarMatrizExcel(wb, utils, SSF, cuentas, proveedores, clientes);

      if(res.fechaDetectada) setFecha(res.fechaDetectada);

      const alertasNuevas = [
        ...res.directosFiltrados.filter(r => !r.dest).map(r => r._key),
        ...res.vendedoresFiltrados.filter(r => !r.dest).map(r => r._key),
      ];

      setRegistros({ directos: res.directosFiltrados, vendedores: res.vendedoresFiltrados });
      setAlertas(alertasNuevas);
      setDestManuales({});
      
      const pFecha = res.fechaDetectada || getToday();
      if (historialImport && historialImport.some((h: any) => h.tipo === "ingresos" && (h.fileName === file.name || h.fecha === pFecha || h.fechas?.includes(pFecha)))) {
        setWarningImport(`Advertencia: Un archivo con el nombre "${file.name}" o asociado a la fecha ${pFecha} ya parece haber sido importado previamente.`);
      }

      setPaso(2);
    } catch(e: any) {
      setError(e.message || "Error al procesar el archivo.");
    }
    setProcesando(false);
  };

  const resolverDestFinal = (r: any) => destManuales[r._key] || r.dest || null;

  const conAlertaSinResolver = [...registros.directos, ...registros.vendedores]
    .filter(r => alertas.includes(r._key) && !destManuales[r._key]);

  const opcionesDest = [
    {k:"BSJ",v:"Banco San Juan"},{k:"PAT",v:"Banco Patagonia"},
    {k:"BBVA",v:"Banco BBVA"},{k:"CAJA",v:"Caja"},
    {k:"ALNTE",v:"AL NORTE"},{k:"RGP-SEAC",v:"RGP-SEAC"},
    {k:"RGP-SUBE",v:"RGP-SUBE"},{k:"ESPERT",v:"ESPERT"},{k:"N&H",v:"N&H"},
  ];

  const confirmar = async () => {
    if(confirmando) return;
    setConfirmando(true);

    const res = buildImportacionIngresos(
      registros,
      fecha,
      destManuales,
      proveedores,
      cuentas,
      fileName,
      user?.nombre || ""
    );

    const { nuevosRecibos, nuevosPagoProv, nuevosMovCaja, numCuentas, nextCuentas, nuevoH } = res;

    // Save to Firebase batch
    let executeBatchSuccess = false;
    
    if (cloudSync?.executeCloudBatch) {
       const batchOps: any[] = [];
       nuevosRecibos.forEach(x => batchOps.push({ type: "set", collection: "pagos", id: String(x.id), data: x }));
       nuevosPagoProv.forEach(x => batchOps.push({ type: "set", collection: "pagosProv", id: String(x.id), data: x }));
       nuevosMovCaja.forEach(x => batchOps.push({ type: "set", collection: "movimientos", id: String(x.id), data: x }));
       numCuentas.forEach(x => batchOps.push({ type: "set", collection: "cuentas", id: String(x.id), data: x }));
       batchOps.push({ type: "set", collection: "historialImport", id: String(nuevoH.id), data: nuevoH });
       
       if (batchOps.length > 0) {
         const success = await cloudSync.executeCloudBatch(batchOps);
         if (!success) {
            alert("Error al guardar la importación. Reintentá.");
            setConfirmando(false);
            return;
         }
         executeBatchSuccess = true;
       }
    } else if (cloudSync?.saveBatchToCloud) {
       const cs = cloudSync;
       cs.saveBatchToCloud("pagos", nuevosRecibos);
       cs.saveBatchToCloud("pagosProv", nuevosPagoProv);
       cs.saveBatchToCloud("movimientos", nuevosMovCaja);
       if (numCuentas.length > 0) cs.saveBatchToCloud("cuentas", numCuentas);
       if (cloudSync?.saveToCloud) cloudSync.saveToCloud("historialImport", nuevoH, String(nuevoH.id));
    }

    if (setCuentas && nextCuentas) setCuentas(nextCuentas);
    setPagos((prev: any[]) => [...nuevosRecibos, ...prev].filter((v,i,a) => a.findIndex(t => String(t.id) === String(v.id)) === i));
    if(setPagosProv) setPagosProv((prev: any[]) => [...nuevosPagoProv, ...prev].filter((v,i,a) => a.findIndex(t => String(t.id) === String(v.id)) === i));
    if(setMovimientos) setMovimientos((prev: any[]) => [...nuevosMovCaja, ...prev].filter((v,i,a) => a.findIndex(t => String(t.id) === String(v.id)) === i));
    if(setHistorialImport) setHistorialImport((prev: any[]) => [...prev, nuevoH].filter((v,i,a) => a.findIndex(t => String(t.id || t.timestamp) === String(v.id || v.timestamp)) === i));

    setConfirmando(false);
    setPaso(3);
  };

  const totalDirectos = registros.directos.reduce((s,r) => s + (r.monto||0), 0);
  const totalVendedores = registros.vendedores.reduce((s,r) => s + (r.totalProveedor||0), 0);
  const sinCliente = [
    ...registros.directos.filter(r => !r.clienteObj),
    ...registros.vendedores.filter(r => !r.clienteFisico && !r.clienteCIG),
  ];

  const selectDestStyle = { fontSize:12, padding:"6px 8px", borderRadius:6, maxWidth: 160, background:t?.surf2||"#fff", color:t?.text||"#000", outline: "none", cursor: "pointer", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" };

  const SelectorDest = ({r, esVendedor}: {r:any, esVendedor: boolean}) => {
    const d = resolverDestFinal(r);
    const val = d ? (d.cuentaId ? `C_${d.cuentaId}` : d.proveedorId ? `P_${d.proveedorId}` : "") : "";
    const sinDest = !d;

    return (
      <select onChange={e => {
        const v = e.target.value;
        if(v === "eliminar") {
          if(esVendedor) setRegistros(prev=>({...prev,vendedores:prev.vendedores.filter(x=>x._key!==r._key)}));
          else setRegistros(prev=>({...prev,directos:prev.directos.filter(x=>x._key!==r._key)}));
          setAlertas(prev=>prev.filter(k=>k!==r._key));
        } else if(v) {
          if(v.startsWith("C_")) {
            setDestManuales((prev: any)=>({...prev,[r._key]:{cuentaId: parseInt(v.replace("C_","")), proveedorId: null}}));
            setAlertas(prev=>prev.filter(k=>k!==r._key));
          } else if(v.startsWith("P_")) {
            setDestManuales((prev: any)=>({...prev,[r._key]:{cuentaId: null, proveedorId: parseInt(v.replace("P_",""))}}));
            setAlertas(prev=>prev.filter(k=>k!==r._key));
          }
        }
      }} value={val} style={{...selectDestStyle, border: sinDest ? `1px solid ${t?.amber}` : `1px solid ${t?.border}`}}>
        <option value="">{sinDest ? "⚠ Sin destino" : "Seleccionar..."}</option>
        <optgroup label="Cuentas Propias">
          {cuentas.map((c: any)=><option key={`C_${c.id}`} value={`C_${c.id}`}>{c.nombre}</option>)}
        </optgroup>
        <optgroup label="Proveedores">
          {proveedores.filter((p: any)=>p.estado!=="archivado").map((p: any)=><option key={`P_${p.id}`} value={`P_${p.id}`}>{p.nombre}</option>)}
        </optgroup>
        <option value="eliminar">— Eliminar fila —</option>
      </select>
    );
  };

  if(paso === 3) {
    const ultHist = (historialImport||[]).filter((h: any)=>h.tipo==="ingresos").slice(-1)[0];
    return (
      <div style={{textAlign:"center",padding:"32px 0"}}>
        <div style={{fontSize:36,marginBottom:12}}>✅</div>
        <div style={{fontSize:16,fontWeight:800,color:t?.green,marginBottom:6}}>Importación completada</div>
        <div style={{fontSize:13,color:t?.sub,marginBottom:20}}>
          {ultHist?.cantRegistros||0} cobros · {ultHist?.fecha||fecha} · {fmtMoney(ultHist?.total||0)}
        </div>
        <Btn onClick={()=>{setPaso(1);setRegistros({directos:[],vendedores:[]});setAlertas([]);setDestManuales({});setError("");setTimeout(()=>document.getElementById("fileInputImportarIngresos")?.click(), 100);}}>
          Nueva importación
        </Btn>
      </div>
    );
  }

  if(paso === 2) return (
    <div>
      {warningImport && (
        <div style={{ padding: "10px 14px", background: t?.amber + "15", border: `1px solid ${t?.amber}`, borderRadius: 8, color: t?.amber, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          {warningImport}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={()=>setPaso(1)} style={{background:t?.surf2,border:`1px solid ${t?.border}`,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",color:t?.text,display:"flex",alignItems:"center",gap:6,fontWeight:600}}>
          <Ic n="arrow-left" s={12}/> Volver
        </button>
        <label style={{fontSize:12,color:t?.muted,marginRight:4,marginLeft:"auto"}}>Fecha:</label>
        <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
          style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${t?.border}`,background:t?.surf,color:t?.text,fontSize:13}}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <KPI label="Directos" value={registros.directos.length} sub={fmtMoney(totalDirectos)} color={t?.accent} />
        <KPI label="Vendedores" value={registros.vendedores.length} sub={fmtMoney(totalVendedores)} color={t?.green} />
        <KPI label="Sin destino" value={conAlertaSinResolver.length} color={conAlertaSinResolver.length ? t?.amber : t?.sub} />
        <KPI label="Sin cliente" value={sinCliente.length} color={sinCliente.length ? t?.red : t?.sub} />
      </div>

      {conAlertaSinResolver.length > 0 && (
        <div style={{background:t?.amber+"12",border:`1px solid ${t?.amber}44`,borderRadius:8,padding:"8px 14px",fontSize:12,color:t?.amber,marginBottom:12}}>
          ⚠ {conAlertaSinResolver.length} fila{conAlertaSinResolver.length!==1?"s":""} sin destino — asigná o eliminá antes de confirmar.
        </div>
      )}

      <div style={{display:"flex",borderBottom:`1px solid ${t?.border}`,marginBottom:14}}>
        {[{id:"directos",label:`Directos (${registros.directos.length})`},{id:"vendedores",label:`Vendedores (${registros.vendedores.length})`}].map(tb=>(
          <button key={tb.id} onClick={()=>setTabPreview(tb.id)}
            style={{padding:"8px 16px",border:"none",borderBottom:`2px solid ${tabPreview===tb.id?t?.accent:"transparent"}`,background:"none",cursor:"pointer",fontSize:13,fontWeight:tabPreview===tb.id?700:500,color:tabPreview===tb.id?t?.accent:t?.sub}}>
            {tb.label}
          </button>
        ))}
      </div>

      {tabPreview==="directos"&&(
        <div style={{maxHeight:300,overflowY:"auto",border:`1px solid ${t?.border}`,borderRadius:8}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead style={{position:"sticky", top:0, zIndex:10, background:t?.surf2}}><tr>
              {["Cliente","Importe","Destino",""].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:t?.sub,fontSize:11,borderBottom:`1px solid ${t?.border}`}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {registros.directos.map(r=>{
                const sinDest = alertas.includes(r._key) && !destManuales[r._key];
                return (
                  <tr key={r._key} style={{background:sinDest?t?.amber+"08":"",borderBottom:`1px solid ${t?.border}44`}}>
                    <td style={{padding:"5px 10px",fontWeight:r.clienteObj?600:400,color:r.clienteObj?t?.text:t?.red,fontSize:12}}>
                      {r.clienteObj ? r.clienteObj.nombre : `⚠ ${r.clienteNombre}`}
                    </td>
                    <td style={{padding:"5px 10px",fontWeight:700,color:t?.accent}}>{fmtMoney(r.monto)}</td>
                    <td style={{padding:"5px 10px"}}>
                      <SelectorDest r={r} esVendedor={false}/>
                    </td>
                    <td style={{padding:"5px 6px"}}>
                      <button onClick={()=>{
                        setRegistros(prev=>({...prev,directos:prev.directos.filter(x=>x._key!==r._key)}));
                        setAlertas(prev=>prev.filter(k=>k!==r._key));
                      }} style={{background:"none",border:"none",cursor:"pointer",color:t?.red,padding:"2px 4px"}} title="Eliminar registro"><Ic n="trash" s={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tabPreview==="vendedores"&&(
        <div style={{maxHeight:300,overflowY:"auto",border:`1px solid ${t?.border}`,borderRadius:8}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead style={{position:"sticky", top:0, zIndex:10, background:t?.surf2}}><tr>
              {["Físico","$","CIG","$","Total prov.","Destino",""].map((h, idx)=><th key={`${h}-${idx}`} style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:t?.sub,fontSize:11,borderBottom:`1px solid ${t?.border}`}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {registros.vendedores.map(r=>{
                const sinDest = alertas.includes(r._key) && !destManuales[r._key];
                return (
                  <tr key={r._key} style={{background:sinDest?t?.amber+"08":"",borderBottom:`1px solid ${t?.border}44`}}>
                    <td style={{padding:"5px 10px",fontWeight:600,color:r.clienteFisico?t?.text:t?.red,fontSize:12}}>
                      {r.clienteFisico?r.clienteFisico.nombre:`⚠ ID ${r.idFisico}`}
                    </td>
                    <td style={{padding:"5px 10px",color:t?.accent,fontWeight:600,fontSize:12}}>{r.montoFisico>0?fmtMoney(r.montoFisico):"—"}</td>
                    <td style={{padding:"5px 10px",color:r.clienteCIG?t?.sub:t?.red,fontSize:12}}>
                      {r.clienteCIG?r.clienteCIG.nombre:(r.idCIG?`⚠ ID ${r.idCIG}`:"—")}
                    </td>
                    <td style={{padding:"5px 10px",color:t?.sub,fontSize:12}}>{r.montoCIG>0?fmtMoney(r.montoCIG):"—"}</td>
                    <td style={{padding:"5px 10px",fontWeight:700,color:t?.green,fontSize:12}}>{fmtMoney(r.totalProveedor)}</td>
                    <td style={{padding:"5px 10px"}}>
                      <SelectorDest r={r} esVendedor={true}/>
                    </td>
                    <td style={{padding:"5px 6px"}}>
                      <button onClick={()=>{
                        setRegistros(prev=>({...prev,vendedores:prev.vendedores.filter(x=>x._key!==r._key)}));
                        setAlertas(prev=>prev.filter(k=>k!==r._key));
                      }} style={{background:"none",border:"none",cursor:"pointer",color:t?.red,padding:"2px 4px"}} title="Eliminar registro"><Ic n="trash" s={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{display:"flex",gap:10,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setPaso(1)} full>← Volver</Btn>
        <Btn onClick={confirmar} disabled={confirmando||conAlertaSinResolver.length>0} full>
          <Ic n="check" s={14}/>
          {confirmando?"Procesando...":`Confirmar — ${registros.directos.length+registros.vendedores.length} registros`}
        </Btn>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:16,fontWeight:700,color:t?.text,marginBottom:4}}>Importar Ingresos</div>
        <div style={{fontSize:13,color:t?.sub}}>Cargá la planilla diaria. El sistema leerá las hojas DIRECTOS y VENDEDORES automáticamente.</div>
      </div>
      <label onDrop={e=>{e.preventDefault();const f=e.dataTransfer?.files[0];if(f)procesarExcel(f);}}
        onDragOver={e=>e.preventDefault()}
        style={{display:"block",border:`2px dashed ${t?.border}`,borderRadius:14,padding:"48px 24px",textAlign:"center",cursor:"pointer",background:t?.surf2}}>
        <input id="fileInputImportarIngresos" type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])procesarExcel(e.target.files[0]);e.target.value="";}}/>
        <div style={{fontSize:36,marginBottom:12}}>📂</div>
        <div style={{fontSize:15,fontWeight:700,color:t?.text,marginBottom:6}}>{procesando?"Procesando...":"Arrastrá la planilla aquí"}</div>
        <div style={{fontSize:13,color:t?.sub,marginBottom:12}}>o hacé click para seleccionarla</div>
        <div style={{display:"inline-block",background:t?.accentBg,border:`1px solid ${t?.accent}`,borderRadius:8,padding:"6px 14px",fontSize:12,color:t?.accent,fontWeight:600}}>Archivos .xlsx o .xls</div>
      </label>
      {error&&<div style={{marginTop:12,padding:"10px 14px",background:t?.red+"18",border:`1px solid ${t?.red}33`,borderRadius:8,fontSize:13,color:t?.red}}>{error}</div>}
    </div>
  );
}
