export const migMap = [
  // AL NORTE DISTRIBUCIONES
  { codigo: "118", nombre: "CIG. KIEL BOX X 20U", costo: 990, p1: 1045, p2: 1050, p3: 1020, p4: 1030 },
  { codigo: "124", nombre: "CIG. KIEL KS X 20U", costo: 990, p1: 1045, p2: 1050, p3: 1020, p4: 1030 },
  { codigo: "104", nombre: "CIG. MASTER BOX X 20", costo: 1100, p1: 1158, p2: 1180, p3: 1127, p4: 1143 },
  { codigo: "106", nombre: "CIG. MASTER KS X 20U", costo: 1100, p1: 1158, p2: 1180, p3: 1127, p4: 1143 },
  { codigo: "126", nombre: "CIG. RED POINT BOX 10", costo: 790, p1: 828, p2: 835.03, p3: 813, p4: 823 },
  { codigo: "112", nombre: "CIG. RED POINT BOX X 20U", costo: 1425, p1: 1500, p2: 1525, p3: 1450, p4: 1490 },
  { codigo: "110", nombre: "CIG. RED POINT KS X 20U", costo: 1300, p1: 1370, p2: 1400, p3: 1350, p4: 1360 },
  { codigo: "114", nombre: "CIG. RED POINT MENTOL X 20U", costo: 1323, p1: 1350, p2: 1350, p3: 1350, p4: 1350 },
  { codigo: "108", nombre: "CIG. RED POINT ON-CONV. X 20U", costo: 1585, p1: 1667, p2: 1683, p3: 1637, p4: 1628 },
  { codigo: "144", nombre: "CIG. RED POINT ON-SIX X 20U", costo: 1585, p1: 1667, p2: 1683, p3: 1637, p4: 1628 },
  { codigo: "102", nombre: "CIG. WEST BOX X 20", costo: 1344, p1: 0, p2: 0, p3: 0, p4: 0 },
  { codigo: "250", nombre: "Enc. Cricket Original", costo: 551.82, p1: 600, p2: 600, p3: 600, p4: 600 },
  { codigo: "200", nombre: "PAPEL OCB Bamboo 1.1/4 x 25u", costo: 14617.5, p1: 15375, p2: 15375, p3: 15375, p4: 15375 },
  { codigo: "202", nombre: "PAPEL OCB Premium 1.1/4 x 25u", costo: 15281.93, p1: 16050, p2: 16050, p3: 16050, p4: 16050 },
  { codigo: "281", nombre: "TAB. Cuatro Leguas", costo: 2238.9, p1: 2480, p2: 2900, p3: 2480, p4: 2480 },

  // ESPERT
  { codigo: "135", nombre: "CIG. BOLD X 20U", costo: 990, p1: 1030, p2: 1090, p3: 1030, p4: 1030 },
  { codigo: "132", nombre: "CIG. MELBOURNE X 20U", costo: 1200, p1: 1240, p2: 1240, p3: 1240, p4: 1240 },
  { codigo: "131", nombre: "CIG. MILENIO CAPSULA X 20U", costo: 1272, p1: 1748, p2: 1800, p3: 1748, p4: 1748 },
  { codigo: "133", nombre: "CIG. MILENIO RED X 20U", costo: 1058, p1: 1310, p2: 1300, p3: 1304, p4: 1304 },
  { codigo: "134", nombre: "CIG. MILL EXPLOSIon x 20U", costo: 1312, p1: 1354, p2: 1450, p3: 1344, p4: 1344 },
  { codigo: "130", nombre: "CIG. MILL x 20U", costo: 1200, p1: 1248, p2: 1320, p3: 1238, p4: 1238 },
  { codigo: "137", nombre: "TAB. VAN KIFF American", costo: 4890, p1: 5200, p2: 5700, p3: 5200, p4: 5200 },
  { codigo: "140", nombre: "TAB. VAN KIFF Cherry", costo: 4890, p1: 5150, p2: 5700, p3: 5150, p4: 5150 },
  { codigo: "138", nombre: "TAB. VAN KIFF Chocolate", costo: 4890, p1: 5150, p2: 5700, p3: 5150, p4: 5150 },
  { codigo: "139", nombre: "TAB. VAN KIFF Natural", costo: 4890, p1: 5150, p2: 5700, p3: 5150, p4: 5150 },
  { codigo: "141", nombre: "TAB. VAN KIFF Uva", costo: 4890, p1: 5150, p2: 5700, p3: 5150, p4: 5150 },
  { codigo: "136", nombre: "TAB. VAN KIFF Vainilla", costo: 4890, p1: 5150, p2: 5700, p3: 5150, p4: 5150 },

  // N&H Mayoristas
  { codigo: "146", nombre: "CIG. BOXER x 20U", costo: 790, p1: 830, p2: 870, p3: 830, p4: 830 },

  // QUISTAPACE DANIEL
  { codigo: "120", nombre: "CIG. DOLCHESTER BOX X 20U", costo: 1300, p1: 1339.5, p2: 1379, p3: 1365, p4: 1333 },
  { codigo: "122", nombre: "CIG. PIER BOX X 20U", costo: 331, p1: 1139.5, p2: 1379, p3: 1365, p4: 1333 },
  { codigo: "128", nombre: "CIG. RED POINT BOX 10 ON", costo: 880, p1: 920, p2: 960, p3: 905, p4: 915 }
];

export function runMigration(articulos: any[]) {
  let changed = false;
  const newArts = articulos.map(a => {
    const match = migMap.find(m => {
      // Try to match by codigo first, then by nombre
      if (a.codigo && String(a.codigo).trim() === m.codigo) return true;
      if (a.nombre && a.nombre.toUpperCase().trim() === m.nombre.toUpperCase().trim()) return true;
      return false;
    });
    if (match) {
      if (a.costo !== match.costo || a.precio1 !== match.p1 || a.precio2 !== match.p2 || a.precio3 !== match.p3 || a.precio4 !== match.p4) {
        changed = true;
        const u1 = parseFloat((((match.p1 / match.costo) - 1) * 100).toFixed(2)) || 0;
        const u2 = parseFloat((((match.p2 / match.costo) - 1) * 100).toFixed(2)) || 0;
        const u3 = match.p3 ? parseFloat((((match.p3 / match.costo) - 1) * 100).toFixed(2)) || 0 : 0;
        const u4 = match.p4 ? parseFloat((((match.p4 / match.costo) - 1) * 100).toFixed(2)) || 0 : 0;
        return {
          ...a,
          costo: match.costo,
          precio1: match.p1,
          precio2: match.p2,
          precio3: match.p3,
          precio4: match.p4,
          utilidad: [u1, u2, u3, u4]
        };
      }
    }
    return a;
  });
  return { changed, newArts };
}
