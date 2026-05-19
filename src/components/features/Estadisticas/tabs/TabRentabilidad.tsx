import React from "react";
import { fmtMoney } from "../../../../lib/utils";
import { Tbl, Tr, Td, ThSort, Btn } from "../../../common/UIBase";
import { BuscadorCliente } from "../../Clientes/BuscadorCliente";
import { BarraMar } from "./BarraMar";

const fmtFechaCC = (f: any) => f ? f.split('-').reverse().join('/') : '';

export default function TabRentabilidad({
  rentData,
  totRent,
  filtRentCliente,
  setFiltRentCliente,
  busqRentCliente,
  setBusqRentCliente,
  clientes,
  articulos,
  filtroPeriodoJSX,
  skRent,
  sdRent,
  tsRent,
  t
}: any) {
  return (
    <>
      {filtroPeriodoJSX}
      <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",maxWidth:380,position:"relative"}}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <BuscadorCliente
            clientes={clientes}
            valor={filtRentCliente === "Todos" ? "" : filtRentCliente}
            onChange={(val: any) => { setFiltRentCliente(val || "Todos"); setBusqRentCliente(""); }}
            placeholder="Todos los clientes"
          />
        </div>
        {(filtRentCliente!=="Todos")&&(
          <Btn v="ghost" onClick={()=>{setBusqRentCliente("");setFiltRentCliente("Todos");}} style={{padding:"5px 8px",fontSize:11,flexShrink:0}}>✕</Btn>
        )}
      </div>
      {rentData.length===0
        ? <div style={{textAlign:"center",padding:"48px 0",color:t.muted,fontSize:14}}>Sin facturas en el período seleccionado.</div>
        : <>
          <Tbl headers={[
            <ThSort label="Fecha"      colKey="fecha"          sortKey={skRent} sortDir={sdRent} onSort={tsRent}/>,
            <ThSort label="Nº Factura" colKey="numero"         sortKey={skRent} sortDir={sdRent} onSort={tsRent}/>,
            <ThSort label="Cliente"    colKey="clienteNombre"  sortKey={skRent} sortDir={sdRent} onSort={tsRent}/>,
            "Familia",
            <ThSort label="Total"      colKey="total"          sortKey={skRent} sortDir={sdRent} onSort={tsRent} align="right"/>,
            "CMV",
            <ThSort label="Ganancia $" colKey="ganancia"       sortKey={skRent} sortDir={sdRent} onSort={tsRent} align="right"/>,
            <ThSort label="Margen %"   colKey="margen"         sortKey={skRent} sortDir={sdRent} onSort={tsRent} align="right"/>]}>
            {rentData.map((f: any,i: number)=>(
              <Tr key={i}>
                <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,color:t.sub}}>{fmtFechaCC(f.fecha)}</Td>
                <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:11,color:t.muted}}>{f.numero}</Td>
                <Td style={{fontWeight:600}}>{f.clienteNombre}</Td>
                <Td style={{fontSize:11,color:t.sub}}>{[...new Set((f.items||[]).map((it:any)=>{const a=articulos.find((a:any)=>a.id===it.artId||a.nombre===it.nombre||(it.codigo&&a.codigo===it.codigo));return typeof a?.familia==='string'?a.familia:a?.familia?.nombre;}).filter(Boolean))].join(", ")||"—"}</Td>
                <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:700,color:t.accent}}>{fmtMoney(f.total)}</Td>
                <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,color:t.sub}}>{fmtMoney(f.costo)}</Td>
                <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:13,fontWeight:700,color:f.ganancia>=0?t.green:t.red}}>{fmtMoney(f.ganancia)}</Td>
                <Td style={{minWidth:110}}><BarraMar val={f.margen} t={t}/></Td>
              </Tr>
            ))}
          </Tbl>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:16,padding:"14px 16px",background:t.surf2,borderRadius:12,border:`1px solid ${t.border}`}}>
            {[
              {label:"Total Facturado", value:fmtMoney(totRent.ingreso),  color:t.accent},
              {label:"Total CMV",       value:fmtMoney(totRent.costo),    color:t.amber},
              {label:"Ganancia Bruta",  value:fmtMoney(totRent.ganancia), color:t.green},
              {label:"Facturas",        value:rentData.length,             color:t.sub},
            ].map((item,i)=>(
              <div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:t.muted,fontWeight:600,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:4}}>{item.label}</div>
                <div style={{fontSize:18,fontWeight:800,color:item.color}}>{item.value}</div>
              </div>
            ))}
          </div>
        </>
      }
    </>
  );
}
