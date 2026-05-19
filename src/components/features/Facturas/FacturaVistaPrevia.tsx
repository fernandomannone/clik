import React from "react";
import { useApp } from "../../../context/AppContext";
import { Btn, Ic, OverlaySheet } from "../../common/UIBase";
import { fmtMoney, parseMoney } from "../../../lib/utils";
import {
  compartirWsp,
  generarPDFComprobante,
  exportarExcelFactura,
} from "../../../lib/facturas/facturaExport";
import {
  nuevaNumFac,
  parseCant,
  calcItem,
} from "../../../lib/facturas/facturaLogic";

const LETRAS_LABEL: Record<string, string> = {
  B: "Consumidor Final",
  A: "Resp. Inscripto",
  C: "Monotributista",
  X: "Interna s/AFIP",
};

export default function FacturaVistaPrevia({
  facturas,
  letra,
  tipoComp,
  editando,
  fecha,
  cliente,
  condPago,
  items,
  descGlobal,
  setVistaPrevia,
  emitirFactura,
  procesando,
  total,
  descMonto,
  soloLectura,
  onEdit,
}: any) {
  const { t } = useApp();

  const titlePrefix = tipoComp === "nc" ? "Nota de Crédito" : tipoComp === "nd" ? "Nota de Débito" : "Factura";
  const numLabel = editando?.numero || (soloLectura ? "" : nuevaNumFac(facturas, letra));
  
  return (
    <OverlaySheet 
      open={true} 
      onClose={() => setVistaPrevia(false)} 
      title={`${titlePrefix} ${letra} ${numLabel ? `— ${numLabel}` : ''}`}
      sub={`${fecha} · ${letra ? LETRAS_LABEL[letra] || letra : ""}`}
      width="600px"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            padding: "16px",
            background: t.surf2,
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
            {cliente?.nombre}
          </div>
          {cliente?.telefono && (
             <div style={{ fontSize: 13, color: t.sub, marginTop: 4 }}>
               {cliente.telefono} · {cliente.localidad}
             </div>
          )}
          <div style={{ fontSize: 13, color: t.sub, marginTop: 8 }}>
            Condición:{" "}
            <span style={{ color: t.accent, fontWeight: 700 }}>
              {condPago}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", border: `1px solid ${t.border}`, borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: t.surf2, position: "sticky", top: 0 }}>
              <tr>
                {["Cód.", "Descripción", "Cant.", "Precio", "Subt."].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: t.sub,
                      textAlign: ["Cant.", "Precio", "Subt."].includes(h) ? "right" : "left",
                      textTransform: "uppercase",
                      borderBottom: `1px solid ${t.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items
                ?.filter((i: any) => i.nombre && parseCant(i.cantidad) > 0)
                .map((i: any, idx: number) => (
                  <tr key={i.id || idx} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: t.sub }}>{i.codigo}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: t.text, fontWeight: 500 }}>{i.nombre}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: t.text, textAlign: "right" }}>{i.cantidad}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: t.text, textAlign: "right", fontFamily: "monospace" }}>{fmtMoney(parseMoney(i.precio))}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: t.accent, textAlign: "right", fontFamily: "monospace" }}>{fmtMoney(calcItem(i))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "16px", background: t.surf2, borderRadius: 12 }}>
          {descGlobal && parseMoney(descGlobal) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: t.sub, marginBottom: 8 }}>
              <span>Descuento {descGlobal}%</span>
              <span style={{ color: t.red, fontWeight: 600 }}>−{fmtMoney(descMonto)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: t.text, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>Total</span>
            <span style={{ color: t.accent, fontSize: 24, fontWeight: 800, fontFamily: "monospace" }}>{fmtMoney(total)}</span>
          </div>
        </div>

        {soloLectura && (
          <div style={{ 
            padding: "12px 16px", 
            background: t.greenBg || (t.green + "15"), 
            border: `1px solid ${t.green}33`, 
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: t.green,
            fontWeight: 700,
            fontSize: 14
          }}>
            <Ic n="check" s={18} />
            ¡Comprobante guardado correctamente!
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          {!soloLectura ? (
            <Btn v="ghost" onClick={() => setVistaPrevia(false)} style={{ flex: 1 }}>
              ← Editar
            </Btn>
          ) : onEdit ? (
            <Btn v="ghost" onClick={() => onEdit(editando)} style={{ flex: 1 }}>
              <Ic n="edit" s={14} /> Editar
            </Btn>
          ) : (
            <Btn v="ghost" onClick={() => setVistaPrevia(false)} style={{ flex: 1 }}>
              <Ic n="close" s={14} /> Cerrar
            </Btn>
          )}
          <Btn v="ghost" onClick={() => generarPDFComprobante(items, cliente, fecha, condPago, tipoComp, letra, editando, facturas, descGlobal, descMonto, total)} style={{ flex: 1 }}>
            📄 PDF
          </Btn>
          <Btn v="ghost" onClick={() => exportarExcelFactura(items, cliente, fecha, condPago, tipoComp, letra, facturas, descGlobal, descMonto, total)} style={{ flex: 1 }} title="Exportar">
            <Ic n="transfer" s={14} />
          </Btn>
          <Btn
            v="ghost"
            onClick={() => compartirWsp(items, cliente, fecha, condPago, descGlobal, descMonto, total)}
            style={{ flex: 1, color: "#25d366" }}
            disabled={procesando}
          >
            WhatsApp
          </Btn>
          {!soloLectura && (
            <Btn
              onClick={() => emitirFactura()}
              style={{ flex: 2 }}
              disabled={procesando}
            >
              <Ic n="check" s={14} /> Finalizar
            </Btn>
          )}
        </div>
      </div>
    </OverlaySheet>
  );
}
