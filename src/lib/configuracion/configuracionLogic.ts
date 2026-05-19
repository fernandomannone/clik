export async function procesarInyeccionHistoricos(initialData: any, facturas: any[], user: any, cloudSync: any, setMsgBackup: any) {
  const historicos = (initialData.facturas || []).filter((f: any) => f.isHistoricalCMV);
  if (historicos.length === 0) {
    setMsgBackup("No se encontraron datos históricos en el archivo original.");
    return facturas;
  }
  
  const currentUserId = user?.id || user?.pbId || "";
  const otrasFacturas = facturas.filter((f: any) => !f.isHistoricalCMV);
  const historicosConUser = historicos.map((f: any) => ({ ...f, userId: currentUserId }));
  const nuevasFacturas = [...otrasFacturas, ...historicosConUser];
  
  if (cloudSync?.saveBatchToCloud) {
    const chunkSize = 25;
    let totalSuccess = 0;
    let totalFails = 0;
    for (let i = 0; i < historicosConUser.length; i += chunkSize) {
      const chunk = historicosConUser.slice(i, i + chunkSize);
      const result = await cloudSync.saveBatchToCloud("facturas", chunk);
      totalSuccess += result.success;
      totalFails += result.fails;
      setMsgBackup(`Procesando... ${Math.min(i + chunkSize, historicosConUser.length)} de ${historicosConUser.length} (Fallos: ${totalFails})`);
      await new Promise(r => setTimeout(r, 150));
    }
    if (totalFails > 0) {
      setMsgBackup(`Importación parcial: ${totalSuccess} exitosos, ${totalFails} rechazados por el servidor.`);
    } else {
      setMsgBackup(`¡Éxito! Se inyectaron ${totalSuccess} comprobantes históricos correctamente.`);
    }
  } else {
    setMsgBackup("No se pudo sincronizar en la nube. Actualizado de forma local.");
  }
  
  return nuevasFacturas;
}

export function resetSistemaLocal(
  { cuentas, clientes, proveedores, articulos, cloudSync }: any
) {
  const cuentasCero = cuentas.map((c: any) => ({ ...c, saldo: 0 }));
  const clientesCero = clientes.map((c: any) => ({ ...c, saldoInicial: 0, fechaSaldoInicial: null }));
  const provCero = proveedores.map((p: any) => ({ ...p, saldoInicial: 0, fechaSaldoInicial: null }));
  const artCero = articulos.map((a: any) => ({ ...a, stock: 0, stockFecha: null }));

  if (cloudSync?.saveBatchToCloud) {
    cloudSync.saveBatchToCloud("cuentas", cuentasCero);
    cloudSync.saveBatchToCloud("clientes", clientesCero);
    cloudSync.saveBatchToCloud("proveedores", provCero);
    cloudSync.saveBatchToCloud("articulos", artCero);
  }

  return { cuentasCero, clientesCero, provCero, artCero };
}

export async function clearAllLocalYCloud(
  elementos: any
) {
  const { facturas, factProv, pagos, pagosProv, movimientos, ajustesStock, seacMovs, historialImport, kardex, cloudSync } = elementos;
  if (cloudSync?.deleteFromCloud) {
    facturas.forEach((f: any) => cloudSync.deleteFromCloud("facturas", String(f.id)));
    factProv.forEach((f: any) => cloudSync.deleteFromCloud("factProv", String(f.id)));
    pagos.forEach((p: any) => cloudSync.deleteFromCloud("pagos", String(p.id)));
    pagosProv.forEach((p: any) => cloudSync.deleteFromCloud("pagosProv", String(p.id)));
    movimientos.forEach((m: any) => cloudSync.deleteFromCloud("movimientos", String(m.id)));
    ajustesStock.forEach((m: any) => cloudSync.deleteFromCloud("ajustesStock", String(m.id)));
    seacMovs.forEach((m: any) => cloudSync.deleteFromCloud("seacMovs", String(m.id)));
    historialImport.forEach((m: any) => cloudSync.deleteFromCloud("historialImport", String(m.id)));
    kardex.forEach((k: any) => cloudSync.deleteFromCloud("kardex", String(k.id)));
  }
}

export async function ejecutarImplantacionGeneral(
  { clientes, proveedores, articulos, cloudSync }: any
) {
  const res = await fetch("/saldos_abril.json");
  if (!res.ok) throw new Error("No se pudo cargar saldos_abril.json");
  const { clientes: cData, provs: pData } = await res.json();

  let artsData: any[] = [];
  try {
    const resStock = await fetch("/Libro1.xlsx");
    if (resStock.ok) {
      const XLSX_lib = await import("xlsx");
      const XLSX: any = XLSX_lib;
      const buf = await resStock.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[][] = (XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[]);
      
      let headerIdx = -1;
      let colIndices = { codigo: 0, nombre: 1, stock: 3 };

      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        if (!row) continue;
        const rowStr = row.map(c => String(c || "").toLowerCase().trim()).join("|");
        if (rowStr.includes("codigo") || rowStr.includes("art") || rowStr.includes("nombre")) {
          headerIdx = i;
          row.forEach((cell, idx) => {
            const c = String(cell || "").toLowerCase().trim();
            if (c.includes("cod")) colIndices.codigo = idx;
            if (c.includes("nom") || c.includes("desc")) colIndices.nombre = idx;
            if (c.includes("stock") || c.includes("cant") || c.includes("existencia")) colIndices.stock = idx;
          });
          break;
        }
      }

      if (headerIdx !== -1) {
        artsData = json.slice(headerIdx + 1)
          .filter(row => row && row[colIndices.nombre] && String(row[colIndices.nombre]).trim() && row[colIndices.nombre] !== "TOTAL:")
          .map(row => ({
            codigo: String(row[colIndices.codigo] || "").trim(),
            nombre: String(row[colIndices.nombre] || "").trim(),
            stock: parseFloat(row[colIndices.stock]) || 0
          }));
      }
    }
  } catch (e) {
    console.error("Error cargando stock:", e);
  }

  const sanitize = (s: string) => s ? s.replace(/\(\*\)/g, '').replace(/\*/g, '').trim().toLowerCase() : '';
  let updatedC = 0, updatedP = 0, updatedA = 0;
  
  const nextClientes = clientes.map((c: any) => {
    const cName = sanitize(c.nombre);
    if (!cName) return c;
    const found = cData.find((x: any) => {
      const xName = sanitize(x.nombre);
      if (!xName || xName.includes('t o t a l') || xName.includes('total')) return false;
      return xName === cName || (c.codigo && x.codigo && c.codigo === x.codigo);
    });
    if (found) {
      updatedC++;
      return { ...c, saldoInicial: found.saldo, fechaSaldoInicial: "2026-04-30", cuentaCorriente: true };
    }
    return c;
  });

  const nextProvs = proveedores.map((p: any) => {
    const pName = sanitize(p.nombre);
    if (!pName) return p;
    const found = pData.find((x: any) => {
      const xName = sanitize(x.nombre);
      if (!xName) return false;
      return xName === pName || (p.codigo && x.codigo && p.codigo === x.codigo);
    });
    if (found) {
      updatedP++;
      return { ...p, saldoInicial: found.saldo, fechaSaldoInicial: "2026-04-30", cuentaCorriente: true };
    }
    return p;
  });

  const nextArts = articulos.map((a: any) => {
    const aName = sanitize(a.nombre);
    const found = artsData.find((x: any) => 
      (a.codigo && String(a.codigo).trim() === x.codigo) || 
      sanitize(x.nombre) === aName
    );
    if (found) {
      updatedA++;
      return { ...a, stock: found.stock, stockFecha: "2026-04-30" };
    }
    return a;
  });

  if (cloudSync?.saveBatchToCloud) {
    if (updatedC > 0) await cloudSync.saveBatchToCloud("clientes", nextClientes.filter((c: any, i: number) => c !== clientes[i]));
    if (updatedP > 0) await cloudSync.saveBatchToCloud("proveedores", nextProvs.filter((p: any, i: number) => p !== proveedores[i]));
    if (updatedA > 0) await cloudSync.saveBatchToCloud("articulos", nextArts.filter((a: any, i: number) => a !== articulos[i]));
  }

  return { nextClientes, nextProvs, nextArts, updatedC, updatedP, updatedA };
}
