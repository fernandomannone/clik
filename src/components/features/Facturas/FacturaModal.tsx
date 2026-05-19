import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../../context/AppContext";
import {
  OverlaySheet,
  Modal,
  Fld,
  Sel,
  Inp,
  InpMoney,
  Btn,
  Ic,
} from "../../common/UIBase";
import {
  fmtMoney,
  getToday,
  parseMoney,
  fmtNum,
  precioLista,
  registrarMovimientoKardex,
} from "../../../lib/utils";
import { COND_PAGO, CODIGOS_A_FISICO, TIPOS_KARDEX } from "../../../constants";

import {
  htmlComprobante,
  compartirWsp,
  generarPDFComprobante,
  exportarExcelFactura,
} from "../../../lib/facturas/facturaExport";

const TIPOS_FAC = ["B", "A", "C", "X"];
const LETRAS_LABEL: Record<string, string> = {
  B: "Consumidor Final",
  A: "Resp. Inscripto",
  C: "Monotributista",
  X: "Interna s/AFIP",
};

import {
  nuevaNumFac,
  parseCant,
  calcItem,
  precioParaCliente,
  emitirFacturaLogic,
  eliminarFacturaLogic,
  confirmarFacturaLogic,
} from "../../../lib/facturas/facturaLogic";

import FacturaBuscadorArticulos from "./FacturaBuscadorArticulos";

export default function FacturaModal({
  open,
  onClose,
  onFacturaEmitida,
  cliente,
  clientes,
  articulos,
  setArticulos,
  facturas,
  setFacturas,
  setClientes,
  pagos = [],
  user,
  cloudSync,
  saldoCliente,
}: any) {
  const { t, claveMaestra } = useApp();
  const hoy = getToday();
  const clienteActual =
    clientes?.find((c: any) => c.id === cliente?.id) || cliente;
  const editando = clienteActual?._editando || cliente?._editando;
  const ITEMS_INIT = () => [
    { id: 1, codigo: "", nombre: "", cantidad: "1", precio: "", bonif: "" },
    { id: 2, codigo: "", nombre: "", cantidad: "1", precio: "", bonif: "" },
    { id: 3, codigo: "", nombre: "", cantidad: "1", precio: "", bonif: "" },
    { id: 4, codigo: "", nombre: "", cantidad: "1", precio: "", bonif: "" },
    { id: 5, codigo: "", nombre: "", cantidad: "1", precio: "", bonif: "" },
  ];
  const [letra, setLetra] = useState("B");
  const [fecha, setFecha] = useState(hoy);
  const [condPago, setCondPago] = useState("Contado");
  const [descGlobal, setDescGlobal] = useState("");
  const [items, setItems] = useState(ITEMS_INIT());
  const [vendedor, setVendedor] = useState("");
  const [tipoComp, setTipoComp] = useState("factura");
  const [sinArticulos, setSinArticulos] = useState(false);
  const [totalManual, setTotalManual] = useState("");
  const [buscadorArt, setBuscadorArt] = useState(false);
  const [busqArt, setBusqArt] = useState("");
  const [modalLimite, setModalLimite] = useState(false);
  const [recordarExceder, setRecordarExceder] = useState(false);
  const [modalSepararFisico, setModalSepararFisico] = useState(false);
  const [nombreCF, setNombreCF] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [passBorrar, setPassBorrar] = useState("");
  const [showPassBorrar, setShowPassBorrar] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const prevClienteRef = useRef<any>(null);
  const primerCampoRef = useRef<any>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        primerCampoRef.current?.focus();
      }, 120);
      return () => clearTimeout(t);
    } else {
      setShowPassBorrar(false);
      setPassBorrar("");
    }
  }, [open]);

  useEffect(() => {
    if (open && cliente) {
      if (editando) {
        setTipoComp(editando.tipo || "factura");
        setLetra(editando.letra || "B");
        setCondPago(editando.condPago || "Contado");
        setFecha(editando.fecha || hoy);
        if (editando.items && editando.items.length > 0) {
          setItems(
            editando.items.map((i: any) => ({
              ...i,
              id:
                i.id ||
                Date.now() + "_" + Math.random().toString(36).substr(2, 9),
              cantidad: String(i.cantidad || 1),
              precio: String(i.precio || 0),
              bonif: String(i.bonif || ""),
            })),
          );
        } else {
          setItems(ITEMS_INIT());
        }
        setDescGlobal(String(editando.descuento || ""));
        setTotalManual(String(editando.total || ""));
      } else {
        if (cliente && prevClienteRef.current?.id !== cliente.id) {
          prevClienteRef.current = cliente;
          if (tipoComp !== (cliente._tipoComp || "factura"))
            setTipoComp(cliente._tipoComp || "factura");
        }
      }
    }
  }, [open, cliente, editando]);

  const resetForm = () => {
    setProcesando(false);
    setItems(ITEMS_INIT());
    setCondPago("Contado");
    setDescGlobal("");
    setLetra("B");
    setFecha(hoy);
    setTipoComp("factura");
    setSinArticulos(false);
    setTotalManual("");
    setBuscadorArt(false);
    setBusqArt("");
    prevClienteRef.current = null;
  };
  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!clienteActual) return null;

  const lista = clienteActual.listaPrecios || null;
  const noTieneLista =
    !clienteActual.listaPrecios && !clienteActual.precioManual && !editando;

  const precioParaClienteLocal = (art: any) => {
    return precioParaCliente(art, lista, facturas, clienteActual.id);
  };

  const buscarArticulo = (itemId: number, cod: string) => {
    if (!cod || !cod.trim()) return;
    const art = articulos
      .filter((a: any) => (a.estado || "activo") === "activo")
      .find(
        (a: any) =>
          a.codigo?.toLowerCase() === cod.trim().toLowerCase() ||
          a.nombre.toLowerCase().includes(cod.trim().toLowerCase()),
      );
    if (art) {
      const precio = precioParaClienteLocal(art);
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                codigo: art.codigo || i.codigo,
                nombre: art.nombre,
                precio: precio != null ? String(precio) : "",
                artId: art.id,
              }
            : i,
        ),
      );
    }
  };

  const addItem = () =>
    setItems([
      ...items,
      {
        id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        codigo: "",
        nombre: "",
        cantidad: "1",
        precio: "",
        bonif: "",
      },
    ]);
  const removeItem = (id: number) => setItems(items.filter((i) => i.id !== id));
  const updItem = (id: number, field: string, val: any) =>
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: val } : i)));

  const subtotal = items.reduce((s, i) => s + calcItem(i), 0);
  const descMonto = subtotal * ((parseMoney(descGlobal) || 0) / 100);
  const total = sinArticulos
    ? parseMoney(totalManual) || 0
    : subtotal - descMonto;

  const emitirFactura = async (forzarSeparar = false) => {
    if (procesando) return;
    setProcesando(true);
    
    const res = await emitirFacturaLogic({
      items, articulos, facturas, cliente, tipoComp,
      editando, letra, condPago, descGlobal, fecha, vendedor,
      user, cloudSync, nombreCF, forzarSeparar
    });
    
    setFacturas(res.finalFacturas);
    if (setArticulos) setArticulos(res.finalArticulos);

    if (!editando && onFacturaEmitida && res.finalFacturas.length > facturas.length) {
      const nuevasFacturas = res.finalFacturas.filter((f: any) => !facturas.find((oldF: any) => oldF.id === f.id));
      if (nuevasFacturas.length > 0) {
        onFacturaEmitida(nuevasFacturas[0]);
      }
    }

    if (!editando) {
      setShowSuccess(true);
      setProcesando(false);
    } else {
      onClose();
      resetForm();
    }
  };

  const eliminarFactura = async () => {
    if (!editando) return;
    const res = await eliminarFacturaLogic({ facturas, articulos, editando, tipoComp, cloudSync, user });
    
    setFacturas(res.finalFacturas);
    if (setArticulos) setArticulos(res.finalArticulos);

    onClose();
    resetForm();
  };

  const confirmar = () => {
    const check = confirmarFacturaLogic({
      tipoComp, cliente, editando, facturas, pagos, total, items
    });
    
    if (check.showAlert) {
      setModalLimite(true);
      return;
    }
    if (check.requiresSeparation) {
      setModalSepararFisico(true);
      return;
    }
    
    emitirFactura(false);
  };

  if (!open || !cliente) return null;

  const saldoActual = saldoCliente ? saldoCliente(clienteActual.id) : 0;

  return (
    <>
      <OverlaySheet
        open={open}
        onClose={handleClose}
        title={
          editando
            ? `Editar ${tipoComp.toUpperCase()}`
            : `Nueva ${tipoComp.toUpperCase()}`
        }
        sub={cliente?.nombre}
        width="860px"
      >
        <div style={{ paddingBottom: 20 }}>
          {/* SALDO ACTUAL */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: t.surf,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: t.sub,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Saldo Actual CC
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color:
                  saldoActual > 0 ? t.red : saldoActual < 0 ? t.green : t.text,
              }}
            >
              {fmtMoney(Math.abs(saldoActual))}{" "}
              {saldoActual > 0 ? "(Debe)" : saldoActual < 0 ? "(A favor)" : ""}
            </div>
          </div>

          {!!cliente?.esConsumidorFinal && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                background: t.amberBg,
                border: `1px solid ${t.amber}44`,
                borderRadius: 10,
              }}
            >
              <Fld
                label="Nombre del Cliente (Cons. Final)"
                style={{ marginBottom: 0 }}
              >
                <Inp
                  value={nombreCF}
                  onChange={(e: any) => setNombreCF(e.target.value)}
                  placeholder="Nombre para el comprobante..."
                />
              </Fld>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 16,
              background: t.surf2,
              padding: "12px",
              borderRadius: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 6, flex: 1, minWidth: "250px", background: t.surf, padding: 4, borderRadius: 8, border: `1px solid ${t.border}` }}>
              {[
                { id: "factura", label: "Factura", color: t.accent },
                { id: "nc", label: "N. Crédito", color: t.amber },
                { id: "nd", label: "N. Débito", color: t.red },
              ].map((tp) => (
                <button
                  key={tp.id}
                  onClick={() => setTipoComp(tp.id)}
                  disabled={!!editando}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: tipoComp === tp.id ? tp.color + "18" : "transparent",
                    color: tipoComp === tp.id ? tp.color : t.sub,
                    fontWeight: tipoComp === tp.id ? 700 : 500,
                    cursor: editando ? "not-allowed" : "pointer",
                    opacity: editando && tipoComp !== tp.id ? 0.5 : 1,
                    fontSize: 12,
                    border: "none",
                    outline: "none"
                  }}
                >
                  {tp.label}
                </button>
              ))}
            </div>
            
            <Sel
              value={letra}
              onChange={(e: any) => setLetra(e.target.value)}
              disabled={!!editando}
              style={{ width: "80px", padding: "6px 8px" }}
              title="Letra"
            >
              {TIPOS_FAC.map((l) => (
                <option key={l} value={l}>Letra {l}</option>
              ))}
            </Sel>
            
            <Inp
              type="date"
              value={fecha}
              onChange={(e: any) => setFecha(e.target.value)}
              style={{ width: "130px", padding: "6px 8px" }}
              title="Fecha"
            />
            
            <Sel
              value={condPago}
              onChange={(e: any) => setCondPago(e.target.value)}
              style={{ width: "120px", padding: "6px 8px" }}
              title="Condición"
            >
              {COND_PAGO.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Sel>
          </div>

          {noTieneLista ? (
            <div
              style={{
                background: t.red + "15",
                border: `1px solid ${t.red}55`,
                borderRadius: 12,
                padding: "20px",
                marginBottom: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  color: t.red,
                  fontWeight: 700,
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Ic n="alert" s={20} /> Cliente sin lista de precios asignada
              </div>
              <div style={{ color: t.text, fontSize: 13 }}>
                Este cliente no tiene una lista de precios asignada, por lo que
                el sistema no sabe qué precio aplicarle al agregar artículos.
                Por favor, asignale una lista (o diferencial) antes de
                continuar.
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-end",
                  marginTop: 8,
                }}
              >
                <Fld
                  label="Asignar Lista para este cliente"
                  style={{ margin: 0, width: 300 }}
                >
                  <Sel
                    value=""
                    onChange={(e: any) => {
                      const val = e.target.value;
                      if (!val) return;
                      const dGuardar = {
                        ...clienteActual,
                        listaPrecios: val !== "manual" ? parseInt(val) : null,
                        precioManual: val === "manual",
                      };
                      if (cloudSync?.saveToCloud)
                        cloudSync.saveToCloud("clientes", dGuardar);
                      if (setClientes) {
                        setClientes((prev: any[]) => {
                          const idx = prev.findIndex(
                            (cl: any) => cl.id === dGuardar.id,
                          );
                          if (idx !== -1) {
                            const copia = [...prev];
                            copia[idx] = dGuardar;
                            return copia;
                          }
                          return prev;
                        });
                      }
                    }}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="manual">Precio Diferencial (Fijo)</option>
                    <option value="1">Lista 1</option>
                    <option value="2">Lista 2</option>
                    <option value="3">Lista 3</option>
                    <option value="4">Lista 4</option>
                  </Sel>
                </Fld>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: t.surf2,
                borderRadius: 12,
                padding: "16px 18px",
                marginBottom: 16,
              }}
            >
              {(() => {
                const hasBonif = items.some((i) => parseFloat(i.bonif) > 0);
                const cols = hasBonif
                  ? "110px 1fr 80px 120px 70px 120px 32px"
                  : "110px 1fr 80px 120px 120px 32px";
                const headers = hasBonif
                  ? [
                      "Código",
                      "Descripción / Artículo",
                      "Cant.",
                      "Unit.",
                      "Bon%",
                      "Subt.",
                      "",
                    ]
                  : [
                      "Código",
                      "Descripción / Artículo",
                      "Cant.",
                      "Precio",
                      "Subt.",
                      "",
                    ];
                return (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: cols,
                        gap: 10,
                        marginBottom: 10,
                        paddingBottom: 10,
                        borderBottom: `2px solid ${t.border}`,
                      }}
                    >
                      {headers.map((h) => (
                        <div
                          key={h}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: t.muted,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                          }}
                        >
                          {h}
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        maxHeight: "320px",
                        overflowY: "auto",
                        padding: "0 4px",
                      }}
                    >
                      {items.map((i, idx) => (
                        <div
                          key={i.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: cols,
                            gap: 10,
                            marginBottom: 8,
                            alignItems: "center",
                          }}
                        >
                          <Inp
                            ref={idx === 0 ? primerCampoRef : null}
                            value={i.codigo}
                            onChange={(e: any) => {
                              const val = e.target.value;
                              updItem(i.id, "codigo", val);
                              if (val.trim() === "044") {
                                buscarArticulo(i.id, val);
                                setTimeout(() => {
                                  const cantInput = document.getElementById(
                                    `cant-${i.id}`,
                                  );
                                  if (cantInput) {
                                    cantInput.focus();
                                    if (
                                      (cantInput as HTMLInputElement).select
                                    ) {
                                      (cantInput as HTMLInputElement).select();
                                    }
                                  }
                                }, 50);
                              }
                            }}
                            onBlur={(e: any) => {
                              if (
                                e.target.value.trim() &&
                                e.target.value.trim() !== "044"
                              )
                                buscarArticulo(i.id, e.target.value);
                            }}
                            placeholder="Cód"
                            style={{
                              padding: "8px 10px",
                              fontSize: 14,
                              border: `1px solid ${t.border}aa`,
                            }}
                          />
                          <div style={{ position: "relative" }}>
                            {i.artId ? (
                              <div
                                style={{
                                  padding: "8px 10px",
                                  background: t.surf,
                                  border: `1px solid ${t.border}aa`,
                                  borderRadius: 8,
                                  fontSize: 14,
                                  color: t.text,
                                  cursor: "text",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  fontFamily: "inherit",
                                  fontWeight: 600,
                                }}
                                title={i.nombre}
                                onClick={() => updItem(i.id, "artId", null)}
                              >
                                {i.nombre}
                              </div>
                            ) : (
                              <Inp
                                value={i.nombre}
                                onChange={(e: any) => {
                                  updItem(i.id, "nombre", e.target.value);
                                  updItem(i.id, "artId", null);
                                }}
                                onBlur={(e: any) => {
                                  setTimeout(
                                    () => buscarArticulo(i.id, e.target.value),
                                    150,
                                  );
                                }}
                                placeholder="Descripción del artículo..."
                                style={{
                                  padding: "8px 10px",
                                  fontSize: 14,
                                  border: `1px solid ${t.border}aa`,
                                }}
                              />
                            )}
                            {i.nombre &&
                              !i.artId &&
                              (() => {
                                const sugs = articulos
                                  .filter((a: any) =>
                                    a.nombre
                                      .toLowerCase()
                                      .includes(i.nombre.toLowerCase()),
                                  )
                                  .slice(0, 6);
                                if (!sugs.length) return null;
                                return (
                                  <div
                                    style={{
                                      position: "absolute",
                                      zIndex: 200,
                                      left: 0,
                                      right: 0,
                                      top: "100%",
                                      background: t.surf,
                                      border: `1px solid ${t.border}`,
                                      borderRadius: 8,
                                      boxShadow: t.shadow,
                                      overflow: "hidden",
                                      marginTop: 2,
                                    }}
                                  >
                                    {sugs.map((a: any) => (
                                      <div
                                        key={a.id}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          const precio = precioParaClienteLocal(a);
                                          setItems((prev) =>
                                            prev.map((x) =>
                                              x.id === i.id
                                                ? {
                                                    ...x,
                                                    nombre: a.nombre,
                                                    codigo:
                                                      a.codigo || x.codigo,
                                                    precio:
                                                      precio != null
                                                        ? String(precio)
                                                        : "",
                                                    artId: a.id,
                                                  }
                                                : x,
                                            ),
                                          );
                                        }}
                                        style={{
                                          padding: "6px 10px",
                                          cursor: "pointer",
                                          fontSize: 11.5,
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          borderBottom: `1px solid ${t.border}`,
                                        }}
                                        onMouseEnter={(e) =>
                                          (e.currentTarget.style.background =
                                            t.surf2)
                                        }
                                        onMouseLeave={(e) =>
                                          (e.currentTarget.style.background =
                                            "transparent")
                                        }
                                      >
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: t.text,
                                          }}
                                        >
                                          {a.nombre}
                                        </span>
                                        <span
                                          style={{
                                            color: t.muted,
                                            fontFamily: "monospace",
                                            fontSize: 10,
                                          }}
                                        >
                                          {a.codigo || ""}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                          </div>
                          <div style={{ position: "relative" }}>
                            <Inp
                              id={`cant-${i.id}`}
                              value={i.cantidad}
                              onChange={(e: any) =>
                                updItem(i.id, "cantidad", e.target.value)
                              }
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                fontSize: 12,
                              }}
                            />
                          </div>
                          <InpMoney
                            value={i.precio}
                            onChange={(e: any) =>
                              updItem(i.id, "precio", e.target.value)
                            }
                            style={{ padding: "6px 8px", fontSize: 12 }}
                          />
                          {hasBonif && (
                            <Inp
                              value={i.bonif}
                              onChange={(e: any) =>
                                updItem(i.id, "bonif", e.target.value)
                              }
                              style={{ padding: "6px 8px", fontSize: 12 }}
                            />
                          )}
                          <div
                            style={{
                              textAlign: "right",
                              fontWeight: 700,
                              color: t.accent,
                              fontSize: 12,
                            }}
                          >
                            {fmtMoney(calcItem(i))}
                          </div>
                          <button
                            onClick={() => removeItem(i.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: t.muted,
                              fontSize: 16,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 6,
                  paddingLeft: 4,
                }}
              >
                <button
                  onClick={addItem}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    color: t.accent,
                    fontWeight: 600,
                    background: "none",
                    border: `1px dashed ${t.accent}44`,
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  + Línea
                </button>
                <button
                  onClick={() => {
                    setBusqArt("");
                    setBuscadorArt(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    color: t.text,
                    fontWeight: 600,
                    background: t.surf,
                    border: `1px solid ${t.border}`,
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  <Ic n="eye" s={12} /> Buscar
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 12,
            }}
          >
            <div style={{ width: 210 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: t.sub,
                  marginBottom: 4,
                }}
              >
                <span>Subtotal</span>
                <span>{fmtMoney(subtotal)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 12, color: t.sub }}>Desc. %</span>
                <InpMoney
                  value={descGlobal}
                  onChange={(e: any) => setDescGlobal(e.target.value)}
                  style={{ width: 65, padding: "4px 8px", fontSize: 12 }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: `2px solid ${t.border}`,
                  paddingTop: 6,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                <span style={{ color: t.text }}>TOTAL</span>
                <span style={{ color: t.accent }}>{fmtMoney(total)}</span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 24,
              alignItems: "center",
            }}
          >
            {editando &&
            (!user ||
              user.rol === "maestro" ||
              user.rol === "administrador") ? (
              showPassBorrar ? (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    flex: 3,
                  }}
                >
                  <Inp
                    type="password"
                    value={passBorrar}
                    onChange={(e: any) => setPassBorrar(e.target.value)}
                    placeholder="Tu clave de acceso"
                    style={{ width: 130 }}
                    autoFocus
                    onKeyDown={(e: any) => {
                      if (e.key === "Enter") {
                        if (passBorrar === claveMaestra) eliminarFactura();
                        else alert("Clave incorrecta");
                      }
                    }}
                  />
                  <Btn
                    v="danger"
                    onClick={() => {
                      if (passBorrar === claveMaestra) eliminarFactura();
                      else alert("Clave incorrecta");
                    }}
                  >
                    Confirmar
                  </Btn>
                  <Btn v="ghost" onClick={() => setShowPassBorrar(false)}>
                    ✕
                  </Btn>
                </div>
              ) : (
                <Btn
                  v="danger"
                  onClick={() => setShowPassBorrar(true)}
                  style={{ flex: 1 }}
                  type="button"
                >
                  <Ic n="trash" s={14} /> Eliminar
                </Btn>
              )
            ) : null}
            <Btn
              v="ghost"
              onClick={handleClose}
              style={{ flex: 1 }}
              disabled={procesando}
            >
              Cancelar
            </Btn>
            <Btn
              onClick={confirmar}
              style={{ flex: 2 }}
              disabled={noTieneLista || procesando}
            >
              {editando ? "Guardar Cambios" : "Emitir Comprobante"}
            </Btn>
          </div>

          {modalLimite && (
            <OverlaySheet
              open={true}
              onClose={() => setModalLimite(false)}
              title="Crédito Excedido"
            >
              <div style={{ padding: 20, textAlign: "center" }}>
                <p style={{ marginBottom: 20 }}>
                  El cliente ha superado su límite de crédito. ¿Desea continuar
                  de todos modos?
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn
                    v="ghost"
                    onClick={() => setModalLimite(false)}
                    full
                    disabled={procesando}
                  >
                    Cancelar
                  </Btn>
                  <Btn
                    onClick={() => {
                      setModalLimite(false);
                      emitirFactura();
                    }}
                    full
                    disabled={procesando}
                  >
                    Facturar Igual
                  </Btn>
                </div>
              </div>
            </OverlaySheet>
          )}
          {modalSepararFisico && (
            <OverlaySheet
              open={true}
              onClose={() => setModalSepararFisico(false)}
              title="Separar Fisico"
            >
              <div style={{ padding: 20, textAlign: "center" }}>
                <p style={{ marginBottom: 20 }}>
                  Este comprobante contiene artículos que deben facturarse a
                  nombre del cliente físico. ¿Desea separar el comprobante
                  automáticamente?
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn
                    v="ghost"
                    onClick={() => {
                      setModalSepararFisico(false);
                      emitirFactura(false);
                    }}
                    full
                    disabled={procesando}
                  >
                    No, todo junto
                  </Btn>
                  <Btn
                    onClick={() => {
                      setModalSepararFisico(false);
                      emitirFactura(true);
                    }}
                    full
                    disabled={procesando}
                  >
                    Sí, separar
                  </Btn>
                </div>
              </div>
            </OverlaySheet>
          )}
        </div>
      </OverlaySheet>

      {showSuccess && (
        <Modal open={true} onClose={() => { setShowSuccess(false); onClose(); resetForm(); }} title="¡Venta Registrada!">
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 8 }}>¡Comprobante guardado correctamente!</p>
            <p style={{ fontSize: 13, color: t.sub, marginBottom: 24 }}>La operación se ha registrado en la cuenta del cliente.</p>
            <Btn onClick={() => { setShowSuccess(false); onClose(); resetForm(); }} full>Cerrar</Btn>
          </div>
        </Modal>
      )}

      {buscadorArt && (
        <FacturaBuscadorArticulos
          articulos={articulos}
          busqArt={busqArt}
          setBusqArt={setBusqArt}
          setBuscadorArt={setBuscadorArt}
          setItems={setItems}
          precioParaClienteLocal={precioParaClienteLocal}
        />
      )}
    </>
  );
}
