import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { COND_DIAS } from "../constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtMoney = (n: number) => 
  `$${(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const parseMoney = (v: any): number => {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim();
  if (s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
};

export const fmtNum = (n: any) => 
  (n === null || n === undefined || n === "") 
    ? "" 
    : (parseFloat(n) || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });

export const fmtUSD = (n: number) => 
  `U$D ${(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const getToday = () => { 
  const d = new Date(); 
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; 
};

export const getSiguienteNumero = (tipo: "factura" | "nc" | "factProv" | "recibo", listado: any[] = []) => {
  const PREFIJOS = { factura: "F", nc: "NC", factProv: "FP", recibo: "R" };
  const prefijo = PREFIJOS[tipo];
  let max = 0;
  for (const item of listado) {
    if (item.numero && typeof item.numero === "string" && item.numero.startsWith(prefijo + "-")) {
      const parts = item.numero.split("-");
      if (parts.length === 2) {
        const n = parseInt(parts[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
  }
  return `${prefijo}-${String(max + 1).padStart(4, "0")}`;
};

export const registrarAuditoria = (tipo: string, numero: string, accion: string, usuario: string, motivo = "") => {
  // Logic migrated to individual modules or disabled locally to prevent divergent state.
  console.log(`Auditoria (${tipo}): ${accion} por ${usuario} // ${motivo}`);
};

export const getAuditoria = (tipo: string, numero: string) => {
  const key = `gp_audit_${tipo}_${numero}`;
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
};

export const tipoClienteG = (cid: any, facturas: any[]) => {
  const facs = facturas.filter(f => !f.anulada && f.clienteId === cid && (f.tipo === "factura" || f.tipo === "nc"));
  // CV si tiene facturas con 044 o similar
  return facs.some(f => f.items?.some((i: any) => i.codigo === "044" || i.codigo === "CV" || i.nombre?.includes("Carga Virtual"))) ? "cv" : "cig";
};

export const fechaVto = (f: any, articulos: any[] = []) => {
  if (!f.fecha) return "9999-12-31";
  if (f.fechaVtoManual) return f.fechaVtoManual;
  if (articulos.length && f.items?.length) {
    let minDias = null;
    f.items.forEach((it: any) => {
      const art = articulos.find(a => a.id === it.artId || a.codigo === it.codigo || a.nombre === it.nombre);
      if (art?.diasAlerta > 0) {
        if (minDias === null || art.diasAlerta < minDias) minDias = art.diasAlerta;
      }
    });
    if (minDias !== null) return addDias(f.fecha, minDias);
  }
  const cond = f.condPago || f.obs || "Contado";
  const dias = COND_DIAS[cond];
  if (dias === null || dias === undefined) return "9999-12-31";
  return addDias(f.fecha, dias);
};

export const estadoFac = (f: any, saldoCliente: number | null = null, articulos: any[] = []) => {
  if (f.tipo !== "factura") return f.estado || "pendiente";
  if (f.estado === "cobrado") return "cobrado";
  if (saldoCliente !== null && saldoCliente <= 0) return "cubierto";
  const vto = fechaVto(f, articulos);
  const hoy = getToday();
  const esContado = (f.condPago || f.obs || "Contado") === "Contado";
  const tieneAlertaArticulo = articulos.length && f.items?.some((it: any) => {
    const art = articulos.find(a => a.id === it.artId || a.codigo === it.codigo || a.nombre === it.nombre);
    return art?.diasAlerta > 0;
  });
  if (vto < hoy) return "vencida";
  const alertaDesde = addDias(hoy, 7);
  if (vto <= alertaDesde) return "por_vencer";
  return "pendiente";
};

export const facturasConAlerta = (facturas: any[], pagos: any[], articulos: any[] = []) => {
  const saldos: Record<number, number> = {};
  facturas.filter(f => !f.anulada).forEach(f => {
    if (!saldos[f.clienteId]) saldos[f.clienteId] = 0;
    if (f.tipo === "factura") saldos[f.clienteId] += f.total;
    else if (f.tipo === "nc") saldos[f.clienteId] -= f.total;
  });
  pagos.filter(p => !p.anulado).forEach(p => {
    if (!saldos[p.clienteId]) saldos[p.clienteId] = 0;
    saldos[p.clienteId] -= p.monto;
  });
  return facturas.filter(f => f.tipo === "factura" && !f.anulada).map(f => ({ ...f, _estado: estadoFac(f, saldos[f.clienteId] ?? 0, articulos) }));
};

export const precioLista = (art: any, lista: number) => {
  if (!art) return 0;
  const l = lista || 1;
  const pProp = parseFloat(art[`precio${l}`]) || 0;
  if (pProp > 0) return pProp;
  const costo = parseFloat(art.costo) || 0;
  const util = parseFloat((art.utilidad || [])[l - 1]) || 0;
  return costo * (1 + (util || 0) / 100);
};

export const addDias = (fecha: string, dias: number) => {
  const d = new Date(fecha + "T00:00:00"); 
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

export const normalizar = (s: string) => 
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

export const fmtFechaCC = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const sanitizeForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result;
};

import { pb } from "./pocketbase";

export const registrarMovimientoKardex = async (mov: any) => {
  try {
    const saved = localStorage.getItem("clik-kardex");
    const kardex = saved ? JSON.parse(saved) : [];
    const internalId = Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const docId = String(internalId);
    
    // Default to today if no fecha is passed
    const fechaToUse = mov.fecha || new Date().toISOString().split("T")[0];
    const nuevo = { ...mov, id: docId, fecha: fechaToUse, createdAt: new Date().toISOString() };
    kardex.push(nuevo);
    localStorage.setItem("clik-kardex", JSON.stringify(kardex));
    console.log(`[Kardex] Art:${mov.artId} Tipo:${mov.tipo} Cant:${mov.cantidad}`);
    window.dispatchEvent(new Event("kardex_updated"));

    return nuevo;
  } catch (err) {
    console.error("Error registrando kardex", err);
    return null;
  }
};


