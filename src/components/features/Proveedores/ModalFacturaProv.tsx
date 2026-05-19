import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../../context/AppContext";
import {
  OverlaySheet,
  Fld,
  Inp,
  Sel,
  Btn,
  Ic,
  InpMoney,
  BtnEliminarConClave,
} from "../../common/UIBase";
import {
  fmtMoney,
  parseMoney,
  getToday,
  registrarMovimientoKardex,
} from "../../../lib/utils";
import { TIPOS_KARDEX } from "../../../constants";

const today = getToday();

export function ModalFacturaProv({
  open,
  onClose,
  proveedor,
  factProv,
  setFactProv,
  articulos,
  setArticulos,
  user,
  cloudSync,
}: any) {
  const { t } = useApp();
  const editando = proveedor?._editando;
  const [letra, setLetra] = useState("A");
  const [condPago, setCondPago] = useState("30 Días");
  const [fecha, setFecha] = useState(today);
  const [items, setItems] = useState<any[]>([
    { id: 1, codigo: "", nombre: "", cantidad: "1", precio: "", bonif: "" },
  ]);
  const [descGlobal, setDescGlobal] = useState("");
  const [obs, setObs] = useState("");
  const [totalManual, setTotalManual] = useState("");
  const [tipoComp, setTipoComp] = useState("factura");
  const [modoCarga, setModoCarga] = useState("articulos"); // "articulos" | "importe"
  const [percIVA, setPercIVA] = useState("");
  const [percIIBB, setPercIIBB] = useState("");
  const [impInternos, setImpInternos] = useState("");
  const [otrosImp, setOtrosImp] = useState("");
  const [exento, setExento] = useState("");

  useEffect(() => {
    if (open && proveedor) {
      if (editando) {
        setTipoComp(editando.tipo || "factura");
        setLetra(editando.letra || "A");
        setCondPago(editando.condPago || "30 Días");
        setFecha(editando.fecha || today);
        setObs(editando.obs || "");
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
          setItems([
            {
              id: 1,
              codigo: "",
              nombre: "",
              cantidad: "1",
              precio: "",
              bonif: "",
            },
          ]);
        }
        setTotalManual(String(editando.total || ""));
        setModoCarga(
          editando.modoCarga ||
            (editando.items?.length > 0 ? "articulos" : "importe"),
        );
        setPercIVA(String(editando.percIVA || ""));
        setPercIIBB(String(editando.percIIBB || ""));
        setImpInternos(String(editando.impInternos || ""));
        setOtrosImp(String(editando.otrosImp || ""));
        setExento(String(editando.exento || ""));
      } else {
        setTipoComp(proveedor._tipoComp || "factura");
        setLetra("A");
        setCondPago("30 Días");
        setFecha(today);
        setObs("");
        setTotalManual("");
        setModoCarga("articulos");
        setPercIVA("");
        setPercIIBB("");
        setImpInternos("");
        setOtrosImp("");
        setExento("");
        setItems([
          {
            id: 1,
            codigo: "",
            nombre: "",
            cantidad: "1",
            precio: "",
            bonif: "",
          },
        ]);
      }
    }
  }, [open, proveedor, editando]);

  const handleCloseProv = () => {
    onClose();
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
  const updItem = (id: number, f: string, v: string) =>
    setItems(items.map((i) => (i.id === id ? { ...i, [f]: v } : i)));

  const parseCantP = (v: any) => {
    if (v === null || v === undefined || v === "") return 0;
    const s = String(v).trim();
    if (s.includes(","))
      return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    return parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  };

  const calcItemP = (i: any) => {
    const c = parseCantP(i.cantidad);
    const p = parseMoney(i.precio);
    const b = parseFloat(i.bonif) || 0;
    return c * p * (1 - b / 100);
  };

  const subtotal = items.reduce((s, i) => s + calcItemP(i), 0);
  const totalArticulos = subtotal * (1 - (parseFloat(descGlobal) || 0) / 100);

  const vPercIVA = parseMoney(percIVA);
  const vPercIIBB = parseMoney(percIIBB);
  const vImpInternos = parseMoney(impInternos);
  const vOtrosImp = parseMoney(otrosImp);
  const vExento = parseMoney(exento);

  const totalCalculado =
    (modoCarga === "articulos" ? totalArticulos : 0) +
    vPercIVA +
    vPercIIBB +
    vImpInternos +
    vOtrosImp +
    vExento;
  const total = totalManual !== "" ? parseMoney(totalManual) : totalCalculado;

  const buscarArticuloProv = (itemId: number, cod: string) => {
    if (!cod || !cod.trim()) return;
    const art = (articulos || []).find(
      (a: any) =>
        String(a.codigo || "").toLowerCase() === cod.trim().toLowerCase(),
    );
    if (art) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                codigo: art.codigo || i.codigo,
                nombre: art.nombre,
                precio: String(art.costo || ""),
                artId: art.id,
              }
            : i,
        ),
      );
    }
  };

  const eliminar = async () => {
    if (!editando) return;

    // Revert items from stock/kardex
    if (setArticulos && editando.items?.length) {
      const batchOps: any[] = [];
      const modificadosArray: any[] = [];

      const nextArticulos = articulos.map((art: any) => {
        const oldItems = editando.items.filter(
          (i: any) =>
            i.artId === art.id || (i.codigo && i.codigo === art.codigo),
        );
        if (!oldItems.length) return art;

        let stockTemporal = art.stock || 0;
        let costoPond = art.costo || 0;
        const esNC = editando.tipo === "nc";

        oldItems.forEach((oldIt: any) => {
          const oldCant = parseCantP(oldIt.cantidad);
          stockTemporal = esNC
            ? stockTemporal + oldCant
            : stockTemporal - oldCant;

          registrarMovimientoKardex({
            artId: art.id,
            tipo: TIPOS_KARDEX.SALIDA_AJUSTE,
            cantidad: oldCant,
            costoUnitario: costoPond,
            stockAnterior: esNC
              ? stockTemporal - oldCant
              : stockTemporal + oldCant,
            stockResultante: stockTemporal,
            documentoId: editando.id,
            documentoNumero: editando.numero,
            documentoTipo: `eliminacion_${editando.tipo || "compra"}`,
            observacion: `Eliminación comprobante de proveedor`,
          }).then((m) => {
            if (m && cloudSync?.saveToCloud) cloudSync.saveToCloud("kardex", m);
          });
        });

        const artModificado = { ...art, stock: stockTemporal };
        modificadosArray.push(artModificado);
        return artModificado;
      });

      setArticulos(nextArticulos);
      if (cloudSync?.saveBatchToCloud) {
        cloudSync.saveBatchToCloud("articulos", modificadosArray);
      }
    }

    setFactProv((prev: any[]) => prev.filter((f) => f.id !== editando.id));
    if (cloudSync?.deleteFromCloud) {
      cloudSync.deleteFromCloud("factProv", String(editando.id));
    }

    onClose();
  };

  const guardar = async () => {
    // Validamos que haya algo cargado. Si es modo artículos, al menos un item. Si es modo importe, al menos un total.
    if (
      modoCarga === "articulos" &&
      !items.some((i) => i.nombre && parseCantP(i.cantidad) > 0)
    )
      return;
    if (modoCarga === "importe" && total <= 0) return;

    const itemsFiltrados = items
      .filter((i) => i.nombre && parseCantP(i.cantidad) > 0)
      .map((i) => {
        const art = articulos?.find(
          (a: any) =>
            (i.codigo && a.codigo === i.codigo) || a.nombre === i.nombre,
        );
        return art ? { ...i, artId: art.id } : i;
      });

    const esNC = tipoComp === "nc";
    const numeroComp = editando ? editando.numero : `COMP-${Date.now()}`;
    const cbteId = editando
      ? editando.id
      : Date.now() + "_" + Math.random().toString(36).substr(2, 9);

    const nuevaFac = {
      id: cbteId,
      proveedorId: proveedor.id,
      numero: numeroComp,
      tipo: tipoComp,
      letra,
      total: total,
      fecha,
      condPago,
      obs,
      modoCarga,
      percIVA: vPercIVA,
      percIIBB: vPercIIBB,
      impInternos: vImpInternos,
      otrosImp: vOtrosImp,
      exento: vExento,
      items: modoCarga === "articulos" ? itemsFiltrados : [],
    };

    if (editando) {
      setFactProv((prev: any[]) =>
        prev.map((f) => (f.id === cbteId ? nuevaFac : f)),
      );
    } else {
      setFactProv((prev: any[]) => [nuevaFac, ...prev]);
    }

    if (
      setArticulos &&
      (itemsFiltrados.length || (editando && editando.items?.length))
    ) {
      const nuevosArticulos = articulos.map((art: any) => {
        let stockTemporal = art.stock || 0;
        let costoPond = art.costo || 0;
        let changed = false;

        // 1. Revertir el stock original si estábamos editando
        if (editando && editando.items) {
          const oldItems = editando.items.filter(
            (i: any) =>
              i.artId === art.id || (i.codigo && i.codigo === art.codigo),
          );
          oldItems.forEach((oldIt: any) => {
            const oldCant = parseCantP(oldIt.cantidad);
            const esNCOld = editando.tipo === "nc";
            // Reversión: si era compra original (aumenta stock), ahora disminuye
            stockTemporal = esNCOld
              ? stockTemporal + oldCant
              : stockTemporal - oldCant;

            registrarMovimientoKardex({
              artId: art.id,
              tipo: TIPOS_KARDEX.SALIDA_AJUSTE,
              cantidad: oldCant,
              costoUnitario: costoPond,
              stockAnterior: esNCOld
                ? stockTemporal - oldCant
                : stockTemporal + oldCant,
              stockResultante: stockTemporal,
              fecha: editando.fecha || today,
              documentoTipo: "ajuste",
              documentoNumero: `REVERT-${editando.numero}`,
              usuario: user?.nombre || "Sistema",
              observacion: `Reversión por edición ${editando.numero}`,
            }).then((m) => {
              if (m && cloudSync?.saveToCloud)
                cloudSync.saveToCloud("kardex", m);
            });
            changed = true;
          });
        }

        // 2. Aplicar el nuevo stock
        const it = itemsFiltrados.find(
          (i) => i.artId === art.id || (i.codigo && i.codigo === art.codigo),
        );
        if (it) {
          const cantNueva = parseCantP(it.cantidad);
          const costoNuevo = parseMoney(it.precio);

          const stockAct = stockTemporal;
          // Permitimos saldo negativo por eso quitamos Math.max(0)
          const stockResultante = esNC
            ? stockAct - cantNueva
            : stockAct + cantNueva;

          if (!esNC && stockAct + cantNueva > 0) {
            // PPP (Precio Promedio Ponderado recalculado)
            const valorActual = stockAct * costoPond;
            const valorNuevo = cantNueva * costoNuevo;
            costoPond =
              Math.round(
                ((valorActual + valorNuevo) / (stockAct + cantNueva)) * 100,
              ) / 100;
          }

          registrarMovimientoKardex({
            artId: art.id,
            tipo: esNC
              ? TIPOS_KARDEX.SALIDA_AJUSTE
              : TIPOS_KARDEX.ENTRADA_COMPRA,
            cantidad: cantNueva,
            costoUnitario: costoNuevo,
            ppp: costoPond,
            stockAnterior: stockAct,
            stockResultante,
            fecha,
            documentoTipo: esNC ? "nc_proveedor" : "compra",
            documentoNumero: numeroComp,
            usuario: user?.nombre || "Sistema",
            observacion: esNC
              ? `NC Prov: ${proveedor.nombre}`
              : `Compra Prov: ${proveedor.nombre}`,
          }).then((m) => {
            if (m && cloudSync?.saveToCloud) cloudSync.saveToCloud("kardex", m);
          });

          stockTemporal = stockResultante;
          changed = true;
        }

        if (changed || stockTemporal !== art.stock || costoPond !== art.costo) {
          return { ...art, stock: stockTemporal, costo: costoPond };
        }
        return art;
      });
      setArticulos(nuevosArticulos);

      if (cloudSync?.executeCloudBatch) {
        const batchOps: any[] = [];
        batchOps.push({
          type: "set",
          collection: "factProv",
          id: String(nuevaFac.id),
          data: nuevaFac,
        });

        const artModificados = nuevosArticulos.filter(
          (a: any, i: number) => a !== articulos[i],
        );
        artModificados.forEach((a: any) =>
          batchOps.push({
            type: "set",
            collection: "articulos",
            id: String(a.id),
            data: a,
          }),
        );

        cloudSync.executeCloudBatch(batchOps);
      } else if (cloudSync?.saveToCloud) {
        cloudSync.saveToCloud("factProv", nuevaFac);
      }
    } else {
      if (cloudSync?.saveToCloud) {
        cloudSync.saveToCloud("factProv", nuevaFac);
      }
    }
    handleCloseProv();
  };

  if (!open || !proveedor) return null;

  return (
    <OverlaySheet
      open={open}
      onClose={handleCloseProv}
      title={
        editando
          ? `Editar ${tipoComp.toUpperCase()}`
          : `Nueva ${tipoComp.toUpperCase()}`
      }
      sub={proveedor.nombre}
      width="860px"
    >
      <div style={{ paddingBottom: 24 }}>
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
            {["A", "B", "C", "X", "M"].map((l) => (
              <option key={l}>{l}</option>
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
            {[
              "Al día",
              "Contado",
              "7 Días",
              "15 Días",
              "30 Días",
              "60 Días",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Sel>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            background: t.surf2,
            padding: 8,
            borderRadius: 10,
          }}
        >
          <button
            onClick={() => setModoCarga("articulos")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              border: "none",
              background: modoCarga === "articulos" ? t.accent : "transparent",
              color: modoCarga === "articulos" ? "#fff" : t.sub,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Ic n="list" s={14} /> El comprobante contiene Artículos
          </button>
          <button
            onClick={() => setModoCarga("importe")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              border: "none",
              background: modoCarga === "importe" ? t.accent : "transparent",
              color: modoCarga === "importe" ? "#fff" : t.sub,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Ic n="money" s={14} /> El comprobante NO contiene Artículos
          </button>
        </div>

        {modoCarga === "articulos" ? (
          <div
            style={{
              background: t.surf2,
              borderRadius: 12,
              padding: "16px 18px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr 80px 140px 70px 130px 40px",
                gap: 10,
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: `2px solid ${t.border}`,
              }}
            >
              {[
                "Cód",
                "Descripción / Artículo",
                "Cant",
                "Costo Unit",
                "% Bonif",
                "Total Item",
                "",
              ].map((h) => (
                <span
                  key={h}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.sub,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
            {items.map((i, idx) => (
              <div
                key={i.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 80px 140px 70px 130px 40px",
                  gap: 10,
                  marginBottom: 8,
                  alignItems: "center",
                }}
              >
                <Inp
                  value={i.codigo}
                  onChange={(e: any) => updItem(i.id, "codigo", e.target.value)}
                  onBlur={() => buscarArticuloProv(i.id, i.codigo)}
                  placeholder="Cód"
                  style={{
                    padding: "8px 10px",
                    fontSize: 14,
                    border: `1px solid ${t.border}aa`,
                  }}
                />
                <Inp
                  value={i.nombre}
                  onChange={(e: any) => updItem(i.id, "nombre", e.target.value)}
                  placeholder="Nombre del artículo o servicio..."
                  style={{
                    padding: "8px 10px",
                    fontSize: 14,
                    border: `1px solid ${t.border}aa`,
                  }}
                />
                <Inp
                  value={i.cantidad}
                  onChange={(e: any) =>
                    updItem(i.id, "cantidad", e.target.value)
                  }
                  style={{
                    textAlign: "right",
                    padding: "8px 10px",
                    fontSize: 14,
                    border: `1px solid ${t.border}aa`,
                  }}
                />
                <InpMoney
                  value={i.precio}
                  onChange={(e: any) => updItem(i.id, "precio", e.target.value)}
                  style={{
                    padding: "8px 10px",
                    fontSize: 14,
                    border: `1px solid ${t.border}aa`,
                  }}
                />
                <Inp
                  value={i.bonif}
                  onChange={(e: any) => updItem(i.id, "bonif", e.target.value)}
                  placeholder="%"
                  style={{
                    textAlign: "center",
                    padding: "8px 4px",
                    fontSize: 14,
                    border: `1px solid ${t.border}aa`,
                  }}
                />
                <div
                  style={{
                    textAlign: "right",
                    fontWeight: 800,
                    color: t.accent,
                    fontSize: 15,
                  }}
                >
                  {fmtMoney(calcItemP(i))}
                </div>
                <button
                  onClick={() => removeItem(i.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: t.muted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ic n="trash" s={16} />
                </button>
              </div>
            ))}
            <Btn
              v="ghost"
              onClick={addItem}
              style={{ marginTop: 12, background: t.surf }}
            >
              <Ic n="plus" s={14} /> Agregar línea de artículo
            </Btn>
          </div>
        ) : (
          <div
            style={{
              background: t.surf2,
              borderRadius: 12,
              padding: "20px",
              marginBottom: 16,
            }}
          >
            <Fld label="Concepto de Gasto / Descripción">
              <Inp
                value={obs}
                onChange={(e: any) => setObs(e.target.value)}
                placeholder="Ej: Compra de insumos de limpieza, materiales, etc."
                style={{ padding: "12px", fontSize: 15 }}
              />
            </Fld>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontWeight: 600, color: t.sub }}>
                Importe Neto Gravado:
              </span>
              <div style={{ width: 180 }}>
                <InpMoney
                  value={totalManual}
                  onChange={(e: any) => setTotalManual(e.target.value)}
                  placeholder="$ 0,00"
                  style={{ fontSize: 18, fontWeight: 700 }}
                />
              </div>
            </div>
          </div>
        )}

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Fld label="Percepción IVA">
              <InpMoney
                value={percIVA}
                onChange={(e: any) => setPercIVA(e.target.value)}
              />
            </Fld>
            <Fld label="Percepción IIBB">
              <InpMoney
                value={percIIBB}
                onChange={(e: any) => setPercIIBB(e.target.value)}
              />
            </Fld>
            <Fld label="Impuestos Internos">
              <InpMoney
                value={impInternos}
                onChange={(e: any) => setImpInternos(e.target.value)}
              />
            </Fld>
            <Fld label="Importe Exento / Otros">
              <InpMoney
                value={exento}
                onChange={(e: any) => setExento(e.target.value)}
              />
            </Fld>
            <div style={{ gridColumn: "span 2" }}>
              <Fld label="Observaciones">
                <Inp
                  value={obs}
                  onChange={(e: any) => setObs(e.target.value)}
                  placeholder="Agregue una nota interna..."
                />
              </Fld>
            </div>
          </div>

          <div
            style={{
              background: t.surf,
              borderRadius: 12,
              padding: 16,
              border: `1px solid ${t.border}`,
            }}
          >
            {modoCarga === "articulos" && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    color: t.sub,
                    fontSize: 13,
                  }}
                >
                  <span>Subtotal Artículos</span>
                  <span style={{ fontWeight: 600 }}>
                    {fmtMoney(totalArticulos)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 13, color: t.sub }}>
                    Desc. Global %
                  </span>
                  <div style={{ width: 80 }}>
                    <Inp
                      value={descGlobal}
                      onChange={(e: any) => setDescGlobal(e.target.value)}
                      style={{ textAlign: "right", padding: "6px 8px" }}
                    />
                  </div>
                </div>
              </>
            )}

            {(vPercIVA > 0 ||
              vPercIIBB > 0 ||
              vImpInternos > 0 ||
              vExento > 0) && (
              <div
                style={{
                  borderTop: `1px dashed ${t.border}`,
                  paddingTop: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.muted,
                    marginBottom: 4,
                    textTransform: "uppercase",
                  }}
                >
                  Impuestos y Otros
                </div>
                {vPercIVA > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: t.sub,
                    }}
                  >
                    <span>Perc. IVA</span>
                    <span>{fmtMoney(vPercIVA)}</span>
                  </div>
                )}
                {vPercIIBB > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: t.sub,
                    }}
                  >
                    <span>Perc. IIBB</span>
                    <span>{fmtMoney(vPercIIBB)}</span>
                  </div>
                )}
                {vImpInternos > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: t.sub,
                    }}
                  >
                    <span>Imp. Internos</span>
                    <span>{fmtMoney(vImpInternos)}</span>
                  </div>
                )}
                {vOtrosImp > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: t.sub,
                    }}
                  >
                    <span>Otros</span>
                    <span>{fmtMoney(vOtrosImp)}</span>
                  </div>
                )}
                {vExento > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: t.sub,
                    }}
                  >
                    <span>Exento</span>
                    <span>{fmtMoney(vExento)}</span>
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 24,
                fontWeight: 800,
                borderTop: `2px solid ${t.border}`,
                paddingTop: 12,
                color: t.accent,
              }}
            >
              <span>TOTAL</span>
              <span>{fmtMoney(total)}</span>
            </div>

            <div style={{ marginTop: 16 }}>
              <Fld label="Ajuste Manual Total (Opcional)">
                <InpMoney
                  value={totalManual}
                  onChange={(e: any) => setTotalManual(e.target.value)}
                  placeholder="Ignorar calculo y usar este total"
                />
              </Fld>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, display: "flex", gap: 10 }}>
          {editando && (
            <BtnEliminarConClave
              onConfirm={eliminar}
              label="Eliminar Factura"
            />
          )}
          <Btn v="ghost" onClick={handleCloseProv} style={{ flex: 1 }}>
            Cancelar
          </Btn>
          <Btn onClick={guardar} style={{ flex: 2 }}>
            {editando ? "Guardar Cambios" : "Cargar Comprobante"}
          </Btn>
        </div>
      </div>
    </OverlaySheet>
  );
}
