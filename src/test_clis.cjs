const fs = require('fs');
const XLSX = require('xlsx');

function normalizar(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}
const normalizeMatch = (s) => normalizar(s || "").replace(/\s+/g, '');
const cleanCode = (c) => String(c || "").trim().toLowerCase().replace(/^0+/, "");

const initialData = JSON.parse(fs.readFileSync('src/initial_db_data.json', 'utf8'));
const clientes = initialData.clientes || initialData.default.clientes;

const wb = XLSX.readFile('public/saldo cliente 30.04.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

let headerIdx = -1;
let col = { codigo: 0, nombre: 1, saldo: 2 };
for (let i = 0; i < json.length; i++) {
  const r = json[i]; if (!r) continue;
  const rs = r.map(c => String(c || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")).join("|");
  if ((rs.includes("razon") || rs.includes("social") || rs.includes("nombre")) && rs.includes("saldo") && !rs.includes("saldos de")) {
    headerIdx = i;
    r.forEach((cell, idx) => {
      const c = String(cell || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (c.includes("cod")) col.codigo = idx;
      if (c.includes("nom") || c.includes("razon") || c.includes("social")) col.nombre = idx;
      if (c.includes("sal")) col.saldo = idx;
    });
    break;
  }
}

console.log("headerIdx:", headerIdx, "col:", col);

let working = [...clientes];
let updatedCount = 0;
let newCount = 0;

json.slice(headerIdx + 1).forEach(row => {
  if (!row || row.length === 0) return;
  const rawName = String(row[col.nombre] || "").trim();
  if (!rawName || rawName.toLowerCase().includes("total")) return;
  const valSaldo = parseFloat(String(row[col.saldo] || "0").replace(",", "."));
  
  const pCode = cleanCode(row[col.codigo]);
  const pName = normalizeMatch(rawName);

  const idx = working.findIndex(c => {
    if (!c) return false;
    const cCode = cleanCode(c.codigo);
    const cName = normalizeMatch(c.nombre || "");
    if (pCode && cCode && pCode === cCode) return true;
    return pName === cName;
  });

  if (idx !== -1) {
    if (working[idx].nombre.includes("Aguero José")) {
       console.log("MATCHED agero!", "Old balance:", working[idx].saldoInicial, "New balance:", valSaldo);
    }
    working[idx].saldoInicial = valSaldo;
    updatedCount++;
  } else {
    newCount++;
  }
});

console.log("Updated:", updatedCount, "New:", newCount);
