import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  Modal,
  Tbl,
  Tr,
  Td,
  Bdg,
  Btn,
  Ic,
  Fld,
  Inp,
  InpMoney,
  Sel,
  Card,
  OverlaySheet,
  KPI,
} from "../../common/UIBase";
import {
  normalizar,
  fmtMoney,
  parseMoney,
  getToday,
  registrarMovimientoKardex,
  precioLista,
} from "../../../lib/utils";
import XLSX from "xlsx-js-style";
import { CODIGOS_A_FISICO, TIPOS_KARDEX } from "../../../constants";
import { BuscadorCliente } from "./BuscadorCliente";
import { buildImportacionCV } from "../../../lib/importing_logic/importCVLogic";
const COND_PAGO = ["Contado", "8 Días", "15 Días", "21 Días", "30 Días"];
const today = new Date().toISOString().slice(0, 10);

const normalizarInterno = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isCigClient = (c: any) => {
  if (!c || !c.nombre) return false;
  const n = c.nombre.trim().toLowerCase();
  return n.startsWith("cig.") || n.startsWith("cig ") || n === "cig";
};

const limpiarNombreCV = (s) => {
  // Quitar prefijos como "1 - SLB ", "CIG.", "RIG.", etc.
  return (s || "")
    .replace(/^(\d+\s*-\s*)?(slb|cig|rig|rd|rn)\s*[\.\-]?\s*/i, "")
    .replace(/\*/g, "")
    .trim();
};

// ─── IMPORTAR CV ──────────────────────────────────────────────────────────────

export function ImportarCV({
  clientes,
  setClientes,
  facturas,
  setFacturas,
  articulos = [],
  user,
  historialImport = [],
  setHistorialImport,
  cloudSync,
}: any) {
  const { t } = useApp();
  const clientesCV = React.useMemo(
    () => clientes.filter((c) => !isCigClient(c)),
    [clientes],
  );
  const [paso, setPaso] = useState(1);
  const [filas, setFilas] = useState([]);
  const [fechaFac, setFechaFac] = useState(today);
  const [letraFac, setLetraFac] = useState("B");
  const [condPago, setCondPago] = useState("Contado");
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [asignaciones, setAsignaciones] = useState({}); // nombreCV → clienteId asignado manualmente
  const [nombresCF, setNombresCF] = useState({}); // nombreCV → nombre real del CF
  const [guardarAliasesCV, setGuardarAliasesCV] = useState(true);
  const [fileName, setFileName] = useState("");
  const [warningImport, setWarningImport] = useState("");

  const buscarClienteCV = (nombreCV) => {
    const limpio = limpiarNombreCV(nombreCV);
    // Cliente "1" en el Excel → buscar "Oficina" en el sistema
    if (limpio.trim() === "1" || normalizarInterno(limpio) === "1") {
      const oficina = clientesCV.find((c) =>
        normalizarInterno(c.nombre).includes("oficina"),
      );
      if (oficina) return oficina;
    }
    const n = normalizarInterno(limpio);
    const nOriginal = normalizarInterno(nombreCV); // también buscar con el nombre original sin limpiar

    // 1. Buscar por nombreCV (alias exacto — con nombre original Y con nombre limpio)
    const porNombreCV = clientesCV.find((c) => {
      if (!c.nombreCV) return false;
      const aliases = Array.isArray(c.nombreCV) ? c.nombreCV : [c.nombreCV];
      return aliases.some((a) => {
        const na = normalizarInterno(a);
        const naLimpio = normalizarInterno(limpiarNombreCV(a));
        return (
          na === nOriginal ||
          na === n ||
          naLimpio === n ||
          naLimpio === nOriginal
        );
      });
    });
    if (porNombreCV) return porNombreCV;
    // 2. Buscar por nombre del cliente (tolerante a tildes y espacios)
    return (
      clientesCV.find((c) => normalizarInterno(c.nombre) === n) ||
      clientesCV.find((c) => normalizarInterno(c.nombre) === nOriginal) ||
      clientesCV.find(
        (c) => normalizarInterno(limpiarNombreCV(c.nombre)) === n,
      ) ||
      clientesCV.find(
        (c) =>
          normalizarInterno(c.nombre).startsWith(n) ||
          n.startsWith(normalizarInterno(c.nombre)),
      ) ||
      clientesCV.find((c) =>
        normalizarInterno(c.nombre)
          .split(" ")
          .every((p) => p.length > 2 && n.includes(p)),
      )
    );
  };

  const procesarArchivo = async (file) => {
    setError("");
    setProcesando(true);
    setWarningImport("");
    setFileName(file.name);
    // Intentar extraer fecha del nombre del archivo (formatos: 01-04-2026, 01_04_2026, 20260401, 2026-04-01)
    const nombre = file.name;
    const matchDMY = nombre.match(/(\d{2})[-_\/](\d{2})[-_\/](\d{4})/);
    const matchYMD = nombre.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
    const matchYMD2 = nombre.match(/(\d{4})(\d{2})(\d{2})/);
    if (matchDMY) {
      const fecha = `${matchDMY[3]}-${matchDMY[2]}-${matchDMY[1]}`;
      if (fecha >= "2020-01-01" && fecha <= "2030-12-31") setFechaFac(fecha);
    } else if (matchYMD) {
      const fecha = `${matchYMD[1]}-${matchYMD[2]}-${matchYMD[3]}`;
      if (fecha >= "2020-01-01" && fecha <= "2030-12-31") setFechaFac(fecha);
    } else if (matchYMD2) {
      const fecha = `${matchYMD2[1]}-${matchYMD2[2]}-${matchYMD2[3]}`;
      if (fecha >= "2020-01-01" && fecha <= "2030-12-31") setFechaFac(fecha);
    }
    try {
      const isXLS =
        file.name.toLowerCase().endsWith(".xls") &&
        !file.name.toLowerCase().endsWith(".xlsx");

      if (isXLS) {
        // XLS de SEAC = HTML disfrazado, leer como texto
        const text = await file.text();
        const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        const stripTags = (s) =>
          s
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .trim();
        const rows = [];
        let trMatch;
        while ((trMatch = trRe.exec(text)) !== null) {
          const cells = [];
          const tdRe2 = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
          let tdMatch;
          while ((tdMatch = tdRe2.exec(trMatch[1])) !== null)
            cells.push(stripTags(tdMatch[1]));
          if (cells.length >= 2 && cells.some((c) => c.trim()))
            rows.push(cells);
        }
        procesarRows(rows, file.name);
      } else {
        // XLSX real
        /* let XLSX */
        /* wait logic removed */
        /* throw removed */
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        // Convertir a array de strings para compatibilidad
        // Mantener valores nativos para detectar números correctamente
        const rowsNorm = rows.map((r: any) =>
          (r || []).map((v: any) => (v === null || v === undefined ? "" : v)),
        );
        procesarRows(rowsNorm, file.name);
      }
    } catch (err) {
      setError("Error al procesar: " + err.message);
    }
    setProcesando(false);
  };

  const procesarRows = (rows, currentFileName) => {
    if (!rows.length) {
      setError("No se encontraron datos.");
      return;
    }
    const header = rows[0].map((h) =>
      String(h).replace(/\s+/g, " ").trim().toLowerCase(),
    );
    // Buscar "cliente" exacto (no "idcliente")
    const idxNombreExacto = header.findIndex((h) => h === "cliente");
    const idxNombre =
      idxNombreExacto >= 0
        ? idxNombreExacto
        : header.findIndex((h) => h.includes("cliente") && !h.includes("id"));
    const idxImporte = header.findIndex((h) => h.includes("importe"));
    if (idxNombre < 0 || idxImporte < 0) {
      setError("El archivo no tiene el formato esperado.");
      return;
    }

    const datos = rows
      .slice(1)
      .filter((r) => {
        const col0 = String(r[0] || "")
          .toLowerCase()
          .trim();
        const nombre = String(r[idxNombre] || "").trim();
        return (
          col0 !== "totales" && nombre && nombre.toLowerCase() !== "totales"
        );
      })
      .map((r) => {
        const nombreCV = String(r[idxNombre]).trim();
        const raw = r[idxImporte];
        // Si SheetJS ya devuelve un número nativo, usarlo directamente
        let importe = 0;
        if (typeof raw === "number") {
          importe = raw;
        } else {
          const rawStr = String(raw || "0").trim();
          const esNegativo = rawStr.startsWith("-") || rawStr.startsWith("(");
          const limpio = rawStr.replace(/[^0-9.,]/g, "");
          if (limpio) {
            const ultimaComa = limpio.lastIndexOf(",");
            const ultimoPunto = limpio.lastIndexOf(".");
            if (ultimaComa > ultimoPunto) {
              // Formato argentino: 10.500,50 → coma es decimal
              importe =
                parseFloat(limpio.replace(/\./g, "").replace(",", ".")) || 0;
            } else if (ultimoPunto > ultimaComa) {
              // Formato anglosajón o punto como decimal: 10,500.50 o 10500.50
              importe = parseFloat(limpio.replace(/,/g, "")) || 0;
            } else {
              importe = parseFloat(limpio) || 0;
            }
          }
          importe = importe * (esNegativo ? -1 : 1);
        }
        const cliente = buscarClienteCV(nombreCV);
        const clienteId =
          cliente?.id !== undefined
            ? cliente.id
            : asignaciones[nombreCV] !== undefined
              ? asignaciones[nombreCV]
              : null;
        const clienteAsig =
          clienteId !== null && clienteId !== undefined && !cliente
            ? clientesCV.find((c) => String(c.id) === String(clienteId))
            : cliente;
        return {
          nombreCV,
          importe,
          clienteId,
          clienteNombre: clienteAsig?.nombre || null,
        };
      })
      .filter((r) => r.importe !== 0);

    if (!datos.length) {
      setError("No se encontraron filas con importe válido.");
      return;
    }
    setFilas(datos);

    // El estado fechaFac podría no estar actualizado aún si se detectó por nombre en procesarArchivo.
    // Usamos la fecha extraída provisoria si está habilitado un match previo en el nombre... ah, la seteamos antes.
    // Solo mostramos warning por filename por ahora, o chequeamos historial
    if (
      historialImport &&
      historialImport.some(
        (h: any) => h.tipo === "cv" && h.fileName === currentFileName,
      )
    ) {
      setWarningImport(
        `Advertencia: El archivo "${currentFileName}" parece que ya ha sido importado con anterioridad.`,
      );
    }

    setPaso(2);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (file) procesarArchivo(file);
  };

  const confirmar = async () => {
    if (confirmando) return; // evitar doble ejecución
    setConfirmando(true);
    try {
      const { nuevasConNum, kardexNuevos, nuevoH } = buildImportacionCV(
        filas,
        facturas,
        articulos,
        clientesCV,
        nombresCF,
        letraFac,
        condPago,
        fechaFac,
        user?.nombre || "",
        fileName,
        TIPOS_KARDEX
      );

      if (typeof window !== "undefined" && kardexNuevos.length > 0) {
        const saved = localStorage.getItem("clik-kardex");
        const kardexActual = saved ? JSON.parse(saved) : [];
        const arr = [...kardexActual, ...kardexNuevos];
        localStorage.setItem("clik-kardex", JSON.stringify(arr));
        window.dispatchEvent(new Event("kardex_updated"));
      }

      let clientesModificados: any[] = [];
      if (guardarAliasesCV && Object.keys(asignaciones).length) {
        clientesModificados = clientes
          .map((c) => {
            const nombresCVDelliente = Object.entries(asignaciones)
              .filter(([, id]) => String(id) === String(c.id))
              .map(([nombreCV]) => nombreCV);

            if (!nombresCVDelliente.length) return null;

            const existentes = Array.isArray(c.nombreCV)
              ? c.nombreCV
              : c.nombreCV
                ? [c.nombreCV]
                : [];
            const filtrados = nombresCVDelliente.filter(
              (nn) => !existentes.some((a) => normalizar(a) === normalizar(nn)),
            );
            if (!filtrados.length) return null;

            return { ...c, nombreCV: [...existentes, ...filtrados] };
          })
          .filter(Boolean);

        if (setClientes && clientesModificados.length > 0) {
          setClientes((prev) =>
            prev.map((c) => {
              const mod = clientesModificados.find((m) => m.id === c.id);
              return mod || c;
            }),
          );
        }
      }

      if (cloudSync?.executeCloudBatch) {
        const batchOps: any[] = [];
        nuevasConNum.forEach((f) =>
          batchOps.push({
            type: "set",
            collection: "facturas",
            id: String(f.id),
            data: f,
          }),
        );
        clientesModificados.forEach((c) =>
          batchOps.push({
            type: "set",
            collection: "clientes",
            id: String(c.id),
            data: c,
          }),
        );
        kardexNuevos.forEach((k) =>
          batchOps.push({
            type: "set",
            collection: "kardex",
            id: String(k.id),
            data: k,
          }),
        );
        batchOps.push({
          type: "set",
          collection: "historialImport",
          id: String(nuevoH.id),
          data: nuevoH,
        });

        if (batchOps.length > 0) {
          await cloudSync.executeCloudBatch(batchOps);
        }
      } else {
        if (cloudSync?.saveBatchToCloud && nuevasConNum.length > 0) {
          cloudSync.saveBatchToCloud("facturas", nuevasConNum);
        }
        if (cloudSync?.saveBatchToCloud && clientesModificados.length > 0) {
          cloudSync.saveBatchToCloud("clientes", clientesModificados);
        }
        if (cloudSync?.saveBatchToCloud && kardexNuevos.length > 0) {
          cloudSync.saveBatchToCloud("kardex", kardexNuevos);
        }
        if (cloudSync?.saveToCloud)
          cloudSync.saveToCloud("historialImport", nuevoH, String(nuevoH.id));
      }

      const facturasActualizadas = [...facturas, ...nuevasConNum].filter(
        (v, i, a) => a.findIndex((t) => String(t.id) === String(v.id)) === i,
      );
      setFacturas(facturasActualizadas);
      if (setHistorialImport) {
        setHistorialImport((prev: any[]) =>
          [...prev, nuevoH].filter(
            (v, i, a) =>
              a.findIndex(
                (t) =>
                  String(t.id || t.timestamp) === String(v.id || v.timestamp),
              ) === i,
          ),
        );
      }
      setPaso(3);
    } catch (e) {
      console.error(e);
      alert("Ocurrió un error al guardar en la nube. Reintentá.");
    } finally {
      setConfirmando(false);
    }
  };

  const sinMatch = filas.filter(
    (f) => f.clienteId === null || f.clienteId === undefined,
  );
  const conMatch = filas.filter(
    (f) => f.clienteId !== null && f.clienteId !== undefined,
  );
  // Clientes únicos con match (una factura por cliente agrupado)
  const clientesUnicos = [...new Set(conMatch.map((f) => f.clienteId))];
  const totalImporte = conMatch.reduce((s, f) => s + f.importe, 0);

  if (paso === 3)
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: t.green,
            marginBottom: 8,
          }}
        >
          Importación completada
        </div>
        <div style={{ fontSize: 14, color: t.sub, marginBottom: 24 }}>
          Se generaron <strong>{conMatch.length} facturas</strong> por un total
          de <strong>{fmtMoney(totalImporte)}</strong>
        </div>
        {sinMatch.length > 0 && (
          <div
            style={{
              display: "inline-block",
              background: t.amberBg,
              border: `1px solid ${t.amber}33`,
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 13,
              color: t.amber,
              marginBottom: 24,
            }}
          >
            {sinMatch.length} cliente{sinMatch.length > 1 ? "s" : ""} sin
            coincidencia no fueron facturados
          </div>
        )}
        <div>
          <Btn
            onClick={() => {
              setPaso(1);
              setFilas([]);
              setFileName("");
              setWarningImport("");
            }}
          >
            Importar otro reporte
          </Btn>
        </div>
      </div>
    );

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer?.files[0];
        if (f) procesarArchivo(f);
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: t.text,
            marginBottom: 4,
          }}
        >
          Importar Asignaciones Realizadas
        </div>
        <div style={{ fontSize: 13, color: t.sub }}>
          Cargá el archivo generado por la web de SEAC. Se crearán facturas
          automáticamente para cada cliente según el nombre y el importe
          asignado.
        </div>
      </div>

      {/* Paso 1: subir archivo */}
      {paso === 1 && (
        <>
          {/* Config */}
          <Card style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: t.sub,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Configuración de las facturas a generar
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Fld label="Fecha real de la asignación" half>
                <Inp
                  type="date"
                  value={fechaFac}
                  onChange={(e) => setFechaFac(e.target.value)}
                />
              </Fld>
              <Fld label="Tipo de factura" half>
                <Sel
                  value={letraFac}
                  onChange={(e) => setLetraFac(e.target.value)}
                >
                  {["A", "B", "C", "X"].map((l) => (
                    <option key={l} value={l}>
                      Factura {l}
                    </option>
                  ))}
                </Sel>
              </Fld>
              <Fld label="Condición de pago">
                <Sel
                  value={condPago}
                  onChange={(e) => setCondPago(e.target.value)}
                >
                  {COND_PAGO.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Sel>
              </Fld>
            </div>
            {(() => {
              // Advertencia si ya hay facturas CV importadas para esta fecha
              const facsFecha = facturas.filter(
                (f) =>
                  f.fecha === fechaFac &&
                  !f.anulada &&
                  f.items?.some(
                    (i) => i.codigo === "044" || i.nombre === "SALDO CV",
                  ),
              );
              if (warningImport)
                return (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 12px",
                      background: t.amberBg,
                      border: `1px solid ${t.amber}44`,
                      borderRadius: 8,
                      fontSize: 12,
                      color: t.amber,
                      fontWeight: 600,
                    }}
                  >
                    {warningImport}
                  </div>
                );
              if (!facsFecha.length) return null;
              return (
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    background: t.amberBg,
                    border: `1px solid ${t.amber}44`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: t.amber,
                    fontWeight: 600,
                  }}
                >
                  ⚠ Ya existen {facsFecha.length} factura
                  {facsFecha.length !== 1 ? "s" : ""} CV para el {fechaFac}.
                  Verificá antes de continuar para evitar duplicados.
                </div>
              );
            })()}
          </Card>

          {/* Drop zone */}
          <label
            style={{
              display: "block",
              border: `2px dashed ${t.border}`,
              borderRadius: 14,
              padding: "48px 24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.15s",
              background: t.surf2,
            }}
          >
            <input
              id="fileInputImportarCV"
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) procesarArchivo(f);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: t.text,
                marginBottom: 6,
              }}
            >
              Arrastrá la planilla aquí
            </div>
            <div style={{ fontSize: 13, color: t.sub, marginBottom: 12 }}>
              o hacé click para seleccionarla
            </div>
            <div
              style={{
                display: "inline-block",
                background: t.accentBg,
                border: `1px solid ${t.accent}`,
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 12,
                color: t.accent,
                fontWeight: 600,
              }}
            >
              Archivos .xlsx o .xls
            </div>
          </label>
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: t.redBg,
                border: `1px solid ${t.red}33`,
                borderRadius: 8,
                fontSize: 13,
                color: t.red,
              }}
            >
              {error}
            </div>
          )}
        </>
      )}

      {/* Paso 2: preview */}
      {paso === 2 && (
        <>
          {/* Resumen */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <KPI
              label="Con coincidencia"
              value={clientesUnicos.length}
              sub={
                clientesUnicos.length === conMatch.length
                  ? "Se generarán facturas"
                  : `${conMatch.length} líneas → ${clientesUnicos.length} facturas`
              }
              color={t.green}
            />
            <KPI
              label="Sin coincidencia"
              value={sinMatch.length}
              sub="No se facturarán"
              color={t.amber}
            />
            <KPI
              label="Total a facturar"
              value={fmtMoney(totalImporte)}
              sub={`Factura ${letraFac} · ${fechaFac}`}
              color={t.accent}
            />
          </div>

          {/* Tabla preview */}
          <div style={{background:t.surf2,borderRadius:8,border:`1px solid ${t.border}`,maxHeight:300,overflowY:"auto",marginBottom:14}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead style={{position:"sticky", top:0, zIndex:10, background:t.surf2}}>
                <tr>
                  <th style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:t.sub,fontSize:11,borderBottom:`1px solid ${t.border}`}}>Nombre en CV</th>
                  <th style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:t.sub,fontSize:11,borderBottom:`1px solid ${t.border}`}}>Cliente en Clik</th>
                  <th style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:t.sub,fontSize:11,borderBottom:`1px solid ${t.border}`}}>Importe</th>
                  <th style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:t.sub,fontSize:11,borderBottom:`1px solid ${t.border}`}}>Estado</th>
                  <th style={{padding:"7px 10px",borderBottom:`1px solid ${t.border}`}}></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const sinMatch =
                    f.clienteId === null || f.clienteId === undefined;
                  return (
                    <tr
                      key={i}
                      style={{ background: sinMatch ? t.amber + "08" : "", borderBottom: `1px solid ${t.border}44` }}
                    >
                      <td
                        style={{
                          padding: "7px 10px",
                          fontFamily: "'Consolas','Courier New',monospace",
                          fontSize: 12,
                          color: t.sub,
                        }}
                      >
                        {f.nombreCV}
                      </td>
                      <td style={{ padding: "7px 10px" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <BuscadorCliente
                              clientes={clientesCV}
                              valor={f.clienteId || null}
                              onChange={(cid) => {
                                setAsignaciones((prev) => ({
                                  ...prev,
                                  [f.nombreCV]: cid,
                                }));
                                setFilas((prev) =>
                                  prev.map((x) =>
                                    x.nombreCV === f.nombreCV
                                      ? {
                                          ...x,
                                          clienteId: cid,
                                          clienteNombre:
                                            clientesCV.find(
                                              (c) => String(c.id) === String(cid),
                                            )?.nombre || null,
                                        }
                                      : x,
                                  ),
                                );
                              }}
                              t={t}
                              placeholder="Buscar cliente..."
                            />
                            {String(f.clienteId) === "0" && (
                              <Inp
                                value={nombresCF[f.nombreCV] || ""}
                                onChange={(e) =>
                                  setNombresCF((prev) => ({
                                    ...prev,
                                    [f.nombreCV]: e.target.value,
                                  }))
                                }
                                placeholder="Nombre del comprador (para el comprobante)"
                                style={{ fontSize: 12 }}
                              />
                            )}
                          </div>
                      </td>
                      <td style={{ padding: "7px 10px", fontWeight: 700, color: t.accent }}>
                        {fmtMoney(f.importe)}
                      </td>
                      <td style={{ padding: "7px 10px" }}>
                        {f.clienteId !== null && f.clienteId !== undefined && f.clienteId !== -1 ? (
                          <Bdg color={f.importe < 0 ? t.amber : t.green}>
                            {f.importe < 0 ? "↩ NC" : "✓ Se factura"}
                          </Bdg>
                        ) : (
                          <Bdg color={t.muted}>⚠ Sin asignar</Bdg>
                        )}
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>
                        {(f.clienteId !== null && f.clienteId !== undefined) && (
                            <button
                              onClick={() => {
                                setAsignaciones((prev) => ({
                                  ...prev,
                                  [f.nombreCV]: -1,
                                }));
                                setFilas((prev) =>
                                  prev.map((x) =>
                                    x.nombreCV === f.nombreCV
                                      ? {
                                          ...x,
                                          clienteId: null,
                                          clienteNombre: null,
                                        }
                                      : x,
                                  ),
                                );
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: t.red,
                                fontSize: 13,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                              }}
                              title="Limpiar asignación"
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = t.red + "22")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "none")
                              }
                            >
                              <Ic n="eliminar" s={14} />
                            </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sinMatch.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: "9px 14px",
                background: t.amber + "12",
                border: `1px solid ${t.amber}33`,
                borderRadius: 8,
                fontSize: 12,
                color: t.amber,
              }}
            >
              ⚠ {sinMatch.length} sin coincidencia — al asignarlos manualmente
              el sistema guardará el nombre CV para futuras importaciones.
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              alignItems: "center",
            }}
          >
            <button
              onClick={() => {
                setPaso(1);
                setFilas([]);
              }}
              style={{
                background: t.surf2,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13,
                cursor: "pointer",
                color: t.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontWeight: 600,
              }}
            >
              <Ic n="arrow-left" s={14} /> Volver
            </button>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {Object.keys(asignaciones).length > 0 && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: t.sub,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={guardarAliasesCV}
                    onChange={(e) => setGuardarAliasesCV(e.target.checked)}
                    style={{
                      width: 14,
                      height: 14,
                      cursor: "pointer",
                      accentColor: t.accent,
                    }}
                  />
                  <span>
                    Recordar asignaciones manuales para futuras importaciones
                  </span>
                </label>
              )}
              <Btn
                onClick={confirmar}
                disabled={
                  !conMatch.length || confirmando || sinMatch.length > 0
                }
                style={{ whiteSpace: "nowrap" }}
              >
                <Ic n="check" s={14} />
                {confirmando
                  ? "Procesando..."
                  : "Confirmar y generar " + conMatch.length + " facturas"}
              </Btn>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── IMPORTAR VENTAS FÍSICOS ─────────────────────────────────────────────────
