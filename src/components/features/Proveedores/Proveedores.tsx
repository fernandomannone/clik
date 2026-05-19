import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Tbl, Tr, Td, Bdg, Btn, Ic, SearchBar, Modal, Fld, Inp, Sel, Avatar, ThSort, useSort, InpMoney, BtnEliminarConClave, OverlaySheet, DropDown, DropDownItem } from "../../common/UIBase";
import { PageContainer } from "../../layout/AppShell";
import { fmtMoney, fmtFechaCC, getToday } from "../../../lib/utils";
import { PROVINCIAS, LOCALIDADES_POR_PROVINCIA } from "../../../constants";
import { ModalPagarProveedor } from "./ModalPagarProveedor";
import { ModalCCProv } from "./ModalCCProv";
import { ModalFacturaProv } from "./ModalFacturaProv";
import { ModalExportacion } from "../../common/ModalExportacion";
import { SEACCuentaCorriente } from "./SEACCuentaCorriente";
import { TestFacturaIA } from "./TestFacturaIA";

const today = getToday();

export default function Proveedores(props: any) {
  const { proveedores = [], setProveedores, factProv = [], setFactProv, pagosProv = [], setPagosProv, cuentas = [], articulos = [], setArticulos, user, seacMovs = [], setSeacMovs, seacImportaciones = [], setSeacImportaciones, movimientos = [], setMovimientos, setCuentas, facturas = [], clientes = [], pagos = [], setPagos, seacMatchManuales = [], setSeacMatchManuales, historialCierres = [] } = props;
  const { t } = useApp();
  const [tab, setTab] = useState("maestro");
  const [busq, setBusq] = useState("");
  const [showExportar, setShowExportar] = useState(false);
  const [showTestFacturaIA, setShowTestFacturaIA] = useState(false);
  const [showArchivados, setShowArchivados] = useState(false);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [verCC, setVerCC] = useState<any>(null);
  const [modalPagoProv, setModalPagoProv] = useState(false);
  const [modalFac, setModalFac] = useState<any>(null);
  const [fechaSaldo, setFechaSaldo] = useState(today);
  const [provFilter, setProvFilter] = useState("");
  const [locManual, setLocManual] = useState("");

  useEffect(() => {
    if (modal) {
      setProvFilter(editando?.provincia || "");
      setLocManual(editando?.localidad === "OTRA" ? editando?._localidad_manual || "" : editando?.localidad || "");
    }
  }, [modal, editando]);

  const { sortKey: skProv, sortDir: sdProv, toggleSort: tsProv } = useSort("nombre", "asc");

  const ccProv = (pid: number) => {
    const facs = factProv.filter((f: any) => f.proveedorId === pid && !f.anulada).map((f: any) => ({ ...f, tipo: f.tipo || "factura" }));
    const pags = pagosProv.filter((p: any) => p.proveedorId === pid && !p.anulado).map((p: any) => ({ ...p, tipo: "pago", total: p.monto }));
    return [...facs, ...pags].sort((a, b) => a.fecha.localeCompare(b.fecha));
  };

  const saldoProv = (pid: number) => {
    const prov = proveedores.find((p: any) => p.id === pid);
    const ini = parseFloat(prov?.saldoInicial) || 0;
    const fechaIni = prov?.fechaSaldoInicial;
    return ini + ccProv(pid).filter((m: any) => !fechaIni || m.fecha.substring(0, 10) > fechaIni.substring(0, 10)).reduce((s, m) => (m.tipo === "factura" || m.tipo === "nd") ? s - Math.abs(m.total || m.monto || 0) : s + Math.abs(m.total || m.monto || 0), 0);
  };

  const saldosHistoricos = useMemo(() => {
    const m: any = {};
    proveedores.forEach((p: any) => {
      const prov = proveedores.find((x: any) => x.id === p.id);
      const raw = ccProv(p.id);
      const sorted = [...raw].sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
      let running = parseFloat(prov?.saldoInicial) || 0;
      const fechaIni = prov?.fechaSaldoInicial;
      let val = running;
      for (const mov of sorted) {
        if (fechaIni && mov.fecha.substring(0, 10) <= fechaIni.substring(0, 10)) continue;
        if (mov.fecha.substring(0, 10) > fechaSaldo.substring(0, 10)) break;
        const tot = Math.abs(parseFloat(mov.total || mov.monto) || 0);
        const cr = (mov.tipo === "factura" || mov.tipo === "nd") ? -tot : +tot;
        running = running + cr;
        val = running;
      }
      m[p.id] = val;
    });
    return m;
  }, [proveedores, factProv, pagosProv, fechaSaldo, historialCierres]);

  const filtrados = useMemo(() => {
    return (proveedores || []).filter((p: any) => {
      if (!p) return false;
      const isArchivado = p.estado === "archivado";
      if (showArchivados ? !isArchivado : isArchivado) return false;
      return (p.nombre || "").toLowerCase().includes(busq.toLowerCase()) || (p.cuit || "").includes(busq);
    }).sort((a: any, b: any) => {
      if (!a || !b) return 0;
      if (skProv === "nombre") return sdProv === "asc" ? (a.nombre || "").localeCompare(b.nombre || "") : (b.nombre || "").localeCompare(a.nombre || "");
      return 0;
    });
  }, [proveedores, busq, skProv, sdProv, showArchivados]);

  const guardar = (e: any) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nuevo = {
      id: editando ? editando.id : Date.now(),
      nombre: fd.get("nombre"),
      cuit: fd.get("cuit"),
      telefono: fd.get("telefono"),
      email: fd.get("email"),
      direccion: fd.get("direccion"),
      localidad: fd.get("localidad") === "OTRA" ? fd.get("_localidad_manual") : fd.get("localidad"),
      provincia: fd.get("provincia"),
      personaContacto: fd.get("personaContacto"),
      obs: fd.get("obs"),
      alias: fd.get("alias"),
      saldoInicial: parseFloat(fd.get("saldoInicial") as string) || 0,
      fechaSaldoInicial: fd.get("fechaSaldoInicial"),
      estado: fd.get("estado") || "activo"
    };

    if (editando) {
      if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("proveedores", nuevo);
      setProveedores(proveedores.map((p: any) => p.id === editando.id ? { ...p, ...nuevo } : p));
    } else {
      if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("proveedores", nuevo);
      setProveedores([...proveedores, nuevo]);
    }
    setModal(false);
  };

  const canVerCostosP = user?.rol === "maestro" || user?.permisos?.costos;
  const canBorrarProveedores = user?.rol === "maestro" || user?.permisos?.borrarClientes;

  const totalesP = { 
    activos: proveedores.filter((p: any) => p.estado === "activo" || !p.estado).length,
    inactivos: proveedores.filter((p: any) => p.estado === "inactivo").length,
    archivados: proveedores.filter((p: any) => p.estado === "archivado").length 
  };
  const subTextP = <div style={{display:"flex", gap:15, alignItems:"center", fontSize:12, marginTop:4}}>
    <span><b>{proveedores.length}</b> total</span>
    <span style={{color:t.green}}><b>{totalesP.activos}</b> activos</span>
    {totalesP.inactivos > 0 && <span style={{color:"#f59e0b"}}><b>{totalesP.inactivos}</b> inactivos</span>}
    {totalesP.archivados > 0 && <span style={{color:t.muted}}><b>{totalesP.archivados}</b> archivados</span>}
  </div>;

  return (
    <PageContainer 
      title="Proveedores" 
      sub={subTextP} 
      stickyHeader={false}
      actions={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Btn onClick={() => { setEditando(null); setModal(true); }} style={{ height: 38 }}><Ic n="plus" s={14} /> Nuevo Proveedor</Btn>

          <DropDown 
             trigger={<Btn v="ghost" style={{ height: 38, padding: "0 10px" }} title="Opciones"><Ic n="dots" s={18} /></Btn>}
             align="right"
          >
             <DropDownItem icon="money" onClick={() => setModalPagoProv(true)}>Registrar Pago</DropDownItem>
             <DropDownItem icon="upload" onClick={() => setShowTestFacturaIA(true)}>Prueba Factura IA</DropDownItem>
             <DropDownItem icon="transfer" onClick={() => setShowExportar(true)}>Exportar Proveedores</DropDownItem>
          </DropDown>
        </div>
      }
      extraHeader={
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 10, borderBottom: `1px solid ${t.border}` }}>
            {["maestro", "saldos", "seac"].map(tId => (
              <button key={tId} onClick={() => setTab(tId)} style={{ padding: "10px 20px", border: "none", borderBottom: `2px solid ${tab === tId ? t.accent : "transparent"}`, background: "none", color: tab === tId ? t.accent : t.sub, fontWeight: tab === tId ? 700 : 500, cursor: "pointer", fontSize: "14px", marginBottom: -1 }}>
                {tId === "seac" ? "CC RGP-SEAC" : tId.charAt(0).toUpperCase() + tId.slice(1)}
              </button>
            ))}
          </div>
          {tab === "maestro" && (
            <SearchBar 
              value={busq} 
              onChange={setBusq} 
              placeholder="Buscar por nombre o CUIT..." 
              addon={
                <button
                  onClick={() => setShowArchivados(!showArchivados)}
                  title={showArchivados ? "Ocultar archivados" : "Mostrar archivados"}
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, background: showArchivados ? t.accentBg : t.surf, border: `1px solid ${showArchivados ? t.accent : t.border}`, color: showArchivados ? t.accent : t.sub, cursor: "pointer", transition: "all 0.15s" }}
                >
                  <Ic n="eye" s={16} />
                </button>
              }
            />
          )}
          {tab === "saldos" && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", background: t.surf2, padding: "12px 16px", borderRadius: 12, border: `1px solid ${t.border}` }}>
              <Fld label="Ver saldos al día" style={{ marginBottom: 0, width: 180 }}><Inp type="date" value={fechaSaldo} onChange={(e: any) => setFechaSaldo(e.target.value)} /></Fld>
            </div>
          )}
        </div>
      }
    >
      {tab === "maestro" && (
        <>

          <Tbl headers={[<ThSort label="Proveedor" colKey="nombre" sortKey={skProv} sortDir={sdProv} onSort={tsProv} />, "CUIT", "Teléfono", <div style={{textAlign:"right", width:"100%"}}>Saldo</div>, "Acciones"]}>
            {filtrados.map((p: any) => {
              const saldo = saldoProv(p.id);
              return (
                <Tr key={p.id} onDoubleClick={() => { setEditando(p); setModal(true); }} style={{ opacity: p.estado === "archivado" ? 0.4 : 1 }}>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar nombre={p.nombre} color={t.purple} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                        <div style={{ fontSize: 11, color: t.muted }}>{p.localidad}</div>
                      </div>
                    </div>
                  </Td>
                  <Td style={{ fontFamily: "monospace", color: t.muted }}>{p.cuit || "—"}</Td>
                  <Td>{p.telefono || "—"}</Td>
                  <Td style={{ fontWeight: 800, color: saldo > 0 ? t.green : saldo < 0 ? t.red : t.sub, textAlign: "right" }}>{fmtMoney(Math.abs(saldo))}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn v="ghost" onClick={() => setVerCC(p)} style={{ padding: 6 }} title="Cuenta Corriente"><Ic n="cc" s={14} /></Btn>
                      <Btn v="success" onClick={() => setModalFac({ ...p, _tipoComp: "factura" })} style={{ padding: 6 }} title="Cargar Factura"><Ic n="ventas" s={14} /></Btn>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Tbl>
        </>
      )}

      {tab === "saldos" && (() => {
        const provSaldos = proveedores.map((p: any) => ({ ...p, saldo: saldosHistoricos[p.id] || 0 })).filter((p: any) => p.saldo !== 0).sort((a: any, b: any) => b.saldo - a.saldo);
        const total = provSaldos.reduce((s: number, p: any) => s + p.saldo, 0);
        return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Tbl headers={["Proveedor", "Saldo al día"]}>
            {provSaldos.map((p: any) => (
              <Tr key={p.id}>
                <Td style={{ fontWeight: 600 }}>{p.nombre}</Td>
                <Td style={{ textAlign: "right", fontWeight: 700, color: p.saldo > 0 ? t.green : p.saldo < 0 ? t.red : t.sub }}>{fmtMoney(Math.abs(p.saldo))}</Td>
              </Tr>
            ))}
            {provSaldos.length > 0 && (
              <Tr style={{ background: t.surf2 }}>
                <Td style={{ fontWeight: 800, textAlign: "right" }}>TOTAL</Td>
                <Td style={{ fontWeight: 900, color: total > 0 ? t.red : total < 0 ? t.green : t.text, textAlign: "right" }}>{fmtMoney(Math.abs(total))}</Td>
              </Tr>
            )}
          </Tbl>
        </div>
        );
      })()}

      {tab === "seac" && (
        <SEACCuentaCorriente seacMovs={seacMovs} setSeacMovs={setSeacMovs} seacImportaciones={seacImportaciones} setSeacImportaciones={setSeacImportaciones} pagosProv={pagosProv} pagos={pagos} movimientos={movimientos} factProv={factProv} setFactProv={setFactProv} clientes={clientes} proveedores={proveedores} cuentas={cuentas} seacMatchManuales={seacMatchManuales} setSeacMatchManuales={setSeacMatchManuales} cloudSync={props.cloudSync} />
      )}

      {modal && (
        <OverlaySheet open={true} onClose={() => setModal(false)} title={editando ? "Editar Proveedor" : "Nuevo Proveedor"} width="600px">
          <form onSubmit={guardar}>
            <div style={{ background: t.surf2, borderRadius: "16px", padding: "16px", border: `1px solid ${t.border}`, marginBottom: 20 }}>
              <div style={{ color: t.sub, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 }}>Datos Principales</div>
              <Fld label="Razón Social"><Inp name="nombre" defaultValue={editando?.nombre} required /></Fld>
              <div style={{ display: "flex", gap: 12 }}>
                <Fld label="CUIT" half><Inp name="cuit" defaultValue={editando?.cuit} /></Fld>
                <Fld label="Teléfono" half><Inp name="telefono" defaultValue={editando?.telefono} /></Fld>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Fld label="Email" half><Inp name="email" defaultValue={editando?.email} /></Fld>
                <Fld label="Persona de Contacto" half><Inp name="personaContacto" defaultValue={editando?.personaContacto} /></Fld>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Fld label="Estado" half>
                  <Sel name="estado" defaultValue={editando?.estado || "activo"}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo / Bloqueado</option>
                    <option value="archivado">Archivado</option>
                  </Sel>
                </Fld>
                <Fld label="Observaciones" half><Inp name="obs" defaultValue={editando?.obs} /></Fld>
              </div>
              <Fld label="Abreviaturas en Planilla / Alias (Separados por coma)"><Inp name="alias" defaultValue={editando?.alias} placeholder="Ej: RGP-SEAC, RGP, SEAC" /></Fld>
            </div>

            <div style={{ background: t.surf2, borderRadius: "16px", padding: "16px", border: `1px solid ${t.border}`, marginBottom: 20 }}>
              <div style={{ color: t.sub, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 }}>Domicilio y Localización</div>
              <Fld label="Dirección"><Inp name="direccion" defaultValue={editando?.direccion} /></Fld>
              <div style={{ display: "flex", gap: 12 }}>
                <Fld label="Provincia" half>
                  <Sel name="provincia" value={provFilter} onChange={(e: any) => setProvFilter(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                  </Sel>
                </Fld>
                <Fld label="Localidad" half>
                  {(PROVINCIAS.includes(provFilter) && LOCALIDADES_POR_PROVINCIA[provFilter]?.length > 0) ? (
                    <Sel name="localidad" value={PROVINCIAS.includes(provFilter) && !LOCALIDADES_POR_PROVINCIA[provFilter].includes(locManual) && locManual && locManual !== "OTRA" ? "OTRA" : locManual} onChange={(e: any) => setLocManual(e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {LOCALIDADES_POR_PROVINCIA[provFilter].map(l => <option key={l} value={l}>{l}</option>)}
                      <option value="OTRA">-- Otra --</option>
                    </Sel>
                  ) : (
                    <Inp name="localidad" value={locManual} onChange={(e: any) => setLocManual(e.target.value)} />
                  )}
                </Fld>
              </div>
              {((PROVINCIAS.includes(provFilter) && !LOCALIDADES_POR_PROVINCIA[provFilter]?.includes(locManual) && locManual !== "" && locManual !== "OTRA") || locManual === "OTRA") && (
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: "50%" }}></div>
                  <Fld label="Especificar Localidad" half>
                    <Inp name="_localidad_manual" value={locManual === "OTRA" ? "" : locManual} onChange={(e: any) => setLocManual(e.target.value)} autoFocus />
                  </Fld>
                </div>
              )}
            </div>

            {canBorrarProveedores && (
              <div style={{ background: t.surf2, borderRadius: "16px", padding: "16px", border: `1px solid ${t.border}`, marginBottom: 20 }}>
                <div style={{ color: t.sub, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 }}>Cuentas y Límites</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <Fld label="Saldo Inicial" half><Inp name="saldoInicial" type="number" step="0.01" defaultValue={editando?.saldoInicial} /></Fld>
                  <Fld label="Fecha Saldo Ini." half><Inp name="fechaSaldoInicial" type="date" defaultValue={editando?.fechaSaldoInicial} /></Fld>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <Btn v="ghost" onClick={() => setModal(false)} full type="button">Cancelar</Btn>
              {editando && canBorrarProveedores && <BtnEliminarConClave onConfirm={() => { 
                setProveedores(proveedores.filter((p: any) => String(p.id) !== String(editando.id))); 
                if (props.cloudSync?.deleteFromCloud) props.cloudSync.deleteFromCloud("proveedores", editando.id);
                setModal(false); 
              }} entidadNombre={editando.nombre} />}
              <Btn type="submit" full>Guardar cambios</Btn>
            </div>
          </form>
        </OverlaySheet>
      )}

      {verCC && (
        <ModalCCProv proveedor={verCC} onClose={() => setVerCC(null)} ccProv={ccProv} saldoProv={saldoProv} factProv={factProv} setFactProv={setFactProv} pagosProv={pagosProv} setPagosProv={setPagosProv} cuentas={cuentas} setCuentas={setCuentas} user={user} onEditFactura={(f: any) => setModalFac({ ...verCC, _editando: f })} setMovimientos={setMovimientos} movimientos={movimientos} cloudSync={props.cloudSync} clientes={clientes} pagos={pagos} setPagos={setPagos} proveedores={proveedores} />
      )}

      <ModalPagarProveedor open={modalPagoProv} onClose={() => setModalPagoProv(false)} cuentas={cuentas} proveedores={proveedores} setPagosProv={setPagosProv} setMovimientos={setMovimientos} setCuentas={setCuentas} user={user} cloudSync={props.cloudSync} />

      <ModalExportacion 
        open={showExportar}
        onClose={() => setShowExportar(false)}
        tipo="proveedores"
        data={proveedores}
        titulo="Listado de Proveedores"
        fileName="proveedores"
        columnas={["ID", "Nombre", "CUIT", "Teléfono", "Email", "Dirección", "Localidad", "Provincia", "Contacto", "Observaciones", "Saldo Inicial", "Fecha Saldo Ini."]}
        mapper={(p: any) => [
          p.id,
          p.nombre,
          p.cuit || "",
          p.telefono || "",
          p.email || "",
          p.direccion || "",
          p.localidad || "",
          p.provincia || "",
          p.personaContacto || "",
          p.obs || "",
          p.saldoInicial || 0,
          p.fechaSaldoInicial || ""
        ]}
      />

      <ModalFacturaProv open={!!modalFac} onClose={() => setModalFac(null)} proveedor={modalFac} factProv={factProv} setFactProv={setFactProv} articulos={articulos} setArticulos={setArticulos} user={user} cloudSync={props.cloudSync} />

      <TestFacturaIA
        open={showTestFacturaIA}
        onClose={() => setShowTestFacturaIA(false)}
        proveedores={proveedores}
        articulos={articulos}
      />
    </PageContainer>
  );
}
