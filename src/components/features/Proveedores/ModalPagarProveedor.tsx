import React, { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Modal, Fld, Sel, InpMoney, Btn, Ic, Inp, BuscadorSelect, OverlaySheet } from "../../common/UIBase";
import { parseMoney, fmtMoney, getToday } from "../../../lib/utils";
import { extraerDatosPago } from "../../../services/aiPayments";

const today = getToday();

function readFileAsBase64(file: File): Promise<{ base64: string, mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [prefix, base64] = result.split(",");
      const mime = prefix.match(/:(.*?);/)?.[1] || file.type;
      resolve({ base64, mime });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ModalPagarProveedor({ open, onClose, cuentas, proveedores, setPagosProv, setMovimientos, setCuentas, user, cloudSync }: any) {
  const { t } = useApp();
  const FORM0 = { proveedorId:"", medioPago:"banco", bancoId:"", monto:"", obs:"", fecha:today, otroProveedor:false };
  const [form, setForm] = useState(FORM0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasComprobante, setHasComprobante] = useState(false);

  React.useEffect(()=>{ 
    if(open){ 
      const b=cuentas.find((c: any)=>c.tipo==="banco"); 
      const rgp = proveedores.find((p: any)=>p.nombre==="RGP - SEAC");
      setForm({...FORM0, bancoId:b?String(b.id):"", fecha: today, proveedorId: rgp ? String(rgp.id) : ""}); 
      setIsDragging(false); 
      setIsAnalyzing(false); 
      setHasComprobante(false);
    } 
  },[open]);

  const guardar = async () => {
    if(!form.proveedorId||!form.monto) { alert("Falta proveedor o monto"); return; }
    const esBanco = form.medioPago==="banco";
    const cuenta  = esBanco ? cuentas.find((c: any)=>String(c.id)===String(form.bancoId)) : cuentas.find((c: any)=>c.tipo==="caja");
    if(!cuenta) { alert("No se encontró la cuenta para descontar"); return; }
    const monto   = parseMoney(form.monto);
    if(!monto) { alert("El monto es 0 o inválido: " + form.monto); return; }
    const prov    = proveedores.find((p: any)=>String(p.id)===String(form.proveedorId));
    if(!prov) { alert("No se encontró el proveedor: " + form.proveedorId); return; }
    const pagoId  = Date.now();
    const h       = new Date().toTimeString().slice(0,5);
    
    const nuevoPagoProv = {id:pagoId,proveedorId:prov.id,tipo:esBanco?"Transferencia":"Efectivo",monto,fecha:form.fecha,hora:h,obs:form.obs||"",anulado:false,cuentaId:cuenta.id, comprobanteValidado: hasComprobante};
    const nuevoMovimiento = {id:pagoId+1,cuentaId:cuenta.id,concepto:`Pago proveedor — ${prov.nombre}${form.obs?` · ${form.obs}`:""}`,tipo:"egreso",monto,fecha:form.fecha,hora:h,pagoProvId:String(pagoId)};
    const nuevaCuenta = {...cuenta, saldo: cuenta.saldo - monto};

    try {
      if (cloudSync?.executeCloudBatch) {
         const batchOps = [
           { type: "set" as const, collection: "pagosProv", id: String(nuevoPagoProv.id), data: nuevoPagoProv },
           { type: "set" as const, collection: "movimientos", id: String(nuevoMovimiento.id), data: nuevoMovimiento },
           { type: "set" as const, collection: "cuentas", id: String(nuevaCuenta.id), data: nuevaCuenta }
         ];
         const ok = await cloudSync.executeCloudBatch(batchOps);
         if (!ok) {
           alert("Error de red: no se pudo guardar el pago.");
           return;
         }
      } else if (cloudSync?.saveToCloud) {
         cloudSync.saveToCloud("pagosProv", nuevoPagoProv);
         cloudSync.saveToCloud("movimientos", nuevoMovimiento);
         cloudSync.saveToCloud("cuentas", nuevaCuenta);
      }

      setPagosProv((prev: any)=>([nuevoPagoProv,...prev]));
      setMovimientos((prev: any)=>([nuevoMovimiento,...prev]));
      setCuentas((prev: any)=>prev.map((c: any)=>String(c.id)===String(cuenta.id)?nuevaCuenta:c));
      setForm(FORM0);
      onClose();
    } catch (err: any) {
      alert("Error guardando en la nube: " + err?.message);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const { base64, mime } = await readFileAsBase64(file);
      const extracted = await extraerDatosPago({ inlineData: { data: base64, mimeType: mime } }, cuentas, proveedores);
      
      if (extracted) {
        let matchedProvId = form.proveedorId;
        let requiresOtroProveedor = form.otroProveedor;
        const rgp = proveedores.find((p: any)=>p.nombre==="RGP - SEAC");

        if (extracted.proveedorMatch) {
          const searchLow = typeof extracted.proveedorMatch === 'string' ? extracted.proveedorMatch.toLowerCase() : "";
          const isRgpAlias = searchLow.includes("recaudacion") || searchLow.includes("rgp");
          let match = proveedores.find((p: any) => {
            if (!p?.nombre) return false;
            const pName = p.nombre.toLowerCase();
            return searchLow.includes(pName) || pName.includes(searchLow);
          });
          
          if (isRgpAlias) {
            match = proveedores.find((p: any) => p?.nombre && (p.nombre.toUpperCase().includes("SEAC") || p.nombre.toUpperCase().includes("RGP")));
          }

          if (match) {
            matchedProvId = String(match.id);
            requiresOtroProveedor = (match.id !== rgp?.id);
          } else {
            requiresOtroProveedor = true;
            matchedProvId = ""; // Forzar a que elija manualmente
          }
        }

        let matchedBancoId = form.bancoId;
        if (extracted.cuentaMatch) {
          const searchBank = typeof extracted.cuentaMatch === 'string' ? extracted.cuentaMatch.toLowerCase() : "";
          const bancos = cuentas.filter((c: any) => c.tipo === "banco");
          const matchBank = bancos.find((c: any) => {
            if (!c?.nombre) return false;
            const n = c.nombre.toLowerCase();
            return searchBank.includes(n) || n.includes(searchBank) || 
                   (searchBank.includes("patagonia") && n.includes("patagonia")) || 
                   (searchBank.includes("juan") && n.includes("juan"));
          });
          if (matchBank) {
            matchedBancoId = String(matchBank.id);
          }
        }

        setForm({
          ...form,
          medioPago: "banco",
          monto: String(extracted.monto),
          fecha: extracted.fechaMatch || form.fecha,
          obs: extracted.obsMatch || "",
          proveedorId: matchedProvId,
          otroProveedor: requiresOtroProveedor,
          bancoId: matchedBancoId
        });
        setHasComprobante(true);
      } else {
        alert("La IA no pudo detectar los datos del comprobante. Por favor, reintente o cárguelo a mano.");
      }
    } catch(err: any) {
      console.error(err);
      alert("Hubo un error procesando el comprobante: " + err?.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if(!open) return null;
  const bancos = cuentas.filter((c: any) => c.tipo === "banco").sort((a: any, b: any) => {
    if ((a.nombre || "").toLowerCase().includes("bbva")) return 1;
    if ((b.nombre || "").toLowerCase().includes("bbva")) return -1;
    return 0;
  });
  const rgp = proveedores.find((p: any)=>p.nombre==="RGP - SEAC");
  const provNombre = form.otroProveedor
    ? proveedores.find((p: any)=>String(p.id)===String(form.proveedorId))?.nombre||""
    : (rgp?.nombre || "RGP - SEAC");

  return (
    <OverlaySheet open={true} onClose={onClose} title="Pago a Proveedor" width="460px">
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
        style={{ position: "relative", minHeight: "100%", transition: "all 0.2s" }}
      >
        {isDragging && (
          <div style={{ position: "absolute", inset: -14, zIndex: 10, background: t.accentBg, border: `2px dashed ${t.accent}`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: t.accent, pointerEvents: "none" }}>
            <span style={{ fontSize: 40, marginBottom: 10 }}>📥</span>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Soltá el comprobante para escanear</div>
          </div>
        )}

        {isAnalyzing && (
          <div style={{ position: "absolute", inset: -14, zIndex: 10, background: t.surf, opacity: 0.9, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: t.accent, pointerEvents: "none" }}>
            <span style={{ fontSize: 40, marginBottom: 10, animation: "spin 2s linear infinite" }}>⏳</span>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Analizando con IA...</div>
          </div>
        )}

        <div style={{ fontSize: 11, color: t.muted, marginBottom: 12, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>🤖</span> Arrastrá aquí un comprobante (PDF o Imagen) para completarlo rápido.
        </div>

        <div style={{padding:"10px 14px",background:t.surf2,borderRadius:10,border:`1px solid ${t.border}`,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:t.muted,fontWeight:600,letterSpacing:"0.5px",textTransform:"uppercase",marginBottom:3}}>Proveedor</div>
          {form.medioPago==="banco"&&!form.otroProveedor
            ? <div style={{fontWeight:700,fontSize:14,color:t.text}}>{provNombre}</div>
            : <BuscadorSelect
                opciones={proveedores.filter((p: any) => p.estado !== "archivado")}
                valor={form.proveedorId}
                onChange={(id: any) => setForm({ ...form, proveedorId: id })}
                placeholder="Seleccioná proveedor..."
              />
          }
        </div>
        {form.medioPago==="banco"&&<button onClick={()=>{
          const otro=!form.otroProveedor;
          setForm({...form,otroProveedor:otro,proveedorId:otro?"":rgp?String(rgp.id):""});
        }} style={{fontSize:11,fontWeight:600,color:form.otroProveedor?t.accent:t.muted,background:"none",border:`1px solid ${form.otroProveedor?t.accent:t.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",whiteSpace:"nowrap",marginLeft:12}}>
          {form.otroProveedor?"✕ Cancelar":"Otro proveedor"}
        </button>}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[{v:"banco",label:"🏦 Transferencia",sub:"Banco San Juan / Patagonia"},{v:"efectivo",label:"💵 Efectivo",sub:"Desde caja"}].map(op=>(
          <button key={op.v} onClick={()=>{
            setForm({...form,medioPago:op.v,bancoId:"",proveedorId:op.v==="banco"?(rgp?String(rgp.id):""):"",otroProveedor:false});
          }} style={{flex:1,padding:"10px 8px",borderRadius:10,border:`2px solid ${form.medioPago===op.v?t.accent:t.border}`,background:form.medioPago===op.v?t.accentBg:"none",cursor:"pointer",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",textAlign:"center",transition:"all 0.15s"}}>
            <div style={{fontSize:13,fontWeight:700,color:form.medioPago===op.v?t.accent:t.text}}>{op.label}</div>
            <div style={{fontSize:11,color:t.muted,marginTop:2}}>{op.sub}</div>
          </button>
        ))}
      </div>

      {form.medioPago==="banco"
        ? <div style={{display:"flex",gap:8,marginBottom:14}}>
            {bancos.map((c: any)=>(
              <button key={c.id} onClick={()=>setForm({...form,bancoId:String(c.id)})}
                style={{flex:1,padding:"10px 8px",borderRadius:10,border:`2px solid ${form.bancoId===String(c.id)?c.color:t.border}`,background:form.bancoId===String(c.id)?c.color+"18":"none",cursor:"pointer",fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif",textAlign:"center",transition:"all 0.15s"}}>
                <div style={{fontSize:12,fontWeight:700,color:form.bancoId===String(c.id)?c.color:t.text}}>{c.nombre}</div>
              </button>
            ))}
          </div>
        : (()=>{ const caja=cuentas.find((c: any)=>c.tipo==="caja"); return caja
            ? <div style={{padding:"7px 12px",background:t.amberBg,border:`1px solid ${t.amber}33`,borderRadius:8,fontSize:12,color:t.amber,marginBottom:12,fontWeight:600}}>💵 Se debitará de {caja.nombre}</div>
            : null; })()
      }

      <div style={{display:"flex",gap:12}}>
        <Fld label="Monto ($)" half><InpMoney value={form.monto} onChange={(e: any)=>setForm({...form,monto:e.target.value})}/></Fld>
        <Fld label="Fecha" half><Inp type="date" value={form.fecha} onChange={(e: any)=>setForm({...form,fecha:e.target.value})}/></Fld>
      </div>
      <Fld label="Observaciones (opcional)"><Inp placeholder="Ej: Factura 0001-00001234..." value={form.obs} onChange={(e: any)=>setForm({...form,obs:e.target.value})}/></Fld>
      <div style={{display:"flex",gap:10,marginTop:6}}>
        <Btn v="ghost" onClick={onClose} full>Cancelar</Btn>
        <Btn onClick={guardar} disabled={!form.proveedorId||!form.monto||(form.medioPago==="banco"&&!form.bancoId)} full><Ic n="check" s={14}/>Registrar pago</Btn>
      </div>
      </div>
    </OverlaySheet>
  );
}
