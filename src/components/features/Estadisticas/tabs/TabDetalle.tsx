import React from "react";
import { fmtMoney } from "../../../../lib/utils";
import { BuscadorCliente } from "../../Clientes/BuscadorCliente";
import { Btn } from "../../../common/UIBase";

export default function TabDetalle({
  facturas,
  clientes,
  articulos,
  desde,
  hasta,
  filtroPeriodoJSX,
  detClienteId,
  setDetClienteId,
  detBusq,
  setDetBusq,
  detFamilia,
  setDetFamilia,
  detExpFac,
  setDetExpFac,
  t
}: any) {
  const facsFiltradas = facturas.filter((f: any)=>{
    if(f.anulada||f.fecha<desde||f.fecha>hasta) return false;
    if(detClienteId && String(f.clienteId)!==detClienteId) return false;
    if(detBusq && !detClienteId) {
      const cli = clientes.find((c: any)=>c.id===f.clienteId);
      const quitarPref = (s: any) => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/^(cig|rig|rd|rn|cr)\s*[\.\-]?\s*/i,"").trim();
      const nNorm = quitarPref(cli?.nombre||"");
      const busqNorm = quitarPref(detBusq);
      if(!nNorm.includes(busqNorm)) return false;
    }
    if(detFamilia && detFamilia!=="Todas") {
      const tieneFamily = (f.items||[]).some((it: any)=>{
        const art=articulos.find((a: any)=>a.id===it.artId||a.codigo===it.codigo);
        return (typeof art?.familia === "string" ? art.familia : art?.familia?.nombre)===detFamilia;
      });
      if(!tieneFamily) return false;
    }
    return true;
  }).sort((a: any,b: any)=>b.fecha.localeCompare(a.fecha));

  const familiasDetalle = [...new Set(
    facturas.filter((f: any)=>!f.anulada&&f.fecha>=desde&&f.fecha<=hasta)
      .flatMap((f: any)=>(f.items||[]).map((it: any)=>{
        const art=articulos.find((a: any)=>a.id===it.artId||a.codigo===it.codigo);
        return typeof art?.familia === "string" ? art.familia : art?.familia?.nombre;
      }).filter(Boolean))
  )].sort();

  return (
    <>
      {filtroPeriodoJSX}
      <div style={{marginBottom:14,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:1,minWidth:200,maxWidth:340}}>
          <BuscadorCliente
            clientes={clientes}
            valor={detClienteId || ""}
            onChange={(val: any) => { setDetClienteId(val || ""); setDetBusq(""); }}
            placeholder="Buscar cliente..."
          />
        </div>
        {(detClienteId)&&(
          <Btn v="ghost" onClick={()=>{setDetClienteId("");}} style={{padding:"5px 8px",fontSize:11}}>✕ Limpiar</Btn>
        )}
        <select value={detFamilia||"Todas"} onChange={(e:any)=>setDetFamilia(e.target.value)}
          style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${detFamilia&&detFamilia!=="Todas"?t.accent:t.border}`,background:detFamilia&&detFamilia!=="Todas"?t.accentBg:t.surf,color:detFamilia&&detFamilia!=="Todas"?t.accent:t.sub,fontSize:12,fontWeight:600,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",cursor:"pointer",outline:"none"}}>
          <option value="Todas">Todas las familias</option>
          {familiasDetalle.map((f: any)=><option key={f} value={f}>{f}</option>)}
        </select>
        <span style={{fontSize:12,color:t.muted,marginLeft:4}}>{facsFiltradas.length} factura{facsFiltradas.length!==1?"s":""}</span>
      </div>

      {facsFiltradas.length===0
        ? <div style={{textAlign:"center",padding:"48px 0",color:t.muted,fontSize:14}}>Sin facturas en el período.</div>
        : <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
            {facsFiltradas.map((fac: any,i: number)=>{
              const cli = clientes.find((c: any)=>c.id===fac.clienteId);
              const expandida = detExpFac[fac.id];
              const items = fac.items||[];
              return <React.Fragment key={fac.id}>
                {/* Fila factura */}
                <div onClick={()=>{setDetExpFac((prev: any)=>({...prev,[fac.id]:!prev[fac.id]}));if(detBusq&&!detClienteId){setDetClienteId(String(fac.clienteId));setDetBusq("");}}}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderBottom:`1px solid ${t.border}`,background:i%2===0?t.surf:t.surf2,cursor:"pointer",userSelect:"none"}}>
                  <span style={{fontSize:11,color:t.muted,minWidth:20}}>{expandida?"▼":"▶"}</span>
                  <span style={{fontSize:12,color:t.muted,minWidth:86,fontFamily:"'Consolas','Courier New',monospace"}}>{fac.fecha}</span>
                  {!detClienteId&&<span style={{fontWeight:700,color:t.text,flex:1,fontSize:13}}>{cli?.nombre||`Cliente ${fac.clienteId}`}</span>}
                  {detClienteId&&<span style={{flex:1}}/>}
                  <span style={{fontSize:11,color:t.muted,marginRight:8}}>{fac.numero||""}</span>
                  <span style={{fontWeight:800,color:t.accent,fontFamily:"'Consolas','Courier New',monospace",fontSize:13}}>{fmtMoney(fac.total||0)}</span>
                  <span style={{fontSize:11,minWidth:60,textAlign:"right",color:items.length>0?t.sub:t.muted}}>{items.length} art.</span>
                </div>
                {/* Detalle artículos */}
                {expandida&&<div style={{background:t.surf2,borderBottom:`1px solid ${t.border}`}}>
                  {items.length===0
                    ? <div style={{padding:"8px 24px",fontSize:12,color:t.muted}}>Sin artículos registrados</div>
                    : <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{background:t.surf3||t.surf2}}>
                          {["Código","Artículo","Cant.","Precio unit.","Total"].map((h,j)=>(
                            <th key={h} style={{padding:"5px 14px",textAlign:j>=2?"right":"left",fontWeight:600,color:t.muted,fontSize:10,letterSpacing:"0.4px",textTransform:"uppercase",borderBottom:`1px solid ${t.border}`}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {items.map((it: any,j: number)=>{
                            const art = articulos.find((a: any)=>a.id===it.artId||a.codigo===it.codigo);
                            const cant = parseFloat(it.cantidad)||0;
                            const precio = parseFloat(it.precio)||0;
                            return <tr key={j} style={{borderBottom:`1px solid ${t.border}44`,background:j%2===0?"transparent":t.surf2+"44"}}>
                              <td style={{padding:"5px 14px",color:t.muted,fontFamily:"'Consolas','Courier New',monospace",fontSize:11}}>{it.codigo||art?.codigo||""}</td>
                              <td style={{padding:"5px 14px",color:t.text,fontWeight:500}}>{it.nombre||art?.nombre||"—"}</td>
                              <td style={{padding:"5px 14px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.accent}}>{cant}</td>
                              <td style={{padding:"5px 14px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",color:t.sub}}>{fmtMoney(precio)}</td>
                              <td style={{padding:"5px 14px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.accent}}>{fmtMoney(cant*precio)}</td>
                            </tr>;
                          })}
                          {(()=>{
                            let costo=0;
                            items.forEach((it: any)=>{
                              const art=articulos.find((a: any)=>a.id===it.artId||a.codigo===it.codigo);
                              const is666or667 = it.codigo === "666" || it.codigo === "667";
                              if((art?.llevaStock===false && !is666or667)||it.codigo==="044") return;
                              const cant=parseFloat(it.cantidad)||0;
                              const costoU=parseFloat(it.costoUnit)||(art?.costo||0);
                              costo+=cant*costoU;
                            });
                            const ingreso=fac.total||0;
                            const ganancia=ingreso-costo;
                            const margen=ingreso>0?ganancia/ingreso*100:0;
                            return <>
                              <tr style={{background:t.accentBg,borderTop:`2px solid ${t.accent}33`}}>
                                <td colSpan={4} style={{padding:"6px 14px",fontWeight:800,color:t.text,fontSize:12}}>Total factura</td>
                                <td style={{padding:"6px 14px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.accent}}>{fmtMoney(ingreso)}</td>
                              </tr>
                              {costo>0&&<tr style={{background:t.surf2,borderTop:`1px solid ${t.border}44`}}>
                                <td style={{padding:"4px 14px",fontSize:11,color:t.muted}}>CMV</td>
                                <td colSpan={3} style={{padding:"4px 14px",textAlign:"right",fontSize:11,color:t.sub}}></td>
                                <td style={{padding:"4px 14px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.amber}}>{fmtMoney(costo)}</td>
                              </tr>}
                              {costo>0&&<tr style={{background:t.surf2}}>
                                <td style={{padding:"4px 14px 6px",fontSize:11,fontWeight:700,color:ganancia>=0?t.green:t.red}}>
                                  Ganancia · {margen.toFixed(1)}%
                                </td>
                                <td colSpan={3}/>
                                <td style={{padding:"4px 14px 6px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:800,color:ganancia>=0?t.green:t.red}}>{fmtMoney(ganancia)}</td>
                              </tr>}
                            </>;
                          })()}
                        </tbody>
                      </table>
                  }
                </div>}
              </React.Fragment>;
            })}
          </div>
      }
    </>
  );
}
