import React from "react";
import { BuscadorSelect } from "../../common/UIBase";
import { normalizar } from "../../../lib/utils";

export function BuscadorCliente({ clientes = [], valor = null, onChange, placeholder = "Buscar cliente...", candidatos = [] }: any) {
  const opciones = React.useMemo(() => {
    return [...clientes].filter((c: any) => c.estado !== "archivado").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [clientes]);

  return <BuscadorSelect
    opciones={opciones}
    valor={valor}
    onChange={onChange}
    placeholder={placeholder}
    candidatos={candidatos}
    filterFn={(c: any, q: string) => 
      normalizar(c.nombre).includes(q) ||
      (c.codigo || "").toLowerCase().includes(q)
    }
  />
}
