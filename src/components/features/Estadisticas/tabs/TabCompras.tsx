import React from "react";
import { fmtMoney } from "../../../../lib/utils";

export default function TabCompras({
  comprasProveedor,
  totCompras,
  filtroPeriodoJSX,
  t
}: any) {
  return (
    <>
      {filtroPeriodoJSX}
      {comprasProveedor.length===0
        ? <div style={{textAlign:"center",padding:"48px 0",color:t.muted,fontSize:14}}>Sin compras en el período.</div>
        : <>
          <div style={{border:`1px solid ${t.border}`,borderRadius:4,overflow:"auto",marginBottom:16,color:t.text}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:t.surf2}}>
                {["#","Proveedor","Facturas","Total Comprado","Participación"].map((h,i)=>(
                  <th key={h} style={{padding:"5px 10px",fontSize:10,fontWeight:600,color:t.muted,textAlign:(i>=2?"right":i===4?"left":"left") as any,letterSpacing:"0.4px",textTransform:"uppercase",borderBottom:`2px solid ${t.border}`,borderRight:i<4?`1px solid ${t.border}`:"none",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {comprasProveedor.map((r: any,i: number)=>{
                  const partic=totCompras>0?r.total/totCompras*100:0;
                  return <tr key={i} style={{borderBottom:`1px solid ${t.border}`,background:i%2===0?t.surf:t.surf2}}>
                    <td style={{padding:"5px 10px",color:t.muted,fontSize:11,borderRight:`1px solid ${t.border}`}}>{i+1}</td>
                    <td style={{padding:"5px 10px",fontWeight:600,color:t.text,borderRight:`1px solid ${t.border}`}}>{r.nombre}</td>
                    <td style={{padding:"5px 10px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:11,borderRight:`1px solid ${t.border}`}}>{r.facturas}</td>
                    <td style={{padding:"5px 10px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.red,borderRight:`1px solid ${t.border}`}}>{fmtMoney(r.total)}</td>
                    <td style={{padding:"5px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{flex:1,height:6,background:t.surf2,borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:`${partic}%`,height:"100%",background:t.red,borderRadius:3}}/>
                        </div>
                        <span style={{fontSize:11,color:t.sub,minWidth:36,fontFamily:"'Consolas','Courier New',monospace"}}>{partic.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>;
                })}
                <tr style={{background:t.surf2,borderTop:`2px solid ${t.border}`}}>
                  <td colSpan={3} style={{padding:"8px 10px",fontWeight:800,color:t.text,borderRight:`1px solid ${t.border}`}}>TOTAL</td>
                  <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.red,borderRight:`1px solid ${t.border}`}}>{fmtMoney(totCompras)}</td>
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
