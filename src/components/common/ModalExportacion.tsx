import React, { useState, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { Fld, Sel, Btn, Ic, OverlaySheet, Inp } from "./UIBase";
import { exportarAExcel } from "../../lib/excelExport";

interface ModalExportacionProps {
  open: boolean;
  onClose: () => void;
  tipo: "clientes" | "proveedores" | "articulos";
  data: any[];
  columnas: string[];
  mapper: (item: any) => any[];
  titulo: string;
  fileName: string;
}

export function ModalExportacion({
  open,
  onClose,
  tipo,
  data,
  columnas,
  mapper,
  titulo,
  fileName
}: ModalExportacionProps) {
  const { t } = useApp();
  const [estado, setEstado] = useState("todos");
  const [provincia, setProvincia] = useState("Todas");
  const [familia, setFamilia] = useState("Todas");

  const provinciasDisponibles = useMemo(() => {
    const s = new Set<string>();
    data.forEach(item => { if (item.provincia) s.add(item.provincia); });
    return Array.from(s).sort();
  }, [data]);

  const familiasDisponibles = useMemo(() => {
    const s = new Set<string>();
    data.forEach(item => { 
      const f = typeof item.familia === "string" ? item.familia : item.familia?.nombre;
      if (f) s.add(f); 
    });
    return Array.from(s).sort();
  }, [data]);

  const filtrados = useMemo(() => {
    return data.filter(item => {
      // Filtro de estado
      if (estado !== "todos") {
        const estActual = item.autoEstado || item.estado || "activo";
        if (estado === "activos" && estActual !== "activo") return false;
        if (estado === "inactivos" && estActual !== "inactivo") return false;
        if (estado === "archivados" && estActual !== "archivado") return false;
      }

      // Filtro de provincia (para clientes y proveedores)
      if ((tipo === "clientes" || tipo === "proveedores") && provincia !== "Todas") {
        if (item.provincia !== provincia) return false;
      }

      // Filtro de familia (para artículos)
      if (tipo === "articulos" && familia !== "Todas") {
        const itemFam = typeof item.familia === "string" ? item.familia : item.familia?.nombre;
        if (itemFam !== familia) return false;
      }

      return true;
    });
  }, [data, estado, provincia, familia, tipo]);

  const handleExport = () => {
    const filas = filtrados.map(mapper);
    exportarAExcel({
      titulo: `${titulo} (${estado === "todos" ? "Todos" : estado})`,
      columnas,
      filas,
      fileName: `${fileName}_${new Date().toISOString().split('T')[0]}`,
      sheetName: "Datos"
    });
    onClose();
  };

  return (
    <OverlaySheet open={open} onClose={onClose} title={`Exportar ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`} width="450px">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <p style={{ fontSize: 14, color: t.sub }}>Selecciona los filtros para la exportación a Excel.</p>
        
        <Fld label="Estado">
          <Sel value={estado} onChange={(e: any) => setEstado(e.target.value)}>
            <option value="todos">Todos (incluye archivados)</option>
            <option value="activos">Sólo Activos</option>
            <option value="inactivos">Sólo Inactivos</option>
            <option value="archivados">Sólo Archivados</option>
          </Sel>
        </Fld>

        {(tipo === "clientes" || tipo === "proveedores") && (
          <Fld label="Provincia">
            <Sel value={provincia} onChange={(e: any) => setProvincia(e.target.value)}>
              <option value="Todas">Todas las provincias</option>
              {provinciasDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
            </Sel>
          </Fld>
        )}

        {tipo === "articulos" && (
          <Fld label="Familia / Categoría">
            <Sel value={familia} onChange={(e: any) => setFamilia(e.target.value)}>
              <option value="Todas">Todas las categorías</option>
              {familiasDisponibles.map(f => <option key={f} value={f}>{f}</option>)}
            </Sel>
          </Fld>
        )}

        <div style={{ background: t.surf2, padding: 16, borderRadius: 12, border: `1px solid ${t.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: t.accent }}>{filtrados.length}</div>
          <div style={{ fontSize: 12, color: t.sub, fontWeight: 600 }}>Elementos a exportar</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <Btn v="ghost" onClick={onClose} full>Cancelar</Btn>
          <Btn onClick={handleExport} full disabled={filtrados.length === 0}>
            <Ic n="transfer" s={14} /> Exportar ahora
          </Btn>
        </div>
      </div>
    </OverlaySheet>
  );
}
