import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Btn, Ic } from "../../common/UIBase";
import { extraerFacturaProveedor } from "../../../services/aiInvoices";

export function TestFacturaIA({ open, onClose, proveedores, articulos }: any) {
  const { t } = useApp();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        const fileInput = {
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        };

        const res = await extraerFacturaProveedor(fileInput, proveedores, articulos);
        setResult(res);
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setLoading(false);
      setResult({ success: false, data: null, error: String(error) });
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Prueba Extracción de Factura IA" width="900px">
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ color: t.sub }}>
          Sube una imagen o PDF de una factura de compra detallada, especialmente esas con impuestos internos variables o formatos complejos, para que la Inteligencia Artificial extraiga todos sus detalles.
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          <Btn onClick={() => document.getElementById("file_factura_ia")?.click()}>
            <Ic n="upload" /> Subir Factura (Imagen o PDF)
          </Btn>
          <input
            id="file_factura_ia"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        {loading && (
          <div style={{ padding: 16, background: t.accentBg, border: `1px solid ${t.accent}`, borderRadius: 8, color: t.accent, fontWeight: "bold", textAlign: "center" }}>
            Analizando comprobante a prueba de fallos... Esto puede demorar unos segundos.
          </div>
        )}

        {result && (
          <div style={{ background: t.surf2, padding: 16, borderRadius: 8, border: `1px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0, color: result.success ? "#2e7d32" : "#c62828" }}>
              {result.success ? "Extracción exitosa" : "Cuidado, se produjo un error en la extracción"}
            </h3>
            
            <div style={{ display: "flex", gap: 20 }}>
                {result.data && (
                    <div style={{ flex: 1 }}>
                        <h4 style={{ margin: "0 0 8px 0", color: t.text }}>Cabecera y Totales:</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", fontSize: 13, color: t.text }}>
                             <div><strong>Proveedor:</strong> {result.data.proveedorMatch}</div>
                             <div><strong>CUIT:</strong> {result.data.cuitProveedor}</div>
                             <div><strong>Fecha:</strong> {result.data.fechaMatch}</div>
                             <div><strong>Nº Factura:</strong> {result.data.numeroFactura}</div>
                             <div><strong>Subtotal:</strong> ${result.data.subtotalGlobal}</div>
                             <div><strong>IVA Total:</strong> ${result.data.ivaGlobal}</div>
                             <div><strong>Imp. Internos:</strong> ${result.data.impuestosInternosGlobal}</div>
                             <div><strong>Total Final:</strong> ${result.data.totalGlobal}</div>
                        </div>
                    </div>
                )}
            </div>

            {result.data?.items && result.data.items.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                     <h4 style={{ margin: "0 0 8px 0", color: t.text }}>Ítems extraídos:</h4>
                     <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                         <thead>
                             <tr style={{ background: "rgba(0,0,0,0.05)" }}>
                                 <th style={{ padding: 6, textAlign: "left", border: `1px solid ${t.border}` }}>Cód</th>
                                 <th style={{ padding: 6, textAlign: "left", border: `1px solid ${t.border}` }}>Descripción</th>
                                 <th style={{ padding: 6, textAlign: "center", border: `1px solid ${t.border}` }}>Cant.</th>
                                 <th style={{ padding: 6, textAlign: "right", border: `1px solid ${t.border}` }}>P. Unit.</th>
                                 <th style={{ padding: 6, textAlign: "right", border: `1px solid ${t.border}` }}>Imp. Int.</th>
                                 <th style={{ padding: 6, textAlign: "right", border: `1px solid ${t.border}` }}>Subtotal</th>
                             </tr>
                         </thead>
                         <tbody>
                             {result.data.items.map((it: any, i: number) => (
                                 <tr key={i}>
                                     <td style={{ padding: 6, border: `1px solid ${t.border}`, color: t.text }}>{it.codigo}</td>
                                     <td style={{ padding: 6, border: `1px solid ${t.border}`, color: t.text }}>{it.descripcion}</td>
                                     <td style={{ padding: 6, border: `1px solid ${t.border}`, color: t.text, textAlign: "center" }}>{it.cantidad}</td>
                                     <td style={{ padding: 6, border: `1px solid ${t.border}`, color: t.text, textAlign: "right" }}>${it.precioUnitario}</td>
                                     <td style={{ padding: 6, border: `1px solid ${t.border}`, color: t.text, textAlign: "right" }}>${it.impuestosInternos}</td>
                                     <td style={{ padding: 6, border: `1px solid ${t.border}`, color: t.text, textAlign: "right" }}>${it.subtotal}</td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                </div>
            )}

            <div style={{ marginTop: 10 }}>
                <h4 style={{ margin: "0 0 8px 0", color: t.text }}>JSON Crudo de Respuesta:</h4>
                <pre style={{ fontSize: 11, color: t.sub, whiteSpace: "pre-wrap", margin: 0, padding: 10, background: "rgba(0,0,0,0.05)", borderRadius: 4 }}>
                {JSON.stringify(result.data || result.error, null, 2)}
                </pre>
            </div>
            
            {result.rawText && !result.success && (
              <pre style={{ fontSize: 12, color: "red", marginTop: 10, whiteSpace: "pre-wrap" }}>
                  Error Raw Text:
                {result.rawText}
              </pre>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
