import React, { useState, useMemo, useRef } from "react";
import { useApp } from "../../../context/AppContext";
import { useData } from "../../../context/DataContext";
import { Btn, Ic, Inp, Bdg, SearchBar, Modal, Fld } from "../../common/UIBase";
import {
  fmtMoney,
  fmtNum,
  getToday,
  normalizar,
  registrarMovimientoKardex,
  parseMoney,
} from "../../../lib/utils";
import { exportarAExcel } from "../../../lib/excelExport";
import { buildControlStockBatch } from "../../../lib/articulos/ajusteStockLogic";

export default function ControlStock({
  articulos,
  setArticulos,
  canVerCostos,
}: any) {
  const { t } = useApp();
  const {
    setMovimientos,
    movimientos,
    conceptos,
    kardex,
    setKardex,
    pb,
    cloudSync,
  } = useData();
  const [conteos, setConteos] = useState<{ [key: string]: string }>({});
  const [motivoGeneral, setMotivoGeneral] = useState(
    "Control de stock semanal",
  );
  const [procesando, setProcesando] = useState(false);
  const [busq, setBusq] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAnularConfirm, setShowAnularConfirm] = useState(false);

  const [fechaAjuste, setFechaAjuste] = useState(getToday());
  const [esInicial, setEsInicial] = useState(false);

  const ultimoAjuste = useMemo(() => {
    return movimientos ? movimientos.find((m: any) => m.esAjusteStock) : null;
  }, [movimientos]);

  const anularUltimoAjuste = async () => {
    if (!ultimoAjuste) return;
    setProcesando(true);

    try {
      const kdx = kardex || [];
      const hr = ultimoAjuste.hora;
      const relacionados = kdx.filter(
        (k: any) =>
          k.documentoTipo === "CONTROL" &&
          k.fecha === ultimoAjuste.fecha &&
          (ultimoAjuste.concepto.includes(k.documentoNumero) ||
            k.documentoNumero === ultimoAjuste.concepto.split(" · ")[1]),
      );

      const revertedArticulos = articulos.map((a: any) => {
        const matchingKardex = relacionados.find((k: any) => k.artId === a.id);
        if (matchingKardex) {
          const reversa =
            matchingKardex.tipo === "ENTRADA_AJUSTE"
              ? -matchingKardex.cantidad
              : matchingKardex.cantidad;
          return { ...a, stock: a.stock + reversa };
        }
        return a;
      });

      setArticulos(revertedArticulos);

      const idsToDelete = relacionados.map((k: any) => k.id);
      const remainingKardex = kdx.filter(
        (k: any) => !idsToDelete.includes(k.id),
      );
      localStorage.setItem("clik-kardex", JSON.stringify(remainingKardex));
      setKardex(remainingKardex);
      window.dispatchEvent(new Event("kardex_updated"));

      if (cloudSync?.deleteBatchFromCloud) {
        await cloudSync.deleteBatchFromCloud("kardex", idsToDelete);
      }

      setMovimientos((prev: any[]) =>
        prev.filter((m: any) => m.id !== ultimoAjuste.id),
      );

      setShowAnularConfirm(false);
    } catch (err) {
      console.error(err);
    }
    setProcesando(false);
  };

  const articulosFiltrados = useMemo(() => {
    const q = normalizar(busq);
    return articulos.filter((a: any) => {
      if (a.estado !== "activo") return false;
      if (a.stock === 0) return false;
      if (["666", "667", "007"].includes(String(a.codigo))) return false;
      
      if (q) {
        if (!normalizar(a.nombre).includes(q) && !(a.codigo || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [articulos, busq]);

  const itemsParaAjustar = useMemo(() => {
    return articulosFiltrados
      .map((a: any) => {
        const fisico = conteos[a.id];
        const fisicoNum =
          fisico === "" || fisico === undefined ? a.stock : parseFloat(fisico);
        const dif = fisicoNum - a.stock;
        const valor = dif * (a.costo || 0);
        return { ...a, fisico, fisicoNum, dif, valor };
      })
      .filter(
        (a: any) => a.fisico !== "" && a.fisico !== undefined && a.dif !== 0,
      );
  }, [articulosFiltrados, conteos]);

  const totalDiferenciaValor = itemsParaAjustar.reduce(
    (s, a) => s + a.valor,
    0,
  );

  const exportarExcel = () => {
    let filas = [];
    articulosFiltrados.forEach((a: any) => {
      const fis = conteos[a.id];
      const fNum = fis === "" || fis === undefined ? a.stock : parseFloat(fis);
      const dif = fNum - a.stock;
      const val = dif * (a.costo || 0);

      filas.push([
        a.codigo || "",
        a.nombre || "",
        typeof a.familia === 'string' ? a.familia : a.familia?.nombre || "",
        a.costo || 0,
        a.stock || 0,
        fNum,
        dif,
        val,
      ]);
    });

    exportarAExcel({
      titulo: `Control de Stock — ${getToday()}`,
      columnas: [
        "Código",
        "Artículo",
        "Familia",
        "Costo Unit.",
        "Stock Sist.",
        "Stock Físico",
        "Diferencia",
        "Valor Dif.",
      ],
      filas: filas,
      fileName: `Control_Stock_${getToday()}.xlsx`,
    });
  };

  const procesarAjustes = async () => {
    if (itemsParaAjustar.length === 0) return;
    
    setProcesando(true);

    const { artsUpdateMap, kardexMovs, nMov } = buildControlStockBatch(
      itemsParaAjustar,
      motivoGeneral,
      fechaAjuste,
      esInicial,
      totalDiferenciaValor,
      conceptos || []
    );

    const nuevosArticulos = articulos.map((a: any) => {
      const stockObj = artsUpdateMap[a.id];
      return stockObj !== undefined ? { ...a, stock: stockObj } : a;
    });
    setArticulos(nuevosArticulos);

    const rawMovs = [];
    for (const mov of kardexMovs) {
      const nuevo = await registrarMovimientoKardex(mov);
      if (nuevo) rawMovs.push(nuevo);
    }

    if (rawMovs.length > 0 && cloudSync?.saveBatchToCloud) {
      await cloudSync.saveBatchToCloud("kardex", rawMovs);
    }

    if (nMov) {
      setMovimientos((prev: any[]) => [nMov, ...prev]);
      if (cloudSync?.saveToCloud) {
        cloudSync.saveToCloud("movimientos", nMov);
      }
    }

    setConteos({});
    setShowConfirm(false);
    setProcesando(false);
  };

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "center", background: t.surf2, padding: "16px 20px", borderRadius: 12, flexWrap: "wrap" }}>
        <Fld label="A la fecha:" style={{ marginBottom: 0, width: 140 }}>
          <Inp type="date" value={fechaAjuste} onChange={(e: any) => setFechaAjuste(e.target.value)} />
        </Fld>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Fld label="Filtro rápido:" style={{ marginBottom: 0 }}>
            <SearchBar value={busq} onChange={setBusq} placeholder="Buscar..." />
          </Fld>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {canVerCostos && (
            <div style={{ textAlign: "right", marginRight: 12 }}>
              <div style={{ fontSize: 10, color: t.sub, fontWeight: 700, textTransform: "uppercase" }}>
                {esInicial ? "Dif. Inicial" : "Dif. Total"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: totalDiferenciaValor >= 0 ? (esInicial ? t.text : t.green) : t.red }}>
                {fmtMoney(totalDiferenciaValor)}
              </div>
            </div>
          )}
          
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              color: esInicial ? t.accent : t.sub,
              cursor: "pointer",
              padding: "8px 12px",
              background: esInicial ? t.accentBg : "transparent",
              borderRadius: 8,
              border: `1px solid ${esInicial ? t.accent : "transparent"}`
            }}
          >
            <input
              type="checkbox"
              checked={esInicial}
              onChange={(e) => setEsInicial(e.target.checked)}
              style={{ accentColor: t.accent }}
            />
            Stock Inicial
          </label>

          {ultimoAjuste && (
            <Btn
              onClick={() => setShowAnularConfirm(true)}
              v="outline"
              disabled={procesando}
              style={{ padding: "0 16px", color: t.red, borderColor: `${t.red}55`, height: 38 }}
              title="Deshacer el último control de stock"
            >
              <Ic n="x" s={14} /> Anular último
            </Btn>
          )}
          <Btn onClick={exportarExcel} v="ghost" style={{ padding: "0 12px", height: 38 }} title="Exportar">
            <Ic n="transfer" s={16} />
          </Btn>
          <Btn
            onClick={() => setShowConfirm(true)}
            disabled={itemsParaAjustar.length === 0 || procesando}
            style={{ padding: "0 24px", height: 38 }}
          >
            {procesando ? "Procesando..." : `Procesar ${itemsParaAjustar.length} Ajustes`}
          </Btn>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", background: t.surf2, padding: 12, borderRadius: 8 }}>
        <div style={{ marginLeft: "auto", width: 300, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: t.sub }}>Motivo:</span>
          <select
            value={motivoGeneral}
            onChange={(e: any) => setMotivoGeneral(e.target.value)}
            style={{ width: "100%", background: t.surf, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", color: t.text, fontSize: 13, outline: "none" }}
          >
            <option value="Control de stock semanal">Control de stock semanal</option>
            <option value="Control de cierre de mes">Control de cierre de mes</option>
            <option value="Ajuste por merma">Ajuste por merma</option>
            <option value="Ajuste por rotura">Ajuste por rotura</option>
            <option value="Ajuste manual">Ajuste manual</option>
          </select>
        </div>
      </div>

      <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", background: t.surf }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: t.surf2, borderBottom: `1px solid ${t.border}` }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: t.sub }}>Artículo</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: t.sub, width: 100 }}>Sist.</th>
              <th style={{ padding: "12px 16px", textAlign: "center", color: t.accent, width: 140 }}>Físico Real</th>
              <th style={{ padding: "12px 16px", textAlign: "right", color: t.sub, width: 100 }}>Dif.</th>
              {canVerCostos && <th style={{ padding: "12px 16px", textAlign: "right", color: t.sub, width: 120 }}>Costo Unit.</th>}
              {canVerCostos && <th style={{ padding: "12px 16px", textAlign: "right", color: t.sub, width: 130 }}>Valor Dif.</th>}
            </tr>
          </thead>
          <tbody>
            {articulosFiltrados.map((a: any) => {
              const fis = conteos[a.id];
              const fNum = fis === "" || fis === undefined ? a.stock : parseFloat(fis);
              const dif = fNum - a.stock;
              const val = dif * (a.costo || 0);

              return (
                <tr key={a.id} style={{ borderBottom: `1px solid ${t.border}`, background: dif !== 0 ? (dif > 0 ? t.green + "08" : t.red + "08") : "transparent" }}>
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ fontWeight: 600 }}>{a.nombre}</div>
                    <div style={{ fontSize: 11, color: t.muted }}>{a.codigo} · {typeof a.familia === "string" ? a.familia : a.familia?.nombre || "Varios"}</div>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: t.sub }}>{fmtNum(a.stock)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "center" }}>
                    <input
                      type="number"
                      placeholder={a.stock}
                      value={conteos[a.id] || ""}
                      onChange={(e) => setConteos((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      style={{ width: 80, textAlign: "center", padding: "6px", borderRadius: 6, border: `1px solid ${dif !== 0 ? t.accent : t.border}`, background: dif !== 0 ? t.surf : t.surf2, fontWeight: 800, outline: "none" }}
                    />
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 800, color: dif === 0 ? t.muted : dif > 0 ? t.green : t.red }}>
                    {dif > 0 ? "+" : ""}{dif !== 0 ? fmtNum(dif) : "—"}
                  </td>
                  {canVerCostos && <td style={{ padding: "10px 16px", textAlign: "right", color: t.sub }}>{fmtMoney(a.costo)}</td>}
                  {canVerCostos && <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: dif === 0 ? t.muted : dif > 0 ? t.green : t.red }}>{dif !== 0 ? fmtMoney(val) : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="Confirmar Ajuste">
        <div style={{ padding: 20 }}>
          <p style={{ marginTop: 0, color: t.text, fontSize: 15 }}>
            ¿Estás seguro de procesar {itemsParaAjustar.length} ajustes de stock?
          </p>
          <div style={{ background: t.surf2, padding: 16, borderRadius: 8, marginTop: 12, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 12, color: t.sub, textTransform: "uppercase", fontWeight: 700 }}>Impacto total</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: totalDiferenciaValor >= 0 ? t.green : t.red }}>
              {fmtMoney(totalDiferenciaValor)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
            <Btn v="ghost" onClick={() => setShowConfirm(false)}>Cancelar</Btn>
            <Btn onClick={procesarAjustes}>Confirmar y procesar</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={showAnularConfirm} onClose={() => setShowAnularConfirm(false)} title="Anular último ajuste">
        <div style={{ padding: 20 }}>
          <p style={{ marginTop: 0, color: t.text, fontSize: 15 }}>
            ¿Estás seguro de anular el último ajuste de stock?
          </p>
          {ultimoAjuste && (
            <div style={{ background: t.surf2, padding: 16, borderRadius: 8, marginTop: 12, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12, color: t.sub, textTransform: "uppercase", fontWeight: 700 }}>Concepto</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>{ultimoAjuste.concepto}</div>
              <div style={{ fontSize: 12, color: t.sub, textTransform: "uppercase", fontWeight: 700 }}>Fecha</div>
              <div style={{ fontSize: 14, color: t.text }}>{ultimoAjuste.fecha}</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
            <Btn v="ghost" onClick={() => setShowAnularConfirm(false)}>Cancelar</Btn>
            <Btn v="danger" onClick={anularUltimoAjuste}>Anular ajuste</Btn>
          </div>
        </div>
      </Modal>

    </div>
  );
}

