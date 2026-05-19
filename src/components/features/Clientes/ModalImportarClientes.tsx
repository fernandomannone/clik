import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Btn, Ic, OverlaySheet, KPI } from "../../common/UIBase";
import XLSX from "xlsx-js-style";

export default function ModalImportarClientes({ open, onClose, clientes, setClientes, cloudSync }: any) {
  const { t } = useApp();
  const [paso, setPaso] = useState(1); // 1=subir, 2=preview, 3=ok
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
      const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[]);

      let headerRow = rows.findIndex((r: any) => {
        const strRow = (r as any[]).map(c => String(c).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).join("|");
        return (strRow.includes("razon social") || strRow.includes("nombre")) && (strRow.includes("cuit") || strRow.includes("provincia") || strRow.includes("domicilio") || strRow.includes("telefono") || strRow.includes("tel"));
      });
      if (headerRow === -1) headerRow = 0;

      const hdrs = (rows[headerRow] || []).map((h: any) => String(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
      
      const findIdx = (keywords: RegExp[]) => {
        return hdrs.findIndex(h => keywords.some(k => k.test(h)));
      };

      let iId = findIdx([/^id$/i, /id.*cliente/i, /^id/i]);
      let iCod = findIdx([/^codigo/i, /^cod/i]);
      let iNom = findIdx([/razon/i, /nombre/i, /denominacion/i, /cliente/i]);
      let iDir = findIdx([/direccion/i, /domicilio/i]);
      let iLoc = findIdx([/localidad/i]);
      let iTel = findIdx([/telefono/i, /^tel/i, /celular/i]);
      let iProv = findIdx([/provincia/i]);
      let iCuit = findIdx([/cuit/i, /rfc/i, /rut/i, /doc/i, /dni/i]);
      let iMail = findIdx([/email/i, /mail/i, /correo/i]);

      // Fallback to strict index if no header matches found (Husky standard)
      if (iNom === -1) {
        if (hdrs[0] === "1" || hdrs[0] === "01") {
            // It means there is no header row, so we just use standard order
            // actually if no header row, headerRow is 0, we can guess based on data
        }
        iId = 0; iCod = 1; iNom = 2; iDir = 3; iLoc = 5; iTel = 7; iProv = 9; iCuit = 10; iMail = 11; 
      }

      const codsExistentes = new Set(clientes.map((c: any) => c.codigo));
      const mapExistentes = new Map(clientes.map((c: any) => [c.codigo, c]));
      const mapExistentesById = new Map(clientes.map((c: any) => [String(c.id), c]));
      const mapExistentesByName = new Map(clientes.map((c: any) => [c.nombre.toLowerCase().trim(), c]));
      const maxCod = clientes.reduce((m: number, c: any) => Math.max(m, parseInt(c.codigo) || 0), 0);
      let contadorNuevo = maxCod;

      let mappingIdByName = new Map<string, string>();
      try {
        const mappingJson = await import("../../../clientes_id_mapping.json");
        const jsonArr = mappingJson.default || mappingJson;
        for (const item of jsonArr) {
          if (item["NOMBRE CLIENTE"] && item["ID"]) {
            mappingIdByName.set(String(item["NOMBRE CLIENTE"]).trim().toLowerCase(), String(item["ID"]));
          }
        }
      } catch(e) {
        // file might not exist or be accessible, ignore
      }

      const parsed: any[] = [];
      const errs: string[] = [];

      (rows as any[]).slice(headerRow + 1).forEach((row: any, i: number) => {
        const fileRawId = iId !== -1 ? String(row[iId] || "").trim() : "";
        const nombre = iNom !== -1 ? String(row[iNom] || "").trim() : "";
        
        let rawId = fileRawId;
        if (nombre && mappingIdByName.has(nombre.toLowerCase().trim())) {
          rawId = mappingIdByName.get(nombre.toLowerCase().trim())!;
        }

        const cod = iCod !== -1 ? String(row[iCod] || rawId || "").trim() : rawId;
        const dir = iDir !== -1 ? String(row[iDir] || "").trim() : "";
        const loc = iLoc !== -1 ? String(row[iLoc] || "").trim() : "";
        const tel = iTel !== -1 ? String(row[iTel] || "").trim().split(" ")[0] : "";
        const prov = iProv !== -1 ? String(row[iProv] || "").trim() : "";
        const cuit = iCuit !== -1 ? String(row[iCuit] || "").trim() : "";
        const mail = iMail !== -1 ? String(row[iMail] || "").trim() : "";

        if (!nombre) return;

        // Si tenemos ID y ya existe en base, hacemos match por ID preferentemente, sino por código
        let existente = null;
        if (rawId && mapExistentesById.has(rawId)) existente = mapExistentesById.get(rawId);
        else if (cod && mapExistentes.has(cod)) existente = mapExistentes.get(cod);
        else if (nombre && mapExistentesByName.has(nombre.toLowerCase().trim())) existente = mapExistentesByName.get(nombre.toLowerCase().trim());

        const _estado = existente ? "actualizar" : "nuevo";
        const generatedId = rawId || (existente ? String(existente.id) : String(Date.now() + i));

        parsed.push({
          _id: generatedId,
          _estado,
          codigo: cod || String(++contadorNuevo).padStart(4, "0"),
          nombre,
          direccion: dir,
          localidad: loc,
          provincia: prov,
          telefono: tel,
          cuit,
          email: mail,
          nombreCV: existente?.nombreCV || "",
          listaPrecios: existente?.listaPrecios || null,
          creditoMax: existente?.creditoMax || 0,
          estado: existente?.estado || "activo",
          obs: existente?.obs || ""
        });
      });

      const actualiza = parsed.filter(p => p._estado === "actualizar").length;
      if (actualiza > 0) errs.push(`${actualiza} clientes ya existen — se actualizarán sus datos`);

      setPreview(parsed);
      setErrores(errs);
      setPaso(2);
    } catch (e) {
      setErrores(["Error al leer el archivo. Verificá que sea el Excel exportado desde Husky."]);
    }
    setLoading(false);
  };

  const confirmar = async () => {
    setLoading(true);
    const idsCambiados = new Set(preview.map(p => String(p._id)));
    const mantenidos = clientes.filter((c: any) => !idsCambiados.has(String(c.id)));
    const nuevos = preview.map(p => {
      const obj = { ...p, id: p._id };
      delete obj._id;
      delete obj._estado;
      return obj;
    });
    
    if (cloudSync?.saveBatchToCloud) {
       await cloudSync.saveBatchToCloud("clientes", nuevos);
    }
    
    setClientes([...mantenidos, ...nuevos]);
    setLoading(false);
    setPaso(3);
  };

  if (!open) return null;

  return (
    <OverlaySheet open={open} onClose={handleClose} title="Importar clientes desde Husky" width={720}>
      {/* Indicador de pasos */}
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

      {/* Paso 1: Subir */}
      {paso === 1 && <>
        <label onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) parsearExcel(f); }}
          onDragOver={(e) => e.preventDefault()}
          style={{ display: "block", border: `2px dashed ${t.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: t.surf2, marginBottom: 16 }}>
          <input id="inp-importar-cli" type="file" accept=".xls,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) parsearExcel(f); e.target.value = ""; }} style={{ display: "none" }} disabled={loading} />
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>{loading ? "Procesando..." : "Arrastrá la planilla aquí"}</div>
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 12 }}>o hacé click para seleccionarla</div>
          <div style={{ display: "inline-block", background: t.accentBg, border: `1px solid ${t.accent}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: t.accent, fontWeight: 600 }}>Padrón Husky · .xlsx o .xls</div>
        </label>
        <div style={{ padding: "10px 14px", background: t.surf2, borderRadius: 8, fontSize: 12, color: t.sub }}>
          <strong>Formato esperado:</strong> El archivo debe ser el export "Padrón de Clientes" de Husky, con columnas: Cód · Razón Social · Domicilio · Localidad · Teléfonos · Provincia · CUIT · Mail
        </div>
      </>}

      {/* Paso 2: Preview */}
      {paso === 2 && <>
        {errores.length > 0 && <div style={{ padding: "10px 14px", background: t.amberBg, borderRadius: 8, border: `1px solid ${t.amber}44`, fontSize: 12, color: t.amber, marginBottom: 12 }}>
          ⚠️ {errores.join(" · ")}
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
          <KPI label="A importar" value={preview.length} color={t.green} />
          <KPI label="Ya en sistema" value={clientes.length} color={t.sub} />
          <KPI label="Total final" value={clientes.length + preview.length} color={t.accent} />
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 10, border: `1px solid ${t.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: t.surf2, position: "sticky", top: 0 }}>
              {["Código", "Nombre", "Localidad", "Provincia", "Teléfono", "CUIT"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: t.sub, fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", borderBottom: `1px solid ${t.border}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {preview.map((p, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? t.surf : t.surf2 }}>
                  <td style={{ padding: "7px 12px", fontFamily: "'Consolas','Courier New',monospace", color: t.muted }}>{p.codigo}</td>
                  <td style={{ padding: "7px 12px", fontWeight: 600, color: t.text }}>{p.nombre}</td>
                  <td style={{ padding: "7px 12px", color: t.sub }}>{p.localidad || "—"}</td>
                  <td style={{ padding: "7px 12px", color: t.sub }}>{p.provincia || "—"}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "'Consolas','Courier New',monospace", color: t.sub }}>{p.telefono || "—"}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "'Consolas','Courier New',monospace", color: t.sub }}>{p.cuit || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 8 }}>* Podés completar Lista de precios y Nombre CV desde el Maestro de Clientes después de importar.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Btn v="ghost" onClick={reset} full>← Volver</Btn>
          <Btn onClick={confirmar} full><Ic n="check" s={14} />Confirmar importación ({preview.length} clientes)</Btn>
        </div>
      </>}

      {/* Paso 3: OK */}
      {paso === 3 && <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: t.green, marginBottom: 6 }}>¡Importación exitosa!</div>
        <div style={{ fontSize: 14, color: t.sub, marginBottom: 20 }}>{preview.length} clientes importados correctamente.</div>
        <Btn onClick={handleClose} full>Cerrar</Btn>
      </div>}
    </OverlaySheet>
  );
}
