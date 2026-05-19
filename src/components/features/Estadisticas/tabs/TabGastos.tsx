import React from "react";
import { fmtMoney } from "../../../../lib/utils";

export default function TabGastos({
  gastosFiltrados,
  totGastos,
  filtConcepto,
  setFiltConcepto,
  conceptosDisponibles,
  detalleExpandido,
  setDetalleExpandido,
  movimientosConcepto,
  cuentas,
  filtroPeriodoJSX,
  t
}: any) {
  return (
    <>
      {filtroPeriodoJSX}
      <div style={{marginBottom:14}}>
        <select value={filtConcepto} onChange={(e:any)=>setFiltConcepto(e.target.value)}
          style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${filtConcepto!=="Todos"?t.accent:t.border}`,background:filtConcepto!=="Todos"?t.accentBg:t.surf,color:filtConcepto!=="Todos"?t.accent:t.sub,fontSize:12,fontWeight:600,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",cursor:"pointer",outline:"none"}}>
          <option value="Todos">Todos los conceptos</option>
          {conceptosDisponibles.map((c: any)=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {gastosFiltrados.length===0
        ? <div style={{textAlign:"center",padding:"48px 0",color:t.muted,fontSize:14}}>Sin gastos registrados en el período.</div>
        : <>
          <div style={{border:`1px solid ${t.border}`,borderRadius:4,overflow:"auto",marginBottom:16,color:t.text}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:t.surf2}}>
                {["Concepto","Cantidad","Total","Participación"].map((h,i)=>(
                  <th key={h} style={{padding:"5px 10px",fontSize:10,fontWeight:600,color:t.muted,textAlign:(i>=1?"right":i===3?"left":"left") as any,letterSpacing:"0.4px",textTransform:"uppercase",borderBottom:`2px solid ${t.border}`,borderRight:i<3?`1px solid ${t.border}`:"none",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {gastosFiltrados.map((r: any,i: number)=>{
                  const partic=totGastos>0?r.total/totGastos*100:0;
                  const expandido = detalleExpandido[r.concepto];
                  const movsDet = (movimientosConcepto[r.concepto]||[]).sort((a: any,b: any)=>b.fecha.localeCompare(a.fecha));
                  return <React.Fragment key={i}>
                    <tr style={{borderBottom:`1px solid ${t.border}`,background:i%2===0?t.surf:t.surf2,cursor:"pointer"}}
                      onClick={()=>setDetalleExpandido((prev: any)=>({...prev,[r.concepto]:!prev[r.concepto]}))}>
                      <td style={{padding:"5px 10px",fontWeight:600,color:t.text,borderRight:`1px solid ${t.border}`}}>
                        <span style={{marginRight:6,fontSize:10,color:t.muted}}>{expandido?"▼":"▶"}</span>{r.concepto}
                      </td>
                      <td style={{padding:"5px 10px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,borderRight:`1px solid ${t.border}`}}>{r.cantidad}</td>
                      <td style={{padding:"5px 10px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.red,borderRight:`1px solid ${t.border}`}}>{fmtMoney(r.total)}</td>
                      <td style={{padding:"5px 10px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{flex:1,height:6,background:t.surf2,borderRadius:3,overflow:"hidden"}}>
                            <div style={{width:`${partic}%`,height:"100%",background:t.amber,borderRadius:3}}/>
                          </div>
                          <span style={{fontSize:11,color:t.sub,minWidth:36,fontFamily:"'Consolas','Courier New',monospace"}}>{partic.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                    {expandido&&movsDet.map((m: any,j: number)=>(
                      <tr key={j} style={{background:t.surf2,borderBottom:`1px solid ${t.border}44`}}>
                        <td style={{padding:"4px 10px 4px 28px",fontSize:11,color:t.sub,borderRight:`1px solid ${t.border}`}}>
                          {m.fecha} {m.obs||m.concepto||""} {m.unidadNegocio && m.unidadNegocio !== "General" ? <span style={{color:t.accent, fontWeight:600}}>[{m.unidadNegocio}]</span> : ""}
                        </td>
                        <td style={{borderRight:`1px solid ${t.border}`}}/>
                        <td style={{padding:"4px 10px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.red,borderRight:`1px solid ${t.border}`}}>{fmtMoney(m.monto||0)}</td>
                        <td style={{padding:"4px 10px",fontSize:11,color:t.muted}}>
                          {cuentas?.find((c: any)=>c.id===m.cuentaId)?.nombre||""}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>;
                })}
                <tr style={{background:t.surf2,borderTop:`2px solid ${t.border}`}}>
                  <td colSpan={2} style={{padding:"8px 10px",fontWeight:800,color:t.text,borderRight:`1px solid ${t.border}`}}>TOTAL</td>
                  <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.red,borderRight:`1px solid ${t.border}`}}>{fmtMoney(totGastos)}</td>
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      }
    </>
  );
}
