import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Tbl, Tr, Td, Bdg, Btn, Ic, SearchBar, Fld, Inp, Sel, DropDown, DropDownItem } from "../../common/UIBase";
import { PageContainer } from "../../layout/AppShell";
import { fmtMoney, fmtNum, normalizar, precioLista, parseMoney } from "../../../lib/utils";

import ValorizacionStock from "./ValorizacionStock";
import ModalKardex from "./ModalKardex";
import ModalAjusteStock from "./ModalAjusteStock";
import ControlStock from "./ControlStock";
import { exportarAExcel } from "../../../lib/excelExport";
import { ModalExportacion } from "../../common/ModalExportacion";
import ModalEditarArticulo from "./ModalEditarArticulo";
import ModalCategorias from "./ModalCategorias";
import { runMigration } from "./updateArticulos";

function InlinePriceInput({ a, lista, onSave, t }: { a: any, lista: number, onSave: (p: any) => void, t: any }) {
  const precioActual = precioLista(a, lista);
  const [val, setVal] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setVal(fmtMoney(precioActual));
  }, [precioActual, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseMoney(val);
    if (parsed !== precioActual) {
      const payload: any = { id: a.id, [`precio${lista}`]: String(parsed) };
      
      const costo = parseFloat(a.costo) || 0;
      if (costo > 0) {
        const util = [...(a.utilidad || [0, 0, 0, 0])];
        util[lista - 1] = parseFloat((((parsed / costo) - 1) * 100).toFixed(2));
        payload.utilidad = util;
      }
      
      onSave(payload);
    } else {
      setVal(fmtMoney(precioActual));
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter") e.target.blur();
    if (e.key === "Escape") {
      setEditing(false);
      setVal(fmtMoney(precioActual));
    }
  };

  return (
    <input
      type="text"
      value={editing ? val : fmtMoney(precioActual)}
      onFocus={() => { setEditing(true); setVal(String(precioActual || 0)); }}
      onBlur={commit}
      onChange={e => setVal(e.target.value)}
      onKeyDown={handleKeyDown}
      style={{
        width: 70,
        background: editing ? t.surf2 : "transparent",
        color: editing ? t.text : (precioActual > 0 ? t.text : t.sub),
        fontWeight: precioActual > 0 ? 600 : 400,
        border: editing ? `1px solid ${t.border}` : "1px solid transparent",
        borderRadius: 4,
        padding: "2px 4px",
        outline: "none",
        textAlign: "right",
        transition: "all 0.2s"
      }}
      className={!editing ? "hover:bg-slate-50" : ""}
    />
  );
}

export default function Articulos({ articulos = [], setArticulos, familias = [], setFamilias, unidadesNegocio = [], setUnidadesNegocio = () => {}, proveedores = [], cloudSync, user, kardex = [] }: any) {
  const { t } = useApp();
  const canVerCostos = user?.rol === "maestro" || user?.permisos?.costos;
  const [tab, setTab] = useState("maestro");
  const [busq, setBusq] = useState("");
  const [filtFamilia, setFiltFamilia] = useState("Todas");
  const [filtProveedor, setFiltProveedor] = useState("Todos");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [ajustandoStock, setAjustandoStock] = useState<any>(null);
  const [verKardex, setVerKardex] = useState<any>(null);
  const [showArchivados, setShowArchivados] = useState(false);
  const [showFamilias, setShowFamilias] = useState(false);
  
  const [sortBy, setSortBy] = useState<string>("nombre");
  const [sortOrder, setSortOrder] = useState<"asc"|"desc">("asc");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showExportar, setShowExportar] = useState(false);

  useEffect(() => {
    if (articulos && articulos.length > 0 && !localStorage.getItem("mig_arts_abril_26")) {
      const { changed, newArts } = runMigration(articulos);
      if (changed) {
        setArticulos(newArts);
        if (cloudSync?.saveToCloud) {
          newArts.forEach((na: any) => {
            const original = articulos.find((o: any) => o.id === na.id);
            if (original && JSON.stringify(original) !== JSON.stringify(na)) {
              cloudSync.saveToCloud("articulos", na);
            }
          });
        }
      }
      localStorage.setItem("mig_arts_abril_26", "1");
    }
  }, [articulos, cloudSync, setArticulos]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const RenderSortHeader = (label: string, key: string) => ( // eslint-disable-line
    <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort(key)}>
      {label}
      {sortBy === key && <Ic n={sortOrder === "asc" ? "chevron-up" : "chevron-down"} s={12} />}
    </div>
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busq);
    let filtrado = articulos.filter((a: any) => {
      if (!a) return false;
      const isArchivado = a.estado === "archivado";
      if (showArchivados ? !isArchivado : isArchivado) return false;
      if (filtFamilia !== "Todas") {
        const famName = typeof a.familia === "string" ? a.familia : a.familia?.nombre || "";
        if (famName !== filtFamilia) return false;
      }
      if (filtProveedor !== "Todos") {
        const pVal = a.proveedor ?? a.proveedorId;
        const provId = typeof a.proveedor === "object" ? String(a.proveedor?.id || "0") : String(pVal || "0");
        if (provId !== filtProveedor) return false;
      }
      return normalizar(a.nombre || "").includes(q) || (a.codigo || "").toLowerCase().includes(q);
    });

    return filtrado.sort((a: any, b: any) => {
      if (!a || !b) return 0;
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === "familia") {
        valA = typeof a.familia === "string" ? a.familia : a.familia?.nombre || "";
        valB = typeof b.familia === "string" ? b.familia : b.familia?.nombre || "";
      } else if (sortBy === "nombre") {
        valA = a.nombre || "";
        valB = b.nombre || "";
      } else if (sortBy === "codigo") {
        valA = a.codigo || "";
        valB = b.codigo || "";
      } else if (sortBy === "costo") {
        valA = Number(a.costo) || 0;
        valB = Number(b.costo) || 0;
      } else if (sortBy === "stock") {
        valA = Number(a.stock) || 0;
        valB = Number(b.stock) || 0;
      } else if (sortBy === "estado") {
        valA = a.estado || "activo";
        valB = b.estado || "activo";
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB, "es") : valB.localeCompare(valA, "es");
      } else {
        return sortOrder === "asc" ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
      }
    });
  }, [articulos, busq, showArchivados, sortBy, sortOrder, filtFamilia, filtProveedor]);

  const inlineSave = (payload: any) => {
    const art = articulos.find((a: any) => a.id === payload.id);
    if (art && cloudSync?.saveToCloud) {
      cloudSync.saveToCloud("articulos", { ...art, ...payload });
    }
    setArticulos((prev: any) => prev.map((a: any) => a.id === payload.id ? { ...a, ...payload } : a));
  };

  const handleSave = (payload: any) => {
    const nuevo = {
      id: editando ? editando.id : Date.now(),
      ...payload,
      estado: payload.estado || "activo"
    };

    if (editando) {
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("articulos", nuevo);
      setArticulos(articulos.map((a: any) => a.id === editando.id ? { ...a, ...nuevo } : a));
    }
    else {
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("articulos", nuevo);
      setArticulos([...articulos, nuevo]);
    }
    
    setModal(false);
    setEditando(null);
  };

  const getF = (f: any) => {
    if (!f) return "";
    return typeof f === "string" ? f : f.nombre || "";
  };
  const getFColor = (fname: string) => {
    if (!fname) return t.purple;
    const fObj = (familias || []).find((f: any) => getF(f) === fname);
    return fObj && fObj.color ? fObj.color : t.purple;
  };

  const handleExportarPrecios = (listaNum: number) => {
    const activeArts = articulos
      .filter((a: any) => {
        if (!a) return false;
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
        if (["046", "100", "668", "007", "666", "999", "667"].includes(cod)) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        const famA = typeof a.familia === 'string' ? a.familia : a.familia?.nombre || "";
        const famB = typeof b.familia === 'string' ? b.familia : b.familia?.nombre || "";
        if (famA === famB) return (a.nombre || "").localeCompare(b.nombre || "");
        return famA.localeCompare(famB);
      });

    const filas = activeArts.map((a: any) => [
      a.codigo || "",
      a.nombre || "",
      precioLista(a, listaNum)
    ]);

    exportarAExcel({
      titulo: `Lista de Precios ${listaNum}`,
      columnas: ["Codigo de art.", "Artículo", "Precio"],
      filas: filas,
      fileName: `Lista_de_precios_${listaNum}.xlsx`,
      sheetName: "Precios"
    });
    setExportMenuOpen(false);
  };

  const totalesA = { 
    activos: (articulos || []).filter((p: any) => p && (p.estado === "activo" || !p.estado)).length,
    inactivos: (articulos || []).filter((p: any) => p && p.estado === "inactivo").length,
    archivados: (articulos || []).filter((p: any) => p && p.estado === "archivado").length 
  };
  const subTextA = <div style={{display:"flex", gap:15, alignItems:"center", fontSize:12, marginTop:4}}>
    <span><b>{articulos.length}</b> total</span>
    <span style={{color:t.green}}><b>{totalesA.activos}</b> activos</span>
    {totalesA.inactivos > 0 && <span style={{color:"#f59e0b"}}><b>{totalesA.inactivos}</b> inactivos</span>}
    {totalesA.archivados > 0 && <span style={{color:t.muted}}><b>{totalesA.archivados}</b> archivados</span>}
  </div>;

  return (
    <PageContainer 
      title="Artículos" 
      sub={subTextA}
      stickyHeader={false}
      actions={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Btn onClick={() => { setEditando(null); setModal(true); }} style={{ height: 38 }}><Ic n="plus" s={14} /> Nuevo artículo</Btn>

          <DropDown 
             trigger={<Btn v="ghost" style={{ height: 38, padding: "0 10px" }} title="Opciones"><Ic n="dots" s={18} /></Btn>}
             align="right"
          >
             <DropDownItem icon="config" onClick={() => setShowFamilias(true)}>Categorías (Fam. y U.N.)</DropDownItem>
             <DropDownItem icon="transfer" onClick={() => setShowExportar(true)}>Exportar Artículos</DropDownItem>
             <div style={{ borderTop: `1px solid ${t.border}`, margin: "4px 0" }} />
             {[1, 2, 3, 4].map(l => (
               <DropDownItem key={l} icon="articulos" onClick={() => handleExportarPrecios(l)}>Lista de Precios {l}</DropDownItem>
             ))}
          </DropDown>
        </div>
      }
      extraHeader={
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 10, borderBottom: `1px solid ${t.border}` }}>
            {["maestro", "valorizacion", "control"].map(tId => (
              <button key={tId} onClick={() => setTab(tId)} style={{ padding: "10px 20px", border: "none", borderBottom: `2px solid ${tab === tId ? t.accent : "transparent"}`, background: "none", color: tab === tId ? t.accent : t.sub, fontWeight: tab === tId ? 700 : 500, cursor: "pointer", fontSize: "14px" }}>
                {tId === "maestro" ? "Catálogo" : tId === "valorizacion" ? "Valorización" : "Control de Stock"}
              </button>
            ))}
          </div>
          {tab === "maestro" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
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
              <div style={{ display: "flex", gap: 6, marginTop: -6, marginBottom: 16, width: "calc(100% - 44px)" }}>
                <Sel value={filtFamilia} onChange={(e: any) => setFiltFamilia(e.target.value)} style={{ padding: "2px 8px", fontSize: 11, height: 28, flex: 1, minWidth: 0 }}>
                  <option value="Todas">Todas las familias</option>
                  {familias?.map((f: any) => { 
                    if (!f) return null;
                    const n = typeof f === "string" ? f : f.nombre || ""; 
                    if (!n) return null;
                    return <option key={n} value={n}>{n}</option>; 
                  })}
                </Sel>
                <Sel value={filtProveedor} onChange={(e: any) => setFiltProveedor(e.target.value)} style={{ padding: "2px 8px", fontSize: 11, height: 28, flex: 1, minWidth: 0 }}>
                  <option value="Todos">Todos los prov.</option>
                  <option value="0">Sin Proveedor</option>
                  {proveedores?.filter((p: any) => p && p.estado !== "archivado").map((p: any) => <option key={p.id} value={p.id}>{p.nombre || "Sin nombre"}</option>)}
                </Sel>
              </div>
            </div>
          )}
        </div>
      }
    >
      {tab === "maestro" && (
        <>
          <Tbl headers={[
            RenderSortHeader("Artículo", "nombre"), 
            RenderSortHeader("Código", "codigo"), 
            RenderSortHeader("Familia", "familia"), 
            ...(canVerCostos ? [RenderSortHeader("Costo", "costo")] : []), 
            "L1", "L2", "L3", "L4",
            RenderSortHeader("Stock", "stock"), 
            RenderSortHeader("Estado", "estado"), 
            "Acciones"
          ]}>
            {filtrados.map((a: any) => {
              const bajoStock = a.minimo > 0 && a.stock <= a.minimo;
              return (
                <Tr key={a.id} onDoubleClick={() => { setEditando(a); setModal(true); }} style={{ opacity: a.estado === "archivado" ? 0.4 : 1 }}>
                  <Td><div style={{ fontWeight: 700 }}>{a.nombre}</div></Td>
                  <Td style={{ fontFamily: "monospace", color: t.muted }}>{a.codigo || "—"}</Td>
                  <Td><Bdg color={getFColor(a.familia)}>{getF(a.familia) || "—"}</Bdg></Td>
                  {canVerCostos && <Td style={{ color: t.sub }}>{fmtMoney(a.costo)}</Td>}
                  <Td><InlinePriceInput a={a} lista={1} onSave={inlineSave} t={t} /></Td>
                  <Td><InlinePriceInput a={a} lista={2} onSave={inlineSave} t={t} /></Td>
                  <Td><InlinePriceInput a={a} lista={3} onSave={inlineSave} t={t} /></Td>
                  <Td><InlinePriceInput a={a} lista={4} onSave={inlineSave} t={t} /></Td>
                  <Td style={{ fontWeight: 800, color: bajoStock ? t.red : t.green }}>{fmtNum(a.stock)}</Td>
                  <Td><Bdg color={(a.estado || "activo") === "activo" ? t.green : t.muted}>{(a.estado || "activo")}</Bdg></Td>
                  <Td>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(user?.rol === "maestro" || user?.permisos?.ajustarStock) && <Btn v="ghost" onClick={() => { setAjustandoStock(a); }} style={{ padding: "6px", minWidth: "auto" }} title="Ajuste de Stock"><Ic n="caja" s={14} /></Btn>}
                      <Btn v="ghost" onClick={() => { setVerKardex(a); }} style={{ padding: "6px", minWidth: "auto" }} title="Kardex"><Ic n="stats" s={14} /></Btn>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Tbl>
        </>
      )}

      {tab === "valorizacion" && (
        <ValorizacionStock articulos={articulos} kardex={kardex || []} canVerCostos={canVerCostos} />
      )}

      {tab === "control" && (
        <ControlStock articulos={articulos} setArticulos={setArticulos} canVerCostos={canVerCostos} user={user} />
      )}

      <ModalEditarArticulo 
        open={modal} 
        onClose={() => setModal(false)} 
        articulo={editando} 
        onSave={handleSave} 
        onDelete={() => {
          setArticulos(articulos.filter((a: any) => String(a.id) !== String(editando.id)));
          if (cloudSync?.deleteFromCloud) cloudSync.deleteFromCloud("articulos", editando.id);
          setModal(false);
          setEditando(null);
        }}
        familias={familias} 
        proveedores={proveedores} 
        user={user}
      />
      <ModalAjusteStock open={!!ajustandoStock} onClose={() => setAjustandoStock(null)} articulo={ajustandoStock} setArticulos={setArticulos} />
      <ModalCategorias 
        open={showFamilias} 
        onClose={() => setShowFamilias(false)} 
        familias={familias} 
        setFamilias={setFamilias} 
        unidadesNegocio={unidadesNegocio} 
        setUnidadesNegocio={setUnidadesNegocio} 
        articulos={articulos} 
        setArticulos={setArticulos} 
        cloudSync={cloudSync} 
      />

      <ModalKardex open={!!verKardex} onClose={() => setVerKardex(null)} articulo={verKardex} kardex={kardex || []} />

      <ModalExportacion 
        open={showExportar}
        onClose={() => setShowExportar(false)}
        tipo="articulos"
        data={articulos}
        titulo="Listado de Artículos"
        fileName="articulos"
        columnas={["Código", "Nombre", "Familia", "Proveedor", "Costo", "U.N.", "Mínimo", "L1", "L2", "L3", "L4", "Utilidad 1 (%)", "Utilidad 2 (%)", "Utilidad 3 (%)", "Utilidad 4 (%)", "Stock"]}
        mapper={(a: any) => {
          const pVal = a.proveedor ?? a.proveedorId;
          const provNombre = typeof a.proveedor === "object" ? a.proveedor?.nombre : 
                            (proveedores.find((p:any)=>String(p.id)===String(pVal))?.nombre || "—");
          const fam = typeof a.familia === "string" ? a.familia : a.familia?.nombre || "";
          const utils = a.utilidad || [0,0,0,0];
          
          return [
            a.codigo || "",
            a.nombre || "",
            fam,
            provNombre,
            a.costo || 0,
            a.unidadNegocio || "",
            a.minimo || 0,
            precioLista(a, 1),
            precioLista(a, 2),
            precioLista(a, 3),
            precioLista(a, 4),
            utils[0] || 0,
            utils[1] || 0,
            utils[2] || 0,
            utils[3] || 0,
            a.stock || 0
          ];
        }}
      />
    </PageContainer>
  );
}
