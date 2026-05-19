import React, { useState, useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import { Tbl, Tr, Td, Bdg, Fld, Inp, SearchBar, Sel, Btn, Ic } from "../../common/UIBase";
import { fmtMoney, fmtNum, getToday, normalizar, precioLista } from "../../../lib/utils";
import { exportarAExcel } from "../../../lib/excelExport";
import { calcularValorizacion } from "../../../lib/articulos/kardexLogic";

export default function ValorizacionStock({ articulos, kardex, canVerCostos }: any) {
  const { t } = useApp();
  const today = getToday();
  const [fecha, setFecha] = useState(today);
  const [busq, setBusq] = useState("");
  const [baseValuacion, setBaseValuacion] = useState(canVerCostos ? "costo" : "lista1"); // costo, lista1, lista2, lista3, lista4

  const dataStock = useMemo(() => {
    return calcularValorizacion(articulos, kardex, fecha, baseValuacion, canVerCostos, precioLista);
  }, [articulos, kardex, fecha, baseValuacion, canVerCostos]);

  const filtrados = useMemo(() => {
    const q = normalizar(busq);
    return dataStock.filter((a: any) => 
      normalizar(a.nombre).includes(q) || 
      (a.codigo || "").toLowerCase().includes(q) ||
      (a.familia || "").toLowerCase().includes(q)
    ).sort((a: any, b: any) => b._valorTotal - a._valorTotal);
  }, [dataStock, busq]);

  const totalGeneral = filtrados.reduce((s: number, a: any) => s + a._valorTotal, 0);

  const handleExportar = () => {
    const filas = filtrados.map((a: any) => [
      a.codigo || "",
      a.nombre || "",
      typeof a.familia === 'string' ? a.familia : a.familia?.nombre || "",
      a._stockAFecha,
      a._precioVal,
      a._valorTotal
    ]);

    let titulo = `Valorización Stock al ${fecha}`;
    exportarAExcel({
      titulo,
      columnas: ["CODIGO", "ARTICULO", "FAMILIA", "STOCK", "PRECIO BASE", "VALOR TOTAL"],
      filas: filas,
      fileName: `valorizacion_stock_${fecha}_${baseValuacion}.xlsx`,
      sheetName: "Valorizacion"
    });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "center", background: t.surf2, padding: "16px 20px", borderRadius: 12, flexWrap: "wrap" }}>
        <Fld label="A la fecha:" style={{ marginBottom: 0, width: 140 }}>
          <Inp type="date" value={fecha} onChange={(e: any) => setFecha(e.target.value)} />
        </Fld>
        <Fld label="Valuar según:" style={{ marginBottom: 0, width: 160 }}>
          <Sel value={baseValuacion} onChange={(e: any) => setBaseValuacion(e.target.value)}>
            {canVerCostos && <option value="costo">Costo (PPP)</option>}
            <option value="lista1">Lista de precios 1</option>
            <option value="lista2">Lista de precios 2</option>
            <option value="lista3">Lista de precios 3</option>
            <option value="lista4">Lista de precios 4</option>
          </Sel>
        </Fld>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Fld label="Filtro rápido:" style={{ marginBottom: 0 }}>
            <SearchBar value={busq} onChange={setBusq} placeholder="Buscar..." />
          </Fld>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Btn v="ghost" onClick={handleExportar} title="Exportar"><Ic n="transfer" s={14} /></Btn>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: t.sub, fontWeight: 700, textTransform: "uppercase" }}>Valorización Total</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.accent }}>{fmtMoney(totalGeneral)}</div>
          </div>
        </div>
      </div>

      <Tbl headers={["Artículo", "Código", "Familia", "Stock", "Precio Base", "Valor Subtotal"]}>
        {filtrados.map((a: any) => (
          <Tr key={a.id}>
            <Td><div style={{ fontWeight: 700 }}>{a.nombre}</div></Td>
            <Td style={{ fontFamily: "monospace", color: t.muted }}>{a.codigo || "—"}</Td>
            <Td><Bdg color={t.purple}>{typeof a.familia === 'string' ? a.familia : a.familia?.nombre || "—"}</Bdg></Td>
            <Td style={{ fontWeight: 800, color: a._stockAFecha < 0 ? t.red : t.text }}>{fmtNum(a._stockAFecha)}</Td>
            <Td style={{ color: t.sub }}>{fmtMoney(a._precioVal)}</Td>
            <Td style={{ fontWeight: 700, textAlign: "right", color: t.accent }}>{fmtMoney(a._valorTotal)}</Td>
          </Tr>
        ))}
        {filtrados.length === 0 && (
          <Tr>
            <Td colSpan={6} style={{ textAlign: "center", color: t.muted, padding: 40 }}>
              No hay artículos en stock para la fecha seleccionada.
            </Td>
          </Tr>
        )}
      </Tbl>
    </div>
  );
}
