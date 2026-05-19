import React from "react";
import { fmtMoney } from "../../../../lib/utils";

const fmtNum = (n: any) => typeof n === 'number' ? n.toLocaleString('es-AR') : n;

export default function TabFamilias({
  ventasFamilia,
  filtroPeriodoJSX,
  t
}: any) {
  return (
    <>
      {filtroPeriodoJSX}
      {ventasFamilia.length===0
        ? <div style={{textAlign:"center",padding:"48px 0",color:t.muted,fontSize:14}}>Sin ventas en el período.</div>
        : <div style={{border:`1px solid ${t.border}`,borderRadius:4,overflow:"auto",color:t.text}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed"}}>
              <colgroup><col/><col style={{width:100}}/><col style={{width:130}}/><col style={{width:130}}/><col style={{width:130}}/><col style={{width:100}}/><col style={{width:160}}/></colgroup>
              <thead><tr style={{background:t.surf2}}>
                {[["Familia","left"],["Unidades","right"],["Costo Total","right"],["Total Vendido","right"],["Ganancia $","right"],["Margen %","right"],["Participación","left"]].map(([h,align])=>(
                  <th key={h} style={{padding:"5px 8px",fontSize:10,fontWeight:600,color:t.muted,textAlign:align as any,letterSpacing:"0.4px",textTransform:"uppercase",borderBottom:`2px solid ${t.border}`,borderRight:`1px solid ${t.border}`,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ventasFamilia.map((r: any,i: number)=>{
                  const totVentas=ventasFamilia.reduce((s: any,x: any)=>s+x.ingreso,0);
                  const partic=totVentas>0?r.ingreso/totVentas*100:0;
                  return <tr key={i} style={{borderBottom:`1px solid ${t.border}`,background:i%2===0?t.surf:t.surf2,color:t.text}}>
                    <td style={{padding:"6px 10px",fontWeight:700,color:t.text,borderRight:`1px solid ${t.border}`}}>{r.familia}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,borderRight:`1px solid ${t.border}`}}>{fmtNum(r.unidades)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.sub,borderRight:`1px solid ${t.border}`}}>{fmtMoney(r.costo)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:600,color:t.accent,borderRight:`1px solid ${t.border}`}}>{fmtMoney(r.ingreso)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:700,color:r.esServicio?t.muted:r.ganancia>=0?t.green:t.red,borderRight:`1px solid ${t.border}`}}>{r.esServicio?"—":fmtMoney(r.ganancia)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontSize:11,fontWeight:700,color:r.esServicio?t.muted:r.margen>=20?t.green:r.margen>=10?t.amber:t.red,borderRight:`1px solid ${t.border}`}}>{r.esServicio?"—":`${r.margen?.toFixed(1)}%`}</td>
                    <td style={{padding:"6px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{flex:1,height:6,background:t.surf2,borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:`${partic}%`,height:"100%",background:t.accent,borderRadius:3}}/>
                        </div>
                        <span style={{fontSize:11,color:t.sub,minWidth:36,fontFamily:"'Consolas','Courier New',monospace"}}>{partic.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>;
                })}
                <tr style={{background:t.surf2,borderTop:`2px solid ${t.border}`}}>
                  <td style={{padding:"8px 10px",fontWeight:800,color:t.text,borderRight:`1px solid ${t.border}`}}>TOTAL</td>
                  <td style={{borderRight:`1px solid ${t.border}`}}/>
                  <td style={{padding:"8px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.sub,borderRight:`1px solid ${t.border}`}}>{fmtMoney(ventasFamilia.reduce((s: any,r: any)=>s+r.costo,0))}</td>
                  <td style={{padding:"8px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.accent,borderRight:`1px solid ${t.border}`}}>{fmtMoney(ventasFamilia.reduce((s: any,r: any)=>s+r.ingreso,0))}</td>
                  <td style={{padding:"8px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.green,borderRight:`1px solid ${t.border}`}}>{fmtMoney(ventasFamilia.reduce((s: any,r: any)=>s+r.ganancia,0))}</td>
                  <td colSpan={2}/>
                </tr>
              </tbody>
            </table>
          </div>
      }
    </>
  );
}
