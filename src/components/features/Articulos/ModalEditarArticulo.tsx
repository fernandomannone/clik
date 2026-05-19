import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Fld, Inp, Sel, Btn, Ic, OverlaySheet, BtnEliminarConClave } from "../../common/UIBase";

export default function ModalEditarArticulo({ open, onClose, articulo, onSave, onDelete, familias, proveedores, user }: any) {
  const { t } = useApp();
  const canVerCostos = user?.rol === "maestro" || user?.permisos?.costos;

  const editando = !!articulo;
  const [llevaStock, setLlevaStock] = useState(true);

  const [costo, setCosto] = useState<number>(0);
  const [util, setUtil] = useState<number[]>([0, 0, 0, 0]);
  const [precio, setPrecio] = useState<number[]>([0, 0, 0, 0]);

  useEffect(() => {
    if (articulo) {
      setLlevaStock(articulo.llevaStock !== false);
      setCosto(articulo.costo || 0);
      setUtil(articulo.utilidad || [0, 0, 0, 0]);
      setPrecio([
        articulo.precio1 || 0,
        articulo.precio2 || 0,
        articulo.precio3 || 0,
        articulo.precio4 || 0,
      ]);
    } else {
      setLlevaStock(true);
      setCosto(0);
      setUtil([0, 0, 0, 0]);
      setPrecio([0, 0, 0, 0]);
    }
  }, [articulo, open]);

  const handleCostoChange = (valStr: string) => {
    const c = parseFloat(valStr) || 0;
    setCosto(c);
    if (c > 0) {
      setPrecio(util.map(u => parseFloat((c * (1 + u / 100)).toFixed(2))));
    }
  };

  const handleUtilChange = (idx: number, valStr: string) => {
    const u = parseFloat(valStr) || 0;
    const newUtil = [...util];
    newUtil[idx] = u;
    setUtil(newUtil);
    
    if (costo > 0) {
      const newPrecio = [...precio];
      newPrecio[idx] = parseFloat((costo * (1 + u / 100)).toFixed(2));
      setPrecio(newPrecio);
    }
  };

  const handlePrecioChange = (idx: number, valStr: string) => {
    const p = parseFloat(valStr) || 0;
    const newPrecio = [...precio];
    newPrecio[idx] = p;
    setPrecio(newPrecio);
    
    if (costo > 0) {
      const newUtil = [...util];
      newUtil[idx] = parseFloat((((p / costo) - 1) * 100).toFixed(2));
      setUtil(newUtil);
    }
  };

  if (!open) return null;

  const handleSaveWrapper = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    
    const pVal = fd.get("proveedor") as string;
    const payload = {
      codigo: fd.get("codigo") || "",
      nombre: fd.get("nombre"),
      familia: fd.get("familia"),
      proveedor: isNaN(Number(pVal)) ? pVal : Number(pVal),
      costo,
      precio1: precio[0],
      precio2: precio[1],
      precio3: precio[2],
      precio4: precio[3],
      utilidad: util,
      llevaStock,
      estado: fd.get("estado") || "activo",
      minimo: parseFloat(fd.get("minimo") as string) || 0,
      diasAlerta: parseInt(fd.get("diasAlerta") as string) || 0
    };
    onSave(payload);
  };

  const getF = (f: any) => {
    if (!f) return "";
    return typeof f === "string" ? f : f.nombre || "";
  };

  return (
    <OverlaySheet open={true} onClose={onClose} title={editando ? "Editar Artículo" : "Nuevo Artículo"} width="600px">
      <form onSubmit={handleSaveWrapper}>
        <div style={{ background: t.surf2, borderRadius: "16px", padding: "16px", border: `1px solid ${t.border}`, marginBottom: 20 }}>
          <div style={{ color: t.sub, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 }}>Datos Principales</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <Fld label="CÓDIGO" half>
              <Inp name="codigo" defaultValue={articulo?.codigo} placeholder="Ej: 099" />
            </Fld>
            <Fld label="NOMBRE DEL ARTÍCULO" half>
              <Inp name="nombre" defaultValue={articulo?.nombre} required />
            </Fld>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <Fld label="FAMILIA" half>
              <Sel name="familia" defaultValue={articulo?.familia || (familias && familias.length > 0 ? getF(familias[0]) : "")}>
                {(familias || []).map((f: any, i: number) => {
                  const n = getF(f);
                  return <option key={i} value={n}>{n}</option>;
                })}
              </Sel>
            </Fld>
            <Fld label="PROVEEDOR" half>
              <Sel name="proveedor" defaultValue={typeof articulo?.proveedor === 'object' ? articulo?.proveedor?.id : (articulo?.proveedor || "0")}>
                <option value="0">Sin Proveedor</option>
                {(proveedores || []).filter((p: any) => p && (p.estado !== "archivado" || p.id === (typeof articulo?.proveedor === 'object' ? (articulo?.proveedor?.id || "") : (articulo?.proveedor || "")))).map((p: any) => <option key={p.id} value={p.id}>{p.nombre || "Sin nombre"}</option>)}
              </Sel>
            </Fld>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Fld label="ESTADO" half>
              <Sel name="estado" defaultValue={articulo?.estado || "activo"}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo (30 días)</option>
                <option value="archivado">Archivado (45 días)</option>
              </Sel>
            </Fld>
            <div style={{ width: "50%" }}></div>
          </div>
        </div>

        <div style={{ background: t.surf2, borderRadius: "16px", padding: "16px", border: `1px solid ${t.border}`, marginBottom: 20 }}>
          <div style={{ color: t.sub, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 }}>Precios y Costos</div>
          {canVerCostos && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <Fld label="COSTO ($)" half>
                <Inp name="costo" type="number" step="0.01" value={costo || ""} onChange={e => handleCostoChange((e.target as any).value)} />
              </Fld>
              <div style={{ width: "50%" }}></div>
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, color: t.sub, letterSpacing: "1px", marginBottom: 16 }}>PRECIOS POR LISTA</div>
          <div style={{ display: "flex", gap: 12 }}>
            {[1, 2, 3, 4].map((l, i) => (
              <div key={l} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.sub }}>Lista {l}</div>
                {canVerCostos && (
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: t.muted }}>%</span>
                    <Inp 
                      name={`u${l}`} 
                      type="number" 
                      step="0.01" 
                      value={util[i] || ""} 
                      onChange={e => handleUtilChange(i, (e.target as any).value)} 
                      style={{ paddingLeft: 24 }} 
                    />
                  </div>
                )}
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: t.muted }}>$</span>
                  <Inp 
                    name={`p${l}`} 
                    type="number" 
                    step="0.01" 
                    value={precio[i] || ""} 
                    onChange={e => handlePrecioChange(i, (e.target as any).value)}
                    style={{ paddingLeft: 24 }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: t.surf2, borderRadius: "16px", padding: "16px", border: `1px solid ${t.border}`, marginBottom: 20 }}>
          <div style={{ color: t.sub, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 16, letterSpacing: 0.5 }}>Configuración de Stock y Alertas</div>
          <div 
            onClick={() => setLlevaStock(!llevaStock)}
            style={{ display: "flex", gap: 12, background: llevaStock ? t.greenBg + "44" : t.surf, border: `1px solid ${llevaStock ? t.green : t.border}`, borderRadius: 12, padding: "16px 20px", cursor: "pointer", marginBottom: 16, transition: "background 0.2s" }}
          >
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: llevaStock ? t.green : t.muted, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {llevaStock && <Ic n="check" s={14} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: llevaStock ? t.green : t.sub }}>Lleva stock físico</div>
              <div style={{ fontSize: 13, color: t.muted }}>Los artículos sin stock no aparecen en Kardex ni Valorización</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Fld label="STOCK MÍNIMO (ALERTA)" half>
              <Inp name="minimo" type="number" defaultValue={articulo?.minimo || 0} />
            </Fld>
            <Fld label="DÍAS PARA ALERTA DE VENCIMIENTO" half>
              <Inp name="diasAlerta" type="number" defaultValue={articulo?.diasAlerta || 0} placeholder="0 = default" />
            </Fld>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, paddingTop: 24, borderTop: `1px solid ${t.border}` }}>
          <Btn v="ghost" onClick={onClose} style={{ flex: 1 }} type="button">Cancelar</Btn>
          {(editando && articulo.estado !== "inactivo" && articulo.estado !== "archivado") && (
            <BtnEliminarConClave onConfirm={() => onDelete ? onDelete() : onSave({ estado: "inactivo" })} style={{ flex: "none" }} entidadNombre={articulo.nombre} />
          )}
          <Btn type="submit" style={{ flex: 1 }}><Ic n="check" s={16} /> Guardar cambios</Btn>
        </div>
      </form>
    </OverlaySheet>
  );
}
