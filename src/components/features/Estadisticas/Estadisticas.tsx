import React, { useState, useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import { Ic, Card, KPI, Bdg, Btn, Tbl, Tr, Td, Inp, InpMoney, Sel, Fld, Modal, PgHdr, Avatar, BtnEliminarConClave, ThSort, useSort } from "../../common/UIBase";
import { fmtMoney, parseMoney, getToday } from "../../../lib/utils"; 
import { PageContainer } from "../../layout/AppShell";
import { exportarAExcel } from "../../../lib/excelExport";
import { BuscadorCliente } from "../Clientes/BuscadorCliente";
import { UNIDADES_NEGOCIO } from "../../../constants";
import { getCMVGData, getVentasFamilia, getRankingClientes, mapFamToUN_Logic, getRentabilidadFactura, getComprasProveedor, getGastosConcepto, getMovimientosConcepto, getEvolucionMensual } from "../../../lib/estadisticas/estadisticasLogic";
import TabCMVG from "./tabs/TabCMVG";
import TabRanking from "./tabs/TabRanking";
import TabRentabilidad from "./tabs/TabRentabilidad";
import TabFamilias from "./tabs/TabFamilias";
import TabEvolucion from "./tabs/TabEvolucion";
import TabCompras from "./tabs/TabCompras";
import TabGastos from "./tabs/TabGastos";
import TabDetalle from "./tabs/TabDetalle";
import TabPnL from "./tabs/TabPnL";

const fmtNum = (n) => typeof n === 'number' ? n.toLocaleString('es-AR') : n;
const fmtFechaCC = (f) => f ? f.split('-').reverse().join('/') : '';


export default function Estadisticas(props: any) {
  const { pagos = [], clientes = [], articulos = [], facturas = [], proveedores = [], familias = [], unidadesNegocio = [], factProv=[], movimientos=[], conceptos=[], utilidadesFCI=[], cuentas=[], familiasColores={}, estadoResultados=[], setEstadoResultados=(val: any)=>{}, kardex=[] } = props;
  const { t } = useApp();
  const today = getToday();
  const [tab, setTab] = useState("cmvg");
  const [pnlEditando, setPnlEditando] = React.useState(null);
  const [pnlValEdit, setPnlValEdit] = React.useState("");
  const [pnlSubTab, setPnlSubTab] = React.useState("resultado"); // resultado | patrimonio
  const [patrimonioEdit, setPatrimonioEdit] = React.useState(null); // {periodo, key}
  const [patrimonioVal, setPatrimonioVal] = React.useState("");

  // Filtros globales — default últimos 3 meses para no procesar todo el historial
  const qPrefijo = s => (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/^(cig|rig|rd|rn|cr)\s*[.\-]?\s*/i,"").trim();

  const primerDiaMes = today.slice(0,8)+"01";
  const hace3meses = (()=>{ const d=new Date(today+"T00:00:00"); d.setMonth(d.getMonth()-3); d.setDate(1); return d.toISOString().slice(0,10); })();
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(today);
  const [filtUN, setFiltUN] = useState("Todas");
  const [filtFamilia, setFiltFamilia] = useState("Todas");
  const [filtProveedor, setFiltProveedor] = useState("Todos");
  const [filtCliente, setFiltCliente] = useState("Todos");
  const [busqCliente, setBusqCliente] = useState("");
  const [busqRentCliente, setBusqRentCliente] = useState("");
  const { sortKey:skRank, sortDir:sdRank, toggleSort:tsRank } = useSort("ingreso","desc");

  const UNS = useMemo(() => {
    return unidadesNegocio && unidadesNegocio.length > 0 ? unidadesNegocio : UNIDADES_NEGOCIO;
  }, [unidadesNegocio]);

  const mapFamToUN = React.useCallback((aId: any, aCod: any, aNom: any) => {
    return mapFamToUN_Logic(articulos, familias, aId, aCod, aNom);
  }, [articulos, familias]);
  const { sortKey:skRent, sortDir:sdRent, toggleSort:tsRent } = useSort("fecha","desc");
  const [filtRentCliente, setFiltRentCliente] = React.useState("Todos");
  const [filtConcepto, setFiltConcepto] = useState("Todos");
  const [detalleExpandido, setDetalleExpandido] = useState({}); // conceptos expandidos
  const [detClienteId, setDetClienteId] = useState(""); // filtro cliente detalle
  const [detBusq, setDetBusq] = useState(""); // texto de búsqueda detalle
  const [detFamilia, setDetFamilia] = useState("Todas"); // filtro familia detalle
  const [detExpFac, setDetExpFac] = useState({}); // facturas expandidas en detalle

  // Limpiar búsquedas al cambiar de tab
  const cambiarTab = (nuevoTab) => {
    setTab(nuevoTab);
    setBusqCliente("");
    setFiltCliente("Todos");
    setBusqRentCliente("");
    setFiltRentCliente("Todos");
  };

  const TABS = [
    { id:"cmvg",      label:"CMV y Ganancia",          icon:"stats" },
    { id:"familias",  label:"Ventas por Familia",       icon:"stats" },
    { id:"evolucion", label:"Evolución Mensual",        icon:"stats" },
    { id:"ranking",   label:"Ranking Clientes",         icon:"clientes" },
    { id:"rent",      label:"Rentabilidad por Factura", icon:"factura" },
    { id:"detalle",   label:"Detalle por Cliente",       icon:"clientes" },
    { id:"compras",   label:"Compras por Proveedor",    icon:"proveedores" },
    { id:"gastos",    label:"Gastos por Concepto",      icon:"stats" },
    { id:"pnl",      label:"Ganancias y Pérdidas",      icon:"stats" },
  ];

  // Facturas de venta en el período — memoizado para evitar recálculo en cada render
  const facsPeriodo = React.useMemo(() => facturas.filter(f =>
    (f.tipo==="factura"||f.tipo==="nc"||(f.tipo==="fa" && f.isHistoricalCMV)) &&
    !f.anulada &&
    f.fecha >= desde && f.fecha <= hasta
  ), [facturas, desde, hasta]);

  // ── CMV y Ganancia ──────────────────────────────────────────────────────────
  const cmvgData = React.useMemo(() => {
    return getCMVGData(facsPeriodo, articulos, familias, kardex, {
      cliente: filtCliente,
      familia: filtFamilia,
      un: filtUN,
      proveedor: filtProveedor,
      desde, hasta
    });
  }, [facsPeriodo, articulos, filtCliente, filtFamilia, filtUN, filtProveedor, desde, hasta, kardex]);

  // Agrupado por familia para render
  const cmvgPorFamilia = (() => {
    const grupos = {};
    cmvgData.forEach(r=>{ if(!grupos[r.familia]) grupos[r.familia]=[]; grupos[r.familia].push(r); });
    return grupos;
  })();

  const totCMVG = cmvgData.reduce((s,r)=>({ingreso:s.ingreso+r.ingreso,costo:s.costo+r.costo,ganancia:s.ganancia+r.ganancia}),{ingreso:0,costo:0,ganancia:0});
  // Utilidad FCI del período
  const totUtilFCI = utilidadesFCI.filter(u=>u.fecha>=desde&&u.fecha<=hasta).reduce((s,u)=>s+u.monto,0);
  const totFisicos = cmvgData.filter(r=>!r.esServicio).reduce((s,r)=>({ingreso:s.ingreso+r.ingreso,costo:s.costo+r.costo,ganancia:s.ganancia+r.ganancia}),{ingreso:0,costo:0,ganancia:0});
  const totCV = cmvgData.filter(r=>r.esServicio).reduce((s,r)=>s+r.ingreso,0);
  // Margen sobre físicos únicamente
  const margenTotal = totFisicos.ingreso>0 ? totFisicos.ganancia/totFisicos.ingreso*100 : 0;

  const exportarCMVG = async () => {
    let filas = [];
    Object.entries(cmvgPorFamilia as any).forEach(([familia,items]: [string, any])=>{
      items.forEach(r=>{
        const costoUnit = r.unidades>0?r.costo/r.unidades:0;
        filas.push([r.codigo,r.nombre,r.unidades,Number(costoUnit.toFixed(4)),Number(r.costo.toFixed(2)),Number(r.precioPromPond.toFixed(3)),Number(r.ingreso.toFixed(2)),r.esServicio?"":Number(r.ganancia.toFixed(2)),r.esServicio?"":Number(r.margen?.toFixed(2)||0)]);
      });
      const totFam=items.reduce((s:any,r:any)=>({ingreso:s.ingreso+r.ingreso,costo:s.costo+r.costo,ganancia:s.ganancia+r.ganancia}),{ingreso:0,costo:0,ganancia:0});
      const margenFam=totFam.ingreso>0?totFam.ganancia/totFam.ingreso*100:0;
      filas.push([`Total ${familia}`,"","","",Number((totFam.costo).toFixed(2)),"",Number((totFam.ingreso).toFixed(2)),Number((totFam.ganancia).toFixed(2)),Number(margenFam.toFixed(2))]);
      filas.push([]);
    });
    filas.push(["TOTAL GENERAL","","","",Number(totCMVG.costo.toFixed(2)),"",Number(totCMVG.ingreso.toFixed(2)),Number(totCMVG.ganancia.toFixed(2)),Number(margenTotal.toFixed(2))]);

    exportarAExcel({
      titulo: `CMV y Ganancia — ${desde} al ${hasta} | Familia: ${filtFamilia} | Proveedor: ${filtProveedor === "Todos" ? "Todos" : proveedores.find((p:any) => String(p.id) === filtProveedor)?.nombre || filtProveedor}`,
      columnas: ["Cód.Art.","Denominación","Cant.Vend.","Costo Unit.","Costo Total","Precio Prom.Pond.","Total Vendido","Ganancia ($)","Ganancia (%)"],
      filas: filas,
      fileName: `cmv_ganancia_${desde}_${hasta}.xlsx`,
      sheetName: "CMV"
    });
  };

  // ── Ranking Clientes ────────────────────────────────────────────────────────
  const rankingData = React.useMemo(() => {
    return getRankingClientes(facsPeriodo, clientes, articulos, skRank, sdRank);
  }, [facsPeriodo, clientes, articulos, skRank, sdRank]);

  const topIngreso = rankingData[0]?.ingreso || 1;

  // ── Rentabilidad por Factura ────────────────────────────────────────────────
  const rentData = React.useMemo(() => {
    return getRentabilidadFactura(facsPeriodo, clientes, articulos, filtRentCliente, skRent, sdRent);
  }, [facsPeriodo, clientes, articulos, skRent, sdRent, filtRentCliente]);

  const totRent = rentData.reduce((s,r)=>({ingreso:s.ingreso+r.total,costo:s.costo+r.costo,ganancia:s.ganancia+r.ganancia}),{ingreso:0,costo:0,ganancia:0});

  // Filtros comunes
  const filtroPeriodoJSX = (
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:20,padding:"14px 16px",background:t.surf2,borderRadius:12,border:`1px solid ${t.border}`}}>
      <div style={{fontSize:11,fontWeight:700,color:t.sub,letterSpacing:"0.8px",textTransform:"uppercase",marginRight:4}}>Período</div>
      <Fld label="Desde" style={{marginBottom:0}}><Inp type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={{fontSize:12}}/></Fld>
      <Fld label="Hasta" style={{marginBottom:0}}><Inp type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={{fontSize:12}}/></Fld>
      <div style={{display:"flex",gap:6,marginLeft:4}}>
        {[
          {label:"Hoy",     fn:()=>{setDesde(today);setHasta(today);}},
          {label:"Ini.Mes", fn:()=>{setDesde(primerDiaMes);setHasta(today);}},
          {label:"Mes ant.",fn:()=>{
            const d=new Date(today+"T00:00:00");
            d.setDate(1); d.setMonth(d.getMonth()-1);
            const ini=d.toISOString().slice(0,10);
            const fin=new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().slice(0,10);
            setDesde(ini);setHasta(fin);
          }},
          {label:"Últ. Año",fn:()=>{
            const d=new Date(today+"T00:00:00");
            d.setFullYear(d.getFullYear()-1);
            setDesde(d.toISOString().slice(0,10));
            setHasta(today);
          }},
          {label:"Todo",fn:()=>{
            setDesde("2020-01-01");
            setHasta(today);
          }},
        ].map(({label,fn})=>(
          <button key={label} onClick={fn} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${t.border}`,background:t.surf,color:t.sub,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>{label}</button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      {["ranking", "rent", "evolucion", "compras", "gastos", "cmvg", "pnl"].includes(tab) && (
        <Btn v="ghost" onClick={() => {
          if (tab === "cmvg") exportarCMVG();
          else if (tab === "pnl") {
            if (pnlSubTab === "resultado") document.getElementById("btn-exportar-pnl-hidden")?.click();
            else if (pnlSubTab === "patrimonio") document.getElementById("btn-exportar-patrimonio-hidden")?.click();
          }
          else exportarEstadisticasExcel(tab);
        }} title="Exportar"><Ic n="transfer" s={14}/></Btn>
      )}
    </div>
  );

  const filtrosArticulosJSX = (
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16,alignItems:"flex-end"}}>
      <Fld label="Unidad de Negocio" style={{marginBottom:0,minWidth:150}}>
        <Sel value={filtUN} onChange={e=>setFiltUN(e.target.value)}>
          <option>Todas</option>
          {UNS.map(u => <option key={u}>{u}</option>)}
        </Sel>
      </Fld>
      <Fld label="Familia" style={{marginBottom:0,minWidth:150}}>
        <Sel value={filtFamilia} onChange={e=>setFiltFamilia(e.target.value)}>
          <option>Todas</option>
          {(familias||[]).map((f: any) => { const n = typeof f === "string" ? f : f.nombre; return <option key={n}>{n}</option> })}
        </Sel>
      </Fld>
      <Fld label="Proveedor" style={{marginBottom:0,minWidth:180}}>
        <Sel value={filtProveedor} onChange={e=>setFiltProveedor(e.target.value)}>
          <option>Todos</option>
          {(proveedores||[]).filter((p: any) => p.estado !== "archivado").map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Sel>
      </Fld>
      <Fld label="Cliente" style={{marginBottom:0,minWidth:220}}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <BuscadorCliente
            clientes={clientes}
            valor={filtCliente === "Todos" ? "" : filtCliente}
            onChange={(val: any) => { setFiltCliente(val || "Todos"); setBusqCliente(""); }}
            placeholder="Todos los clientes"
          />
        </div>
      </Fld>
      <button onClick={()=>{setFiltFamilia("Todas");setFiltProveedor("Todos");setFiltCliente("Todos");setBusqCliente("");setDesde(primerDiaMes);setHasta(today);}} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${t.border}`,background:t.surf,color:t.sub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",alignSelf:"flex-end",marginBottom:1}}>✕ Limpiar</button>
    </div>
  );

  // ── Ventas por Familia ──────────────────────────────────────────────────────
  const ventasFamilia = React.useMemo(() => {
    return getVentasFamilia(facsPeriodo, articulos, familias, filtUN);
  }, [facsPeriodo, articulos, familias, filtUN]);

  // ── Evolución Mensual ───────────────────────────────────────────────────────
  // ── Evolución Mensual por Familia ───────────────────────────────────────────
  // Estados propios de esta pestaña
  const [evMeses, setEvMeses] = React.useState("6");
  const [evDesde, setEvDesde] = React.useState("");
  const [evHasta, setEvHasta] = React.useState("");
  const [evMetrica, setEvMetrica] = React.useState("ingreso");
  const [evFamActivas, setEvFamActivas] = React.useState([]); // vacío = todas activas

  const evolucionMensual = React.useMemo(() => {
    return getEvolucionMensual(facturas, articulos, familias, utilidadesFCI, evMeses, evDesde, evHasta, today);
  }, [facturas, articulos, evMeses, evDesde, evHasta, utilidadesFCI, familias, today]);

  const maxIngresoMes = Math.max(1, ...evolucionMensual.meses.map(m=>
    evolucionMensual.familias.reduce((s,f)=>{
      const d = evolucionMensual.datos[m]?.[f];
      if(!d) return s;
      const v = evMetrica==="ganancia" ? (d.ingreso-d.costo) : (d[evMetrica]||0);
      return s + Math.abs(v);
    },0)
  ));

  // Helper para obtener valor según métrica (incluye ganancia calculada)
  const getEvVal = (datos, mes, familia) => {
    const d = datos[mes]?.[familia];
    if(!d) return 0;
    if(evMetrica==="ganancia") return d.ingreso - d.costo;
    return d[evMetrica]||0;
  };

  // ── Compras por Proveedor ───────────────────────────────────────────────────
  const comprasProveedor = React.useMemo(() => {
    return getComprasProveedor(factProv, proveedores, desde, hasta);
  }, [factProv, proveedores, desde, hasta]);

  const totCompras=comprasProveedor.reduce((s,r)=>s+r.total,0);

  // ── Gastos por Concepto ─────────────────────────────────────────────────────
  const gastosPorConcepto = React.useMemo(() => {
    return getGastosConcepto(movimientos, conceptos, desde, hasta);
  }, [movimientos, conceptos, desde, hasta]);

  // Movimientos individuales por concepto (para desglose)
  const movimientosConcepto = React.useMemo(() => {
    return getMovimientosConcepto(movimientos, conceptos, desde, hasta);
  }, [movimientos, conceptos, desde, hasta]);

  const conceptosDisponibles = conceptos?.filter(c=>c.activo!==false).map(c=>c.nombre).sort() || [];
  const gastosFiltrados = filtConcepto==="Todos" ? gastosPorConcepto : gastosPorConcepto.filter(r=>r.concepto===filtConcepto);
  const totGastos = gastosFiltrados.reduce((s,r)=>s+r.total,0);

  const exportarEstadisticasExcel = async (tabActual: string) => {
    const periodo = `${desde} al ${hasta}`;

    if(tabActual==="ranking") {
      exportarAExcel({
        titulo: `Ranking de Clientes — ${periodo}`,
        columnas: ["#","Cliente","Facturas","Facturado","CMV","Ganancia $","Margen %"],
        filas: rankingData.map((r,i)=>[i+1, r.nombre, r.facturas, r.ingreso, r.costo, r.ganancia, Number((r.margen||0).toFixed(1))]),
        fileName: `estadisticas_ranking_${hasta}.xlsx`,
        sheetName: "Ranking"
      });
    } else if(tabActual==="rent") {
      const filas = rentData.map(f=>[f.fecha, f.numero||"—", f.clienteNombre, f.total, f.costo, f.ganancia, Number((f.margen||0).toFixed(1))]);
      filas.push([]);
      filas.push(["","","TOTALES", totRent.ingreso, totRent.costo, totRent.ganancia]);
      
      exportarAExcel({
        titulo: `Rentabilidad por Factura — ${periodo}`,
        columnas: ["Fecha","Nº Factura","Cliente","Total","CMV","Ganancia $","Margen %"],
        filas: filas,
        fileName: `estadisticas_rentabilidad_${hasta}.xlsx`,
        sheetName: "Rentabilidad"
      });
    } else if(tabActual==="evolucion") {
      const { meses, familias: fams, datos } = evolucionMensual;
      exportarAExcel({
        titulo: `Evolución Mensual — ${periodo}`,
        columnas: ["Mes", ...fams, "TOTAL"],
        filas: meses.map(m=>{
          const vals = fams.map(f=>getEvVal(datos,m,f));
          return [m, ...vals, vals.reduce((s,v)=>s+v,0)];
        }),
        fileName: `estadisticas_evolucion_${hasta}.xlsx`,
        sheetName: "Evolución"
      });
    } else if(tabActual==="compras") {
      exportarAExcel({
        titulo: `Compras por Proveedor — ${periodo}`,
        columnas: ["Proveedor","Facturas","Total ($)"],
        filas: comprasProveedor.map(r=>[r.nombre, r.facturas, r.total]),
        fileName: `estadisticas_compras_${hasta}.xlsx`,
        sheetName: "Compras"
      });
    } else if(tabActual==="gastos") {
      const filas = gastosFiltrados.map(r=>[r.concepto, r.count, r.total]);
      filas.push([]);
      filas.push(["TOTAL","",totGastos]);
      exportarAExcel({
        titulo: `Gastos por Concepto — ${periodo}`,
        columnas: ["Concepto","Movimientos","Total ($)"],
        filas: filas,
        fileName: `estadisticas_gastos_${hasta}.xlsx`,
        sheetName: "Gastos"
      });
    }
  };

  return (
    <PageContainer title="Estadísticas" stickyHeader={false} sub="Rentabilidad y análisis de ventas">

      {/* KPIs resumen período */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <KPI label="Facturado físicos" value={fmtMoney(totFisicos.ingreso)} sub={`${facsPeriodo.length} facturas · CV: ${fmtMoney(totCV)}`} color={t.accent}/>
        <KPI label="Costo total (CMV)" value={fmtMoney(totFisicos.costo)} sub="Artículos físicos" color={t.amber}/>
        <KPI label="Ganancia bruta" value={fmtMoney(totFisicos.ganancia)} sub={`Margen ${margenTotal.toFixed(1)}%`} color={margenTotal>=20?t.green:margenTotal>=10?t.amber:t.red}/>
        <KPI label="Utilidad FCI / Inversión" value={fmtMoney(totUtilFCI)} sub={totUtilFCI>0?`${utilidadesFCI.filter(u=>u.fecha>=desde&&u.fecha<=hasta).length} acreditaciones en el período`:"Sin utilidades en el período"} color={t.teal}/>
        <KPI label="Ganancia total" value={fmtMoney(totFisicos.ganancia+totUtilFCI)} sub="Bruta + FCI / Inversión" color={t.green}/>
        <KPI label="Margen total" value={`${totFisicos.ingreso>0?((totFisicos.ganancia+totUtilFCI)/totFisicos.ingreso*100).toFixed(1):0}%`} sub="Sobre facturado físicos" color={t.purple}/>
      </div>

      {/* Solapas */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`1px solid ${t.border}`}}>
        {TABS.map(tb=>{
          const active=tab===tb.id;
          return <button key={tb.id} onClick={()=>cambiarTab(tb.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",border:"none",borderBottom:`2px solid ${active?t.accent:"transparent"}`,background:"none",cursor:"pointer",fontSize:13,fontWeight:active?700:500,color:active?t.accent:t.sub,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",marginBottom:-1,transition:"all 0.15s"}}>
            <Ic n={tb.icon} s={14}/>{tb.label}
          </button>;
        })}
      </div>

      {/* ── CMV Y GANANCIA ── */}
      {tab==="cmvg"&&<TabCMVG
        cmvgData={cmvgData}
        cmvgPorFamilia={cmvgPorFamilia}
        totCMVG={totCMVG}
        margenTotal={margenTotal}
        filtroPeriodoJSX={filtroPeriodoJSX}
        filtrosArticulosJSX={filtrosArticulosJSX}
        t={t}
      />}

      {/* ── RANKING CLIENTES ── */}
      {tab==="ranking"&&<TabRanking
        rankingData={rankingData}
        topIngreso={topIngreso}
        filtroPeriodoJSX={filtroPeriodoJSX}
        skRank={skRank}
        sdRank={sdRank}
        tsRank={tsRank}
        t={t}
      />}

      {/* ── RENTABILIDAD POR FACTURA ── */}
      {tab==="rent"&&<TabRentabilidad
        rentData={rentData}
        totRent={totRent}
        filtRentCliente={filtRentCliente}
        setFiltRentCliente={setFiltRentCliente}
        busqRentCliente={busqRentCliente}
        setBusqRentCliente={setBusqRentCliente}
        clientes={clientes}
        articulos={articulos}
        filtroPeriodoJSX={filtroPeriodoJSX}
        skRent={skRent}
        sdRent={sdRent}
        tsRent={tsRent}
        t={t}
      />}

      {/* ── VENTAS POR FAMILIA ── */}
      {tab==="familias"&&<TabFamilias ventasFamilia={ventasFamilia} filtroPeriodoJSX={filtroPeriodoJSX} t={t} />}

      {/* ── EVOLUCIÓN MENSUAL ── */}
      {tab==="evolucion"&&<TabEvolucion
        evolucionMensual={evolucionMensual}
        evMeses={evMeses}
        setEvMeses={setEvMeses}
        evDesde={evDesde}
        setEvDesde={setEvDesde}
        evHasta={evHasta}
        setEvHasta={setEvHasta}
        evMetrica={evMetrica}
        setEvMetrica={setEvMetrica}
        evFamActivas={evFamActivas}
        setEvFamActivas={setEvFamActivas}
        familias={familias}
        t={t}
      />}

      {/* ── COMPRAS POR PROVEEDOR ── */}
      {tab==="compras"&&<TabCompras comprasProveedor={comprasProveedor} totCompras={totCompras} filtroPeriodoJSX={filtroPeriodoJSX} t={t} />}

      {/* ── GASTOS POR CONCEPTO ── */}
      {tab==="gastos"&&<TabGastos
        gastosFiltrados={gastosFiltrados}
        totGastos={totGastos}
        filtConcepto={filtConcepto}
        setFiltConcepto={setFiltConcepto}
        conceptosDisponibles={conceptosDisponibles}
        detalleExpandido={detalleExpandido}
        setDetalleExpandido={setDetalleExpandido}
        movimientosConcepto={movimientosConcepto}
        cuentas={cuentas}
        filtroPeriodoJSX={filtroPeriodoJSX}
        t={t}
      />}

      {/* ── DETALLE POR CLIENTE ── */}
      {tab==="detalle"&&<TabDetalle
        facturas={facturas}
        clientes={clientes}
        articulos={articulos}
        desde={desde}
        hasta={hasta}
        filtroPeriodoJSX={filtroPeriodoJSX}
        detClienteId={detClienteId}
        setDetClienteId={setDetClienteId}
        detBusq={detBusq}
        setDetBusq={setDetBusq}
        detFamilia={detFamilia}
        setDetFamilia={setDetFamilia}
        detExpFac={detExpFac}
        setDetExpFac={setDetExpFac}
        t={t}
      />}

      {/* ── P&L POR UNIDAD ── */}
      {tab==="pnl"&&<TabPnL
        desde={desde}
        hasta={hasta}
        filtroPeriodoJSX={filtroPeriodoJSX}
        estadoResultados={estadoResultados}
        setEstadoResultados={setEstadoResultados}
        pnlSubTab={pnlSubTab}
        setPnlSubTab={setPnlSubTab}
        unidadesNegocio={unidadesNegocio}
        familias={familias}
        facsPeriodo={facsPeriodo}
        articulos={articulos}
        movimientos={movimientos}
        totUtilFCI={totUtilFCI}
        pnlEditando={pnlEditando}
        setPnlEditando={setPnlEditando}
        pnlValEdit={pnlValEdit}
        setPnlValEdit={setPnlValEdit}
        cuentas={cuentas}
        clientes={clientes}
        facturas={facturas}
        pagos={pagos}
        proveedores={proveedores}
        factProv={factProv}
        patrimonioEdit={patrimonioEdit}
        setPatrimonioEdit={setPatrimonioEdit}
        patrimonioVal={patrimonioVal}
        setPatrimonioVal={setPatrimonioVal}
        t={t}
      />}
    </PageContainer>
  );
}
const CUENTAS_LABELS = {
  1: "Caja",
  2: "Banco San Juan",
  3: "Banco Patagonia",
  4: "Fondo FCI",
  5: "Banco BBVA",
};
