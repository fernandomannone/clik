import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { useData } from "../../../context/DataContext";
import { Modal, Fld, Inp, Btn, OverlaySheet } from "../../common/UIBase";
import {
  fmtMoney,
  getToday,
  registrarMovimientoKardex,
} from "../../../lib/utils";
import { buildAjusteStock } from "../../../lib/articulos/ajusteStockLogic";

export default function ModalAjusteStock({
  open,
  onClose,
  articulo,
  setArticulos,
}: any) {
  const { t } = useApp();
  const { setMovimientos, conceptos, cloudSync } = useData();
  const [stockActual, setStockActual] = useState(articulo?.stock || 0);
  const [motivo, setMotivo] = useState("");
  const [fechaAjuste, setFechaAjuste] = useState(getToday());
  const [esInicial, setEsInicial] = useState(false);

  if (!open || !articulo) return null;

  const diferencia = parseFloat(stockActual) - (articulo.stock || 0);
  const costo = articulo.costo || 0;
  const valorizacion = Math.abs(diferencia) * costo;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (diferencia === 0) {
      onClose();
      return;
    }

    if (!motivo) {
      alert("Por favor ingrese un motivo/detalle para el ajuste.");
      return;
    }

    const confirmMsg =
      diferencia < 0
        ? `¿Registrar una MERMA de ${Math.abs(diferencia)} unidades?\nSe generará un GASTO de ${fmtMoney(valorizacion)}.`
        : `¿Registrar SOBRANTE de ${Math.abs(diferencia)} unidades?\nSe generará una GANANCIA de ${fmtMoney(valorizacion)}.`;

    if (!confirm(confirmMsg)) return;

    const { updatedArticulo, nKardex, nMov } = buildAjusteStock(
      articulo,
      stockActual,
      motivo,
      fechaAjuste,
      esInicial,
      conceptos || []
    );

    // 1. Update stock
    setArticulos((prev: any[]) =>
      prev.map((a) => (a.id === articulo.id ? updatedArticulo : a))
    );
    if (cloudSync?.saveToCloud) cloudSync.saveToCloud("articulos", updatedArticulo);

    // 2. Kardex Mov
    const savedK = await registrarMovimientoKardex(nKardex);
    if (savedK && cloudSync?.saveToCloud) cloudSync.saveToCloud("kardex", savedK);

    // 3. Optional Finance Mov
    if (nMov) {
      setMovimientos((prev: any[]) => [nMov, ...prev]);
      if (cloudSync?.saveToCloud) cloudSync.saveToCloud("movimientos", nMov);
    }

    onClose();
  };

  return (
    <OverlaySheet
      open={open}
      onClose={onClose}
      title="Ajuste de Inventario"
      width="500px"
    >
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: t.sub }}>Producto</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>
            {articulo.nombre}
          </div>
          <div style={{ fontSize: 13, color: t.muted }}>
            Costo unitario: <b>{fmtMoney(costo)}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              flex: 1,
              padding: "12px 16px",
              background: t.surf2,
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: t.sub,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Sistema Actual
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>
              {articulo.stock || 0}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: "12px 16px",
              background: t.accentBg,
              borderRadius: 8,
              border: `2px solid ${t.accent}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: t.accent,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Stock Físico (Real)
            </div>
            <input
              type="number"
              autoFocus
              value={stockActual}
              onChange={(e) => setStockActual(parseFloat(e.target.value) || 0)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                fontSize: 18,
                fontWeight: 800,
                outline: "none",
                color: t.text,
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginBottom: 24,
            padding: "12px 16px",
            borderRadius: 8,
            background:
              diferencia === 0 ? t.surf2 : diferencia > 0 ? t.greenBg : t.redBg,
            color: diferencia === 0 ? t.sub : diferencia > 0 ? t.green : t.red,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {diferencia === 0
                ? "Sin diferencias"
                : diferencia > 0
                  ? "Sobrante de stock"
                  : "Merma / Pérdida"}
            </span>
            <span style={{ fontWeight: 800 }}>
              {diferencia > 0 ? "+" : ""}
              {diferencia} u.
            </span>
          </div>
          {diferencia !== 0 && (
            <div style={{ fontSize: 12 }}>
              Se registrará un{" "}
              {diferencia > 0 ? "Ingreso (Ganancia)" : "Egreso (Gasto)"} por
              valorización de <b>{fmtMoney(valorizacion)}</b>.
            </div>
          )}
        </div>

        <Fld label="Fecha del Ajuste">
          <input
            type="date"
            value={fechaAjuste}
            onChange={(e) => setFechaAjuste(e.target.value)}
            style={{
              width: "100%",
              background: t.surf,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: "10px 12px",
              color: t.text,
              fontSize: 13,
              outline: "none",
            }}
          />
        </Fld>

        <Fld label="Detalle / Motivo del ajuste">
          <Inp
            value={motivo}
            onChange={(e: any) => setMotivo(e.target.value)}
            placeholder="Ej: Mercadería vencida, error de carga..."
          />
        </Fld>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: esInicial ? t.accent : t.sub,
            cursor: "pointer",
            padding: "12px 16px",
            background: esInicial ? t.accentBg : "transparent",
            borderRadius: 8,
            border: `1px solid ${esInicial ? t.accent : "transparent"}`,
            marginBottom: 24
          }}
        >
          <input
            type="checkbox"
            checked={esInicial}
            onChange={(e) => setEsInicial(e.target.checked)}
            style={{ accentColor: t.accent }}
          />
          Este es un ajuste de Stock Inicial (No genera ganancia ni afecta P&L)
        </label>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Btn v="ghost" onClick={onClose} style={{ flex: 1 }} type="button">
            Cancelar
          </Btn>
          <Btn
            type="submit"
            disabled={diferencia === 0 || !motivo}
            style={{ flex: 1 }}
          >
            Confirmar Ajuste
          </Btn>
        </div>
      </form>
    </OverlaySheet>
  );
}
