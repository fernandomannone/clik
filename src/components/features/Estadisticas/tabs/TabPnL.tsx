import React from "react";
import { fmtMoney, parseMoney } from "../../../../lib/utils";
import { InpMoney, KPI } from "../../../common/UIBase";
import { mapFamToUN_Logic as mapFamToUN } from "../../../../lib/estadisticas/estadisticasLogic";
import { exportarAExcel } from "../../../../lib/excelExport";

export default function TabPnL({
  desde,
  hasta,
  filtroPeriodoJSX,
  estadoResultados,
  setEstadoResultados,
  pnlSubTab,
  setPnlSubTab,
  unidadesNegocio,
  familias,
  facsPeriodo,
  articulos,
  movimientos,
  totUtilFCI,
  pnlEditando,
  setPnlEditando,
  pnlValEdit,
  setPnlValEdit,
  cuentas,
  clientes,
  facturas,
  pagos,
  proveedores,
  factProv,
  patrimonioEdit,
  setPatrimonioEdit,
  patrimonioVal,
  setPatrimonioVal,
  t
}: any) {
  const periodosEnRango: string[] = [];
  {
    const dStart = new Date(desde); dStart.setDate(1); dStart.setHours(0,0,0,0);
    const dEnd = new Date(hasta); dEnd.setDate(1); dEnd.setHours(0,0,0,0);
    let curr = new Date(dStart);
    while(curr <= dEnd) {
      periodosEnRango.push(curr.toISOString().slice(0,7));
      curr.setMonth(curr.getMonth()+1);
    }
    if(periodosEnRango.length===0) periodosEnRango.push(desde.slice(0,7));
  }
  const periodoActual = desde.slice(0,7); // "YYYY-MM" para edición
  const esUnSoloPeriodo = periodosEnRango.length <= 1;
  const periodoLabel = (p: any) => { const [y,m]=p.split("-"); return `${["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][parseInt(m)]} ${y}`; };

  const guardarLinea = (key: string, valStr: string) => {
    if (!esUnSoloPeriodo) return;
    const curr = estadoResultados.find((e: any) => e.periodo === periodoActual) || { periodo: periodoActual, lineas: {}, activo: {}, pasivo: {} };
    const newVal = parseMoney(valStr) || 0;
    const newObj = { ...curr, lineas: { ...(curr.lineas || {}), [key]: newVal } };
    setEstadoResultados(estadoResultados.filter((e: any) => e.periodo !== periodoActual).concat(newObj));
  };
  
  const lin = periodosEnRango.reduce((acc: any, p) => {
    const l = estadoResultados.find((e: any) => e.periodo === p)?.lineas || {};
    Object.keys(l).forEach(k => acc[k] = (acc[k] || 0) + l[k]);
    return acc;
  }, {});

  const lineasDef = [
    { key:"cobroVirtual", label:"Rentabilidad Saldo / Carga Virtual", un:"Carga Virtual" },
    { key:"recIVA", label:"Recupero de IVA", un:"General" },
    { key:"alquilerPOS", label:"Alquiler POS", un:"General" },
    { key:"rentDebito", label:"Rentabilidad Débito", un:"General" },
    { key:"otros", label:"Otros (Ingresos)", un:"General" },
  ];

  // ── Cálculos por Unidad de Negocio ────────────────────────────────────
  const unsSet = new Set<string>(unidadesNegocio && unidadesNegocio.length > 0 ? unidadesNegocio : ["General", "Kiosco", "Cigarrillos y Tabaquería", "Carga Virtual", "Logística"]);
  ["General", "Kiosco", "Cigarrillos y Tabaquería", "Carga Virtual", "Logística"].forEach(u => unsSet.add(u));
  familias?.forEach((f: any) => { if (f.unidadNegocio) unsSet.add(f.unidadNegocio); });
  const UNS = Array.from(unsSet);
  const pnlData = Object.fromEntries(UNS.map(un => [un, { ventas:0, cmv:0, otrosIng:0, costoCaja:0 }])) as Record<string, any>;

  // 1. Facturas (Ventas y CMV)
  facsPeriodo.filter((f: any)=>!f.anulada).forEach((f: any)=>{
    const esNC=f.tipo==="nc", signo=esNC?-1:1;
    (f.items||[]).forEach((it: any)=>{
      const cant=parseMoney(it.cantidad)||0;
      const precio=(parseMoney(it.precio)||0)*(1-(parseFloat(it.bonif)||0)/100);
      const art = articulos.find((a: any)=>a.id===it.artId||a.codigo===it.codigo||a.nombre===it.nombre);
      const isSaldoVirtual = it.codigo === "044" || it.nombre === "SALDO CV" || it.nombre === "CV";
      // Para el Saldo Virtual cost = precio
      const costo= isSaldoVirtual ? precio : (parseFloat(it.costoUnit)||(art?.costo||0));
      const un = mapFamToUN(articulos, familias, it.artId, it.codigo, it.nombre);
      if(pnlData[un]) {
        pnlData[un].ventas += signo * precio * cant;
        pnlData[un].cmv += signo * costo * cant;
      }
    });
  });

  // 2. Movimientos de Caja
  movimientos.filter((m:any) => m.fecha>=desde && m.fecha<=hasta && !m.informativo).forEach((m:any) => {
    let un = m.unidadNegocio || "General";
    if (!UNS.includes(un)) un = "General";
    if (m.esAjusteStock) {
      if (m.tipo==="ingreso") pnlData[un].otrosIng += m.monto;
      else pnlData[un].costoCaja += m.monto;
    } else if (m.conceptoId) {
      if (m.tipo==="ingreso") pnlData[un].otrosIng += m.monto;
      if (m.tipo==="egreso") pnlData[un].costoCaja += m.monto;
    }
  });

  // 3. Utilidades FCI -> General
  if(pnlData["General"]) pnlData["General"].otrosIng += totUtilFCI;

  // -- Totales calculados por unidad y globales --
  UNS.forEach(un => {
    const d = pnlData[un];
    let manualA = un === "General" ? ((lin.recIVA||0)+(lin.rentDebito||0)+(lin.alquilerPOS||0)+(lin.otros||0)) : (un === "Carga Virtual" ? (lin.cobroVirtual||0) : 0);
    d.otrosIng += manualA;
    if (un === "General") {
      d.costoCaja += (lin.gastosManuales||0);
    }
    d.margenBruto = d.ventas - d.cmv;
    d.ingresosOp = d.margenBruto + d.otrosIng;
    d.contribucion = d.ingresosOp - d.costoCaja;
  });

  const totalGlobal = UNS.reduce((s, un) => {
    s.ventas += pnlData[un].ventas;
    s.cmv += pnlData[un].cmv;
    s.margenBruto += pnlData[un].margenBruto;
    s.otrosIng += pnlData[un].otrosIng;
    s.ingresosOp += pnlData[un].ingresosOp;
    s.costoCaja += pnlData[un].costoCaja;
    s.contribucion += pnlData[un].contribucion;
    return s;
  }, { ventas:0, cmv:0, margenBruto:0, otrosIng:0, ingresosOp:0, costoCaja:0, contribucion:0 });

  const fmtPeriodo = (p:any) => periodoLabel(p);

  const grafUNS = UNS.filter(un => pnlData[un].ventas > 0 || pnlData[un].costoCaja > 0 || pnlData[un].otrosIng > 0);
  const colorMargen = t.accent;
  const colorGasto = t.red;
  const colorNeto = t.green;

  const handleExportarExcelPnl = () => {
    const filas:any = [];
    
    Object.entries({
      "VENTAS NETAS": "ventas",
      "Costo Mercadería Variabl (CMV)": "cmv",
      "MARGEN BRUTO": "margenBruto"
    }).forEach(([l, k]) => {
      filas.push([l, ...UNS.map(un => pnlData[un][k]), (totalGlobal as any)[k]]);
    });
    
    filas.push([]);
    lineasDef.filter(l => l.un !== "General").forEach(l => {
      filas.push([l.label, ...UNS.map(un => un === "Carga Virtual" ? lin[l.key]||0 : 0), lin[l.key]||0]);
    });
    
    lineasDef.filter(l => l.un === "General").forEach(l => {
      filas.push([l.label, ...UNS.map(un => un === "General" ? lin[l.key]||0 : 0), lin[l.key]||0]);
    });
    
    filas.push(["INGRESOS OPERATIVOS", ...UNS.map(un => pnlData[un].ingresosOp), totalGlobal.ingresosOp]);
    filas.push([]);
    filas.push(["Egresos y Ajustes Caja", ...UNS.map(un => pnlData[un].costoCaja - (un === "General" ? (lin.gastosManuales||0) : 0)), totalGlobal.costoCaja-(lin.gastosManuales||0)]);
    filas.push(["Gastos Adicionales", ...UNS.map(un => un === "General" ? (lin.gastosManuales||0) : 0), lin.gastosManuales||0]);
    filas.push([]);
    filas.push(["CONTRIBUCIÓN NETA", ...UNS.map(un => pnlData[un].contribucion), totalGlobal.contribucion]);

    exportarAExcel({
      titulo: `Estado de Resultados — ${desde} al ${hasta}`,
      columnas: ["Línea", ...UNS, "TOTAL GENERAL"],
      filas: filas,
      fileName: `estadisticas_pnl_${hasta}.xlsx`,
      sheetName: "Ganancias y Perdidas"
    });
  };

  // -------------------------------------------------------------
  // PATRIMONIO
  // -------------------------------------------------------------

  const todosLosPeriodos:any = [];
  {
    const dStart = new Date(desde); dStart.setDate(1); dStart.setHours(0,0,0,0);
    const dEnd = new Date(hasta); dEnd.setDate(1); dEnd.setHours(0,0,0,0);
    let curr = new Date(dStart);
    while(curr <= dEnd) {
      todosLosPeriodos.push(curr.toISOString().slice(0,7));
      curr.setMonth(curr.getMonth()+1);
    }
    if(todosLosPeriodos.length===0) todosLosPeriodos.push(desde.slice(0,7));
  }

  const ACTIVO_LINEAS = [
    { key:"cajaHusky",      label:"Caja Efectivo", auto: true },
    { key:"bancos",         label:"Bco. San Juan / Patagonia", auto: true },
    { key:"plazoFijo",      label:"Plazo Fijo / Préstamo" },
    { key:"fondoInversion", label:"Fondo Inversión / Dólares" },
    { key:"saldosClientes", label:"Saldos Clientes", auto: true },
    { key:"stockCIG",       label:"Stock CIG", auto: true },
    { key:"stockCV",        label:"Stock CV" },
    { key:"proveedoresTarj",label:"Saldo Proveedores", negativo:true, auto: true },
    { key:"proveedoresCV",  label:"Proveedores CV", negativo:true },
    { key:"depSinConciliar",label:"Dep. sin conciliar RGP-SEAC", negativo:true },
  ];
  const PASIVO_LINEAS = [
    { key:"gastosBancariosSeac", label:"Gastos Bancarios SEAC" },
    { key:"difStock",            label:"Dif. en Stock / Máquinas" },
  ];

  const calcSaldoCuentaAFecha = (cuentaId: number, per: string) => {
    const c = cuentas.find((x:any) => String(x.id) === String(cuentaId));
    if (!c) return 0;
    const limitDate = per + "-31";
    const movsPosteriores = movimientos.filter((m:any) => m.cuentaId === c.id && m.fecha > limitDate);
    let s = c.saldo || 0;
    movsPosteriores.forEach((m:any) => { s += (m.tipo==="ingreso" ? -m.monto : m.monto); });
    return s;
  };

  const getDato = (periodo: string, seccion: string, key: string) => {
    if (seccion === "activo") {
        if (key === "cajaHusky") return cuentas.filter((c:any) => c.tipo === "efectivo").reduce((s:number, c:any) => s + calcSaldoCuentaAFecha(c.id, periodo), 0);
        if (key === "bancos") return cuentas.filter((c:any) => c.tipo === "banco").reduce((s:number, c:any) => s + calcSaldoCuentaAFecha(c.id, periodo), 0);
        if (key === "saldosClientes") {
          const limitDate = periodo + "-31";
          return clientes.reduce((s:number, c:any) => {
              let saldo = c.saldo || 0;
              const facs = facturas.filter((f:any) => f.clienteId === c.id && f.fecha > limitDate && !f.anulada);
              facs.forEach((f:any) => { saldo += (f.tipo==="factura" ? -f.total : f.total); });
              const ps = pagos.filter((p:any) => p.clienteId === c.id && p.fecha > limitDate && !p.anulado);
              ps.forEach((p:any) => { saldo += p.monto; });
              return s + saldo;
          }, 0);
        }
        if (key === "stockCIG") {
          return articulos.filter((a:any) => {
            const n = (typeof a.familia === "string" ? a.familia : a.familia?.nombre||"").toUpperCase();
            return n.includes("CIG") || n.includes("TABA");
          }).reduce((s:number, a:any) => s + (a.stock||0)*(a.costo||0), 0);
        }
        if (key === "proveedoresTarj") {
          const limitDate = periodo + "-31";
          return proveedores.reduce((s:number, p:any) => {
              let saldo = p.saldo || 0;
              const facs = factProv.filter((f:any) => f.proveedorId === p.id && f.fecha > limitDate && !f.anulada);
              facs.forEach((f:any) => { saldo += (f.tipo==="factura" ? -f.total : f.total); });
              const ps = factProv.filter((x:any) => x.proveedorId === p.id && x.tipo==="recibo" && x.fecha > limitDate && !x.anulado);
              ps.forEach((x:any) => { saldo += x.total; });
              return s + saldo;
          }, 0);
        }
    }

    const reg = estadoResultados.find((e:any)=>e.periodo===periodo);
    return parseFloat(reg?.[seccion]?.[key]||0)||0;
  };

  const getTotalActivo = (periodo:any) => ACTIVO_LINEAS.reduce((s,l)=>{
    const v = getDato(periodo,"activo",l.key);
    return s + (l.negativo ? -Math.abs(v) : Math.abs(v));
  },0);
  const getTotalPasivo = (periodo:any) => PASIVO_LINEAS.reduce((s,l)=>s+getDato(periodo,"pasivo",l.key),0);
  const getDifActPas = (periodo:any) => getTotalActivo(periodo) - getTotalPasivo(periodo);

  const guardarPatrimonio = (periodo:any, seccion:any, key:any, valor:any) => {
    const v = parseMoney(valor);
    setEstadoResultados((prev:any)=>{
      const reg = prev.find((e:any)=>e.periodo===periodo)||{periodo, lineas:{}};
      const updated = {...reg, [seccion]:{...(reg[seccion]||{}), [key]:v}};
      return [...prev.filter((e:any)=>e.periodo!==periodo), updated];
    });
  };

  const handleExportarExcelPatrimonio = () => {
    const filas:any = [];
    filas.push(["ACTIVO"]);
    ACTIVO_LINEAS.forEach(l => {
      filas.push([l.label, ...todosLosPeriodos.map((p:any) => getDato(p, "activo", l.key))]);
    });
    filas.push(["TOTAL ACTIVO", ...todosLosPeriodos.map((p:any) => 
      ACTIVO_LINEAS.reduce((acc,l)=>{ const val=getDato(p,"activo",l.key); return acc+((l as any).negativo?-val:val); },0)
    )]);
    filas.push([]);
    filas.push(["PASIVO"]);
    PASIVO_LINEAS.forEach(l => {
      filas.push([l.label, ...todosLosPeriodos.map((p:any) => getDato(p, "pasivo", l.key))]);
    });
    filas.push(["TOTAL PASIVO", ...todosLosPeriodos.map((p:any) => 
      PASIVO_LINEAS.reduce((acc,l)=>{ const val=getDato(p,"pasivo",l.key); return acc+((l as any).negativo?-val:val); },0)
    )]);
    filas.push([]);
    filas.push(["PATRIMONIO NETO", ...todosLosPeriodos.map((p:any) => {
      const totAct=ACTIVO_LINEAS.reduce((acc,l)=>{ const val=getDato(p,"activo",l.key); return acc+((l as any).negativo?-val:val); },0);
      const totPas=PASIVO_LINEAS.reduce((acc,l)=>{ const val=getDato(p,"pasivo",l.key); return acc+((l as any).negativo?-val:val); },0);
      return totAct-totPas;
    })]);

    exportarAExcel({
      titulo: `Situación Patrimonial — ${desde} al ${hasta}`,
      columnas: ["Concepto", ...todosLosPeriodos.map((p:any) => fmtPeriodo(p))],
      filas: filas,
      fileName: `estadisticas_patrimonio_${hasta}.xlsx`,
      sheetName: "Patrimonio"
    });
  };

  const CeldaEdit = ({periodo, seccion, campo, negativo, isAuto}: any) => {
    const val = getDato(periodo, seccion, campo);
    const esEdit = patrimonioEdit?.periodo===periodo && patrimonioEdit?.key===`${seccion}.${campo}`;
    if (isAuto) {
      return (
        <td style={{padding:"6px 8px",textAlign:"right",fontFamily:"'Consolas','Courier New',monospace",fontSize:12,color:val!==0?(negativo?t.red:t.text):t.muted,background:"transparent"}}>
          {val!==0?fmtMoney(val):"—"}
        </td>
      );
    }
    return esEdit
      ? <td style={{padding:"4px 8px",textAlign:"right"}}>
          <InpMoney value={patrimonioVal} onChange={(e:any)=>setPatrimonioVal(e.target.value)}
            style={{width:110,textAlign:"right",fontSize:11}} autoFocus
            onBlur={()=>{guardarPatrimonio(periodo,seccion,campo,patrimonioVal);setPatrimonioEdit(null);}}
            onKeyDown={(e:any)=>{if(e.key==="Enter"){guardarPatrimonio(periodo,seccion,campo,patrimonioVal);setPatrimonioEdit(null);}if(e.key==="Escape")setPatrimonioEdit(null);}}/>
        </td>
      : <td onClick={()=>{setPatrimonioEdit({periodo,key:`${seccion}.${campo}`});setPatrimonioVal(String(val||""));}}
          style={{padding:"6px 8px",textAlign:"right",cursor:"pointer",fontFamily:"'Consolas','Courier New',monospace",fontSize:12,
            color:val!==0?(negativo?t.red:t.text):t.muted,
            background:"transparent",transition:"background 0.1s"}}
          onMouseEnter={e=>e.currentTarget.style.background=t.accentBg+"66"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          {val!==0?fmtMoney(val):"—"}
        </td>;
  };

  const thStyle = {padding:"8px 10px",textAlign:"right" as const,fontSize:11,fontWeight:700,color:t.muted,letterSpacing:"0.4px",textTransform:"uppercase" as const,whiteSpace:"nowrap" as const};
  const labelStyle = {padding:"8px 14px",fontSize:12,color:t.text,whiteSpace:"nowrap" as const};
  const seccionStyle = {padding:"6px 14px",fontSize:10,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase" as const};
  const totalStyle = {padding:"8px 10px",textAlign:"right" as const,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,fontSize:13};


  return (
    <>
      {filtroPeriodoJSX}
      <button id="btn-exportar-pnl-hidden" style={{display: "none"}} onClick={() => {
        if (pnlSubTab === "resultado") handleExportarExcelPnl();
      }} />

      {/* Subtabs */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`2px solid ${t.border}`}}>
        {[{id:"resultado",label:"📊 Estado de Resultados"},{id:"patrimonio",label:"🏛 Situación Patrimonial"}].map(st=>{
          const active=pnlSubTab===st.id;
          return <button key={st.id} onClick={()=>setPnlSubTab(st.id)} style={{padding:"9px 20px",border:"none",borderBottom:active?`2px solid ${t.accent}`:"2px solid transparent",marginBottom:-2,background:"none",cursor:"pointer",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",fontSize:13,fontWeight:active?700:500,color:active?t.accent:t.muted,transition:"all 0.15s"}}>{st.label}</button>;
        })}
      </div>

      {pnlSubTab==="resultado"&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        <KPI label="Margen Bruto Total" value={fmtMoney(totalGlobal.margenBruto)} sub={`Ventas ${fmtMoney(totalGlobal.ventas)}`} color={t.accent}/>
        <KPI label="Otros Ingresos (Op/Fin)" value={fmtMoney(totalGlobal.otrosIng)} sub="Ajustes, utilidades y extra" color={t.teal}/>
        <KPI label="Gastos Operativos" value={fmtMoney(totalGlobal.costoCaja)} sub="Egresos asociados a la estructura" color={t.red}/>
        <KPI label="Resultado Neto" value={fmtMoney(totalGlobal.contribucion)} sub="Contribución final global" color={totalGlobal.contribucion>=0?t.green:t.red} t={t}/>
      </div>

      {/* Gráfico Contribución */}
      <div style={{border:`1px solid ${t.border}`, borderRadius:12, padding:"20px", marginBottom:24, background:t.surf}}>
        <div style={{fontSize:13, fontWeight:700, color:t.text, marginBottom:16}}>Contribución Marginal por Unidad de Negocio</div>
        {grafUNS.length > 0 ? (
          <div style={{display:"flex", gap:16, alignItems:"flex-end", height:180, paddingLeft:60, position:"relative"}}>
            {grafUNS.map(un=>{
              const d = pnlData[un];
              const locGas = d.costoCaja;
              const yMax = Math.max(1, ...grafUNS.map(u => Math.max(pnlData[u].ingresosOp, pnlData[u].costoCaja)));
              const hIng = Math.max(2, (d.ingresosOp / yMax) * 140);
              const hGas = Math.max(2, (locGas / yMax) * 140);
              const hNeto = Math.max(2, (Math.abs(d.contribucion) / yMax) * 140);
              const isPos = d.contribucion >= 0;
              return <div key={un} style={{display:"flex", flexDirection:"column", alignItems:"center", flex:1, zIndex:1}}>
                <div style={{display:"flex", alignItems:"flex-end", gap:8, height:140, marginBottom:8}}>
                  <div style={{width:24, height:hIng, background:colorMargen, borderRadius:4}} title={`Ingresos Op: ${fmtMoney(d.ingresosOp)}`}></div>
                  <div style={{width:24, height:hGas, background:colorGasto, borderRadius:4}} title={`Gastos Op: ${fmtMoney(locGas)}`}></div>
                  <div style={{width:24, height:hNeto, background:isPos ? colorNeto : t.amber, borderRadius:4}} title={`Contribución: ${fmtMoney(d.contribucion)}`}></div>
                </div>
                <div style={{fontSize:11, fontWeight:600, color:t.text, textAlign:"center", lineHeight:1.1, whiteSpace:"nowrap", textOverflow:"ellipsis", overflow:"hidden", maxWidth:90}}>{un}</div>
              </div>;
            })}
            <div style={{position:"absolute", left:0, bottom:20, top:0, width:1, background:t.border}}></div>
            <div style={{position:"absolute", left:0, bottom:20, right:0, height:1, background:t.border}}></div>
            <div style={{position:"absolute", left:10, top:0, fontSize:10, fontWeight:600, color:t.muted}}>{fmtMoney(Math.max(1, ...grafUNS.map(u => Math.max(pnlData[u].ingresosOp, pnlData[u].costoCaja))))}</div>
            <div style={{position:"absolute", right:0, top:-16, display:"flex", gap:12}}>
              <div style={{display:"flex", alignItems:"center", gap:4, fontSize:10, color:t.muted}}><div style={{width:8,height:8,background:colorMargen,borderRadius:2}}/> Ing. Operativo</div>
              <div style={{display:"flex", alignItems:"center", gap:4, fontSize:10, color:t.muted}}><div style={{width:8,height:8,background:colorGasto,borderRadius:2}}/> Gasto Asociado</div>
              <div style={{display:"flex", alignItems:"center", gap:4, fontSize:10, color:t.muted}}><div style={{width:8,height:8,background:colorNeto,borderRadius:2}}/> Contribución</div>
            </div>
          </div>
        ) : <div style={{fontSize:12, color:t.muted, padding:"20px 0", textAlign:"center"}}>Sin datos para graficar</div>}
      </div>

      {/* Tabla estado de resultados Matriz */}
      <div style={{border:`1px solid ${t.border}`,borderRadius:12,overflow:"hidden",marginBottom:24}}>
        <div style={{padding:"10px 16px",background:t.surf2,borderBottom:`2px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:t.text}}>Estado de Resultados Integral — {fmtPeriodo(periodoActual)}</div>
        </div>

        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
            <thead>
              <tr style={{background:t.surf2}}>
                <th style={{padding:"10px 16px",textAlign:"left",fontSize:11,color:t.text,fontWeight:800,textTransform:"uppercase",borderBottom:`2px solid ${t.border}`}}>Concepto</th>
                {UNS.map(un => <th key={un} style={{padding:"10px 16px",textAlign:"right",fontSize:11,color:t.sub,fontWeight:700,borderBottom:`2px solid ${t.border}`}}>{un}</th>)}
                <th style={{padding:"10px 16px",textAlign:"right",fontSize:11,color:t.text,fontWeight:800,borderBottom:`2px solid ${t.border}`,background:t.accentBg+"22"}}>TOTAL</th>
              </tr>
            </thead>
            <tbody style={{fontSize:13}}>
              <tr style={{background:t.green+"10"}}>
                <td colSpan={UNS.length+2} style={{padding:"6px 16px",fontSize:11,fontWeight:800,color:t.green,letterSpacing:"0.5px",borderBottom:`1px solid ${t.green}33`}}>INGRESOS BRUTOS</td>
              </tr>
              <tr>
                <td style={{padding:"8px 16px",borderBottom:`1px solid ${t.border}44`,color:t.text}}>Ventas de Artículos y Servicios</td>
                {UNS.map(un => <td key={un} style={{padding:"8px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}44`,fontFamily:"'Consolas','Courier New',monospace",color:pnlData[un].ventas>0?t.text:t.muted}}>{pnlData[un].ventas>0?fmtMoney(pnlData[un].ventas):"-"}</td>)}
                <td style={{padding:"8px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}44`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700}}>{fmtMoney(totalGlobal.ventas)}</td>
              </tr>

              <tr style={{background:t.red+"08"}}>
                <td colSpan={UNS.length+2} style={{padding:"6px 16px",fontSize:11,fontWeight:800,color:t.amber,letterSpacing:"0.5px",borderBottom:`1px solid ${t.amber}22`}}>COSTOS DIRECTOS (CMV)</td>
              </tr>
              <tr>
                <td style={{padding:"8px 16px",borderBottom:`2px solid ${t.border}66`,color:t.text}}>Costo Mercadería Vendida</td>
                {UNS.map(un => <td key={un} style={{padding:"8px 16px",textAlign:"right",borderBottom:`2px solid ${t.border}66`,fontFamily:"'Consolas','Courier New',monospace",color:pnlData[un].cmv>0?t.text:t.muted}}>{pnlData[un].cmv>0?fmtMoney(pnlData[un].cmv):"-"}</td>)}
                <td style={{padding:"8px 16px",textAlign:"right",borderBottom:`2px solid ${t.border}66`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700}}>{fmtMoney(totalGlobal.cmv)}</td>
              </tr>

              <tr style={{background:t.surf2}}>
                <td style={{padding:"10px 16px",borderBottom:`1px solid ${t.border}`,color:t.accent,fontWeight:700}}>MARGEN BRUTO</td>
                {UNS.map(un => <td key={un} style={{padding:"10px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.accent}}>{fmtMoney(pnlData[un].margenBruto)}</td>)}
                <td style={{padding:"10px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}`,background:t.accentBg+"22",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.accent}}>{fmtMoney(totalGlobal.margenBruto)}</td>
              </tr>

              <tr style={{background:t.teal+"08"}}>
                <td colSpan={UNS.length+2} style={{padding:"6px 16px",fontSize:11,fontWeight:800,color:t.teal,letterSpacing:"0.5px",borderBottom:`1px solid ${t.teal}22`}}>OTROS INGRESOS Y AJUSTES</td>
              </tr>
              <tr>
                <td style={{padding:"8px 16px",borderBottom:`1px solid ${t.border}44`,color:t.text}}>Ingresos operativos de Caja y Ajustes</td>
                {UNS.map(un => {
                   const valCaja = pnlData[un].otrosIng - (un === "General" ? totUtilFCI : 0);
                   return <td key={un} style={{padding:"8px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}44`,fontFamily:"'Consolas','Courier New',monospace",color:valCaja>0?t.text:t.muted}}>{valCaja>0?fmtMoney(valCaja):"-"}</td>
                })}
                <td style={{padding:"8px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}44`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700}}>{fmtMoney(UNS.reduce((s,u)=>{
                   return s + (pnlData[u].otrosIng - (u === "General" ? totUtilFCI : 0));
                },0))}</td>
              </tr>
                {lineasDef.map(ld => {
                const val = lin[ld.key]||0;
                const esEditando = pnlEditando===ld.key;
                return (
                  <tr key={ld.key}>
                    <td style={{padding:"8px 16px",borderBottom:`1px solid ${t.border}44`,color:t.text}}>
                       {ld.label} <span style={{fontSize:9,color:t.muted,marginLeft:4}}>(manual en {ld.un})</span>
                    </td>
                    {UNS.map(un => (
                      <td key={un} style={{padding:"8px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}44`,fontFamily:"'Consolas','Courier New',monospace"}}>
                        {un === ld.un ? (
                          esEditando ? (
                            <InpMoney value={pnlValEdit} onChange={(e:any)=>setPnlValEdit(e.target.value)} style={{width:100,textAlign:"right"}} autoFocus
                              onBlur={()=>{guardarLinea(ld.key,pnlValEdit);setPnlEditando(null);}}
                              onKeyDown={(e: any)=>{if(e.key==="Enter"||e.key==="Escape"){guardarLinea(ld.key,pnlValEdit);setPnlEditando(null);}}} />
                          ) : (
                            <span onClick={()=>{if(esUnSoloPeriodo){setPnlEditando(ld.key);setPnlValEdit(String(val||""));}}} style={{cursor:esUnSoloPeriodo?"pointer":"default",borderBottom:esUnSoloPeriodo?`1px dashed ${t.border}`:"none",color:val>0?t.teal:t.muted}} title={!esUnSoloPeriodo?"Editá seleccionando un único mes":"Editar"}>{val>0?fmtMoney(val):"—"}</span>
                          )
                        ) : "-"}
                      </td>
                    ))}
                    <td style={{padding:"8px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}44`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700}}>{val>0?fmtMoney(val):"-"}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={{padding:"8px 16px",borderBottom:`2px solid ${t.border}66`,color:t.text}}>Utilidades FCI e Inversiones automaticas</td>
                {UNS.map(un => <td key={un} style={{padding:"8px 16px",textAlign:"right",borderBottom:`2px solid ${t.border}66`,fontFamily:"'Consolas','Courier New',monospace",color:un==="General"&&totUtilFCI>0?t.teal:t.muted}}>{un==="General"&&totUtilFCI>0?fmtMoney(totUtilFCI):"-"}</td>)}
                <td style={{padding:"8px 16px",textAlign:"right",borderBottom:`2px solid ${t.border}66`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700}}>{totUtilFCI>0?fmtMoney(totUtilFCI):"-"}</td>
              </tr>

              <tr style={{background:t.teal+"14"}}>
                <td style={{padding:"10px 16px",borderBottom:`3px solid ${t.border}55`,color:t.teal,fontWeight:700}}>INGRESOS OPERATIVOS NETOS</td>
                {UNS.map(un => <td key={un} style={{padding:"10px 16px",textAlign:"right",borderBottom:`3px solid ${t.border}55`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.teal}}>{fmtMoney(pnlData[un].ingresosOp)}</td>)}
                <td style={{padding:"10px 16px",textAlign:"right",borderBottom:`3px solid ${t.border}55`,background:t.accentBg+"22",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:t.teal}}>{fmtMoney(totalGlobal.ingresosOp)}</td>
              </tr>

              <tr style={{background:t.red+"08"}}>
                <td colSpan={UNS.length+2} style={{padding:"6px 16px",fontSize:11,fontWeight:800,color:t.red,letterSpacing:"0.5px",borderBottom:`1px solid ${t.red}22`}}>GASTOS Y COSTOS OPERATIVOS</td>
              </tr>
              <tr>
                <td style={{padding:"8px 16px",borderBottom:`1px solid ${t.border}44`,color:t.text}}>Egresos y Ajustes Caja</td>
                {UNS.map(un => <td key={un} style={{padding:"8px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}44`,fontFamily:"'Consolas','Courier New',monospace", color:(pnlData[un].costoCaja - (un === "General" ? (lin.gastosManuales||0) : 0))>0?t.red:t.muted}}>
                  {(pnlData[un].costoCaja - (un === "General" ? (lin.gastosManuales||0) : 0))>0?fmtMoney(pnlData[un].costoCaja - (un === "General" ? (lin.gastosManuales||0) : 0)):"-"}
                </td>)}
                <td style={{padding:"8px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}44`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.red}}>{totalGlobal.costoCaja-(lin.gastosManuales||0)>0?fmtMoney(totalGlobal.costoCaja-(lin.gastosManuales||0)):"-"}</td>
              </tr>

              <tr>
                <td style={{padding:"8px 16px",borderBottom:`2px solid ${t.border}66`,color:t.text}}>
                   Gastos Adicionales <span style={{fontSize:9,color:t.muted,marginLeft:4}}>(manual en General)</span>
                </td>
                {UNS.map(un => <td key={un} style={{padding:"8px 16px",textAlign:"right",borderBottom:`2px solid ${t.border}66`,fontFamily:"'Consolas','Courier New',monospace"}}>
                  {un === "General" ? (
                    pnlEditando==="gastosManuales" ? (
                      <InpMoney value={pnlValEdit} onChange={(e:any)=>setPnlValEdit(e.target.value)} style={{width:100,textAlign:"right"}} autoFocus
                        onBlur={()=>{guardarLinea("gastosManuales",pnlValEdit);setPnlEditando(null);}}
                        onKeyDown={(e: any)=>{if(e.key==="Enter"||e.key==="Escape"){guardarLinea("gastosManuales",pnlValEdit);setPnlEditando(null);}}} />
                    ) : (
                      <span onClick={()=>{if(esUnSoloPeriodo){setPnlEditando("gastosManuales");setPnlValEdit(String((lin.gastosManuales||0)));}}} style={{cursor:esUnSoloPeriodo?"pointer":"default",borderBottom:esUnSoloPeriodo?`1px dashed ${t.border}`:"none",color:(lin.gastosManuales||0)>0?t.red:t.muted}} title={!esUnSoloPeriodo?"Editá seleccionando un único mes":"Editar"}>{(lin.gastosManuales||0)>0?fmtMoney((lin.gastosManuales||0)):"—"}</span>
                    )
                  ) : "-"}
                </td>)}
                <td style={{padding:"8px 16px",textAlign:"right",borderBottom:`2px solid ${t.border}66`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.red}}>{(lin.gastosManuales||0)>0?fmtMoney(lin.gastosManuales):"-"}</td>
              </tr>

              <tr style={{background:t.surf2}}>
                <td style={{padding:"14px 16px",borderBottom:`1px solid ${t.border}`,fontSize:14,fontWeight:800,color:t.text}}>CONTRIBUCIÓN NETA</td>
                {UNS.map(un => <td key={un} style={{padding:"14px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}`,fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,fontSize:14,color:pnlData[un].contribucion>=0?t.green:t.red}}>{fmtMoney(pnlData[un].contribucion)}</td>)}
                <td style={{padding:"14px 16px",textAlign:"right",borderBottom:`1px solid ${t.border}`,background:t.accentBg+"22",fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,fontSize:15,color:totalGlobal.contribucion>=0?t.green:t.red}}>{fmtMoney(totalGlobal.contribucion)}</td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>
      </>}

      {/* ── SITUACIÓN PATRIMONIAL ── */}
      {pnlSubTab==="patrimonio"&&<>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12}}>
          <div style={{fontSize:12,color:t.muted}}>Clic en cualquier celda para editar. Los valores negativos (proveedores) se ingresan como positivos y el sistema los resta.</div>
          <button id="btn-exportar-patrimonio-hidden" style={{display: "none"}} onClick={handleExportarExcelPatrimonio} />
        </div>
        <div style={{overflowX:"auto",border:`1px solid ${t.border}`,borderRadius:12,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
            <thead>
              <tr style={{background:t.surf2,borderBottom:`2px solid ${t.border}`}}>
                <th style={{...thStyle,textAlign:"left",minWidth:220}}>Concepto</th>
                {todosLosPeriodos.map((p:any)=><th key={p} style={{...thStyle,color:p===periodoActual?t.accent:t.muted,background:p===periodoActual?t.accentBg:"transparent"}}>{fmtPeriodo(p)}</th>)}
              </tr>
            </thead>
            <tbody>
              {/* ACTIVO */}
              <tr style={{background:t.green+"12"}}>
                <td colSpan={todosLosPeriodos.length+1} style={{...seccionStyle,color:t.green}}>▸ Activo</td>
              </tr>
              {ACTIVO_LINEAS.map((l:any,i:number)=>(
                <tr key={l.key} style={{borderBottom:`1px solid ${t.border}22`,background:i%2===0?t.surf:t.surf2}}>
                  <td style={labelStyle}>{l.label}{l.negativo&&<span style={{fontSize:10,color:t.muted,marginLeft:4}}>(se resta)</span>}{l.auto&&<span style={{fontSize:9,color:t.muted,marginLeft:4}}>(auto)</span>}</td>
                  {todosLosPeriodos.map((p:any)=><CeldaEdit key={p} periodo={p} seccion="activo" campo={l.key} negativo={l.negativo} isAuto={l.auto}/>)}
                </tr>
              ))}
              <tr style={{background:t.green+"20",borderTop:`2px solid ${t.border}`}}>
                <td style={{...labelStyle,fontWeight:700,color:t.text}}>Total Activo</td>
                {todosLosPeriodos.map((p:any)=><td key={p} style={{...totalStyle,color:t.green,background:p===periodoActual?t.accentBg:"transparent"}}>{fmtMoney(getTotalActivo(p))}</td>)}
              </tr>

              {/* PASIVO */}
              <tr style={{background:t.red+"12"}}>
                <td colSpan={todosLosPeriodos.length+1} style={{...seccionStyle,color:t.red}}>▸ Pasivo</td>
              </tr>
              {PASIVO_LINEAS.map((l:any,i:number)=>(
                <tr key={l.key} style={{borderBottom:`1px solid ${t.border}22`,background:i%2===0?t.surf:t.surf2}}>
                  <td style={labelStyle}>{l.label}{l.auto&&<span style={{fontSize:9,color:t.muted,marginLeft:4}}>(auto)</span>}</td>
                  {todosLosPeriodos.map((p:any)=><CeldaEdit key={p} periodo={p} seccion="pasivo" campo={l.key} isAuto={l.auto}/>)}
                </tr>
              ))}
              <tr style={{background:t.red+"20",borderTop:`2px solid ${t.border}`}}>
                <td style={{...labelStyle,fontWeight:700,color:t.text}}>Total Pasivo</td>
                {todosLosPeriodos.map((p:any)=><td key={p} style={{...totalStyle,color:t.red,background:p===periodoActual?t.accentBg:"transparent"}}>{fmtMoney(getTotalPasivo(p))}</td>)}
              </tr>

              {/* Diferencia Activo − Pasivo */}
              <tr style={{background:t.surf3||t.surf2,borderTop:`3px solid ${t.border}`}}>
                <td style={{...labelStyle,fontWeight:800,fontSize:13,color:t.text}}>Dif. Activo − Pasivo</td>
                {todosLosPeriodos.map((p:any)=>{
                  const dif=getDifActPas(p);
                  return <td key={p} style={{...totalStyle,fontWeight:800,fontSize:14,color:dif>=0?t.green:t.red,background:p===periodoActual?t.accentBg:"transparent"}}>{fmtMoney(dif)}</td>;
                })}
              </tr>

              {/* Diferencia Patrimonial */}
              <tr style={{background:t.accentBg,borderTop:`1px solid ${t.border}`}}>
                <td style={{...labelStyle,fontWeight:800,fontSize:13,color:t.accent}}>Diferencia Patrimonial</td>
                {todosLosPeriodos.map((p:any,idx:number)=>{
                  const actual = getDifActPas(p);
                  const anterior = idx>0 ? getDifActPas(todosLosPeriodos[idx-1]) : null;
                  const diff = anterior!==null ? actual-anterior : null;
                  return <td key={p} style={{...totalStyle,fontWeight:800,fontSize:14,color:diff===null?t.muted:diff>=0?t.green:t.red,background:p===periodoActual?t.accentBg+"88":"transparent"}}>
                    {diff===null?"—":(diff>=0?"+":"")+fmtMoney(diff)}
                  </td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </>}
    </>
  );
}
