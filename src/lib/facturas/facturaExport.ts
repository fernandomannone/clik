import { fmtMoney, parseMoney } from "../../lib/utils";
import { nuevaNumFac, calcItem } from "./facturaLogic";
import { exportarAExcel } from "../../lib/excelExport";

export const htmlComprobante = (
  items: any[],
  fecha: string,
  cliente: any,
  descGlobal: string,
  descMonto: number,
  total: number,
  autoprint = false
) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comprobante</title><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:620px;margin:0 auto}
  .acciones{display:flex;gap:10px;margin-bottom:24px;justify-content:flex-end}
  .acciones button{padding:8px 18px;border-radius:7px;border:none;cursor:pointer;font-size:13px;font-weight:600;font-family:Arial,sans-serif}
  .btn-imp{background:#111;color:#fff}.btn-pdf{background:#4f7cff;color:#fff}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:14px;border-bottom:2px solid #111}
  .cliente{background:#f5f5f5;padding:12px 16px;border-radius:8px;margin:12px 0;font-size:13px;line-height:1.7}
  table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12px}
  th{background:#f0f0f0;padding:7px 9px;text-align:left;border-bottom:2px solid #ccc;font-size:11px;letter-spacing:.4px}
  td{padding:7px 9px;border-bottom:1px solid #eee}
  .desc{text-align:right;font-size:13px;color:#c00;margin:4px 0}
  .total-box{border-top:2px solid #111;margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;align-items:center}
  .total-label{font-size:15px;font-weight:700}.total-val{font-size:22px;font-weight:800}
  @media print{.acciones{display:none!important}body{padding:16px}}
</style></head><body>
  <div class="acciones">
    <button class="btn-imp" onclick="window.print()">🖨️ Imprimir</button>
    <button class="btn-pdf" onclick="window.print()">📄 Guardar PDF</button>
  </div>
  <div class="header">
    <div style="font-weight:700;font-size:16px">${cliente.nombre}</div>
    <div style="text-align:right;font-size:12px;color:#888">${fecha}</div>
  </div>
  ${cliente.telefono || cliente.localidad ? `<div class="cliente" style="padding:8px 16px">${cliente.telefono || ""} ${cliente.localidad ? `· ${cliente.localidad}` : ""}</div>` : ""}
  <table>
    <thead><tr><th>Cód.</th><th>Descripción</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th></tr></thead>
    <tbody>${items
      .filter(
        (i) =>
          i.nombre &&
          parseFloat(i.cantidad) > 0 &&
          i.codigo !== "044" &&
          i.nombre !== "SALDO CV",
      )
      .map(
        (i) =>
          `<tr><td style="color:#888">${i.codigo}</td><td>${i.nombre}</td><td style="text-align:right">${i.cantidad}</td><td style="text-align:right">${fmtMoney(parseMoney(i.precio) || 0)}</td><td style="text-align:right;font-weight:600">${fmtMoney(calcItem(i))}</td></tr>`,
      )
      .join("")}</tbody>
  </table>
  ${descGlobal && parseFloat(descGlobal) > 0 ? `<p class="desc">Descuento ${descGlobal}%: −${fmtMoney(descMonto)}</p>` : ""}
  <div class="total-box"><span class="total-label">TOTAL</span><span class="total-val">${fmtMoney(total)}</span></div>
  <div style="margin-top:40px; text-align:center; font-size:10px; color:#aaa; font-weight:700; text-transform:uppercase; letter-spacing:1px; border-top:1px solid #eee; padding-top:10px">
    Documento no válido como factura
  </div>
  ${autoprint ? `<script>window.onload=()=>{window.print();}</script>` : ""}
</body></html>`;

export const textoWsp = (
  items: any[],
  cliente: any,
  fecha: string,
  condPago: string,
  descGlobal: string,
  descMonto: number,
  total: number
) => {
  const nombreMostrar = cliente.nombre;
  const lineas = items
    .filter(
      (i) =>
        i.nombre &&
        parseFloat(i.cantidad) > 0 &&
        i.codigo !== "044" &&
        i.nombre !== "SALDO CV",
    )
    .map((i) => `  • ${i.nombre} x${i.cantidad} — ${fmtMoney(calcItem(i))}`)
    .join("\n");
  return `👤 *${nombreMostrar}*\n📅 ${fecha} · ${condPago}\n\n${lineas}${descGlobal && parseFloat(descGlobal) > 0 ? `\n\n🔻 Descuento ${descGlobal}%: −${fmtMoney(descMonto)}` : ""}\n\n*TOTAL: ${fmtMoney(total)}*\n\n_Documento no válido como factura_`;
};

export const compartirWsp = (
  items: any[],
  cliente: any,
  fecha: string,
  condPago: string,
  descGlobal: string,
  descMonto: number,
  total: number
) => {
  const tel = (cliente?.telefono || "").replace(/\D/g, "");
  const msg = encodeURIComponent(textoWsp(items, cliente, fecha, condPago, descGlobal, descMonto, total));
  const url = tel
    ? `https://wa.me/549${tel}?text=${msg}`
    : `https://wa.me/?text=${msg}`;
  window.open(url, "_blank");
};

export const generarPDFComprobante = (
  items: any[],
  cliente: any,
  fecha: string,
  condPago: string,
  tipoComp: string,
  letra: string,
  editando: any,
  facturas: any[],
  descGlobal: string,
  descMonto: number,
  total: number
) => {
  const filasFiltradas = items.filter(
    (i) =>
      i.nombre &&
      parseFloat(i.cantidad) > 0 &&
      i.codigo !== "044" &&
      i.nombre !== "SALDO CV",
  );
  const numFac = editando?.numero || nuevaNumFac(facturas, letra);
  const tipoLabel =
    tipoComp === "nc"
      ? "Nota de Crédito"
      : tipoComp === "nd"
        ? "Nota de Débito"
        : "Factura";
  const nombreCliente = (cliente?.nombre || "Cliente")
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "")
    .trim();

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${fecha} — ${nombreCliente} — ${tipoLabel} ${letra} ${numFac}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f8f9fc;padding:24px;color:#1a1a2e}
.card{background:#fff;border-radius:14px;padding:32px;max-width:640px;margin:0 auto;box-shadow:0 2px 16px #0001}
.header-top{text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px dashed #e2e8f0}
.factura-num{font-size:24px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
.factura-sub{font-size:13px;color:#64748b;font-weight:600}
.cliente-box{background:#f1f5f9;border-radius:10px;padding:16px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
.cliente-nombre{font-size:16px;font-weight:800;color:#1e293b;margin-bottom:4px}
.cliente-sub{font-size:12px;color:#64748b;line-height:1.5}
table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px}
th{padding:10px;text-align:left;background:#f8fafc;border-bottom:2px solid #e2e8f0;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.5px;text-transform:uppercase}
th.r,td.r{text-align:right}
td{padding:10px;border-bottom:1px solid #f1f5f9;color:#334155}
td.sub{color:#94a3b8;font-family:monospace}
td.bold{font-weight:700;color:#1e293b}
.total-box{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#1e293b;border-radius:10px;color:#fff}
.total-label{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.total-val{font-size:28px;font-weight:800}
.desc{text-align:right;font-size:13px;color:#e53e3e;margin:4px 0 12px;font-weight:600}
.legend{margin-top:40px; text-align:center; font-size:11px; color:#94a3b8; font-weight:800; text-transform:uppercase; letter-spacing:2px; border:2px solid #f1f5f9; border-left:none; border-right:none; padding:12px 0}
@media print{body{background:#fff;padding:0}.card{box-shadow:none;padding:24px;max-width:100%}}
</style></head><body>
<div class="card">
<div class="header-top">
<div class="factura-num">${tipoLabel} ${letra}</div>
<div class="factura-sub">${numFac}</div>
<div style="font-size:12px; color:#94a3b8; margin-top:8px">${fecha}</div>
</div>
<div class="cliente-box">
<div>
  <div class="cliente-nombre">${cliente?.nombre}</div>
  ${cliente?.telefono || cliente?.localidad ? `<div class="cliente-sub">${[cliente.telefono, cliente.localidad].filter(Boolean).join(" · ")}</div>` : ""}
</div>
<div style="text-align:right">
  <div class="cliente-sub">Cond. Pago</div>
  <div style="font-weight:700; color:#1e293b; font-size:14px">${condPago}</div>
</div>
</div>
<table>
<thead><tr><th>Cód.</th><th>Descripción</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Subtotal</th></tr></thead>
<tbody>${filasFiltradas
  .map(
    (i) => `<tr>
  <td class="sub">${i.codigo || ""}</td>
  <td style="font-weight:500">${i.nombre}</td>
  <td class="r">${i.cantidad}</td>
  <td class="r">${fmtMoney(parseMoney(i.precio))}</td>
  <td class="r bold">${fmtMoney(calcItem(i))}</td>
</tr>`,
  )
  .join("")}</tbody>
</table>
${descGlobal && parseFloat(descGlobal) > 0 ? `<p class="desc">Descuento ${descGlobal}%: −${fmtMoney(descMonto)}</p>` : ""}
<div class="total-box">
<span class="total-label">Total Neto</span>
<span class="total-val">${fmtMoney(total)}</span>
</div>
<div class="legend">
Documento no válido como factura
</div>
</div>
<script>window.onload=()=>{ window.print(); window.close(); }</script>
</body></html>`;
  const win = window.open("", "_blank", "width=700,height=900");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
};

export const exportarExcelFactura = async (
  items: any[],
  cliente: any,
  fecha: string,
  condPago: string,
  tipoComp: string,
  letra: string,
  facturas: any[],
  descGlobal: string,
  descMonto: number,
  total: number
) => {
  const filasFiltradas = items.filter(
    (i) =>
      i.nombre &&
      parseFloat(i.cantidad) > 0 &&
      i.codigo !== "044" &&
      i.nombre !== "SALDO CV",
  );
  const numFac = nuevaNumFac(facturas, letra);
  const tipoLabel =
    tipoComp === "nc"
      ? "Nota de Crédito"
      : tipoComp === "nd"
        ? "Nota de Débito"
        : "Factura";

  const filasExport: any[][] = [];
  filasExport.push([`${tipoLabel} ${letra} — ${numFac}`]);
  filasExport.push([`${fecha} · ${condPago}`]);
  filasExport.push([cliente.nombre]);
  filasExport.push([]);

  const filasReales = filasFiltradas.map((i) => [
    i.codigo || "",
    i.nombre,
    parseFloat(i.cantidad) || 0,
    parseMoney(i.precio) || 0,
    parseFloat(i.bonif) || 0,
    calcItem(i),
  ]);
  filasExport.push(...filasReales);

  filasExport.push([]);
  if (descGlobal && parseFloat(descGlobal) > 0) {
    filasExport.push([
      "",
      "",
      "",
      "",
      "Descuento " + descGlobal + "%",
      -descMonto,
    ]);
  }
  filasExport.push(["", "", "", "", "TOTAL", total]);

  exportarAExcel({
    titulo: "", // We left the title empty because we manually push the headers
    columnas: [
      "Cód.",
      "Descripción",
      "Cant.",
      "Precio Unit.",
      "Bonif. %",
      "Subtotal",
    ],
    filas: filasExport,
    fileName: `${tipoLabel}_${letra}_${numFac}_${cliente.nombre.replace(/\s+/g, "_")}.xlsx`,
    sheetName: "Factura",
  });
};
