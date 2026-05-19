import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { Tbl, Tr, Td, Bdg, Btn, Ic, SearchBar, Modal, Fld, Inp, Sel, Card, InpMoney, BtnEliminarConClave, OverlaySheet } from "../../common/UIBase";
import { PageContainer } from "../../layout/AppShell";
import { fmtMoney, parseMoney, getToday, fmtFechaCC, fmtNum } from "../../../lib/utils";
import { BuscadorCliente } from "../Clientes/BuscadorCliente";
import ModalConciliacion from "./ModalConciliacion";
import { exportarAExcel } from "../../../lib/excelExport";
import { ModalIngresoCli } from "../Clientes/ModalIngresoCli";
import ModalGestionCuentas from "./ModalGestionCuentas";
import ModalGestionConceptos from "./ModalGestionConceptos";
import ModalCerrarCaja from "./ModalCerrarCaja";
import ModalRegistrarMovimiento from "./ModalRegistrarMovimiento";
import ModalTransferencia from "./ModalTransferencia";
import ModalDeposito from "./ModalDeposito";
import ModalPagoProveedorCaja from "./ModalPagoProveedorCaja";

import { CUENTAS_INIT, CONCEPTOS_INIT, UNIDADES_NEGOCIO } from "../../../constants";
import { calcularPlanillaDelDia, calcularMovimientosTabla, checkRequiereRevision } from "../../../lib/caja/cajaLogic";

const today = getToday();

export default function Caja(props: any) {
  const { 
    cuentas: RawCuentas = [], setCuentas, 
    movimientos = [], setMovimientos, 
    proveedores = [], pagosProv = [], setPagosProv, 
    pagos = [], setPagos, 
    clientes = [], 
    facturas = [], 
    factProv = [], 
    conceptos = [], setConceptos, 
    user, usuarios = [], 
    utilidadesFCI = [], setUtilidadesFCI, unidadesNegocio = [],
    historialCierres = [], setHistorialCierres = () => {}
  } = props;

  // Deduplicación de cuentas para evitar redundancias en la UI
  const cuentas = Array.isArray(RawCuentas) 
    ? RawCuentas.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
               .filter((v, i, a) => a.findIndex(t => t.nombre?.toLowerCase().trim() === v.nombre?.toLowerCase().trim() && t.tipo === v.tipo) === i)
               .filter(v => typeof v.nombre === "string" && v.nombre.trim().length > 1 && v.nombre.trim() !== "Nueva Cuenta" && !(v.nombre.toLowerCase().trim() === "caja efectivo" && (v.saldo || 0) === 0))
    : [];

  const { t, isDark } = useApp();

  const [modalMov, setModalMov] = useState<any>({ open: false, cuentaId: "", tipo: "ingreso" });
  const [modalTransf, setModalTransf] = useState<any>({ open: false, origen: "" });
  const [modalDeposito, setModalDeposito] = useState<any>({ open: false, origen: "" });
  const [modalPagoProv, setModalPagoProv] = useState<any>({ open: false, cuentaId: "" });
  const [modalIngresoCli, setModalIngresoCli] = useState(false);
  const [modalGestionCuentas, setModalGestionCuentas] = useState(false);

  const [pickerCuenta, setPickerCuenta] = useState<any>(null); 
  const [cuentaSel, setCuentaSel] = useState<any>(null);
  const [modalConciliacion, setModalConciliacion] = useState<any>(null); 
  
  const [draggedCuenta, setDraggedCuenta] = useState<any>(null);
  const handleDragStart = (e: any, c: any) => { setDraggedCuenta(c); };
  const handleDragOver = (e: any, index: number) => {
    e.preventDefault();
    if (!draggedCuenta) return;
    const dragIndex = cuentas.findIndex((c: any) => c.id === draggedCuenta.id);
    if (dragIndex === index || dragIndex === -1) return;
    const items = [...cuentas];
    items.splice(dragIndex, 1);
    items.splice(index, 0, draggedCuenta);
    setCuentas(items);
  };
  const handleDrop = (e: any) => {
    e.preventDefault();
    if (!draggedCuenta) return;
    const items = cuentas.map((c: any, i: number) => ({ ...c, orden: i }));
    if (props.cloudSync?.saveBatchToCloud) {
       props.cloudSync.saveBatchToCloud("cuentas", items);
    }
    setDraggedCuenta(null);
  };
  const handleDragEnd = () => { 
    if (!draggedCuenta) return;
    const items = cuentas.map((c: any, i: number) => ({ ...c, orden: i }));
    if (props.cloudSync?.saveBatchToCloud) {
       props.cloudSync.saveBatchToCloud("cuentas", items);
    }
    setDraggedCuenta(null); 
  };

  const CUENTA_COLORES = ["#f59e0b","#4f7cff","#a855f7","#22c55e","#14b8a6","#ef4444","#ec4899","#f97316"];
  const CUENTA0 = { nombre: "", tipo: "banco", color: "#4f7cff", saldo: "", enPatrimonio: false, numeroCuenta: "", nroCuentaCorriente: "", alias: "", titular: "", tipoCuentaBancaria: "Caja de Ahorro" };
  const [formCuenta, setFormCuenta] = useState(CUENTA0);
  const [editandoCuenta, setEditandoCuenta] = useState<any>(null);
  const [modalFormCuenta, setModalFormCuenta] = useState(false);
  
  const hace3dias = (() => { const d = new Date(today + "T00:00:00"); d.setDate(d.getDate() - 2); return d.toISOString().slice(0, 10); })();
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroDesde, setFiltroDesde] = useState(hace3dias);
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroBusq, setFiltroBusq] = useState("");
  
  const [mostrarUSD, setMostrarUSD] = useState(false);
  const [cotizUSD, setCotizUSD] = useState<any>(null);
  const [cargandoUSD, setCargandoUSD] = useState(false);

  React.useEffect(() => {
    if (!mostrarUSD || cotizUSD) return;
    setCargandoUSD(true);
    fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares")
      .then(r => r.json())
      .then(data => {
        const bna = data?.find((d: any) => d.casa === "nacion" || d.casa === "oficial");
        if (bna?.venta) { setCotizUSD(bna.venta); }
        else {
          return fetch("https://dolarapi.com/v1/dolares/oficial")
            .then(r => r.json())
            .then(d => { if (d?.venta) setCotizUSD(d.venta); });
        }
      })
      .catch(() => {
        fetch("https://dolarapi.com/v1/dolares/oficial")
          .then(r => r.json())
          .then(d => { if (d?.venta) setCotizUSD(d.venta); })
          .catch(() => { });
      })
      .finally(() => setCargandoUSD(false));
  }, [mostrarUSD]);
  
  const [modalEditMov, setModalEditMov] = useState(false);
  const [movEditando, setMovEditando] = useState<any>(null);
  const [formEditMov, setFormEditMov] = useState({ concepto: "", monto: "", fecha: "", hora: "", tipo: "ingreso", cuentaId: "" });
  
  const [modalDepExtraccion, setModalDepExtraccion] = useState(false);
  const [formDE, setFormDE] = useState({ direccion: "deposito", cajaId: "", bancoId: "", monto: "", obs: "", fecha: today });
  
  const [modalTransfPropia, setModalTransfPropia] = useState(false);
  const [formTransfPropia, setFormTransfPropia] = useState({ origenId: "", destinoId: "", monto: "", obs: "", fecha: today });
  
  const [modalConfirmEdit, setModalConfirmEdit] = useState(false);
  const [passConfirm, setPassConfirm] = useState("");
  const [confirmarElimMov, setConfirmarElimMov] = useState(false);
  const [passError, setPassError] = useState("");

  const hora = () => new Date().getHours() + ":" + String(new Date().getMinutes()).padStart(2, "0");

  const marcarCierreAfectado = (fecha: string) => {
    const cierreActualizado = checkRequiereRevision(fecha, today, historialCierres);
    if (!cierreActualizado) return;

    if (props.cloudSync?.saveToCloud) {
      props.cloudSync.saveToCloud("historialCierres", cierreActualizado, String(cierreActualizado.id));
    }
    setHistorialCierres((prev: any[]) => prev.map(c =>
      c.id === cierreActualizado.id ? cierreActualizado : c
    ));
  };

  // Modals handle save logics internally now

  const abrirNuevaCuenta = () => { setFormCuenta({ ...CUENTA0, nombre: formCuenta?.nombre || "" }); setEditandoCuenta({ id: 0 }); };
  const abrirEditarCuenta = (c: any) => { setEditandoCuenta({ ...c }); }; 
  
  const guardarCuenta = () => {
    if (!formCuenta.nombre) return;
    if (editandoCuenta && editandoCuenta.id !== 0) {
      const nextCuenta = { ...editandoCuenta, nombre: formCuenta.nombre, tipo: formCuenta.tipo, color: formCuenta.color, numeroCuenta: formCuenta.numeroCuenta, nroCuentaCorriente: formCuenta.nroCuentaCorriente, alias: formCuenta.alias, titular: formCuenta.titular, tipoCuentaBancaria: formCuenta.tipoCuentaBancaria };
      setCuentas((prev: any[]) => prev.map(c => c.id === editandoCuenta.id ? nextCuenta : c));
      if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("cuentas", nextCuenta);
      setCuentasPatrimonio((prev: any[]) => {
        let next = prev;
        if (formCuenta.enPatrimonio && !prev.includes(editandoCuenta.id)) next = [...prev, editandoCuenta.id];
        else if (!formCuenta.enPatrimonio && prev.includes(editandoCuenta.id)) next = prev.filter(x => x !== editandoCuenta.id);
        try { localStorage.setItem("gp_cuentas_patrimonio", JSON.stringify(next)); } catch { }
        return next;
      });
    } else {
      const saldoInit = parseMoney(formCuenta.saldo) || 0;
      const nuevaId = Date.now();
      const nuevaCuenta = { id: nuevaId, nombre: formCuenta.nombre, tipo: formCuenta.tipo, color: formCuenta.color, saldo: saldoInit, numeroCuenta: formCuenta.numeroCuenta, nroCuentaCorriente: formCuenta.nroCuentaCorriente, alias: formCuenta.alias, titular: formCuenta.titular, tipoCuentaBancaria: formCuenta.tipoCuentaBancaria };
      setCuentas((prev: any[]) => [...prev, nuevaCuenta]);
      if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("cuentas", nuevaCuenta);
      if (saldoInit > 0) {
        const movInit = { id: nuevaId + 1, cuentaId: nuevaId, concepto: "Saldo inicial", tipo: "ingreso", monto: saldoInit, fecha: today, hora: hora() };
        setMovimientos((prev: any[]) => [movInit, ...prev]);
        if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("movimientos", movInit);
      }
      if (formCuenta.enPatrimonio) {
        setCuentasPatrimonio((prev: any[]) => {
          const next = [...prev, nuevaId];
          try { localStorage.setItem("gp_cuentas_patrimonio", JSON.stringify(next)); } catch { }
          return next;
        });
      }
    }
    setEditandoCuenta(null);
  };
  
  const [errElimCuenta, setErrElimCuenta] = useState("");
  const [confirmarElimCuenta, setConfirmarElimCuenta] = useState<any>(null);
  
  const eliminarCuenta = (id: number) => {
    const stringId = String(id);
    const tieneMovsReales = movimientos.some((m: any) => String(m.cuentaId) === stringId && m.concepto !== "Saldo inicial");
    if (tieneMovsReales) { setErrElimCuenta("No se puede eliminar: la cuenta tiene movimientos registrados."); return; }
    setErrElimCuenta("");
    
    // Also remove the "Saldo inicial" movement if there is one
    const saldoInicialMov = movimientos.find((m: any) => String(m.cuentaId) === stringId && m.concepto === "Saldo inicial");
    if(saldoInicialMov && props.cloudSync?.deleteFromCloud) {
       props.cloudSync.deleteFromCloud("movimientos", String(saldoInicialMov.id));
    }
    
    if (props.cloudSync?.deleteFromCloud) props.cloudSync.deleteFromCloud("cuentas", stringId);

    setCuentas((prev: any[]) => prev.filter(c => String(c.id) !== stringId));
    setMovimientos((prev: any[]) => prev.filter(m => String(m.cuentaId) !== stringId));
    setCuentasPatrimonio((prev: any[]) => prev.filter(pid => String(pid) !== stringId));
    if (String(cuentaSel?.id) === stringId) setCuentaSel(null);
  };

  const guardarTransfPropia = () => {
    if (!formTransfPropia.origenId || !formTransfPropia.destinoId || !formTransfPropia.monto) return;
    if (formTransfPropia.origenId === formTransfPropia.destinoId) return;
    const monto = parseMoney(formTransfPropia.monto);
    const origen = cuentas.find((c: any) => c.id === parseInt(formTransfPropia.origenId));
    const destino = cuentas.find((c: any) => c.id === parseInt(formTransfPropia.destinoId));
    if (!origen || !destino) return;
    const h = hora();
    const baseId = Date.now();
    const movEgreso = { id: baseId, cuentaId: origen.id, concepto: `Transf. a ${destino.nombre}${formTransfPropia.obs ? ` · ${formTransfPropia.obs}` : ""}`, tipo: "egreso", monto, fecha: formTransfPropia.fecha, hora: h };
    const movIngreso = { id: baseId + 1, cuentaId: destino.id, concepto: `Transf. desde ${origen.nombre}${formTransfPropia.obs ? ` · ${formTransfPropia.obs}` : ""}`, tipo: "ingreso", monto, fecha: formTransfPropia.fecha, hora: h };
    const cuentaOrigen = { ...origen, saldo: origen.saldo - monto };
    const cuentaDestino = { ...destino, saldo: destino.saldo + monto };
    if (props.cloudSync?.executeCloudBatch) {
      const ops = [
        { type: "set", collection: "movimientos", id: String(movEgreso.id), data: movEgreso },
        { type: "set", collection: "movimientos", id: String(movIngreso.id), data: movIngreso },
        { type: "set", collection: "cuentas", id: String(cuentaOrigen.id), data: cuentaOrigen },
        { type: "set", collection: "cuentas", id: String(cuentaDestino.id), data: cuentaDestino }
      ];
      props.cloudSync.executeCloudBatch(ops);
    } else if (props.cloudSync?.saveToCloud) {
      props.cloudSync.saveToCloud("movimientos", movEgreso);
      props.cloudSync.saveToCloud("movimientos", movIngreso);
      props.cloudSync.saveToCloud("cuentas", cuentaOrigen);
      props.cloudSync.saveToCloud("cuentas", cuentaDestino);
    }
    setCuentas((prev: any[]) => prev.map(c => {
      if (c.id === origen.id) return cuentaOrigen;
      if (c.id === destino.id) return cuentaDestino;
      return c;
    }));
    setMovimientos((prev: any[]) => [movEgreso, movIngreso, ...prev]);
    marcarCierreAfectado(formTransfPropia.fecha);
    setFormTransfPropia({ origenId: "", destinoId: "", monto: "", obs: "", fecha: today });
    setModalTransfPropia(false);
  };

  const guardarDepExtraccion = () => {
    if (!formDE.cajaId || !formDE.bancoId || !formDE.monto) return;
    const monto = parseMoney(formDE.monto);
    const caja = cuentas.find((c: any) => c.id === parseInt(formDE.cajaId));
    const banco = cuentas.find((c: any) => c.id === parseInt(formDE.bancoId));
    if (!caja || !banco) return;
    const h = hora();
    const esDeposito = formDE.direccion === "deposito"; 
    const origenId = esDeposito ? caja.id : banco.id;
    const destinoId = esDeposito ? banco.id : caja.id;
    const origenNombre = esDeposito ? caja.nombre : banco.nombre;
    const destinoNombre = esDeposito ? banco.nombre : caja.nombre;
    const label = esDeposito ? "Depósito" : "Extracción";
    const baseId = Date.now();
    const movEgreso = { id: baseId, cuentaId: origenId, concepto: `${label} → ${destinoNombre}${formDE.obs ? ` · ${formDE.obs}` : ""}`, tipo: "egreso", monto, fecha: formDE.fecha, hora: h };
    const movIngreso = { id: baseId + 1, cuentaId: destinoId, concepto: `${label} desde ${origenNombre}${formDE.obs ? ` · ${formDE.obs}` : ""}`, tipo: "ingreso", monto, fecha: formDE.fecha, hora: h };
    const cuentaOrigen = { ...(esDeposito ? caja : banco), saldo: (esDeposito ? caja : banco).saldo - monto };
    const cuentaDestino = { ...(esDeposito ? banco : caja), saldo: (esDeposito ? banco : caja).saldo + monto };
    if (props.cloudSync?.executeCloudBatch) {
      const ops = [
        { type: "set", collection: "movimientos", id: String(movEgreso.id), data: movEgreso },
        { type: "set", collection: "movimientos", id: String(movIngreso.id), data: movIngreso },
        { type: "set", collection: "cuentas", id: String(cuentaOrigen.id), data: cuentaOrigen },
        { type: "set", collection: "cuentas", id: String(cuentaDestino.id), data: cuentaDestino }
      ];
      props.cloudSync.executeCloudBatch(ops);
    } else if (props.cloudSync?.saveToCloud) {
      props.cloudSync.saveToCloud("movimientos", movEgreso);
      props.cloudSync.saveToCloud("movimientos", movIngreso);
      props.cloudSync.saveToCloud("cuentas", cuentaOrigen);
      props.cloudSync.saveToCloud("cuentas", cuentaDestino);
    }
    setCuentas((prev: any[]) => prev.map(c => {
      if (c.id === origenId) return cuentaOrigen;
      if (c.id === destinoId) return cuentaDestino;
      return c;
    }));
    setMovimientos((prev: any[]) => [movEgreso, movIngreso, ...prev]);
    setFormDE({ direccion: "deposito", cajaId: "", bancoId: "", monto: "", obs: "", fecha: today });
    marcarCierreAfectado(formDE.fecha);
    setModalDepExtraccion(false);
  };

  const abrirEditarMov = (m: any) => {
    setMovEditando(m);
    setConfirmarElimMov(false);
    setFormEditMov({
      concepto: m.concepto,
      monto: String(m.monto),
      fecha: m.fecha,
      hora: m.hora || "",
      tipo: m.tipo,
      cuentaId: String(m.cuentaId)
    });
    setModalEditMov(true);
  };

  const confirmarContraseñaYEditar = () => {
    const maestro = usuarios.find((u: any) => u.rol === "maestro");
    if (!maestro || passConfirm !== maestro.password) {
      setPassError("Contraseña incorrecta");
      return;
    }
    setModalConfirmEdit(false);
    setConfirmarElimMov(false);
    setPassConfirm("");
    setPassError("");
    guardarEditMov();
  };

  const guardarEditMov = () => {
    if (!formEditMov.monto || !formEditMov.concepto || !formEditMov.cuentaId) return;
    const montoNuevo = parseMoney(formEditMov.monto);
    const montoViejo = movEditando.monto;
    const cuentaViejaId = parseInt(movEditando.cuentaId);
    const cuentaNuevaId = parseInt(formEditMov.cuentaId);
    const tipoViejo = movEditando.tipo;
    const tipoNuevo = formEditMov.tipo;

    setCuentas((prev: any[]) => prev.map(c => {
      let nuevoSaldo = c.saldo;
      if (c.id === cuentaViejaId) {
        nuevoSaldo = tipoViejo === "ingreso" ? nuevoSaldo - montoViejo : nuevoSaldo + montoViejo;
      }
      if (c.id === cuentaNuevaId) {
        nuevoSaldo = tipoNuevo === "ingreso" ? nuevoSaldo + montoNuevo : nuevoSaldo - montoNuevo;
      }
      const newC = { ...c, saldo: nuevoSaldo };
      if ((c.id === cuentaViejaId || c.id === cuentaNuevaId) && props.cloudSync?.saveToCloud) {
        props.cloudSync.saveToCloud("cuentas", newC);
      }
      return newC;
    }));

    if (movEditando.reciboId && setPagos) {
      setPagos((prev: any[]) => prev.map(p => {
        if (String(p.id) !== String(movEditando.reciboId)) return p;
        const diffMonto = montoNuevo - montoViejo;
        const editedP = { ...p, monto: p.monto + diffMonto, cuentaId: cuentaNuevaId };
        if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("pagos", editedP);
        return editedP;
      }));
    }

    if (movEditando.pagoProvId && setPagosProv) {
      setPagosProv((prev: any[]) => prev.map(p => {
        if (p.id !== movEditando.pagoProvId) return p;
        const editedP = { ...p, monto: montoNuevo, fecha: formEditMov.fecha, obs: formEditMov.concepto };
        if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("pagosProv", editedP);
        return editedP;
      }));
    }

    setMovimientos((prev: any[]) => prev.map(m => {
      if (m.id !== movEditando.id) return m;
      const editedM = { ...m, concepto: formEditMov.concepto, monto: montoNuevo, fecha: formEditMov.fecha, hora: formEditMov.hora, tipo: tipoNuevo, cuentaId: cuentaNuevaId };
      if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("movimientos", editedM);
      return editedM;
    }));

    setModalEditMov(false);
    setMovEditando(null);
  };

  const eliminarMovimiento = () => {
    if (!movEditando) return;
    const ed = movEditando;
    setCuentas((prev: any[]) => prev.map(c => {
      if (String(c.id) !== String(ed.cuentaId)) return c;
      const nuevoSaldo = ed.tipo === "ingreso" ? c.saldo - ed.monto : c.saldo + ed.monto;
      if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("cuentas", { ...c, saldo: nuevoSaldo });
      return { ...c, saldo: nuevoSaldo };
    }));
    if (ed.reciboId && setPagos && !ed._esImputacion) {
      if (props.cloudSync?.deleteFromCloud) props.cloudSync.deleteFromCloud("pagos", String(ed.reciboId));
      setPagos((prev: any[]) => prev.filter(p => p.id !== ed.reciboId));
    }
    if (ed._cobroGrupoId && setPagos) {
      const ps = pagos.filter((x:any) => String(x.grupoId) === String(ed._cobroGrupoId));
      if (props.cloudSync?.deleteFromCloud) {
         ps.forEach((px:any) => props.cloudSync.deleteFromCloud("pagos", String(px.id)));
         const pSingl = pagos.find((x:any) => String(x.id) === String(ed._cobroGrupoId));
         if (pSingl) props.cloudSync.deleteFromCloud("pagos", String(pSingl.id));
      }
      setPagos((prev: any[]) => prev.filter(p => String(p.grupoId) !== String(ed._cobroGrupoId) && String(p.id) !== String(ed._cobroGrupoId)));
    }
    if (ed._esImputacion && ed.reciboId && setPagosProv) {
      const pb = pagosProv.find(p => p.reciboId === ed.reciboId);
      if (pb && props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("pagosProv", { ...pb, anulado: true });
      setPagosProv((prev: any[]) => prev.map(p => p.reciboId === ed.reciboId ? { ...p, anulado: true } : p));
    }
    if (ed.pagoProvId && setPagosProv && !ed._esImputacion) {
      if (props.cloudSync?.deleteFromCloud) props.cloudSync.deleteFromCloud("pagosProv", String(ed.pagoProvId));
      setPagosProv((prev: any[]) => prev.filter(p => p.id !== ed.pagoProvId));
    }
    if (props.cloudSync?.deleteFromCloud) props.cloudSync.deleteFromCloud("movimientos", String(ed.id));
    setMovimientos((prev: any[]) => prev.filter(m => m.id !== ed.id));
    setModalEditMov(false);
    setMovEditando(null);
  };

  const movsParaTabla = () => {
    return calcularMovimientosTabla(movimientos, pagos, cuentaSel, {
      tipo: filtroTipo,
      desde: filtroDesde,
      hasta: filtroHasta,
      busq: filtroBusq
    });
  };

  const guardarUtilidad = () => {
    if (!formUtilidad.monto || !formUtilidad.cuentaId) return;
    const monto = parseMoney(formUtilidad.monto);
    if (!monto) return;
    const cuentaDestino = cuentas.find((c: any) => c.id === parseInt(formUtilidad.cuentaId));
    if (!cuentaDestino) return;
    const util = {
      id: Date.now(), cuentaId: cuentaDestino.id,
      concepto: `Utilidad FCI${formUtilidad.detalle ? ` — ${formUtilidad.detalle}` : ""}`,
      monto, fecha: formUtilidad.fecha
    };
    if (setUtilidadesFCI) setUtilidadesFCI((prev: any[]) => [util, ...prev]);
    const nextCuenta = { ...cuentaDestino, saldo: cuentaDestino.saldo + monto };
    setCuentas((prev: any[]) => prev.map(c => c.id === cuentaDestino.id ? nextCuenta : c));
    if (props.cloudSync?.executeCloudBatch) {
       const ops = [
         { type: "set", collection: "utilidadesFCI", id: String(util.id), data: util },
         { type: "set", collection: "cuentas", id: String(nextCuenta.id), data: nextCuenta }
       ];
       props.cloudSync.executeCloudBatch(ops);
    } else if (props.cloudSync?.saveToCloud) {
       props.cloudSync.saveToCloud("utilidadesFCI", util);
       props.cloudSync.saveToCloud("cuentas", nextCuenta);
    }
    setFormUtilidad({ monto: "", detalle: "", fecha: today, cuentaId: "" });
    setModalUtilidad(false);
  };

  const [cuentasPatrimonio, setCuentasPatrimonio] = useState(() => {
    try { const s = localStorage.getItem("gp_cuentas_patrimonio"); return s ? JSON.parse(s) : [1, 5]; } catch { return [1, 5]; }
  });
  
  const CUENTAS_PATRIMONIO = cuentasPatrimonio;
  const togglePatrimonio = (id: number) => {
    setCuentasPatrimonio((prev: any[]) => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem("gp_cuentas_patrimonio", JSON.stringify(next)); } catch { }
      return next;
    });
  };
  
  const totalGeneral = cuentas.filter((c: any) => CUENTAS_PATRIMONIO.includes(c.id)).reduce((s: number, c: any) => s + c.saldo, 0);
  
  const fmtUSD = (monto: number) => {
    if (!mostrarUSD || !cotizUSD) return fmtMoney(monto);
    const usd = monto / cotizUSD;
    return `U$S ${usd.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const movsFiltrados = movsParaTabla();
  const hayFiltros = filtroTipo !== "todos" || filtroDesde || filtroHasta || filtroBusq;

  const [tabCaja, setTabCaja] = useState("movimientos");
  const [fechaPlanilla, setFechaPlanilla] = useState(today);
  const [modalMovPlanilla, setModalMovPlanilla] = useState(false);
  const [formPlanilla, setFormPlanilla] = useState({ conceptoId: "", detalle: "", monto: "", cuentaId: "", fecha: today, unidadNegocio: "General" });
  const [modalGestionConceptos, setModalGestionConceptos] = useState(false);
  const [formConcepto, setFormConcepto] = useState({ nombre: "", tipo: "egreso" });
  const [editandoConcepto, setEditandoConcepto] = useState<any>(null);
  const [modalUtilidad, setModalUtilidad] = useState(false);
  const [formUtilidad, setFormUtilidad] = useState({ monto: "", detalle: "", fecha: today, cuentaId: "" });
  const [modalCerrarCaja, setModalCerrarCaja] = useState(false);
  const [notaCierre, setNotaCierre] = useState("");
  const [modalHistorialCierres, setModalHistorialCierres] = useState(false);
  const [mesesAbCierres, setMesesAbCierres] = useState(() => new Set());
  const [modalCobro, setModalCobro] = useState(false);
  const [cuentaCobroId, setCuentaCobroId] = useState<any>(null);
  const [formCobro, setFormCobro] = useState({ clienteId: "", monto: "", obs: "", fecha: today });

  useEffect(() => {
    if (conceptos && props.cloudSync?.saveToCloud && !localStorage.getItem("migrated_conceptos_v2")) {
       let added = false;
       // Add missing concepts one-time only
       const currentNames = conceptos.map((c:any) => c.nombre.toLowerCase().trim());
       CONCEPTOS_INIT.forEach(ci => {
         if (!currentNames.includes(ci.nombre.toLowerCase().trim())) {
           props.cloudSync.saveToCloud("conceptos", { ...ci, id: Date.now() + "-" + Math.random().toString(36).substr(2, 9) });
           added = true;
         }
       });
       if (added || conceptos.length > 0) {
         localStorage.setItem("migrated_conceptos_v2", "true");
       }
    }
  }, [conceptos, props.cloudSync]);

  const guardarMovPlanilla = () => {
    if (!formPlanilla.conceptoId || !formPlanilla.monto || !formPlanilla.cuentaId) return;
    const concepto = conceptos.find((c: any) => c.id === parseInt(formPlanilla.conceptoId));
    if (!concepto) return;
    const monto = parseMoney(formPlanilla.monto);
    const tipo = concepto.tipo === "ingreso" ? "ingreso" : "egreso";
    const mov = {
      id: Date.now(), cuentaId: parseInt(formPlanilla.cuentaId),
      concepto: concepto.nombre + (formPlanilla.detalle ? ` — ${formPlanilla.detalle}` : ""),
      conceptoId: parseInt(formPlanilla.conceptoId),
      tipo, monto, fecha: formPlanilla.fecha, hora: hora(),
      unidadNegocio: formPlanilla.unidadNegocio || "General"
    };
    const cuentaPlanilla = cuentas.find((c: any) => c.id === parseInt(formPlanilla.cuentaId));
    if (props.cloudSync?.executeCloudBatch) {
      const ops: any[] = [{ type: "set", collection: "movimientos", id: String(mov.id), data: mov }];
      if (cuentaPlanilla) {
         ops.push({ type: "set", collection: "cuentas", id: String(cuentaPlanilla.id), data: { ...cuentaPlanilla, saldo: tipo === "ingreso" ? cuentaPlanilla.saldo + monto : cuentaPlanilla.saldo - monto } });
      }
      props.cloudSync.executeCloudBatch(ops);
    } else if (props.cloudSync?.saveToCloud) {
      props.cloudSync.saveToCloud("movimientos", mov);
      if (cuentaPlanilla) props.cloudSync.saveToCloud("cuentas", { ...cuentaPlanilla, saldo: tipo === "ingreso" ? cuentaPlanilla.saldo + monto : cuentaPlanilla.saldo - monto });
    }
    setMovimientos((prev: any[]) => [mov, ...prev]);
    setCuentas((prev: any[]) => prev.map(c => c.id === parseInt(formPlanilla.cuentaId) ? { ...c, saldo: tipo === "ingreso" ? c.saldo + monto : c.saldo - monto } : c));
    marcarCierreAfectado(formPlanilla.fecha);
    setFormPlanilla({ conceptoId: "", detalle: "", monto: "", cuentaId: "", fecha: today, unidadNegocio: "General" });
    setModalMovPlanilla(false);
  };

  const guardarConcepto = () => {
    if (!formConcepto.nombre.trim()) return;
    if (editandoConcepto) {
      const updated = { id: editandoConcepto, ...formConcepto };
      if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("conceptos", updated);
      setConceptos((prev: any[]) => prev.map(c => c.id === editandoConcepto ? { ...c, ...formConcepto } : c));
    } else {
      const newConcept = { id: Date.now(), nombre: formConcepto.nombre.trim(), tipo: formConcepto.tipo, activo: true };
      if (props.cloudSync?.saveToCloud) props.cloudSync.saveToCloud("conceptos", newConcept);
      setConceptos((prev: any[]) => [...prev, newConcept]);
    }
    setFormConcepto({ nombre: "", tipo: "egreso" }); setEditandoConcepto(null);
  };

  const planillaDelDia = () => {
    return calcularPlanillaDelDia(
      fechaPlanilla,
      movimientos,
      pagos,
      pagosProv,
      cuentas,
      proveedores,
      historialCierres,
      CUENTAS_PATRIMONIO,
      conceptos
    );
  };

  const exportarPlanillaExcel = async () => {
    const { filas, saldoAnterior, totalIngreso, totalEgreso, resultado, saldoActual } = planillaDelDia();
    
    const filasExport: any[][] = [];
    filasExport.push(["Saldo anterior", "", saldoAnterior !== 0 ? saldoAnterior : "", ""]);
    filasExport.push([]);
    
    const filasReales = filas.filter(f => !f.informativo);
    filasReales.forEach(f => filasExport.push([f.concepto || "—", (f.detalle || "—") + (f.destino && f.destino !== "—" ? ` (${f.destino})` : ""), f.ingreso || "", f.egreso || ""]));
    
    filasExport.push([]);
    filasExport.push(["TOTAL DÍA", "", totalIngreso !== 0 ? totalIngreso : "", totalEgreso !== 0 ? totalEgreso : ""]);
    filasExport.push(["RESULTADO", "", resultado >= 0 ? resultado : "", resultado < 0 ? Math.abs(resultado) : ""]);
    filasExport.push(["SALDO ACTUAL", "", saldoActual !== 0 ? saldoActual : "", ""]);

    exportarAExcel({
      titulo: `Planilla del Día — ${fmtFechaCC(fechaPlanilla)}`,
      columnas: ["Concepto", "Detalle (Cuenta / Destino)", "Ingreso", "Egreso"],
      filas: filasExport,
      fileName: `planilla_${fechaPlanilla}.xlsx`,
      sheetName: "Planilla"
    });
  };

  return (
    <PageContainer title="Tesorería" sub="Control de fondos y movimientos" stickyHeader={false} actions={
      <div style={{ display: "flex", gap: 8 }}>
        {(!cuentas || cuentas.length === 0) && (
          <Btn onClick={async () => {
            if(window.confirm("¿Restaurar cuentas por defecto?")) {
              setCuentas(CUENTAS_INIT);
              // Si la nube está activa, forzar guardado
              try {
                if (window.confirm("¿Desea registrar las cuentas por defecto en la base de datos para que persistan? Recomendado.")) {
                  const ops = CUENTAS_INIT.map((c: any) => ({
                    type: "set" as "set",
                    collection: "cuentas",
                    id: String(c.id),
                    data: c
                  }));
                  await props.cloudSync.executeCloudBatch(ops);
                  alert("¡Cuentas restauradas en la nube!");
                }
              } catch(e:any) {
                console.error("Error al restaurar cuentas:", e);
                alert("Hubo un error al guardar en la nube. Revisa la consola.");
              }
            }
          }} v="primary" style={{background: t.accent}}>Restaurar Defaults</Btn>
        )}
        <Btn v="ghost" onClick={() => setModalGestionCuentas(true)}><Ic n="config" s={14} /> Cuentas</Btn>
        <Btn v="ghost" onClick={() => setModalGestionConceptos(true)}><Ic n="config" s={14} /> Conceptos</Btn>
        {tabCaja === "planilla" && (
          <>
            <Btn v="ghost" onClick={() => setModalHistorialCierres(true)} title="Historial de cierres"><Ic n="stats" s={14} /> Historial</Btn>
            <Btn onClick={() => { setNotaCierre(""); setModalCerrarCaja(true); }}><Ic n="check" s={14} /> Cerrar Caja</Btn>
          </>
        )}
      </div>
    } extraHeader={
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${t.border}` }}>
        {[{ id: "movimientos", label: "Caja y bancos", icon: "stats" }, { id: "planilla", label: "Planilla del Día", icon: "stats" }].map(tb => {
          const active = tabCaja === tb.id;
          return <button key={tb.id} onClick={() => { setTabCaja(tb.id); setModalGestionConceptos(false); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", border: "none", borderBottom: `2px solid ${active ? t.accent : "transparent"}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, color: active ? t.accent : t.sub, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", marginBottom: -1, transition: "all 0.15s" }}>
            <Ic n={tb.icon} s={14} />{tb.label}
          </button>;
        })}
      </div>
    }>


      {tabCaja === "planilla" && (() => {
        const { filas, saldoAnterior, totalIngreso, totalEgreso, resultado, saldoActual } = planillaDelDia();
        const grupos: any = {};
        filas.forEach(f => { if (!grupos[f.concepto]) grupos[f.concepto] = []; grupos[f.concepto].push(f); });
        return <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.sub }}>Fecha:</div>
            <Inp type="date" value={fechaPlanilla} onChange={(e: any) => setFechaPlanilla(e.target.value)} style={{ width: 140 }} />
            <button onClick={() => setFechaPlanilla(today)} style={{ background: t.accent + "18", border: `1px solid ${t.accent}33`, borderRadius: 6, color: t.accent, fontSize: 12, fontWeight: 600, padding: "4px 10px", cursor: "pointer", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>Hoy</button>
            <div style={{ flex: 1 }} />
            <Btn v="ghost" onClick={exportarPlanillaExcel} title="Exportar"><Ic n="transfer" s={14} /></Btn>
            <Btn onClick={() => setModalMovPlanilla(true)}><Ic n="plus" s={14} /> Registrar</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Saldo anterior", value: saldoAnterior, color: t.sub },
              { label: "Total ingresos", value: totalIngreso, color: t.green },
              { label: "Total egresos", value: totalEgreso, color: t.red },
              { label: "Resultado del día", value: resultado, color: resultado >= 0 ? t.green : t.red },
            ].map((k, i) => (
              <div key={i} style={{ background: t.surf, borderRadius: 12, padding: "14px 16px", border: `1px solid ${k.color}33` }}>
                <div style={{ fontSize: 10, color: t.sub, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{fmtMoney(Math.abs(k.value))}</div>
              </div>
            ))}
          </div>
          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: t.surf2 }}>
                {["Detalle", "Cuenta / Destino", "Ingreso", "Egreso"].map(h => (
                  <th key={h} style={{ padding: "9px 14px", textAlign: h === "Ingreso" || h === "Egreso" ? "right" : "left", color: t.sub, fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: `1px solid ${t.border}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                <tr style={{ background: t.surf2 }}>
                  <td colSpan={2} style={{ padding: "8px 14px", fontWeight: 700, color: t.sub, fontSize: 12 }}>
                    Saldo de Caja y Bancos (Acumulado día anterior)
                    {historialCierres.filter((c: any) => c.fecha < fechaPlanilla).sort((a: any, b: any) => b.fecha.localeCompare(a.fecha))[0] &&
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 400, color: t.muted }}>
                        (cierre {fmtFechaCC(historialCierres.filter((c: any) => c.fecha < fechaPlanilla).sort((a: any, b: any) => b.fecha.localeCompare(a.fecha))[0].fecha)})
                      </span>
                    }
                  </td>
                  <td style={{ padding: "8px 14px", fontWeight: 700, color: t.accent, fontFamily: "'Consolas','Courier New',monospace", textAlign: "right" }}>{fmtMoney(saldoAnterior)}</td>
                  <td />
                </tr>
                {filas.length === 0 && <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: t.muted, fontSize: 13 }}>Sin movimientos para esta fecha</td></tr>}
                {Object.entries(grupos).sort(([a]: any, [b]: any) => {
                  const isALast = a.toLowerCase().includes("caja efectivo") || a.toLowerCase().includes("bbva");
                  const isBLast = b.toLowerCase().includes("caja efectivo") || b.toLowerCase().includes("bbva");
                  if (isALast && !isBLast) return 1;
                  if (!isALast && isBLast) return -1;
                  return a.localeCompare(b);
                }).map(([concepto, items]: any) => (
                  <React.Fragment key={concepto}>
                    <tr style={{ background: t.accent + "0a" }}>
                      <td colSpan={4} style={{ padding: "6px 14px", fontWeight: 700, fontSize: 11, color: t.accent, letterSpacing: "0.5px", textTransform: "uppercase", borderTop: `1px solid ${t.border}` }}>{concepto}</td>
                    </tr>
                    {items.map((f: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${t.border}33`, opacity: f.informativo ? 0.75 : 1 }}>
                        <td style={{ padding: "7px 14px 7px 24px", color: f.informativo ? t.muted : t.text }}>
                          {f.informativo && <span style={{ fontSize: 10, fontWeight: 700, color: t.muted, background: t.surf2, padding: "2px 6px", borderRadius: 4, border: `1px solid ${t.border}`, marginRight: 6 }}>{f.origen === "manual" ? "Informativo" : "Pago bancario"}</span>}
                          {f.detalle || "—"}
                        </td>
                        <td style={{ padding: "7px 14px", color: t.sub, fontSize: 12 }}>{f.destino}</td>
                        <td style={{ padding: "7px 14px", color: t.green, fontFamily: "'Consolas','Courier New',monospace", fontWeight: 600, textAlign: "right" }}>{f.ingreso > 0 ? fmtMoney(f.ingreso) : "—"}</td>
                        <td style={{ padding: "7px 14px", fontFamily: "'Consolas','Courier New',monospace", fontWeight: 600, textAlign: "right", color: f.informativo ? t.muted : t.red }}>
                          {f.informativo ? fmtMoney(f.monto) : f.egreso > 0 ? fmtMoney(f.egreso) : "—"}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr style={{ background: t.surf2, borderTop: `2px solid ${t.border}` }}>
                  <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 800, color: t.text }}>SUBTOTALES</td>
                  <td style={{ padding: "10px 14px", fontWeight: 800, color: t.green, fontFamily: "'Consolas','Courier New',monospace", textAlign: "right" }}>{fmtMoney(totalIngreso)}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 800, color: t.red, fontFamily: "'Consolas','Courier New',monospace", textAlign: "right" }}>{fmtMoney(totalEgreso)}</td>
                </tr>
                <tr style={{ background: resultado >= 0 ? t.green + "12" : t.red + "12" }}>
                  <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 800, color: resultado >= 0 ? t.green : t.red }}>TOTAL DEL DÍA</td>
                  <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 800, color: resultado >= 0 ? t.green : t.red, fontFamily: "'Consolas','Courier New',monospace", textAlign: "right", fontSize: 15 }}>{resultado >= 0 ? "+" : "-"}{fmtMoney(Math.abs(resultado))}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 700, color: t.text }}>SALDO ACTUAL DE CAJA</td>
                  <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 800, color: t.accent, fontFamily: "'Consolas','Courier New',monospace", textAlign: "right", fontSize: 15 }}>{fmtMoney(saldoActual)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>;
      })()}

      {tabCaja === "movimientos" && <>
        <Card accent={t.green} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: t.sub, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>Patrimonio operativo</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: t.green, letterSpacing: "-1px" }}>{fmtUSD(totalGeneral)}</div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{mostrarUSD && cotizUSD ? `$1 USD = $${fmtNum(cotizUSD)} · BNA` : cuentas.filter((c: any) => CUENTAS_PATRIMONIO.includes(c.id)).map((c: any) => c.nombre).join(" + ") || "Sin cuentas"}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "flex-start" }}>
              {cuentas.map((c: any) => {
                const incluida = CUENTAS_PATRIMONIO.includes(c.id);
                return (
                  <div key={c.id} onClick={() => togglePatrimonio(c.id)}
                    title={incluida ? "Click para excluir del patrimonio" : "Click para incluir en el patrimonio"}
                    style={{ textAlign: "center", padding: "6px 12px", background: incluida ? c.color + "1a" : t.surf2, borderRadius: 8, border: `1px solid ${incluida ? c.color + "44" : t.border}`, cursor: "pointer", opacity: incluida ? 1 : 0.6, transition: "all 0.2s", userSelect: "none", minWidth: 100 }}>
                    <div style={{ fontSize: 9, color: incluida ? c.color : t.muted, fontWeight: 700, letterSpacing: "0.5px", marginBottom: 1, textTransform: "uppercase" }}>
                      {c.nombre}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: incluida ? c.color : t.muted }}>{fmtUSD(c.saldo)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Account Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: cuentaSel ? 8 : 20 }}>
          {cuentas.map((c: any, index: number) => {
            const isDragging = draggedCuenta?.id === c.id;
            const isDarkCard = isDark ? true : (index % 2 === 0);
            const bgColor = isDark ? (index % 2 === 0 ? t.surf : t.bg) : (isDarkCard ? "#0A2540" : "#ffffff");
            const textColor = isDarkCard ? "#ffffff" : t.text;
            const subColor = isDarkCard ? "rgba(255,255,255,0.7)" : t.sub;

            return (
              <div 
                key={c.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, c)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                style={{ 
                  background: bgColor, 
                  borderRadius: 16, 
                  border: isDarkCard ? "none" : `1px solid ${t.border}`, 
                  boxShadow: cuentaSel?.id === c.id ? `0 0 0 3px ${c.color}` : isDarkCard ? "0 8px 20px -8px rgba(10,37,64,0.5)" : "0 4px 15px -4px rgba(0,0,0,0.05)",
                  transition: "all 0.2s", 
                  position: "relative", 
                  overflow: "hidden", 
                  opacity: cuentaSel && cuentaSel.id !== c.id ? 0.45 : isDragging ? 0.4 : 1, 
                  cursor: "grab" 
                }}>
                <div onClick={() => setCuentaSel(cuentaSel?.id === c.id ? null : c)} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, position: "relative", zIndex: 1 }}>
                     <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                       <div style={{ fontSize: 13, color: textColor, fontWeight: 700, letterSpacing: "-0.2px", display: "flex", alignItems: "center", gap: 6 }}>
                         <span style={{color: subColor}}><Ic n="menu" s={12} /></span> 
                         {c.nombre}
                       </div>
                     </div>
                     <div style={{ display: "flex", gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: isDarkCard ? "rgba(255,255,255,0.1)" : c.color + "1a", color: isDarkCard ? "#fff" : c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                           <Ic n={c.tipo === "banco" ? "caja" : c.tipo === "inversion" ? "stats" : "ventas"} s={12} />
                        </div>
                     </div>
                  </div>

                  {c.tipo === "banco" ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                      {c.titular && <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>Titular</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.titular}</div>
                      </div>}
                      {c.tipoCuentaBancaria && <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tipo</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{c.tipoCuentaBancaria}</div>
                      </div>}
                      {c.numeroCuenta && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>CBU / CVU</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: textColor, fontFamily: "monospace" }}>{c.numeroCuenta}</div>
                        </div>
                      )}
                      {c.nroCuentaCorriente && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>Nro. de Cuenta</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: textColor, fontFamily: "monospace" }}>{c.nroCuentaCorriente}</div>
                        </div>
                      )}
                      {c.alias && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: subColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>Alias CVU</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: textColor, fontFamily: "monospace" }}>{c.alias}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 24, fontWeight: 800, color: textColor, letterSpacing: "-0.5px", marginTop: 8, marginBottom: 8, position: "relative", zIndex: 1 }}>
                      {fmtMoney(c.saldo)}
                    </div>
                  )}

                  {c.tipo === "banco" && (
                     <div style={{ fontSize: 20, fontWeight: 800, color: textColor, letterSpacing: "-0.5px", marginBottom: 12 }}>
                       {fmtMoney(c.saldo)}
                     </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", position: "relative", zIndex: 1, paddingTop: 10, borderTop: isDarkCard ? "1px solid rgba(255,255,255,0.1)" : `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, color: subColor, fontFamily: "monospace", letterSpacing: "1px" }}>
                      **** {String(c.id).slice(-4) || "0000"}
                    </div>
                    {c.tipo === "inversion" ? (
                      <button onClick={e => { e.stopPropagation(); setFormUtilidad({ ...formUtilidad, cuentaId: String(c.id) }); setModalUtilidad(true); }} style={{ fontSize: 10, fontWeight: 700, color: t.green, background: t.green + "1a", border: `1px solid ${t.green}33`, borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}>+ UTIL</button>
                    ) : (
                      <div style={{ background: isDarkCard ? "rgba(255,255,255,0.15)" : c.color + "1a", color: isDarkCard ? "#fff" : c.color, padding: "2px 6px", borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {c.tipo}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {cuentaSel && (() => {
          const c = cuentaSel;
          const nombreL = (c.nombre || "").toLowerCase();
          const esConciliable = c.tipo === "banco" && (nombreL.includes("san juan") || nombreL.includes("patagonia"));
          
          const mostrarPagoProv = c.tipo === "caja" || c.tipo === "banco" || c.tipo === "inversion";
          const mostrarTransf = (c.tipo === "banco" && (nombreL.includes("san juan") || nombreL.includes("patagonia") || nombreL.includes("bbva")));
          const mostrarCobroCli = c.tipo === "caja";
          const mostrarDeposito = c.tipo === "caja";

          return <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 14px", background: t.surf2, borderRadius: 10, border: `1px solid ${c.color}55`, marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: c.color, marginRight: 4, whiteSpace: "nowrap" }}>{c.nombre} —</span>
            <button onClick={() => setModalMov({ open: true, cuentaId: String(c.id), tipo: "ingreso" })} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: `1px solid ${t.green}44`, background: t.greenBg, color: t.green, cursor: "pointer", fontWeight: 600, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>↑ Ingreso</button>
            <button onClick={() => setModalMov({ open: true, cuentaId: String(c.id), tipo: "egreso" })} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: `1px solid ${t.red}44`, background: t.redBg, color: t.red, cursor: "pointer", fontWeight: 600, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>↓ Gasto</button>
            {mostrarCobroCli && (
              <button onClick={() => { setModalIngresoCli(true); }} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: `1px solid ${t.accent}44`, background: t.accent+"18", color: t.accent, cursor: "pointer", fontWeight: 600, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>👤 Cobro cliente</button>
            )}
            {mostrarPagoProv && (
              <button onClick={() => setModalPagoProv({ open: true, cuentaId: String(c.id) })} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: `1px solid ${t.amber}44`, background: t.amberBg, color: t.amber, cursor: "pointer", fontWeight: 600, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>🏭 Pago proveedor</button>
            )}
            {mostrarTransf && (
              <button onClick={() => setModalTransf({ open: true, origen: String(c.id) })} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: `1px solid ${t.purple}44`, background: t.purple+"18", color: t.purple, cursor: "pointer", fontWeight: 600, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>⇄ Transferir</button>
            )}
            {mostrarDeposito && (
              <button onClick={() => setModalDeposito({ open: true, origen: String(c.id) })} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: `1px solid ${c.color}44`, background: c.color+"18", color: c.color, cursor: "pointer", fontWeight: 600, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>🏦 Depósito</button>
            )}
            {esConciliable && (
              <button onClick={() => { setModalConciliacion(c); }} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: `1px solid ${t.green}44`, background: t.green+"18", color: t.green, cursor: "pointer", fontWeight: 600, fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif" }}>✓ Conciliación</button>
            )}
          </div>;
        })()}

        {/* Tabla de Movimientos */}
        {cuentaSel && (
          <Card>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}><SearchBar value={filtroBusq} onChange={setFiltroBusq} placeholder="Buscar movimiento..." /></div>
              <Sel value={filtroTipo} onChange={(e: any) => setFiltroTipo(e.target.value)} style={{ width: 140 }}>
                <option value="todos">Todos los tipos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
              </Sel>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.muted }}>Desde</span>
                <Inp type="date" value={filtroDesde} onChange={(e: any) => setFiltroDesde(e.target.value)} style={{ width: 130 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: t.muted }}>Hasta</span>
                <Inp type="date" value={filtroHasta} onChange={(e: any) => setFiltroHasta(e.target.value)} style={{ width: 130 }} />
                {(filtroDesde || filtroHasta) && <button onClick={() => { setFiltroDesde(""); setFiltroHasta(""); }} style={{ padding: "4px 8px", fontSize: 11, background: "none", border: `1px solid ${t.border}`, borderRadius: 6, cursor: "pointer", color: t.muted }}>Limpiar</button>}
              </div>
            </div>

            {movsFiltrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: t.muted, fontSize: 13 }}>No hay movimientos que coincidan con los filtros.</div>
            ) : (
              <Tbl headers={["Fecha", "Concepto", "Ingreso", "Egreso", "Saldo", ""]}>
                {movsFiltrados.map((m: any, i: number) => {
                  const conceptoStr = String(m.concepto || "");
                  const esCobranza = m._esCobro || conceptoStr.startsWith("Cobro");
                  const esPagoProv = conceptoStr.startsWith("Pago proveedor");
                  const anomalia = m.monto > 5000000;

                  let renderedConcepto: any = m.concepto;
                  if (esCobranza) {
                    const nombreCliente = conceptoStr.replace(/Cobro (vendedor )?—\s*/, '').replace(/Cobro →\s*/, '');
                    renderedConcepto = <><span style={{ color: t.green, fontWeight: 700, padding: "2px 6px", background: t.greenBg, borderRadius: 4, marginRight: 6, fontSize: 11 }}>↑ COBRO</span> {nombreCliente}</>;
                  } else if (esPagoProv) {
                     const nombreProv = conceptoStr.replace('Pago proveedor — ', '');
                     renderedConcepto = <><span style={{ color: t.amber, fontWeight: 700, padding: "2px 6px", background: t.amberBg, borderRadius: 4, marginRight: 6, fontSize: 11 }}>↓ PAGO PROV</span> {nombreProv}</>;
                  } else if (m.concepto === "Saldo inicial") {
                    renderedConcepto = <>{m.concepto}</>;
                  } else if (m.informativo) {
                    renderedConcepto = <>{m.concepto}</>;
                  } else {
                    renderedConcepto = <>{m.tipo === "ingreso" ? "↑ " : "↓ "}{m.concepto}</>;
                  }

                  return <Tr key={m.id} style={{ background: anomalia ? t.amberBg : m.informativo ? t.surf2 : t.surf }}>
                    <Td style={{ fontFamily: "'Consolas','Courier New',monospace", fontSize: 11, color: t.sub }}>{fmtFechaCC(m.fecha)}<br /><span style={{ fontSize: 10, color: t.muted }}>{m.hora}</span></Td>
                    <Td>
                      <div style={{ fontWeight: 600, color: m.informativo ? t.muted : t.text, opacity: m.informativo ? 0.7 : 1 }}>
                        {renderedConcepto}
                      </div>
                    </Td>
                    <Td style={{ fontFamily: "'Consolas','Courier New',monospace", fontWeight: 700, color: t.green, textAlign: "right" }}>{m.tipo === "ingreso" && !m.informativo ? `+ ${fmtMoney(m.monto)}` : "—"}</Td>
                    <Td style={{ fontFamily: "'Consolas','Courier New',monospace", fontWeight: 700, color: m.informativo ? t.muted : t.red, textAlign: "right" }}>{m.tipo !== "ingreso" ? `${m.informativo ? "" : "- "}${fmtMoney(m.monto)}` : "—"}</Td>
                    <Td style={{ fontFamily: "'Consolas','Courier New',monospace", fontWeight: 700, color: t.text, textAlign: "right" }}>{fmtMoney(m._saldo)}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {!esCobranza && m.concepto !== "Saldo inicial" && !m.informativo && (
                          <Btn v="ghost" onClick={() => abrirEditarMov(m)} style={{ padding: "4px 8px" }}><Ic n="edit" s={13} /></Btn>
                        )}
                      </div>
                    </Td>
                  </Tr>;
                })}
              </Tbl>
            )}
          </Card>
        )}
      </>}

      {/* Modals ya extraídos se inyectan acá */}

      {/* Re-export Edit Modal */}
      {modalEditMov && (
        <OverlaySheet open={true} onClose={() => setModalEditMov(false)} title="Editar movimiento" width={420}>
          <div style={{ padding: "10px 14px", background: t.amberBg, border: `1px solid ${t.amber}44`, borderRadius: 8, fontSize: 12, color: t.amber, marginBottom: 16, fontWeight: 600 }}>
            ⚠️ La modificación afectará los saldos históricos de la caja.
          </div>
          <Fld label="Nuevo Concepto"><Inp value={formEditMov.concepto} onChange={(e: any) => setFormEditMov({ ...formEditMov, concepto: e.target.value })} /></Fld>
          <div style={{ display: "flex", gap: 12 }}>
            <Fld label="Fecha" half><Inp type="date" value={formEditMov.fecha} onChange={(e: any) => setFormEditMov({ ...formEditMov, fecha: e.target.value })} /></Fld>
            <Fld label="Monto" half><InpMoney value={formEditMov.monto} onChange={(e: any) => setFormEditMov({ ...formEditMov, monto: e.target.value })} /></Fld>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {(user?.rol === "maestro" || user?.rol === "administrador" || user?.permisos?.anularPagos) && (
              <Btn v="danger" onClick={() => setConfirmarElimMov(true)}>Eliminar movimiento</Btn>
            )}
            <div style={{ flex: 1 }} />
            <Btn v="ghost" onClick={() => setModalEditMov(false)}>Cerrar</Btn>
            <Btn onClick={() => setModalConfirmEdit(true)}>Guardar cambios</Btn>
          </div>

          {modalConfirmEdit && (
            <Modal open={true} title="Autorización requerida" onClose={() => { setModalConfirmEdit(false); setPassConfirm(""); setPassError(""); }} width={420}>
              <div style={{ fontSize: 13, color: t.muted, marginBottom: 16 }}>Por seguridad, pedile al perfil MAESTRO su contraseña para validar esta edición.</div>
              <Fld label="Contraseña Maestra"><Inp type="password" value={passConfirm} onChange={(e: any) => setPassConfirm(e.target.value)} /></Fld>
              {passError && <div style={{ fontSize: 12, color: t.red, marginBottom: 16 }}>{passError}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <Btn v="ghost" onClick={() => { setModalConfirmEdit(false); setPassConfirm(""); setPassError(""); }} full>Cancelar</Btn>
                <Btn onClick={confirmarContraseñaYEditar} full>Autorizar y Editar</Btn>
              </div>
            </Modal>
          )}

          {confirmarElimMov && (
            <Modal open={true} title="¿Estás seguro/a?" onClose={() => setConfirmarElimMov(false)} width={420}>
              <div style={{ fontSize: 13, color: t.muted, marginBottom: 16 }}>Se volverán los saldos a la normalidad como si esto no hubiera existido. Si fue un pago a proveedor, se eliminará el pago también.</div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <Btn v="ghost" onClick={() => { setConfirmarElimMov(false); }} full>Cancelar</Btn>
                <Btn v="danger" onClick={eliminarMovimiento} full>Sí, Eliminar</Btn>
              </div>
            </Modal>
          )}
        </OverlaySheet>
      )}

      <ModalGestionCuentas 
        open={modalGestionCuentas} 
        onClose={() => setModalGestionCuentas(false)} 
        cuentas={cuentas} 
        setCuentas={setCuentas} 
        movimientos={movimientos} 
        setMovimientos={setMovimientos} 
        cuentasPatrimonio={cuentasPatrimonio} 
        setCuentasPatrimonio={setCuentasPatrimonio} 
        cloudSync={props.cloudSync} 
        t={t} 
        hora={hora} 
      />

      <ModalGestionConceptos 
        open={modalGestionConceptos} 
        onClose={() => setModalGestionConceptos(false)} 
        conceptos={conceptos} 
        setConceptos={setConceptos} 
        cloudSync={props.cloudSync} 
        t={t} 
      />

      <ModalCerrarCaja 
        open={modalCerrarCaja} 
        onClose={() => setModalCerrarCaja(false)} 
        fechaPlanilla={fechaPlanilla} 
        totalIngreso={planillaDelDia().totalIngreso} 
        totalEgreso={planillaDelDia().totalEgreso} 
        resultado={planillaDelDia().resultado} 
        saldoCajaReal={cuentas.filter((c: any) => c.saldo !== 0 && CUENTAS_PATRIMONIO.includes(c.id)).reduce((s: number, c: any) => s + c.saldo, 0)} 
        cuentasEnPatrimonio={cuentas.filter((c: any) => c.saldo !== 0 && CUENTAS_PATRIMONIO.includes(c.id))} 
        clientes={clientes} 
        facturas={facturas} 
        pagos={pagos} 
        proveedores={proveedores} 
        factProv={factProv} 
        pagosProv={pagosProv} 
        historialCierres={historialCierres} 
        setHistorialCierres={setHistorialCierres} 
        cloudSync={props.cloudSync} 
        t={t} 
      />
      
      {modalUtilidad && (
        <OverlaySheet open={true} onClose={() => setModalUtilidad(false)} title="Registrar Utilidad" width={420}>
          <div style={{ display: "flex", gap: 12 }}>
            <Fld label="Cuenta Destino" half>
              <Sel value={formUtilidad.cuentaId} onChange={(e: any) => setFormUtilidad({ ...formUtilidad, cuentaId: e.target.value })}>
                <option value="">Seleccionar...</option>
                {cuentas.filter((c: any) => c.tipo === "inversion").map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Sel>
            </Fld>
            <Fld label="Monto" half><InpMoney value={formUtilidad.monto} onChange={(e: any) => setFormUtilidad({ ...formUtilidad, monto: e.target.value })} /></Fld>
          </div>
          <Fld label="Fecha"><Inp type="date" value={formUtilidad.fecha} onChange={(e: any) => setFormUtilidad({ ...formUtilidad, fecha: e.target.value })} /></Fld>
          <Fld label="Detalle Adicional"><Inp value={formUtilidad.detalle} onChange={(e: any) => setFormUtilidad({ ...formUtilidad, detalle: e.target.value })} placeholder="Ej: Rendimiento Septiembre..." /></Fld>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn v="ghost" onClick={() => setModalUtilidad(false)} full>Cancelar</Btn>
            <Btn onClick={guardarUtilidad} disabled={!formUtilidad.cuentaId || !formUtilidad.monto} full><Ic n="check" s={14} />Registrar</Btn>
          </div>
        </OverlaySheet>
      )}

      {modalMovPlanilla && (
        <OverlaySheet open={true} onClose={() => setModalMovPlanilla(false)} title="Registrar movimiento libre" width={440}>
          <div style={{ background: t.surf2, padding: "10px 14px", borderRadius: 8, fontSize: 13, color: t.sub, border: `1px solid ${t.border}`, marginBottom: 16 }}>
            Usá esta opción para registrar gastos menores u otros movimientos (ej. limpieza, compras en efectivo) directamente en la planilla del día.
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Fld label="Concepto" style={{ flex: 2 }}>
              <Sel value={formPlanilla.conceptoId} onChange={(e: any) => setFormPlanilla({ ...formPlanilla, conceptoId: e.target.value })}>
                <option value="">Seleccionar...</option>
                {conceptos.filter((c: any) => c.activo).map((c: any) => <option key={c.id} value={c.id}>{c.tipo === "ingreso" ? "↑ " : "↓ "}{c.nombre} ({c.tipo})</option>)}
              </Sel>
            </Fld>
            <Fld label="Monto" style={{ flex: 1 }}><InpMoney value={formPlanilla.monto} onChange={(e: any) => setFormPlanilla({ ...formPlanilla, monto: e.target.value })} /></Fld>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Fld label="Cuenta que pagó / recibió" half>
              <Sel value={formPlanilla.cuentaId} onChange={(e: any) => setFormPlanilla({ ...formPlanilla, cuentaId: e.target.value })}>
                <option value="">Seleccionar...</option>
                {cuentas.map((c: any) => <option key={c.id} value={c.id}>{c.nombre} (Saldo: {fmtMoney(c.saldo)})</option>)}
              </Sel>
            </Fld>
            <Fld label="Unidad de Negocio" half>
              <Sel value={formPlanilla.unidadNegocio} onChange={(e: any) => setFormPlanilla({ ...formPlanilla, unidadNegocio: e.target.value })}>
                {(unidadesNegocio && unidadesNegocio.length > 0 ? unidadesNegocio : UNIDADES_NEGOCIO).map((un: string) => <option key={un} value={un}>{un}</option>)}
              </Sel>
            </Fld>
          </div>
          <Fld label="Detalle (Opcional)"><Inp value={formPlanilla.detalle} onChange={(e: any) => setFormPlanilla({ ...formPlanilla, detalle: e.target.value })} placeholder="Ej: Artículos de limpieza" /></Fld>
          <Fld label="Fecha"><Inp type="date" value={formPlanilla.fecha} onChange={(e: any) => setFormPlanilla({ ...formPlanilla, fecha: e.target.value })} /></Fld>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn v="ghost" onClick={() => setModalMovPlanilla(false)} full>Cancelar</Btn>
            <Btn onClick={guardarMovPlanilla} disabled={!formPlanilla.conceptoId || !formPlanilla.cuentaId || !formPlanilla.monto} full><Ic n="check" s={14} />Guardar</Btn>
          </div>
        </OverlaySheet>
      )}

      {modalHistorialCierres && (
        <OverlaySheet open={true} onClose={() => setModalHistorialCierres(false)} title="Historial de Cierres" width={600}>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {historialCierres.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)).map((c: any) => (
              <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: t.surf2, borderRadius: 8, border: `1px solid ${t.border}`, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: t.text, marginBottom: 2 }}>{fmtFechaCC(c.fecha)} {c.requiereRevision && <Bdg color={t.amber}>Requiere revisión</Bdg>}</div>
                  <div style={{ fontSize: 12, color: t.sub }}>Ingresos: {fmtMoney(c.totalIngreso)} | Egresos: {fmtMoney(c.totalEgreso)} | Saldo: {fmtMoney(c.saldoActual)}</div>
                  {c.nota && <div style={{ fontSize: 12, color: t.muted, marginTop: 4 }}>Nota: {c.nota}</div>}
                </div>
                <Btn v="ghost" onClick={() => { setFechaPlanilla(c.fecha); setTabCaja("planilla"); setModalHistorialCierres(false); }} style={{ padding: "6px 12px", fontSize: 12 }}>Ver Planilla</Btn>
              </div>
            ))}
            {historialCierres.length === 0 && <div style={{ textAlign: "center", padding: "20px", color: t.muted, fontSize: 13 }}>No hay cierres registrados.</div>}
          </div>
        </OverlaySheet>
      )}

      {modalConciliacion && <ModalConciliacion cuenta={modalConciliacion} onClose={() => setModalConciliacion(null)} pagos={pagos} clientes={clientes} movimientos={movimientos} t={t} conceptos={conceptos} setMovimientos={setMovimientos} />}
      
      {modalIngresoCli && (
        <ModalIngresoCli
          open={true}
          onClose={() => setModalIngresoCli(false)}
          clientes={clientes}
          cuentas={cuentas}
          setCuentas={setCuentas}
          proveedores={proveedores}
          pagos={pagos}
          setPagos={setPagos}
          movimientos={movimientos}
          setMovimientos={setMovimientos}
          pagosProv={pagosProv}
          setPagosProv={setPagosProv}
          user={user}
          cloudSync={props.cloudSync}
        />
      )}

      {modalMov.open && (
        <ModalRegistrarMovimiento
          open={true}
          onClose={() => setModalMov({ open: false, cuentaId: "", tipo: "ingreso" })}
          tipoMovimiento={modalMov.tipo}
          cuentaPreseleccionada={modalMov.cuentaId}
          cuentas={cuentas}
          conceptos={conceptos}
          movimientos={movimientos}
          setMovimientos={setMovimientos}
          setCuentas={setCuentas}
          marcarCierreAfectado={marcarCierreAfectado}
          cloudSync={props.cloudSync}
          unidadesNegocio={UNIDADES_NEGOCIO}
          t={t}
        />
      )}

      {modalTransf.open && (
        <ModalTransferencia
          open={true}
          onClose={() => setModalTransf({ open: false, origen: "" })}
          cuentaOrigenPreseleccionada={modalTransf.origen}
          cuentas={cuentas}
          movimientos={movimientos}
          setMovimientos={setMovimientos}
          setCuentas={setCuentas}
          marcarCierreAfectado={marcarCierreAfectado}
          cloudSync={props.cloudSync}
          t={t}
        />
      )}

      {modalPagoProv.open && (
        <ModalPagoProveedorCaja
          open={true}
          onClose={() => setModalPagoProv({ open: false, cuentaId: "" })}
          cuentaOrigenPreseleccionada={modalPagoProv.cuentaId}
          cuentas={cuentas}
          proveedores={proveedores}
          pagosProv={pagosProv}
          setPagosProv={setPagosProv}
          movimientos={movimientos}
          setMovimientos={setMovimientos}
          setCuentas={setCuentas}
          marcarCierreAfectado={marcarCierreAfectado}
          cloudSync={props.cloudSync}
          t={t}
        />
      )}

      {modalDeposito.open && (
        <ModalDeposito
          open={true}
          onClose={() => setModalDeposito({ open: false, origen: "" })}
          cuentaOrigenPreseleccionada={modalDeposito.origen}
          cuentas={cuentas}
          movimientos={movimientos}
          setMovimientos={setMovimientos}
          setCuentas={setCuentas}
          marcarCierreAfectado={marcarCierreAfectado}
          cloudSync={props.cloudSync}
          t={t}
        />
      )}
    </PageContainer>
  );
}

