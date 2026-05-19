/**
 * maintenance.ts — Clik v2
 *
 * Funciones de mantenimiento de la base de datos.
 * Extraídas de App.tsx donde vivían como script inline (deuda técnica).
 *
 * CÓMO USAR desde Configuracion.tsx:
 *
 *   import { limpiarMovimientosHuerfanos } from "../../lib/maintenance";
 *
 *   // En el botón de mantenimiento (solo visible para rol maestro):
 *   <Btn v="danger" onClick={() => limpiarMovimientosHuerfanos(data)}>
 *     Limpiar movimientos huérfanos
 *   </Btn>
 */

/**
 * limpiarMovimientosHuerfanos
 *
 * Elimina movimientos de caja que referencian un pago o pagosProv
 * que ya no existe en Firestore (movimientos "huérfanos").
 *
 * También limpia el historial de cierres de caja si se solicita.
 *
 * ANTES: se ejecutaba automáticamente en cada render de App.tsx
 *        controlado por el flag `db_cleaned_sanjuan_v5` en localStorage.
 *
 * AHORA: se ejecuta solo cuando el usuario maestro lo dispara
 *        explícitamente desde el módulo de Configuración.
 *
 * @param data - objeto data de useData()
 * @param opciones.limpiarCierres - si true, también elimina historialCierres
 * @returns Promise con el resumen de lo que se limpió
 */
export const limpiarMovimientosHuerfanos = async (
  data: any,
  opciones: { limpiarCierres?: boolean } = {}
): Promise<{ movsEliminados: number; cierresEliminados: number }> => {
  const { cuentas, movimientos, pagos, pagosProv, historialCierres, cloudSync } = data;

  if (!cloudSync?.deleteFromCloud) {
    throw new Error("cloudSync no disponible");
  }

// Cuentas objetivo: las financieras (no virtuales)
  const cuentasFinancieras = new Set(
    cuentas
      .filter((c: any) => {
        const n = (c.nombre || "").toLowerCase();
        return (
          n.includes("san juan") ||
          n.includes("patagonia") ||
          n.includes("caja") ||
          n.includes("efectivo") ||
          n.includes("bbva")
        );
      })
      .map((c: any) => String(c.id))
  );

  // IDs de pagos y pagosProv existentes para lookup O(1)
  const pagosIds    = new Set(pagos.map((p: any)    => String(p.id)));
  const pagosProvIds= new Set(pagosProv.map((p: any) => String(p.id)));

  // Detectar huérfanos
  const huerfanos = movimientos.filter((m: any) => {
    if (!cuentasFinancieras.has(String(m.cuentaId))) return false;

    if (m.reciboId && !pagosIds.has(String(m.reciboId)))     return true;
    if (m.pagoProvId && !pagosProvIds.has(String(m.pagoProvId))) return true;

    return false;
  });

  // Eliminar huérfanos de Firestore
  console.log(`[Clik Maintenance] Eliminando ${huerfanos.length} movimientos huérfanos...`);
  for (const m of huerfanos) {
    await cloudSync.deleteFromCloud("movimientos", String(m.id));
  }

  // Eliminar historial de cierres si se solicitó
  let cierresEliminados = 0;
  if (opciones.limpiarCierres && historialCierres.length > 0) {
    console.log(`[Clik Maintenance] Eliminando ${historialCierres.length} cierres históricos...`);
    for (const h of historialCierres) {
      await cloudSync.deleteFromCloud("historialCierres", String(h.id));
    }
    cierresEliminados = historialCierres.length;
  }

  console.log("[Clik Maintenance] Limpieza completada.");
  return { movsEliminados: huerfanos.length, cierresEliminados };
};

/**
 * recalcularSaldosCuentas
 *
 * Recalcula el saldo de cada cuenta sumando sus movimientos
 * y lo guarda en Firestore.
 *
 * Útil para corregir inconsistencias después de una limpieza.
 *
 * @param data - objeto data de useData()
 */
export const recalcularSaldosCuentas = async (data: any): Promise<void> => {
  const { cuentas, movimientos, cloudSync } = data;

  if (!cloudSync?.saveToCloud) {
    throw new Error("cloudSync no disponible");
  }

  for (const cuenta of cuentas) {
    const movsDeEstaCuenta = movimientos.filter(
      (m: any) => String(m.cuentaId) === String(cuenta.id)
    );

    const saldoReal = movsDeEstaCuenta.reduce((acc: number, m: any) => {
      return m.tipo === "ingreso" ? acc + (m.monto || 0) : acc - (m.monto || 0);
    }, 0);

    if (Math.abs(saldoReal - (cuenta.saldo || 0)) > 0.01) {
      console.log(
        `[Clik Maintenance] Cuenta "${cuenta.nombre}": ` +
        `saldo actual ${cuenta.saldo} → recalculado ${saldoReal}`
      );
      await cloudSync.saveToCloud("cuentas", { ...cuenta, saldo: saldoReal });
    }
  }

  console.log("[Clik Maintenance] Recálculo de saldos completado.");
};

/**
 * limpiarHuellasFirestore
 * 
 * Elimina los restos visuales y objetos "firestore/timestamp/1.0"
 * que quedaron alojados en la estructura JSON luego de la migración cruda
 * desde Firestore hacia PocketBase.
 * 
 * Solo purga estos campos si son un objeto remanente, actualizando el registro.
 */
import { pb } from "./pocketbase";

export const limpiarHuellasFirestore = async (coleccionACompactar?: string | null, onProgress?: (msg: string) => void): Promise<number> => {
  let limpiados = 0;
  console.log("[Clik Maintenance] Iniciando limpieza de huellas de Firestore...");
  if (onProgress) onProgress("Iniciando...");

  const coleccionesBase = [
    "usuarios_clik", "users", "clientes", "proveedores", "articulos", 
    "familias", "movimientos_caja", "facturas", "movimientos_cc", 
    "cajas", "conceptos_caja", "estadisticas", "ventas", "cierres_caja"
  ];

  const colecciones = coleccionACompactar ? [coleccionACompactar] : coleccionesBase;

  for (const collectionName of colecciones) {
    try {
      if (onProgress) onProgress(`Buscando en ${collectionName}...`);
      
      let page = 1;
      let totalPages = 1;
      let curLimp = 0;

      while (page <= totalPages) {
        if (onProgress && totalPages > 1) {
          onProgress(`Buscando en ${collectionName} (páginas ${page}/${totalPages})...`);
        }
        
        const result = await pb.collection(collectionName).getList(page, 200, { $autoCancel: false });
        totalPages = result.totalPages > 0 ? result.totalPages : 1;

        const records = result.items;
        
        for (const record of records) {
          let dirty = false;
          const payload: any = {};

          // Chequear createdAt / updatedAt sucios (formato Firebase)
          const checkField = (fieldName: string) => {
            let val = record[fieldName];
            if (typeof val === "string" && val.includes("firestore/timestamp")) {
              try { val = JSON.parse(val); } catch (e) {}
            }
            if (val && typeof val === "object" && val !== null && val.type?.includes("firestore")) {
              // Nullificamos el campo remanente para que PB lo borre de esa key JSON,
              // (PocketBase ya mantiene sus propios "created" y "updated" internos en string).
              payload[fieldName] = null;
              dirty = true;
            }
          };

          checkField("createdAt");
          checkField("updatedAt");
          checkField("fechaCreacion");
          
          if (dirty) {
            try {
              await pb.collection(collectionName).update(record.id, payload, { $autoCancel: false });
              limpiados++;
              curLimp++;
              if (onProgress && curLimp % 10 === 0) {
                onProgress(`Limpios ${curLimp} en ${collectionName}...`);
              }
              await new Promise(r => setTimeout(r, 20)); // pequeño respiro para el navegador
            } catch(e2: any) {
               const m = e2?.message || String(e2);
               console.error(`[Clik] Error limpiando registro ${record.id} de ${collectionName}:`, m);
               if (m.includes("Failed to persist")) {
                 console.log("Ignorando error de persistencia, intentaremos como string vacío...");
                 try {
                     const fallback: any = {};
                     fallback[Object.keys(payload)[0]] = "";
                     await pb.collection(collectionName).update(record.id, fallback, { $autoCancel: false });
                 } catch(ex){ /* shh */ }
               }
            }
          }
        }
        
        page++;
        // Dar respiro al browser entre cada página
        await new Promise(r => setTimeout(r, 100));
      }
      
      if (curLimp > 0) {
        if (onProgress) onProgress(`Optimizados ${curLimp} en ${collectionName}!`);
        await new Promise(r => setTimeout(r, 100)); // dar respiro al completar
      }

    } catch (e: any) {
      console.error(`[Clik Maintenance] Error limpiando colección ${collectionName}:`, e?.message || e);
      if (onProgress) onProgress(`Error en ${collectionName}: ${e?.message || 'timeout/fail'}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log(`[Clik Maintenance] Terminada la limpieza. Se corrigieron ${limpiados} registros fósiles.`);
  return limpiados;
};
