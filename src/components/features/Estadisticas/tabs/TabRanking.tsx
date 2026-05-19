import React from "react";
import { fmtMoney } from "../../../../lib/utils";
import { Tbl, Tr, Td, ThSort } from "../../../common/UIBase";
import { BarraMar } from "./BarraMar";

export default function TabRanking({
  rankingData,
  topIngreso,
  filtroPeriodoJSX,
  skRank,
  sdRank,
  tsRank,
  t
}: any) {
  return (
    <>
      {filtroPeriodoJSX}
      {rankingData.length===0
        ? <div style={{textAlign:"center",padding:"48px 0",color:t.muted,fontSize:14}}>Sin facturas en el período seleccionado.</div>
        : <><Tbl headers={[
            "#",
            <ThSort label="Cliente"    colKey="nombre"   sortKey={skRank} sortDir={sdRank} onSort={tsRank}/>,
            <ThSort label="Facturas"   colKey="facturas" sortKey={skRank} sortDir={sdRank} onSort={tsRank} align="right"/>,
            <ThSort label="Facturado"  colKey="ingreso"  sortKey={skRank} sortDir={sdRank} onSort={tsRank} align="right"/>,
            "CMV",
            <ThSort label="Ganancia $" colKey="ganancia" sortKey={skRank} sortDir={sdRank} onSort={tsRank} align="right"/>,
            <ThSort label="Margen %"   colKey="margen"   sortKey={skRank} sortDir={sdRank} onSort={tsRank} align="right"/>,
            "Participación"]}>
            {rankingData.map((r: any,i: number)=>(
              <Tr key={i}>
                <Td><div style={{width:26,height:26,borderRadius:"50%",background:i<3?t.accentBg:t.surf2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i<3?t.accent:t.muted}}>{i+1}</div></Td>
                <Td style={{fontWeight:600}}>{r.nombre}</Td>
                <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,textAlign:"center"}}>{r.facturas}</Td>
                <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:700,color:t.accent}}>{fmtMoney(r.ingreso)}</Td>
                <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,color:t.sub}}>{fmtMoney(r.costo)}</Td>
                <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:13,fontWeight:700,color:r.ganancia>=0?t.green:t.red}}>{fmtMoney(r.ganancia)}</Td>
                <Td style={{minWidth:110}}><BarraMar val={r.margen} t={t} /></Td>
                <Td style={{minWidth:120}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{flex:1,height:5,background:t.surf2,borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${(r.ingreso/topIngreso)*100}%`,height:"100%",background:t.accent,borderRadius:3}}/>
                    </div>
                    <span style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.sub,minWidth:38}}>{((r.ingreso/topIngreso)*100).toFixed(0)}%</span>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbl>
        </>
      }
    </>
  );
}
