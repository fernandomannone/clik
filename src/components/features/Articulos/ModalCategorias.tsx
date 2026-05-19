import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Btn, Ic, Inp, Fld, OverlaySheet } from "../../common/UIBase";

const DEFAULT_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#0ea5e9", "#d946ef", "#84cc16", "#eab308"];

export default function ModalCategorias({ open, onClose, familias, setFamilias, articulos, setArticulos, unidadesNegocio, setUnidadesNegocio, cloudSync }: any) {
  const { t } = useApp();
  const [tab, setTab] = useState("familias"); // "familias" | "unidades"
  
  // Familias state
  const [nuevaFam, setNuevaFam] = useState("");
  const [colorPickerIdx, setColorPickerIdx] = useState<number | null>(null);
  const [confirmarFamIdx, setConfirmarFamIdx] = useState<number | null>(null);

  // Unidades state
  const [nuevaUN, setNuevaUN] = useState("");
  const [confirmarUNIdx, setConfirmarUNIdx] = useState<number | null>(null);
  const [editUNIdx, setEditUNIdx] = useState<number | null>(null);
  const [editUNName, setEditUNName] = useState("");

  const UNS = unidadesNegocio && unidadesNegocio.length > 0 ? unidadesNegocio : ["General", "Kiosco", "Cigarrillos y Tabaquería", "Carga Virtual", "Logística"];

  // -- LOGICA FAMILIAS --
  const [editFamIdx, setEditFamIdx] = useState<number | null>(null);
  const [editFamName, setEditFamName] = useState("");

  const handleAddFam = () => {
    if (!nuevaFam.trim()) return;
    const nombreNormalizado = nuevaFam.trim();
    if (familias.some((f: any) => typeof f === "string" ? f === nombreNormalizado : f.nombre === nombreNormalizado)) return;
    setFamilias([...familias, { nombre: nombreNormalizado, color: DEFAULT_COLORS[familias.length % DEFAULT_COLORS.length] }]);
    setNuevaFam("");
  };

  const saveEditFam = (idx: number) => {
    const newName = editFamName.trim();
    const oldFObj = familias[idx];
    const oldName = typeof oldFObj === "string" ? oldFObj : oldFObj.nombre;
    
    if (!newName || newName === oldName) {
      setEditFamIdx(null);
      return;
    }
    
    if (familias.some((f: any, i:number) => i !== idx && (typeof f === "string" ? f === newName : f.nombre === newName))) {
      alert("Ya existe una familia con ese nombre.");
      return;
    }

    const updated = [...familias];
    if (typeof updated[idx] === "string") {
      updated[idx] = { nombre: newName, color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length] };
    } else {
      updated[idx].nombre = newName;
    }
    setFamilias(updated);
    
    // Update articulos
    let articulosAfectados = false;
    const updArts = articulos.map((a: any) => {
      const artFam = typeof a.familia === "string" ? a.familia : a.familia?.nombre;
      if (artFam === oldName) {
         articulosAfectados = true;
         const newFamOb = typeof a.familia === "object" ? { ...a.familia, nombre: newName } : newName;
         return { ...a, familia: newFamOb };
      }
      return a;
    });
    
    if (articulosAfectados) {
      setArticulos(updArts);
      // Optional: push to cloud if cloudSync was available directly, it relies on main Articulos effect right now.
      // But Articulos effect only listens to runMigration. 
      // Luckily DataContext saves them local. To push to cloud we would need `cloudSync.saveBatchToCloud`.
    }
    
    setEditFamIdx(null);
  };

  const handleChangeUN = (idx: number, un: string) => {
    const updated = [...familias];
    if (typeof updated[idx] === "string") {
      updated[idx] = { nombre: updated[idx], color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length], unidadNegocio: un };
    } else {
      updated[idx].unidadNegocio = un;
    }
    setFamilias(updated);
  };

  const handleChangeColor = (idx: number, newColor: string) => {
    const updated = [...familias];
    if (typeof updated[idx] === "string") {
      updated[idx] = { nombre: updated[idx], color: newColor };
    } else {
      updated[idx].color = newColor;
    }
    setFamilias(updated);
    setColorPickerIdx(null);
  };

  const handleDeleteFam = async (idx: number, force = false) => {
    const fObj = familias[idx];
    const nombre = typeof fObj === "string" ? fObj : fObj.nombre;
    const enUso = articulos.some((a: any) => (typeof a.familia === "string" ? a.familia : a.familia?.nombre) === nombre);
    if (enUso && !force) {
      setConfirmarFamIdx(idx);
      return;
    }
    if (enUso && force) {
      if (setArticulos) {
        const modificados: any[] = [];
        const nuevosArticulos = articulos.map((a: any) => {
          if ((typeof a.familia === "string" ? a.familia : a.familia?.nombre) === nombre) {
            const nuevoA = { ...a, familia: "" };
            modificados.push(nuevoA);
            return nuevoA;
          }
          return a;
        });
        setArticulos(nuevosArticulos);
        
        if (cloudSync?.saveBatchToCloud && modificados.length > 0) {
          await cloudSync.saveBatchToCloud("articulos", modificados);
        }
      }
    }
    const updated = [...familias];
    updated.splice(idx, 1);
    setFamilias(updated);
    setConfirmarFamIdx(null);
  };

  // -- LOGICA UNIDADES DE NEGOCIO --
  const handleAddUN = () => {
    if (!nuevaUN.trim()) return;
    const nombreNormalizado = nuevaUN.trim();
    if (UNS.includes(nombreNormalizado)) return;
    setUnidadesNegocio([...UNS, nombreNormalizado]);
    setNuevaUN("");
  };

  const saveEditUN = (idx: number) => {
    const nombreNormalizado = editUNName.trim();
    if (!nombreNormalizado || nombreNormalizado === UNS[idx]) {
      setEditUNIdx(null);
      return;
    }
    if (UNS.includes(nombreNormalizado)) {
      alert("Ya existe una Unidad de Negocio con ese nombre.");
      return;
    }
    const oldName = UNS[idx];
    const updated = [...UNS];
    updated[idx] = nombreNormalizado;
    setUnidadesNegocio(updated);
    
    // Si la unidad de negocio tenia familias asociadas, actualizarlas
    let familiasActualizadas = false;
    const updFamilias = familias.map((f: any) => {
      if (typeof f === "object" && f.unidadNegocio === oldName) {
        familiasActualizadas = true;
        return { ...f, unidadNegocio: nombreNormalizado };
      }
      return f;
    });
    if (familiasActualizadas) {
      setFamilias(updFamilias);
    }
    
    setEditUNIdx(null);
  };

  const confirmDeleteUN = (idx: number) => {
    const unAEliminar = UNS[idx];
    const enUso = familias.some((f: any) => typeof f === "object" && f.unidadNegocio === unAEliminar);
    if(enUso) {
      alert("No podés eliminar esta U.N. porque tiene familias asociadas.");
      setConfirmarUNIdx(null);
      return;
    }
    const updated = UNS.filter((_: any, i: number) => i !== idx);
    setUnidadesNegocio(updated);
    setConfirmarUNIdx(null);
  };

  if (!open) return null;

  return (
    <OverlaySheet open={open} onClose={onClose} title="Gestión de Categorías" width="550px">
      
      {/* TABS */}
      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${t.border}`, paddingBottom: 16, marginBottom: 20 }}>
        <button 
          onClick={() => setTab("familias")} 
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: tab === "familias" ? t.accentBg : "transparent", color: tab === "familias" ? t.accent : t.muted }}
        >
          Familias
        </button>
        <button 
          onClick={() => setTab("unidades")} 
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: tab === "unidades" ? t.accentBg : "transparent", color: tab === "unidades" ? t.accent : t.muted }}
        >
          Unidades de Negocio
        </button>
      </div>

      {tab === "familias" ? (
        <>
          <div style={{ display: "flex", gap: 12, background: t.surf2, padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <Inp placeholder="Nueva familia..." value={nuevaFam} onChange={(e: any) => setNuevaFam(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && handleAddFam()} />
            </div>
            <Btn onClick={handleAddFam} disabled={!nuevaFam.trim()}><Ic n="plus" s={14} /> Agregar</Btn>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {familias.map((f: any, i: number) => {
              const nombre = typeof f === "string" ? f : f.nombre;
              const color = typeof f === "string" ? DEFAULT_COLORS[i % DEFAULT_COLORS.length] : f.color;
              const numArticulos = articulos.filter((a: any) => (typeof a.familia === "string" ? a.familia : a.familia?.nombre) === nombre).length;
              
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", background: t.surf2, borderRadius: 8, border: `1px solid ${t.border}`, position: "relative" }}>
                  <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
                      <div 
                        onClick={() => setColorPickerIdx(colorPickerIdx === i ? null : i)}
                        style={{ width: 24, height: 24, borderRadius: 6, background: color, cursor: "pointer", border: `1px solid rgba(0,0,0,0.1)`, flexShrink: 0 }} 
                        title="Cambiar color"
                      />
                      
                      {colorPickerIdx === i && (
                        <div style={{ position: "absolute", top: 44, left: 16, background: t.surf, border: `1px solid ${t.border}`, borderRadius: 8, padding: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: 100, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, animation: "scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                           {DEFAULT_COLORS.map(c => (
                             <div key={c} onClick={() => handleChangeColor(i, c)} style={{ width: 24, height: 24, borderRadius: 4, background: c, cursor: "pointer", border: color === c ? `2px solid ${t.text}` : "1px solid rgba(0,0,0,0.1)" }} />
                           ))}
                        </div>
                      )}

                      {editFamIdx === i ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                            <input 
                              value={editFamName} 
                              onChange={(e: any) => setEditFamName(e.target.value)} 
                              onKeyDown={(e: any) => { if (e.key === "Enter") saveEditFam(i); }}
                              style={{ background: t.surf, border: `1px solid ${t.border}`, outline: "none", fontSize: 13, fontWeight: 600, color: t.text, minWidth: 100, flex: 1, padding: "4px 8px", borderRadius: 4 }}
                              autoFocus
                            />
                            <button onClick={() => saveEditFam(i)} style={{ background: t.greenBg, border: `1px solid ${t.green}44`, color: t.green, borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>
                              <Ic n="check" s={14} />
                            </button>
                          </div>
                      ) : (
                          <>
                              <div style={{ fontSize: 15, fontWeight: 600, color: t.text, minWidth: 100, flex: 1 }}>{nombre}</div>
                              <button onClick={() => { setEditFamIdx(i); setEditFamName(nombre); }} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", padding: 4 }} title="Editar nombre">
                                <Ic n="edit" s={14} />
                              </button>
                          </>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <select
                        value={typeof f === "object" && f.unidadNegocio ? f.unidadNegocio : ""}
                        onChange={(e) => handleChangeUN(i, e.target.value)}
                        style={{
                          background: t.surf, border: `1px solid ${t.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 12, color: t.text, outline: "none", cursor: "pointer", maxWidth: 120
                        }}
                      >
                        <option value="">(Sin U.N.)</option>
                        {UNS.map(un => (
                           <option key={un} value={un}>{un}</option>
                        ))}
                      </select>
                      <div style={{ fontSize: 12, color: t.sub, width: 40, textAlign: "right" }}>{numArticulos} a.</div>
                      <button 
                        onClick={() => handleDeleteFam(i)} 
                        style={{ background: "none", border: "none", cursor: "pointer", color: t.red }}
                      >
                        <Ic n="close" s={18} />
                      </button>
                    </div>
                  </div>

                  {confirmarFamIdx === i && (
                    <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}`, background: t.red + "11", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: "0 0 8px 8px" }}>
                      <div style={{ fontSize: 13, color: t.sub, lineHeight: 1.4 }}>
                        <strong style={{color:t.text}}>¿Eliminar familia?</strong> Hay {numArticulos} artículos asignados.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn v="ghost" type="button" onClick={() => setConfirmarFamIdx(null)} style={{ padding: "6px 10px", fontSize: 12 }}>Cancelar</Btn>
                        <Btn v="danger" type="button" onClick={() => handleDeleteFam(i, true)} style={{ padding: "6px 10px", fontSize: 12 }}>Sí, eliminar</Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, background: t.surf2, padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Inp 
              placeholder="Nueva Unidad de Negocio..." 
              value={nuevaUN} 
              onChange={(e: any) => setNuevaUN(e.target.value)} 
              onKeyDown={(e: any) => { if (e.key === "Enter") handleAddUN(); }}
              style={{ flex: 1 }}
            />
            <Btn onClick={handleAddUN} disabled={!nuevaUN.trim()}><Ic n="plus" s={14} /> Agregar</Btn>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {UNS.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: t.muted, fontWeight: 500, fontSize: 13, border: `1px dashed ${t.border}`, borderRadius: 12 }}>
                No hay unidades de negocio registradas
              </div>
            ) : (
              UNS.map((un: string, i: number) => {
                const numFamilias = familias.filter((f: any) => typeof f === "object" && f.unidadNegocio === un).length;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", background: t.surf2, borderRadius: 8, border: `1px solid ${t.border}`, position: "relative" }}>
                    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      {editUNIdx === i ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                          <Inp 
                            value={editUNName} 
                            onChange={(e: any) => setEditUNName(e.target.value)} 
                            onKeyDown={(e: any) => { if (e.key === "Enter") saveEditUN(i); }}
                            style={{ flex: 1 }}
                            autoFocus
                          />
                          <button onClick={() => saveEditUN(i)} style={{ background: t.greenBg, border: `1px solid ${t.green}44`, color: t.green, borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>
                            <Ic n="check" s={14} />
                          </button>
                          <button onClick={() => setEditUNIdx(null)} style={{ background: "transparent", border: "1px solid transparent", color: t.muted, cursor: "pointer" }}>
                            <Ic n="x" s={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{un}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ fontSize: 12, color: t.sub }}>{numFamilias} familias asociadas</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button 
                                onClick={() => { setEditUNIdx(i); setEditUNName(un); }} 
                                style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", padding: 4 }}
                                title="Editar nombre"
                              >
                                <Ic n="edit" s={14} />
                              </button>
                              <button 
                                onClick={() => setConfirmarUNIdx(i)} 
                                style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", padding: 4 }}
                                title="Eliminar"
                              >
                                <Ic n="trash" s={14} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {confirmarUNIdx === i && (
                      <div style={{ padding: "12px 16px", background: t.red + "15", borderTop: `1px solid ${t.red}44`, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "0 0 8px 8px" }}>
                        <div style={{ fontSize: 13, color: t.red, fontWeight: 600 }}>¿Confirmás la eliminación?</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn v="ghost" onClick={() => setConfirmarUNIdx(null)} style={{ color: t.text }}>Cancelar</Btn>
                          <Btn v="danger" onClick={() => confirmDeleteUN(i)}>Eliminar</Btn>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </OverlaySheet>
  );
}