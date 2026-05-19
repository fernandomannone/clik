import React, { useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import { OverlaySheet, Tbl, Tr, Td, Bdg, Btn, Ic, Fld } from "../../common/UIBase";
import { fmtMoney, fmtNum, fmtFechaCC } from "../../../lib/utils";
import { exportarAExcel } from "../../../lib/excelExport";
import { calcularKardexComputado, formatKardexConcepto } from "../../../lib/articulos/kardexLogic";

export default function ModalKardex({ open, onClose, articulo, kardex }: any) {
  const { t } = useApp();

  const movs = useMemo(() => {
    return calcularKardexComputado(articulo, kardex);
  }, [articulo, kardex]);

  const handleExportar = () => {
    if (!articulo) return;

    let filas: any[][] = [];
    if (movs.length > 0) {
      movs.forEach((m: any) => {
        const fmt = formatKardexConcepto(m, t);
        const stockStr = (m.stockResultanteComputado !== null && m.stockResultanteComputado !== undefined) ? m.stockResultanteComputado : "";
        filas.push([
          m.fecha,
          fmt.conceptoStrExcel,
          m._esIngreso ? m.cantidad : "",
          !m._esIngreso ? m.cantidad : "",
          stockStr,
          m.observacion || ""
        ]);
      });
    } else {
      filas.push(["", "(Sin movimientos)", "", "", articulo.stock, ""]);
    }
    
    exportarAExcel({
      titulo: `Kardex: ${articulo.nombre}`,
      columnas: ["Fecha", "Concepto", "Ingreso", "Egreso", "Stock", "Observaciones"],
      filas: filas,
      fileName: `Kardex_${articulo.codigo||'Art'}.xlsx`,
      sheetName: "Kardex"
    });
  };

  if (!open || !articulo) return null;

  return (
    <OverlaySheet open={true} onClose={onClose} title={`Kardex: ${articulo.nombre}`} width={800}>
      <div style={{ maxHeight: 500, overflowY: "auto", borderRadius: 14, marginTop: 16 }}>
        <Tbl stickyTop={0} headers={["Fecha", "Concepto", "Ingreso", "Egreso", "Stock", "Obs"]}>
          {movs.map((m: any, idx: number) => {
            const fmt = formatKardexConcepto(m, t);

            return (
              <Tr key={m.id || idx}>
                <Td style={{ whiteSpace: "nowrap" }}>{fmtFechaCC(m.fecha)}</Td>
                <Td>
                  {/* Plain bold text instead of Badge pill */}
                  <div style={{ fontSize: 13, color: t.text, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {fmt.conceptoStr}
                  </div>
                </Td>
                <Td style={{ fontWeight: 800, color: t.green, textAlign: "right", fontFamily: "'Consolas','Courier New',monospace" }}>
                  {m._esIngreso ? `+${fmtNum(m.cantidad)}` : ""}
                </Td>
                <Td style={{ fontWeight: 800, color: t.red, textAlign: "right", fontFamily: "'Consolas','Courier New',monospace" }}>
                  {!m._esIngreso ? `-${fmtNum(m.cantidad)}` : ""}
                </Td>
                <Td style={{ fontWeight: 700, textAlign: "right", fontFamily: "'Consolas','Courier New',monospace" }}>
                  {m.stockResultanteComputado !== null && m.stockResultanteComputado !== undefined ? fmtNum(m.stockResultanteComputado) : "—"}
                </Td>
                <Td style={{ fontSize: 11, color: t.sub }}>{m.observacion || "—"}</Td>
              </Tr>
            );
          })}
          {movs.length === 0 && (
            <Tr>
              <Td colSpan={6} style={{ textAlign: "center", padding: 40, color: t.muted }}>
                No hay movimientos en el Kardex para este artículo en este período.
              </Td>
            </Tr>
          )}
        </Tbl>
      </div>

      <div style={{ marginTop: 32 }}>
        <Btn full onClick={handleExportar} v="outline" title="Exportar"><Ic n="transfer" s={14} /></Btn>
      </div>
    </OverlaySheet>
  );
}
