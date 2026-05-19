import React from "react";
import { useApp } from "../../../context/AppContext";
import { Ic } from "../../common/UIBase";
import { fmtMoney, fmtNum } from "../../../lib/utils";

export default function FacturaBuscadorArticulos({
  articulos,
  busqArt,
  setBusqArt,
  setBuscadorArt,
  setItems,
  precioParaClienteLocal,
}: any) {
  const { t } = useApp();

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") setBuscadorArt(false);
      }}
      tabIndex={-1}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000cc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: 20,
      }}
      onClick={() => setBuscadorArt(false)}
    >
      <div
        style={{
          background: t.surf,
          borderRadius: 16,
          padding: 24,
          width: 680,
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${t.border}`,
          boxShadow: t.shadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
            Buscar artículo
          </div>
          <button
            onClick={() => setBuscadorArt(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: t.sub,
              padding: 4,
            }}
          >
            <Ic n="close" s={18} />
          </button>
        </div>
        <input
          ref={(el) => el && setTimeout(() => el.focus(), 50)}
          value={busqArt}
          onChange={(e) => setBusqArt(e.target.value)}
          placeholder="Buscar por nombre o código..."
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${t.accent}`,
            background: t.surf2,
            color: t.text,
            fontSize: 13,
            fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif",
            marginBottom: 12,
            outline: "none",
          }}
        />
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
          }}
        >
          {(articulos || [])
            .filter((a: any) => (a.estado || "activo") === "activo")
            .filter((a: any) => {
              if (!busqArt.trim()) return true;
              const q = busqArt.trim().toLowerCase();
              return (
                a.nombre.toLowerCase().includes(q) ||
                (a.codigo && String(a.codigo).toLowerCase().includes(q))
              );
            })
            .map((a: any, idx: number) => {
              const precio = precioParaClienteLocal(a);
              return (
                <div
                  key={a.id}
                  onClick={() => {
                    setItems((prev: any[]) => {
                      const vacia = prev.find((x) => !x.nombre && !x.artId);
                      if (vacia)
                        return prev.map((x) =>
                          x.id === vacia.id
                            ? {
                                ...x,
                                codigo: a.codigo || "",
                                nombre: a.nombre,
                                precio: precio != null ? String(precio) : "",
                                artId: a.id,
                              }
                            : x,
                        );
                      return [
                        ...prev,
                        {
                          id: Date.now(),
                          codigo: a.codigo || "",
                          nombre: a.nombre,
                          cantidad: "1",
                          precio: precio ? String(precio) : "",
                          bonif: "",
                          artId: a.id,
                        },
                      ];
                    });
                    setBuscadorArt(false);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 1fr 90px 60px 80px",
                    padding: "10px 14px",
                    borderBottom: `1px solid ${t.border}`,
                    cursor: "pointer",
                    background: idx % 2 === 0 ? t.surf : t.surf2,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = t.accentBg)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      idx % 2 === 0 ? t.surf : t.surf2)
                  }
                >
                  <div
                    style={{
                      fontFamily: "'Consolas','Courier New',monospace",
                      fontSize: 11,
                      color: t.accent,
                    }}
                  >
                    {a.codigo || "—"}
                  </div>
                  <div
                    style={{ fontWeight: 600, fontSize: 13, color: t.text }}
                  >
                    {a.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: t.sub }}>
                    {typeof a.familia === "string"
                      ? a.familia
                      : a.familia?.nombre || "—"}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Consolas','Courier New',monospace",
                      fontSize: 12,
                      color: a.stock > 0 ? t.green : t.red,
                      textAlign: "right",
                    }}
                  >
                    {fmtNum(a.stock || 0)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Consolas','Courier New',monospace",
                      fontSize: 12,
                      color: t.accent,
                      textAlign: "right",
                    }}
                  >
                    {precio ? fmtMoney(precio) : "—"}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
