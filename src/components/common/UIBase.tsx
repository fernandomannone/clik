import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../context/AppContext";
import { Bot, Bug, Truck, Banknote } from "lucide-react";

export const Ic = ({ n, s = 18, style = {} }: { n: string; s?: number; style?: React.CSSProperties }) => {
  if (n === 'bot') return <Bot size={s} style={style} strokeWidth={2} />;
  if (n === 'bug') return <Bug size={s} style={style} strokeWidth={2} />;
  if (n === 'truck') return <Truck size={s} style={style} strokeWidth={2} />;
  if (n === 'banknote') return <Banknote size={s} style={style} strokeWidth={2} />;

  const PATHS: Record<string, string> = {
    dash: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
    pagos: "M1 4h22v16H1zM1 10h22",
    ventas: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    clientes: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    user: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    proveedores: "M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM12 12a2 2 0 100-4 2 2 0 000 4zM2 10h2M20 10h2M2 14h2M20 14h2",
    articulos: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
    caja: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10",
    stats: "M18 20V10M12 20V4M6 20v-6",
    config: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    plus: "M12 5v14M5 12h14", search: "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11-3a3 3 0 100 6 3 3 0 000-6z",
    close: "M18 6L6 18M6 6l12 12", x: "M18 6L6 18M6 6l12 12", check: "M20 6L9 17l-5-5",
    edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z",
    trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6", delete: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
    logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
    alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
    transfer: "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4",
    cloud: "M17.5 19C19.98 19 22 16.98 22 14.5C22 12.21 20.31 10.32 18.1 10.05C17.36 6.64 14.33 4 10.5 4C6.36 4 3 7.36 3 11.5C3 11.75 3 12 3.09 12.23C1.31 12.87 0 14.54 0 16.5C0 19 2.02 21 4.5 21H17.5V19ZM4.5 19C3.12 19 2 17.88 2 16.5C2 15.25 2.92 14.18 4.13 14H5V11.5C5 8.47 7.47 6 10.5 6C13.53 6 16 8.47 16 11.5V12H17.5C18.88 12 20 13.12 20 14.5C20 15.88 18.88 17 17.5 17H16V19H17.5Z",
    cloudOn: "M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04ZM19 18H6C3.79 18 2 16.21 2 14C2 11.95 3.53 10.24 5.56 10.03L6.63 9.92L7.13 8.97C8.08 7.14 9.94 6 12 6C14.62 6 16.88 7.86 17.39 10.43L17.69 11.92L19.2 12.04C20.78 12.14 22 13.45 22 15C22 16.65 20.65 18 19 18ZM10.09 13.09L7.5 10.5L6.09 11.91L10.09 15.91L18.09 7.91L16.68 6.5L10.09 13.09Z",
    cloudOff: "M19.35 10.04C18.67 6.59 15.64 4 12 4C11.39 4 10.8 4.09 10.22 4.25L11.75 5.78C11.83 5.78 11.91 5.78 12 5.78C14.62 5.78 16.88 7.64 17.39 10.21L17.69 11.7L19.2 11.82C20.78 11.92 22 13.23 22 14.78C22 15.91 21.34 16.9 20.37 17.39L21.8 18.82C23.13 17.92 24 16.45 24 14.78C24 12.14 21.95 10 19.35 10.04ZM1.39 2.11L0 3.5L3.81 7.31C1.61 8.27 0 10.45 0 13C0 16.31 2.69 19 6 19H15.5L18.89 22.39L20.28 21L1.39 2.11ZM6 17C3.79 17 2 15.21 2 13C2 11.08 3.36 9.46 5.17 9.09L13.08 17H6Z",
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    lock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
    power: "M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10",
    cc: "M9 12h6M9 16h6M9 8h6M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
    moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
    sun: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    dots: "M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0-7a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
    whatsapp: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 11-7.6-7.6 8.38 8.38 0 013.8.9L22 7l-1.5 5.5z"
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}><path d={PATHS[n]} /></svg>;
};

export function DropDown({ trigger, children, align = "right" }: any) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const handler = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div onClick={() => setOpen(!open)} style={{ height: "100%", display: "flex", alignItems: "center" }}>
        <div style={{ pointerEvents: "none" }}>{trigger}</div>
      </div>
      {open && (
         <div style={{ position: "absolute", top: "calc(100% + 4px)", [align]: 0, zIndex: 1000, background: t.surf, border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: t.shadow, minWidth: 160, padding: "4px 0", animation: "fadeIn 0.15s ease" }} onClick={() => setOpen(false)}>
           {children}
         </div>
      )}
    </div>
  );
}

export function DropDownItem({ children, onClick, icon, danger = false }: any) {
  const { t } = useApp();
  const color = danger ? t.red : t.text;
  return (
    <div onClick={onClick} style={{ padding: "8px 16px", cursor: "pointer", fontSize: 13, color: color, display: "flex", alignItems: "center", gap: 10, transition: "background 0.15s", whiteSpace: "nowrap" }} onMouseEnter={e => e.currentTarget.style.background = danger ? t.redBg : t.surf2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
       {icon && <Ic n={icon} s={14} style={{ color: danger ? t.red : t.sub }} />}
       <span style={{ fontWeight: 500, flex: 1 }}>{children}</span>
    </div>
  );
}

export function Card({ children, accent, style = {}, onClick, className = "" }: any) {
  const { t } = useApp();
  return (
    <div onClick={onClick} className={className} style={{ 
      background: t.surf, 
      borderRadius: "16px", 
      padding: "20px 24px", 
      border: `1px solid ${accent ? accent + "22" : t.border}`, 
      borderLeft: accent ? `5px solid ${accent}` : `1px solid ${t.border}`,
      position: "relative", 
      overflow: "hidden", 
      cursor: onClick ? "pointer" : "default", 
      boxShadow: "0 4px 20px -4px rgba(0,0,0,0.05)", 
      transition: "transform 0.2s ease, box-shadow 0.2s ease", 
      ...style 
    }}>
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export function KPI({ label, value, sub, color, onClick, icon, topLabel, topLabelColor }: any) {
  const { t } = useApp();
  return (
    <Card accent={color} style={{ cursor: onClick ? "pointer" : "default", display: "flex", flexDirection: "column", height: "100%", padding: "16px 20px" }} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        {icon ? (
          <div style={{ width: 34, height: 34, borderRadius: 10, background: color + "1a", color: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
             <Ic n={icon} s={18} />
          </div>
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: 10, background: color + "1a", color: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>
             {label.charAt(0)}
          </div>
        )}
        {(topLabel || onClick) && (
          <div style={{ fontSize: 9, color: topLabelColor || color, fontWeight: 700, opacity: 0.9 }}>{topLabel || "Ver detalle →"}</div>
        )}
      </div>
      <div style={{ fontSize: 13, color: t.sub, fontWeight: 600, letterSpacing: "0px", marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: "auto" }}>
         <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-1px", lineHeight: 1 }}>{value}</div>
         {sub && <div style={{ fontSize: 11, color: t.muted, fontWeight: 600 }}>{sub}</div>}
      </div>
    </Card>
  );
}

export function Bdg({ children, color }: any) {
  const { t } = useApp();
  // Ensure the text stands out from the background while keeping the border/bg color logic
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: color + "15", color: t.text, border: `1px solid ${color}88` }}>{children}</span>;
}

export function Btn({ children, v = "primary", onClick, style = {}, disabled = false, full = false, loading = false, type = "button", ...props }: any) {
  const { t } = useApp();
  const vs: any = {
    primary: { bg: t.accent, color: "#fff", border: "none" },
    ghost: { bg: t.surf2, color: t.sub, border: `1px solid ${t.border}` },
    danger: { bg: t.redBg, color: t.red, border: `1px solid ${t.red}33` },
    "danger-ghost": { bg: "transparent", color: t.red, border: `1px solid ${t.border}` },
    success: { bg: t.greenBg, color: t.green, border: `1px solid ${t.green}33` },
    amber: { bg: t.amberBg, color: t.amber, border: `1px solid ${t.amber}33` },
    outline: { bg: "transparent", color: t.text, border: `1px solid ${t.border}` }
  };
  const s = vs[v] || vs.primary;
  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled || loading} 
      {...props} 
      className="hover:opacity-90 active:scale-95 disabled:hover:opacity-60 disabled:active:scale-100" 
      style={{ 
        display: "inline-flex", 
        alignItems: "center", 
        justifyContent: "center", 
        gap: 6, 
        padding: "9px 16px", 
        borderRadius: 8, 
        cursor: (disabled || loading) ? "not-allowed" : "pointer", 
        fontSize: 13, 
        fontWeight: 600, 
        fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", 
        transition: "all 0.15s", 
        opacity: (disabled || loading) ? 0.6 : 1, 
        width: full ? "100%" : "auto", 
        background: s.bg, 
        color: s.color, 
        border: s.border, 
        ...style 
      }}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
}

export function Tbl({ headers, children, stickyTop = 58 }: any) {
  const { t } = useApp();
  return (
    <div style={{ background: t.surf, borderRadius: 14, border: `1px solid ${t.border}` }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
        <thead style={{ position: stickyTop !== false ? "sticky" : "static", top: stickyTop !== false ? stickyTop : undefined, zIndex: 10 }}>
          <tr style={{ background: t.surf2 }}>
            {headers.map((h: any, i: number) => {
              if (React.isValidElement(h) && (h.type === ThSort || (typeof h.type === 'function' && h.type.name === 'ThSort'))) {
                 return React.cloneElement(h, { key: i, index: i, total: headers.length });
              }
              let align = "left";
              if (typeof h === "string") {
                 const hL = h.toLowerCase();
                 // Columnas numéricas / monetarias comunes que deben justificarse a la derecha
                 if (
                   ["ingreso", "egreso", "saldo", "debe", "haber", "monto", "total", "subtotal", "descuento", "precio", "neto", "iva", "p.unit", 
                    "stock", "importe", "valor subtotal", "ganancia est.", "precio base", "límite", "exceso", "mínimo", "unidades vendidas",
                    "saldo planilla", "saldo sistema", "diferencia", "saldo al día", "saldo actual", "stock actual", "días"].includes(hL)
                 ) align = "right";
              }
              const isFirst = i === 0;
              const isLast = i === headers.length - 1;
              return (
                <th key={i} style={{ 
                  padding: "10px 14px", 
                  textAlign: align as any, 
                  color: t.sub, 
                  background: t.surf2,
                  fontWeight: 600, 
                  fontSize: 11, 
                  letterSpacing: "0.8px", 
                  textTransform: "uppercase", 
                  borderBottom: `1px solid ${t.border}`, 
                  whiteSpace: "nowrap",
                  borderTopLeftRadius: isFirst ? 14 : 0,
                  borderTopRightRadius: isLast ? 14 : 0
                }}>
                  {h && typeof h === "object" ? React.cloneElement(h as React.ReactElement, { key: i }) : h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children, onClick, onDoubleClick, style = {}, className }: any) {
  const { t } = useApp();
  const [h, setH] = useState(false);
  return <tr onClick={onClick} onDoubleClick={onDoubleClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} className={className} style={{ background: h ? t.surf2 : (style.background || "transparent"), cursor: (onClick || onDoubleClick) ? "pointer" : "default", transition: "background 0.1s", ...style }}>{children}</tr>;
}

export function Td({ children, style = {}, colSpan, rowSpan, ...rest }: any) {
  const { t } = useApp();
  return <td colSpan={colSpan} rowSpan={rowSpan} {...rest} style={{ padding: "12px 14px", borderBottom: `1px solid ${t.border}`, verticalAlign: "middle", color: t.text, ...style }}>{children}</td>;
}

export const Inp = React.forwardRef<HTMLInputElement, any>(function Inp({ ...p }, ref) {
  const { t } = useApp();
  return <input ref={ref} {...p} style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", color: t.text, fontSize: 13, outline: "none", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", boxSizing: "border-box", ...p.style }} />;
});

export function InpMoney({ value, onChange, placeholder = "0", style = {}, ...p }: any) {
  const { t } = useApp();
  const [editing, setEditing] = useState(false);
  const raw = String(value || "");

  const toDisplay = (v: string) => {
    if (!v || v === "") return "";
    const n = parseFloat(v.replace(/\./g, "").replace(/,/g, "."));
    if (isNaN(n) || n === 0) return "";
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const displayVal = editing ? raw : toDisplay(raw);

  return <input
    {...p}
    type="text"
    inputMode="decimal"
    value={displayVal}
    placeholder={placeholder}
    onFocus={(e) => { setEditing(true); e.target.select(); }}
    onBlur={() => setEditing(false)}
    onChange={(e) => {
      let v = e.target.value.replace(/[^\d,.]/g, "");
      v = v.replace(/\./g, ",");
      const partes = v.split(",");
      if (partes.length > 2) v = partes[0] + "," + partes.slice(1).join("");
      if (partes[1]?.length > 2) v = partes[0] + "," + partes[1].slice(0, 2);
      onChange({ target: { value: v } });
    }}
    style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", color: t.text, fontSize: 13, outline: "none", fontFamily: "'Consolas','Courier New',monospace", boxSizing: "border-box", textAlign: "right", ...style }}
  />;
}

export function Sel({ children, ...p }: any) {
  const { t } = useApp();
  return <select {...p} style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", color: t.text, fontSize: 13, outline: "none", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", boxSizing: "border-box", ...p.style }}>{children}</select>;
}

export function Fld({ label, children, half = false }: any) {
  const { t } = useApp();
  return <div style={{ marginBottom: 14, ...(half ? { flex: "0 0 calc(50% - 6px)" } : {}) }}><label style={{ fontSize: 11, fontWeight: 600, color: t.sub, letterSpacing: "0.8px", textTransform: "uppercase", display: "block", marginBottom: 5 }}>{label}</label>{children}</div>;
}

export function Modal({ open, onClose, title, sub, children, width = 500 }: any) {
  const { t } = useApp();
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000bb", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }} onClick={onClose}>
      <div style={{ position: "relative", background: t.bg, borderRadius: 18, padding: 28, width, maxWidth: "100%", border: `1px solid ${t.border}`, boxShadow: t.shadow, maxHeight: "90vh", overflowY: "auto", animation: "fadeUp 0.2s ease" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{title}</div>
            {sub && <div style={{ fontSize: 13, color: t.sub, marginTop: 2 }}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.sub, padding: 4 }}><Ic n="close" s={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PgHdr({ title, sub, children }: any) {
  const { t } = useApp();
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}><div><div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: "-0.5px" }}>{title}</div>{sub && <div style={{ fontSize: 13, color: t.sub, marginTop: 3 }}>{sub}</div>}</div><div style={{ display: "flex", gap: 8 }}>{children}</div></div>;
}

export function SearchBar({ value, onChange, placeholder, actions, filters, addon }: any) {
  const { t } = useApp();
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6, flex: "1 1 150px", minWidth: 150, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.muted }}>
            <Ic n="search" s={15} />
          </span>
          <input 
            value={value} 
            onChange={e => onChange(e.target.value)} 
            placeholder={placeholder || "Buscar..."} 
            style={{ width: "100%", background: t.surf, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 38px 10px 38px", color: t.text, fontSize: 13, outline: "none", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", boxSizing: "border-box" }} 
          />
          {value && (
            <button 
              onClick={() => onChange("")}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: t.muted, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Ic n="x" s={14} />
            </button>
          )}
        </div>
        {addon}
      </div>
      {filters && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>{filters}</div>}
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

export function Avatar({ nombre, color, size = 32 }: any) {
  const { t } = useApp();
  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };
  return <div style={{ width: size, height: size, borderRadius: "50%", background: (color || t.accent) + "18", border: `1px solid ${(color || t.accent)}33`, display: "flex", alignItems: "center", justifyContent: "center", color: color || t.accent, fontWeight: 700, fontSize: Math.max(10, size * 0.4), flexShrink: 0 }}>{getInitials(nombre)}</div>;
}

export function BtnEliminarConClave({ onConfirm, claveMaestra: propsClave, buttonText = "Eliminar", buttonStyle }: any) {
  const { t, claveMaestra: contextClave } = useApp();
  const claveMaestra = propsClave || contextClave || "4415";
  const [showInput, setShowInput] = useState(false);
  const [clave, setClave] = useState("");
  const [err, setErr] = useState("");

  const handleVerificar = () => {
    if (clave === claveMaestra) {
      setShowInput(false);
      setClave("");
      setErr("");
      onConfirm();
    } else {
      setErr("Clave incorrecta");
    }
  };
  
  return (
    <div style={{ display: "inline-flex", minWidth: 100, justifyContent: "flex-start", ...buttonStyle }}>
      {!showInput && (
        <Btn v="danger" onClick={(e: any) => { e.preventDefault(); e.stopPropagation(); setShowInput(true); }} style={{ width: "100%" }} title={buttonText} type="button">
          <Ic n="trash" s={14} />{buttonText !== "Eliminar" && <span style={{ marginLeft: 6 }}>{buttonText}</span>}
        </Btn>
      )}

      {showInput && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", background: t.surf2, padding: "4px 6px", borderRadius: 8, border: `1px solid ${err ? t.red : t.border}`, width: "100%" }} onClick={e => e.stopPropagation()}>
          <Ic n="lock" s={14} style={{ color: t.muted }} />
          <input 
            type="password" 
            placeholder="PIN" 
            value={clave}
            onChange={(e: any) => { setClave(e.target.value); setErr(""); }}
            style={{ width: "100%", minWidth: 40, padding: "4px 2px", fontSize: 13, background: "transparent", border: "none", color: t.text, outline: "none", fontFamily: "monospace" }}
            onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); handleVerificar(); } }}
            autoFocus
          />
          <button onClick={(e: any) => { e.preventDefault(); handleVerificar(); }} style={{ padding: "4px 8px", background: t.accent, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>✓</button>
          <button onClick={(e: any) => { e.preventDefault(); setShowInput(false); setClave(""); setErr(""); }} style={{ padding: "4px 8px", background: "none", border: "none", cursor: "pointer", color: t.muted }}>✕</button>
        </div>
      )}
    </div>
  );
}

export function OverlaySheet({ open, onClose, title, sub, children, width = "500px" }: any) {
  const { t } = useApp();
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
  
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "flex-end", animation: "fadeIn 0.2s ease", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div style={{ width: width, maxWidth: "95vw", height: "100%", background: t.bg, boxShadow: "-10px 0 50px rgba(0,0,0,0.15)", animation: "slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)", padding: "24px", overflowY: "auto", borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        {title && (
          <div style={{ background: t.accent, margin: "-24px -24px 24px -24px", padding: "32px 24px 24px 24px", color: "#fff", position: "relative", flexShrink: 0 }}>
            <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "8px", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.3)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}><Ic n="close" s={16} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: "24px", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>{title}</h2>
                {sub && <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>{sub}</div>}
              </div>
            </div>
          </div>
        )}
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } } @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

export function ModalConfirmarEliminacion({ open, onClose, onConfirm, titulo = "¿Eliminar?", entidadNombre = "este elemento", textoAdicional = "Esta acción no se puede deshacer." }: any) {
  const { t } = useApp();
  
  if (!open) return null;
  
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s" }} onClick={e=>e.stopPropagation()}>
      <div style={{ background: t.surf, borderRadius: 20, width: "100%", maxWidth: 400, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", animation: "scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🗑️</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: t.text, margin: "0 0 12px 0", letterSpacing: "-0.5px" }}>{titulo}</h2>
        <div style={{ fontSize: 15, color: t.sub, marginBottom: 8 }}>
          Estás por eliminar <span style={{ fontWeight: 700, color: t.text }}>{entidadNombre}</span>.
        </div>
        <div style={{ fontSize: 13, color: t.muted, marginBottom: 32, fontStyle: "italic" }}>
          {textoAdicional}
        </div>
        
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          <button 
            type="button"
            onClick={onClose} 
            style={{ flex: 1, padding: "12px", background: t.surf2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = t.border}
            onMouseLeave={e => e.currentTarget.style.background = t.surf2}
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={onConfirm} 
            style={{ flex: 1, padding: "12px", background: t.redBg, color: t.red, border: `1px solid ${t.red}44`, borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = t.red; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = t.redBg; e.currentTarget.style.color = t.red; }}
          >
            <Ic n="trash" s={15} /> Eliminar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ThSort({ label, colKey, sortKey, sortDir, onSort, style = {}, align = "left" }: any) {
  const { t } = useApp();
  const active = sortKey === colKey;
  const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th onClick={() => onSort(colKey)} style={{
      padding: "9px 14px", textAlign: align, cursor: "pointer", userSelect: "none",
      color: active ? t.accent : t.sub, fontWeight: 600, fontSize: 11,
      letterSpacing: "0.5px", textTransform: "uppercase",
      borderBottom: `1px solid ${t.border}`,
      background: active ? t.accentBg : t.surf2,
      whiteSpace: "nowrap", ...style
    }}>
      {label}{arrow && <span style={{ color: t.accent }}>{arrow}</span>}
    </th>
  );
}

export function useSort(defaultKey = "", defaultDir = "asc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);
  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sortFn = (a: any, b: any) => {
    const va = a[sortKey], vb = b[sortKey];
    if (va === undefined || va === null) return 1;
    if (vb === undefined || vb === null) return -1;
    const n = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "es", { numeric: true });
    return sortDir === "asc" ? n : -n;
  };
  return { sortKey, sortDir, toggleSort, sortFn };
}

import { normalizar } from "../../lib/utils";

export function BuscadorSelect({ 
  opciones = [], 
  valor = null, 
  onChange, 
  placeholder = "Buscar...", 
  candidatos = [],
  renderDisplay = (o: any) => o?.nombre,
  renderOpcion = (o: any) => o?.nombre,
  renderSub = (o: any) => o?.sub || null,
  filterFn = (o: any, q: string) => normalizar(o.nombre).includes(q)
}: any) {
  const { t } = useApp();
  const [busq, setBusq] = React.useState("");
  const [abierto, setAbierto] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  
  const seleccionado = valor ? opciones.find((o: any) => String(o.id) === String(valor)) : null;

  React.useEffect(() => {
    const handler = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtrados = React.useMemo(() => {
    const q = normalizar(busq);
    if (!q) return opciones || [];
    return (opciones || []).filter((o: any) => filterFn(o, q));
  }, [opciones, busq, filterFn]);

  const handleSelect = (id: any) => {
    onChange(id);
    setBusq("");
    setAbierto(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {seleccionado && !abierto
        ? <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.accent}`, background: t.accentBg, fontSize: 13 }}>
            <span style={{ flex: 1, fontWeight: 600, color: t.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{renderDisplay(seleccionado)}</span>
            <button onClick={() => { onChange(""); setAbierto(true); setBusq(""); setTimeout(() => ref.current?.querySelector('input')?.focus(), 50); }} style={{ background: "none", border: "none", cursor: "pointer", color: t.muted, fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
          </div>
        : <div style={{ position: "relative" }}>
            <input
              autoFocus={abierto}
              value={busq}
              onChange={e => { setBusq(e.target.value); setAbierto(true); }}
              onFocus={() => setAbierto(true)}
              placeholder={placeholder}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${abierto ? t.accent : t.border}`, background: t.surf, color: t.text, fontSize: 13, outline: "none", fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", boxSizing: "border-box" }}
            />
            {busq && (
              <button onClick={() => { setBusq(""); ref.current?.querySelector('input')?.focus(); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.muted, fontSize: 16, lineHeight: 1, padding: "0 4px" }}>×</button>
            )}
          </div>
      }
      {abierto && <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000, background: t.surf, border: `1px solid ${t.border}`, borderRadius: 8, maxHeight: 200, overflowY: "auto", boxShadow: t.shadow, marginTop: 4 }}>
        {candidatos.length > 0 && <>
          <div style={{ padding: "4px 10px", fontSize: 10, fontWeight: 700, color: t.amber, textTransform: "uppercase", letterSpacing: "0.5px", background: t.amberBg }}>Posibles coincidencias</div>
          {candidatos.map((c: any) => (
            <div key={c.id} onMouseDown={() => handleSelect(c.id)} style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", color: t.accent, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }} onMouseOver={e => e.currentTarget.style.background = t.accentBg} onMouseOut={e => e.currentTarget.style.background = ""}>
              ⭐ {renderOpcion(c)}
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${t.border}`, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: t.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Todas las opciones</div>
        </>}
        {filtrados.length === 0
          ? <div style={{ padding: "10px 12px", color: t.muted, fontSize: 13 }}>Sin resultados</div>
          : filtrados.filter((o: any) => !candidatos.find((x: any) => x.id === o.id)).map((o: any) => (
            <div key={o.id} onMouseDown={() => handleSelect(o.id)} style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", color: t.text, display: "flex", alignItems: "center", gap: 6 }} onMouseOver={e => e.currentTarget.style.background = t.surf2} onMouseOut={e => e.currentTarget.style.background = ""}>
              <span style={{ flex: 1 }}>{renderOpcion(o)}</span>
              {renderSub(o) && <span style={{ fontSize: 11, color: t.muted }}>{renderSub(o)}</span>}
            </div>
          ))
        }
      </div>}
    </div>
  );
}
