import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Ic, Card, KPI, Bdg, Btn, Tbl, Tr, Td, Inp, InpMoney, Sel, Fld, Modal, PgHdr, Avatar, BtnEliminarConClave, OverlaySheet } from "../../common/UIBase";
import { fmtMoney, normalizar, fmtNum } from "../../../lib/utils";
import { THEMES } from "../../../constants";
import { PageContainer } from "../../layout/AppShell";
import { exportarAExcel } from "../../../lib/excelExport";
import { limpiarMovimientosHuerfanos, recalcularSaldosCuentas, limpiarHuellasFirestore } from "../../../lib/maintenance";
import { procesarInyeccionHistoricos, resetSistemaLocal, clearAllLocalYCloud, ejecutarImplantacionGeneral } from "../../../lib/configuracion/configuracionLogic";
import initialData from "../../../initial_db_data.json";

import { WIDGET_META, WIDGETS_DEF } from "../Dashboard/Dashboard";
const CUENTAS_LABELS = { 1: "Caja", 2: "Banco San Juan", 3: "Banco Patagonia", 4: "Fondo FCI", 5: "Banco BBVA" };

function WidgetsVisiblesSelector({ form, setForm, t }) {
  const visibles = form.permisos?.widgetsVisibles || [];
  // [] = todos visibles (default para maestro), lista = solo esos
  const todos = WIDGETS_DEF;
  const toggleWidget = (id) => {
    const nuevos = visibles.includes(id) ? visibles.filter(x=>x!==id) : [...visibles, id];
    setForm({...form, permisos:{...form.permisos, widgetsVisibles:nuevos}});
  };
  const todosActivos = visibles.length === 0;
  return (
    <div style={{marginTop:10,padding:"12px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surf}}>
      <div style={{fontSize:11,fontWeight:700,color:t.sub,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:8}}>Widgets visibles en Dashboard</div>
      <div style={{fontSize:11,color:t.muted,marginBottom:10}}>Si no se selecciona ninguno, el usuario no ve el Dashboard. Seleccioná los que debe poder ver.</div>
      {todos.map((id)=>{
        const meta = WIDGET_META[id];
        if (!meta) return null;
        const sel = visibles.includes(id);
        return <div key={id} onClick={()=>toggleWidget(id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:7,marginBottom:4,border:`1px solid ${sel?t.accent+"44":t.border}`,background:sel?t.accentBg:"transparent",cursor:"pointer",transition:"all 0.15s"}}>
          <span style={{fontSize:13,color:sel?t.accent:t.sub,fontWeight:500}}>{meta.label}</span>
          <div style={{width:18,height:18,borderRadius:"50%",background:sel?t.accent:t.border,display:"flex",alignItems:"center",justifyContent:"center"}}>{sel&&<Ic n="check" s={10}/>}</div>
        </div>;
      })}
    </div>
  );
}

function CuentasVisiblesSelector({ form, setForm, t }) {
  const todas = Object.entries(CUENTAS_LABELS);
  const visibles = form.permisos?.cuentasVisibles || [];
  const toggleCuenta = (id) => {
    const nuevas = visibles.includes(id) ? visibles.filter(x=>x!==id) : [...visibles, id];
    setForm({...form, permisos:{...form.permisos, cuentasVisibles:nuevas}});
  };
  return (
    <div style={{marginTop:10,padding:"12px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surf}}>
      <div style={{fontSize:11,fontWeight:700,color:t.sub,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:8}}>Cuentas bancarias visibles</div>
      <div style={{fontSize:11,color:t.muted,marginBottom:10}}>Si no se selecciona ninguna, el usuario ve todas las cuentas a las que tiene acceso por Caja y Bancos.</div>
      {todas.map(([id,nombre])=>{
        const sel = visibles.includes(parseInt(id));
        return <div key={id} onClick={()=>toggleCuenta(parseInt(id))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:7,marginBottom:4,border:`1px solid ${sel?t.accent+"44":t.border}`,background:sel?t.accentBg:"transparent",cursor:"pointer",transition:"all 0.15s"}}>
          <span style={{fontSize:13,color:sel?t.accent:t.sub,fontWeight:500}}>{nombre}</span>
          <div style={{width:18,height:18,borderRadius:"50%",background:sel?t.accent:t.border,display:"flex",alignItems:"center",justifyContent:"center"}}>{sel&&<Ic n="check" s={10}/>}</div>
        </div>;
      })}
    </div>
  );
}

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

export default function Configuracion(props: any) {
  const { usuarios, setUsuarios, onUpdateUser, clientes, setClientes, proveedores, setProveedores, articulos, setArticulos, familias, setFamilias, facturas, setFacturas, factProv, setFactProv, pagos, setPagos, pagosProv, setPagosProv, cuentas, setCuentas, movimientos, setMovimientos, ajustesStock, setAjustesStock, conceptos, setConceptos, seacMovs=[], setSeacMovs=()=>{}, historialImport=[], setHistorialImport=()=>{}, historialCierres=[], seacImportaciones=[], setSeacImportaciones=()=>{}, recalcularSaldosCuentas=()=>{}, kardex=[], setKardex=()=>{} } = props;
  const { cloudSync, user } = props; // Received from App.tsx via props
  const { t, tema, setTema, saveBatchToCloud, isDark } = useApp();
  const esPrivilegiado = user?.rol === "maestro" || user?.rol === "administrador";
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
          const F0 = { nombre:"", usuario:"", password:"", rol:"usuario", permisos:{ caja:false, estadisticas:false, costos:false, editarCC:false, borrarClientes:false, agregarConceptos:false, anularPagos:false, ajustarStock:false, exportarReportes:false, planillasTrabajo:false, archivarClientes:false, editarPrecios:false, anularVentas:false, verHistorialCierres:false, borrarArticulos:false, cuentasVisibles:[], widgetsVisibles:[] } };
  const [form, setForm] = useState(F0);
  const [openUsers, setOpenUsers] = useState(false);
  const [openEmpresa, setOpenEmpresa] = useState(false);

  const [confirmRestaurar, setConfirmRestaurar] = useState(false);
  const [confirmInject, setConfirmInject] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [claveReset, setClaveReset] = useState("");
  const [msgBackup, setMsgBackup] = useState("");
  const [loadingInject, setLoadingInject] = useState(false);
  const [huskyLoading, setHuskyLoading] = useState(false);
  const [huskyResult, setHuskyResult] = useState<any>(null);
  const [importandoBackup, setImportandoBackup] = useState(false);
  const [limpiandoHuellas, setLimpiandoHuellas] = useState(false);
  const [limpiandoMsg, setLimpiandoMsg] = useState("");
  const [coleccionACompactar, setColeccionACompactar] = useState<string>("usuarios_clik");
  const [tab, setTab] = useState("reporte_saldos");
  const [reporteDiff, setReporteDiff] = useState<any>(null);
  const [reporteStock, setReporteStock] = useState<any>(null);

  const descargarTemplate = async (b64: string, filename: string, appendGuide = false) => {
    if (appendGuide && (cuentas || proveedores)) {
      try {
        const { read, utils, write } = await import("xlsx");
        const wb = read(b64, { type: "base64" });
        
        const wsData: any[][] = [
           ["Guía Dinámica para Columnas de Cobranzas y Pagos"],
           ["Al registrar cobranzas/pagos en la Planilla, coloque el ID o Alias de la cuenta de destino o proveedor como encabezado de columna."],
           ["Esta es la lista completa válida para su negocio:"],
           [],
           ["TIPO", "NOMBRE DEL REGISTRO", "ABREVIATURAS / ID (Válidos para usar como encabezado)"]
        ];
        
        cuentas?.forEach((c: any) => {
           let alias = c.aliasImportacion ? c.aliasImportacion : c.nombre;
           if (!c.aliasImportacion && (c.nombre === "CAJA" || c.nombre === "EFECTIVO")) alias = "CAJA, EFECTIVO";
           wsData.push(["Cuenta Propia / Tesorería", c.nombre, alias]);
        });
        
        wsData.push([]);
        
        proveedores?.forEach((p: any) => {
           const aliases = p.alias ? p.alias : (p.nombre === "RGP - SEAC" ? "RGP-SEAC, RGP SEAC, RGPSEAC" : p.nombre);
           wsData.push(["Proveedor", p.nombre, aliases]);
        });
        
        const ws = utils.aoa_to_sheet(wsData);
        ws["!cols"] = [{ wch: 25 }, { wch: 35 }, { wch: 60 }];
    
        utils.book_append_sheet(wb, ws, "Guia_Referencias");
        
        const out = write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return; // Success
      } catch (err) {
        console.error("Error generating dynamic guide sheet in excel", err);
      }
    }

    // Default Fallback
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    const blob = new Blob([arr],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generarTemplateIngresos = (conData: boolean = false) => {
    const b64 = "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";
    descargarTemplate(b64, "planilla_ingresos.xlsx");
  };

  const generarTemplateVentas = (conData: boolean = false) => {
    const b64 = "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";
    descargarTemplate(b64, "planilla_ventas.xlsx");
  };



  // ── Fix Precargas — limpiar seacMovs huérfanos ───────────────────────────
  const exportarListadoClientes = async () => {
    try {
      const filas = [];
      [...clientes].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")).forEach(c=>{
        const aliasCV = Array.isArray(c.nombreCV)?c.nombreCV.join(" | "):(c.nombreCV||"");
        const planilla = (c.nombresPlanilla||[]).join(" | ");
        filas.push([c.id, c.nombre, aliasCV, planilla, c.estado||"activo"]);
      });
      
      exportarAExcel({
        titulo: "Listado de Clientes (con ID)",
        columnas: ["ID","Nombre","Alias CV","Nombre Planilla","Estado"],
        filas: filas,
        fileName: "clientes_con_id.xlsx",
        sheetName: "Clientes"
      });
    } catch(e: any) {
      alert("Error al exportar clientes: " + e.message);
    }
  };

  const enriquecerClientesHusky = async () => {
    setHuskyLoading(true);
    setHuskyResult(null);
    try {
      const XLSX_lib = await import("xlsx");
      const XLSX: any = XLSX_lib;
      
      const res = await fetch("/listado_clientes.xlsx");
      if (!res.ok) throw new Error("No se encontró listado_clientes.xlsx en public");
      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      const wb = XLSX.read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[]);
      
      let headerRow = rows.findIndex((r: any) => {
        const strRow = (r as any[]).map(c => String(c).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).join("|");
        return (strRow.includes("razon social") || strRow.includes("nombre")) && (strRow.includes("cuit") || strRow.includes("provincia") || strRow.includes("domicilio") || strRow.includes("telefono") || strRow.includes("tel"));
      });
      if (headerRow === -1) headerRow = 0;

      const hdrs = (rows[headerRow] || []).map((h: any) => String(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
      
      const findIdx = (keywords: RegExp[]) => hdrs.findIndex((h: string) => keywords.some(k => k.test(h)));
      let iNom = findIdx([/razon/i, /nombre/i, /denominacion/i, /cliente/i]);
      let iDir = findIdx([/direccion/i, /domicilio/i]);
      let iLoc = findIdx([/localidad/i]);
      let iTel = findIdx([/telefono/i, /^tel/i, /celular/i]);
      let iProv = findIdx([/provincia/i]);
      let iCuit = findIdx([/cuit/i, /rfc/i, /rut/i, /doc/i, /dni/i]);
      let iMail = findIdx([/email/i, /mail/i, /correo/i]);

      const clientesDB = [...clientes];
      let operations = [];
      let updated = 0;
      let noEncontrados = 0;

      (rows as any[]).slice(headerRow + 1).forEach((row: any) => {
        const nombre = iNom !== -1 ? String(row[iNom] || "").trim() : "";
        if (!nombre) return;

        const nomLower = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cliente = clientesDB.find(c => c.nombre && c.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === nomLower);

        if (cliente) {
          const updates: any = {};
          if (iDir !== -1 && row[iDir]) updates.direccion = String(row[iDir]).trim();
          if (iLoc !== -1 && row[iLoc]) updates.localidad = String(row[iLoc]).trim();
          if (iProv !== -1 && row[iProv]) updates.provincia = String(row[iProv]).trim();
          if (iCuit !== -1 && row[iCuit]) updates.cuit = String(row[iCuit]).trim();
          if (iMail !== -1 && row[iMail]) updates.email = String(row[iMail]).trim();
          
          let tel = iTel !== -1 ? String(row[iTel] || "").trim() : "";
          if (tel) {
            updates.telefono = tel.split(" ")[0]; // just first phone
          }

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            const newData = { ...cliente, ...updates };
            operations.push({ type: "set", collection: "clientes", id: String(cliente.id), data: newData });
            updated++;
          }
        } else {
          noEncontrados++;
        }
      });

      if (updated > 0) {
        await cloudSync.executeCloudBatch(operations);
        setHuskyResult({ msg: `¡Éxito! Se actualizaron ${updated} clientes en la DB con información adicional.\nNo encontrados/Sin cambios: ${noEncontrados}`, type: "success" });
      } else {
        setHuskyResult({ msg: `No se encontraron clientes para actualizar o el archivo no contenía info nueva. (No encontrados: ${noEncontrados})`, type: "info" });
      }
    } catch(e: any) {
      setHuskyResult({ msg: "Error: " + e.message, type: "error" });
    } finally {
      setHuskyLoading(false);
    }
  };

  const exportarBackup = () => {
    const backup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: {
        clientes, proveedores, articulos, familias,
        facturas, factProv, pagos, pagosProv,
        cuentas, movimientos, ajustesStock, usuarios, conceptos,
        seacMovs, historialImport, seacImportaciones
      }
    };
    const json = JSON.stringify(backup, null, 2);
    const a = document.createElement("a");
    a.href = "data:application/json;charset=utf-8," + encodeURIComponent(json);
    const fecha = new Date().toISOString().slice(0,10);
    // Sugerencia de nombre para pb_data/backups si se guarda manualmente
    a.download = `backup_${fecha}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const importarBackup = async (file) => {
    setImportandoBackup(true); setMsgBackup("");
    try {
      const text = await file.text();
      const backup = (JSON.parse(text) as any);
      if(!backup.data) throw new Error("Archivo de backup inválido.");
      const d = backup.data;
      if(d.clientes)        setClientes(d.clientes);
      if(d.proveedores)     setProveedores(d.proveedores);
      if(d.articulos)       setArticulos(d.articulos);
      if(d.familias)        setFamilias(d.familias);
      if(d.facturas)        setFacturas(d.facturas);
      if(d.factProv)        setFactProv(d.factProv);
      if(d.pagos)           setPagos(d.pagos);
      if(d.pagosProv)       setPagosProv(d.pagosProv);
      if(d.cuentas)         setCuentas(d.cuentas);
      if(d.movimientos)     setMovimientos(d.movimientos);
      if(d.ajustesStock)    setAjustesStock(d.ajustesStock);
      if(d.usuarios)        setUsuarios(d.usuarios);
      if(d.conceptos)       setConceptos(d.conceptos);
      if(d.seacMovs)          setSeacMovs(d.seacMovs);
      if(d.historialImport)   setHistorialImport(d.historialImport);
      if(d.seacImportaciones) setSeacImportaciones(d.seacImportaciones);
      const fecha = new Date(backup.timestamp).toLocaleString("es-AR");
      setMsgBackup(`✓ Backup restaurado correctamente (generado el ${fecha})`);
    } catch(e) {
      setMsgBackup(`✗ Error: ${e.message}`);
    }
    setImportandoBackup(false);
  };

  const [expandido, setExpandido] = useState(null);
  const [confirmarElimUser, setConfirmarElimUser] = useState(null);
  const PERMISOS_MODULOS = {
    "General y Sistema": [
      ["exportarReportes","Exportar reportes (CSV/Excel)","transfer"],
      ["costos","Ver costos y márgenes","lock"],
      ["verHistorialCierres","Ver historial de cierres de caja","caja"],
    ],
    "Clientes y Ventas": [
      ["editarCC","Editar comprobantes en CC","edit"],
      ["borrarClientes","Borrar clientes","trash"],
      ["archivarClientes","Archivar/Desarchivar clientes","clientes"],
      ["anularVentas","Anular facturas y NC","trash"],
    ],
    "Proveedores": [
      ["anularPagos","Anular pagos y comprobantes","trash"],
    ],
    "Artículos e Inventario": [
      ["ajustarStock","Ajustar stock manualmente","caja"],
      ["editarPrecios","Modificar precios de artículos","edit"],
      ["borrarArticulos","Borrar artículos","trash"],
    ],
    "Caja y Bancos": [
      ["caja","Acceder a Caja y Bancos","stats"],
      ["agregarConceptos","Agregar conceptos de caja","config"],
      ["planillasTrabajo","Ver planillas de trabajo diario","transfer"],
    ],
    "Estadísticas": [
      ["estadisticas","Acceder a Estadísticas","stats"],
    ]
  };
  const PERMS_FLAT = Object.values(PERMISOS_MODULOS).flat();

  const [syncingUsers, setSyncingUsers] = useState(false);

  const [empresa, setEmpresa] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem("gp_empresa") as any) || "{}") || {};
    } catch {
      return {};
    }
  });

  const handleUpdateEmpresa = (k: string, v: string) => {
    const next = { ...empresa, [k]: v };
    setEmpresa(next);
    localStorage.setItem("gp_empresa", JSON.stringify(next));
  };

  const abrirEditar = (u) => { setForm({...u}); setEditando(u.id); setModal(true); };
  const guardar = () => {
    if(!form.nombre) { alert("Completa el nombre"); return; }
    if(!form.usuario) { alert("Completa el usuario (login)"); return; }
    if(!editando && !form.password) { alert("Completa la contraseña"); return; }
    // Validar login duplicado
    const duplicado = usuarios.find(u=>u.usuario===form.usuario && u.id!==editando);
    if(duplicado) { alert("El usuario (login) ya existe"); return; }
    
    const newUserObj = editando ? {...usuarios.find(u=>u.id===editando),...form} : {...form,id:Date.now()};
    const updated = editando ? usuarios.map(u=>u.id===editando?newUserObj:u) : [...usuarios,newUserObj];
    
    // Cloud Sync
    if (cloudSync?.saveToCloud) {
       cloudSync.saveToCloud("usuarios", newUserObj, String(newUserObj.id));
       // Also save to a predictable path for Firestore rules
       const safeUsername = newUserObj.usuario.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
       cloudSync.saveToCloud("roles", { rol: newUserObj.rol, permisos: newUserObj.permisos }, safeUsername);

       // Si es un usuario nuevo, registrarlo en Firebase Auth
       if (!editando && cloudSync.registerUserInAuth) {
         cloudSync.registerUserInAuth(newUserObj.usuario, newUserObj.password);
       }
    }
    
    setUsuarios(updated);
    if(editando && onUpdateUser) onUpdateUser(updated.find(u=>u.id===editando));
    setModal(false);
  };
  const togglePerm = (uid: number, perm: string) => {
    const updated = usuarios.map((u: any) => u.id === uid && u.rol !== "maestro" ? { ...u, permisos: { ...u.permisos, [perm]: !u.permisos[perm] } } : u);
    setUsuarios(updated);
    const updatedUser = updated.find((x: any) => x.id === uid);
    if (updatedUser) {
      if (cloudSync?.saveToCloud) {
        cloudSync.saveToCloud("usuarios", updatedUser, String(updatedUser.id));
        const safeUsername = updatedUser.usuario.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
        cloudSync.saveToCloud("roles", { rol: updatedUser.rol, permisos: updatedUser.permisos }, safeUsername);
      }
      if (onUpdateUser) onUpdateUser(updatedUser);
    }
  };

  const handleUpdateSpecificUser = (f: any) => {
    setUsuarios(usuarios.map((x: any) => x.id === f.id ? f : x));
    if (cloudSync?.saveToCloud) {
      cloudSync.saveToCloud("usuarios", f, String(f.id));
      const safeUsername = f.usuario.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
      cloudSync.saveToCloud("roles", { rol: f.rol, permisos: f.permisos }, safeUsername);
    }
    if (onUpdateUser) onUpdateUser(f);
  };

  const handleEliminarUsuario = (u: any) => {
    setUsuarios((prev: any[]) => prev.filter((x: any) => x.id !== u.id));
    if (cloudSync?.deleteFromCloud) cloudSync.deleteFromCloud("usuarios", String(u.id));
    setExpandido(null);
    setConfirmarElimUser(null);
  };

  return (
    <PageContainer 
      title="Ajustes" 
      sub={esPrivilegiado ? "Configuración del sistema y personalización" : "Personalización de la interfaz"}
      actions={esPrivilegiado && <Btn onClick={()=>{setForm(F0);setEditando(null);setModal(true);}}><Ic n="plus" s={14}/>Nuevo usuario</Btn>}
    >
      {esPrivilegiado && (
        <>
          <Card style={{ marginBottom:16 }}>
        <div onClick={() => setOpenUsers(!openUsers)} style={{ cursor: "pointer", fontSize:14, fontWeight:700, color:t.text, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}><Ic n="lock" s={15}/>Usuarios y Permisos</div>
          <div style={{ color: t.muted, fontSize: 12 }}>{openUsers ? "▲" : "▼"}</div>
        </div>
        
        {openUsers && <div style={{display:"flex",flexDirection:"column",gap:10, marginTop:16}}>
          {usuarios.map(u=>{
            const abierto = expandido===u.id;
            const esMaestro = u.rol==="maestro";
            const permCount = esMaestro ? PERMS_FLAT.length : PERMS_FLAT.filter(([p])=>u.permisos[p as string]).length;
            return (
              <div key={u.id} style={{border:`1px solid ${abierto?t.accent:t.border}`,borderRadius:12,overflow:"hidden",transition:"all 0.15s"}}>
                {/* Header del card */}
                <div onClick={()=>setExpandido(abierto?null:u.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",cursor:"pointer",background:abierto?t.accentBg:t.surf}}>
                  <Avatar nombre={u.nombre} color={esMaestro?t.accent:t.purple}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:t.text}}>{u.nombre}</div>
                    <div style={{fontSize:12,color:t.muted,fontFamily:"'Consolas','Courier New',monospace"}}>{u.usuario}</div>
                  </div>
                  <Bdg color={esMaestro?t.accent:t.purple}>{esMaestro?"🔑 Maestro":"👤 Usuario"}</Bdg>
                  <div style={{fontSize:11,color:t.sub,minWidth:80,textAlign:"right"}}>
                    {esMaestro?"Todos los permisos":`${permCount} de ${PERMS_FLAT.length} permisos`}
                  </div>
                  <span style={{color:t.muted,fontSize:12}}>{abierto?"▲":"▼"}</span>
                </div>
                {/* Permisos expandidos */}
                {abierto&&<div style={{padding:"14px 18px",background:t.surf2,borderTop:`1px solid ${t.border}`}}>
                  {Object.entries(PERMISOS_MODULOS).map(([modulo, permisos]) => (
                    <div key={modulo} style={{marginBottom: 20}}>
                      <div style={{fontSize: 11, fontWeight: 800, color: t.sub, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10, borderBottom: `1px solid ${t.border}44`, paddingBottom: 6}}>
                        {modulo}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
                        {permisos.map(([perm,label,icon])=>{
                          const activo = esMaestro || u.permisos[perm as string];
                          return (
                            <div key={perm as string} onClick={()=>!esMaestro&&togglePerm(u.id,perm as string)}
                              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:`1px solid ${activo?t.green+"44":t.border}`,background:activo?t.greenBg:t.surf,cursor:esMaestro?"default":"pointer",transition:"all 0.15s"}}>
                              <Ic n={icon as string} s={14}/>
                              <span style={{fontSize:12,flex:1,color:activo?t.green:t.sub,fontWeight:500}}>{label as React.ReactNode}</span>
                              <div style={{width:18,height:18,borderRadius:"50%",background:activo?t.green:t.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                {activo&&<Ic n="check" s={11}/>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {!esMaestro&&<WidgetsVisiblesSelector form={u} setForm={handleUpdateSpecificUser} t={t}/>}
                  {!esMaestro&&<CuentasVisiblesSelector form={u} setForm={handleUpdateSpecificUser} t={t}/>}
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:12,gap:8}}>
                    {u.usuario!=="admin"&&(confirmarElimUser===u.id
                      ? <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:12,color:t.red,fontWeight:600}}>¿Confirmar?</span>
                          <Btn v="danger" onClick={()=>handleEliminarUsuario(u)}><Ic n="trash" s={13}/>Sí, eliminar</Btn>
                          <Btn v="ghost" onClick={()=>setConfirmarElimUser(null)}>Cancelar</Btn>
                        </div>
                      : <Btn v="danger" onClick={()=>setConfirmarElimUser(u.id)}><Ic n="trash" s={13}/>Eliminar usuario</Btn>
                    )}
                    <Btn v="ghost" onClick={()=>abrirEditar(u)}><Ic n="edit" s={13}/>Editar datos</Btn>
                  </div>
                </div>}
              </div>
            );
          })}
        </div>}
      </Card>

      <OverlaySheet open={modal} onClose={()=>setModal(false)} title={editando?"Editar Usuario":"Nuevo Usuario"}>
        <Fld label="Nombre y Apellido"><Inp value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></Fld>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          <Fld label="Usuario (login)" half><Inp value={form.usuario} onChange={e=>setForm({...form,usuario:e.target.value})}/></Fld>
          <Fld label="Contraseña (PIN)" half><Inp type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Mín. 4 dígitos" /></Fld>
        </div>
        <Fld label="Rol">
          <Sel value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})}>
            <option value="usuario">👤 Usuario</option>
            <option value="maestro">🔑 Maestro</option>
            <option value="administrador">👑 Administrador</option>
            <option value="vendedor">🛒 Vendedor</option>
            <option value="cajero">💸 Cajero</option>
          </Sel>
        </Fld>
        <div style={{ fontSize:11, color:t.muted, marginBottom:12 }}>Los permisos se configuran desde el card del usuario.</div>
        <div style={{ display:"flex", gap:10 }}><Btn v="ghost" onClick={()=>setModal(false)} full>Cancelar</Btn><Btn onClick={guardar} full><Ic n="check" s={14}/>{editando?"Guardar":"Crear usuario"}</Btn></div>
      </OverlaySheet>

      {/* Datos de Empresa */}
      <Card style={{marginTop:16}}>
        <div onClick={() => setOpenEmpresa(!openEmpresa)} style={{ cursor: "pointer", fontSize:14, fontWeight:700, color:t.text, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}><Ic n="user" s={15}/>Datos de la Empresa</div>
          <div style={{ color: t.muted, fontSize: 12 }}>{openEmpresa ? "▲" : "▼"}</div>
        </div>
        {openEmpresa && <div style={{ marginTop: 16 }}>
        <div style={{fontSize:12,color:t.sub,lineHeight:1.6,marginBottom:14}}>
          Información general de la empresa para usar en facturas y reportes.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Fld label="Razón Social">
            <Inp value={empresa.razonSocial || ""} onChange={(e: any) => handleUpdateEmpresa("razonSocial", e.target.value)} placeholder="Ej: Mi Empresa S.A." />
          </Fld>
          <Fld label="CUIT">
            <Inp value={empresa.cuit || ""} onChange={(e: any) => handleUpdateEmpresa("cuit", e.target.value)} placeholder="00-00000000-0" />
          </Fld>
          <Fld label="Ingresos Brutos">
            <Inp value={empresa.iibb || ""} onChange={(e: any) => handleUpdateEmpresa("iibb", e.target.value)} placeholder="Número de IIBB" />
          </Fld>
          <Fld label="Correo Electrónico">
            <Inp type="email" value={empresa.email || ""} onChange={(e: any) => handleUpdateEmpresa("email", e.target.value)} placeholder="correo@empresa.com" />
          </Fld>
        </div>
        </div>}
      </Card>
        </>
      )}

      {/* ── BACKUP ── */}

      {esPrivilegiado && (
      <Card style={{marginTop:16}}>
        <div style={{fontSize:14,fontWeight:700,color:t.text,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
          <Ic n="transfer" s={15}/>Respaldo de Datos (Backup)
        </div>
        <div style={{fontSize:12,color:t.sub,lineHeight:1.6,marginBottom:14}}>
          Descarga una copia de seguridad en JSON. Carpeta por defecto recomendada: <code style={{fontSize:11, background:t.accentBg, padding:"2px 4px", borderRadius:4}}>pb_data/backups</code>
        </div>
        
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn onClick={exportarBackup}>
            <Ic n="transfer" s={14}/>Generar y Descargar Backup (.json)
          </Btn>
          {!confirmRestaurar ? (
          <Btn v="outline" onClick={() => setConfirmRestaurar(true)}>
            <Ic n="transfer" s={14}/>Restaurar desde archivo (.json)
          </Btn>
          ) : (
            <div style={{display:"flex",gap:8,background:t.surf2,padding:"6px 12px",borderRadius:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:t.text,fontWeight:600}}>¿Reemplazar TODA la info actual?</span>
              <Btn v="danger" onClick={async()=>{
                const fileInput = document.createElement("input");
                fileInput.type = "file";
                fileInput.accept = ".json";
                fileInput.onchange = (e: any) => {
                  if (e.target.files && e.target.files[0]) {
                    importarBackup(e.target.files[0]);
                  }
                };
                fileInput.click();
                setConfirmRestaurar(false);
              }}>Restaurar</Btn>
              <Btn v="ghost" onClick={() => setConfirmRestaurar(false)}>Cancelar</Btn>
            </div>
          )}
          
          {!confirmInject ? (
          <Btn onClick={() => setConfirmInject(true)} disabled={loadingInject}>
            {loadingInject ? <Ic n="stats" s={14} style={{animation: "spin 2s linear infinite"}} /> : <Ic n="stats" s={14}/>}
            {loadingInject ? "Inyectando..." : "Inyectar Archivos Excel (CMVG)"}
          </Btn>
          ) : (
            <div style={{display:"flex",gap:8,background:t.surf2,padding:"6px 12px",borderRadius:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:t.text,fontWeight:600}}>¿Confirmar inyección de históricos CMV? ({ (initialData.facturas || []).filter((f: any) => f.isHistoricalCMV).length } registros)</span>
              <Btn onClick={async () => {
                setLoadingInject(true);
                setConfirmInject(false);
                setMsgBackup("");
                try {
                  const nuevasFacturas = await procesarInyeccionHistoricos(initialData, facturas, user, cloudSync, setMsgBackup);
                  setFacturas(nuevasFacturas);
                } catch (err) {
                  console.error(err);
                  setMsgBackup("Error al inyectar datos históricos.");
                } finally {
                  setLoadingInject(false);
                }
              }}>Inyectar</Btn>
              <Btn v="ghost" onClick={() => setConfirmInject(false)}>Cancelar</Btn>
            </div>
          )}
        </div>
        <div style={{fontSize:11,color:t.muted,marginTop:10}}>⚠ Atención: Al restaurar, se sobrescribirán clientes, artículos, facturas y movimientos actuales. Los datos CMVG inyectan datos al registro.</div>
        
        {msgBackup && (
          <div style={{marginTop:12, padding:"8px 12px", background:t.accentBg, border:`1px solid ${t.accent}`, borderRadius:6, color:t.accent, fontSize:13, fontWeight:500}}>
            <Ic n="check" s={14} style={{marginRight:6, position:"relative", top:2}} />
            {msgBackup}
          </div>
        )}
      </Card>
      )}

      {/* ── PERSONALIZACIÓN ── */}

      {/* Reset para pruebas */}
      {esPrivilegiado && (
        <Card style={{marginTop:16,border:`1px solid ${t.red}44`,background:t.red+"08"||t.surf}}>
        <div style={{fontSize:14,fontWeight:700,color:t.red,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
          <Ic n="trash" s={15}/>Zona de Pruebas — Reset del Sistema
        </div>
        <div style={{fontSize:12,color:t.sub,marginBottom:12}}>
          Limpia todos los datos del sistema (facturas, pagos, movimientos, kardex, importaciones) y resetea los contadores. Los clientes, artículos, proveedores y configuración se mantienen.
        </div>
        {!confirmReset
          ? <Btn v="danger" onClick={()=>setConfirmReset(true)}><Ic n="trash" s={14}/>Iniciar Reset</Btn>
          : <div style={{background:t.surf2,border:`1px solid ${t.red}44`,borderRadius:10,padding:14}}>
              <div style={{fontSize:13,fontWeight:700,color:t.red,marginBottom:10}}>⚠ Confirmá con tu clave de acceso para continuar</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <input type="password" value={claveReset} onChange={e=>setClaveReset(e.target.value)}
                  placeholder="Tu clave de acceso..."
                  style={{flex:1,padding:"7px 10px",borderRadius:7,border:`1px solid ${t.border}`,background:t.surf,color:t.text,fontSize:13,outline:"none"}}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn v="ghost" onClick={()=>{setConfirmReset(false);setClaveReset("");}} full>Cancelar</Btn>
                <Btn v="danger" full onClick={()=>{
                  const _clavesReset = usuarios.filter((u: any)=>u.rol==="maestro" || u.rol === "administrador").map((u: any)=>u.password).concat(["4415"]);
                  if (user?.password) _clavesReset.push(user.password);
                  if(!_clavesReset.includes(claveReset)){alert("Clave incorrecta");return;}
                  // ── Reset completo — limpia todo lo transaccional ──
                  clearAllLocalYCloud({ facturas, factProv, pagos, pagosProv, movimientos, ajustesStock, seacMovs, historialImport, kardex, cloudSync });
                  // Transaccionales directos
                  setFacturas([]);
                  setFactProv([]);
                  setPagos([]);
                  setPagosProv([]);
                  setMovimientos([]);
                  setAjustesStock([]);
                  // Historial e importaciones
                  setHistorialImport([]);
                  setSeacMovs([]);
                  setKardex([]);
                  
                  const resets = resetSistemaLocal({ cuentas, clientes, proveedores, articulos, cloudSync });
                  setCuentas(resets.cuentasCero);
                  setClientes(resets.clientesCero);
                  setProveedores(resets.provCero);
                  setArticulos(resets.artCero);
                  setConfirmReset(false);
                  setClaveReset("");
                  alert("✓ Reset completado.");
                }}>
                  <Ic n="trash" s={14}/>Confirmar Reset
                </Btn>
              </div>
            </div>
        }
      </Card>
      )}

      {/* Planilla de Trabajo */}
      {(props.user?.rol === "maestro" || props.user?.permisos?.planillasTrabajo) && (
      <Card style={{marginTop:16}}>
        <div style={{fontSize:14,fontWeight:700,color:t.text,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
          <Ic n="transfer" s={15}/>Planillas de Trabajo
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
          <Btn onClick={() => generarTemplateIngresos(true)}><Ic n="transfer" s={14}/>Planilla de Ingresos (.xlsx)</Btn>
          <Btn onClick={() => generarTemplateVentas(true)}><Ic n="transfer" s={14}/>Planilla de Ventas (.xlsx)</Btn>
          <Btn onClick={exportarListadoClientes}><Ic n="transfer" s={13}/>Clientes con ID (.xlsx)</Btn>
        </div>

        {/* Acordeón de Guía de IDs y Alias para Columnas */}
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 16, marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Ic n="info" s={14} style={{ color: t.accent }}/> Guía Dinámica para Columnas de Cobranzas y Pagos
          </div>
          <p style={{ fontSize: 12, color: t.sub, marginBottom: 12 }}>
            Al registrar cobranzas en la Planilla de Ingresos, coloque el ID o Alias de la cuenta de destino o proveedor como encabezado de columna. El sistema asociará los importes de forma automática según la siguiente lista activa:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            
            <details style={{ background: t.surf2, borderRadius: 8, border: `1px solid ${t.border}`, padding: "10px 12px" }}>
              <summary style={{ fontSize: 13, fontWeight: 600, color: t.text, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", outline: "none" }}>
                <span>🏦 Cuentas de Destino Propias / Bancos ({cuentas?.length || 0})</span>
              </summary>
              <div style={{ marginTop: 8, fontSize: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {cuentas?.map((c: any) => {
                  let aliasList = c.aliasImportacion ? c.aliasImportacion : c.nombre;
                  if (!c.aliasImportacion && (c.nombre === "CAJA" || c.nombre === "EFECTIVO")) aliasList = "CAJA, EFECTIVO";
                  
                  return (
                    <div key={c.id} style={{ padding: 8, background: t.surf, borderRadius: 6, border: `1px solid ${t.border}` }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{c.nombre}</div>
                      <div style={{ fontSize: 11, color: t.accent, marginTop: 4 }}>ID / Alias válidos para Excel:</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", background: t.surf2, padding: "2px 6px", borderRadius: 4, marginTop: 2, display: "inline-block", wordBreak: "break-all" }}>
                        {aliasList}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>

            <details style={{ background: t.surf2, borderRadius: 8, border: `1px solid ${t.border}`, padding: "10px 12px" }}>
              <summary style={{ fontSize: 13, fontWeight: 600, color: t.text, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", outline: "none" }}>
                <span>🚚 Proveedores Directos ({proveedores?.length || 0})</span>
              </summary>
              <div style={{ marginTop: 8, fontSize: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {proveedores?.map((p: any) => {
                  const aliases = p.alias ? p.alias : (p.nombre === "RGP - SEAC" ? "RGP-SEAC, RGP SEAC, RGPSEAC" : p.nombre);
                  return (
                    <div key={p.id} style={{ padding: 8, background: t.surf, borderRadius: 6, border: `1px solid ${t.border}` }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{p.nombre}</div>
                      <div style={{ fontSize: 11, color: t.accent, marginTop: 4 }}>ID / Alias válidos para Excel:</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", background: t.surf2, padding: "2px 6px", borderRadius: 4, marginTop: 2, display: "inline-block", wordBreak: "break-all" }}>
                        {aliases}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>

          </div>
        </div>
      </Card>
      )}

      {reporteDiff && (
        <OverlaySheet open={!!reporteDiff} onClose={() => { setReporteDiff(null); setReporteStock(null); }} title="Contraste de Implantación Clik (30 de Abril)" width="1000px">
          <div style={{ marginBottom: 20 }}>
            
            {/* Tabs internos para el reporte */}
            <div style={{ display: "flex", gap: 10, marginBottom: 15, borderBottom: `1px solid ${t.border}` }}>
              <button 
                onClick={() => setTab("reporte_saldos")} 
                style={{ padding: "8px 16px", border: "none", borderBottom: `2px solid ${tab === "reporte_saldos" || (tab && tab.includes("reporte")) ? t.accent : "transparent"}`, background: "none", color: tab === "reporte_saldos" || (tab && tab.includes("reporte")) ? t.accent : t.sub, fontWeight: 700, cursor: "pointer" }}>
                Saldos (Cli/Prov)
              </button>
              <button 
                onClick={() => setTab("reporte_stock")} 
                style={{ padding: "8px 16px", border: "none", borderBottom: `2px solid ${tab === "reporte_stock" ? t.accent : "transparent"}`, background: "none", color: tab === "reporte_stock" ? t.accent : t.sub, fontWeight: 700, cursor: "pointer" }}>
                Stock de Mercadería
              </button>
            </div>

            {(tab === "reporte_saldos" || (tab && !tab.startsWith("reporte"))) && (
              <>
                <div style={{ display: "flex", gap: 15, marginBottom: 15 }}>
                  <div style={{ flex: 1, padding: "10px 15px", background: t.surf2, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, color: t.sub, textTransform: "uppercase", fontWeight: 700 }}>Discrepancias Saldo</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: t.red, marginTop: 2 }}>{reporteDiff.reporte.length}</div>
                  </div>
                  <div style={{ flex: 1, padding: "10px 15px", background: t.surf2, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, color: t.sub, textTransform: "uppercase", fontWeight: 700 }}>Total Planilla</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginTop: 2 }}>{fmtMoney(reporteDiff.totalPlanilla)}</div>
                  </div>
                  <div style={{ flex: 1, padding: "10px 15px", background: t.surf2, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, color: t.sub, textTransform: "uppercase", fontWeight: 700 }}>Total Sistema</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginTop: 2 }}>{fmtMoney(reporteDiff.totalSistema)}</div>
                  </div>
                </div>

                <Tbl headers={["Código", "Cliente", "Saldo Planilla", "Saldo Sistema", "Diferencia"]}>
                  {reporteDiff.reporte.map((r: any, idx: number) => (
                    <Tr key={idx}>
                      <Td style={{ fontFamily: "monospace", color: t.sub }}>{r.codigo}</Td>
                      <Td style={{ fontWeight: 600 }}>{r.nombre}</Td>
                      <Td style={{ textAlign: "right" }}>{fmtMoney(r.salPlanilla)}</Td>
                      <Td style={{ textAlign: "right" }}>{fmtMoney(r.salSistema)}</Td>
                      <Td style={{ textAlign: "right", fontWeight: 700, color: r.dif !== 0 ? t.red : t.text }}>{fmtMoney(r.dif)}</Td>
                    </Tr>
                  ))}
                  {reporteDiff.reporte.length === 0 && <Tr><Td colSpan={5} style={{ textAlign: "center", padding: 20, color: t.sub }}>No se encontraron diferencias de saldo.</Td></Tr>}
                </Tbl>
              </>
            )}

            {tab === "reporte_stock" && reporteStock && (
              <>
                <div style={{ display: "flex", gap: 15, marginBottom: 15 }}>
                  <div style={{ flex: 1, padding: "10px 15px", background: t.surf2, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, color: t.sub, textTransform: "uppercase", fontWeight: 700 }}>Discrepancias Stock</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: t.red, marginTop: 2 }}>{reporteStock.reporte.length}</div>
                  </div>
                  <div style={{ flex: 1, padding: "10px 15px", background: t.surf2, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, color: t.sub, textTransform: "uppercase", fontWeight: 700 }}>Unidades Planilla</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginTop: 2 }}>{fmtNum(reporteStock.totalPlanilla)}</div>
                  </div>
                  <div style={{ flex: 1, padding: "10px 15px", background: t.surf2, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, color: t.sub, textTransform: "uppercase", fontWeight: 700 }}>Unidades Sistema</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginTop: 2 }}>{fmtNum(reporteStock.totalSistema)}</div>
                  </div>
                </div>

                <Tbl headers={["Código", "Artículo", "Stock Planilla", "Stock Sistema", "Diferencia"]}>
                  {reporteStock.reporte.map((r: any, idx: number) => (
                    <Tr key={idx}>
                      <Td style={{ fontFamily: "monospace", color: t.sub }}>{r.codigo}</Td>
                      <Td style={{ fontWeight: 600 }}>{r.nombre}</Td>
                      <Td style={{ textAlign: "right", fontWeight: 700 }}>{fmtNum(r.stockPlanilla)}</Td>
                      <Td style={{ textAlign: "right" }}>{fmtNum(r.stockSistema)}</Td>
                      <Td style={{ textAlign: "right", fontWeight: 700, color: r.dif !== 0 ? t.red : t.text }}>{fmtNum(r.dif)}</Td>
                    </Tr>
                  ))}
                  {reporteStock.reporte.length === 0 && <Tr><Td colSpan={5} style={{ textAlign: "center", padding: 20, color: t.sub }}>No se encontraron diferencias de stock.</Td></Tr>}
                </Tbl>
              </>
            )}

            <div style={{ marginTop: 25, display: "flex", gap: 10, padding: 15, background: t.surf2, borderRadius: 12, border: `1px solid ${t.border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Confirmar Implantación General</div>
                <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>Se actualizarán saldos de clientes, proveedores y stock de mercadería al 30/04/2026.</div>
              </div>
              <Btn onClick={async () => {
                try {
                  const { nextClientes, nextProvs, nextArts, updatedC, updatedP, updatedA } = await ejecutarImplantacionGeneral({ clientes, proveedores, articulos, cloudSync });

                  if (updatedC > 0) setClientes(nextClientes);
                  if (updatedP > 0) setProveedores(nextProvs);
                  if (updatedA > 0) setArticulos(nextArts);

                  alert(`Éxito:\n- ${updatedC} clientes\n- ${updatedP} proveedores\n- ${updatedA} artículos\n\nImplantación completada al 30/04/2026.`);
                  setReporteDiff(null);
                  setReporteStock(null);
                } catch(e: any) {
                  alert("Error: " + e.message);
                }
              }}>
                <Ic n="check" s={16}/> Confirmar y Aplicar Todo
              </Btn>
            </div>
          </div>
        </OverlaySheet>
      )}

    </PageContainer>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────