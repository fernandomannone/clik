import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { Modal, Fld, Inp, Sel, Btn, Ic, Bdg, InpMoney, OverlaySheet } from '../../common/UIBase';
import { fmtMoney, fmtFechaCC, getToday, parseMoney } from '../../../lib/utils';
import { exportarAExcel } from '../../../lib/excelExport';
import { read, utils } from "xlsx";
import { BuscadorCliente } from '../Clientes/BuscadorCliente';
import { getBotOperations } from '../../../services/botService';
import { BotOperacion } from '../../../types/botTypes';
import { norm, quitarPref, findConciliationCandidates, parseExtractoData, parsePatagonia, parseSanJuan, calcularTotalesDiaConcil } from '../../../lib/caja/cajaLogic';

const today = getToday();

function FilaMovimiento({ m, reg, actualizarMov, clientes, pagos, t, cuenta }: any) {
  const upd = (campos) => actualizarMov(reg.id, m.id, campos);
  const colorEstado = m.estado==="conciliado"?t.green:m.estado==="ambiguo"?t.amber:t.muted;

  return (
    <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 14px",borderBottom:`1px solid ${t.border}22`,background:m.estado==="conciliado"?t.green+"06":m.estado==="ambiguo"?t.amber+"06":""}}>
      {/* Monto + depositante */}
      <div style={{minWidth:120, position: 'relative'}}>
        <div style={{fontWeight:800,color:t.accent,fontFamily:"'Consolas','Courier New',monospace",fontSize:13}}>{fmtMoney(m.monto)}</div>
        <div style={{fontSize:11,fontWeight:600,color:t.text,marginTop:1}}>{m.nombreBanco||"—"}</div>
        <div style={{fontSize:10,color:t.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{m.ref||m.concepto}</div>
        
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {m.esManual&&<div style={{fontSize:9,color:t.accent,fontWeight:600}}>MANUAL</div>}
          {(m.esBuzon||m.esTas)&&<div style={{fontSize:9,color:t.amber,fontWeight:600}}>{m.esBuzon?"BUZÓN":"TAS"}</div>}
          {m.botMatch && (
            <div title="Validado por Optimus (Bot)" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: t.green, fontWeight: 800, background: t.green + '15', padding: '1px 5px', borderRadius: 4 }}>
              <Ic n="whatsapp" s={10} /> OPTIMUS
            </div>
          )}
        </div>
      </div>

      {/* Asignación */}
      <div style={{flex:1}}>
        {m.estado==="conciliado"&&<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <Bdg color={t.green}>✅ {m.clienteMatch||m.clienteAsig}</Bdg>
          {m.fechaConcil&&<span style={{fontSize:10,color:t.muted}}>{fmtFechaCC(m.fechaConcil)}</span>}
          <button onClick={()=>upd({estado:"pendiente",clienteAsig:m.clienteMatch||m.clienteAsig||"",reciboId:null,clienteMatch:null})} style={{fontSize:10,color:t.muted,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>✎ editar</button>
        </div>}

        {m.estado==="ambiguo"&&<div>
          <div style={{fontSize:10,color:t.amber,fontWeight:600,marginBottom:4}}>⚠ Múltiples coincidencias</div>
          <select value={m.reciboId||""} onChange={e=>{const rid=parseInt(e.target.value)||null;const p=pagos.find(x=>x.id===rid);upd({estado:rid?"conciliado":"ambiguo",reciboId:rid,clienteMatch:p?.cliente||null,fechaConcil:p?.fecha||""});}}
            style={{fontSize:11,padding:"3px 6px",borderRadius:6,border:`1px solid ${t.amber}`,background:t.surf,color:t.text,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>
            <option value="">— Seleccioná —</option>
            {(m.candidatos||[]).map(c=><option key={c.id} value={c.id}>{c.nombre} · {fmtMoney(c.monto)} · {c.fecha}</option>)}
          </select>
        </div>}

        {m.estado==="pendiente"&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{minWidth:220}}>
            <BuscadorCliente
              clientes={clientes.filter(c=>c.estado!=="archivado")}
              valor={clientes.find(c=>c.nombre===m.clienteAsig)?.id||null}
              onChange={id=>{
                const cli=clientes.find(c=>c.id===id);
                // Fecha por defecto: fecha del depósito en el extracto
                const fechaAuto = m.fecha || reg.fechaExtracto || today;
                upd({clienteAsig:cli?.nombre||"", estado:cli?"pendiente":"pendiente", fechaConcil:cli?fechaAuto:""});
              }}
              t={t}
              placeholder="Asignar cliente..."
            />
          </div>
          {m.clienteAsig&&<>
            <input type="date" value={m.fechaConcil||""} onChange={e=>upd({fechaConcil:e.target.value,estado:m.clienteAsig&&e.target.value?"conciliado":"pendiente"})}
              style={{fontSize:11,padding:"3px 6px",borderRadius:6,border:`1px solid ${m.fechaConcil?t.border:t.amber}`,background:t.surf,color:t.text,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}/>
            {!m.fechaConcil&&<span style={{fontSize:10,color:t.amber}}>← verificar fecha</span>}
            {m.fechaConcil&&<button onClick={()=>upd({estado:"conciliado"})} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:`1px solid ${t.green}44`,background:t.greenBg,color:t.green,cursor:"pointer",fontWeight:600,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>✓ Confirmar</button>}
          </>}
        </div>}
      </div>
    </div>
  );
}

export default function ModalConciliacion({ cuenta, onClose, pagos, clientes, movimientos=[], t, conceptos=[], setMovimientos }: any) {
  const [historial, setHistorial] = React.useState(() => {
    try { 
      const raw = localStorage.getItem(`gp_concil_${cuenta.id}`);
      const r = raw ? JSON.parse(raw) : []; 
      return Array.isArray(r) ? r : []; 
    } catch { return []; }
  });
  const [vista, setVista] = React.useState("importar"); // "importar" | "historial" | "extracto" | "sin_identificar"
  const [registroActual, setRegistroActual] = React.useState(null);
  const [diaAbierto, setDiaAbierto] = React.useState(null);
  const [botOps, setBotOps] = React.useState<BotOperacion[]>([]);
  const [procesando, setProcesando] = React.useState(false);
  const [error, setError] = React.useState("");
  const [modalManual, setModalManual] = React.useState(false);
  const [formManual, setFormManual] = React.useState({fecha:today, nombreBanco:"", monto:"", clienteAsig:"", obs:""});
  const [busqConcil, setBusqConcil] = React.useState("");
  const [confirmarRev, setConfirmarRev] = React.useState<any>(null);
  const [diasCorteSinIdent, setDiasCorteSinIdent] = React.useState(30);

  const { user, cloudSync } = useApp();
  const esMaestro = user?.rol === "maestro";

  React.useEffect(() => {
    getBotOperations().then(setBotOps);
  }, []);

  const movsSinIdentificar = React.useMemo(() => {
    const list: any[] = [];
    historial.forEach((h: any) => {
      (h.movimientos || []).forEach((m: any) => {
        if (m.estado === "pendiente" && !m.incorporado) {
          list.push({ ...m, regId: h.id, banco: h.banco });
        }
      });
    });
    return list.sort((a,b) => a.fecha.localeCompare(b.fecha));
  }, [historial]);

  const incorporarAlSaldo = (m: any) => {
    if (!esMaestro) return;
    const concCap = conceptos?.find((c: any) => c.nombre.toLowerCase().includes("capital") || c.nombre.toLowerCase().includes("varios"))?.id || 1;
    const nuevoMov = {
      id: `incorp_${m.id}_${Date.now()}`,
      cuentaId: cuenta.id,
      concepto: `Depósito sin identificar incorp. — ${m.nombreBanco}`,
      conceptoId: concCap,
      tipo: "ingreso",
      monto: m.monto,
      fecha: today,
      hora: "",
      obs: `Incorporación manual de depósito huérfano del ${fmtFechaCC(m.fecha)} — Ref: ${m.ref || ""}`,
      _esImputacion: false,
    };

    if (setMovimientos) setMovimientos((prev: any) => [...prev, nuevoMov]);
    if (cloudSync?.saveToCloud) cloudSync.saveToCloud("movimientos", nuevoMov, nuevoMov.id);

    // Marcar como incorporado en el historial para que desaparezca de la lista
    actualizarMov(m.regId, m.id, { incorporado: true, estado: "conciliado", clienteAsig: "INCORPORADO AL SALDO", fechaConcil: today });
    alert(`✓ Depósito de ${fmtMoney(m.monto)} incorporado al saldo como ingreso de capital.`);
  };

  const getAntiguedadColor = (fecha: string) => {
    if (!fecha) return t.sub;
    const diff = Math.round((new Date(today+"T00:00:00").getTime()-new Date(fecha+"T00:00:00").getTime())/(1000*60*60*24));
    if (diff > 30) return t.red;
    if (diff > 7) return t.amber;
    return t.muted;
  };

  const MAX_HISTORIAL = 100;
  const guardarHistorial = (nuevo) => {
    const actualizado = [nuevo, ...historial.filter(h=>h.id!==nuevo.id)].slice(0,MAX_HISTORIAL);
    setHistorial(actualizado);
    try { localStorage.setItem(`gp_concil_${cuenta.id}`, JSON.stringify(actualizado)); } catch {}
  };

  const parsearExtracto = async (file) => {
    setProcesando(true); setError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = read(buf, {type:"array"});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = utils.sheet_to_json(ws, {header:1, defval:""});
      const { esPatagonia, esSanJuan } = parseExtractoData(raw);
      let movsResult: any = { movs: [], gastosBancarios: [] };

      if(esPatagonia) {
        movsResult = parsePatagonia(raw);
      } else if(esSanJuan) {
        movsResult = parseSanJuan(raw);
      } else {
        setError("No se reconoció el formato."); setProcesando(false); return;
      }

      const { movs, gastosBancarios } = movsResult;

      if(!movs.length){ setError("No se encontraron créditos en el archivo."); setProcesando(false); return; }

      const hashNuevo = movs.map(m=>m.fecha+m.monto+m.nombreBanco).sort().join("|");
      const duplicado = historial.find(h=>h.hash===hashNuevo);
      if(duplicado){ setError(`⚠️ Este extracto ya fue importado el ${duplicado.fechaImport}.`); setProcesando(false); return; }

      // Match automático
      const recibos = pagos.filter(p=>!p.anulado&&p.cuentaId===cuenta.id);
      
      const resultado = movs.map(mov => {
        const refBanco = norm(mov.ref);

        // 1. Prioridad: Match por Optimus (Referencia Bancaria exacta)
        const matchBot = botOps.find(op => 
          op.id_bancario && 
          (norm(op.id_bancario) === refBanco || refBanco.includes(norm(op.id_bancario))) &&
          Math.abs(op.monto - mov.monto) < 1
        );

        if (matchBot) {
          return {
            ...mov, 
            estado: "conciliado", 
            botMatch: true,
            reciboId: matchBot.recibo_id || null, 
            clienteMatch: matchBot.cliente_nombre, 
            fechaConcil: matchBot.fecha.split('T')[0]
          };
        }

        // 2. Match estándar por nombre de cliente/alias
        const candidatos = findConciliationCandidates(mov, recibos, clientes);
        if(candidatos.length===1) return {...mov, estado:"conciliado", reciboId:candidatos[0].id, clienteMatch:candidatos[0].cliente, fechaConcil:candidatos[0].fecha};
        if(candidatos.length>1)  return {...mov, estado:"ambiguo", candidatos:candidatos.map(p=>({id:p.id,nombre:p.cliente,monto:p.monto,fecha:p.fecha}))};
        return {...mov, estado:"pendiente", reciboId:null, clienteMatch:null, clienteAsig:"", fechaConcil:""};
      });

      const fechasExtracto = [...new Set(resultado.map(m=>m.fecha).filter(Boolean))].sort();
      const nuevo = { id:Date.now(), hash:hashNuevo, fechaImport:today, fechaExtracto:fechasExtracto[0]||today, fechasExtracto, archivo:file.name, banco:esPatagonia?"Patagonia":"San Juan", movimientos:resultado };
      guardarHistorial(nuevo);
      setRegistroActual(nuevo);
      setDiaAbierto(fechasExtracto[0]||null);
      setVista("extracto");

      // Registrar gastos bancarios automáticamente en Caja y Bancos
      if(gastosBancarios.length>0) {
        let conceptoGastoId = conceptos?.find((c: any) => c.nombre.toLowerCase().includes("bancario"))?.id || 
                              conceptos?.find((c: any) => c.nombre.toLowerCase().includes("gasto"))?.id || 8;
        let conceptoPrestamoId = conceptos?.find((c: any) => c.nombre.toLowerCase().includes("prestamo") || c.nombre.toLowerCase().includes("préstamo"))?.id || conceptoGastoId;

        const nuevosMovs = gastosBancarios.map((g: any, idx: number) => ({
          id: `gasto_auto_${nuevo.id}_${idx}`,
          cuentaId: cuenta.id,
          concepto: g.concepto,
          conceptoId: g.esPrestamo ? conceptoPrestamoId : conceptoGastoId,
          tipo: "egreso",
          monto: g.monto,
          fecha: g.fecha,
          hora: "",
          obs: `Importado automáticamente desde extracto — ${g.ref||g.concepto}`,
          grupoId: null,
          reciboId: null,
          pagoProvId: null,
          _esImputacion: false,
        }));
        if (setMovimientos) {
           setMovimientos((prev: any) => [...prev, ...nuevosMovs]);
        }
        // Notificar al usuario
        setTimeout(()=>alert(`✓ Se registraron ${nuevosMovs.length} egresos automáticos (gastos/préstamos) por ${fmtMoney(gastosBancarios.reduce((s: any,g: any)=>s+g.monto,0))} en la cuenta ${cuenta.nombre}.`), 500);
      }
    } catch(e) { setError("Error al procesar: "+e.message); }
    setProcesando(false);
  };

  const actualizarMov = (regId, movId, campos) => {
    const reg = regId===registroActual?.id ? registroActual : historial.find(h=>h.id===regId);
    if(!reg) return;
    const actualizado = {...reg, movimientos: reg.movimientos.map(m=>m.id===movId?{...m,...campos}:m)};
    guardarHistorial(actualizado);
    if(regId===registroActual?.id) setRegistroActual(actualizado);
    // Actualizar también en historial si estamos viendo uno histórico
    else {
      const h2 = historial.find(h=>h.id===regId);
      if(h2) {
        const nuevo = historial.map(h=>h.id===regId?actualizado:h);
        setHistorial(nuevo);
        try{localStorage.setItem(`gp_concil_${cuenta.id}`,JSON.stringify(nuevo));}catch{}
      }
    }
  };

  const exportarExcel = async (reg) => {
    const filas = [];
    filas.push([`Importado: ${reg.fechaImport} · ${reg.archivo}`]);
    filas.push([]);
    
    reg.movimientos.forEach(m=>{
      const est=m.estado==="conciliado"?"Conciliado":m.estado==="ambiguo"?"Ambiguo":"Pendiente";
      filas.push([m.fecha,m.nombreBanco,m.monto,est,m.clienteMatch||m.clienteAsig||"—",m.fechaConcil||"—",m.ref||m.concepto]);
    });

    exportarAExcel({
      titulo: `Conciliación — ${reg.banco} — ${cuenta.nombre}`,
      columnas: ["Fecha","Depositante","Monto","Estado","Cliente","Fecha concil.","Referencia"],
      filas: filas,
      fileName: `conciliacion_${reg.banco}_${reg.fechaImport}.xlsx`,
      sheetName: "Conciliacion"
    });
  };

  // ── Render de un extracto (vista por día) ──────────────────────────────────
  const VistaExtracto = ({reg}) => {
    if(!reg) return null;
    // Normalizar fechas — pueden venir en distintos formatos del localStorage
    const movsNorm = (reg.movimientos||[]).map(m => {
      let fecha = m.fecha||"";
      // Convertir DD/MM/YYYY → YYYY-MM-DD si es necesario
      if(/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) fecha = fecha.split("/").reverse().join("-");
      return {...m, fecha};
    });
    const dias = [...new Set(movsNorm.map(m=>m.fecha).filter(Boolean))].sort();
    const totalBanco = movsNorm.reduce((s,m)=>s+m.monto,0);
    const totalPend  = movsNorm.filter(m=>m.estado!=="conciliado").reduce((s,m)=>s+m.monto,0);
    const totalConc  = movsNorm.filter(m=>m.estado==="conciliado").reduce((s,m)=>s+m.monto,0);

    return <>
      {/* Header del extracto */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={()=>setVista("historial")} style={{background:"none",border:"none",cursor:"pointer",color:t.sub,fontSize:12,padding:"4px 8px",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>← Historial</button>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,color:t.text,fontSize:13}}>{reg.banco} · {reg.fechaExtracto}{reg.fechasExtracto?.length>1?` al ${reg.fechasExtracto[reg.fechasExtracto.length-1]}`:""}</div>
          <div style={{fontSize:11,color:t.muted}}>Importado: {reg.fechaImport} · {reg.archivo}</div>
        </div>
        <Btn v="ghost" onClick={()=>exportarExcel(reg)} style={{padding:"5px 10px",fontSize:11}} title="Exportar"><Ic n="transfer" s={12}/></Btn>
        <Btn v="ghost" onClick={()=>setModalManual(true)} style={{padding:"5px 10px",fontSize:11}}>+ Manual</Btn>
      </div>

      {/* Resumen global */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[
          {label:"Total banco", val:fmtMoney(totalBanco), color:t.accent},
          {label:"Conciliados", val:fmtMoney(totalConc),  color:t.green},
          {label:"Pendientes",  val:fmtMoney(totalPend),  color:totalPend>0?t.amber:t.green},
        ].map((k,i)=>(
          <div key={i} style={{padding:"8px 12px",background:t.surf2,borderRadius:8,border:`1px solid ${t.border}`}}>
            <div style={{fontSize:10,color:t.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px"}}>{k.label}</div>
            <div style={{fontSize:15,fontWeight:800,color:k.color,fontFamily:"'Consolas','Courier New',monospace"}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Lista de días */}
      {dias.length===0
        ? <div style={{textAlign:"center",padding:"24px",color:t.muted,fontSize:13}}>
            No se encontraron movimientos con fecha válida.<br/>
            <span style={{fontSize:11}}>Eliminá este extracto e importalo de nuevo.</span>
          </div>
        : (dias as string[]).map(dia=>{
        const { bancoDia, sistemaDia, diferenciaDia, movsDia, pendDia, concDia } = calcularTotalesDiaConcil(dia, movsNorm, pagos, movimientos, cuenta.id);
        const abierto = diaAbierto===dia;
        const todosConcil = pendDia.length===0;

        return <div key={dia} style={{marginBottom:8,border:`1px solid ${todosConcil?t.green+"44":diferenciaDia!==0?t.amber+"44":t.border}`,borderRadius:10,overflow:"hidden"}}>
          {/* Header del día — clickeable */}
          <div onClick={()=>setDiaAbierto(abierto?null:dia)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:todosConcil?t.green+"08":t.surf2,cursor:"pointer",userSelect:"none"}}>
            <div style={{flex:1}}>
              <span style={{fontWeight:700,color:t.text,fontSize:13}}>{fmtFechaCC(dia as string)}</span>
              <span style={{marginLeft:10,fontSize:11,color:t.muted}}>{movsDia.length} mov.</span>
              {pendDia.length>0&&<span style={{marginLeft:8,fontSize:11,fontWeight:600,color:t.amber}}>⚠ {pendDia.length} pendiente{pendDia.length>1?"s":""}</span>}
              {todosConcil&&<span style={{marginLeft:8,fontSize:11,fontWeight:600,color:t.green}}>✅ Conciliado</span>}
            </div>
            {/* Cuadre del día */}
            <div style={{display:"flex",gap:16,fontSize:11,alignItems:"center"}}>
              <div style={{textAlign:"right"}}>
                <div style={{color:t.muted,fontSize:10}}>Banco</div>
                <div style={{fontWeight:700,color:t.text,fontFamily:"'Consolas','Courier New',monospace"}}>{fmtMoney(bancoDia)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:t.muted,fontSize:10}}>Sistema</div>
                <div style={{fontWeight:700,color:t.text,fontFamily:"'Consolas','Courier New',monospace"}}>{fmtMoney(sistemaDia)}</div>
              </div>
              <div style={{textAlign:"right",minWidth:80}}>
                <div style={{color:t.muted,fontSize:10}}>Diferencia</div>
                <div style={{fontWeight:800,color:Math.abs(diferenciaDia)<1?t.green:t.amber,fontFamily:"'Consolas','Courier New',monospace"}}>{diferenciaDia>=0?"+":""}{fmtMoney(diferenciaDia)}</div>
              </div>
              <span style={{color:t.muted,fontSize:14}}>{abierto?"▲":"▼"}</span>
            </div>
          </div>

          {/* Detalle del día */}
          {abierto&&<div style={{padding:"0 0 8px 0"}}>
            {/* Movimientos pendientes */}
            {pendDia.length>0&&<>
              <div style={{padding:"8px 14px 4px",fontSize:10,fontWeight:700,color:t.amber,textTransform:"uppercase",letterSpacing:"0.5px"}}>Sin conciliar</div>
              {pendDia.filter(m=>!busqConcil||m.nombreBanco?.toLowerCase().includes(busqConcil.toLowerCase())).map(m=>(
                <FilaMovimiento key={m.id} m={m} reg={reg} actualizarMov={actualizarMov} clientes={clientes} pagos={pagos} t={t} cuenta={cuenta}/>
              ))}
            </>}
            {/* Movimientos conciliados */}
            {concDia.length>0&&<>
              <div style={{padding:"8px 14px 4px",fontSize:10,fontWeight:700,color:t.green,textTransform:"uppercase",letterSpacing:"0.5px"}}>Conciliados</div>
              {concDia.map(m=>(
                <FilaMovimiento key={m.id} m={m} reg={reg} actualizarMov={actualizarMov} clientes={clientes} pagos={pagos} t={t} cuenta={cuenta}/>
              ))}
            </>}
          </div>}
        </div>;
      })}
    </>;
  };

  return (
    <OverlaySheet open={true} onClose={onClose} title={`Conciliación — ${cuenta.nombre}`} width={900}>
      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16,borderBottom:`1px solid ${t.border}`,paddingBottom:8}}>
        {[
          {id:"importar", label:"Importar extracto"},
          {id:"historial", label:`Historial (${historial.length})`},
          {id:"sin_identificar", label:`Sin Identificar (${movsSinIdentificar.length})`},
        ].map(tab=>(
          <button key={tab.id} onClick={()=>setVista(tab.id)} style={{padding:"6px 14px",borderRadius:7,border:"none",background:vista===tab.id?t.accent:"none",color:vista===tab.id?"#fff":t.sub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>{tab.label}</button>
        ))}
        {vista==="extracto"&&registroActual&&<button style={{padding:"6px 14px",borderRadius:7,border:"none",background:t.accent,color:"#fff",fontSize:12,fontWeight:600,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>{registroActual.banco} · {registroActual.fechaExtracto}</button>}
      </div>

      {/* Buscador (solo en extracto) */}
      {vista==="extracto"&&<div style={{marginBottom:12,display:"flex",gap:8}}>
        <div style={{position:"relative",flex:1,maxWidth:320}}>
          <Ic n="search" s={14} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:t.muted,pointerEvents:"none"}}/>
          <input value={busqConcil} onChange={e=>setBusqConcil(e.target.value)} placeholder="Buscar depositante..." style={{width:"100%",paddingLeft:32,padding:"7px 12px 7px 32px",background:t.surf2,border:`1px solid ${busqConcil?t.accent:t.border}`,borderRadius:8,color:t.text,fontSize:12,outline:"none",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",boxSizing:"border-box"}}/>
        </div>
        {busqConcil&&<button onClick={()=>setBusqConcil("")} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,color:t.muted,fontSize:11,padding:"4px 8px",cursor:"pointer"}}>✕</button>}
      </div>}

      {/* Vista: Importar */}
      {vista==="importar"&&<>
        <label onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) parsearExtracto(f); }}
          onDragOver={(e) => e.preventDefault()}
          style={{ display: "block", border: `2px dashed ${t.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: t.surf2, marginBottom: 16 }}>
          <input id="inp_concil" type="file" accept=".xls,.xlsx" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) parsearExtracto(e.target.files[0]); }} />
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>{procesando ? "Procesando extracto..." : "Arrastrá la planilla aquí"}</div>
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 12 }}>o hacé click para seleccionarla</div>
          <div style={{ display: "inline-block", background: t.accentBg, border: `1px solid ${t.accent}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: t.accent, fontWeight: 600 }}>XLS/XLSX del Banco San Juan o Patagonia</div>
        </label>
        {error&&<div style={{padding:"10px 14px",background:t.redBg,border:`1px solid ${t.red}44`,borderRadius:8,fontSize:12,color:t.red,marginBottom:12}}>{error}</div>}
      </>}

      {/* Vista: Historial */}
      {vista==="historial"&&<div>
        {historial.length===0
          ? <div style={{textAlign:"center",padding:"32px 0",color:t.muted,fontSize:13}}>Sin extractos importados aún.</div>
          : <>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
              <Btn v="danger" onClick={()=>{setHistorial([]);try{localStorage.removeItem(`gp_concil_${cuenta.id}`);}catch{}}} style={{padding:"5px 12px",fontSize:11}}>🗑 Limpiar todo</Btn>
            </div>
            {historial.map(h=>{
              const c=h.movimientos.filter(m=>m.estado==="conciliado").length;
              const p=h.movimientos.filter(m=>m.estado!=="conciliado").length;
              return (
                <div key={h.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 14px", borderRadius: 10, border: `1px solid ${p > 0 ? t.amber + "44" : t.green + "44"}`, marginBottom: 8, background: t.surf2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: t.text }}>{h.banco} · {h.fechaExtracto}{h.fechasExtracto?.length > 1 ? ` al ${h.fechasExtracto[h.fechasExtracto.length - 1]}` : ""}</div>
                      <div style={{ fontSize: 11, color: t.muted }}>Importado: {h.fechaImport} · {h.archivo}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <Bdg color={t.green}>✅ {c} concil.</Bdg>
                        {p > 0 && <Bdg color={t.amber}>⚠ {p} pendientes</Bdg>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn v="ghost" onClick={() => { setRegistroActual(h); setDiaAbierto(h.fechasExtracto?.[0] || null); setVista("extracto"); }} style={{ padding: "5px 10px", fontSize: 11 }}>Ver/resolver</Btn>
                      <Btn v="ghost" onClick={() => exportarExcel(h)} style={{ padding: "5px 10px", fontSize: 11 }} title="Exportar"><Ic n="transfer" s={11} /></Btn>
                      <Btn v="danger-ghost" onClick={() => setConfirmarRev(h)} style={{ padding: "5px 8px", fontSize: 11 }} title="Reversar / Eliminar"><Ic n="trash" s={11} /></Btn>
                    </div>
                  </div>
                  {confirmarRev?.id === h.id && (
                    <div style={{ background: t.redBg, border: `1px solid ${t.red}55`, padding: "12px 16px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", animation: "fadeIn 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Ic n="alert-triangle" s={18} style={{ color: t.red }} />
                        <div style={{ fontSize: 13, color: t.text }}>
                          <strong>¿Revertir importación?</strong> Se eliminará este extracto y todos sus movimientos.
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn v="outline" onClick={() => setConfirmarRev(null)} style={{ fontSize: 12 }}>Cancelar</Btn>
                        <Btn v="danger" onClick={() => {
                          const n = historial.filter(x => x.id !== h.id);
                          setHistorial(n);
                          try { localStorage.setItem(`gp_concil_${cuenta.id}`, JSON.stringify(n)); } catch {}
                          setConfirmarRev(null);
                        }} style={{ fontSize: 12 }}>Sí, revertir</Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        }
      </div>}

      {/* Vista: Sin Identificar */}
      {vista==="sin_identificar"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,padding:"10px 14px",background:t.surf2,borderRadius:10,border:`1px solid ${t.border}`}}>
          <div style={{fontSize:13,color:t.sub}}>Mostrando depósitos pendientes de más de 
            <select value={diasCorteSinIdent} onChange={e=>setDiasCorteSinIdent(parseInt(e.target.value))} style={{margin:"0 6px",padding:"2px 6px",borderRadius:4,border:`1px solid ${t.border}`,background:t.surf,color:t.text}}>
              <option value={0}>0</option>
              <option value={7}>7</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select> días.
          </div>
          <div style={{fontSize:11,color:t.muted}}>Total: {fmtMoney(movsSinIdentificar.filter(m=>{
            const diff = Math.round((new Date(today+"T00:00:00").getTime()-new Date(m.fecha+"T00:00:00").getTime())/(1000*60*60*24));
            return diff >= diasCorteSinIdent;
          }).reduce((s,m)=>s+m.monto,0))}</div>
        </div>

        {movsSinIdentificar.filter(m=>{
          const diff = Math.round((new Date(today+"T00:00:00").getTime()-new Date(m.fecha+"T00:00:00").getTime())/(1000*60*60*24));
          return diff >= diasCorteSinIdent;
        }).length === 0 ? (
          <div style={{textAlign:"center",padding:"48px 0",color:t.muted,fontSize:14}}>No hay depósitos pendientes con esa antigüedad.</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {movsSinIdentificar.filter(m=>{
              const diff = Math.round((new Date(today+"T00:00:00").getTime()-new Date(m.fecha+"T00:00:00").getTime())/(1000*60*60*24));
              return diff >= diasCorteSinIdent;
            }).map((m, i) => {
              const diff = Math.round((new Date(today+"T00:00:00").getTime()-new Date(m.fecha+"T00:00:00").getTime())/(1000*60*60*24));
              const color = getAntiguedadColor(m.fecha);
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:16,padding:"10px 16px",background:t.surf2,borderRadius:10,border:`1px solid ${diff > 30 ? t.red + "33" : t.border}`}}>
                  <div style={{minWidth:80,textAlign:"center"}}>
                    <div style={{fontSize:12,fontWeight:700,color:t.text}}>{fmtFechaCC(m.fecha)}</div>
                    <div style={{fontSize:10,fontWeight:700,color:color}}>{diff} DÍAS</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontWeight:800,color:t.accent,fontSize:14}}>{fmtMoney(m.monto)}</span>
                      <Bdg color={t.surf3}>{m.banco}</Bdg>
                    </div>
                    <div style={{fontSize:11,color:t.text,fontWeight:600,marginTop:2}}>{m.nombreBanco}</div>
                    <div style={{fontSize:10,color:t.muted}}>{m.ref || m.concepto}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn v="ghost" onClick={()=>{setRegistroActual(historial.find(h=>h.id===m.regId));setDiaAbierto(m.fecha);setVista("extracto");}} style={{padding:"5px 10px",fontSize:11}}>Ver extracto</Btn>
                    {esMaestro && (
                      <Btn v="outline" onClick={()=>incorporarAlSaldo(m)} style={{padding:"5px 10px",fontSize:11,color:t.green,borderColor:t.green+"44"}}>Incorporar saldo</Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* Vista: Extracto por día */}
      {vista==="extracto"&&registroActual&&<VistaExtracto reg={registroActual}/>}

      {/* Modal depósito manual */}
      {modalManual&&<OverlaySheet open={true} onClose={()=>setModalManual(false)} title="Agregar depósito manual" width={440}>
        <div style={{padding:"10px 14px",background:t.amberBg,border:`1px solid ${t.amber}33`,borderRadius:8,fontSize:12,color:t.amber,marginBottom:14}}>
          Para depósitos trabados o acreditados con fecha retroactiva.
        </div>
        <div style={{display:"flex",gap:12}}>
          <Fld label="Fecha" half><Inp type="date" value={formManual.fecha} onChange={e=>setFormManual({...formManual,fecha:e.target.value})}/></Fld>
          <Fld label="Monto ($)" half><InpMoney value={formManual.monto} onChange={e=>setFormManual({...formManual,monto:e.target.value})}/></Fld>
        </div>
        <Fld label="Nombre depositante"><Inp value={formManual.nombreBanco} onChange={e=>setFormManual({...formManual,nombreBanco:e.target.value})} placeholder="Ej: GARCIA JUAN CARLOS"/></Fld>
        <Fld label="Asignar a cliente">
          <BuscadorCliente clientes={clientes}
            valor={formManual.clienteAsig ? (clientes.find(c=>c.nombre===formManual.clienteAsig)?.id||null) : null}
            onChange={id=>{const c=clientes.find(x=>x.id===id); setFormManual({...formManual,clienteAsig:c?.nombre||"",fecha:c?today:formManual.fecha});}}
            t={t} placeholder="— Sin asignar por ahora —"/>
        </Fld>
        <Fld label="Observación"><Inp value={formManual.obs} onChange={e=>setFormManual({...formManual,obs:e.target.value})} placeholder="Ej: Depósito trabado — reclamo 13/03"/></Fld>
        <div style={{display:"flex",gap:10,marginTop:6}}>
          <Btn v="ghost" onClick={()=>setModalManual(false)} full>Cancelar</Btn>
          <Btn disabled={!formManual.monto||!formManual.fecha} onClick={()=>{
            const monto=parseMoney(formManual.monto);
            if(!monto) return;
            const nuevo={id:`manual_${Date.now()}`,fecha:formManual.fecha,concepto:formManual.obs||"Depósito manual",ref:"MANUAL",nombreBanco:formManual.nombreBanco||"Sin nombre",monto,tipo:"credito",esBuzon:false,esTas:false,esManual:true,estado:formManual.clienteAsig?"conciliado":"pendiente",clienteAsig:formManual.clienteAsig,clienteMatch:formManual.clienteAsig||null,fechaConcil:formManual.clienteAsig?today:""};
            const actualizado={...registroActual,movimientos:[...registroActual.movimientos,nuevo]};
            setRegistroActual(actualizado);
            guardarHistorial(actualizado);
            setFormManual({fecha:today,nombreBanco:"",monto:"",clienteAsig:"",obs:""});
            setModalManual(false);
          }} full><Ic n="plus" s={14}/>Agregar depósito</Btn>
        </div>
      </OverlaySheet>}
    </OverlaySheet>
  );
}
