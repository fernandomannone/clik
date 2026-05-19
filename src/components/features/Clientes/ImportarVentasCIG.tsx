import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Tbl, Tr, Td, Bdg, Btn, Ic, Fld, Inp, InpMoney, Sel, Card, OverlaySheet, KPI } from "../../common/UIBase";
import { normalizar, fmtMoney, parseMoney, getToday, registrarMovimientoKardex, precioLista } from "../../../lib/utils";
import XLSX from "xlsx-js-style";
import { CODIGOS_A_FISICO, TIPOS_KARDEX } from "../../../constants";
import { BuscadorCliente } from "./BuscadorCliente";
import { buildImportacionVentas } from "../../../lib/importing_logic/importVentasLogic";
const COND_PAGO = ["Contado", "8 Días", "15 Días", "21 Días", "30 Días"];
const today = new Date().toISOString().slice(0,10);

const normalizarInterno = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

const isCigClient = (c: any) => {
  if(!c || !c.nombre) return false;
  const n = c.nombre.trim().toLowerCase();
  return n.startsWith("cig.") || n.startsWith("cig ") || n === "cig";
};

const limpiarNombreCV = (s) => {
  // Quitar prefijos como "1 - SLB ", "CIG.", "RIG.", etc.
  return (s||"")
    .replace(/^(\d+\s*-\s*)?(slb|cig|rig|rd|rn)\s*[\.\-]?\s*/i, "")
    .replace(/\*/g,"")
    .trim();
};


export function ImportarVentasCIG({ clientes, setClientes, articulos, setArticulos, facturas, setFacturas, user, historialImport=[], setHistorialImport, cloudSync }: any) {
  const { t } = useApp();
  const [paso, setPaso] = useState(1); // 1=subir, 2=seleccionar fecha, 3=preview, 4=ok
  const [bloques, setBloques] = useState([]);
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState([]);
  const [letraFac, setLetraFac] = useState("B");
  const [condPago, setCondPago] = useState("8 Días");
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultados, setResultados] = useState({ generadas:[], sinMatch:[], sinArticulo:[] });
  const [asignacionesFis, setAsignacionesFis] = useState({}); // nombreExcel → clienteId asignado manualmente
  const [nombresCFFis, setNombresCFFis] = useState({}); // nombreExcel → nombre real cuando se asigna CF
  const [guardarAliasesFis, setGuardarAliasesFis] = useState(true); // checkbox recordar aliases
  const [fileName, setFileName] = useState("");
  const [warningImport, setWarningImport] = useState("");

  const preventDrop = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Retorna { cliente, ambiguo, candidatos }
  const buscarClienteFis = (nombre) => {
    const n = normalizar(nombre);
    // Quitar prefijos comunes para comparación sin prefijo
    const quitarPrefijo = s => s.replace(/^(cig|rig|rd|rn)\s*[\.\-]?\s*/i,"").trim();
    const nSinPref = quitarPrefijo(n);

    // 0. Match por alias de planilla (prioridad absoluta)
    const porAlias = clientes.find(c=>(c.nombresPlanilla||[]).some(a=>normalizar(a)===n));
    if(porAlias) return { cliente: porAlias, ambiguo: false, candidatos: [] };

    // 1. Match por nombreCV exacto
    const porNombreCV = clientes.find(c=>{
      if(!c.nombreCV) return false;
      const aliases=Array.isArray(c.nombreCV)?c.nombreCV:[c.nombreCV];
      return aliases.some(a=>normalizar(a)===n);
    });
    if(porNombreCV) return { cliente: porNombreCV, ambiguo: false, candidatos: [] };

    // 2. Exacto
    const exacto = clientes.find(c=>normalizar(c.nombre)===n);
    if(exacto) return { cliente: exacto, ambiguo: false, candidatos: [] };

    // 2b. Exacto ignorando prefijo (ej: "mata guillermo" matchea "cig. mata guillermo")
    if(nSinPref) {
      const exactoSinPref = clientes.filter(c=>quitarPrefijo(normalizar(c.nombre))===nSinPref);
      const mCig = exactoSinPref.find(c => isCigClient(c));
      if(exactoSinPref.length===1) return { cliente: exactoSinPref[0], ambiguo: false, candidatos: [] };
      if(exactoSinPref.length>1 && mCig) return { cliente: mCig, ambiguo: false, candidatos: exactoSinPref };
      if(exactoSinPref.length>1) return { cliente: null, ambiguo: true, candidatos: exactoSinPref };
    }

    const palabras = nSinPref.split(" ").filter(p=>p.length>2);
    if(!palabras.length) return { cliente: null, ambiguo: false, candidatos: [] };

    // 3. Todos los candidatos con todas las palabras (comparando sin prefijo)
    let candidatos = clientes
      .map(c => {
        const cNorm = quitarPrefijo(normalizar(c.nombre));
        return { c, extra: cNorm.split(" ").filter(p=>p.length>2&&!palabras.includes(p)).length, coinciden: palabras.filter(p=>cNorm.includes(p)).length };
      })
      .filter(x=>x.coinciden===palabras.length)
      .sort((a,b)=>a.extra-b.extra);

    const conCig = candidatos.filter(x => isCigClient(x.c));
    if(conCig.length > 0) candidatos = conCig;

    if(candidatos.length===0) return { cliente: null, ambiguo: false, candidatos: [] };
    if(candidatos.length===1) return { cliente: candidatos[0].c, ambiguo: false, candidatos: [] };

    const minExtra = candidatos[0].extra;
    const empatados = candidatos.filter(x=>x.extra===minExtra);

    // Desempate por prefijo: si el nombre buscado tiene CIG, preferir cliente CIG
    // Si el nombre buscado NO tiene CIG, preferir cliente SIN CIG
    if(empatados.length>1) {
      const tienePrefijo = /^(cig|rig|rd|rn)\s*[\.\-]?\s*/i.test(nombre);
      const filtradosPorPrefijo = empatados.filter(x=>
        tienePrefijo
          ? /^(cig|rig|rd|rn)\s*[\.\-]?\s*/i.test(x.c.nombre)
          : !/^(cig|rig|rd|rn)\s*[\.\-]?\s*/i.test(x.c.nombre)
      );
      if(filtradosPorPrefijo.length===1) return { cliente: filtradosPorPrefijo[0].c, ambiguo: false, candidatos: [] };
      if(filtradosPorPrefijo.length>1) return { cliente: null, ambiguo: true, candidatos: filtradosPorPrefijo.map(x=>x.c) };
      return { cliente: null, ambiguo: true, candidatos: empatados.map(x=>x.c) };
    }
    return { cliente: candidatos[0].c, ambiguo: false, candidatos: [] };
  };

  // Wrapper para compatibilidad (devuelve solo el cliente)
  const buscarCliente = (nombre) => buscarClienteFis(nombre).cliente;

  const buscarArticuloPorCodigo = (codigo) => {
    if(!codigo) return null;
    const cod = String(codigo).trim().replace(/^0+(?=\d)/,"");
    return articulos.filter(a=>(a.estado||"activo")==="activo").find(a=>String(a.codigo||"").trim().replace(/^0+(?=\d)/,"")===cod) || null;
  };

  const fmtFecha = (iso) => {
    if(!iso) return "";
    const [y,m,d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const procesarExcel = async (file: File) => {
    if (procesando) return;
    setError(""); setProcesando(true); setWarningImport(""); setFileName(file.name);
    try {
      // Esperar a que XLSX esté disponible
      /* let XLSX */
      /* wait logic removed */
      /* throw removed */
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type:"array", cellDates:true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = (XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true }) as any[]);
      const rowsRaw = rows; // misma referencia, codigosPorCol usa rowsRaw

      // Extraer mapa col → código usando rowsRaw (raw:false, números llegan como números sin ambigüedad con fechas)
      const codigosPorCol = {};
      const isNumericString = (val) => val !== null && /^\s*\d+(\.\d*)?\s*$/.test(String(val));
      for(let ri = 0; ri < Math.min(rowsRaw.length, 10); ri++) {
        const r = rowsRaw[ri];
        if(!r) continue;
        const col0 = r[0];
        const esFechaRow = col0 instanceof Date ||
          (typeof col0 === "string" && (
            col0.trim().toUpperCase() === "ID" ||
            col0.trim().match(/^\d{4}-\d{2}-\d{2}/) ||
            col0.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/) ||
            col0.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s/) ||
            col0.trim().match(/^\d{4}\/\d{2}\/\d{2}/)
          ));
        if(esFechaRow) {
          const codsEnFecha = r.slice(1).filter(isNumericString);
          if(codsEnFecha.length > 0) {
            r.forEach((v,j)=>{ if(j>0 && isNumericString(v)) codigosPorCol[j]=String(Math.round(parseFloat(v))); });
          } else if(rowsRaw[ri+1]) {
            rowsRaw[ri+1].forEach((v,j)=>{ if(j>0 && isNumericString(v)) codigosPorCol[j]=String(Math.round(parseFloat(v))); });
          }
          break;
        }
      }
      if(!Object.keys(codigosPorCol).length) throw new Error("No se encontraron códigos de artículos en el archivo.");

      const bloquesLocal = [];
      let bloque = null;

      for(let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if(!row || row.every(v=>v===null||v==="")) continue;
        const col0 = row[0];

        // Detectar fila de fecha
        let esFecha = false, fechaParsed = null;
        let esNuevoFormatoID = false;

        if (typeof col0 === "string" && col0.trim().toUpperCase() === "ID") {
          esFecha = true;
          esNuevoFormatoID = true;
          const d = row[1];
          if (d instanceof Date) fechaParsed = d.toISOString().slice(0,10);
        } else if(col0 instanceof Date) {
          fechaParsed = col0.toISOString().slice(0,10); esFecha = true;
        } else if(typeof col0 === "string") {
          const s = col0.trim();
          // Formato ISO: 2026-03-09
          if(s.match(/^\d{4}-\d{2}-\d{2}/)) { fechaParsed = s.slice(0,10); esFecha = true; }
          // Formato con / o -: 09/03/2026 o 9/3/2026
          else {
            const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if(m) { const [,dd,mm,yy]=m; const year=yy.length===2?`20${yy}`:yy; fechaParsed=`${year}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`; esFecha=true; }
            // SheetJS raw:false puede devolver M/D/YYYY (formato americano)
            else {
              const ma = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              if(ma) {
                const mm2=ma[1].padStart(2,"0"), dd2=ma[2].padStart(2,"0"), yy2=ma[3];
                // Detectar si es MM/DD/YYYY o DD/MM/YYYY por el valor del mes
                if(parseInt(ma[1])<=12 && parseInt(ma[2])>12) { fechaParsed=`${yy2}-${mm2}-${dd2}`; esFecha=true; }
                else if(parseInt(ma[2])<=12 && parseInt(ma[1])>12) { fechaParsed=`${yy2}-${dd2}-${mm2}`; esFecha=true; }
                else { fechaParsed=`${yy2}-${dd2}-${mm2}`; esFecha=true; } // asumir DD/MM
              }
            }
          }
        }

        if(esFecha) {
          if(bloque) bloquesLocal.push(bloque);
          bloque = { fecha: fechaParsed, esNuevoFormatoID, rawClientes: [] };
          // Si la fila de fecha ya trae los codigos (col1+ son numeros), no saltar la siguiente
          const tieneCodigos = row.slice(1).some(isNumericString);
          if(!tieneCodigos) i++; // saltar fila de codigos solo si estan en fila separada
          continue;
        }

        if(bloque && col0 !== null && String(col0).trim()) {
          const col0Str = String(col0).trim();
          let isDataRow = false;
          let nombreExcel = "";
          let clienteIdExcel = null;

          if (bloque.esNuevoFormatoID) {
            // col0 es ID, col1 es Nombre
            isDataRow = col0Str.length > 0 && col0Str.toUpperCase() !== "ID" && !/^TOTAL/i.test(col0Str);
            if (isDataRow) {
              clienteIdExcel = col0Str;
              nombreExcel = String(row[1]||"").trim();
            }
          } else {
            // Si el nombreExcel (col0) no tiene pinta de número solo, o tiene col1 como texto
            if (/^[A-Za-z0-9_.-]+$/.test(col0Str) && col0Str.length >= 3 && typeof row[1] === "string" && isNaN(parseFloat(row[1].trim()))) {
               // Pseudo-nuevo formato sin cabecera ID explícita
               isDataRow = true;
               clienteIdExcel = col0Str;
               nombreExcel = String(row[1]||"").trim();
            } else {
               isDataRow = true;
               nombreExcel = col0Str;
            }
          }

          if (isDataRow) {
            // Ignorar filas de totales
            if(/^TOTAL/i.test(nombreExcel)) continue;
            const cantidades = {};
            row.forEach((v,j) => {
              if(j > 0 && v !== null && v !== "" && typeof v === "number" && v !== 0) {
                const cod = codigosPorCol[j];
                if(cod) cantidades[cod] = v;
              }
            });
            if(Object.keys(cantidades).length > 0) {
              bloque.rawClientes.push({ nombreExcel, clienteIdExcel, cantidades });
            }
          }
        }
      }
      if(bloque) bloquesLocal.push(bloque);
      if(!bloquesLocal.length) throw new Error("No se encontraron bloques de ventas en el archivo.");

      const fEncontradas = bloquesLocal.map(b => b.fecha);
      if (historialImport && historialImport.some((h: any) => h.tipo === "fisicos" && (h.fileName === file.name || h.fechas?.some((f: any) => fEncontradas.includes(f))))) {
        setWarningImport(`Advertencia: Un archivo con el nombre "${file.name}" o cuyas fechas extraídas coinciden con importaciones previas ya fue importado.`);
      }

      setBloques(bloquesLocal);
      setFechasSeleccionadas([]); // ninguna seleccionada por defecto
      setPaso(2);
    } catch(e) {
      setError(e.message || "Error al procesar el archivo.");
    }
    setProcesando(false);
  };

  const toggleFecha = (fecha) => {
    setFechasSeleccionadas(prev =>
      prev.includes(fecha) ? prev.filter(f=>f!==fecha) : [...prev, fecha]
    );
  };

  const toggleTodas = () => {
    const todas = bloques.map(b=>b.fecha);
    setFechasSeleccionadas(prev => prev.length === todas.length ? [] : todas);
  };

  // Preview solo de fechas seleccionadas
  const preview = React.useMemo(() => {
    const bloquesActivos = bloques.filter(b=>fechasSeleccionadas.includes(b.fecha));
    const sinMatch = [];
    const groupedConMatch = {};
    const sinArticuloSet = new Set();
    bloquesActivos.forEach(b => {
      b.rawClientes.forEach(rc => {
        if(/^TOTAL/i.test(rc.nombreExcel)) return; // ignorar fila de totales

        let clienteId = null;
        let resultado = { cliente: null, ambiguo: false, candidatos: [] };

        const clienteIdAsig = asignacionesFis[rc.nombreExcel]!==undefined ? asignacionesFis[rc.nombreExcel] : null;

        if (clienteIdAsig === -1) {
          clienteId = null;
          resultado.ambiguo = true; // Forzamos a que aparezca suelto en sinMatch
        } else if (clienteIdAsig !== null) {
          clienteId = clienteIdAsig;
          resultado.cliente = clientes.find(c=>String(c.id)===String(clienteIdAsig));
        } else {
          if (rc.clienteIdExcel !== null && rc.clienteIdExcel !== undefined) {
            const match = clientes.find((c: any) => String(c.id) === String(rc.clienteIdExcel));
            if(match) {
              clienteId = match.id;
              resultado.cliente = match;
            } else {
              resultado = buscarClienteFis(rc.nombreExcel);
              clienteId = resultado.cliente?.id!==undefined ? resultado.cliente.id : null;
            }
          } else {
             resultado = buscarClienteFis(rc.nombreExcel);
             clienteId = resultado.cliente?.id!==undefined ? resultado.cliente.id : null;
          }
        }

        const clienteAsig = (clienteId!==null&&clienteId!==undefined&&!resultado.cliente) ? clientes.find(c=>String(c.id)===String(clienteId)) : resultado.cliente;
        const items = Object.entries(rc.cantidades).map(([cod, cant]) => {
          const art = buscarArticuloPorCodigo(cod);
          if(!art) sinArticuloSet.add(cod);
          return { codigo: cod, cantidad: cant, art, sinMatch: !art };
        });
        
        if(clienteId!==null&&clienteId!==undefined) {
          const esCF = clienteId===0;
          const nombreCFParam = esCF ? (nombresCFFis[rc.nombreExcel]||"") : null;
          const groupKey = `${b.fecha}_${clienteId}_${nombreCFParam || ""}`;
          
          if (!groupedConMatch[groupKey]) {
            groupedConMatch[groupKey] = { 
              fecha: b.fecha, 
              clienteId, 
              nombre: clienteAsig?.nombre || rc.nombreExcel, 
              nombreExcel: rc.nombreExcel, 
              items: [],
              groupKey 
            };
          }
          groupedConMatch[groupKey].items.push(...items);
        } else {
          sinMatch.push({ fecha:b.fecha, nombreExcel:rc.nombreExcel, items, ambiguo:resultado.ambiguo, candidatos:resultado.candidatos });
        }
      });
    });
    return { conMatch: Object.values(groupedConMatch), sinMatch, sinArticulo: [...sinArticuloSet] };
  }, [bloques, fechasSeleccionadas, clientes, articulos, asignacionesFis, nombresCFFis]);

  
  const confirmar = async () => {
    if(confirmando) return;
    setConfirmando(true);
    try {
      const res = buildImportacionVentas(
        preview,
        facturas,
        clientes,
        articulos,
        {},
        nombresCFFis,
        letraFac,
        condPago,
        user?.nombre || "Importador",
        fileName,
        fechasSeleccionadas,
        precioLista,
        parseMoney,
        getToday
      );

      const { nuevas, kardexNuevosFis, nextArtsEditadosPorId: artsEditadosPorId, nuevoH } = res;

      let clientesModificados: any[] = [];
      if(guardarAliasesFis && Object.keys(asignacionesFis).length) {
        clientesModificados = clientes.map((c: any) => {
          const idA = c.id;
          const asig = Object.entries(asignacionesFis).filter(([,id])=>String(id)===String(idA));
          if(asig.length > 0) {
            const nuevosAlias = asig.map(([nombreExcel]) => nombreExcel).filter(n => !(c.nombresPlanilla||[]).includes(n));
            if(nuevosAlias.length > 0) {
               return {...c, nombresPlanilla: [...(c.nombresPlanilla||[]), ...nuevosAlias]};
            }
          }
          return null;
        }).filter(Boolean);
      }
      const artsModificadosArray = Object.values(artsEditadosPorId);

      if (typeof window !== "undefined" && kardexNuevosFis.length > 0) {
         const saved = localStorage.getItem("clik-kardex");
         const kardexActual = saved ? (JSON.parse(saved) as any) : [];
         const arr = [...kardexActual, ...kardexNuevosFis];
         localStorage.setItem("clik-kardex", JSON.stringify(arr));
         window.dispatchEvent(new Event("kardex_updated"));
      }

      if (cloudSync?.executeCloudBatch) {
         const batchOps: any[] = [];
         nuevas.forEach((f: any) => batchOps.push({ type: "set", collection: "facturas", id: String(f.id), data: f }));
         artsModificadosArray.forEach((a: any) => batchOps.push({ type: "set", collection: "articulos", id: String(a.id), data: a }));
         clientesModificados.forEach((c: any) => batchOps.push({ type: "set", collection: "clientes", id: String(c.id), data: c }));
         kardexNuevosFis.forEach((k: any) => batchOps.push({ type: "set", collection: "kardex", id: String(k.id), data: k }));
         batchOps.push({ type: "set", collection: "historialImport", id: String(nuevoH.id), data: nuevoH });
         
         if (batchOps.length > 0) {
            const ok = await cloudSync.executeCloudBatch(batchOps);
            if (!ok) {
               alert("Error al guardar en la nube (Ventas Físicos)");
            }
         }
      } else {
         if (cloudSync?.saveBatchToCloud && nuevas.length > 0) {
           cloudSync.saveBatchToCloud("facturas", nuevas);
         }
         if (cloudSync?.saveBatchToCloud && artsModificadosArray.length > 0) {
           cloudSync.saveBatchToCloud("articulos", artsModificadosArray);
         }
         if (cloudSync?.saveBatchToCloud && clientesModificados.length > 0) {
           cloudSync.saveBatchToCloud("clientes", clientesModificados);
         }
         if (cloudSync?.saveBatchToCloud && kardexNuevosFis.length > 0) {
           cloudSync.saveBatchToCloud("kardex", kardexNuevosFis);
         }
         if (cloudSync?.saveToCloud) cloudSync.saveToCloud("historialImport", nuevoH, String(nuevoH.id));
      }

      setFacturas(prev => [...nuevas, ...prev].filter((v,i,a) => a.findIndex(t => String(t.id) === String(v.id)) === i));
      if (setArticulos && artsModificadosArray.length > 0) {
        setArticulos(prev => prev.map(a => artsEditadosPorId[a.id] ? artsEditadosPorId[a.id] : a));
      }
      if (setClientes && clientesModificados.length > 0) {
        setClientes(prev => prev.map((c: any) => {
           const found = clientesModificados.find((m: any) => m.id === c.id);
           return found || c;
        }));
      }
      if(setHistorialImport) {
        setHistorialImport((prev: any[]) => [...prev, nuevoH].filter((v,i,a) => a.findIndex(t => String(t.id || t.timestamp) === String(v.id || v.timestamp)) === i));
      }
      
      // Guardado inmediato para evitar pérdida si se cierra el modal antes del debounce
      setResultados({ generadas: preview.conMatch, sinMatch: preview.sinMatch, sinArticulo: preview.sinArticulo });
      setPaso(4);
    } catch (e) {
      console.error(e);
      alert("Ocurrió un error al guardar en la nube (Ventas Físicos)");
    } finally {
      setConfirmando(false);
    }
  };

  // ── Paso 4: resultado ──────────────────────────────────────────────────────
  if(paso === 4) return (
    <div onDragOver={preventDrop} onDrop={preventDrop} style={{maxWidth:520,margin:"0 auto",paddingTop:16}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:36,marginBottom:8}}>✅</div>
        <div style={{fontSize:18,fontWeight:800,color:t.text}}>Importación completa</div>
        <div style={{fontSize:13,color:t.sub,marginTop:4}}>
          Se generaron <strong>{resultados.generadas.length} facturas</strong> para <strong>{fechasSeleccionadas.length} fecha{fechasSeleccionadas.length!==1?"s":""}</strong>
        </div>
      </div>
      {resultados.sinArticulo.length > 0 && (
        <div style={{background:t.amber+"18",borderRadius:10,padding:"12px 16px",border:`1px solid ${t.amber}44`,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:t.amber,marginBottom:4}}>⚠ Códigos sin artículo ({resultados.sinArticulo.length})</div>
          <div style={{fontSize:12,color:t.sub}}>Facturados como texto libre: {resultados.sinArticulo.join(", ")}</div>
        </div>
      )}
      {resultados.sinMatch.length > 0 && (
        <div style={{background:t.red+"12",borderRadius:10,padding:"12px 16px",border:`1px solid ${t.red}33`,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:t.red,marginBottom:4}}>Clientes sin coincidencia ({resultados.sinMatch.length})</div>
          {resultados.sinMatch.slice(0,8).map((m,i)=><div key={i} style={{fontSize:12,color:t.sub}}>{m.nombreExcel} — {fmtFecha(m.fecha)}</div>)}
          {resultados.sinMatch.length>8&&<div style={{fontSize:11,color:t.muted}}>...y {resultados.sinMatch.length-8} más</div>}
        </div>
      )}
      <Btn full onClick={()=>{setPaso(1);setBloques([]);setFechasSeleccionadas([]);setError("");setFileName("");setWarningImport("");setTimeout(()=>document.getElementById("fileInputImportarVentasCIG")?.click(), 100);}}>Importar otra fecha</Btn>
    </div>
  );

  // ── Paso 3: preview ────────────────────────────────────────────────────────
  if(paso === 3) return (
    <div onDragOver={preventDrop} onDrop={preventDrop} style={{maxWidth:620,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <Btn v="ghost" onClick={()=>setPaso(2)} style={{padding:"6px 12px",fontSize:12}}>← Cambiar fechas</Btn>
        <span style={{fontSize:13,color:t.sub}}>
          {fechasSeleccionadas.length} fecha{fechasSeleccionadas.length!==1?"s":""} seleccionada{fechasSeleccionadas.length!==1?"s":""}
          {" · "}{fechasSeleccionadas.map(f=>fmtFecha(f)).join(", ")}
        </span>
      </div>

      <div style={{background:t.surf2,borderRadius:12,padding:14,border:`1px solid ${t.border}`,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:t.sub,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:10}}>Configuración</div>
        <div style={{display:"flex",gap:12}}>
          <div style={{flex:1}}>
            <label style={{fontSize:12,color:t.muted,display:"block",marginBottom:4}}>Letra</label>
            <select value={letraFac} onChange={e=>setLetraFac(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surf,color:t.text,fontSize:14,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>
              {["B","A","C","X"].map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
          <div style={{flex:2}}>
            <label style={{fontSize:12,color:t.muted,display:"block",marginBottom:4}}>Condición de pago</label>
            <select value={condPago} onChange={e=>setCondPago(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surf,color:t.text,fontSize:14,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>
              {COND_PAGO.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        <KPI label="Facturas a generar" value={preview.conMatch.length} sub={preview.conMatch.length===1 ? "1 factura" : `${preview.conMatch.length} facturas`} color={t.green} />
        <KPI label="Sin coincidencia" value={preview.sinMatch.length} sub="Clientes no encontrados" color={preview.sinMatch.length ? t.amber : t.sub} />
        <KPI label="Códigos sin artículo" value={preview.sinArticulo.length} sub="Productos no encontrados" color={preview.sinArticulo.length ? t.amber : t.sub} />
      </div>

      <div style={{background:t.surf2,borderRadius:8,border:`1px solid ${t.border}`,maxHeight:300,overflowY:"auto",marginBottom:14}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead style={{position:"sticky", top:0, zIndex:10, background:t.surf2}}>
            <tr>
              <th style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:t.sub,fontSize:11,borderBottom:`1px solid ${t.border}`}}>Cliente</th>
              <th style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:t.sub,fontSize:11,borderBottom:`1px solid ${t.border}`}}>Fecha</th>
              <th style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:t.sub,fontSize:11,borderBottom:`1px solid ${t.border}`}}>Artículos</th>
              <th style={{padding:"7px 10px",borderBottom:`1px solid ${t.border}`}}></th>
            </tr>
          </thead>
          <tbody>
            {preview.conMatch.map((m,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${t.border}44`}}>
                <td style={{padding:"7px 10px"}}>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <BuscadorCliente
                      clientes={clientes}
                      valor={m.clienteId}
                      onChange={cid => setAsignacionesFis(prev=>({...prev,[m.nombreExcel]:cid}))}
                      t={t}
                      placeholder="Buscar cliente..."
                    />
                    {m.nombreExcel!==m.nombre&&<div style={{fontSize:10,color:t.muted,marginLeft:4}}>Original: {m.nombreExcel}</div>}
                    {String(m.clienteId)==="0"&&<div style={{marginTop:4}}>
                      <Inp
                        value={nombresCFFis[m.nombreExcel]||""}
                        onChange={e=>setNombresCFFis(prev=>({...prev,[m.nombreExcel]:e.target.value}))}
                        placeholder="Nombre del comprador (para el comprobante)"
                        style={{fontSize:11,width:"100%"}}
                      />
                    </div>}
                  </div>
                </td>
                <td style={{padding:"7px 10px",fontSize:12,color:t.muted}}>{fmtFecha(m.fecha)}</td>
                <td style={{padding:"7px 10px"}}>
                   <span style={{fontSize:11,background:t.surf,borderRadius:5,padding:"2px 6px",color:t.sub}}>{m.items.length} arts</span>
                   {m.items.some(it=>it.sinMatch)&&<span style={{fontSize:10,color:t.amber,marginLeft:4}}>⚠</span>}
                </td>
                <td style={{padding:"7px 10px",textAlign:"right"}}>
                  <button 
                    onClick={() => setAsignacionesFis(prev=>({...prev,[m.nombreExcel]: -1}))}
                    style={{background:"none", border:"none", cursor:"pointer", color:t.red, fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%"}}
                    title="Eliminar match automático"
                    onMouseEnter={e => (e.currentTarget.style.background = t.red + "22")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  ><Ic n="eliminar" s={14} /></button>
                </td>
              </tr>
            ))}
            {preview.sinMatch.map((m,i)=>(
              <tr key={"no"+i} style={{background:m.ambiguo?t.amber+"14":t.amber+"08",borderBottom:`1px solid ${t.border}44`}}>
                <td style={{padding:"7px 10px"}}>
                  <div style={{color:t.amber,fontWeight:600,fontSize:12}}>{m.nombreExcel}</div>
                  {m.ambiguo&&<div style={{fontSize:10,color:t.amber,marginTop:2}}>⚠ Múltiples coincidencias</div>}
                </td>
                <td style={{padding:"7px 10px",fontSize:11,color:t.muted}}>{fmtFecha(m.fecha)}</td>
                <td colSpan={2} style={{padding:"7px 10px"}}>
                  <BuscadorCliente
                    clientes={clientes}
                    candidatos={m.candidatos}
                    valor={asignacionesFis[m.nombreExcel]!==undefined?asignacionesFis[m.nombreExcel]:null}
                    onChange={cid=>setAsignacionesFis(prev=>({...prev,[m.nombreExcel]:cid}))}
                    t={t}
                    placeholder="Buscar cliente..."
                  />
                  {asignacionesFis[m.nombreExcel]===0&&<Inp
                    value={nombresCFFis[m.nombreExcel]||""}
                    onChange={e=>setNombresCFFis(prev=>({...prev,[m.nombreExcel]:e.target.value}))}
                    placeholder="Nombre del comprador (para el comprobante)"
                    style={{fontSize:11,marginTop:4,width:"100%"}}
                  />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <button onClick={()=>setPaso(2)} style={{background:t.surf2,border:`1px solid ${t.border}`,borderRadius:8,padding:"10px 16px",fontSize:13,cursor:"pointer",color:t.text,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontWeight:600}}><Ic n="arrow-left" s={14}/> Volver</button>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
          {Object.keys(asignacionesFis).length>0&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:t.sub,cursor:"pointer",userSelect:"none"}}>
            <input type="checkbox" checked={guardarAliasesFis} onChange={e=>setGuardarAliasesFis(e.target.checked)}
              style={{width:14,height:14,cursor:"pointer",accentColor:t.accent}}/>
            <span>Recordar asignaciones manuales para futuras importaciones</span>
          </label>}
          <Btn onClick={confirmar} disabled={!preview.conMatch.length||confirmando||preview.sinMatch.length>0||preview.sinArticulo.length>0} style={{whiteSpace:"nowrap"}}><Ic n="check" s={14}/>{confirmando?"Procesando...":"Confirmar y generar "+preview.conMatch.length+" facturas"}</Btn>
        </div>
      </div>
    </div>
  );

  // ── Paso 2: seleccionar fechas ─────────────────────────────────────────────
  if(paso === 2) return (
    <div onDragOver={preventDrop} onDrop={preventDrop} style={{maxWidth:520,margin:"0 auto"}}>
      {warningImport && <div style={{padding:"10px 14px",background:t.amberBg,border:`1px solid ${t.amber}44`,borderRadius:8,fontSize:13,color:t.amber,fontWeight:600,marginBottom:14}}>{warningImport}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:t.text}}>
          {bloques.length} fecha{bloques.length!==1?"s":""} detectadas en el archivo
        </div>
        <button onClick={toggleTodas} style={{fontSize:12,color:t.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",fontWeight:600}}>
          {fechasSeleccionadas.length===bloques.length?"Deseleccionar todas":"Seleccionar todas"}
        </button>
      </div>

      <div style={{borderRadius:12,border:`1px solid ${t.border}`,overflow:"hidden",marginBottom:16}}>
        {bloques.map((b,i)=>{
          const sel = fechasSeleccionadas.includes(b.fecha);
          // Detectar si ya hay facturas importadas para esta fecha
          const yaFacturadas = facturas.filter(f=>
            f.fecha===b.fecha && f.origenImport==="fisicos"
          ).length;
          return (
            <div key={b.fecha} onClick={()=>toggleFecha(b.fecha)}
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<bloques.length-1?`1px solid ${t.border}`:"none",background:sel?t.accent+"12":i%2===0?t.surf:t.surf2,cursor:"pointer",transition:"background 0.15s"}}>
              <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${sel?t.accent:t.border}`,background:sel?t.accent:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                {sel&&<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:sel?t.accent:t.text}}>{fmtFecha(b.fecha)}</div>
                {yaFacturadas>0&&<div style={{fontSize:11,color:t.amber,marginTop:2}}>⚠ Ya facturada ({yaFacturadas} factura{yaFacturadas!==1?"s":""})</div>}
              </div>
              <div style={{fontSize:12,color:t.muted}}>{b.rawClientes.length} cliente{b.rawClientes.length!==1?"s":""}</div>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>{setPaso(1);setBloques([]);}} style={{background:t.surf2,border:`1px solid ${t.border}`,borderRadius:8,padding:"10px 16px",fontSize:13,cursor:"pointer",color:t.text,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontWeight:600}}><Ic n="arrow-left" s={14}/> Volver</button>
        <Btn full onClick={()=>setPaso(3)} disabled={!fechasSeleccionadas.length}>
          Ver preview ({fechasSeleccionadas.length} fecha{fechasSeleccionadas.length!==1?"s":""})
        </Btn>
      </div>
    </div>
  );

  // ── Paso 1: subir ──────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:4}}>Importar Ventas Físicos</div>
        <div style={{fontSize:13,color:t.sub}}>Subí el Excel de ventas. El sistema detectará todas las fechas disponibles y podrás elegir cuál o cuáles importar.</div>
      </div>
      <label onDrop={e => {e.preventDefault(); const f=e.dataTransfer?.files[0]; if(f)procesarExcel(f);}}
        onDragOver={e => e.preventDefault()}
        style={{display:"block",border:`2px dashed ${t.border}`,borderRadius:14,padding:"48px 24px",textAlign:"center",cursor:"pointer",background:t.surf2}}>
        <input id="fileInputImportarVentasCIG" type="file" accept=".xlsx,.xls" style={{display:"none"}} disabled={procesando} onChange={e=>{const f=e.target.files?.[0];if(f)procesarExcel(f);e.target.value="";}}/>
        <div style={{fontSize:36,marginBottom:12}}>📂</div>
        <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>{procesando?"Procesando...":"Arrastrá la planilla aquí"}</div>
        <div style={{fontSize:13,color:t.sub,marginBottom:12}}>o hacé click para seleccionarla</div>
        <div style={{display:"inline-block",background:t.accentBg,border:`1px solid ${t.accent}`,borderRadius:8,padding:"6px 14px",fontSize:12,color:t.accent,fontWeight:600}}>Archivos .xlsx o .xls</div>
      </label>
      {error && <div style={{marginTop:12,padding:"10px 14px",background:t.red+"18",border:`1px solid ${t.red}33`,borderRadius:8,fontSize:13,color:t.red}}>{error}</div>}
    </div>
  );
}
