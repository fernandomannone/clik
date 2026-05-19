import React, { useState } from "react";
import { OverlaySheet, Fld, Inp, Sel, Btn, Ic, Bdg } from "../../common/UIBase";

export default function ModalGestionConceptos({
  open,
  onClose,
  conceptos,
  setConceptos,
  cloudSync,
  t
}: any) {
  const [formConcepto, setFormConcepto] = useState({ nombre: "", tipo: "egreso" });
  const [editandoConcepto, setEditandoConcepto] = useState<any>(null);

  if (!open) return null;

  const guardarConcepto = () => {
    if (!formConcepto.nombre.trim()) return;
    if (editandoConcepto) {
      const updated = { id: editandoConcepto, ...formConcepto };
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("conceptos", updated);
      setConceptos((prev: any[]) => prev.map((c: any) => c.id === editandoConcepto ? { ...c, ...formConcepto } : c));
    } else {
      const newConcept = { id: Date.now(), nombre: formConcepto.nombre.trim(), tipo: formConcepto.tipo, activo: true };
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("conceptos", newConcept);
      setConceptos((prev: any[]) => [...prev, newConcept]);
    }
    setFormConcepto({ nombre: "", tipo: "egreso" }); 
    setEditandoConcepto(null);
  };

  return (
    <OverlaySheet open={open} onClose={() => { onClose(); setEditandoConcepto(null); }} title="Gestión de Conceptos" width={520}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", background: t.surf2, padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <Fld label="Nuevo Concepto" style={{ flex: 2 }}><Inp value={formConcepto.nombre} onChange={(e: any) => setFormConcepto({ ...formConcepto, nombre: e.target.value })} /></Fld>
        <Fld label="Tipo" style={{ flex: 1 }}>
          <Sel value={formConcepto.tipo} onChange={(e: any) => setFormConcepto({ ...formConcepto, tipo: e.target.value })}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </Sel>
        </Fld>
        <Btn onClick={guardarConcepto} style={{ marginBottom: 4 }} disabled={!formConcepto.nombre}><Ic n="plus" s={14} /> Agregar</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto", marginBottom: 24 }}>
        {conceptos.map((c: any) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: t.surf2, borderRadius: 8, border: `1px solid ${t.border}` }}>
            <div style={{ flex: 1, fontWeight: 600 }}>{c.nombre}</div>
            <Bdg color={c.tipo === "ingreso" ? t.green : t.red}>
              {c.tipo === "ingreso" ? "↑ " : "↓ "}{c.tipo}
            </Bdg>
            <Btn v="ghost" onClick={() => { setFormConcepto({ nombre: c.nombre, tipo: c.tipo }); setEditandoConcepto(c.id); }} style={{ padding: "4px 8px" }}><Ic n="edit" s={14} /></Btn>
            <Btn v="danger-ghost" onClick={() => {
              if (cloudSync?.deleteFromCloud) cloudSync.deleteFromCloud("conceptos", String(c.id));
              setConceptos((prev: any[]) => prev.filter((x: any) => x.id !== c.id));
            }} style={{ padding: "4px 8px" }}><Ic n="trash" s={14} /></Btn>
          </div>
        ))}
      </div>
    </OverlaySheet>
  );
}
