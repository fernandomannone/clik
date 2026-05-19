import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Btn, Ic, Fld, Bdg, OverlaySheet } from "../../common/UIBase";
import { fmtMoney } from "../../../lib/utils";
import XLSX from "xlsx-js-style";

export default function ModalImportarArticulos({ open, onClose, articulos, setArticulos, familias, setFamilias, proveedores, cloudSync }: any) {
  const { t } = useApp();
  const [paso, setPaso] = useState(1); // 1=subir, 2=mapear, 3=preview
  const [filas, setFilas] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapeo, setMapeo] = useState<any>({});
  const [preview, setPreview] = useState<any[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [importados, setImportados] = useState(0);
  const [actualizadosCount, setActualizadosCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const CAMPOS = [
    { key: "codigo", label: "Código", req: false },
    { key: "nombre", label: "Nombre", req: true },
    { key: "familia", label: "Familia", req: false },
    { key: "proveedor", label: "Proveedor", req: false },
    { key: "costo", label: "Costo", req: false },
    { key: "precio1", label: "Precio Lista 1", req: false },
    { key: "precio2", label: "Precio Lista 2", req: false },
    { key: "precio3", label: "Precio Lista 3", req: false },
    { key: "precio4", label: "Precio Lista 4", req: false },
    { key: "stock", label: "Stock inicial", req: false },
  ];

  const detectar = (hdrs: string[]) => {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const mapa: any = {};
    hdrs.forEach(h => {
      const n = norm(h);
      if (/^cod|codigo|cod\.?$|code/.test(n)) mapa.codigo = mapa.codigo || h;
      else if (/denominacion|nombre|descripcion|articulo|producto|item/.test(n)) mapa.nombre = mapa.nombre || h;
      else if (/familia|rubro|categoria|cat/.test(n)) mapa.familia = mapa.familia || h;
      else if (/proveedor|supplier/.test(n)) mapa.proveedor = mapa.proveedor || h;
      else if (n === "precio de compra" || /costo|cost|compra/.test(n)) mapa.costo = mapa.costo || h;
      else if (n === "precio de lista 1" || (!n.includes("utilidad") && /lista.*1|precio.*1|list.*1|p1/.test(n))) mapa.precio1 = mapa.precio1 || h;
      else if (n === "precio de lista 2" || (!n.includes("utilidad") && /lista.*2|precio.*2|list.*2|p2/.test(n))) mapa.precio2 = mapa.precio2 || h;
      else if (n === "precio de lista 3" || (!n.includes("utilidad") && /lista.*3|precio.*3|list.*3|p3/.test(n))) mapa.precio3 = mapa.precio3 || h;
      else if (n === "precio de lista 4" || (!n.includes("utilidad") && /lista.*4|precio.*4|list.*4|p4/.test(n))) mapa.precio4 = mapa.precio4 || h;
      else if (/stock|existencia|cantidad/.test(n)) mapa.stock = mapa.stock || h;
    });
    return mapa;
  };

  const parsearArchivo = async (file: any) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[]) as any[];
    if (rows.length < 2) return;
    let headerRow = 0;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const noVacias = rows[i].filter((c: any) => String(c).trim() !== "").length;
      if (noVacias >= 3) { headerRow = i; break; }
    }
    const hdrs = rows[headerRow].map((h: any) => String(h || "").trim());
    const data = (rows as any[]).slice(headerRow + 1).filter(r => r.some((c: any) => String(c).trim() !== ""));
    setHeaders(hdrs);
    setFilas(data);
    setMapeo(detectar(hdrs));
    setPaso(2);
  };

  const val = (fila: any, campo: string) => {
    const col = mapeo[campo];
    if (!col) return "";
    const idx = headers.indexOf(col);
    return idx >= 0 ? String(fila[idx] || "").trim() : "";
  };

  const parseMoney = (s: any) => {
    const n = parseFloat(String(s).replace(/[^0-9.,]/g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };

  const generarPreview = () => {
    if (!mapeo.nombre) return;
    const nuevasFamilias = new Set();
    const errs: string[] = [];
    const items = filas.map((fila, i) => {
      const nombre = val(fila, "nombre");
      if (!nombre) { errs.push(`Fila ${i + 2}: sin nombre`); return null; }
      const familia = val(fila, "familia") || familias[0] || "Varios";
      if (!familias.includes(familia)) nuevasFamilias.add(familia);
      const prov: any = proveedores.find((p: any) => p.nombre.toLowerCase() === val(fila, "proveedor").toLowerCase());
      return {
        nombre, familia,
        codigo: val(fila, "codigo"),
        proveedorId: prov?.id || null,
        costo: parseMoney(val(fila, "costo")),
        precio1: val(fila, "precio1") ? String(parseMoney(val(fila, "precio1"))) : "",
        precio2: val(fila, "precio2") ? String(parseMoney(val(fila, "precio2"))) : "",
        precio3: val(fila, "precio3") ? String(parseMoney(val(fila, "precio3"))) : "",
        precio4: val(fila, "precio4") ? String(parseMoney(val(fila, "precio4"))) : "",
        utilidad: [],
        stock: parseMoney(val(fila, "stock")) || 0,
        minimo: 0,
        estado: "activo",
        _nuevaFamilia: nuevasFamilias.has(familia),
      };
    }).filter(Boolean);
    setPreview(items);
    setErrores(errs);
    setPaso(3);
  };

  const confirmarImport = async () => {
    setLoading(true);
    const nuevasFlag = [...new Set(preview.filter(a => a._nuevaFamilia).map(a => a.familia))];
    const familiasUpd = [...familias, ...nuevasFlag.filter((f: any) => !familias.includes(f))];
    if (setFamilias) setFamilias(familiasUpd);
    
    if (cloudSync?.saveToCloud && familiasUpd.length > familias.length) {
      // Si el estado es simple string array o objetos, lo guardamos
      // asumimos setFamilias/familias is handled somewhere
    }
    
    const mapaCodigos = new Map(articulos.filter((a: any) => a.codigo).map((a: any) => [String(a.codigo).toLowerCase(), a]));
    const mapaNombres = new Map(articulos.map((a: any) => [a.nombre.toLowerCase(), a]));
    
    const finalArts = [...articulos];
    const toSave: any[] = [];
    let contadorNuevos = 0;
    let contadorActualizados = 0;

    preview.forEach((p: any) => {
      const { _nuevaFamilia, ...a } = p;
      let existente = (a.codigo && mapaCodigos.get(String(a.codigo).toLowerCase())) || mapaNombres.get(a.nombre.toLowerCase());

      if (existente) {
        // Actualizar
        const idx: number = finalArts.findIndex((x: any) => String(x.id) === String((existente as any).id));
        if (idx !== -1) {
          finalArts[idx] = { ...finalArts[idx], ...a, id: finalArts[idx].id };
          toSave.push(finalArts[idx]);
          contadorActualizados++;
        }
      } else {
        // Nuevo
        const nuevoArt = { ...a, id: Date.now() + "_" + Math.random().toString(36).substr(2, 9) };
        finalArts.push(nuevoArt);
        toSave.push(nuevoArt);
        contadorNuevos++;
      }
    });
    
    if (cloudSync?.saveBatchToCloud && toSave.length > 0) {
      // Chunk it for Firestore batches (max 500)
      const chunkSize = 400;
      for (let i = 0; i < toSave.length; i += chunkSize) {
        await cloudSync.saveBatchToCloud("articulos", toSave.slice(i, i + chunkSize));
      }
    }
    
    setArticulos(finalArts);
    setImportados(contadorNuevos);
    setActualizadosCount(contadorActualizados);
    setLoading(false);
    setPaso(4);
  };

  const reset = () => { setPaso(1); setFilas([]); setHeaders([]); setMapeo({}); setPreview([]); setErrores([]); setImportados(0); };
  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;

  return (
    <OverlaySheet open={open} onClose={handleClose} title="Importar artículos" sub="Desde Excel / XLS" width="700px">
      {paso === 1 && (
        <label onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) parsearArchivo(f); }}
          onDragOver={(e) => e.preventDefault()}
          style={{ display: "block", border: `2px dashed ${t.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: t.surf2 }}>
          <input type="file" accept=".xls,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) parsearArchivo(f); e.target.value = ""; }} style={{ display: "none" }} />
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>Arrastrá la planilla aquí</div>
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 12 }}>o hacé click para seleccionarla</div>
          <div style={{ display: "inline-block", background: t.accentBg, border: `1px solid ${t.accent}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: t.accent, fontWeight: 600 }}>Archivos .xlsx o .xls</div>
        </label>
      )}

      {paso === 2 && <>
        <div style={{ fontSize: 13, color: t.sub, marginBottom: 16 }}>
          Se detectaron <strong>{headers.length}</strong> columnas y <strong>{filas.length}</strong> filas.
          Verificá el mapeo y corregí si hace falta.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {CAMPOS.map(c => (
            <Fld key={c.key} label={c.label + (c.req ? " *" : "")}>
              <select value={mapeo[c.key] || ""} onChange={e => setMapeo({ ...mapeo, [c.key]: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.surf2, color: t.text, fontSize: 13, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>
                <option value="">— No importar —</option>
                {headers.filter(Boolean).map((h, idx) => <option key={h + idx} value={h}>{h}</option>)}
              </select>
            </Fld>
          ))}
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginBottom: 16 }}>
          * El campo <strong>Nombre</strong> es obligatorio. Los precios de lista se importan como valores fijos.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn v="ghost" onClick={reset}>← Volver</Btn>
          <Btn onClick={generarPreview} disabled={!mapeo.nombre}>Ver preview →</Btn>
        </div>
      </>}

      {paso === 3 && <>
        {errores.length > 0 && <div style={{ padding: "10px 14px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, marginBottom: 14, fontSize: 12, color: "#92400e" }}>
          <strong>⚠ {errores.length} fila{errores.length > 1 ? "s" : ""} omitida{errores.length > 1 ? "s" : ""}:</strong> {errores.slice(0, 3).join(" · ")}{errores.length > 3 && ` · y ${errores.length - 3} más`}
        </div>}
        <div style={{ fontSize: 13, color: t.sub, marginBottom: 12 }}>
          Se importarán <strong style={{ color: t.accent }}>{preview.length} artículos</strong>
          {preview.filter(a => a._nuevaFamilia).length > 0 && <span style={{ color: t.amber }}> · {[...new Set(preview.filter(a => a._nuevaFamilia).map(a => a.familia))].length} familia{[...new Set(preview.filter(a => a._nuevaFamilia).map(a => a.familia))].length > 1 ? "s" : ""} nueva{[...new Set(preview.filter(a => a._nuevaFamilia).map(a => a.familia))].length > 1 ? "s" : ""} se crearán automáticamente</span>}
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${t.border}`, borderRadius: 8, marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: t.surf2, position: "sticky", top: 0 }}>
                {["Código", "Nombre", "Familia", "Costo", "Stock", "Lista 1"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: t.sub, borderBottom: `1px solid ${t.border}`, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((a, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td style={{ padding: "6px 10px", color: t.muted, fontFamily: "'Consolas','Courier New',monospace" }}>{a.codigo || "—"}</td>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: t.text }}>{a.nombre}</td>
                  <td style={{ padding: "6px 10px" }}><Bdg color={a._nuevaFamilia ? t.amber : t.purple}>{typeof a.familia === "string" ? a.familia : a.familia?.nombre || "Varios"}</Bdg></td>
                  <td style={{ padding: "6px 10px", fontFamily: "'Consolas','Courier New',monospace", color: t.sub }}>{a.costo > 0 ? fmtMoney(a.costo) : "—"}</td>
                  <td style={{ padding: "6px 10px", fontFamily: "'Consolas','Courier New',monospace" }}>{a.stock || 0}</td>
                  <td style={{ padding: "6px 10px", fontFamily: "'Consolas','Courier New',monospace", color: t.accent }}>{a.utilidad[0] ? fmtMoney(parseFloat(a.utilidad[0])) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn v="ghost" onClick={() => setPaso(2)}>← Ajustar mapeo</Btn>
          <Btn onClick={confirmarImport}>✓ Confirmar importación</Btn>
        </div>
      </>}

      {paso === 4 && <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: t.text, marginBottom: 8 }}>¡Importación completada!</div>
        <div style={{ fontSize: 13, color: t.sub, marginBottom: 24 }}>
          Se agregaron <strong style={{ color: t.green }}>{importados} artículos nuevos</strong> y se actualizaron <strong style={{ color: t.accent }}>{actualizadosCount} existentes</strong>.
        </div>
        <Btn onClick={handleClose}>Cerrar</Btn>
      </div>}
    </OverlaySheet>
  );
}
