import React, { useState } from "react";
import { pb } from "../../lib/pocketbase";
import { useApp } from "../../context/AppContext";
import { useData } from "../../context/DataContext";
import { Ic, Avatar } from "../common/UIBase";

interface AppShellProps {
  user: any;
  currentSec: string;
  setSec: (s: string) => void;
  children: React.ReactNode;
  onLogout: () => void;
}

export default function AppShell({
  user,
  currentSec,
  setSec,
  children,
  onLogout,
}: AppShellProps) {
  const { t, tema, setTema, isDark } = useApp();
  const {
    menuOrder,
    setMenuOrder,
    clientes,
    articulos,
    proveedores,
    cloudSync,
  } = useData();
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [cmdBusq, setCmdBusq] = useState("");
  const [cmdAbierto, setCmdAbierto] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleK = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setCmdAbierto(true);
      }
    };
    window.addEventListener("keydown", handleK);
    return () => window.removeEventListener("keydown", handleK);
  }, []);

  React.useEffect(() => {
    // Update browser theme-color meta tag dynamically based on current theme background
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", t.bg);
    }
  }, [t.bg]);

  const handleDragStart = (e: React.DragEvent, item: any) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const dragIndex = menuOrder.findIndex((i: any) => i.id === draggedItem.id);
    if (dragIndex === index) return;

    const newOrder = [...menuOrder];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setMenuOrder(newOrder);
  };

  const handleDragEnd = async () => {
    if (!draggedItem) return;
    setDraggedItem(null);
    
    // Obtenemos el ID real de la sesión (PocketBase), que es el que usa DataContext
    const pbId = pb?.authStore?.model?.id || user?.id || 'default';

    // Guardar en localStorage inmediatamente con prefijo de usuario
    const userKey = `clik-menuOrder-${pbId}`;
    localStorage.setItem(userKey, JSON.stringify(menuOrder));
    // También el genérico para compatibilidad
    localStorage.setItem("clik-menuOrder", JSON.stringify(menuOrder));

    // Persistir el orden en la nube cuando termina el drag
    if (cloudSync?.executeCloudBatch) {
      const ops = menuOrder.map((item: any, idx: number) => ({
        type: "set",
        collection: "menuOrder",
        // Usamos el ID auth de PB para asegurar persistencia cruzada en sesiones
        id: `${item.id}_${pbId}`,
        data: { ...item, orden: idx } // removemos userId para que DataContext le asigne automáticamente pb.authStore.model.id
      }));
      await cloudSync.executeCloudBatch(ops);
    }
  };

  const normalizar = (str: string) =>
    str
      ? str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      : "";

  const handleSelectRes = (secId: string, searchStr?: string) => {
    setSec(secId);
    setCmdBusq("");
    setCmdAbierto(false);
    if (searchStr) {
      setTimeout(
        () =>
          window.dispatchEvent(
            new CustomEvent("search-element", { detail: searchStr }),
          ),
        100,
      );
    }
  };

  const resModulos = (menuOrder || []).filter((i: any) =>
    i && normalizar(i.label).includes(normalizar(cmdBusq)),
  );
  const resClientes = (clientes || [])
    .filter((c: any) => c && normalizar(c.nombre).includes(normalizar(cmdBusq)))
    .slice(0, 5);
  const resProveedores = (proveedores || [])
    .filter((p: any) => p && normalizar(p.nombre).includes(normalizar(cmdBusq)))
    .slice(0, 5);
  const resArticulos = (articulos || [])
    .filter(
      (a: any) =>
        a && (normalizar(a.nombre || "").includes(normalizar(cmdBusq)) ||
        (a.codigo && String(a.codigo).includes(cmdBusq))),
    )
    .slice(0, 5);

  const esMaestro = user?.rol === "maestro";
  const visibleMenu = (menuOrder || []).filter((item: any) => {
    if (item.id === "config") return false; // Modulo de ajustes movido al header
    if (esMaestro) return true;
    if (["dashboard", "clientes", "proveedores", "articulos", "whatsapp"].includes(item.id))
      return true;
    if (item.id === "caja" && user?.permisos?.caja) return true;
    if (item.id === "stats" && user?.permisos?.estadisticas) return true;
    return false;
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
      }}
    >
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "58px",
          background: t.bg,
          borderBottom: `1px solid ${t.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          zIndex: 1000,
          boxShadow: t.shadow,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 26,
                lineHeight: "40px",
                color: t.accent,
                letterSpacing: "-0.5px",
                fontWeight: 800,
                marginTop: -2
              }}
            >
              Cli<span style={{ color: t.text }}>k</span>
            </span>
          </div>
          <nav style={{ display: "flex", gap: 14, height: "58px", alignItems: "center" }}>
            {visibleMenu.map((item: any, index: number) => {
              const active = currentSec === item.id;
              const isDragging = draggedItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSec(item.id)}
                  title={item.label}
                  className="group relative flex items-center justify-center border-none cursor-grab"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    color: active ? t.accent : t.sub,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    opacity: isDragging ? 0.4 : 1,
                    background: isDragging ? t.accentBg : "transparent",
                    transform: active ? "scale(1.15)" : "scale(1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.15)";
                    if (!active) e.currentTarget.style.color = t.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = active ? "scale(1.15)" : "scale(1)";
                    if (!active) e.currentTarget.style.color = t.sub;
                  }}
                >
                  <Ic n={item.icon} s={24} />
                  {active && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 2,
                        left: "50%",
                        marginLeft: -2.5,
                        width: 5,
                        height: 5,
                        background: t.accent,
                        borderRadius: "50%",
                        boxShadow: "none"
                      }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: t.muted,
              }}
            >
              <Ic n="search" s={14} />
            </span>
            <input
              ref={inputRef}
              placeholder="Buscar..."
              value={cmdBusq}
              onChange={(e) => setCmdBusq(e.target.value)}
              onFocus={() => setCmdAbierto(true)}
              onBlur={() => setTimeout(() => setCmdAbierto(false), 200)}
              style={{
                width: 240,
                background: t.surf,
                border: `1px solid ${t.border}`,
                borderRadius: "8px",
                padding: "8px 12px 8px 34px",
                fontSize: "13px",
                outline: "none",
                color: t.text,
              }}
            />
            {cmdAbierto && cmdBusq && (
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  left: 0,
                  right: 0,
                  background: t.surf,
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  boxShadow: t.shadow,
                  zIndex: 1100,
                  overflow: "hidden",
                  maxHeight: "400px",
                  overflowY: "auto",
                }}
              >
                {resModulos.length > 0 && (
                  <div
                    style={{
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: t.sub,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      background: t.surf2,
                    }}
                  >
                    Módulos
                  </div>
                )}
                {resModulos.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectRes(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: t.text,
                      textAlign: "left",
                    }}
                  >
                    <Ic n={item.icon} s={14} /> <span>{item.label}</span>
                  </button>
                ))}

                {resClientes.length > 0 && (
                  <div
                    style={{
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: t.sub,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      background: t.surf2,
                    }}
                  >
                    Clientes
                  </div>
                )}
                {resClientes.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectRes("clientes", c.nombre)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 14px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: t.text,
                      textAlign: "left",
                    }}
                  >
                    <Avatar nombre={c.nombre} size={20} />{" "}
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.nombre}
                    </span>
                  </button>
                ))}

                {resProveedores.length > 0 && (
                  <div
                    style={{
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: t.sub,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      background: t.surf2,
                    }}
                  >
                    Proveedores
                  </div>
                )}
                {resProveedores.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectRes("proveedores", p.nombre)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 14px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: t.text,
                      textAlign: "left",
                    }}
                  >
                    <Avatar nombre={p.nombre} size={20} />{" "}
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.nombre}
                    </span>
                  </button>
                ))}

                {resArticulos.length > 0 && (
                  <div
                    style={{
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: t.sub,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      background: t.surf2,
                    }}
                  >
                    Artículos
                  </div>
                )}
                {resArticulos.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() =>
                      handleSelectRes("articulos", a.codigo || a.nombre)
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 14px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: t.text,
                      textAlign: "left",
                    }}
                  >
                    <Ic n="box" s={14} />{" "}
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {a.nombre}
                    </span>{" "}
                    {a.codigo && (
                      <span style={{ color: t.muted, fontSize: 11 }}>
                        {a.codigo}
                      </span>
                    )}
                  </button>
                ))}

                {resModulos.length === 0 &&
                  resClientes.length === 0 &&
                  resProveedores.length === 0 &&
                  resArticulos.length === 0 && (
                    <div
                      style={{
                        padding: "12px",
                        textAlign: "center",
                        fontSize: 13,
                        color: t.muted,
                      }}
                    >
                      No se encontraron resultados para "{cmdBusq}"
                    </div>
                  )}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderLeft: `1px solid ${t.border}`,
              paddingLeft: 20,
            }}
          >
            <button
              onClick={() => cloudSync.refresh()}
              title={`Sincronización: ${cloudSync.status === 'syncing' ? 'Sincronizando' : cloudSync.status === 'error' ? 'Desconectado (Modo Local)' : 'En Línea'}. Haz clic para refrescar.`}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 4,
                color: cloudSync.status === 'syncing' ? t.sub : cloudSync.status === 'error' ? t.red : "#39ff14", // Verde eléctrico para OK
                animation: cloudSync.status === 'syncing' ? "spin 2s linear infinite" : "none"
              }}
            >
              <Ic n={cloudSync.status === 'syncing' ? 'sync' : cloudSync.status === 'error' ? 'alert' : 'power'} s={20} />
            </button>
            <button
              onClick={() => setSec("config")}
              style={{
                background: "transparent",
                color: currentSec === "config" ? t.accent : t.sub,
                border: "none",
                cursor: "pointer",
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 4,
                opacity: currentSec === "config" ? 1 : 0.8,
              }}
              title="Ajustes y Personalización"
            >
              <Ic n="config" s={18} />
            </button>
            <button
              onClick={() => {
                const nextTema = tema === "clik" ? "clik_dark" : "clik";
                setTema(nextTema);
              }}
              title={isDark ? "Modo claro" : "Modo oscuro"}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: t.text,
                marginRight: 8,
                opacity: 0.8,
              }}
            >
              <Ic n={isDark ? "sun" : "moon"} s={20} />
            </button>
            <Avatar nombre={user.nombre} />
            <button
              onClick={onLogout}
              title="Cerrar Sesión"
              style={{
                background: t.red + "1a",
                border: "none",
                cursor: "pointer",
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: t.red,
                marginLeft: 4,
                transition: "all 0.2s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = t.red + "33")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background = t.red + "1a")
              }
            >
              <Ic n="logout" s={16} />
            </button>
          </div>
        </div>
      </header>
      <main
        style={{
          paddingTop: "78px",
          paddingBottom: "40px",
          paddingLeft: "24px",
          paddingRight: "24px",
          maxWidth: "1600px",
          margin: "0 auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}

export function PgHdr({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  const { t } = useApp();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
      <div>
        <h1
          className="text-3xl font-extrabold tracking-tight"
          style={{ color: t.text, letterSpacing: "-1px", lineHeight: 1 }}
        >
          {title}
        </h1>
        {sub && (
          <div
            className="text-[13px] font-medium mt-1"
            style={{ color: t.sub }}
          >
            {sub}
          </div>
        )}
      </div>
      <div
        className="flex items-center gap-2 flex-wrap"
        style={{ scrollbarWidth: "none" }}
      >
        {children}
      </div>
    </div>
  );
}

export function PageContainer({
  title,
  sub,
  actions,
  children,
  stickyHeader = true,
  extraHeader,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  stickyHeader?: boolean;
  extraHeader?: React.ReactNode;
}) {
  const { t } = useApp();
  return (
    <div style={{ animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
      {stickyHeader ? (
        <div
          style={{
            position: "sticky",
            top: "58px",
            zIndex: 50,
            background: t.bg,
            margin: "0 -24px 20px -24px",
            padding: "0 24px",
          }}
        >
          <PgHdr title={title} sub={sub}>
            {actions}
          </PgHdr>
          {extraHeader && (
            <div style={{ paddingBottom: 16 }}>{extraHeader}</div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <PgHdr title={title} sub={sub}>
            {actions}
          </PgHdr>
          {extraHeader && <div style={{ marginBottom: 16 }}>{extraHeader}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function DualLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 xl:gap-8 items-start">
      <aside className="xl:sticky xl:top-8 w-full order-1 xl:order-none">
        {sidebar}
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
