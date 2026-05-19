import React, { useRef, useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { Ic, Avatar } from "../common/UIBase";
import { fmtFechaCC, getToday } from "../../lib/utils";

const today = getToday();

export default function Sidebar({ sec, setSec, user, onLogout, tema, setTema, badges = {}, mobileMenuOpen, setMobileMenuOpen }: any) {
  const { t, isDark } = useApp();
  const esMaestro = user.rol === "maestro" || user.rol === "administrador";
  
  const navMaestro = [
    { id: "dashboard", label: "Dashboard", icon: "dash" },
    { id: "whatsapp", label: "Bots", icon: "bot" },
    { id: "caja", label: "Tesorería", icon: "caja" },
    { id: "stats", label: "Estadísticas", icon: "stats" },
    { id: "clientes", label: "Clientes", icon: "clientes" },
    { id: "proveedores", label: "Proveedores", icon: "proveedores" },
    { id: "articulos", label: "Artículos", icon: "articulos" },
    { id: "config", label: "Configuración", icon: "config" },
  ];

  const navUsuario = [
    { id: "dashboard", label: "Dashboard", icon: "dash" },
    { id: "whatsapp", label: "Bots", icon: "bot" },
    { id: "clientes", label: "Clientes", icon: "clientes" },
    { id: "proveedores", label: "Proveedores", icon: "proveedores" },
    { id: "articulos", label: "Artículos", icon: "articulos" },
    ...(user.permisos?.caja ? [{ id: "caja", label: "Tesorería", icon: "caja" }] : []),
    ...(user.permisos?.estadisticas ? [{ id: "stats", label: "Estadísticas", icon: "stats" }] : []),
  ];

  const navBase = esMaestro ? navMaestro : navUsuario;
  const storageKey = `gp_nav_order_${user.id || user.usuario}`;

  const [nav, setNav] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (!saved.length) return navBase;
      const reordenado = saved.map((id: string) => navBase.find(n => n.id === id)).filter(Boolean);
      const nuevos = navBase.filter(n => !saved.includes(n.id));
      return [...reordenado, ...nuevos];
    } catch { return navBase; }
  });

  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onDragStart = (e: React.DragEvent, idx: number) => {
    dragIdx.current = idx;
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (idx !== dragIdx.current) setDragOver(idx);
  };

  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) { setDragOver(null); return; }
    const nuevo = [...nav];
    const [moved] = nuevo.splice(dragIdx.current, 1);
    nuevo.splice(idx, 0, moved);
    setNav(nuevo);
    setDragOver(null);
    setIsDragging(false);
    dragIdx.current = null;
    try { localStorage.setItem(storageKey, JSON.stringify(nuevo.map(n => n.id))); } catch { }
  };

  const onDragEnd = () => { setDragOver(null); setIsDragging(false); dragIdx.current = null; };

  // Close mobile menu on navigate
  const handleNavClick = (id: string) => {
    setSec(id);
    if (setMobileMenuOpen) setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity" 
        />
      )}
      
      <aside 
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 260, background: t.surf, borderRight: `1px solid ${t.border}`, boxShadow: mobileMenuOpen ? t.shadow : "none" }}
      >
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic n="caja" s={18} style={{ color: "#fff" }} />
              </div>
              <span style={{ fontSize: 24, fontWeight: 800, color: t.text, letterSpacing: "-0.5px" }}>Cli<span style={{ color: t.accent }}>k</span></span>
            </div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 4, letterSpacing: "1.5px", textTransform: "uppercase", paddingLeft: 50, fontWeight: 600 }}>Web Edition</div>
          </div>
          {/* Close button for mobile */}
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-2 rounded-md" style={{ color: t.sub }}>
            <Ic n="close" s={20} />
          </button>
        </div>
        
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar nombre={user.nombre} color={esMaestro ? t.accent : t.purple} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.nombre}</div>
            <div style={{ fontSize: 11, color: esMaestro ? t.accent : t.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>{esMaestro ? "Admin" : user.rol}</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
          <div style={{ padding: "0 10px", fontSize: 11, fontWeight: 700, color: t.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Módulos</div>
          {nav.map((item, idx) => {
            const active = sec === item.id;
            const isDraggingOver = dragOver === idx;
            const badgeCount = badges[item.id] || 0;
            
            return (
              <div key={item.id}
                draggable
                onDragStart={e => onDragStart(e, idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)}
                onDragEnd={onDragEnd}
                onClick={() => handleNavClick(item.id)}
                style={{ 
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, 
                  cursor: isDragging ? (dragIdx.current === idx ? "grabbing" : "grab") : "pointer", 
                  fontSize: 14, fontWeight: active ? 700 : 500, transition: "all 0.2s", 
                  background: active ? t.accentBg : isDraggingOver ? t.surf2 : "transparent", 
                  color: active ? t.accent : t.sub, 
                  border: `1px solid ${active ? t.accentGlow : isDraggingOver ? t.border : "transparent"}`, 
                  opacity: dragIdx.current === idx ? 0.4 : 1, transform: isDraggingOver ? "translateY(-2px)" : "none" 
                }}
                className="hover:bg-opacity-80"
              >
                <div style={{ opacity: active ? 1 : 0.7, transform: active ? "scale(1.1)" : "scale(1)", transition: "all 0.2s", color: active ? t.accent : t.muted }}>
                  <Ic n={item.icon} s={18} />
                </div>
                {item.label}
                {badgeCount > 0 && <span style={{ marginLeft: "auto", background: t.red, color: "#fff", fontSize: 11, fontWeight: 800, borderRadius: 12, padding: "2px 8px" }}>{badgeCount}</span>}
              </div>
            );
          })}
        </nav>

        <div style={{ padding: "16px 16px 20px", borderTop: `1px solid ${t.border}`, display: "flex", gap: 8 }}>
          <button 
            onClick={() => setTema(tema === "clik" ? "clik_dark" : "clik")} 
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, background: t.surf2, border: `1px solid ${t.border}`, cursor: "pointer", color: t.sub, fontSize: 13, fontWeight: 600, transition: "all 0.2s" }} 
            className="hover:opacity-80"
          >
            <Ic n={isDark ? "sun" : "moon"} s={16} /> {isDark ? "Modo Claro" : "Modo Oscuro"}
          </button>
          <button onClick={onLogout} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, background: t.redBg, border: `1px solid ${t.red}33`, cursor: "pointer", color: t.red, fontSize: 13, fontWeight: 600, transition: "all 0.2s" }} className="hover:opacity-80">
            <Ic n="logout" s={16} />Salir
          </button>
        </div>
      </aside>
    </>
  );
}
