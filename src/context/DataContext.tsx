import React, { createContext, useContext, useState, useEffect } from "react";
import {
  USERS_INIT,
  CLIENTES_INIT,
  PROVEEDORES_INIT,
  ARTICULOS_INIT,
  FAMILIAS_INIT,
  CUENTAS_INIT,
  CONCEPTOS_INIT,
  UNIDADES_NEGOCIO,
} from "../constants";
import initialData from "../initial_db_data.json";
import { pb } from "../lib/pocketbase";

interface DataContextType {
  usuarios: any;
  setUsuarios: (v: any) => void;
  clientes: any;
  setClientes: (v: any) => void;
  proveedores: any;
  setProveedores: (v: any) => void;
  articulos: any;
  setArticulos: (v: any) => void;
  familias: any;
  setFamilias: (v: any) => void;
  unidadesNegocio: any;
  setUnidadesNegocio: (v: any) => void;
  cuentas: any;
  setCuentas: (v: any) => void;
  conceptos: any;
  setConceptos: (v: any) => void;
  movimientos: any;
  setMovimientos: (v: any) => void;
  pagos: any;
  setPagos: (v: any) => void;
  facturas: any;
  setFacturas: (v: any) => void;
  factProv: any;
  setFactProv: (v: any) => void;
  pagosProv: any;
  setPagosProv: (v: any) => void;
  seacMovs: any;
  setSeacMovs: (v: any) => void;
  seacImportaciones: any;
  setSeacImportaciones: (v: any) => void;
  seacGanancias: any;
  setSeacGanancias: (v: any) => void;
  seacMatchManuales: any;
  setSeacMatchManuales: (v: any) => void;
  utilidadesFCI: any;
  setUtilidadesFCI: (v: any) => void;
  historialCierres: any;
  setHistorialCierres: (v: any) => void;
  historialImport: any;
  setHistorialImport: (v: any) => void;
  ajustesStock: any;
  setAjustesStock: (v: any) => void;
  kardex: any;
  setKardex: (v: any) => void;
  menuOrder: any;
  setMenuOrder: (v: any) => void;
  cloudSync: {
    loading: boolean;
    migrating: boolean;
    migrateData: () => Promise<void>;
    status: "idle" | "syncing" | "error";
    refresh: () => Promise<void>;
  };
}

const DataContext = createContext<DataContextType | null>(null);

const safeArr = (key: string, defInit: any[]) => {
  try {
    const s = localStorage.getItem(key);
    if (s && s !== "null" && s !== "undefined") {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return defInit;
};

const CLOUD_NAME_MAP: Record<string, string> = {
  usuarios: "usuarios_clik"
};

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">(
    "idle",
  );

  const [usuarios, setUsuarios] = useState(() =>
    safeArr("clik-usuarios", USERS_INIT),
  );
  const [clientes, setClientes] = useState(() =>
    safeArr("clik-clientes", CLIENTES_INIT),
  );
  const [proveedores, setProveedores] = useState(() =>
    safeArr("clik-proveedores", PROVEEDORES_INIT),
  );
  const [articulos, setArticulos] = useState(() =>
    safeArr("clik-articulos", ARTICULOS_INIT),
  );
  const [familias, setFamilias] = useState(() =>
    safeArr("clik-familias", FAMILIAS_INIT),
  );
  const [unidadesNegocio, setUnidadesNegocio] = useState(() =>
    safeArr("clik-unidadesNegocio", UNIDADES_NEGOCIO),
  );
  const [cuentas, setCuentas] = useState(() =>
    safeArr("clik-cuentas", CUENTAS_INIT),
  );
  const [conceptos, setConceptos] = useState(() =>
    safeArr("clik-conceptos", CONCEPTOS_INIT),
  );
  const [movimientos, setMovimientos] = useState(() =>
    safeArr("clik-movimientos", []),
  );
  const [pagos, setPagos] = useState(() => safeArr("clik-pagos", []));
  const [facturas, setFacturas] = useState(() => safeArr("clik-facturas", []));
  const [factProv, setFactProv] = useState(() => safeArr("clik-factProv", []));
  const [pagosProv, setPagosProv] = useState(() =>
    safeArr("clik-pagosProv", []),
  );
  const [seacMovs, setSeacMovs] = useState(() => safeArr("clik-seacMovs", []));
  const [seacImportaciones, setSeacImportaciones] = useState(() =>
    safeArr("clik-seacImportaciones", []),
  );
  const [seacGanancias, setSeacGanancias] = useState(() =>
    safeArr("clik-seacGanancias", []),
  );
  const [seacMatchManuales, setSeacMatchManuales] = useState(() =>
    safeArr("clik-seacMatchManuales", []),
  );
  const [utilidadesFCI, setUtilidadesFCI] = useState(() =>
    safeArr("clik-utilidadesFCI", []),
  );
  const [historialCierres, setHistorialCierres] = useState(() =>
    safeArr("clik-historialCierres", []),
  );
  const [historialImport, setHistorialImport] = useState(() =>
    safeArr("clik-historialImport", []),
  );
  const [ajustesStock, setAjustesStock] = useState(() =>
    safeArr("clik-ajustesStock", []),
  );
  const [kardex, setKardex] = useState(() => safeArr("clik-kardex", []));
  const sanitizeMenu = (menu: any[]) => {
    return (menu || []).map((item: any) => {
      if (item.id === "whatsapp") return { ...item, label: "Bots", icon: "bot" };
      if (item.id === "caja") return { ...item, label: "Tesorería", icon: "banknote" };
      if (item.id === "proveedores") return { ...item, label: "Proveedores", icon: "truck" };
      return item;
    });
  };

  const [menuOrder, setMenuOrderState] = useState(() => {
    const defaultMenu = [
      { id: "dashboard", label: "Dashboard", icon: "dash" },
      { id: "whatsapp", label: "Bots", icon: "bot" },
      { id: "articulos", label: "Artículos", icon: "articulos" },
      { id: "clientes", label: "Clientes", icon: "clientes" },
      { id: "caja", label: "Tesorería", icon: "banknote" },
      { id: "proveedores", label: "Proveedores", icon: "truck" },
      { id: "stats", label: "Reportes", icon: "stats" },
      { id: "config", label: "Ajustes", icon: "config" },
    ];
    let loaded = safeArr("clik-menuOrder", defaultMenu);
    
    // Asegurarse de que el bot de whatsapp esté incluido en sistemas que ya tienen el menu guardado
    if (!loaded.find((i: any) => i.id === "whatsapp")) {
      loaded.splice(1, 0, { id: "whatsapp", label: "Bots", icon: "bot" });
    }
    
    return sanitizeMenu(loaded);
  });

  const setMenuOrder = (v: any) => {
    setMenuOrderState((prev: any[]) => {
      const next = typeof v === 'function' ? v(prev) : v;
      return sanitizeMenu(next);
    });
  };

  // Deduplicate local storage data for problematic instances
  useEffect(() => {
    setCuentas((prev) => {
      let next = prev.filter(
        (v: any, i: number, a: any[]) =>
          a.findIndex((t: any) => String(t.id) === String(v.id)) === i,
      );
      next = next.filter(
        (v: any, i: number, a: any[]) =>
          a.findIndex(
            (t: any) =>
              t.nombre?.toLowerCase().trim() ===
                v.nombre?.toLowerCase().trim() && t.tipo === v.tipo,
          ) === i,
      );
      // Extra cleanup: if "Caja Efectivo" and "Caja" both exist with tipo "caja", remove "Caja"
      const hasCajaEfectivo = next.some(
        (c: any) =>
          c.nombre?.toLowerCase().trim() === "caja efectivo" &&
          c.tipo === "caja",
      );
      if (hasCajaEfectivo) {
        next = next.filter(
          (c: any) => !(c.nombre === "Caja" && c.tipo === "caja"),
        );
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKardexUpdated = () => {
      const saved = localStorage.getItem("clik-kardex");
      if (saved) {
        setKardex(JSON.parse(saved));
      }
    };
    window.addEventListener("kardex_updated", handleKardexUpdated);
    return () =>
      window.removeEventListener("kardex_updated", handleKardexUpdated);
  }, []);

  // REPLACEMENT: Real-time PocketBase Sync
  const collections = [
    { name: "usuarios", setter: setUsuarios },
    { name: "clientes", setter: setClientes },
    { name: "proveedores", setter: setProveedores },
    { name: "articulos", setter: setArticulos },
    { name: "cuentas", setter: setCuentas },
    { name: "conceptos", setter: setConceptos },
    { name: "movimientos", setter: setMovimientos },
    { name: "pagos", setter: setPagos },
    { name: "facturas", setter: setFacturas },
    { name: "factProv", setter: setFactProv },
    { name: "pagosProv", setter: setPagosProv },
    { name: "seacMovs", setter: setSeacMovs },
    { name: "seacImportaciones", setter: setSeacImportaciones },
    { name: "seacGanancias", setter: setSeacGanancias },
    { name: "seacMatchManuales", setter: setSeacMatchManuales },
    { name: "utilidadesFCI", setter: setUtilidadesFCI },
    { name: "historialCierres", setter: setHistorialCierres },
    { name: "historialImport", setter: setHistorialImport },
    { name: "ajustesStock", setter: setAjustesStock },
    { name: "kardex", setter: setKardex },
    { name: "menuOrder", setter: setMenuOrder },
  ];

  const loadData = async (active = true) => {
    // Check validation
    if (!pb.authStore.isValid) {
      setLoading(false);
      setSyncStatus("idle");
      return;
    }

    setSyncStatus("syncing");
    console.log("PocketBase is authenticated. Loading initial data...");

    try {
      // Fetch sequentially to avoid overloading SQLite/PocketBase
      for (const col of collections) {
        try {
          console.log("Fetching collection:", col.name);
          const userId = pb.authStore.model?.id;
          let filter = "";
          if (col.name === "menuOrder" && userId) {
            filter = `userId = "${userId}"`;
          }

          const realColName = CLOUD_NAME_MAP[col.name] || col.name;
          let list;
          try {
            list = await pb
              .collection(realColName)
              .getFullList({ 
                requestKey: null,
                filter: filter
              }); 
          } catch (fetchErr: any) {
            if (col.name === "menuOrder" && fetchErr.status === 400) {
              console.warn("Retrying menuOrder without filter (userId missing in schema)");
              list = await pb.collection(realColName).getFullList({ requestKey: null });
              // Filter manually if it returns records from other users
              list = list.filter(r => !r.userId || r.userId === userId);
            } else {
              throw fetchErr;
            }
          }          
          let data = list.map((r) => ({
            ...(r.payload || r.data || {}),
            id: r.payload?.id || r.data?.id || r.legacyId || r.id,
          }));
          
          // Si es menuOrder y no hay datos para el usuario, usar los defaults (no sobreescribir con vacío)
          if (col.name === "menuOrder" && data.length === 0) {
            continue;
          }

          // Apply original sorting
          data.sort((a: any, b: any) => {
            const orderA = a.orden !== undefined ? a.orden : 999999;
            const orderB = b.orden !== undefined ? b.orden : 999999;
            if (orderA !== orderB) return orderA - orderB;
            if (typeof a.id === "number" && typeof b.id === "number")
              return a.id - b.id;
            return String(a.id).localeCompare(String(b.id));
          });

          // Deduplicate
          let uniqueData = data.filter(
            (v: any, i: number, a: any[]) =>
              a.findIndex((t: any) => String(t.id) === String(v.id)) === i,
          );
          if (col.name === "cuentas" || col.name === "conceptos") {
            uniqueData = uniqueData.filter(
              (v: any, i: number, a: any[]) =>
                a.findIndex(
                  (t: any) =>
                    t.nombre?.toLowerCase().trim() ===
                      v.nombre?.toLowerCase().trim() && t.tipo === v.tipo,
                ) === i,
            );
          }
          if (active) {
            col.setter(uniqueData);
            // Set local storage so next load is fast
            localStorage.setItem(`clik-${col.name}`, JSON.stringify(uniqueData));
          }
        } catch (e) {
          console.error(`Error al cargar colección ${col.name}:`, e);
        }
      }

      if (active) setLoading(false);
      if (active) setSyncStatus("idle");
    } catch (e) {
      console.error("Error cargando DB:", e);
      if (active) setSyncStatus("error");
      if (active) setLoading(false);
    }
  };

  const refresh = async () => {
    await loadData();
  };

  useEffect(() => {
    let active = true;

    const setupSubscriptions = () => {
      // Set up real-time subscriptions
      collections.forEach((col) => {
        try {
          const realColName = CLOUD_NAME_MAP[col.name] || col.name;
          // Always unsubscribe first to avoid duplicate listeners
          pb.collection(realColName).unsubscribe("*").catch(() => {});
          
          pb.collection(realColName).subscribe("*", (e) => {
            // Filtrar menuOrder por usuario en tiempo real
            if (col.name === "menuOrder" && e.record.userId !== pb.authStore.model?.id) {
              return;
            }
            
            if (e.action === "delete") {
              col.setter((prev: any[]) =>
                prev.filter(
                  (p) => String(p.id) !== String(e.record.legacyId),
                ),
              );
            } else {
              const updatedItem = {
                ...e.record.payload,
                id: e.record.payload.id || e.record.legacyId || e.record.id,
              };
              col.setter((prev: any[]) => {
                const exist = prev.findIndex(
                  (p) => String(p.id) === String(updatedItem.id),
                );
                if (exist >= 0) {
                  const newArr = [...prev];
                  newArr[exist] = updatedItem;
                  return newArr;
                } else {
                  return [...prev, updatedItem];
                }
              });
            }
          }).catch(err => {
            console.log(`Silent fail for subscribe ${col.name}`);
          });
        } catch (err) {
          console.log(`Failed to subscribe to ${col.name}`, err);
        }
      });
    };

    // Initialize
    loadData(active).then(() => {
      if (active) setupSubscriptions();
    });

    // Re-subscribe handle for reconnection
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("App visible again, refreshing data sync...");
        loadData(true);
      }
    };
    
    const handleOnline = () => {
      console.log("App online, refreshing data sync...");
      loadData(true);
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    // Load user-specific menu order when authenticated
    if (pb.authStore.model?.id) {
      const userKey = `clik-menuOrder-${pb.authStore.model.id}`;
      const saved = localStorage.getItem(userKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setMenuOrder(parsed);
        } catch (e) {}
      }
    }

    // Listen to token changes to trigger reload
    const unsub = pb.authStore.onChange((token, model) => {
      if (!token) {
        setSyncStatus("idle");
      } else {
        loadData();
      }
    });

    return () => {
      active = false;
      unsub();
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      
      // Unsubscribe all
      collections.forEach((col) => {
        try {
          const realColName = CLOUD_NAME_MAP[col.name] || col.name;
          pb.collection(realColName).unsubscribe("*");
        } catch (e) {}
      });
    };
  }, []);

  const migrateData = async () => {
    // Already did this with the custom migrator tool.
    console.log("Migration is handled via pbMigrator now");
    alert("Los datos ya están en PocketBase.");
  };

  // Keep localStorage as local cache (read-only for start, write-only for session persistence)
  useEffect(() => { localStorage.setItem("clik-usuarios", JSON.stringify(usuarios)); }, [usuarios]);
  useEffect(() => { localStorage.setItem("clik-clientes", JSON.stringify(clientes)); }, [clientes]);
  useEffect(() => { localStorage.setItem("clik-proveedores", JSON.stringify(proveedores)); }, [proveedores]);
  useEffect(() => { localStorage.setItem("clik-articulos", JSON.stringify(articulos)); }, [articulos]);
  useEffect(() => { localStorage.setItem("clik-familias", JSON.stringify(familias)); }, [familias]);
  useEffect(() => { localStorage.setItem("clik-unidadesNegocio", JSON.stringify(unidadesNegocio)); }, [unidadesNegocio]);
  useEffect(() => { localStorage.setItem("clik-cuentas", JSON.stringify(cuentas)); }, [cuentas]);
  useEffect(() => { localStorage.setItem("clik-conceptos", JSON.stringify(conceptos)); }, [conceptos]);
  useEffect(() => { localStorage.setItem("clik-movimientos", JSON.stringify(movimientos)); }, [movimientos]);
  useEffect(() => { localStorage.setItem("clik-pagos", JSON.stringify(pagos)); }, [pagos]);
  useEffect(() => { localStorage.setItem("clik-facturas", JSON.stringify(facturas)); }, [facturas]);
  useEffect(() => { localStorage.setItem("clik-factProv", JSON.stringify(factProv)); }, [factProv]);
  useEffect(() => { localStorage.setItem("clik-pagosProv", JSON.stringify(pagosProv)); }, [pagosProv]);
  useEffect(() => { localStorage.setItem("clik-seacMovs", JSON.stringify(seacMovs)); }, [seacMovs]);
  useEffect(() => { localStorage.setItem("clik-seacImportaciones", JSON.stringify(seacImportaciones)); }, [seacImportaciones]);
  useEffect(() => { localStorage.setItem("clik-seacGanancias", JSON.stringify(seacGanancias)); }, [seacGanancias]);
  useEffect(() => { localStorage.setItem("clik-seacMatchManuales", JSON.stringify(seacMatchManuales)); }, [seacMatchManuales]);
  useEffect(() => { localStorage.setItem("clik-utilidadesFCI", JSON.stringify(utilidadesFCI)); }, [utilidadesFCI]);
  useEffect(() => { localStorage.setItem("clik-historialCierres", JSON.stringify(historialCierres)); }, [historialCierres]);
  useEffect(() => { localStorage.setItem("clik-historialImport", JSON.stringify(historialImport)); }, [historialImport]);
  useEffect(() => { localStorage.setItem("clik-ajustesStock", JSON.stringify(ajustesStock)); }, [ajustesStock]);
  useEffect(() => { localStorage.setItem("clik-kardex", JSON.stringify(kardex)); }, [kardex]);
  useEffect(() => { localStorage.setItem("clik-menuOrder", JSON.stringify(menuOrder)); }, [menuOrder]);

  const saveToCloud = async (colName: string, item: any, customId?: string) => {
    try {
      if (!pb.authStore.isValid) return; // Silent local-only
      const currentPbUserId = pb.authStore.model?.id;
      
      const docId =
        customId ||
        String(
          item.id || Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        );
      
      const recordData: any = { payload: item };
      // Extraer userId al nivel superior si existe para permitir filtrado en PocketBase
      // Fallback al ID del usuario actual si no viene en el item
      if (item.userId) {
        recordData.userId = item.userId;
      } else if (currentPbUserId) {
        recordData.userId = currentPbUserId;
        // También lo guardamos en el payload para consistencia si se vuelve a usar
        item.userId = currentPbUserId;
      }

      try {
        const existing = await pb
          .collection(colName)
          .getFirstListItem(`legacyId="${docId}"`);
        try {
          await pb.collection(colName).update(existing.id, recordData);
        } catch (updateErr: any) {
          if (updateErr.status === 400 && recordData.userId) {
            console.warn(`Retrying update in ${colName} without userId`);
            const { userId, ...noUserRecord } = recordData;
            await pb.collection(colName).update(existing.id, noUserRecord);
          } else throw updateErr;
        }
      } catch (e: any) {
        if (e.status === 404) {
          // Si no existe, lo creamos
          try {
            await pb.collection(colName).create({ legacyId: docId, ...recordData });
          } catch (createErr: any) {
            if (createErr.status === 400 && recordData.userId) {
               console.warn(`Retrying create in ${colName} without userId`);
               const { userId, ...noUserRecord } = recordData;
               await pb.collection(colName).create({ legacyId: docId, ...noUserRecord });
            } else {
              console.error(`Error al crear en PB [${colName}]:`, createErr.data || createErr.message || createErr);
              throw createErr;
            }
          }
        } else {
          console.error(`Error al buscar/actualizar en PB [${colName}]:`, e.data || e.message || e);
          throw e;
        }
      }
    } catch (error) {
      console.warn(`Error saving to ${colName} ignored during offline mode.`);
    }
  };

  const saveBatchToCloud = async (colName: string, items: any[]) => {
    try {
      console.log(`Iniciando guardado por lotes en ${colName}: ${items.length} items`);
      let successCount = 0;
      let failCount = 0;
      
      for (const item of items) {
        try {
          await saveToCloud(colName, item);
          successCount++;
          // Si el lote es muy grande (ej: inyección masiva), damos un respiro de 10ms cada 5 items
          if (items.length > 100 && successCount % 5 === 0) {
             await new Promise(r => setTimeout(r, 10));
          }
        } catch (err: any) {
          failCount++;
          const status = err.status || err.code || "unknown";
          console.error(`Error (${status}) guardando item en ${colName}:`, err.message || err);
          if (status === 403) {
            console.error("Permiso denegado por el servidor. Revisa las reglas de la colección.");
          }
        }
      }
      console.log(`Lote finalizado en ${colName}. Éxitos: ${successCount}, Fallos: ${failCount}`);
      return { success: successCount, fails: failCount };
    } catch (error) {
      console.error(`Error fatal en saveBatchToCloud para ${colName}:`, error);
      return { success: 0, fails: items.length, fatal: true };
    }
  };

  const executeCloudBatch = async (
    operations: {
      type: "set" | "delete";
      collection: string;
      id: string;
      data?: any;
    }[],
  ) => {
    // Consolidate operations by collection and id, keeping the last operation
    const consolidatedMap = new Map();
    for (const op of operations) {
      consolidatedMap.set(`${op.collection}_${op.id}`, op);
    }
    const optimizedOperations = Array.from(consolidatedMap.values());

    const completedOps: any[] = [];
    try {
      for (const op of optimizedOperations) {
        if (op.type === "set") {
          // Guardar version anterior para rollback si se puede... es complejo sin consulta previa
          await saveToCloud(op.collection, op.data, op.id);
          completedOps.push({ ...op, action: "set" });
        } else if (op.type === "delete") {
          await deleteFromCloud(op.collection, op.id);
          completedOps.push({ ...op, action: "delete" });
        }
      }
      return true;
    } catch (error) {
      console.error("Batch Transaction Error, attempting pseudo-rollback: ", error);
      // Pseudo-rollback (Best effort)
      for (const op of completedOps.reverse()) {
         try {
            if (op.action === "set") {
               // Pseudo-revertir un set es dificil sin el estado previo, pero al menos loggearlo
               console.warn("Rollback: No podemos restaurar el estado exacto de " + op.id + " en " + op.collection);
               await deleteFromCloud(op.collection, op.id);
            } else if (op.action === "delete") {
               // Recreate assuming op.data was present, but usually delete operations don't pass data
               console.warn("Rollback: Restaurando documento " + op.id + " en " + op.collection + " a estado vacio");
               if (op.data) {
                 await saveToCloud(op.collection, op.data, op.id);
               }
            }
         } catch(e) {
            console.error("Fallo critico en rollback de " + op.id, e);
         }
      }
      return false;
    }
  };

  const registerUserInAuth = async (usuario: string, clave: string) => {
    try {
      const safeUsername = usuario
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_.-]/g, "");
      const email = `${safeUsername}@clik.internal`;
      const safePassword = (clave || "12345678").padEnd(8, "0");

      await pb.collection("users").create({
        username: safeUsername,
        email: email,
        password: safePassword,
        passwordConfirm: safePassword,
        name: usuario,
        emailVisibility: false,
        verified: true,
      });
      console.log("Usuario registrado en PocketBase Auth correctamente");
    } catch (error: any) {
      console.error("Error al registrar usuario en Auth:", error.message);
    }
  };

  const deleteFromCloud = async (colName: string, id: string | number) => {
    try {
      if (!pb.authStore.isValid) return; // Silent local-only
      const realColName = CLOUD_NAME_MAP[colName] || colName;
      const existing = await pb
        .collection(realColName)
        .getFirstListItem(`legacyId="${String(id)}"`);
      await pb.collection(realColName).delete(existing.id);
    } catch (error) {
      console.warn(
        `Error deleting from ${colName} ignored during offline mode.`,
      );
    }
  };

  const deleteBatchFromCloud = async (
    colName: string,
    ids: (string | number)[],
  ) => {
    try {
      for (const id of ids) {
        await deleteFromCloud(colName, id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const cloudSync = {
    loading,
    migrating,
    migrateData,
    status: syncStatus,
    refresh,
    saveToCloud,
    saveBatchToCloud,
    deleteBatchFromCloud,
    registerUserInAuth,
    deleteFromCloud,
    executeCloudBatch,
  };

  return (
    <DataContext.Provider
      value={{
        usuarios,
        setUsuarios,
        clientes,
        setClientes,
        proveedores,
        setProveedores,
        articulos,
        setArticulos,
        familias,
        setFamilias,
        unidadesNegocio,
        setUnidadesNegocio,
        cuentas,
        setCuentas,
        conceptos,
        setConceptos,
        movimientos,
        setMovimientos,
        pagos,
        setPagos,
        facturas,
        setFacturas,
        factProv,
        setFactProv,
        pagosProv,
        setPagosProv,
        seacMovs,
        setSeacMovs,
        seacImportaciones,
        setSeacImportaciones,
        seacGanancias,
        setSeacGanancias,
        seacMatchManuales,
        setSeacMatchManuales,
        utilidadesFCI,
        setUtilidadesFCI,
        historialCierres,
        setHistorialCierres,
        historialImport,
        setHistorialImport,
        ajustesStock,
        setAjustesStock,
        kardex,
        setKardex,
        menuOrder,
        setMenuOrder,
        cloudSync,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
};
