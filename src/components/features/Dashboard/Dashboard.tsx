import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { Btn, Ic, Card, KPI, Bdg, Tbl, Tr, Td, Avatar, Modal, PgHdr, OverlaySheet } from '../../common/UIBase';
import { fmtMoney, fmtFechaCC, fmtNum, getToday, tipoClienteG, facturasConAlerta, fechaVto } from '../../../lib/utils';
import { PageContainer } from '../../layout/AppShell';
import { calcSaldo, getClientesInactivosAuto, getStockCritico, getCvFacturadoHoy, getTotalFacturadoHoy, getGananciaDia, getGananciaMes, getTopArticulos, getSeacEquiposKPI } from '../../../lib/dashboard/dashboardLogic';

export const WIDGETS_DEF = ["clientes_inactivos","limite_excedido","facturas_vencidas","pagos_por_vencer","saldo_bancario","stock_critico","top_articulos","cv_hoy","total_hoy","ganancia_dia","ganancia_mes","seac_equipos"];

export const WIDGET_META: Record<string, any> = {
  clientes_inactivos:{ label:"Clientes inactivos", icon:"clientes",    color:"amber" },
  saldo_bancario:    { label:"Cuentas bancarias", icon:"caja",        color:"accent" },
  stock_critico:     { label:"Stock crítico",     icon:"alert",       color:"red" },
  top_articulos:     { label:"Top artículos",     icon:"ventas",      color:"teal" },
  cv_hoy:            { label:"CV facturado hoy",  icon:"transfer",    color:"green" },
  total_hoy:         { label:"Total facturado hoy", icon:"ventas",    color:"accent" },
  ganancia_dia:      { label:"Ganancia del día",   icon:"caja",       color:"teal" },
  ganancia_mes:      { label:"Ganancia del mes",   icon:"stats",      color:"green" },
  facturas_vencidas: { label:"Facturas vencidas",  icon:"ventas",      color:"red" },
  pagos_por_vencer:  { label:"Facturas por vender", icon:"ventas",      color:"amber" },
  limite_excedido:   { label:"Límite excedido",    icon:"alert",       color:"red" },
  seac_equipos:      { label:"Equipos SEAC",       icon:"alert",       color:"red" },
};

export default function Dashboard({ pagos = [], clientes = [], cuentas = [], facturas = [], articulos = [], familias = [], user, seacMovs=[], utilidadesFCI=[], setFacturas = (f: any) => {} }: any) {
  const today = getToday();
  const { t, isDark } = useApp();
  const [configurando, setConfigurando] = useState(false);
  const [widgets, setWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem("gp_dashboard_widgets");
      return saved ? JSON.parse(saved) : ["clientes_inactivos","facturas_vencidas","pagos_por_vencer","saldo_bancario","stock_critico","top_articulos","cv_hoy","total_hoy","seac_equipos"];
    } catch { return ["clientes_inactivos","facturas_vencidas","pagos_por_vencer","saldo_bancario","stock_critico","top_articulos","cv_hoy","total_hoy","seac_equipos"]; }
  });
  const [modalDetalle, setModalDetalle] = useState(null);
  const [alertasDescartadas, setAlertasDescartadas] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gp_alertas_descartadas")||"[]"); } catch { return []; }
  });
  const [sortInactivosCol, setSortInactivosCol] = useState("dias");
  const [sortInactivosDir, setSortInactivosDir] = useState("desc");
  const [notasEquipos, setNotasEquipos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gp_seac_notas_equipos")||"{}"); } catch { return {}; }
  });
  const guardarNotaEquipo = (serial, nota) => {
    const nuevas = {...notasEquipos, [serial]: nota};
    setNotasEquipos(nuevas);
    try { localStorage.setItem("gp_seac_notas_equipos", JSON.stringify(nuevas)); } catch {}
  };
  const [confirmarDescartar, setConfirmarDescartar] = useState(null); // factura a descartar

  // Widgets que el usuario puede ver según permisos
  const widgetsPermitidos = user?.rol==="maestro"
    ? WIDGETS_DEF
    : (user?.permisos?.widgetsVisibles||[]).filter(w=>w!=="ganancia_dia");

  // Si usuario no maestro y sin widgets asignados → no ve dashboard
  const sinAcceso = user?.rol!=="maestro" && widgetsPermitidos.length===0;

  // Widgets activos filtrados por permisos
  const widgetsFiltrados = [...new Set(widgets.filter(w => (widgetsPermitidos||[]).includes(w)))];

  // ── Lógica de estados automáticos ──────────────────────────────────────────
  // Tipo de cliente: "cv" si tiene alguna factura con art 044, "cig" si no
  const tipoCliente = (cid) => tipoClienteG(cid, facturas);

  // Clientes que tengan estado "inactivo", pero excluir aquellos con actividad reciente
  const clientesInactivosAuto = React.useMemo(() => {
    return getClientesInactivosAuto(clientes, facturas, today);
  }, [clientes, facturas, today]);
  
  const inactivos = clientesInactivosAuto.length;
  // facturasConAlerta limitada a últimos 6 meses — facturas más viejas deberían estar cobradas
  const hace6meses = React.useMemo(()=>{ const d=new Date(today+"T00:00:00"); d.setMonth(d.getMonth()-6); return d.toISOString().slice(0,10); },[]);
  const facturasFiltradas = React.useMemo(()=>facturas.filter(f=>!f.anulada&&(f.fecha||"")>=hace6meses),[facturas,hace6meses]);
  const facConAlerta = React.useMemo(()=>facturasConAlerta(facturasFiltradas, pagos, articulos),[facturasFiltradas,pagos,articulos]);
  const facVencidas = React.useMemo(()=>facConAlerta.filter(f=>f._estado==="vencida"&&!alertasDescartadas.includes(f.id)&&(f.condPago||f.obs)!=="Financiado"),[facConAlerta,alertasDescartadas]);
  const clientesExcedidos = React.useMemo(()=>clientes.filter(c=>c.estado==="activo"&&c.creditoMax>0&&calcSaldo(c.id, clientes, facturas, pagos)>c.creditoMax),[clientes,facturas,pagos]);
  const facPorVencer = React.useMemo(()=>facConAlerta.filter(f=>f._estado==="por_vencer"),[facConAlerta]);

  // ── Stock crítico ────────────────────────────────────────────────────────────
  const stockCritico = React.useMemo(()=>getStockCritico(articulos), [articulos]);

  // ── CV facturado hoy ──────────────────────────────────────────────────────
  const todayDyn = getToday();
  const cvHoy = React.useMemo(() => getCvFacturadoHoy(facturas, todayDyn), [facturas, todayDyn]);

  const totalFacturadoHoy = React.useMemo(() => getTotalFacturadoHoy(facturas, todayDyn), [facturas, todayDyn]);

  // KPI Ganancia del día — utilidad neta = subtotal - costo de los ítems
  const gananciaDia = React.useMemo(() => getGananciaDia(facturas, articulos, utilidadesFCI, todayDyn), [facturas, articulos, todayDyn, utilidadesFCI]);

  // ── Top artículos mes en curso ─────────────────────────────────────────
  const mesEnCursoStr = today.slice(0,7);
  const topArticulos = React.useMemo(() => getTopArticulos(facturas, articulos, mesEnCursoStr), [facturas, mesEnCursoStr, articulos]);

  // ── KPI Equipos SEAC ──────────────────────────────────────────────────
  const seacEquiposKPI = React.useMemo(() => getSeacEquiposKPI(seacMovs), [seacMovs]);

  // Ganancia del mes corriente (desde primer día del mes actual)
  const primerDiaMesDash = React.useMemo(()=>{ const d=new Date(today); d.setDate(1); return d.toISOString().slice(0,10); },[]);
  const { gananciasMes, margenMes } = React.useMemo(() => getGananciaMes(facturas, articulos, utilidadesFCI, primerDiaMesDash), [facturas, articulos, primerDiaMesDash, utilidadesFCI]);

  const vals = {
    clientes_inactivos:{ value:inactivos,          sub:"Inactivos" },
    facturas_vencidas: { value:facVencidas.length, sub:"Saldo deudor vencido" },
    pagos_por_vencer:  { value:facPorVencer.length,sub:"Próximos a vencer" },
    limite_excedido:   { value:clientesExcedidos.length, sub:"Superaron su límite" },
    stock_critico:     { value:stockCritico.length,        sub:"Artículos bajo mínimo" },
    top_articulos:     { value:topArticulos.length>0?topArticulos[0][0]:"—", sub:topArticulos.length>0?`${Math.round(topArticulos[0][1])} uds · últimos 30d`:"Sin ventas" },
    cv_hoy:            { value:fmtMoney(cvHoy),                sub:"Facturado CV hoy" },
    total_hoy:         { value:fmtMoney(totalFacturadoHoy),    sub:`${facturas.filter(f=>f.fecha===todayDyn&&!f.anulada&&(f.tipo==="factura"||f.tipo==="nc")).length} comprobantes hoy` },
    ganancia_dia:      { value:fmtMoney(gananciaDia),          sub:"Utilidad neta del día" },
    ganancia_mes:      { value:fmtMoney(gananciasMes), sub:`Margen ${margenMes}% · +FCI` },
    seac_equipos:      { value: seacEquiposKPI.activo ? seacEquiposKPI.total : 0,
                         sub: seacEquiposKPI.activo ? (() => {
                           const primerPendiente = seacEquiposKPI.pendientes[0];
                           const nota = primerPendiente?.serial ? notasEquipos[primerPendiente.serial] : null;
                           if(nota) return `💬 ${nota}`;
                           const partes = [
                             seacEquiposKPI.pendientes.length>0 ? `POS: ${seacEquiposKPI.pos} · LG: ${seacEquiposKPI.lg} sin reintegro` : "",
                             seacEquiposKPI.devSinDebito.length>0 ? `${seacEquiposKPI.devSinDebito.length} reintegro sin débito` : ""
                           ].filter(Boolean);
                           return partes.join(" · ") || "Revisar equipos";
                         })() : "Sin equipos pendientes" },
  };

  const onClickKPI = { facturas_vencidas:()=>setModalDetalle("vencidas"), pagos_por_vencer:()=>setModalDetalle("por_vencer"), clientes_inactivos:()=>setModalDetalle("inactivos"), limite_excedido:()=>setModalDetalle("limite_excedido"), stock_critico:()=>setModalDetalle("stock_critico"), top_articulos:()=>setModalDetalle("top_articulos"), seac_equipos:()=>seacEquiposKPI.activo&&setModalDetalle("seac_equipos"), ganancia_dia:()=>setModalDetalle("ganancia_dia") };
  const colorOf = (c) => ({ accent:t.accent, red:t.red, green:t.green, amber:t.amber, teal:t.teal }[c]||t.accent);
  const toggle = (w) => setWidgets(prev => {
    const nuevo = prev.includes(w) ? prev.filter(x=>x!==w) : [...prev, w];
    try { localStorage.setItem("gp_dashboard_widgets", JSON.stringify(nuevo)); } catch {}
    return nuevo;
  });

  const clientesInactivos = clientesInactivosAuto;
  const facsHoyDetalle = facturas.filter(f=>f.fecha===getToday()&&!f.anulada&&(f.tipo==="factura"||f.tipo==="nc"));
  const detalleData = {
    vencidas:   { title:"Facturas Vencidas",    sub:`${facVencidas.length} facturas — cliente con saldo deudor`, color:t.red,   items:facVencidas },
    por_vencer: { title:"Por Vencer (≤7 días)", sub:`${facPorVencer.length} facturas próximas a vencer`,         color:t.amber, items:facPorVencer },
    inactivos:  { title:"Clientes inactivos", sub:`${clientesInactivosAuto.length} inactivos`, color:t.amber, items:clientesInactivos },
    limite_excedido: { title:"Límite de crédito excedido", sub:`${clientesExcedidos.length} clientes superaron su límite`, color:t.red, items:clientesExcedidos },
    stock_critico:   { title:"Stock crítico", sub:`${stockCritico.length} artículos bajo mínimo`, color:t.red, items:stockCritico },
    top_articulos:   { title:"Top artículos — este mes", sub:`${topArticulos.length} artículos con ventas`, color:t.teal, items:topArticulos },
    seac_equipos:    { title:"Equipos SEAC", sub:`POS: ${seacEquiposKPI.pos} · LG: ${seacEquiposKPI.lg} pendientes · ${seacEquiposKPI.devSinDebito.length} reintegros sin débito`, color:t.red, items:[...seacEquiposKPI.pendientes, ...seacEquiposKPI.devSinDebito.map(r=>({...r,_esDevSinDebito:true}))] },
    ganancia_dia:    { title:"Ganancia del día", sub:`${facsHoyDetalle.length} comprobantes · ${fmtMoney(gananciaDia)} utilidad neta`, color:t.teal, items:facsHoyDetalle },
  };

  // Filtrar cuentas según permisos del usuario y eliminar duplicados conceptuales
  const uniqueCuentas = Array.isArray(cuentas) ? cuentas.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) : [];
  const cuentasVisiblesUser = (user?.rol==="maestro"
    ? uniqueCuentas
    : uniqueCuentas.filter(c => {
        const permitidas = user?.permisos?.cuentasVisibles||[];
        return permitidas.length===0 ? true : permitidas.includes(c.id);
      })
  ).filter((v, i, a) => a.findIndex(t => t.nombre?.toLowerCase().trim() === v.nombre?.toLowerCase().trim() && t.tipo === v.tipo) === i);

  const cuentasBanco = cuentasVisiblesUser.filter(c=>c.tipo==="banco");

  return (
    <PageContainer title="Dashboard" stickyHeader={false} sub={`Bienvenido, ${user.nombre} · ${fmtFechaCC(today)}`} actions={
      user?.rol==="maestro"&&<Btn v="ghost" onClick={()=>setConfigurando(true)}><Ic n="grid" s={14}/>Personalizar</Btn>
    }>

      {sinAcceso ? (
        <div style={{textAlign:"center",padding:"60px 0",color:t.muted}}>
          <div style={{fontSize:40,marginBottom:16}}>🔒</div>
          <div style={{fontSize:16,fontWeight:700,color:t.sub,marginBottom:8}}>Sin acceso al Dashboard</div>
          <div style={{fontSize:13,color:t.muted}}>Tu usuario no tiene widgets habilitados. Contactá al administrador.</div>
        </div>
      ) : (
      <>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14, marginBottom:20 }}>
        {widgetsFiltrados.map(w => {
          const meta = WIDGET_META[w as keyof typeof WIDGET_META]; const val = vals[w as keyof typeof vals];
          if(!meta||!val) return null;
          const doble = w==="cv_hoy";
          
          let topLabel = "Ver detalle →";
          let topLabelColor = "";
          
          if (w === "facturas_vencidas" && (val.value as number) > 0) { topLabel = "Alerta"; topLabelColor = colorOf("red"); }
          if (w === "stock_critico" && (val.value as number) > 0) { topLabel = "Acción requerida"; topLabelColor = colorOf("red"); }
          if (w === "clientes_inactivos" && (val.value as number) > 0) { topLabel = "Atención"; topLabelColor = colorOf("amber"); }
          if (w === "pagos_por_vencer" && (val.value as number) > 0) { topLabel = "Alerta"; topLabelColor = colorOf("amber"); }
          if (w === "limite_excedido" && (val.value as number) > 0) { topLabel = "Acción requerida"; topLabelColor = colorOf("red"); }
          if (w === "cv_hoy" || w === "total_hoy" || w === "ganancia_dia" || w === "ganancia_mes") { topLabel = "Diario"; topLabelColor = colorOf("teal"); }
          if (w === "ganancia_mes") { topLabel = "Mensual"; topLabelColor = colorOf("green"); }
          if (!onClickKPI[w as keyof typeof onClickKPI]) topLabel = ""; // Only show topLabel if it's clickable, unless it's a specific alert
          
          return <div key={w} style={{gridColumn:doble?"span 2":"span 1"}}>
            <KPI label={meta.label} value={val.value} sub={val.sub} color={colorOf(meta.color)} onClick={onClickKPI[w as keyof typeof onClickKPI]} icon={meta.icon} topLabel={topLabel} topLabelColor={topLabelColor} />
          </div>;
        })}
      </div>

      {widgetsFiltrados.includes("saldo_bancario")&&(
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 16 }}>Cuentas Bancarias</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:20 }}>
            {cuentasBanco.map((c: any, i: number) => {
              const isDarkCard = isDark ? true : (i % 2 === 0);
              const bgColor = isDark ? (i % 2 === 0 ? t.surf : t.bg) : (isDarkCard ? "#0A2540" : "#ffffff");
              const textColor = isDarkCard ? "#ffffff" : t.text;
              const subColor = isDarkCard ? "rgba(255,255,255,0.7)" : t.sub;

              return (
                <div key={c.id} style={{ 
                  background: bgColor, 
                  borderRadius: 16, 
                  border: isDarkCard ? "none" : `1px solid ${t.border}`, 
                  boxShadow: isDarkCard ? "0 8px 20px -8px rgba(10,37,64,0.5)" : "0 4px 15px -4px rgba(0,0,0,0.05)",
                  position: "relative", 
                  overflow: "hidden"
                }}>
                  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, position: "relative", zIndex: 1 }}>
                       <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                         <div style={{ fontSize: 13, color: textColor, fontWeight: 700, letterSpacing: "-0.2px" }}>
                           {c.nombre}
                         </div>
                       </div>
                       <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={async e => {
                             e.stopPropagation();
                             const el = document.getElementById(`export-dash-cuenta-${c.id}`);
                             if (!el) return;
                             const originalStyle = el.style.cssText;
                             try {
                               el.style.position = 'fixed';
                               el.style.top = '0';
                               el.style.left = '0';
                               el.style.zIndex = '9999';
                               el.style.visibility = 'visible';
                               el.style.display = 'block';

                               const htmlToImage = await import('html-to-image');
                               const dataUrl = await htmlToImage.toPng(el, { cacheBust: true, pixelRatio: 2 });
                               const link = document.createElement('a');
                               link.download = `datos-cuenta-${c.nombre.replace(/\s+/g, '-').toLowerCase()}.png`;
                               link.href = dataUrl;
                               link.click();
                             } catch(err) {
                               console.error(err);
                               alert("Error exportando imagen");
                             } finally {
                               el.style.cssText = originalStyle;
                             }
                          }} title="Exportar datos" style={{ width: 24, height: 24, borderRadius: "50%", background: "none", border: `1px solid ${isDarkCard ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"}`, color: isDarkCard ? "#fff" : t.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <Ic n="download" s={12} />
                          </button>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: isDarkCard ? "rgba(255,255,255,0.1)" : c.color + "1a", color: isDarkCard ? "#fff" : c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                             <Ic n={c.tipo === "banco" ? "caja" : c.tipo === "inversion" ? "stats" : "ventas"} s={12} />
                          </div>
                       </div>
                    </div>

                    {/* Simplified Information Layout */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      {c.titular && <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>Titular</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{c.titular}</div>
                      </div>}
                      
                      {c.tipoCuentaBancaria && <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>Tipo de Cuenta</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{c.tipoCuentaBancaria}</div>
                      </div>}

                      {c.numeroCuenta && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>Número / CBU</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: textColor, fontFamily: "monospace" }}>{c.numeroCuenta}</div>
                        </div>
                      )}

                      {c.alias && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>Alias CVU</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: textColor, fontFamily: "monospace" }}>{c.alias}</div>
                        </div>
                      )}
                    </div>

                    <div id={`export-dash-cuenta-${c.id}`} style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: 400, background: bgColor, padding: 30, borderRadius: 16, border: isDarkCard ? "none" : `1px solid ${t.border}`, color: textColor, zIndex: -1, display: 'none' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{c.nombre}</div>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: isDarkCard ? "rgba(255,255,255,0.1)" : c.color + "1a", color: isDarkCard ? "#fff" : c.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                             <Ic n={c.tipo === "banco" ? "caja" : c.tipo === "inversion" ? "stats" : "ventas"} s={20} />
                          </div>
                       </div>
                       <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 15 }}>
                          {c.titular && <div>
                            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", marginBottom: 4 }}>Titular</div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{c.titular}</div>
                          </div>}
                          {c.tipoCuentaBancaria && <div>
                            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", marginBottom: 4 }}>Tipo de Cuenta</div>
                            <div style={{ fontSize: 16, fontWeight: 600 }}>{c.tipoCuentaBancaria}</div>
                          </div>}
                          {c.numeroCuenta && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", marginBottom: 4 }}>Número / CBU</div>
                              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "monospace" }}>{c.numeroCuenta}</div>
                            </div>
                          )}
                          {c.alias && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", marginBottom: 4 }}>Alias CVU</div>
                              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "monospace" }}>{c.alias}</div>
                            </div>
                          )}
                       </div>
                       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${isDarkCard ? "rgba(255,255,255,0.1)" : t.border}`, paddingTop: 16, marginTop: 24 }}>
                          <div style={{ fontSize: 12, opacity: 0.7, fontFamily: "monospace", letterSpacing: "1px" }}>
                            **** {String(c.id).slice(-4) || "0000"}
                          </div>
                          <div style={{ background: isDarkCard ? "rgba(255,255,255,0.15)" : c.color + "1a", color: isDarkCard ? "#fff" : c.color, padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                            {c.tipo}
                          </div>
                       </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, position: "relative", zIndex: 1, paddingTop: 12, borderTop: isDarkCard ? "1px solid rgba(255,255,255,0.1)" : `1px solid ${t.border}` }}>
                      <div style={{ fontSize: 12, color: subColor, fontFamily: "monospace", letterSpacing: "1.5px" }}>
                        **** {String(c.id).slice(-4) || "0000"}
                      </div>
                      <div style={{ background: isDarkCard ? "rgba(255,255,255,0.15)" : c.color + "1a", color: isDarkCard ? "#fff" : c.color, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {c.tipo}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <OverlaySheet open={configurando} onClose={()=>setConfigurando(false)} title="Personalizar Dashboard" sub="Elegí qué información querés ver">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {WIDGETS_DEF.map(w=>{
            const meta=WIDGET_META[w]; const active=widgets.includes(w); const color=colorOf(meta.color);
            return <div key={w} onClick={()=>toggle(w)} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px", borderRadius:10, border:`1px solid ${active?color+"44":t.border}`, background:active?color+"10":t.surf2, cursor:"pointer", transition:"all 0.15s" }}>
              <div style={{ width:28, height:28, borderRadius:7, background:color+"20", display:"flex", alignItems:"center", justifyContent:"center", color, flexShrink:0 }}><Ic n={meta.icon} s={14}/></div>
              <span style={{ fontSize:12, fontWeight:600, color:active?color:t.sub }}>{meta.label}</span>
              {active&&<div style={{ marginLeft:"auto", width:16, height:16, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center" }}><Ic n="check" s={10}/></div>}
            </div>;
          })}
        </div>
        <Btn onClick={()=>setConfigurando(false)} style={{ marginTop:16 }} full>Guardar</Btn>
      </OverlaySheet>

      {/* Modal detalle KPIs */}
      {modalDetalle&&(()=>{
        const d = detalleData[modalDetalle];
        const diasDiff = (vto: any) => {
          const diff = Math.round((new Date(vto+"T00:00:00").getTime()-new Date(today+"T00:00:00").getTime())/(1000*60*60*24));
          return diff;
        };
        return (
          <OverlaySheet open={true} onClose={()=>setModalDetalle(null)} title={d.title} sub={d.sub} width={820}>
            {d.items.length===0
              ? <div style={{textAlign:"center",padding:"28px 0",color:t.muted,fontSize:13}}>No hay elementos en esta categoría</div>
              : modalDetalle==="limite_excedido"
                ? <>
                    <Tbl stickyTop={false} headers={["Cliente","Saldo actual","Límite","Exceso"]}>
                      {d.items.map(c=>{ const saldo=calcSaldo(c.id, clientes, facturas, pagos); return <Tr key={c.id}>
                        <Td><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar nombre={c.nombre}/><span style={{fontWeight:600}}>{c.nombre}</span></div></Td>
                        <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.red}}>{fmtMoney(saldo)}</Td>
                        <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,color:t.sub}}>{fmtMoney(c.creditoMax)}</Td>
                        <Td><Bdg color={t.red}>{fmtMoney(saldo-c.creditoMax)}</Bdg></Td>
                      </Tr>;})}
                    </Tbl>
                  </>
                : modalDetalle==="stock_critico"
                ? <Tbl stickyTop={false} headers={["Artículo","Familia","Stock actual","Mínimo"]}>
                    {d.items.map(a=>(
                      <Tr key={a.id}>
                        <Td><div style={{fontWeight:600}}>{a.nombre}</div><div style={{fontSize:11,color:t.muted}}>{a.codigo}</div></Td>
                        <Td>
                          {(() => {
                            const fName = typeof a.familia === "string" ? a.familia : a.familia?.nombre || "Varios";
                            const fObj = (familias || []).find((f: any) => (typeof f === "string" ? f : f.nombre) === fName);
                            const fColor = fObj && typeof fObj === "object" && fObj.color ? fObj.color : t.purple;
                            return <Bdg color={fColor}>{fName}</Bdg>;
                          })()}
                        </Td>
                        <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:a.stock===0?t.red:t.amber}}>{fmtNum(a.stock)}</Td>
                        <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,color:t.muted}}>{a.familia==="CIG."?250:10}</Td>
                      </Tr>
                    ))}
                  </Tbl>
                : modalDetalle==="top_articulos"
                ? <Tbl stickyTop={false} headers={["#","Artículo","Unidades vendidas"]}>
                    {d.items.map(([nombre,cant],i)=>(
                      <Tr key={nombre}>
                        <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.teal,fontSize:16}}>#{i+1}</Td>
                        <Td style={{fontWeight:600}}>{nombre}</Td>
                        <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.teal}}>{Math.round(cant).toLocaleString("es-AR")}</Td>
                      </Tr>
                    ))}
                  </Tbl>
                : modalDetalle==="seac_equipos"
                ? <div>
                    <Tbl stickyTop={false} headers={["Tipo","Serial","Fecha","Importe","Estado","Anotación"]}>
                    {d.items.map((m,i)=>{
                      const esDevSinDebito = m._esDevSinDebito;
                      const tipoLabel = esDevSinDebito ? "NC" : m.tipo==="Perdida de POS" ? "POS" : "LG";
                      const tipoColor = esDevSinDebito ? t.green : m.tipo==="Perdida de POS" ? t.amber : t.purple;
                      const serial = m.serial||"";
                      const nota = notasEquipos[serial]||"";
                      return (
                        <Tr key={i}>
                          <Td><Bdg color={tipoColor}>{tipoLabel}</Bdg></Td>
                          <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:600}}>{serial||"—"}</Td>
                          <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,color:t.sub}}>{fmtFechaCC(m.fecha)}</Td>
                          <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:esDevSinDebito?t.green:t.red}}>{fmtMoney(Math.abs(m.importe||0))}</Td>
                          <Td>{esDevSinDebito
                            ? <Bdg color={t.green}>✓ Reintegrado</Bdg>
                            : <Bdg color={t.red}>⚠ Sin reintegro</Bdg>}
                          </Td>
                          <Td>
                            {!esDevSinDebito
                              ? <input
                                  value={nota}
                                  onChange={e=>guardarNotaEquipo(serial, e.target.value)}
                                  placeholder="Agregar anotación..."
                                  style={{width:"100%",padding:"3px 7px",borderRadius:6,border:`1px solid ${nota?t.accent:t.border}`,background:nota?t.accentBg:t.surf,color:t.text,fontSize:11,outline:"none",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}
                                />
                              : <span style={{fontSize:11,color:t.muted,fontStyle:"italic"}}>Resuelto</span>
                            }
                          </Td>
                        </Tr>
                      );
                    })}
                    </Tbl>
                    {d.items.some(m=>!m._esDevSinDebito&&notasEquipos[m.serial||""])&&(
                      <div style={{marginTop:10,padding:"8px 12px",background:t.accentBg,borderRadius:8,border:`1px solid ${t.accent}33`,fontSize:11,color:t.sub}}>
                        💬 Las anotaciones se guardan localmente y desaparecen cuando se registra el crédito correspondiente.
                      </div>
                    )}
                  </div>
                : modalDetalle==="inactivos"
                ? (()=>{
                    const toggleSort = (col) => { if(sortInactivosCol===col) setSortInactivosDir(d=>d==="desc"?"asc":"desc"); else { setSortInactivosCol(col); setSortInactivosDir("desc"); } };
                    const rows = d.items.map(c=>{
                      const facs = facturas.filter(f=>f.clienteId===c.id&&f.tipo==="factura");
                      const ultima = facs.reduce((a,b)=>a.fecha>b.fecha?a:b,{fecha:null});
                      const tipo = facs.some(f=>f.items?.some(i=>i.codigo==="044"||i.codigo==="CV"||i.nombre==="Carga Virtual SEAC")) ? "CV" : "CIG";
                      return {...c, _tipo:tipo, _ult:ultima.fecha};
                    }).sort((a,b)=>{
                      const dir = sortInactivosDir==="desc"?-1:1;
                      if(sortInactivosCol==="nombre") return dir*a.nombre.localeCompare(b.nombre);
                      if(sortInactivosCol==="tipo") return dir*a._tipo.localeCompare(b._tipo);
                      return 0;
                    });
                    const thStyle = (col) => ({cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",padding:"8px 12px",textAlign:"left",fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",color:sortInactivosCol===col?t.accent:t.sub,background:t.surf2});
                    const arrow = (col) => sortInactivosCol===col ? (sortInactivosDir==="desc"?" ↓":" ↑") : " ↕";
                    return <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                      <thead><tr>
                        <th style={thStyle("nombre")} onClick={()=>toggleSort("nombre")}>Cliente{arrow("nombre")}</th>
                        <th style={thStyle("tipo")} onClick={()=>toggleSort("tipo")}>Tipo{arrow("tipo")}</th>
                        <th style={{...thStyle("ult"),cursor:"default"}}>Última compra</th>
                        <th style={{...thStyle("estado"),cursor:"default"}}>Estado</th>
                      </tr></thead>
                      <tbody>{rows.map(c=>(
                        <Tr key={c.id}>
                          <Td><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar nombre={c.nombre}/><span style={{fontWeight:600}}>{c.nombre}</span></div></Td>
                          <Td><Bdg color={c._tipo==="CV"?t.accent:t.purple}>{c._tipo}</Bdg></Td>
                          <Td style={{fontSize:12,color:t.sub}}>{c._ult?fmtFechaCC(c._ult):"Sin compras"}</Td>
                          <Td><Bdg color={t.amber}>Inactivo</Bdg></Td>
                        </Tr>
                      ))}</tbody>
                    </table>;
                  })()
                : modalDetalle!=="ganancia_dia" ? <>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 4px 10px",background:t.surf,borderBottom:`1px solid ${t.border}`,marginBottom:8}}>
                      <span style={{fontSize:13,color:t.sub,fontWeight:600}}>Total {modalDetalle==="vencidas"?"adeudado":"por vencer"}: <span style={{color:d.color,fontWeight:800}}>{fmtMoney(d.items.reduce((s,f)=>s+f.total,0))}</span></span>
                      {modalDetalle==="vencidas"&&facVencidas.length>0&&<button onClick={()=>{
                        const ids = [...alertasDescartadas, ...facVencidas.map(f=>f.id)];
                        setAlertasDescartadas(ids);
                        try { localStorage.setItem("gp_alertas_descartadas", JSON.stringify(ids)); } catch {};
                      }} style={{fontSize:12,padding:"5px 14px",borderRadius:6,border:`1px solid ${t.border}`,background:t.surf2,color:t.muted,cursor:"pointer",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>Descartar todas</button>}
                    </div>
                    <Tbl stickyTop={false} headers={["Comprobante","Cliente","Total","Vencimiento","Días",""]}>
                      {d.items.sort((a,b)=>fechaVto(a).localeCompare(fechaVto(b))).map((f, i)=>{
                        const cl = clientes.find(c=>c.id===f.clienteId);
                        const vto = fechaVto(f);
                        const dias = diasDiff(vto);
                        return <Tr key={`${f.id}_${i}`}>
                          <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:600,color:d.color}}>{f.numero}</Td>
                          <Td><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar nombre={cl?.nombre||"?"}/><span style={{fontWeight:600}}>{cl?.nombre||"—"}</span></div></Td>
                          <Td style={{fontWeight:700,color:d.color}}>{fmtMoney(f.total)}</Td>
                          <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,color:t.sub}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <span>{fmtFechaCC(vto)}</span>
                              {modalDetalle==="por_vencer"&&<input type="date" defaultValue={f.fechaVtoManual||""} title="Postergar vencimiento"
                                onChange={e=>{
                                  const nuevaFecha = e.target.value;
                                  setFacturas(prev=>prev.map(x=>x.id===f.id?{...x,fechaVtoManual:nuevaFecha||null}:x));
                                }}
                                style={{fontSize:10,padding:"2px 4px",borderRadius:4,border:`1px solid ${t.border}`,background:t.surf2,color:t.accent,width:110,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}/>}
                            </div>
                          </Td>
                          <Td><Bdg color={dias<0?t.red:t.amber}>{dias<0?`${Math.abs(dias)}d vencida`:`${dias}d`}</Bdg></Td>
                          <Td>{modalDetalle==="vencidas"&&<button onClick={()=>{
                            const ids = [...alertasDescartadas, f.id];
                            setAlertasDescartadas(ids);
                            try { localStorage.setItem("gp_alertas_descartadas", JSON.stringify(ids)); } catch {}
                          }} style={{background:"none",border:"none",cursor:"pointer",color:t.muted,fontSize:11,padding:"4px 6px",borderRadius:6,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>✕</button>}</Td>
                        </Tr>;
                      })}
                    </Tbl>
                  </> : null
            }
            {/* Modal ganancia del día */}
            {modalDetalle==="ganancia_dia"&&<>
                    <Tbl stickyTop={false} headers={["Comprobante","Cliente","Facturado","Ganancia est."]}>
                      {d.items.map((f, i)=>{
                        const cl = clientes.find(c=>c.id===f.clienteId);
                        const signo = f.tipo==="nc"?-1:1;
                        let ganFac = 0;
                        if(f.items?.length) {
                          f.items.forEach(it=>{
                            const art = articulos.find(a=>a.id===it.artId||a.codigo===it.codigo||a.nombre===it.nombre);
                            const esCV = art?.llevaStock === false || it.codigo === "044" || it.codigo === "CV" || it.nombre === "SALDO CV" || it.nombre === "Carga Virtual SEAC";
                            if (esCV) return;
                            const costo = parseFloat(it.costoUnit) || parseFloat(it.costo) || art?.costo || 0;
                            const cant = parseFloat(it.cantidad)||0;
                            const precio = (parseFloat(it.precio)||0) * (1 - (parseFloat(it.bonif)||0)/100);
                            ganFac += signo*(precio-costo)*cant;
                          });
                        }
                        return <Tr key={`${f.id}_${i}`}>
                          <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontSize:12,fontWeight:600,color:t.teal}}>{f.numero}</Td>
                          <Td><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar nombre={cl?.nombre||"?"}/><span style={{fontWeight:600}}>{cl?.nombre||"—"}</span></div></Td>
                          <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontWeight:700,color:t.text}}>{fmtMoney(f.total)}</Td>
                          <Td style={{fontFamily:"'Consolas','Courier New',monospace",fontWeight:800,color:ganFac>=0?t.green:t.red}}>{fmtMoney(ganFac)}</Td>
                        </Tr>;
                      })}
                    </Tbl>
                    <div style={{marginTop:14,padding:"12px 14px",background:t.teal+"12",borderRadius:10,border:`1px solid ${t.teal}33`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,color:t.sub}}>Ganancia neta estimada del día</span>
                      <span style={{fontSize:18,fontWeight:800,color:t.teal}}>{fmtMoney(gananciaDia)}</span>
                    </div>
                    <div style={{marginTop:8,fontSize:11,color:t.muted,textAlign:"center"}}>
                      Calculado como (precio − costo) × cantidad por artículo.
                    </div>
            </>}
          </OverlaySheet>
        );
      })()}
      </>
      )}

      {/* ── ALERTS REMOVIDAS ── */}
    </PageContainer>
  );
}

// ─── PAGOS DEL DÍA ────────────────────────────────────────────────────────────
