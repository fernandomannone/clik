import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Btn, Ic, OverlaySheet } from "../../common/UIBase";
import XLSX from "xlsx-js-style";

export default function ModalImportarProveedores({ open, onClose, proveedores, setProveedores, cloudSync }: any) {
  const { t } = useApp();
  const [paso, setPaso] = useState(1);
  const [preview, setPreview] = useState<any[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const reset = () => { setPaso(1); setPreview([]); setErrores([]); };
  const handleClose = () => { reset(); onClose(); };

  const parsearExcel = async (file: any) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      let headerIdx = rows.findIndex((r: any) => (r as any[]).some((c: any) => String(c).toLowerCase().includes("razón") || String(c).toLowerCase().includes("razon")));
      if (headerIdx === -1) headerIdx = 7;
      
      const hdrs = ((rows[headerIdx] as any[]) || []).map((h: any) => String(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
      const findIdx = (keywords: RegExp[]) => hdrs.findIndex(h => keywords.some(k => k.test(h)));

      let iId = findIdx([/^id$/i, /id.*prov/i]);
      let iCod = findIdx([/^codigo/i, /^cod/i]);
      let iNom = findIdx([/razon/i, /nombre/i, /denominacion/i, /proveedor/i]);
      let iDir = findIdx([/direccion/i, /domicilio/i]);
      let iLoc = findIdx([/localidad/i]);
      let iTel = findIdx([/telefono/i, /^tel/i]);
      let iProv = findIdx([/provincia/i]);
      let iCuit = findIdx([/cuit/i, /rfc/i, /rut/i]);
      let iMail = findIdx([/email/i, /mail/i, /correo/i]);

      if (iNom === -1) {
        iId = 0; iCod = 1; iNom = 2; iDir = 3; iLoc = 5; iTel = 7; iProv = 9; iCuit = 10; iMail = 11;
      }

      const mapExistentes = new Map(proveedores.map((p: any) => [p.codigo, p]));
      const mapExistentesById = new Map(proveedores.map((p: any) => [String(p.id), p]));
      const mapExistentesByName = new Map(proveedores.map((p: any) => [p.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), p]));
      const maxCod = proveedores.reduce((m: number, p: any) => Math.max(m, parseInt(p.codigo) || 0), 0);
      let contadorNuevo = maxCod;
      const parsed: any[] = [];

      rows.slice(headerIdx + 2).forEach((row: any, i: number) => {
        const rawId = iId !== -1 ? String(row[iId] || "").trim() : "";
        const cod = iCod !== -1 ? String(row[iCod] || rawId || "").trim() : rawId;
        const nombre = iNom !== -1 ? String(row[iNom] || "").trim() : "";
        const dir = iDir !== -1 ? String(row[iDir] || "").trim() : "";
        const loc = iLoc !== -1 ? String(row[iLoc] || "").trim() : "";
        const tel = iTel !== -1 ? String(row[iTel] || "").trim().split(" ")[0] : "";
        const prov = iProv !== -1 ? String(row[iProv] || "").trim() : "";
        const cuit = iCuit !== -1 ? String(row[iCuit] || "").trim() : "";
        const mail = iMail !== -1 ? String(row[iMail] || "").trim() : "";

        if (!nombre) return;

        let existente = null;
        if (rawId && mapExistentesById.has(rawId)) existente = mapExistentesById.get(rawId);
        else if (cod && mapExistentes.has(cod)) existente = mapExistentes.get(cod);
        else if (nombre && mapExistentesByName.has(nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim())) existente = mapExistentesByName.get(nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());

        if (existente) {
          const actualizado = { ...existente };
          if (!existente.direccion && dir) actualizado.direccion = dir;
          if (!existente.localidad && loc) actualizado.localidad = loc;
          if (!existente.telefono && tel) actualizado.telefono = tel;
          if (!existente.provincia && prov) actualizado.provincia = prov;
          if (!existente.cuit && cuit) actualizado.cuit = cuit;
          if (!existente.email && mail) actualizado.email = mail;
          const hayCambios = JSON.stringify(actualizado) !== JSON.stringify(existente);
          const generatedId = rawId || existente.id;
          parsed.push({ ...actualizado, id: generatedId, _estado: hayCambios ? "actualizar" : "sinCambios" });
        } else {
          contadorNuevo++;
          const generatedId = rawId || `prov-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
          parsed.push({
            id: generatedId, _estado: "nuevo",
            codigo: cod || String(contadorNuevo).padStart(4, "0"),
            nombre, direccion: dir, localidad: loc, provincia: prov,
            telefono: tel, cuit, email: mail, obs: ""
          });
        }
      });

      const nuevos = parsed.filter(p => p._estado === "nuevo").length;
      const actualizados = parsed.filter(p => p._estado === "actualizar").length;
      const sinCambios = parsed.filter(p => p._estado === "sinCambios").length;
      const errs: string[] = [];
      if (actualizados) errs.push(`${actualizados} proveedores existentes con datos nuevos para actualizar`);
      if (sinCambios) errs.push(`${sinCambios} proveedores sin cambios (se ignorarán)`);
      setPreview(parsed); setErrores(errs); setPaso(2);
    } catch (e) {
      setErrores(["Error al leer el archivo. Verificá que sea el Excel exportado desde Husky."]);
    }
    setLoading(false);
  };

  const confirmar = async () => {
    setLoading(true);
    const nuevos = preview.filter(p => p._estado === "nuevo").map(p => {
      const obj = { ...p };
      delete obj._id;
      delete obj._estado;
      return obj;
    });
    const actualizados = preview.filter(p => p._estado === "actualizar").map(p => {
      const obj = { ...p };
      delete obj._id;
      delete obj._estado;
      return obj;
    });
    
    // Asignar IDs si no tienen y preparar array
    const toSave = [...nuevos, ...actualizados].map(p => ({...p, id: p.id || `prov-${Date.now()}-${Math.random().toString(36).substr(2,5)}`}));
    
    if (cloudSync?.saveBatchToCloud) {
       await cloudSync.saveBatchToCloud("proveedores", toSave);
    }
    
    setProveedores((prev: any[]) => {
      const sinActualizar = prev.filter(p => !toSave.find(a => a.id === p.id));
      return [...sinActualizar, ...toSave];
    });
    setLoading(false);
    setPaso(3);
  };

  if (!open) return null;

  return (
    <OverlaySheet open={open} onClose={handleClose} title="Importar proveedores desde Husky" width="720px">
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
        {["Subir archivo", "Vista previa", "Listo"].map((label, i) => {
          const n = i + 1; const act = paso === n; const done = paso > n;
          return <div key={n} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? t.green : act ? t.accent : t.surf2, border: `2px solid ${done ? t.green : act ? t.accent : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: done || act ? "#fff" : t.muted, flexShrink: 0 }}>
                {done ? <Ic n="check" s={12} /> : n}
              </div>
              <span style={{ fontSize: 12, fontWeight: act ? 700 : 500, color: act ? t.accent : done ? t.green : t.muted, whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, background: t.border, margin: "0 12px" }} />}
          </div>;
        })}
      </div>

      {paso === 1 && <>
        <label onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) parsearExcel(f); }}
          onDragOver={(e) => e.preventDefault()}
          style={{ display: "block", border: `2px dashed ${t.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: t.surf2, marginBottom: 16 }}>
          <input id="inp-importar-prov" type="file" accept=".xls,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) parsearExcel(f); e.target.value = ""; }} style={{ display: "none" }} disabled={loading} />
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>{loading ? "Procesando..." : "Arrastrá la planilla aquí"}</div>
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 12 }}>o hacé click para seleccionarla</div>
          <div style={{ display: "inline-block", background: t.accentBg, border: `1px solid ${t.accent}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: t.accent, fontWeight: 600 }}>Padrón Husky · .xlsx o .xls</div>
        </label>
        <div style={{ padding: "10px 14px", background: t.surf2, borderRadius: 8, fontSize: 12, color: t.sub }}>
          <strong>Formato esperado:</strong> Export "Padrón de Proveedores" de Husky, con columnas: Cód · Razón Social · Domicilio · Localidad · Teléfonos · Provincia · CUIT · Mail
        </div>
      </>}

      {paso === 2 && <>
        {errores.length > 0 && <div style={{ padding: "10px 14px", background: t.amberBg, borderRadius: 8, border: `1px solid ${t.amber}44`, fontSize: 12, color: t.amber, marginBottom: 12 }}>
          ⚠️ {errores.join(" · ")}
        </div>}
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, padding: "12px 14px", background: t.greenBg, borderRadius: 8, border: `1px solid ${t.green}33` }}>
            <div style={{ fontSize: 10, color: t.sub, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>Nuevos</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.green }}>{preview.filter(p => p._estado === "nuevo").length}</div>
          </div>
          <div style={{ flex: 1, padding: "12px 14px", background: t.amber + "12", borderRadius: 8, border: `1px solid ${t.amber}33` }}>
            <div style={{ fontSize: 10, color: t.sub, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>A actualizar</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.amber }}>{preview.filter(p => p._estado === "actualizar").length}</div>
          </div>
          <div style={{ flex: 1, padding: "12px 14px", background: t.surf2, borderRadius: 8, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 10, color: t.sub, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>Sin cambios</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.muted }}>{preview.filter(p => p._estado === "sinCambios").length}</div>
          </div>
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 10, border: `1px solid ${t.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: t.surf2, position: "sticky", top: 0 }}>
              {["", "Código", "Nombre / Razón Social", "Localidad", "Provincia", "Teléfono", "CUIT"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: t.sub, fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", borderBottom: `1px solid ${t.border}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {preview.map((p, i) => {
                const color = p._estado === "nuevo" ? t.green : p._estado === "actualizar" ? t.amber : t.muted;
                const badge = p._estado === "nuevo" ? "NUEVO" : p._estado === "actualizar" ? "ACTUALIZA" : "=";
                return <tr key={i} style={{ background: i % 2 === 0 ? t.surf : t.surf2 }}>
                  <td style={{ padding: "7px 12px" }}><span style={{ fontSize: 10, fontWeight: 700, color, background: color + "18", padding: "2px 6px", borderRadius: 4 }}>{badge}</span></td>
                  <td style={{ padding: "7px 12px", fontFamily: "'Consolas','Courier New',monospace", color: t.muted }}>{p.codigo}</td>
                  <td style={{ padding: "7px 12px", fontWeight: 600, color: t.text }}>{p.nombre}</td>
                  <td style={{ padding: "7px 12px", color: t.sub }}>{p.localidad || "—"}</td>
                  <td style={{ padding: "7px 12px", color: t.sub }}>{p.provincia || "—"}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "'Consolas','Courier New',monospace", color: t.sub }}>{p.telefono || "—"}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "'Consolas','Courier New',monospace", color: t.sub }}>{p.cuit || "—"}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 8 }}>* Podés completar CUIT y datos faltantes desde el Maestro de Proveedores después de importar.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Btn v="ghost" onClick={reset} full>← Volver</Btn>
          <Btn onClick={confirmar} disabled={!preview.filter(p => p._estado !== "sinCambios").length} full>
            <Ic n="check" s={14} />Confirmar ({preview.filter(p => p._estado === "nuevo").length} nuevos · {preview.filter(p => p._estado === "actualizar").length} actualizados)
          </Btn>
        </div>
      </>}

      {paso === 3 && <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: t.green, marginBottom: 6 }}>¡Importación exitosa!</div>
        <div style={{ fontSize: 14, color: t.sub, marginBottom: 20 }}>
          {preview.filter(p => p._estado === "nuevo").length} nuevos · {preview.filter(p => p._estado === "actualizar").length} actualizados
        </div>
        <Btn onClick={handleClose} full>Cerrar</Btn>
      </div>}
    </OverlaySheet>
  );
}
