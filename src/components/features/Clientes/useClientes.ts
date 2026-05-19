import { useState, useMemo } from 'react';
import { normalizar } from '../../../lib/utils';
import { calcularSaldosMap } from '../../../lib/clientes/calculosSaldos';

export function useClientes(clientes: any[] = [], facturas: any[] = [], pagos: any[] = [], cloudSync: any) {
  const [busq, setBusq] = useState("");
  const [showArchivados, setShowArchivados] = useState(false);

  // Calcula saldos de todos los clientes basándose en facturas y pagos (optimizado con useMemo)
  const saldosMap = useMemo(() => {
    return calcularSaldosMap(clientes, facturas, pagos);
  }, [clientes, facturas, pagos]);

  // Clasifica clientes como inactivos según actividad, pero no los archiva automáticamente
  const clientesConAutoEstado = useMemo(() => {
    const lastActivityByClient: Record<number, number> = {};
    facturas.forEach((f: any) => {
      const time = new Date(f.fecha).getTime();
      const current = lastActivityByClient[f.clienteId] || 0;
      if (time > current) lastActivityByClient[f.clienteId] = time;
    });
    pagos.forEach((p: any) => {
      const time = new Date(p.fecha).getTime();
      const current = lastActivityByClient[p.clienteId] || 0;
      if (time > current) lastActivityByClient[p.clienteId] = time;
    });

    return clientes.map((c: any) => {
      const lastActivity = lastActivityByClient[c.id] || 0;
      
      let autoEstado = c.estado || "activo";
      if (lastActivity > 0) {
        const daysInactive = (Date.now() - lastActivity) / (1000 * 3600 * 24);
        if (autoEstado === "activo" && daysInactive >= 30) {
          autoEstado = "inactivo";
        }
      }
      return { ...c, autoEstado };
    });
  }, [clientes, facturas, pagos]);

  // Filtrado general por búsqueda y estado
  const filtrados = useMemo(() => {
    const q = normalizar(busq);
    return clientesConAutoEstado
      .filter((c: any) => showArchivados ? c.estado === "archivado" : c.estado !== "archivado")
      .filter((c: any) => normalizar(c.nombre).includes(q) || (c.codigo || "").toLowerCase().includes(q))
      .map((c: any) => ({ ...c, _saldo: saldosMap[c.id] || 0 }));
  }, [clientesConAutoEstado, busq, saldosMap, showArchivados]);

// Modificadores de estado (Wrappers sobre la API para guardar y optimista UI)
  const guardarCliente = async (clienteUpdate: any, setClientesGlobal: any) => {
    try {
      if (cloudSync?.saveToCloud) {
         await cloudSync.saveToCloud("clientes", clienteUpdate);
      }
      
      // Optimitic update local
      setClientesGlobal((prev: any[]) => {
        const idx = prev.findIndex((c: any) => String(c.id) === String(clienteUpdate.id));
        if (idx !== -1) {
          const copia = [...prev];
          copia[idx] = clienteUpdate;
          return copia;
        }
        return [clienteUpdate, ...prev];
      });
    } catch (e) {
      console.error("Error guardando cliente", e);
    }
  };

  const handleUpdateInline = async (cliente: any, field: string, val: any, setClientesGlobal: any) => {
    const dGuardar = { ...cliente, [field]: val };
    await guardarCliente(dGuardar, setClientesGlobal);
  };

  const handleUpdateInlineMulti = async (cliente: any, updates: Record<string, any>, setClientesGlobal: any) => {
    const dGuardar = { ...cliente, ...updates };
    await guardarCliente(dGuardar, setClientesGlobal);
  };

  const handleEliminarCliente = async (clienteId: string, setClientesGlobal: any) => {
    try {
      if (cloudSync?.deleteFromCloud) {
        await cloudSync.deleteFromCloud("clientes", clienteId);
      }
      setClientesGlobal((prev: any[]) => prev.filter((c: any) => String(c.id) !== String(clienteId)));
    } catch (e) {
      console.error("Error eliminando cliente", e);
    }
  };

  return {
    busq,
    setBusq,
    showArchivados,
    setShowArchivados,
    filtrados,
    saldosMap,
    clientesConAutoEstado,
    guardarCliente,
    handleUpdateInline,
    handleUpdateInlineMulti,
    handleEliminarCliente
  };
}
