import React from "react";
import { fmtMoney } from "../../../../lib/utils";
import { BarraMar } from "./BarraMar";

const fmtNum = (n: any) => typeof n === 'number' ? n.toLocaleString('es-AR') : n;

export default function TabCMVG({
  cmvgData,
  cmvgPorFamilia,
  totCMVG,
  margenTotal,
  filtroPeriodoJSX,
  filtrosArticulosJSX,
  t
}: any) {
  return (
    <>
      {filtroPeriodoJSX}
      {filtrosArticulosJSX}
      {cmvgData.length===0
        ? <div style={{textAlign:"center",padding:"48px 0",color:t.muted,fontSize:14}}>Sin ventas con artículos en el período seleccionado.</div>
        : <>
          <div style={{border:`1px solid ${t.border}`,borderRadius:4,overflow:"auto",marginBottom:16,color:t.text}}>
            <table style={{width:"max-content",minWidth:"100%",borderCollapse:"collapse",fontSize:12}}>
              <colgroup>
                <col style={{width:70}}/><col style={{width:180}}/><col style={{width:70}}/><col/><col style={{width:125}}/><col style={{width:125}}/><col style={{width:130}}/><col style={{width:125}}/><col style={{width:110}}/>
              </colgroup>
              <thead>
                <tr style={{background:t.surf2,position:"sticky",top:0}}>
                  {[["Cód.","left"],["Artículo","left"],["Cant.","right"],["Costo","right"],["Costo Total","right"],["Precio P.P.","right"],["Total Vend.","right"],["Ganancia $","right"],["Margen %","right"]].map(([h,align])=>(
                    <th key={h} style={{padding:"5px 8px",fontSize:10,fontWeight:600,color:t.muted,textAlign:align as any,letterSpacing:"0.4px",textTransform:"uppercase",borderBottom:`2px solid ${t.border}`,borderRight:`1px solid ${t.border}`,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(cmvgPorFamilia).map(([familia,items]: [string, any])=>{
                  const totFam: any=(items as any[]).reduce((s:any,r:any)=>({ingreso:s.ingreso+r.ingreso,costo:s.costo+r.costo,ganancia:s.ganancia+r.ganancia}),{ingreso:0,costo:0,ganancia:0});
                  const margenFam=totFam.ingreso>0?totFam.ganancia/totFam.ingreso*100:0;
                  return (
                    <React.Fragment key={familia}>
                      <tr style={{background:t.accent+"12"}}>
                        <td colSpan={9} style={{padding:"5px 10px",fontWeight:700,fontSize:11,color:t.accent,letterSpacing:"0.5px",textTransform:"uppercase",borderTop:`1px solid ${t.border}`}}>{familia}</td>
                      </tr>
                      {(items as any[]).map((r,i)=>{
                        const costoUnit = r.unidades>0?r.costo/r.unidades:0;
                        return (
                          <tr key={i} style={{borderBottom:`1px solid ${t.border}33`,background:i%2===0?t.surf:t.surf2,color:t.text}}>
                            <td style={{padding:"4px 8px",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.muted,borderRight:`1px solid ${t.border}`,whiteSpace:"nowrap"}}>{r.codigo}</td>
                            <td style={{padding:"4px 8px",fontWeight:600,color:t.text,borderRight:`1px solid ${t.border}`,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:220}} title={r.nombre}>{r.nombre}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.text,borderRight:`1px solid ${t.border}`}}>{fmtNum(r.unidades)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.sub,borderRight:`1px solid ${t.border}`}}>{fmtMoney(costoUnit)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.sub,borderRight:`1px solid ${t.border}`}}>{fmtMoney(r.costo)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.sub,borderRight:`1px solid ${t.border}`}}>{fmtMoney(r.precioPromPond)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:600,color:t.accent,borderRight:`1px solid ${t.border}`}}>{fmtMoney(r.ingreso)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:700,color:r.esServicio?t.muted:r.ganancia>=0?t.green:t.red,borderRight:`1px solid ${t.border}`}}>{r.esServicio?"—":fmtMoney(r.ganancia)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",fontSize:11}}>{r.esServicio?"—":<BarraMar val={r.margen||0} t={t} />}</td>
                          </tr>
                        );
                      })}
                      <tr style={{background:t.surf2,borderTop:`1px solid ${t.border}`}}>
                        <td colSpan={4} style={{padding:"5px 10px",fontSize:11,color:t.sub,fontStyle:"italic",borderRight:`1px solid ${t.border}`}}>Total {familia}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.sub,borderRight:`1px solid ${t.border}`}}>{fmtMoney(totFam.costo)}</td>
                        <td style={{borderRight:`1px solid ${t.border}`}}/>
                        <td style={{padding:"5px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.accent,borderRight:`1px solid ${t.border}`}}>{fmtMoney(totFam.ingreso)}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:totFam.ganancia>=0?t.green:t.red,borderRight:`1px solid ${t.border}`}}>{fmtMoney(totFam.ganancia)}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",fontSize:11,fontWeight:700,color:margenFam>=20?t.green:margenFam>=10?t.amber:t.red}}>{margenFam.toFixed(1)}%</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                <tr style={{background:t.surf2,borderTop:`2px solid ${t.border}`}}>
                  <td colSpan={4} style={{padding:"8px 10px",fontWeight:800,fontSize:12,color:t.text,borderRight:`1px solid ${t.border}`}}>TOTAL GENERAL</td>
                  <td style={{padding:"8px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.sub,borderRight:`1px solid ${t.border}`}}>{fmtMoney(totCMVG.costo)}</td>
                  <td style={{borderRight:`1px solid ${t.border}`}}/>
                  <td style={{padding:"8px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.accent,borderRight:`1px solid ${t.border}`}}>{fmtMoney(totCMVG.ingreso)}</td>
                  <td style={{padding:"8px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:totCMVG.ganancia>=0?t.green:t.red,borderRight:`1px solid ${t.border}`}}>{fmtMoney(totCMVG.ganancia)}</td>
                  <td style={{padding:"8px 8px",textAlign:"right",fontWeight:800,color:margenTotal>=20?t.green:margenTotal>=10?t.amber:t.red}}>{margenTotal.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      }
    </>
  );
}
