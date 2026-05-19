import React from "react";
import { useApp } from "../../../context/AppContext";
import { Fld, Inp, Sel, Btn, Ic, OverlaySheet } from "../../common/UIBase";
import { PROVINCIAS, LOCALIDADES_POR_PROVINCIA } from "../../../constants";

export function ModalCliente({
  open,
  onClose,
  editando,
  setEditando,
  user,
  onSave,
  onDelete
}: any) {
  const { t } = useApp();

  if (!open || !editando) {
    console.log("ModalCliente early return", {open, editando});
    return null;
  }
  
  console.log("ModalCliente rendering...", { open, editando });

  const localidades = editando.provincia ? LOCALIDADES_POR_PROVINCIA[editando.provincia] || [] : [];

  return (
    <OverlaySheet
      open={true}
      onClose={onClose}
      title={editando.nombre ? "Editar Cliente" : "Nuevo Cliente"}
      width="600px"
    >
      {/* BLOQUE 1: IDENTIDAD & CONEXIÓN BOT RPA */}
      <div style={{ background: t.green + "05", borderRadius: "16px", padding: "16px", border: `1px solid ${t.green}15`, marginBottom: 20 }}>
        {/* Header Bot RPA */}
        <div style={{ 
          marginBottom: 16, 
          padding: "10px 14px", 
          background: t.green + "08", 
          border: `1px solid ${t.green}18`, 
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          <Ic n="bot" s={18} style={{ color: t.green }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: t.green, textTransform: "uppercase", letterSpacing: 0.5 }}>Conexión Bot & RPA</div>
          </div>
          <div style={{ fontSize: 10, color: t.text + "66", fontWeight: 600, fontStyle: "italic", textAlign: "right" }}>
            Usa: Teléfono, Alias y Tipo
          </div>
        </div>

        {/* Fila 1: ID - Nombre o razón Social - Teléfono */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 70 }}>
            <Fld label="ID">
              <Inp 
                value={editando.id || ""} 
                disabled 
                style={{ opacity: 0.7, background: t.surf2, textAlign: "center" }} 
                maxLength={3}
              />
            </Fld>
          </div>
          <div style={{ flex: 1 }}>
            <Fld label="Nombre o razón Social (*)">
              <Inp
                autoFocus
                value={editando.nombre || ""}
                onChange={(e: any) =>
                  setEditando({ ...editando, nombre: e.target.value })
                }
              />
            </Fld>
          </div>
          <div style={{ width: 150 }}>
            <Fld label={
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Teléfono <Ic n="whatsapp" s={10} style={{ color: t.green }} />
              </div>
            }>
              <Inp
                value={editando.telefono || ""}
                onChange={(e: any) =>
                  setEditando({ ...editando, telefono: e.target.value })
                }
              />
            </Fld>
          </div>
        </div>

        {/* Fila 2: identificación - Persona de contacto */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 170 }}>
            <Fld label="Identificación (CUIT/DNI)">
              <Inp
                value={editando.cuit || ""}
                onChange={(e: any) =>
                  setEditando({ ...editando, cuit: e.target.value })
                }
              />
            </Fld>
          </div>
          <div style={{ flex: 1 }}>
            <Fld label="Persona de Contacto">
              <Inp
                value={editando.personaContacto || ""}
                onChange={(e: any) =>
                  setEditando({ ...editando, personaContacto: e.target.value })
                }
                placeholder="Nombre del responsable o encargado"
              />
            </Fld>
          </div>
        </div>

        {/* Fila 3: nombre en carga virtual - lista de precios */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <Fld label={
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Nombre en Carga Virtual <Ic n="whatsapp" s={10} style={{ color: t.green }} />
              </div>
            }>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(Array.isArray(editando.nombreCV)
                  ? editando.nombreCV
                  : editando.nombreCV
                  ? [editando.nombreCV]
                  : []
                ).map((alias: string, i: number) => (
                  <div
                    key={i}
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <Inp
                      value={alias}
                      onChange={(e: any) => {
                        const arr = Array.isArray(editando.nombreCV)
                          ? [...editando.nombreCV]
                          : editando.nombreCV
                          ? [editando.nombreCV]
                          : [];
                        arr[i] = e.target.value;
                        setEditando({ ...editando, nombreCV: arr });
                      }}
                      placeholder="Como aparece en SEAC"
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={() => {
                        const arr = Array.isArray(editando.nombreCV)
                          ? [...editando.nombreCV]
                          : editando.nombreCV
                          ? [editando.nombreCV]
                          : [];
                        setEditando({
                          ...editando,
                          nombreCV: arr.filter((_, j) => j !== i)
                        });
                      }}
                      style={{ color: t.red, fontSize: 16, border: "none", background: "none", cursor: "pointer" }}
                    >✕</button>
                  </div>
                ))}
                <Btn v="ghost" style={{ alignSelf: "flex-start", height: 24, fontSize: 10, padding: "0 8px" }} onClick={() => {
                      const arr = Array.isArray(editando.nombreCV) ? [...editando.nombreCV] : editando.nombreCV ? [editando.nombreCV] : [];
                      setEditando({ ...editando, nombreCV: [...arr, ""] });
                    }}>+ Agregar alias CV</Btn>
              </div>
            </Fld>
          </div>
          <div style={{ width: 140 }}>
            <Fld label="Lista de precios">
              <Sel
                value={editando.listaPrecios || (editando.precioManual ? "manual" : "")}
                onChange={(e: any) => {
                  const val = e.target.value;
                  setEditando({
                    ...editando,
                    listaPrecios: val && val !== "manual" ? parseInt(val) : null,
                    precioManual: val === "manual"
                  });
                }}
              >
                <option value="">Sin lista</option>
                <option value="manual">Diferencial</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>Lista {n}</option>)}
              </Sel>
            </Fld>
          </div>
          <div style={{ width: 150 }}>
            <Fld label={
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Tipo Cliente <Ic n="whatsapp" s={10} style={{ color: t.green }} />
              </div>
            }>
              <Sel
                value={editando.tipoCliente || "CC"}
                onChange={(e: any) => setEditando({ ...editando, tipoCliente: e.target.value })}
              >
                <option value="CC">Cuenta Corriente</option>
                <option value="PREP">Prepago (Solo Bot)</option>
              </Sel>
            </Fld>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: UBICACIÓN */}
      <div style={{ background: t.surf2, borderRadius: "16px", padding: "16px", border: `1px solid ${t.border}`, marginBottom: 20 }}>
        <div style={{ color: t.sub, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 }}>Domicilio y Localización</div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Fld label="Domicilio">
              <Inp
                value={editando.domicilio || editando.direccion || ""}
                onChange={(e: any) =>
                  setEditando({
                    ...editando,
                    domicilio: e.target.value,
                    direccion: e.target.value
                  })
                }
                placeholder="Calle y Nro"
              />
            </Fld>
          </div>
          <div style={{ width: 120 }}>
            <Fld label="Piso / Depto">
              <Inp
                value={editando.pisoDepto || ""}
                onChange={(e: any) =>
                  setEditando({ ...editando, pisoDepto: e.target.value })
                }
                placeholder="Ej: 2B"
              />
            </Fld>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Fld label="Provincia">
              <Sel
                value={editando.provincia || ""}
                onChange={(e: any) => {
                  const prov = e.target.value;
                  const newLoc = LOCALIDADES_POR_PROVINCIA[prov] ? "" : editando.localidad;
                  setEditando({ ...editando, provincia: prov, localidad: newLoc });
                }}
              >
                <option value="">Seleccionar...</option>
                {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
              </Sel>
            </Fld>
          </div>
          <div style={{ flex: 1 }}>
            <Fld label="Localidad">
              {localidades.length > 0 ? (
                <Sel
                  value={editando.localidad || ""}
                  onChange={(e: any) =>
                    setEditando({ ...editando, localidad: e.target.value })
                  }
                >
                  <option value="">Seleccionar...</option>
                  {localidades.map(l => <option key={l} value={l}>{l}</option>)}
                  <option value="OTRA">-- Otra --</option>
                </Sel>
              ) : (
                <Inp
                  value={editando.localidad || ""}
                  onChange={(e: any) =>
                    setEditando({ ...editando, localidad: e.target.value })
                  }
                  placeholder="Ciudad / Barrio"
                />
              )}
            </Fld>
          </div>
        </div>
        
        {editando.localidad === "OTRA" && (
          <Fld label="Especificar Localidad">
            <Inp 
              autoFocus
              value={editando._localidad_manual || ""}
              onChange={(e: any) => setEditando({ ...editando, _localidad_manual: e.target.value })}
              onBlur={() => {
                if (editando._localidad_manual) {
                  setEditando({ ...editando, localidad: editando._localidad_manual, _localidad_manual: "" });
                }
              }}
            />
          </Fld>
        )}
      </div>

      {/* BLOQUE 3: CONFIGURACIÓN FINANCIERA */}
      {(user?.rol === "maestro" || user?.permisos?.borrarClientes) && (
        <div style={{ background: t.surf2, borderRadius: "16px", padding: "16px", border: `1px solid ${t.border}`, marginBottom: 20 }}>
          <div style={{ color: t.sub, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 }}>Cuentas y Límites</div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Fld label="Saldo inicial ($)">
                <Inp
                  type="number"
                  value={editando.saldoInicial || ""}
                  onChange={(e: any) => setEditando({ ...editando, saldoInicial: e.target.value })}
                  placeholder="0"
                />
              </Fld>
            </div>
            <div style={{ flex: 1 }}>
              <Fld label="Fecha saldo inicial">
                <Inp
                  type="date"
                  value={editando.fechaSaldoInicial || ""}
                  onChange={(e: any) => setEditando({ ...editando, fechaSaldoInicial: e.target.value })}
                />
              </Fld>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <Fld label="Límite de crédito ($)">
                <Inp
                  type="number"
                  value={editando.creditoMax || editando.limiteCredito || ""}
                  onChange={(e: any) => setEditando({ ...editando, creditoMax: e.target.value })}
                  placeholder="Sin límite"
                />
              </Fld>
            </div>
            <div style={{ flex: 1, paddingTop: 24 }}>
               <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: editando.permitirExcederLimite ? t.amber + "18" : t.surf,
                  border: `1px solid ${editando.permitirExcederLimite ? t.amber + "44" : t.border}`,
                  cursor: "pointer",
                  userSelect: "none"
                }}
                onClick={() => setEditando({ ...editando, permitirExcederLimite: !editando.permitirExcederLimite })}
              >
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${editando.permitirExcederLimite ? t.amber : t.border}`, background: editando.permitirExcederLimite ? t.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {editando.permitirExcederLimite && <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>✓</span>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: editando.permitirExcederLimite ? t.amber : t.text }}>🔓 Exceder límite</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ITEM AISLADO: ESTADO */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div style={{ width: 220 }}>
          <Fld label="Estado del Cliente">
            <Sel
              value={editando.estado || "activo"}
              onChange={(e: any) => setEditando({ ...editando, estado: e.target.value })}
              style={{ fontWeight: 800, color: editando.estado === "activo" ? t.green : (editando.estado === "inactivo" ? t.red : t.text) }}
            >
              <option value="activo">● ACTIVO</option>
              <option value="inactivo">○ INACTIVO / BLOQUEADO</option>
              <option value="archivado">◌ ARCHIVADO</option>
            </Sel>
          </Fld>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn
          v="ghost"
          onClick={onClose}
          full
        >
          Cancelar
        </Btn>
        {editando.id &&
          (user?.rol === "maestro" || user?.permisos?.borrarClientes) && (
            <Btn v="danger" onClick={onDelete} type="button">
              <Ic n="trash" s={14} /> Eliminar
            </Btn>
          )}
        <Btn onClick={onSave} disabled={!editando.nombre} full>
          <Ic n="check" s={14} />
          Guardar
        </Btn>
      </div>
    </OverlaySheet>
  );
}
