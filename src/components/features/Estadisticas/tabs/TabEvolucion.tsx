import React from "react";
import { fmtMoney } from "../../../../lib/utils";
import { Sel, Inp } from "../../../common/UIBase";

export default function TabEvolucion({
  evolucionMensual,
  evMeses,
  setEvMeses,
  evDesde,
  setEvDesde,
  evHasta,
  setEvHasta,
  evMetrica,
  setEvMetrica,
  evFamActivas,
  setEvFamActivas,
  familias,
  t
}: any) {
  const MESES_LABEL = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const COLORES_FAM_DEF = ["#378ADD","#1D9E75","#D85A30","#BA7517","#534AB7","#D4537E","#639922","#E24B4A"];
  const colorCV = "#8B5CF6";
  const { meses, familias: famEv, datos } = evolucionMensual;
  
  const getColorFam = (famName: any, fi: any) => {
    if (famName === "Carga Virtual") return colorCV;
    if (famName === "📈 Utilidad FCI") return t.accent;
    const found = (familias || []).find((f: any) => (typeof f === "string" ? f : f.nombre) === famName);
    if (found && typeof found === "object" && found.color) return found.color;
    return COLORES_FAM_DEF[fi % COLORES_FAM_DEF.length];
  };
  const sinDatos = meses.length===0 || famEv.length===0;
  const fmtLabel = (mes: any) => { const [y,m] = mes.split("-"); return `${MESES_LABEL[parseInt(m)]} ${y.slice(2)}`; };
  const fmtVal = (v: any, metrica: any) => metrica==="unidades" ? Math.round(v).toLocaleString("es-AR")+" u." : fmtMoney(v);
  
  const getEvVal = (datos: any, mes: any, familia: any) => {
    const d = datos[mes]?.[familia];
    if(!d) return 0;
    if(evMetrica==="ganancia") return d.ingreso - d.costo;
    return d[evMetrica]||0;
  };

  const todasActivas = evFamActivas.length===0;
  const familiasVis = todasActivas ? famEv : famEv.filter((f: any)=>evFamActivas.includes(f));
  
  const toggleFam = (fam: any) => {
    setEvFamActivas((prev: any) => {
      if(todasActivas) return famEv.filter((f: any)=>f!==fam);
      return prev.includes(fam) ? prev.filter((f: any)=>f!==fam) : [...prev,fam];
    });
  };

  const GraficoBarras = () => {
    if(sinDatos) return null;
    const maxVal = Math.max(1, ...meses.map((m: any) => familiasVis.reduce((s: any,f: any)=>s+Math.abs(getEvVal(datos,m,f)),0)));
    const fmtY = (v: any) => v>=1000000?(v/1000000).toFixed(1)+"M":v>=1000?(v/1000).toFixed(0)+"K":v;
    
    return (
      <div style={{border:`1px solid ${t.border}`, borderRadius:12, padding:"20px", marginBottom:24, background:t.surf}}>
        <div style={{fontSize:13, fontWeight:700, color:t.text, marginBottom:16}}>Evolución Mensual</div>
        <div style={{position:"relative", width:"100%", overflowX:"auto"}}>
          <div style={{position:"absolute", left:0, top:0, bottom:20, width:40, background:t.surf, zIndex:10, display:"flex", alignItems:"flex-start", paddingTop:40}}>
             <div style={{position:"absolute", left:0, top:0, fontSize:10, fontWeight:600, color:t.muted}}>{fmtY(maxVal)}</div>
             <div style={{position:"absolute", right:0, bottom:20, top:0, width:1, background:t.border}}></div>
          </div>
          <div style={{display:"flex", gap:0, alignItems:"flex-end", height:200, paddingLeft:40, position:"relative", width: "100%"}}>
            <svg width="100%" height="160" style={{position: "absolute", left: 0, bottom: 25, overflow: "visible", pointerEvents: "none"}}>
              {meses.length > 1 && (() => {
                const puntos = meses.map((mes: any,mi: any) => {
                  const total = familiasVis.reduce((s: any,f: any)=>s+Math.abs(getEvVal(datos,mes,f)),0);
                  const leftOffsetPx = 40;
                  const pctX = (mi + 0.5) / meses.length;
                  const y = 160 - Math.max(1, (total / maxVal) * 140);
                  return { x: `calc(${leftOffsetPx}px + (100% - ${leftOffsetPx}px) * ${pctX})`, y, total };
                });
                
                return <g>
                  {puntos.slice(1).map((p: any,i: any)=>(
                    <line key={i}
                      x1={puntos[i].x} y1={puntos[i].y}
                      x2={p.x} y2={p.y}
                      stroke={t.accent} strokeWidth={2} strokeDasharray="4 2" opacity={0.6}/>
                  ))}
                  {puntos.map((p: any,i: any)=>(
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={4} fill={t.accentBg} stroke={t.accent} strokeWidth={1.5}/>
                      <text x={p.x} y={p.y-8} textAnchor="middle" fontSize={10} fill={t.accent} fontWeight="700">
                        {fmtY(Math.round(p.total))}
                      </text>
                    </g>
                  ))}
                </g>;
              })()}
            </svg>

            {meses.map((mes: any,mi: any)=>{
              const total = familiasVis.reduce((s: any,f: any)=>s+Math.abs(getEvVal(datos,mes,f)),0);
              const isZero = total === 0;
              return (
                <div key={mes} style={{display:"flex", flexDirection:"column", alignItems:"center", flex:1, zIndex:1, paddingBottom: 6}}>
                  <div style={{display:"flex", alignItems:"flex-end", gap:2, height:160, marginBottom: 8}}>
                    {familiasVis.map((fam: any,fi: any)=>{
                      const v = getEvVal(datos,mes,fam);
                      const h = Math.max(isZero ? 0 : 2, (Math.abs(v)/maxVal)*140);
                      const isPos = v >= 0;
                      return <div key={fam} style={{width: 8, height: h, background: getColorFam(fam, fi), borderRadius: 2, opacity: isPos ? 1 : 0.6}} title={`${fam}: ${fmtVal(v, evMetrica)}`} />;
                    })}
                  </div>
                  <div style={{fontSize:11, fontWeight:600, color:t.text, textAlign:"center", lineHeight:1.1, whiteSpace:"nowrap"}}>{fmtLabel(mes)}</div>
                </div>
              );
            })}
            <div style={{position:"absolute", left:40, bottom:25, right:0, height:1, background:t.border}}></div>
          </div>
        </div>
      </div>
    );
  };

  return <>
    {/* Controles */}
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:20,padding:"14px 16px",background:t.surf2,borderRadius:12,border:`1px solid ${t.border}`}}>
      <span style={{fontSize:11,fontWeight:700,color:t.sub,letterSpacing:"0.8px",textTransform:"uppercase"}}>Período</span>
      <Sel value={evMeses} onChange={(e:any)=>setEvMeses(e.target.value)} style={{fontSize:12,minWidth:160}}>
        <option value="3">Últimos 3 meses</option>
        <option value="6">Últimos 6 meses</option>
        <option value="12">Últimos 12 meses</option>
        <option value="custom">Personalizado</option>
      </Sel>
      {evMeses==="custom"&&<>
        <Inp type="month" value={evDesde} onChange={(e:any)=>setEvDesde(e.target.value)} style={{fontSize:12,width:140}}/>
        <span style={{color:t.muted,fontSize:13}}>→</span>
        <Inp type="month" value={evHasta} onChange={(e:any)=>setEvHasta(e.target.value)} style={{fontSize:12,width:140}}/>
      </>}
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
        <Sel value={evMetrica} onChange={(e:any)=>setEvMetrica(e.target.value)} style={{fontSize:12}}>
          <option value="ingreso">Facturado</option>
          <option value="ganancia">Ganancia</option>
          <option value="unidades">Unidades</option>
        </Sel>
      </div>
    </div>

    {sinDatos
      ? <div style={{textAlign:"center",padding:"48px 0",color:t.muted,fontSize:14}}>Sin datos de ventas en el período.</div>
      : <>
        {/* Leyenda con toggle por familia */}
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12,alignItems:"center"}}>
          {famEv.map((fam: any,fi: any)=>{
            const activa = todasActivas || evFamActivas.includes(fam);
            return (
              <span key={fam} onClick={()=>toggleFam(fam)} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,cursor:"pointer",padding:"3px 8px",borderRadius:6,border:`1px solid ${activa?getColorFam(fam,fi)+"66":t.border}`,background:activa?getColorFam(fam,fi)+"15":"none",color:activa?t.text:t.muted,userSelect:"none",opacity:activa?1:0.5}}>
                <span style={{width:10,height:10,borderRadius:2,background:activa?getColorFam(fam,fi):t.muted,flexShrink:0}}/>
                {fam}
              </span>
            );
          })}
        </div>
        <GraficoBarras/>
        {/* Tabla */}
        <div style={{border:`1px solid ${t.border}`,borderRadius:4,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:t.surf2}}>
                <th style={{padding:"5px 10px",fontSize:10,fontWeight:600,color:t.muted,textAlign:"left",borderBottom:`2px solid ${t.border}`,borderRight:`1px solid ${t.border}`,textTransform:"uppercase",letterSpacing:"0.4px"}}>Mes</th>
                {familiasVis.map((fam: any,fi: any)=>(
                  <th key={fam} style={{padding:"5px 10px",fontSize:10,fontWeight:600,color:getColorFam(fam,fi),textAlign:"right",borderBottom:`2px solid ${t.border}`,borderRight:`1px solid ${t.border}`,textTransform:"uppercase",letterSpacing:"0.4px"}}>{fam}</th>
                ))}
                <th style={{padding:"5px 10px",fontSize:10,fontWeight:600,color:t.muted,textAlign:"right",borderBottom:`2px solid ${t.border}`,textTransform:"uppercase",letterSpacing:"0.4px"}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((mes: any,i: any)=>{
                const total = familiasVis.reduce((s: any,fam: any)=>s+getEvVal(datos,mes,fam),0);
                return <tr key={mes} style={{borderBottom:`1px solid ${t.border}`,background:i%2===0?t.surf:t.surf2}}>
                  <td style={{padding:"5px 10px",fontWeight:600,color:t.text,borderRight:`1px solid ${t.border}`}}>{fmtLabel(mes)}</td>
                  {familiasVis.map((fam: any,fi: any)=>{
                    const v = getEvVal(datos,mes,fam);
                    return <td key={fam} style={{padding:"5px 10px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",color:getColorFam(fam,fi),fontWeight:600,borderRight:`1px solid ${t.border}`}}>{fmtVal(v, evMetrica)}</td>;
                  })}
                  <td style={{padding:"5px 10px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.text}}>{fmtVal(total, evMetrica)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </>
    }
  </>;
}
