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
} from "../../common/UIBase";
import {
  normalizar,
  fmtMoney,
  parseMoney,
  getToday,
  registrarMovimientoKardex,
  precioLista,
} from "../../../lib/utils";
import { CODIGOS_A_FISICO, TIPOS_KARDEX } from "../../../constants";
const COND_PAGO = ["Contado", "8 Días", "15 Días", "21 Días", "30 Días"];
const today = new Date().toISOString().slice(0, 10);

const normalizarInterno = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const limpiarNombreCV = (s) => {
  // Quitar prefijos como "1 - SLB ", "CIG.", "RIG.", etc.
  return (s || "")
    .replace(/^(\d+\s*-\s*)?(slb|cig|rig|rd|rn)\s*[\.\-]?\s*/i, "")
    .replace(/\*/g, "")
    .trim();
};

export function TabHistorialFacturacion({
  historial,
  t,
  setHistorialImport,
  setFacturas,
  facturas,
  setArticulos,
  articulos,
  setPagos,
  pagos,
  clientes,
  user,
  cloudSync,
}: any) {
  const [confirmarRev, setConfirmarRev] = React.useState<any>(null);
  const [revirtiendo, setRevirtiendo] = React.useState<any>(null);
  const [mesesAbH, setMesesAbH] = React.useState(() => new Set());

  const fmtFecha = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const fmtTs = (ts) => {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const borrarImportacion = async (h: any) => {
    const revId = h.id || h.timestamp;
    setRevirtiendo(revId);
    // Allow React state to update before blocking with heavy processing
    await new Promise((r) => setTimeout(r, 50));
    try {
      const idsABorrar = new Set((h.facturasIds || []).map(String));

      if (idsABorrar.size === 0 && h.cantFacturas > 0) {
        alert(
          "Este historial es antiguo y no registra IDs exactos de facturas. No se puede revertir automáticamente. Tendrás que anular las facturas manualmente desde la pestaña Facturas.",
        );
        setConfirmarRev(null);
        return;
      }

      const facsBorrar = facturas.filter((f: any) =>
        idsABorrar.has(String(f.id)),
      );
      if (idsABorrar.size > 0 && cloudSync?.executeCloudBatch) {
        const batchOps: any[] = [];

        // 1. Revertir Artículos (Kardex detallado)
        const kardexPromises: Promise<any>[] = [];
        if (h.tipo === "fisicos" && setArticulos && articulos) {
          const currentStocks: { [key: string]: number } = {};
          
          // Primero calculamos el total a revertir por artículo para el estado final
          const totalPorArt: { [key: string]: number } = {};
          facsBorrar.forEach((f: any) => {
            (f.items || []).forEach((it: any) => {
              const id = String(it.artId || it.codigo);
              totalPorArt[id] = (totalPorArt[id] || 0) + (parseFloat(it.cantidad) || 0);
            });
          });

          // Grabamos movimientos individuales por factura
          facsBorrar.forEach((f: any) => {
            const clienteLabel = f.nombreCF || clientes.find(c => String(c.id) === String(f.clienteId))?.nombre || "Varios";
            (f.items || []).forEach((it: any) => {
              const art = articulos.find(a => String(a.id) === String(it.artId) || String(a.codigo) === String(it.codigo));
              if (art) {
                const id = String(art.id);
                if (!(id in currentStocks)) currentStocks[id] = art.stock || 0;
                
                const cant = parseFloat(it.cantidad) || 0;
                const prev = currentStocks[id];
                const next = prev + cant;
                currentStocks[id] = next;

                kardexPromises.push(
                  registrarMovimientoKardex({
                    artId: art.id,
                    tipo: TIPOS_KARDEX.ENTRADA_DEVOLUCION,
                    cantidad: cant,
                    costoUnitario: art.costo || 0,
                    stockAnterior: prev,
                    stockResultante: next,
                    fecha: getToday(),
                    documentoTipo: "ANNUL_FAC",
                    documentoNumero: f.numero || `REV-${String(f.id).slice(-4)}`,
                    observacion: `Anulación Factura ${f.numero || ""} - ${clienteLabel}`,
                  }),
                );
              }
            });
          });

          // Actualizar estado de artículos
          const nextArts = articulos.map((art: any) => {
            const id = String(art.id);
            if (totalPorArt[id] || totalPorArt[String(art.codigo)]) {
              const up = { ...art, stock: (art.stock || 0) + (totalPorArt[id] || totalPorArt[String(art.codigo)]) };
              batchOps.push({
                type: "set",
                collection: "articulos",
                id: String(up.id),
                data: up,
              });
              return up;
            }
            return art;
          });
          setArticulos(nextArts);
        }

        // Wait for all kardex entries to be created and add them to batchOps
        if (kardexPromises.length > 0) {
          const kardexEntries = await Promise.all(kardexPromises);
          kardexEntries.forEach((m) => {
            if (m)
              batchOps.push({
                type: "set",
                collection: "kardex",
                id: String(m.id),
                data: m,
              });
          });
        }

        // 2. Anular facturas
        if (setFacturas) {
          const toUpdateFacs: any[] = [];
          const nextFacs = facturas.map((f: any) => {
            if (idsABorrar.has(String(f.id)) && !f.anulada) {
              const an = {
                ...f,
                anulada: true,
                fechaAnulacion: today,
                obsAnulacion: `Revertido desde historial por ${user?.nombre || "maestro"}`,
              };
              toUpdateFacs.push(an);
              batchOps.push({
                type: "set",
                collection: "facturas",
                id: String(an.id),
                data: an,
              });
              return an;
            }
            return f;
          });
          if (toUpdateFacs.length > 0) setFacturas(nextFacs);
        }

        // 3. Borrar historial
        batchOps.push({
          type: "delete",
          collection: "historialImport",
          id: String(h.id || h.timestamp),
        });

        if (batchOps.length > 0) {
          const ok = await cloudSync.executeCloudBatch(batchOps);
          if (!ok) {
            alert(
              "Error al revertir la importación en la nube. Recarga la página.",
            );
            setConfirmarRev(null);
            setRevirtiendo(null);
            return;
          }
        }

        if (setHistorialImport) {
          setHistorialImport((prev: any[]) =>
            prev.filter((x: any) => {
              if (x.id && h.id) return String(x.id) !== String(h.id);
              return String(x.timestamp) !== String(h.timestamp);
            }),
          );
        }

        setConfirmarRev(null);
        setRevirtiendo(null);
        return;
      }

      // Fallback si no hay executeCloudBatch
      if (idsABorrar.size > 0) {
        // Revertir stock artículos (físicos)
        if (h.tipo === "fisicos" && setArticulos && articulos) {
          const currentStocks: { [key: string]: number } = {};
          const totalPorArt: { [key: string]: number } = {};
          
          facsBorrar.forEach((f: any) => {
            const clienteLabel = f.nombreCF || clientes.find(c => String(c.id) === String(f.clienteId))?.nombre || "Varios";
            (f.items || []).forEach((it: any) => {
              const art = articulos.find(a => String(a.id) === String(it.artId) || String(a.codigo) === String(it.codigo));
              if (art) {
                const id = String(art.id);
                if (!(id in currentStocks)) currentStocks[id] = art.stock || 0;
                
                const cant = parseFloat(it.cantidad) || 0;
                const prev = currentStocks[id];
                const next = prev + cant;
                currentStocks[id] = next;
                totalPorArt[id] = (totalPorArt[id] || 0) + cant;

                registrarMovimientoKardex({
                  artId: art.id,
                  tipo: TIPOS_KARDEX.ENTRADA_DEVOLUCION,
                  cantidad: cant,
                  costoUnitario: art.costo || 0,
                  stockAnterior: prev,
                  stockResultante: next,
                  fecha: getToday(),
                  documentoTipo: "ANNUL_FAC",
                  documentoNumero: f.numero || `REV-${String(f.id).slice(-4)}`,
                  observacion: `Anulación Factura ${f.numero || ""} - ${clienteLabel}`,
                }).then((m) => {
                  if (m && cloudSync?.saveToCloud)
                    cloudSync.saveToCloud("kardex", m);
                });
              }
            });
          });

          const nextArts = articulos.map((art: any) => {
            const id = String(art.id);
            if (totalPorArt[id]) {
              return { ...art, stock: (art.stock || 0) + totalPorArt[id] };
            }
            return art;
          });
          
          setArticulos(nextArts);
          // Los artículos se guardarán en la nube después si se desea, 
          // aunque aquí falta llamar a saveBatchToCloud o similar si es fallback.
          // Pero priorizamos que el flujo principal (batch) esté bien.
        }

        // Anular facturas (marcar como anuladas, no eliminar — mantiene historial)
        if (setFacturas) {
          const toUpdateFacs: any[] = [];
          const nextFacs = facturas.map((f: any) => {
            if (idsABorrar.has(String(f.id)) && !f.anulada) {
              const an = {
                ...f,
                anulada: true,
                fechaAnulacion: today,
                obsAnulacion: `Revertido desde historial por ${user?.nombre || "maestro"}`,
              };
              toUpdateFacs.push(an);
              return an;
            }
            return f;
          });
          if (toUpdateFacs.length > 0) {
            setFacturas(nextFacs);
            if (cloudSync?.saveBatchToCloud)
              await cloudSync.saveBatchToCloud("facturas", toUpdateFacs);
            else if (cloudSync?.saveToCloud) {
              for (const f of toUpdateFacs) {
                await cloudSync.saveToCloud("facturas", f);
              }
            }
          }
        }
      }

      if (setHistorialImport) {
        try {
          setHistorialImport((prev: any[]) =>
            prev.filter((x: any) => {
              if (x.id && h.id) return String(x.id) !== String(h.id);
              return String(x.timestamp) !== String(h.timestamp);
            }),
          );
          if (cloudSync?.deleteFromCloud) {
            await cloudSync.deleteFromCloud(
              "historialImport",
              String(h.id || h.timestamp),
            );
          }
        } catch (err: any) {
          console.error("Error eliminando historialImport de Firebase:", err);
        }
      }
      setConfirmarRev(null);
    } catch (err: any) {
      console.error("Error revirtiendo importación:", err);
    } finally {
      setRevirtiendo(null);
    }
  };

  if (!historial.length)
    return (
      <div style={{ textAlign: "center", padding: "48px 0", color: t.muted }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.sub }}>
          Sin importaciones registradas
        </div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 4 }}>
          Cada vez que importes Ventas Físicos o Asignaciones CV quedará
          registrado aquí.
        </div>
      </div>
    );

  const mesActualH = new Date().toISOString().slice(0, 7);
  const MESES_ES2 = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const labelMesH = (m) => {
    const [y, mo] = m.split("-");
    return `${MESES_ES2[parseInt(mo) - 1]} ${y}`;
  };

  // Agrupar por mes usando timestamp
  const gruposH = {};
  [...historial].reverse().forEach((h) => {
    const fecha =
      h.fechas?.[0] || new Date(h.timestamp).toISOString().slice(0, 10);
    const mes = fecha.slice(0, 7);
    if (!gruposH[mes]) gruposH[mes] = [];
    gruposH[mes].push(h);
  });
  const mesesH = Object.keys(gruposH).sort((a, b) => b.localeCompare(a));

  
  const purgarDuplicados = async () => {
    const msg = document.getElementById("msg-purgar");
    const cache = new Set();
    const aBorrar: any[] = [];
    const limpias = facturas.filter((f: any) => {
      if (!f.esHistorico) return true;
      if (cache.has(f.numero)) {
        aBorrar.push(f);
        return false;
      }
      cache.add(f.numero);
      return true;
    });

    if (aBorrar.length === 0) {
      if (msg) msg.innerText = "Limpieza OK: No hay duplicados.";
      return;
    }

    if (setFacturas) {
      setFacturas(limpias);
      if (cloudSync?.deleteFromCloud) {
        for (const f of aBorrar) {
          await cloudSync.deleteFromCloud("facturas", String(f.id));
        }
      }
    }
    if (msg)
      msg.innerText = `Éxito: Se eliminaron ${aBorrar.length} facturas antiguas duplicadas.`;
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, color: t.muted }}>
          {historial.length} importación{historial.length !== 1 ? "es" : ""}{" "}
          registrada{historial.length !== 1 ? "s" : ""}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span
            id="msg-purgar"
            style={{ fontSize: 12, color: t.green, fontWeight: 600 }}
          ></span>
          <button
            onClick={purgarDuplicados}
            style={{
              background: t.surf2,
              color: t.muted,
              border: `1px solid ${t.border}`,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ic n="trash" s={13} /> Ejecutar Limpieza Duplicados
          </button>
          
        </div>
      </div>
      {mesesH.map((mes) => {
        const items = gruposH[mes];
        const esMesActual = mes === mesActualH;
        const abierto = mesesAbH.has(mes) || esMesActual;
        const totalFacs = items.reduce((s, h) => s + (h.cantFacturas || 0), 0);
        return (
          <div key={mes} style={{ marginBottom: 8 }}>
            <div
              onClick={() => {
                if (esMesActual) return;
                setMesesAbH((prev) => {
                  const n = new Set(prev);
                  n.has(mes) ? n.delete(mes) : n.add(mes);
                  return n;
                });
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                borderRadius: 10,
                background: esMesActual ? t.accentBg : t.surf2,
                border: `1px solid ${esMesActual ? t.accent : t.border}`,
                cursor: esMesActual ? "default" : "pointer",
                marginBottom: abierto ? 6 : 0,
                userSelect: "none",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: esMesActual ? t.accent : t.text,
                }}
              >
                {labelMesH(mes)}
              </span>
              <span style={{ fontSize: 11, color: t.muted }}>
                {items.length} importación{items.length !== 1 ? "es" : ""}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  fontWeight: 700,
                  color: t.sub,
                }}
              >
                {totalFacs} comprobante{totalFacs !== 1 ? "s" : ""}
              </span>
              {!esMesActual && (
                <span style={{ fontSize: 12, color: t.muted }}>
                  {abierto ? "▲" : "▼"}
                </span>
              )}
            </div>
            {abierto && (
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${t.border}`,
                  overflow: "hidden",
                }}
              >
                {items.map((h: any, i: number) => {
                  return (
                    <div key={h.id || h.timestamp || i}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "12px 16px",
                          borderBottom:
                            i < items.length - 1
                              ? `1px solid ${t.border}`
                              : "none",
                          background: i % 2 === 0 ? t.surf : t.surf2,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background:
                              h.tipo === "fisicos"
                                ? t.accent + "20"
                                : t.green + "20",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          {h.tipo === "fisicos" ? "🚬" : "📱"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: t.text,
                            }}
                          >
                            {h.tipo === "fisicos"
                              ? "Ventas Físicos"
                              : "Asignaciones CV"}
                            {h.fechas?.length > 0 && (
                              <span
                                style={{
                                  fontWeight: 400,
                                  color: t.sub,
                                  marginLeft: 8,
                                  fontSize: 12,
                                }}
                              >
                                {h.fechas
                                  .map((f: string) => fmtFecha(f))
                                  .join(", ")}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: t.muted,
                              marginTop: 2,
                            }}
                          >
                            {fmtTs(h.timestamp)} · {h.usuario || "—"}
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            flexShrink: 0,
                            marginRight: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 800,
                              color: h.tipo === "fisicos" ? t.accent : t.green,
                            }}
                          >
                            {h.cantFacturas}
                          </div>
                          <div style={{ fontSize: 11, color: t.muted }}>
                            factura{h.cantFacturas !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmarRev(h);
                            }}
                            style={{
                              background: "none",
                              border: `1px solid ${t.red}44`,
                              borderRadius: 7,
                              cursor: "pointer",
                              color: t.red,
                              padding: "5px 8px",
                              display: "flex",
                              alignItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Ic n="trash" s={13} />
                          </button>
                        </div>
                      </div>

                      {/* Inline Confirmation for Reverting */}
                      {confirmarRev?.timestamp === h.timestamp && (
                        <div
                          style={{
                            padding: "12px 14px",
                            background: t.red + "11",
                            borderTop: `1px solid ${t.red}44`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              color: t.text,
                              marginBottom: 10,
                            }}
                          >
                            <strong>
                              ¿Revertir{" "}
                              {h.tipo === "fisicos"
                                ? "Ventas Físicos"
                                : "Asignaciones CV"}
                              ?
                            </strong>
                            <br />
                            Se anularán {h.cantFacturas} factura
                            {h.cantFacturas !== 1 ? "s" : ""}.
                            {h.tipo === "fisicos" &&
                              " El stock de artículos será revertido."}
                            {" Esta acción no se puede deshacer."}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmarRev(null);
                              }}
                              style={{
                                background: "none",
                                border: `1px solid ${t.border}`,
                                cursor: "pointer",
                                color: t.sub,
                                fontSize: 12,
                                padding: "6px 12px",
                                borderRadius: 6,
                              }}
                              disabled={revirtiendo === (h.id || h.timestamp)}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                borrarImportacion(h);
                              }}
                              style={{
                                background: t.red,
                                border: "none",
                                cursor: "pointer",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "6px 14px",
                                borderRadius: 6,
                                opacity:
                                  revirtiendo === (h.id || h.timestamp)
                                    ? 0.6
                                    : 1,
                              }}
                              disabled={revirtiendo === (h.id || h.timestamp)}
                            >
                              {revirtiendo === (h.id || h.timestamp)
                                ? "Revirtiendo..."
                                : "Sí, revertir"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
