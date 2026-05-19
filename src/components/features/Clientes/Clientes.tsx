import React, { useState, useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import { Tbl, Tr, Td, Avatar, Bdg, Btn, Ic, SearchBar, Modal, Fld, Inp, Sel, Card, ThSort, useSort, OverlaySheet, ModalConfirmarEliminacion, DropDown, DropDownItem } from "../../common/UIBase";
import { PageContainer } from "../../layout/AppShell";
import { fmtMoney, getToday, normalizar, parseMoney, fmtFechaCC, precioLista } from "../../../lib/utils";
import { getCcCliente, calcularSaldosHistoricosMap } from "../../../lib/clientes/calculosSaldos";
import FacturaModal from "../Facturas/FacturaModal";
import FacturaVistaPrevia from "../Facturas/FacturaVistaPrevia";
import { COND_PAGO, CLIENTE_CF } from "../../../constants";

// Sub-componentes modulares
export { BuscadorCliente } from "./BuscadorCliente";
import { BuscadorCliente } from "./BuscadorCliente";
import { ModalIngresoCli } from "./ModalIngresoCli";
import { ModalMasivoCli } from "./ModalMasivoCli";
import { ModalCliente } from "./ModalCliente";
import { ModalExportacion } from "../../common/ModalExportacion";
import { useClientes } from "./useClientes";
import { ImportarCV } from "./ImportarCV";
import { ImportarVentasCIG } from "./ImportarVentasCIG";
import { TabHistorialFacturacion } from "./TabHistorialFacturacion";
import { ImportarIngresos, TabHistorialIngresos } from "./ImportarIngresos";
import ModalCC from "./ModalCC";
import ModalImportarClientes from "./ModalImportarClientes";
import { exportarAExcel } from "../../../lib/excelExport";

const today = getToday();

export default function Clientes(props: any) {
  const { clientes = [], setClientes, facturas = [], setFacturas, articulos = [], setArticulos, pagos = [], setPagos, cuentas, setCuentas, movimientos, setMovimientos, pagosProv, setPagosProv, user, historialImport = [], setHistorialImport, proveedores = [], historialCierres = [] } = props;
  const { t } = useApp();
  const [tab, setTab] = useState("maestro");
  const { busq, setBusq, showArchivados, setShowArchivados, filtrados: preFiltrados, saldosMap, clientesConAutoEstado, guardarCliente, handleUpdateInline, handleUpdateInlineMulti, handleEliminarCliente } = useClientes(clientes, facturas, pagos, props.cloudSync);
  const [modal, setModal] = useState(false);
  const [showExportar, setShowExportar] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [showEliminarCli, setShowEliminarCli] = useState(false);
  const [clienteFac, setClienteFac] = useState<any>(null);
  const [verCC, setVerCC] = useState<any>(null);
  const [facturaReciente, setFacturaReciente] = useState<any>(null);

  const ccCache = useMemo(() => { return {}; }, [facturas, pagos]);

  const ccCliente = (cid: number) => {
    const cli = clientes.find((c: any) => c.id === cid);
    return getCcCliente(cid, cli, facturas, pagos);
  };

  const saldoCliente = (cid: number) => {
    return saldosMap[cid] || 0;
  };

  const [fechaSaldo, setFechaSaldo] = useState(today);
  const [provinciaSaldo, setProvinciaSaldo] = useState("Todas");
  const [localidadSaldo, setLocalidadSaldo] = useState("Todas");
  const [ignorarCero, setIgnorarCero] = useState(false);
  const [sortSaldoCli, setSortSaldoCli] = useState("nombre");
  const [dirSaldoCli, setDirSaldoCli] = useState("asc");

  const [showIngresoCli, setShowIngresoCli] = useState(false);
  const [showMasivoCli, setShowMasivoCli] = useState(false);
  const [showImportarUnif, setShowImportarUnif] = useState(false);
  const [showHistIngresos, setShowHistIngresos] = useState(false);

  React.useEffect(() => {
    const handle = (e: any) => {
      // Small timeout to allow transition
      setTimeout(() => setBusq(e.detail), 50);
    };
    window.addEventListener('search-element', handle);
    return () => window.removeEventListener('search-element', handle);
  }, []);

  const toggleSaldoCli = (k: string) => { if (sortSaldoCli === k) setDirSaldoCli(d => d === "asc" ? "desc" : "asc"); else { setSortSaldoCli(k); setDirSaldoCli("asc"); } };

  const { sortKey: sortKeyC, sortDir: sortDirC, toggleSort: toggleSortC, sortFn: sortFnC } = useSort("nombre", "asc");

  const filtrados = useMemo(() => {
    return [...preFiltrados].sort((a: any, b: any) => {
      if (sortKeyC === "_saldo") return sortDirC === "asc" ? a._saldo - b._saldo : b._saldo - a._saldo;
      return sortFnC(a, b);
    });
  }, [preFiltrados, sortKeyC, sortDirC, sortFnC]);

  const saldosHistoricos = useMemo(() => {
    return calcularSaldosHistoricosMap(clientes, facturas, pagos, fechaSaldo);
  }, [clientes, facturas, pagos, fechaSaldo, historialCierres]);

  const filtradosSaldoC = useMemo(() => {
    let res = (clientesConAutoEstado || [])
      .filter((c: any) => {
        if (!c) return false;
        return showArchivados ? c.autoEstado === "archivado" : c.autoEstado !== "archivado";
      })
      .map((c: any) => ({ ...c, _saldoHist: saldosHistoricos[c.id] || 0 }));
      
    if (ignorarCero) {
      res = res.filter((c: any) => Math.abs(c._saldoHist) > 0.01);
    }
    
    if (provinciaSaldo && provinciaSaldo !== "Todas") {
      res = res.filter((c: any) => c.provincia === provinciaSaldo);
    }
    
    if (localidadSaldo && localidadSaldo !== "Todas") {
      res = res.filter((c: any) => c.localidad === localidadSaldo);
    }
    
    res.sort((a: any, b: any) => {
      if (!a || !b) return 0;
      if (sortSaldoCli === "nombre") return dirSaldoCli === "asc" ? (a.nombre || "").localeCompare(b.nombre || "") : (b.nombre || "").localeCompare(a.nombre || "");
      if (sortSaldoCli === "_saldoHist") return dirSaldoCli === "asc" ? a._saldoHist - b._saldoHist : b._saldoHist - a._saldoHist;
      return 0;
    });
    return res;
  }, [clientesConAutoEstado, saldosHistoricos, ignorarCero, provinciaSaldo, localidadSaldo, sortSaldoCli, dirSaldoCli, showArchivados]);

  const [showImportarCli, setShowImportarCli] = useState(false);

  const abrirNuevo = () => {
    console.log("abrirNuevo called");
    const maxId = clientes.reduce((max: number, c: any) => {
      const id = typeof c.id === "number" ? c.id : parseInt(c.id) || 0;
      return id < 1000000000 ? Math.max(max, id) : max;
    }, 0);
    console.log("maxId assigned", maxId);
    setEditando({ id: maxId + 1, estado: "activo" });
    setModal(true);
    console.log("modal set to true");
  };

  const onGuardarCliente = async () => {
    if (!editando.nombre) return;
    
    // Normalize aliases arrays
    const normalizarAlias = (arr: any) => {
      let _arr = Array.isArray(arr) ? arr : (arr ? [arr] : []);
      _arr = _arr.flatMap((a: any) => {
        let str = String(a).trim();
        if (str.startsWith('[')) { try { const p = JSON.parse(str); return Array.isArray(p) ? p : [str]; } catch {} }
        return str.split(/[,;|]/);
      });
      return Array.from(new Set(_arr.map((a: any) => String(a).replace(/[^a-zA-Z0-9\s.\-]/g, "").trim()).filter(Boolean)));
    };
    
    const dGuardar = {
      ...editando,
      // Sincronización automática para el Bot RPA
      numero_wa: editando.telefono || "",
      nombre_rgpseac: Array.isArray(editando.nombreCV) ? (editando.nombreCV[0] || "") : (editando.nombreCV || ""),
      
      nombreCV: normalizarAlias(editando.nombreCV),
      listaPrecios: editando.listaPrecios ? parseInt(editando.listaPrecios) : null,
      creditoMax: parseInt(editando.creditoMax) || 0,
      saldoInicial: parseFloat(editando.saldoInicial) || 0,
      fechaSaldoInicial: editando.fechaSaldoInicial || null,
      permitirExcederLimite: !!editando.permitirExcederLimite
    };

    await guardarCliente(dGuardar, setClientes);
    setModal(false);
  };

  const handleExportarPrecioCli = async (c: any) => {
    if (!c.listaPrecios && !c.precioManual) {
      alert("El cliente debe tener una lista de precios asignada.");
      return;
    }
    const activeArts = articulos
      .filter((a: any) => {
        if (a.estado === "archivado") return false;
        const famNormalizada = (typeof a.familia === 'string' ? a.familia : a.familia?.nombre || "").toLowerCase().trim().replace(/_/g, " ");
        if (
          famNormalizada.includes("servicio") || 
          famNormalizada.includes("carga virtual") || 
          famNormalizada === "cv" ||
          famNormalizada === "carga" ||
          famNormalizada === "cargas"
        ) return false;
        // Filtramos items específicos que pueden haber quedado con familia en blanco pero son de servicio usando su código
        const cod = String(a.codigo || "").trim();
        if (["046", "100", "668", "044", "007", "666", "999", "667"].includes(cod)) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        const famA = typeof a.familia === 'string' ? a.familia : a.familia?.nombre || "";
        const famB = typeof b.familia === 'string' ? b.familia : b.familia?.nombre || "";
        if (famA === famB) return (a.nombre || "").localeCompare(b.nombre || "");
        return famA.localeCompare(famB);
      });

    const filas = activeArts.map((a: any) => {
      let calcPrecio = 0;
      if (c.precioManual) {
        // Fallback: precio de la última factura de este artículo para este cliente
        const ultFac = [...facturas]
          .filter((f: any)=>f.clienteId===c.id&&!f.anulada&&f.items?.some((i: any)=>i.artId===a.id||i.codigo===a.codigo))
          .sort((x,y)=>y.fecha.localeCompare(x.fecha))[0];
        if(ultFac) {
          const ultItem = ultFac.items.find((i: any)=>i.artId===a.id||i.codigo===a.codigo);
          calcPrecio = parseMoney(ultItem?.precio)||0;
        }
        if (!calcPrecio) {
           const fall = precioLista(a, 1);
           if (fall > 0) calcPrecio = fall;
        }
      } else {
        calcPrecio = precioLista(a, c.listaPrecios);
      }
      return [
        a.codigo || "",
        a.nombre || "",
        calcPrecio
      ];
    });

    exportarAExcel({
      titulo: `Lista de Precios — ${c.nombre}`,
      columnas: ["Codigo de art.", "Artículo", "Precio"],
      filas: filas,
      fileName: `Lista_Precios_${c.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`,
      sheetName: "Precios"
    });
  };

  const totalesC = {
    activos: (clientesConAutoEstado || []).filter((p: any) => p.autoEstado === "activo" || !p.autoEstado).length,
    inactivos: (clientesConAutoEstado || []).filter((p: any) => p.autoEstado === "inactivo").length,
    archivados: (clientesConAutoEstado || []).filter((p: any) => p.autoEstado === "archivado").length 
  };
  const subTextC = <div style={{display:"flex", gap:15, alignItems:"center", fontSize:12, marginTop:4}}>
    <span><b>{(clientesConAutoEstado || []).length}</b> total</span>
    <span style={{color:t.green}}><b>{totalesC.activos}</b> activos</span>
    {totalesC.inactivos > 0 && <span style={{color:"#f59e0b"}}><b>{totalesC.inactivos}</b> inactivos</span>}
    {totalesC.archivados > 0 && <span style={{color:t.muted}}><b>{totalesC.archivados}</b> archivados</span>}
  </div>;

  return (
    <PageContainer
      title="Clientes"
      sub={subTextC}
      stickyHeader={false}
      actions={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Btn onClick={abrirNuevo} style={{ height: 38 }}><Ic n="plus" s={14} /> Nuevo Cliente</Btn>

          <DropDown 
             trigger={<Btn v="ghost" style={{ height: 38, padding: "0 10px" }} title="Opciones"><Ic n="dots" s={18} /></Btn>}
             align="right"
          >
             <DropDownItem icon="plus" onClick={() => setShowIngresoCli(true)}>Registrar Cobro</DropDownItem>
             <DropDownItem icon="transfer" onClick={() => setShowExportar(true)}>Exportar Clientes</DropDownItem>
             <DropDownItem icon="transfer" onClick={() => setShowHistIngresos(true)}>Importar Cobranzas/Pagos</DropDownItem>
             <DropDownItem icon="transfer" onClick={() => setShowImportarUnif(true)}>Importar Facturación</DropDownItem>
          </DropDown>
        </div>
      }
      extraHeader={
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${t.border}` }}>
            {[{ id: "maestro", label: "Maestro" }, { id: "saldos", label: "Saldos", icon: "stats" }].map(tb => {
              const active = tab === tb.id;
              return <button key={tb.id} onClick={() => setTab(tb.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", border: "none", borderBottom: `2px solid ${active ? t.accent : "transparent"}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, color: active ? t.accent : t.sub, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", marginBottom: -1 }}>
                {tb.icon && <Ic n={tb.icon} s={14} />}{tb.label}
              </button>;
            })}
          </div>
          {tab === "maestro" && (
            <SearchBar 
              value={busq} 
              onChange={setBusq} 
              placeholder="Buscar por nombre o código..." 
              addon={
                <button
                  onClick={() => setShowArchivados(!showArchivados)}
                  title={showArchivados ? "Ocultar archivados" : "Mostrar archivados"}
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, background: showArchivados ? t.accentBg : t.surf, border: `1px solid ${showArchivados ? t.accent : t.border}`, color: showArchivados ? t.accent : t.sub, cursor: "pointer", transition: "all 0.15s" }}
                >
                  <Ic n="eye" s={16} />
                </button>
              }
            />
          )}
        </div>
      }
    >
      {tab === "maestro" && (
        <>
          <Tbl headers={[
            <ThSort label="Cliente" colKey="nombre" sortKey={sortKeyC} sortDir={sortDirC} onSort={toggleSortC} />,
            "Teléfono",
            "Lista",
            <ThSort label="Saldo CC" colKey="_saldo" sortKey={sortKeyC} sortDir={sortDirC} onSort={toggleSortC} align="right" />,
            "Tipo de Cte.",
            "Estado",
            "Acciones"
          ]}>
            {filtrados.map((c: any) => {
              const saldo = saldosMap[c.id] || 0;
              let autoEstado = c.autoEstado || c.estado || "activo";
              
              return (
                <Tr key={c.id} onDoubleClick={() => { setEditando(c); setModal(true); }} style={{ opacity: c.estado === "archivado" ? 0.4 : 1 }}>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar nombre={c.nombre} />
                      <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                    </div>
                  </Td>
                  <Td>{c.telefono || "—"}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select 
                        value={c.listaPrecios || (c.precioManual ? "manual" : "")} 
                        onChange={(e: any) => {
                          const val = e.target.value;
                          if (val === "manual") {
                            handleUpdateInlineMulti(c, { precioManual: true, listaPrecios: null }, setClientes);
                          } else {
                            handleUpdateInlineMulti(c, { listaPrecios: val ? parseInt(val) : null, precioManual: false }, setClientes);
                          }
                        }}
                        style={{ 
                          background: c.precioManual ? t.amber + "15" : c.listaPrecios === 1 ? (t.blue||"#3b82f6") + "15" : c.listaPrecios === 2 ? t.green + "15" : c.listaPrecios === 3 ? t.amber + "15" : c.listaPrecios === 4 ? t.purple + "15" : t.surf2, 
                          border: `1px solid ${c.precioManual ? t.amber+"44" : c.listaPrecios === 1 ? (t.blue||"#3b82f6")+"44" : c.listaPrecios === 2 ? t.green+"44" : c.listaPrecios === 3 ? t.amber+"44" : c.listaPrecios === 4 ? t.purple+"44" : t.border}`, 
                          color: c.precioManual ? t.amber : c.listaPrecios === 1 ? (t.blue||"#3b82f6") : c.listaPrecios === 2 ? t.green : c.listaPrecios === 3 ? t.amber : c.listaPrecios === 4 ? t.purple : t.text, 
                          fontWeight: 700, 
                          outline: "none", 
                          cursor: "pointer", 
                          fontFamily: "inherit", 
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 8
                        }}
                      >
                        <option value="">Sin lista</option>
                        <option value="manual">Precio Diferencial</option>
                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>Lista {n}</option>)}
                      </select>
                     </div>
                  </Td>
                  <Td style={{ fontWeight: 800, color: saldo > 0 ? t.red : saldo < 0 ? t.green : t.sub, textAlign: "right" }}>{fmtMoney(Math.abs(saldo))}</Td>
                  <Td>
                    <select
                      value={c.tipoCliente || "CC"}
                      onChange={(e: any) => handleUpdateInline(c, "tipoCliente", e.target.value, setClientes)}
                      style={{
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                        textAlign: "center",
                        borderRadius: 20,
                      }}
                      className={`tracking-wide ${
                        c.tipoCliente === "PREP"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-600/20"
                          : "bg-indigo-50 text-indigo-700 border border-indigo-600/20"
                      }`}
                    >
                      <option value="CC">Cta. Cte.</option>
                      <option value="PREP">Prepago</option>
                    </select>
                  </Td>
                  <Td>
                    <select 
                      value={autoEstado} 
                      onChange={(e: any) => handleUpdateInline(c, "estado", e.target.value, setClientes)}
                      style={{
                        background: autoEstado === "activo" ? t.green+"20" : autoEstado === "inactivo" ? t.amber+"20" : t.red+"20",
                        color: autoEstado === "activo" ? t.green : autoEstado === "inactivo" ? t.amber : t.red,
                        border: `1px solid ${autoEstado === "activo" ? t.green : autoEstado === "inactivo" ? t.amber : t.red}33`,
                        borderRadius: 20,
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                        WebkitAppearance: "none",
                        textAlign: "center"
                      }}
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                      <option value="archivado">Archivado</option>
                    </select>
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn v="ghost" onClick={() => setVerCC(c)} style={{ padding: "6px", width: 28, height: 28 }} title="Cuenta Corriente"><Ic n="cc" s={14} /></Btn>
                      <Btn v="success" onClick={() => setClienteFac(c)} style={{ padding: "6px", width: 28, height: 28 }} title="Nueva Venta"><Ic n="ventas" s={14} /></Btn>
                      <Btn v="ghost" onClick={() => handleExportarPrecioCli(c)} style={{ padding: "6px", width: 28, height: 28 }} title="Exportar lista de precios">
                        <Ic n="transfer" s={14} />
                      </Btn>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Tbl>
        </>
      )}

      {tab === "saldos" && (
        <>
          <div style={{ marginBottom: 20, padding: "12px 16px", background: t.surf2, borderRadius: 12, border: `1px solid ${t.border}`, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <Fld label="Saldo al día" style={{ marginBottom: 0, width: 220 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Inp type="date" value={fechaSaldo} onChange={(e: any) => setFechaSaldo(e.target.value)} />
              </div>
            </Fld>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
              <input type="checkbox" checked={ignorarCero} onChange={(e) => setIgnorarCero(e.target.checked)} id="ignCero" style={{ width: 16, height: 16, cursor: "pointer", accentColor: t.accent }} />
              <label htmlFor="ignCero" style={{ fontSize: 13, color: t.text, cursor: "pointer", fontWeight: 500, userSelect: "none" }}>Ignorar saldo cero</label>
            </div>
            
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <Btn v="ghost" onClick={() => {
                const total = filtradosSaldoC.reduce((sum: number, c: any) => sum + c._saldoHist, 0);
                const filas = filtradosSaldoC.map((c: any) => [c.nombre, c._saldoHist]);
                filas.push([]);
                filas.push(["TOTAL", total]);
                exportarAExcel({
                  titulo: `Saldos Clientes - al ${fechaSaldo}`,
                  columnas: ["CLIENTE", "SALDO"],
                  filas: filas,
                  fileName: `saldos_clientes_${fechaSaldo}.xlsx`,
                  sheetName: "Saldos"
                });
              }} title="Exportar">
                <Ic n="transfer" s={14}/>
              </Btn>
            </div>
          </div>

          <Tbl headers={[
            <ThSort label="CLIENTE" colKey="nombre" sortKey={sortSaldoCli} sortDir={dirSaldoCli} onSort={toggleSaldoCli} />,
            <ThSort label={`SALDO AL ${fechaSaldo}`} colKey="_saldoHist" sortKey={sortSaldoCli} sortDir={dirSaldoCli} onSort={toggleSaldoCli} align="right" />
          ]}>
            {filtradosSaldoC.map((c: any) => (
              <Tr key={c.id}>
                <Td>
                  <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                </Td>
                <Td style={{ fontWeight: 800, color: c._saldoHist > 0 ? t.red : c._saldoHist < 0 ? t.green : t.sub, textAlign: "right" }}>{fmtMoney(Math.abs(c._saldoHist))}</Td>
              </Tr>
            ))}
            {filtradosSaldoC.length > 0 && (
              <Tr style={{ background: t.surf2 }}>
                <Td style={{ fontWeight: 800, textAlign: "right" }}>TOTAL</Td>
                <Td style={{ fontWeight: 900, color: filtradosSaldoC.reduce((s:number, c:any)=>s+c._saldoHist,0) > 0 ? t.red : filtradosSaldoC.reduce((s:number, c:any)=>s+c._saldoHist,0) < 0 ? t.green : t.text, textAlign: "right" }}>
                  {fmtMoney(Math.abs(filtradosSaldoC.reduce((s:number, c:any)=>s+c._saldoHist, 0)))}
                </Td>
              </Tr>
            )}
          </Tbl>
        </>
      )}

      {verCC && (
        <ModalCC
          cliente={verCC}
          clientes={clientes}
          onClose={() => setVerCC(null)}
          ccCache={ccCache}
          ccCliente={ccCliente}
          saldoCliente={saldoCliente}
          onEditFactura={(f: any) => setClienteFac({...verCC, _editando: f})}
          {...props}
        />
      )}

      {/* Modales */}
      <ModalIngresoCli open={showIngresoCli} onClose={() => setShowIngresoCli(false)} {...props} onSwitchMasivo={() => { setShowIngresoCli(false); setShowMasivoCli(true); }} />
      <ModalMasivoCli open={showMasivoCli} onClose={() => setShowMasivoCli(false)} {...props} onSwitchIndividual={() => { setShowMasivoCli(false); setShowIngresoCli(true); }} />
      


            <OverlaySheet open={showImportarUnif} onClose={() => setShowImportarUnif(false)} title="Facturación Masiva" width="800px">
        {(()=>{
          const [tabUnif, setTabUnif] = React.useState("ventas");
          const histFacturacion = (props.historialImport||[]).filter((h: any) => h.tipo==="ventas" || h.tipo==="asignaciones" || h.tipo==="fisicos" || h.tipo==="cv");
          
          return (
            <div>
              <div style={{display:"flex",borderBottom:`1px solid ${t.border}`,marginBottom:20,marginTop:-8}}>
                {[
                  {id:"ventas",label:"Ventas Físicos"},
                  {id:"asignaciones",label:"Asignaciones Realizadas"},
                  {id:"historial",label:"Historial"}
                ].map(tb=>(
                  <button key={tb.id} onClick={()=>setTabUnif(tb.id)}
                    style={{padding:"10px 18px",border:"none",borderBottom:`2px solid ${tabUnif===tb.id?t.accent:"transparent"}`,background:"none",cursor:"pointer",fontSize:13,fontWeight:tabUnif===tb.id?700:500,color:tabUnif===tb.id?t.accent:t.sub,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",marginBottom:-1}}>
                    {tb.label}
                    {tb.id==="historial"&&histFacturacion.length>0&&<span style={{marginLeft:6,background:t.accent,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{histFacturacion.length}</span>}
                  </button>
                ))}
              </div>
              
              {tabUnif === "ventas" && <ImportarVentasCIG {...props} onClose={() => setShowImportarUnif(false)} />}
              {tabUnif === "asignaciones" && <ImportarCV {...props} onClose={() => setShowImportarUnif(false)} />}
              {tabUnif === "historial" && <TabHistorialFacturacion historial={histFacturacion} t={t} setHistorialImport={props.setHistorialImport} setFacturas={props.setFacturas} facturas={props.facturas} setArticulos={props.setArticulos} articulos={props.articulos} clientes={props.clientes} user={props.user} cloudSync={props.cloudSync} />}
            </div>
          );
        })()}
      </OverlaySheet>

      <OverlaySheet open={showHistIngresos} onClose={() => setShowHistIngresos(false)} title="Importar Cobranzas/Pagos" width="800px">
        {(()=>{
          const [tabIng, setTabIng] = React.useState("importar");
          const histIngresos = (props.historialImport||[]).filter((h: any)=>h.tipo==="ingresos");
          return (
            <div>
              {/* Tabs */}
              <div style={{display:"flex",borderBottom:`1px solid ${t.border}`,marginBottom:20,marginTop:-8}}>
                {[{id:"importar",label:"Importar"},{id:"historial",label:"Historial"}].map(tb=>(
                  <button key={tb.id} onClick={()=>setTabIng(tb.id)}
                    style={{padding:"10px 18px",border:"none",borderBottom:`2px solid ${tabIng===tb.id?t.accent:"transparent"}`,background:"none",cursor:"pointer",fontSize:13,fontWeight:tabIng===tb.id?700:500,color:tabIng===tb.id?t.accent:t.sub,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",marginBottom:-1}}>
                    {tb.label}
                    {tb.id==="historial"&&histIngresos.length>0&&<span style={{marginLeft:6,background:t.accent,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{histIngresos.length}</span>}
                  </button>
                ))}
              </div>
              {/* Contenido */}
              {tabIng==="importar"
                ? <ImportarIngresos
                    clientes={clientes} setPagos={props.setPagos} setPagosProv={props.setPagosProv}
                    setMovimientos={props.setMovimientos} setCuentas={props.setCuentas} cuentas={props.cuentas}
                    proveedores={props.proveedores} user={props.user} cloudSync={props.cloudSync}
                    historialImport={props.historialImport} setHistorialImport={props.setHistorialImport}
                  />
                : <TabHistorialIngresos
                    historial={histIngresos} t={t}
                    setHistorialImport={props.setHistorialImport} setPagos={props.setPagos}
                    setPagosProv={props.setPagosProv} setMovimientos={props.setMovimientos} setCuentas={props.setCuentas}
                    movimientos={props.movimientos} cuentas={props.cuentas} pagos={props.pagos} pagosProv={props.pagosProv} cloudSync={props.cloudSync}
                  />
              }
            </div>
          );
        })()}
      </OverlaySheet>
      <ModalImportarClientes open={showImportarCli} onClose={() => setShowImportarCli(false)} clientes={clientes} setClientes={props.setClientes} cloudSync={props.cloudSync} />

      <ModalExportacion 
        open={showExportar}
        onClose={() => setShowExportar(false)}
        tipo="clientes"
        data={clientesConAutoEstado || clientes}
        titulo="Listado de Clientes"
        fileName="clientes"
        columnas={["ID", "Nombre", "CUIT/DNI", "Teléfono", "Contacto", "Alias CV", "Domicilio", "Piso/Depto", "Localidad", "Provincia", "Lista"]}
        mapper={(c: any) => [
          c.id,
          c.nombre,
          c.cuit || "",
          c.telefono || "",
          c.personaContacto || "",
          Array.isArray(c.nombreCV) ? c.nombreCV.join(", ") : (c.nombreCV || ""),
          c.domicilio || c.direccion || "",
          c.pisoDepto || "",
          c.localidad || "",
          c.provincia || "",
          c.precioManual ? "Diferencial" : (c.listaPrecios ? `Lista ${c.listaPrecios}` : "Sin lista")
        ]}
      />

      <ModalCliente 
        open={modal} 
        onClose={() => { setModal(false); setEditando(null); }} 
        editando={editando} 
        setEditando={setEditando} 
        user={user} 
        onSave={onGuardarCliente} 
        onDelete={() => setShowEliminarCli(true)} 
      />

      <ModalConfirmarEliminacion 
        open={showEliminarCli} 
        onClose={() => setShowEliminarCli(false)} 
        onConfirm={async () => {
          await handleEliminarCliente(editando.id, setClientes);
          setShowEliminarCli(false);
          setModal(false);
          setEditando(null);
        }} 
        titulo="¿Eliminar cliente?"
        entidadNombre={editando?.nombre}
      />

      <FacturaModal 
        open={!!clienteFac} 
        onClose={() => setClienteFac(null)} 
        onFacturaEmitida={(f: any) => setFacturaReciente({ ...f, clienteRef: clienteFac })}
        cliente={clienteFac} 
        saldoCliente={saldoCliente} 
        {...props} 
      />

      {facturaReciente && (
        <FacturaVistaPrevia
          facturas={facturas}
          letra={facturaReciente.letra}
          tipoComp={facturaReciente.tipo}
          editando={facturaReciente}
          fecha={facturaReciente.fecha}
          cliente={facturaReciente.clienteRef}
          condPago={facturaReciente.condPago}
          items={facturaReciente.items || []}
          descGlobal={facturaReciente.descGlobal}
          descMonto={facturaReciente.descMonto}
          total={facturaReciente.total}
          setVistaPrevia={() => setFacturaReciente(null)}
          soloLectura={true}
        />
      )}
    </PageContainer>
  );
}
