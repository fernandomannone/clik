import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Btn, Ic, Tbl, Tr, Td, Bdg, Modal, Fld, Inp, ThSort, OverlaySheet } from "../../common/UIBase";
import { fmtMoney, fmtFechaCC, getToday } from "../../../lib/utils";
import { BuscadorCliente } from "../Clientes/BuscadorCliente";

import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

const today = getToday();
const SEAC_TIPO_SUPERVIELLE = "Cuenta 3793455-1 Convenio 31085";

const GRUPOS_SEAC = [
  { id: "qr", label: "Operaciones QR", tipos: [
    "Operación cobro QR", "Operacion cobro QR",
    "Operación cobro QR MAX", "Operacion cobro QR MAX",
    "Descuento por Op QR (SC)", "Descuento por Op QRMAX (SC)",
    "Reintegro por operar con QR", "Reintegro por operar con QRMAX",
  ]},
  { id: "plat", label: "Uso de la plataforma", tipos: ["Cargo por uso de la plataforma"] },
  { id: "mant", label: "Mantenimiento Posnet", tipos: ["Cargo por Mant. Posnet", "Devol Cargo por mantenimiento posnet"] },
  { id: "vmin", label: "Ventas mínimas", tipos: [
    "Cargo por ventas minimas SUBE",
    "Cargo por ventas minimas Carga Virtual",
    "Cargo por ventas minimas QR",
  ]},
  { id: "equip", label: "Equipos POS / LG", tipos: ["Perdida de POS", "Perdida de LG", "NC Cargos Generico"] },
  { id: "iva", label: "Acreditación IVA", tipos: ["Nrocuenta"] },
  { id: "ajuste", label: "Ajuste depósito", tipos: ["Ajuste Dep.", "Cargo por ajuste de deposito %"] },
];

// Normaliza texto latin-1 mal decodificado → UTF-8 correcto
// Esto resuelve "OperaciÃ³n" → "Operación" cuando el browser no decodifica latin-1
function normalizarTextoSeac(s: string): string {
  if (!s) return "";
  try {
    // Intento 1: re-encodear como latin-1 y decodificar como UTF-8
    const bytes = new Uint8Array(s.split("").map(c => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // Si el resultado tiene caracteres válidos (no mojibake), usarlo
    if (!decoded.includes("Ã")) return decoded;
  } catch {}
  // Intento 2: reemplazos manuales de los más comunes
  return s
    .replace(/Ã³/g, "ó").replace(/Ã¡/g, "á").replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í").replace(/Ãº/g, "ú").replace(/Ã±/g, "ñ")
    .replace(/Ã"/g, "Ó").replace(/Ã/g, "Á").replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í").replace(/Ãš/g, "Ú").replace(/Ã'/g, "Ñ")
    .replace(/Â°/g, "°").replace(/Â¿/g, "¿").replace(/Â¡/g, "¡");
}

function parsearImporteSeac(val: any) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const s = String(val).replace(/[$  \s]/g, "").trim();
  if (!s || s === "-") return 0;
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

function parsearSerialSeac(obs: string) {
  if (!obs) return null;
  const m = obs.match(/(?:Nro\.?\s*Serie|activaci[oóÃ³]+n\s+(?:POS|LG))[:\s]+([A-Z0-9]+)/i)
         || obs.match(/(?:POS|LG)[:\s]+([A-Z0-9]{6,})/i);
  return m ? m[1].trim() : null;
}

function parsearFechaSeac(str: any) {
  if (!str) return null;
  const s = String(str).trim();
  const parte = s.split(" ")[0];
  const p = parte.split("/");
  if (p.length === 3) {
    const d = p[0].padStart(2, "0"), mo = p[1].padStart(2, "0"), y = p[2].length === 2 ? `20${p[2]}` : p[2];
    return `${y}-${mo}-${d}`;
  }
  return s.match(/^\d{4}-\d{2}-\d{2}/) ? s.slice(0, 10) : null;
}

export function SEACCuentaCorriente({ seacMovs, setSeacMovs, seacImportaciones = [], setSeacImportaciones, pagosProv, pagos = [], movimientos = [], factProv, setFactProv, clientes = [], proveedores = [], cuentas = [], seacMatchManuales = [], setSeacMatchManuales, cloudSync }: any) {
  const { t, claveMaestra } = useApp();
  const [tabSeac, setTabSeac] = useState("importaciones");
  const [revirtiendo, setRevirtiendo] = useState<any>(null);
  const [modalDetalle, setModalDetalle] = useState<any>(null);
  const [confirmarRevSEAC, setConfirmarRevSEAC] = useState<any>(null);
  const [mesesAbiertos, setMesesAbiertos] = useState<Record<string, boolean>>({});
  const [claveSEAC, setClaveSEAC] = useState("");
  const [msgImport, setMsgImport] = useState<any>(null);

  const calcularGrupos = (movs: any[]) => {
    const conocidos = GRUPOS_SEAC.map(g => {
      // Normalizar el tipo de cada mov antes de comparar
      const movsG = movs.filter(m => g.tipos.includes(normalizarTextoSeac(m.tipo || "")));
      const subtotal = movsG.reduce((s, m) => s + m.importe, 0);
      return { ...g, movs: movsG, subtotal };
    }).filter(g => g.movs.length > 0);

    const tiposAsignados = GRUPOS_SEAC.flatMap(g => g.tipos);
    const otrosMovs = movs.filter(m => !tiposAsignados.includes(m.tipo));

    if (otrosMovs.length > 0) {
      const subtipos = Array.from(new Set(otrosMovs.map(m => m.tipo)));
      subtipos.forEach(sub => {
         const sMovs = otrosMovs.filter(m => m.tipo === sub);
         conocidos.push({
           id: "otro_" + Math.random().toString(36).slice(2, 6),
           label: sub,
           tipos: [sub],
           movs: sMovs,
           subtotal: sMovs.reduce((s, m) => s + m.importe, 0)
         });
      });
    }

    return conocidos;
  };

  const registrarNCND = (imp: any) => {
    if (!setFactProv) return;
    
    // The amount is the net of concepts
    const totalConceptos = imp.neto;
    const prefijo = totalConceptos >= 0 ? "nc" : "nd";
    const tipo = totalConceptos >= 0 ? "nc" : "nd";

    const numero = `${prefijo.toUpperCase()}-SEAC-${imp.fecha.replace(/-/g,"")}-${Date.now().toString().slice(-3)}`;
    
    const grupos = calcularGrupos(imp.movs.filter((m: any) => m.tipo !== SEAC_TIPO_SUPERVIELLE));
    const items = grupos.map((g, i) => ({ 
      id: i + 1, 
      nombre: g.label, 
      cantidad: "1", 
      precio: String(Math.abs(g.subtotal)), 
      total: Math.abs(g.subtotal) 
    }));
    
    const provSeac = proveedores?.find((p: any) => p.nombre.toUpperCase().includes("SEAC") || p.nombre.toUpperCase().includes("RED GLOBAL") || p.nombre.toUpperCase().includes("RGP"));
    const pId = provSeac ? provSeac.id : 9;

    const nuevaDoc = { 
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9), 
      proveedorId: pId, 
      numero, 
      tipo, 
      total: Math.abs(totalConceptos), 
      fecha: imp.fecha, 
      condPago: "Contado", 
      obs: `SEAC ${fmtFechaCC(imp.fecha)} — ${prefijo.toUpperCase()} automática`, 
      items, 
      origenSEAC: true 
    };

    setFactProv((prev: any[]) => [...prev, nuevaDoc]);
    setSeacImportaciones((prev: any[]) => prev.map((x: any) => {
      if (x.id === imp.id) {
        const updated = { ...x, registrada: true, factProvIds: [...(x.factProvIds || []), nuevaDoc.id] };
        if (cloudSync?.saveToCloud) cloudSync.saveToCloud("seacImportaciones", updated, String(updated.id));
        return updated;
      }
      return x;
    }));
    if (cloudSync?.saveToCloud) cloudSync.saveToCloud("factProv", nuevaDoc, String(nuevaDoc.id));
  };

  const generarFactura = (imp: any) => {
    if (!setFactProv) return;
    
    // The amount is the facturation of the purchases
    const totalFacturacion = imp.totalFactura || imp.movs.filter((m:any) => m.tipo === SEAC_TIPO_SUPERVIELLE || m.tipo.toLowerCase().includes("depósito") || m.tipo.toLowerCase().includes("transferencia") || m.tipo.toLowerCase().includes("deposito")).reduce((s:any, m:any) => s + Math.abs(m.importe), 0);

    const tipo = "factura";

    const rowFactura = imp.movs.find((m: any) => m.tipo.toLowerCase().includes("factura") || m.tipo.toLowerCase().includes("liquid") || m.tipo.toLowerCase().includes("fc"));
    let realNumero = null;
    if (rowFactura) {
      const matchNum = (rowFactura.id + " " + rowFactura.obs).match(/[A-C]?\s?\d{4,5}-\d{8}/i) || (rowFactura.id + " " + rowFactura.obs).match(/\d{4,5}-\d{8}/i);
      if (matchNum) realNumero = matchNum[0];
      else if (rowFactura.id && rowFactura.id.length > 5 && !rowFactura.id.startsWith("seac-gen")) realNumero = rowFactura.id;
    }
    const numero = realNumero || `FAC-SEAC-${imp.fecha.replace(/-/g,"")}-${Date.now().toString().slice(-3)}`;
    
    const provSeac = proveedores?.find((p: any) => p.nombre.toUpperCase().includes("SEAC") || p.nombre.toUpperCase().includes("RED GLOBAL") || p.nombre.toUpperCase().includes("RGP"));
    const pId = provSeac ? provSeac.id : 9;

    const nuevaFac = { 
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9), 
      proveedorId: pId, 
      numero, 
      tipo, 
      total: Math.abs(totalFacturacion), 
      fecha: imp.fecha, 
      condPago: "Contado", 
      obs: `Factura SEAC ${fmtFechaCC(imp.fecha)}`, 
      items: [{
        id: 1,
        nombre: "Servicios SEAC",
        cantidad: "1",
        precio: String(Math.abs(totalFacturacion)),
        total: Math.abs(totalFacturacion)
      }], 
      origenSEAC: true 
    };

    setFactProv((prev: any[]) => [...prev, nuevaFac]);
    setSeacImportaciones((prev: any[]) => prev.map((x: any) => {
      if (x.id === imp.id) {
        const updated = { ...x, facturaRegistrada: true, factProvIds: [...(x.factProvIds || []), nuevaFac.id] };
        if (cloudSync?.saveToCloud) cloudSync.saveToCloud("seacImportaciones", updated, String(updated.id));
        return updated;
      }
      return x;
    }));
    if (cloudSync?.saveToCloud) cloudSync.saveToCloud("factProv", nuevaFac, String(nuevaFac.id));
  };

  const reversarImportacion = async (imp: any) => {
    setRevirtiendo(imp.id);
    await new Promise(r => setTimeout(r, 50));
    try {
      if (setFactProv && imp.factProvIds && imp.factProvIds.length > 0) {
        setFactProv((prev: any[]) => prev.filter(f => !imp.factProvIds.includes(f.id)));
        if (cloudSync?.deleteBatchFromCloud) {
          await cloudSync.deleteBatchFromCloud("factProv", imp.factProvIds);
        } else if (cloudSync?.deleteFromCloud) {
          imp.factProvIds.forEach((id: string) => cloudSync.deleteFromCloud("factProv", id));
        }
      }
      if (setSeacMovs && imp.movs) {
        const idsAEliminar = imp.movs.map((m: any) => m.id);
        setSeacMovs((prev: any[]) => prev.filter((m: any) => !idsAEliminar.includes(m.id)));
        if (cloudSync?.deleteBatchFromCloud) {
          await cloudSync.deleteBatchFromCloud("seacMovs", idsAEliminar);
        } else if (cloudSync?.deleteFromCloud) {
          idsAEliminar.forEach((id: string) => cloudSync.deleteFromCloud("seacMovs", String(id)));
        }
      }
      setSeacImportaciones((prev: any[]) => prev.filter((x: any) => x.id !== imp.id));
      if (cloudSync?.deleteFromCloud) await cloudSync.deleteFromCloud("seacImportaciones", String(imp.id));
      setConfirmarRevSEAC(null);
    } finally {
      setRevirtiendo(null);
    }
  };

  const importarXLS = (e: any) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev: any) => {
      const text = ev.target.result;
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      const rows = Array.from(doc.querySelectorAll("tr")).map(tr => Array.from(tr.querySelectorAll("td,th")).map(td => td.textContent?.trim() || ""));
      if(rows.length < 2) return;

      const headerRow = rows[0].map((c: string) => c.toLowerCase().trim());
      let map = { id: -1, fDep: -1, fCarga: -1, banco: -1, tipo: -1, importe: -1, obs: -1 };

      headerRow.forEach((c: string, i: number) => {
        // ID del movimiento
        if ((c === "id" || c.includes("nrotrans")) && map.id === -1) map.id = i;

        // Fechas — primera ocurrencia = depósito, segunda = carga
        if (c.includes("fecha")) {
          if (map.fDep === -1) map.fDep = i;
          else if (map.fCarga === -1) map.fCarga = i;
        }

        // Banco
        if (c === "banco") map.banco = i;

        // Tipo de movimiento — priorizar "cuenta" exacto (col real de SEAC)
        // IMPORTANTE: "cuenta" debe tener prioridad sobre "tipo" porque
        // en el XLS de SEAC la columna se llama "Cuenta" y contiene el tipo real
        if (c === "cuenta" || c.includes("tipomov")) {
          map.tipo = i; // siempre sobreescribir — "Cuenta" es el campo correcto
        } else if (c === "tipo" && map.tipo === -1) {
          map.tipo = i;
        }

        // Importe
        if ((c.includes("importe") || c.includes("monto")) && map.importe === -1) map.importe = i;

        // Observaciones
        if ((c.includes("obs") || c.includes("detalle") || c.includes("concepto")) && map.obs === -1) map.obs = i;
      });

      // Fallbacks para estructura conocida del XLS de SEAC:
      // [id, FechaDeposito, FechaCarga, Banco, PuntoVenta, Cuenta, NroTransCaj, Importe, Observaciones]
      if (map.id === -1)      map.id = 0;
      if (map.fDep === -1)    map.fDep = 1;
      if (map.fCarga === -1)  map.fCarga = 2;
      if (map.banco === -1)   map.banco = 3;
      if (map.tipo === -1)    map.tipo = 5;   // "Cuenta" = col 5 en SEAC
      if (map.importe === -1) map.importe = 7; // "Importe" = col 7 en SEAC
      if (map.obs === -1)     map.obs = 8;

      const movs: any[] = [];
      let totalImportado = 0;
      let encontroTotal = false;

      rows.slice(1).forEach((r: any, i: number) => {
        // Ignorar filas totalmente vacías
        if (r.every((c: any) => !c)) return;

        const c0 = (r[0] || "").toLowerCase();
        if (c0.includes("total")) {
          encontroTotal = true;
          totalImportado = map.importe !== -1 ? parsearImporteSeac(r[map.importe]) : parsearImporteSeac(r[r.length - 1] || "0"); 
          return;
        }

        const id = map.id !== -1 ? r[map.id] : `seac-gen-${i}`;
        const importe = map.importe !== -1 ? parsearImporteSeac(r[map.importe]) : 0;
        
        let fecha = "";
        if (importe < 0 && map.fCarga !== -1 && r[map.fCarga]) {
            fecha = parsearFechaSeac(r[map.fCarga]);
        }
        if (!fecha && map.fDep !== -1 && r[map.fDep]) {
            fecha = parsearFechaSeac(r[map.fDep]);
        }
        if (!fecha) {
            fecha = parsearFechaSeac(r[1] || r[0] || "");
        }

        // Normalizar tipo: limpiar latin-1 mal decodificado y usar fallback
        let tipo = map.tipo !== -1 ? normalizarTextoSeac(r[map.tipo]) : "";
        if (!tipo && map.banco !== -1) tipo = r[map.banco];
        if (!tipo) tipo = "Comprobante sin tipo";

        let obs = map.obs !== -1 ? normalizarTextoSeac(r[map.obs] || "") : "";
        if (!obs && map.banco !== -1) obs = r[map.banco] || "";

        if (fecha && tipo && importe !== 0) {
          movs.push({ id, fecha, tipo, importe, obs, serial: parsearSerialSeac(obs) });
        }
      });

      if(!movs.length) return;
      const sumaManual = movs.filter(m => m.tipo !== SEAC_TIPO_SUPERVIELLE).reduce((s, m) => s + m.importe, 0);

      const totalFacturacion = encontroTotal ? Math.abs(totalImportado) : movs.filter((m:any) => m.tipo === SEAC_TIPO_SUPERVIELLE || m.tipo.toLowerCase().includes("depósito") || m.tipo.toLowerCase().includes("deposito") || m.tipo.toLowerCase().includes("transferencia")).reduce((s:any, m:any) => s + Math.abs(m.importe), 0);

      let tipo_comp = sumaManual >= 0 ? "nc" : "nd";

      const nueva = { id: Date.now(), fecha: movs[0].fecha, movs, neto: sumaManual, totalFactura: totalFacturacion, tipo_comp, registrada: false, facturaRegistrada: false };
      
      setSeacMovs((prev: any[]) => [...prev, ...movs]);
      setSeacImportaciones((prev: any[]) => [...prev, nueva]);
      
      if (cloudSync?.saveBatchToCloud) {
        cloudSync.saveBatchToCloud("seacMovs", movs);
      }
      if (cloudSync?.saveToCloud) {
        cloudSync.saveToCloud("seacImportaciones", nueva, String(nueva.id));
      }
    };
    reader.readAsText(file, "latin-1");
  };

  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>CC RGP-SEAC</div>
        <Btn v="ghost" onClick={() => (document.getElementById("seac-xls-input") as HTMLInputElement)?.click()}>
          <Ic n="transfer" s={14} /> Importar XLS
        </Btn>
        <input id="seac-xls-input" type="file" style={{ display: "none" }} onChange={importarXLS} />
      </div>

      <div style={{ display: "flex", gap: 10, borderBottom: `1px solid ${t.border}`, marginBottom: 12 }}>
        {["importaciones", "equipos", "precargas"].map(tab => (
          <button key={tab} onClick={() => setTabSeac(tab)} style={{ padding: "8px 16px", border: "none", borderBottom: `2px solid ${tabSeac === tab ? t.accent : "transparent"}`, background: "none", color: tabSeac === tab ? t.accent : t.sub, fontWeight: tabSeac === tab ? 700 : 500, cursor: "pointer", fontSize: 13 }}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {tabSeac === "importaciones" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(() => {
            const agrupado = seacImportaciones.reduce((acc: any, imp: any) => {
              const [y, mStr] = imp.fecha.split("-");
              const mYear = `${mStr}/${y}`;
              if (!acc[mYear]) acc[mYear] = [];
              acc[mYear].push(imp);
              return acc;
            }, {});

            const mesesOrdenados = Object.keys(agrupado).sort((a,b) => {
               const [mA, yA] = a.split("/");
               const [mB, yB] = b.split("/");
               if (yA !== yB) return Number(yB) - Number(yA);
               return Number(mB) - Number(mA);
            });

            if (mesesOrdenados.length === 0) {
               return <div style={{ color: t.muted, padding: 24, textAlign: "center" }}>No hay importaciones registradas.</div>;
            }

            return mesesOrdenados.map((mes, idx) => {
              const isAbierto = mesesAbiertos[mes] === undefined ? idx === 0 : mesesAbiertos[mes];
              const imps = agrupado[mes];

              return (
                <div key={mes} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div 
                    onClick={() => setMesesAbiertos(prev => ({ ...prev, [mes]: !isAbierto }))}
                    style={{ background: t.surf, padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 13, color: t.text }}>Mes — {mes}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: t.sub, fontWeight: 700 }}>{imps.length} reg.</span>
                      <Ic n={isAbierto ? "chevron-up" : "chevron-down"} s={16} />
                    </div>
                  </div>

                  {isAbierto && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeIn 0.2s" }}>
                      {imps.map((imp: any) => {
                        const grupos = calcularGrupos(imp.movs.filter((m: any) => m.tipo !== SEAC_TIPO_SUPERVIELLE));
                        return (
                        <div key={imp.id} style={{ background: (imp.registrada || imp.facturaRegistrada) ? t.surf2 : t.surf, padding: "12px 16px", borderRadius: 10, border: `1px solid ${(imp.registrada || imp.facturaRegistrada) ? t.accent + "55" : t.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ fontWeight: 800, fontSize: 14, color: t.text }}>{fmtFechaCC(imp.fecha)}</div>
                              
                              {imp.totalFactura > 0 && (imp.registrada || imp.facturaRegistrada) && (
                                <div style={{ fontSize: 13, color: t.sub, display: "flex", gap: 4 }}>
                                  · Factura: <span style={{ color: t.accent, fontWeight: 500 }}>{fmtMoney(Math.abs(imp.totalFactura))}</span>
                                </div>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <Btn v="outline" onClick={() => setModalDetalle(imp)} style={{ fontSize: 13, padding: "4px 10px", background: t.surf, borderColor: t.border, color: t.text }}>Ver detalle</Btn>
                              
                              {!imp.registrada ? (
                                <Btn onClick={() => registrarNCND(imp)} style={{ fontSize: 13, padding: "4px 12px", background: imp.neto >= 0 ? t.greenBg : t.redBg, color: imp.neto >= 0 ? t.green : t.red, border: "none" }}>
                                  {imp.tipo_comp.toUpperCase()} {fmtMoney(Math.abs(imp.neto))}
                                </Btn>
                              ) : (
                                <Btn onClick={() => {}} style={{ fontSize: 13, padding: "4px 12px", background: imp.neto >= 0 ? t.greenBg : t.redBg, color: imp.neto >= 0 ? t.green : t.red, cursor: "default", border: "none", display: "flex", gap: "6px" }}>
                                  <Ic n="check" s={14} /> {imp.tipo_comp.toUpperCase()} {fmtMoney(Math.abs(imp.neto))}
                                </Btn>
                              )}
                              
                              {imp.totalFactura > 0 && !imp.facturaRegistrada && (
                                <Btn v="outline" onClick={() => generarFactura(imp)} style={{ fontSize: 13, padding: "4px 12px", background: t.surf, borderColor: t.border, color: t.text }}>
                                  Factura {fmtMoney(Math.abs(imp.totalFactura))}
                                </Btn>
                              )}
                              {imp.totalFactura > 0 && imp.facturaRegistrada && (
                                <Btn onClick={() => {}} style={{ fontSize: 13, padding: "4px 12px", background: t.greenBg, color: t.green, cursor: "default", border: "none", display: "flex", gap: "6px" }}>
                                  <Ic n="check" s={14} /> Factura {fmtMoney(Math.abs(imp.totalFactura))}
                                </Btn>
                              )}
                              
                              <Btn v="outline" onClick={() => setConfirmarRevSEAC(imp)} style={{ padding: "4px 8px", borderColor: t.red + "44", color: t.red, background: t.surf }} title="Reversar / Eliminar">
                                <Ic n="trash" s={14} />
                              </Btn>
                            </div>
                          </div>

                          {grupos.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {grupos.map((g: any, i: number) => (
                                <div key={i} style={{ border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, color: t.sub, display: "flex", gap: 6, background: t.surf }}>
                                  <span>{g.label}:</span>
                                  <span style={{ fontWeight: 700, color: g.subtotal >= 0 ? t.green : t.red }}>{fmtMoney(g.subtotal)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {confirmarRevSEAC?.id === imp.id && (
                            <div style={{ background: t.redBg, border: `1px solid ${t.red}55`, padding: "12px 16px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", animation: "fadeIn 0.2s" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <AlertTriangle size={18} color={t.red} />
                                <div style={{ fontSize: 13, color: t.text }}>
                                  <strong>¿Revertir importación?</strong> Se eliminarán las facturas y los movimientos asociados.
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <Btn v="outline" onClick={() => setConfirmarRevSEAC(null)} style={{ fontSize: 12 }} disabled={revirtiendo === imp.id}>Cancelar</Btn>
                                <Btn v="danger" onClick={() => reversarImportacion(imp)} style={{ fontSize: 12, opacity: revirtiendo === imp.id ? 0.6 : 1 }} disabled={revirtiendo === imp.id}>
                                  {revirtiendo === imp.id ? "Revirtiendo..." : "Sí, revertir"}
                                </Btn>
                              </div>
                            </div>
                          )}
                        </div>
                        )})}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {tabSeac === "equipos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeIn 0.2s" }}>
          <Tbl stickyTop={0} headers={["Fecha", "Tipo", "Observaciones", "Serial (Detectado)", <span key="importe" style={{ display:"block", width: 100, textAlign: "right" }}>Importe</span>]}>
            {seacMovs.filter((m: any) => {
              const tLow = (m.tipo || "").toLowerCase();
              return tLow.includes("pos") || tLow.includes("lg") || tLow.includes("equipo") || tLow.includes("cargos generico");
            }).map((m: any, i: number) => (
              <Tr key={i}>
                <Td>{fmtFechaCC(m.fecha)}</Td>
                <Td style={{ fontWeight: 600 }}>{m.tipo}</Td>
                <Td style={{ color: t.sub }}>{m.obs}</Td>
                <Td><Bdg color={m.serial ? t.accent : t.muted}>{m.serial || "—"}</Bdg></Td>
                <Td style={{ fontWeight: 700, color: m.importe >= 0 ? t.green : t.red }}>{fmtMoney(m.importe)}</Td>
              </Tr>
            ))}
            {seacMovs.filter((m: any) => {
              const tLow = (m.tipo || "").toLowerCase();
              return tLow.includes("pos") || tLow.includes("lg") || tLow.includes("equipo") || tLow.includes("cargos generico");
            }).length === 0 && (
              <Tr><Td colSpan={5} style={{ textAlign: "center", color: t.muted, padding: 24 }}>No hay registros de equipos importados.</Td></Tr>
            )}
          </Tbl>
        </div>
      )}

      {tabSeac === "precargas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.2s" }}>
          {(() => {
            const provSeac = proveedores?.find((p: any) => p.nombre.toUpperCase().includes("SEAC") || p.nombre.toUpperCase().includes("RED GLOBAL") || p.nombre.toUpperCase().includes("RGP"));
            const pIdSeac = provSeac?.id || 9;
            const pagosAsociados = (pagosProv || []).filter((p: any) => p.proveedorId === pIdSeac);
            const cobrosDirectos = (pagos || []).filter((p: any) => !p.anulado && p.proveedorId === pIdSeac);

            const seacPrecargas = (seacMovs || []).filter((m: any) => m.tipo === SEAC_TIPO_SUPERVIELLE);

            const filasPrecargas = seacPrecargas.map((precarga: any) => {
              const absMonto = Math.abs(precarga.importe);
              const fecha = precarga.fecha;
              
              const matchPagoProv = pagosAsociados.find((p: any) => 
                Math.abs(p.monto - absMonto) < 0.01 && 
                Math.abs(new Date(p.fecha).getTime() - new Date(fecha).getTime()) <= 86400000 * 1.5
              );

              let matchCobro = null;
              if (matchPagoProv?._desdeRecibo) {
                matchCobro = pagos.find((p: any) => p.id === matchPagoProv.reciboId || p.grupoId === matchPagoProv.grupoId);
              }
              if (!matchCobro) {
                matchCobro = cobrosDirectos.find((p: any) => 
                  Math.abs(p.monto - absMonto) < 0.01 && 
                  Math.abs(new Date(p.fecha).getTime() - new Date(fecha).getTime()) <= 86400000 * 1.5
                );
              }

              const isDirectoCliente = !!matchCobro || !!matchPagoProv?._desdeRecibo;
              const matchSist = isDirectoCliente ? (matchCobro || matchPagoProv) : matchPagoProv;

              // 3. Match Banco
              let matchBanco = null;
              if (matchSist?.comprobanteValidado) {
                matchBanco = { validadoVisualmente: true, fecha: matchSist.fecha, monto: matchSist.monto, cuentaId: matchSist.cuentaId, isFake: true };
              } else if (!isDirectoCliente) {
                // Buscamos en los extractos bancarios reales importados
                const bancos = cuentas.filter((c: any) => c.tipo === "banco");
                for (const b of bancos) {
                  try {
                    const hist = JSON.parse(localStorage.getItem(`gp_concil_${b.id}`) || "[]");
                    for (const h of hist) {
                      const found = h.movimientos?.find((m: any) => 
                        (m.tipo === "debito" || m.tipo === "egreso") &&
                        Math.abs(Math.abs(m.monto) - absMonto) < 0.01 &&
                        Math.abs(new Date(m.fecha).getTime() - new Date(fecha).getTime()) <= 86400000 * 2
                      );
                      if (found) {
                        matchBanco = { ...found, cuentaId: b.id };
                        break;
                      }
                    }
                  } catch(e) {}
                  if (matchBanco) break;
                }
              }

              return { ...precarga, matchSist, matchBanco, isDirectoCliente };
            });

            const pagosSinPrecargar = pagosAsociados.filter((p: any) => {
              const diffDays = (new Date(today).getTime() - new Date(p.fecha).getTime()) / (86400000);
              if (diffDays <= 2) return false;
              return !seacPrecargas.some((sp: any) => 
                Math.abs(sp.importe - Math.abs(p.monto)) < 0.01 &&
                Math.abs(new Date(sp.fecha).getTime() - new Date(p.fecha).getTime()) <= 86400000 * 1.5
              );
            });

            const totalSistTotal = filasPrecargas.reduce((s,p)=>s + (p.matchSist?.monto || 0), 0);
            const totalBancoTotal = filasPrecargas.reduce((s,p)=>s + (p.matchBanco?.monto || 0), 0);

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Header Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                  <div style={{ background: t.surf2, padding: 12, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 10, color: t.sub, fontWeight: 700 }}>XLS SEAC</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>{fmtMoney(filasPrecargas.reduce((s,p)=>s+Math.abs(p.importe), 0))}</div>
                    <div style={{ fontSize: 10, color: t.muted }}>{filasPrecargas.length} precargas</div>
                  </div>
                  <div style={{ background: t.surf2, padding: 12, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 10, color: t.sub, fontWeight: 700 }}>VERIFICADO SISTEMA</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: t.green }}>{fmtMoney(totalSistTotal)}</div>
                    <div style={{ fontSize: 10, color: t.muted }}>{filasPrecargas.filter(p=>p.matchSist).length} matcheados</div>
                  </div>
                  <div style={{ background: t.surf2, padding: 12, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 10, color: t.sub, fontWeight: 700 }}>EJECUTADO BANCO</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: t.green }}>{fmtMoney(totalBancoTotal)}</div>
                    <div style={{ fontSize: 10, color: t.muted }}>{filasPrecargas.filter(p=>p.matchBanco).length} débitos ok</div>
                  </div>
                </div>

                <div style={{ background: t.surf2, borderRadius: 12, border: `1px solid ${t.border}`, overflow: "hidden" }}>
                  <Tbl stickyTop={0} headers={[
                    <span key="fecha" style={{ display:"inline-block", width: 80 }}>Fecha</span>, 
                    <span key="importe" style={{ display:"block", width: 120, textAlign: "right" }}>Importe</span>, 
                    "Origen", 
                    "Estado Sistema", 
                    "Estado Banco"
                  ]}>
                    {filasPrecargas.map((p, i) => (
                      <Tr key={i}>
                        <Td style={{ fontWeight: 600 }}>{fmtFechaCC(p.fecha)}</Td>
                        <Td style={{ fontWeight: 800, color: t.accent, textAlign: "right" }}>{fmtMoney(p.importe)}</Td>
                        <Td>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {p.isDirectoCliente ? (p.matchSist?.clienteId ? (clientes?.find((c:any) => c.id === p.matchSist.clienteId)?.nombre || p.matchSist?.cliente || "Cliente") : (p.matchSist?.cliente || "Cliente")) : 
                              (p.matchSist ? (cuentas.find((c:any) => c.id === p.matchSist.cuentaId)?.nombre || "Banco") : 
                              (p.matchBanco ? (cuentas.find((c:any) => c.id === p.matchBanco.cuentaId)?.nombre || "Banco") : "—"))}
                          </div>
                        </Td>
                        <Td>
                          {p.matchSist ? (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <Bdg color={t.green}>✓ PRECARGADO</Bdg>
                              <span style={{ fontSize: 9, color: t.muted, marginTop: 2 }}>{p.isDirectoCliente ? "Cobro Cliente" : "Pago"} {fmtFechaCC(p.matchSist.fecha)}</span>
                            </div>
                          ) : (
                            <Bdg color={t.red}>⚠ SIN REGISTRO</Bdg>
                          )}
                        </Td>
                        <Td>
                          {p.isDirectoCliente ? (
                            <div style={{ fontSize: 16, fontWeight: 800, color: t.sub }}>-</div>
                          ) : p.matchBanco ? (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <Bdg color={t.green}>✓ EJECUTADO</Bdg>
                              <span style={{ fontSize: 9, color: t.muted, marginTop: 2 }}>{p.matchBanco.validadoVisualmente ? "Verificado x Comprobante" : `Banco ${fmtFechaCC(p.matchBanco.fecha)}`}</span>
                            </div>
                          ) : (
                            <Bdg color={t.amber}>⏳ PENDIENTE</Bdg>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbl>
                </div>

                {pagosSinPrecargar.length > 0 && (
                  <div style={{ background: t.red + "10", border: `2px dashed ${t.red}44`, padding: 16, borderRadius: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.red, fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
                       <AlertTriangle size={18} /> ALERTAS: PAGOS NO RECONOCIDOS POR SEAC
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pagosSinPrecargar.map((p: any, i: number) => (
                        <div key={i} style={{ background: t.surf, padding: "8px 12px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${t.red}22` }}>
                          <div style={{ fontSize: 12 }}>
                            <span style={{ fontWeight: 700 }}>{fmtFechaCC(p.fecha)}</span> — 
                            <span style={{ fontWeight: 800, marginLeft: 6 }}>{fmtMoney(p.monto)}</span>
                          </div>
                          <span style={{ fontSize: 10, color: t.muted }}>Falta en XLS de SEAC (+2 días)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}



      {modalDetalle && (
        <OverlaySheet open={true} onClose={() => setModalDetalle(null)} title={`Detalle SEAC — ${fmtFechaCC(modalDetalle.fecha)}`} width={500}>
          {calcularGrupos(modalDetalle.movs.filter((m: any) => m.tipo !== SEAC_TIPO_SUPERVIELLE)).map((g: any) => (
            <div key={g.id} style={{ marginBottom: 10, padding: 10, background: t.surf, borderRadius: 8, border: `1px solid ${t.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                <span>{g.label}</span>
                <span style={{ color: g.subtotal >= 0 ? t.green : t.red }}>{fmtMoney(g.subtotal)}</span>
              </div>
              {g.movs.map((m: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: t.sub }}>
                  <span>{m.tipo}</span><span>{fmtMoney(m.importe)}</span>
                </div>
              ))}
            </div>
          ))}

          <div style={{marginTop: 14, padding: "12px 16px", background: modalDetalle.neto >= 0 ? t.greenBg : t.redBg, borderRadius: 10, border: `1px solid ${modalDetalle.neto >= 0 ? t.green : t.red}33`, display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <span style={{fontWeight: 700, color: t.text}}>Total {modalDetalle.tipo_comp.toUpperCase()}</span>
            <span style={{fontFamily: "'Consolas','Courier New',monospace", fontWeight: 800, fontSize: 18, color: modalDetalle.neto >= 0 ? t.green : t.red}}>{fmtMoney(Math.abs(modalDetalle.neto))}</span>
          </div>

          {modalDetalle.totalFactura > 0 && (
            <div style={{marginTop: 8, padding: "12px 16px", background: t.accentBg, borderRadius: 10, border: `1px solid ${t.accent}33`, display: "flex", justifyContent: "space-between", alignItems: "center"}}>
              <span style={{fontWeight: 700, color: t.text}}>Factura SEAC</span>
              <span style={{fontFamily: "'Consolas','Courier New',monospace", fontWeight: 800, fontSize: 18, color: t.accent}}>{fmtMoney(modalDetalle.totalFactura)}</span>
            </div>
          )}

          <div style={{marginTop: 14, display: "flex", gap: 10}}>
            <Btn v="outline" onClick={() => setModalDetalle(null)} full>Cerrar</Btn>
            
            {!modalDetalle.registrada && (
              <Btn onClick={() => { registrarNCND(modalDetalle); setModalDetalle(null); }} full style={{background: modalDetalle.neto >= 0 ? t.green : t.red, color: "#fff"}}>
                <Ic n="check" s={14} /> Registrar {modalDetalle.tipo_comp.toUpperCase()} {fmtMoney(Math.abs(modalDetalle.neto))}
              </Btn>
            )}

            {!modalDetalle.facturaRegistrada && modalDetalle.totalFactura > 0 && (
              <Btn v="outline" onClick={() => { generarFactura(modalDetalle); setModalDetalle(null); }} full>
                Factura {fmtMoney(modalDetalle.totalFactura)}
              </Btn>
            )}
            
            {modalDetalle.facturaRegistrada && modalDetalle.totalFactura > 0 && (
              <Btn onClick={() => {}} full style={{background: t.greenBg, color: t.green, border: "none", cursor: "default"}}>
                <Ic n="check" s={14} /> Factura {fmtMoney(modalDetalle.totalFactura)}
              </Btn>
            )}
          </div>
        </OverlaySheet>
      )}
    </div>
  );
}
