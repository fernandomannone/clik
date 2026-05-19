// Lógica pura (blindada) para Importar Ingresos

export function parseMoney(val: string): number {
  if (!val) return 0;
  const numStr = val.replace(/[^0-9,\.-]/g, "").replace(",", ".");
  return parseFloat(numStr) || 0;
}

export function parseExcelDate(cell: any): string | null {
  if (!cell) return null;
  if (typeof cell === "number") {
    // Si tienes SSF, asume formato serial fecha excel (ideal requerirlo allí, pero para purismo lo pasamos)
    // Aquí el componente lo maneja con SSF antes de invocar la lógica o bien la logica depende de un date utils.
    // Usaremos un aproximado para números excel a date (1900-01-01 base):
    // Pero lo mejor es dejar que la parte UI detecte fecha si usa libreria externa que depende de UI (como SSF de xlsx)
    return null;
  }
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }
  if (typeof cell === "string") {
    const m = cell.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const m2 = cell.match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  }
  return null;
}

export function resolverDest(raw: string, cuentas: any[], proveedores: any[]) {
  if (!raw) return null;
  const dRaw = String(raw).trim();
  const dUp = dRaw.toUpperCase().replace(/\s+/g, " ");
  const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const nRaw = norm(dRaw);

  let cuentaId = null;
  let proveedorId = null;

  // 1. Detección explícita de IDs si el usuario antepone C_{id} o P_{id}
  if (dUp.startsWith("C_")) {
    const idNum = parseInt(dUp.replace("C_", ""));
    if (!isNaN(idNum) && cuentas.some(c => c.id === idNum)) return { cuentaId: idNum, proveedorId: null };
  }
  if (dUp.startsWith("P_")) {
    const idNum = parseInt(dUp.replace("P_", ""));
    if (!isNaN(idNum) && proveedores.some(p => p.id === idNum)) return { cuentaId: null, proveedorId: idNum };
  }

  // Si el usuario escribe solamente un número en la celda Destino, lo buscamos por ID exacto.
  // Prioriza Proveedor si el número coincide con un proveedor.
  const isNumeric = /^\d+$/.test(dRaw);
  if (isNumeric) {
    const idNum = parseInt(dRaw);
    const hasProv = proveedores.some(p => p.id === idNum);
    const hasCta = cuentas.some(c => c.id === idNum);
    if (hasProv) return { cuentaId: null, proveedorId: idNum };
    if (hasCta) return { cuentaId: idNum, proveedorId: null };
  }

  // 2. Buscar en Cuentas (por alias o nombre exacto)
  const cuentaEncontrada = cuentas?.find(c => {
    if (!c) return false;
    if (c.aliasImportacion) {
        const aliases = String(c.aliasImportacion).split(",").map(a => norm(a));
        if (aliases.includes(nRaw) || aliases.includes(norm(dUp))) return true;
    }
    return norm(c.nombre) === nRaw || norm(c.nombre) === norm(dUp);
  });
  
  if (cuentaEncontrada) cuentaId = cuentaEncontrada.id;

  // 3. Buscar en Proveedores (por alias o nombre exacto)
  const provEncontrado = proveedores?.find(p => {
    if (!p) return false;
    if (p.alias) {
        const aliases = String(p.alias).split(",").map(a => norm(a));
        if (aliases.includes(nRaw) || aliases.includes(norm(dUp))) return true;
    }
    return norm(p.nombre) === nRaw || norm(p.nombre) === norm(dUp);
  });

  if (provEncontrado) proveedorId = provEncontrado.id;

  if (!cuentaId && !proveedorId) return null;
  return { cuentaId, proveedorId };
}

export function sumarSaldosCuentas(cuentas: any[], nuevosMovCaja: any[]) {
  const numCuentas: any[] = [];
  const nextCuentas = cuentas.map((c: any) => {
    const totalIngreso = nuevosMovCaja
      .filter(m => String(m.cuentaId) === String(c.id) && m.tipo === "ingreso")
      .reduce((sum, m) => sum + m.monto, 0);
    const totalEgreso = nuevosMovCaja
      .filter(m => String(m.cuentaId) === String(c.id) && m.tipo === "egreso")
      .reduce((sum, m) => sum + m.monto, 0);
    const diff = totalIngreso - totalEgreso;
    
    if (diff !== 0) {
      const res = { ...c, saldo: (c.saldo || 0) + diff };
      numCuentas.push(res);
      return res;
    }
    return c;
  });
  return { nextCuentas, numCuentas };
}

export function buildImportacionIngresos(
  registros: { directos: any[]; vendedores: any[] },
  fecha: string,
  destManuales: Record<string, any>,
  proveedores: any[],
  cuentas: any[],
  fileName: string,
  userName: string
) {
  let ts = Date.now();
  const nuevosRecibos: any[] = [];
  const nuevosPagoProv: any[] = [];
  const nuevosMovCaja: any[] = [];

  const resolverDestFinal = (r: any) => destManuales[r._key] || r.dest;

  const registrarPago = (clienteObj: any, monto: number, dest: any, obs: string, grupoId: any = null) => {
    if (!clienteObj || monto <= 0) return;
    const reciboId = ++ts;
    const cuentaId = dest?.cuentaId || null;
    const proveedorId = dest?.proveedorId || null;

    nuevosRecibos.push({
      id: reciboId, grupoId,
      clienteId: clienteObj.id, cliente: clienteObj.nombre,
      nombreCV: clienteObj.nombreCV || "",
      monto, tipo: "Transferencia", estadoCV: "pendiente",
      fecha, obs, anulado: false, cuentaId, proveedorId,
    });

    if (cuentaId) {
      nuevosMovCaja.push({
        id: ++ts, grupoId, cuentaId,
        concepto: `Cobro — ${clienteObj.nombre}`,
        tipo: "ingreso", monto, fecha, reciboId,
      });
    }

    if (proveedorId) {
      const pagoProvId = ++ts;
      nuevosPagoProv.push({
        id: pagoProvId, grupoId, proveedorId,
        tipo: "Transferencia", monto, fecha,
        obs: `Cobro cliente ${clienteObj.nombre}`,
        anulado: false, reciboId, _desdeRecibo: true,
      });
      // Correctly recording informative movements for the provider payment
      nuevosMovCaja.push({
        id: ++ts, grupoId, cuentaId: null,
        concepto: `Auto-Ingreso (Cobro cliente) — ${clienteObj.nombre}`,
        tipo: "ingreso", monto, fecha, reciboId,
        informativo: true, _esImputacion: true,
      });
      nuevosMovCaja.push({
        id: ++ts, grupoId, cuentaId: null,
        concepto: `Cobro → ${proveedores.find((p: any) => p.id === proveedorId)?.nombre || "Proveedor"} — ${clienteObj.nombre}`,
        tipo: "egreso", monto, fecha, reciboId,
        pagoProvId, informativo: true, _esImputacion: true,
      });
    }
  };

  registros.directos.forEach(r => {
    const dest = resolverDestFinal(r);
    const grupoId = ++ts;
    registrarPago(r.clienteObj, r.monto, dest, `Cobro`, grupoId);
  });

  registros.vendedores.forEach(r => {
    const dest = resolverDestFinal(r);
    const cuentaId = dest?.cuentaId || null;
    const proveedorId = dest?.proveedorId || null;
    const grupoId = ++ts;
    const obs = `Cobro`;

    if (r.clienteFisico && r.montoFisico > 0) {
      nuevosRecibos.push({
        id: ++ts, grupoId,
        clienteId: r.clienteFisico.id, cliente: r.clienteFisico.nombre,
        nombreCV: r.clienteFisico.nombreCV || "",
        monto: r.montoFisico, tipo: "Transferencia", estadoCV: "pendiente",
        fecha, obs, anulado: false, cuentaId, proveedorId,
      });
    }

    if (r.clienteCIG && r.montoCIG > 0) {
      nuevosRecibos.push({
        id: ++ts, grupoId,
        clienteId: r.clienteCIG.id, cliente: r.clienteCIG.nombre,
        nombreCV: r.clienteCIG.nombreCV || "",
        monto: r.montoCIG, tipo: "Transferencia", estadoCV: "pendiente",
        fecha, obs, anulado: false, cuentaId, proveedorId,
      });
    }

    if (cuentaId && r.totalProveedor > 0) {
      nuevosMovCaja.push({
        id: ++ts, grupoId, cuentaId,
        concepto: `Cobro — ${r.clienteFisico?.nombre || r.clienteCIG?.nombre || r.idFisico}`,
        tipo: "ingreso", monto: r.totalProveedor, fecha,
      });
    }

    if (proveedorId && r.totalProveedor > 0) {
      const pagoProvId = ++ts;
      nuevosPagoProv.push({
        id: pagoProvId, grupoId, proveedorId,
        tipo: "Transferencia", monto: r.totalProveedor, fecha,
        obs: `Cobro cliente ${r.clienteFisico?.nombre || r.idFisico}`,
        anulado: false, _desdeRecibo: true,
      });
      nuevosMovCaja.push({
        id: ++ts, grupoId, cuentaId: null,
        concepto: `Auto-Ingreso (Cobro cliente) — ${r.clienteFisico?.nombre || r.clienteCIG?.nombre || r.idFisico}`,
        tipo: "ingreso", monto: r.totalProveedor, fecha,
        informativo: true, _esImputacion: true,
      });
      nuevosMovCaja.push({
        id: ++ts, grupoId, cuentaId: null,
        concepto: `Cobro → ${proveedores.find((p: any) => p.id === proveedorId)?.nombre || "Proveedor"} — ${r.clienteFisico?.nombre || r.idFisico}`,
        tipo: "egreso", monto: r.totalProveedor, fecha,
        pagoProvId, informativo: true, _esImputacion: true,
      });
    }
  });

  const { nextCuentas, numCuentas } = sumarSaldosCuentas(cuentas, nuevosMovCaja);

  const nuevoH = {
    id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
    tipo: "ingresos",
    fileName,
    fecha,
    cantRegistros: nuevosRecibos.length,
    total: nuevosRecibos.reduce((s, r) => (s || 0) + (r.monto || 0), 0),
    ids: nuevosRecibos.map(r => r.id),
    idsPagoProv: nuevosPagoProv.map(p => p.id),
    idsMov: nuevosMovCaja.map(m => m.id),
    detalle: nuevosRecibos.map(r => ({ clienteNombre: r.cliente, monto: r.monto, fecha: r.fecha })),
    usuario: userName,
    timestamp: Date.now(),
  };

  return { nuevosRecibos, nuevosPagoProv, nuevosMovCaja, numCuentas, nextCuentas, nuevoH };
}

export function procesarMatrizExcel(
  wb: any, 
  utils: any, 
  SSF: any,
  cuentas: any[], 
  proveedores: any[], 
  clientes: any[]
) {
  let fechaDetectada: string | null = null;
  const buscarCliente = (id: string | number) => {
    const idNum = parseInt(String(id || ""));
    if (isNaN(idNum)) return null;
    return clientes.find(c => c.id === idNum) || null;
  };

  for (const sn of ["DIRECTOS", "VENDEDORES"]) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const rows = utils.sheet_to_json(ws, { header: 1, defval: null });
    for (let ri = 0; ri < Math.min(10, rows.length); ri++) {
      const fila = rows[ri] || [];
      for (const cell of fila) {
        if (!cell) continue;
        if (typeof cell === "number") {
          try {
            const d = SSF.parse_date_code(cell);
            if (d && d.y >= 2000 && d.y <= 2100) {
              fechaDetectada = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
              break;
            }
          } catch {}
        } else {
           const parsedStrDate = parseExcelDate(cell);
           if (parsedStrDate) {
              fechaDetectada = parsedStrDate;
              break;
           }
        }
      }
      if (fechaDetectada) break;
    }
    if (fechaDetectada) break;
  }

  const directos: any[] = [];
  const wsD = wb.Sheets["DIRECTOS"];
  if (wsD) {
    const rows = utils.sheet_to_json(wsD, { header: 1, defval: null });
    for (let i = 2; i < rows.length; i++) {
      const row: any = rows[i];
      if (!row) continue;
      [[0, 1, 2, 3], [4, 5, 6, 7]].forEach(([cId, cNom, cImp, cDest]) => {
        const id = row[cId];
        if (id === null || id === undefined || id === "") return;
        const idNum = parseInt(String(id));
        if (isNaN(idNum)) return;
        const imp = row[cImp];
        const monto = typeof imp === "number" ? imp : (imp ? parseMoney(String(imp)) : 0);
        if (!monto || monto <= 0) return;
        const destRaw = row[cDest] ? String(row[cDest]).trim() : "";
        const dest = resolverDest(destRaw, cuentas, proveedores);
        const cliente = buscarCliente(idNum);
        directos.push({
          _key: `D-${i}-${cId}`,
          id: idNum, clienteNombre: String(row[cNom] || "").replace(/\*/g, "").trim(),
          clienteObj: cliente, monto, destRaw, dest, tipo: "directo",
        });
      });
    }
  }

  const vendedores: any[] = [];
  const wsV = wb.Sheets["VENDEDORES"];
  if (wsV) {
    const rows: any[] = utils.sheet_to_json(wsV, { header: 1, defval: null });
    let i = 2;
    while (i < rows.length) {
      const r1 = rows[i], r2 = rows[i + 1], r3 = rows[i + 2];
      if (!r1) { i++; continue; }
      const id1 = parseInt(String(r1[0] || "")), id2 = r2 ? parseInt(String(r2[0] || "")) : NaN;
      const id3raw = r3 ? r3[0] : null;

      // New esGrupo check: If we have two rows with IDs and the third is empty or has a string like "TOTAL"
      const esGrupo = !isNaN(id1) && !isNaN(id2) && 
        (id3raw === null || id3raw === "" || id3raw === undefined || String(id3raw).toLowerCase().includes("total"));
      
      const getNum = (r: any, c: number | null) => {
        if (!r || c === null) return 0;
        const v = r[c];
        return typeof v === "number" ? v : (v ? parseMoney(String(v)) : 0);
      };

      if (esGrupo) {
        // Block 1 (Cols 0-3), Block 2 (Cols 4-7)
        [[0, 1, 2, 3], [4, 5, 6, 7]].forEach(([cId, cNom, cImp, cDest], bi) => {
          if (cImp === null) return;
          const imp1 = getNum(r1, cImp), imp2 = getNum(r2, cImp);
          const imp3 = r3 ? getNum(r3, cImp) : 0;
          if (!imp1 && !imp2 && !imp3) return;
          
          const destRaw = (r1[cDest as number] ? String(r1[cDest as number]).trim() : "") || 
                          (r2[cDest as number] ? String(r2[cDest as number]).trim() : "");
          const dest = resolverDest(destRaw, cuentas, proveedores);
          const totalProv = imp3 || (imp1 + imp2);
          
          const vFisicoId = (bi === 0) ? id1 : parseInt(String(r1[4] || ""));
          const vCigId = (bi === 0) ? id2 : (r2 ? parseInt(String(r2[4] || "")) : NaN);

          vendedores.push({
            _key: `V-${i}-${bi}`,
            idFisico: vFisicoId, clienteFisico: buscarCliente(vFisicoId), montoFisico: imp1,
            idCIG: vCigId, clienteCIG: buscarCliente(vCigId), montoCIG: imp2,
            totalProveedor: totalProv, destRaw, dest, tipo: "vendedor",
          });
        });
        i += 3;
      } else {
        // Block 1 (Cols 0-3), Block 2 (Cols 4-7)
        [[0, 1, 2, 3], [4, 5, 6, 7]].forEach(([cId, cNom, cImp, cDest], bi) => {
          if (cImp === null) return;
          const vId = (bi === 0) ? parseInt(String(r1[0] || "")) : parseInt(String(r1[4] || ""));
          if (isNaN(vId)) return;

          const imp1 = getNum(r1, cImp);
          if (!imp1) return;
          const destRaw = r1[cDest as number] ? String(r1[cDest as number]).trim() : "";
          const dest = resolverDest(destRaw, cuentas, proveedores);
          
          vendedores.push({
            _key: `V-single-${i}-${bi}`,
            idFisico: vId, clienteFisico: buscarCliente(vId), montoFisico: imp1,
            idCIG: NaN, clienteCIG: null, montoCIG: 0,
            totalProveedor: imp1, destRaw, dest, tipo: "vendedor",
          });
        });
        i++;
      }
    }
  }

  const directosFiltrados = directos.filter(r => r.monto > 0);
  const vendedoresFiltrados = vendedores.filter(r => r.totalProveedor > 0 || r.montoFisico > 0);

  return { fechaDetectada, directosFiltrados, vendedoresFiltrados };
}

