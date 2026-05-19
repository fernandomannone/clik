import React, { useState, useEffect } from 'react';
import { BotConfig } from '../../../types/botTypes';
import { updateBotConfig } from '../../../services/botService';
import { Save, AlertCircle, Clock, ShieldCheck, MessageSquare } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Fld, Inp, Btn, Ic } from '../../common/UIBase';

interface Props {
  config: BotConfig | null;
  onSave: () => void;
}

export const BotConfigPanel = ({ config, onSave }: Props) => {
  const { t, isDark } = useApp();
  const [formData, setFormData] = useState<BotConfig | null>(config);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(config);
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => prev ? { ...prev, [name]: checked } : null);
    } else if (type === 'number') {
      setFormData(prev => prev ? { ...prev, [name]: parseInt(value) || 0 } : null);
    } else {
      setFormData(prev => prev ? { ...prev, [name]: value } : null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    setIsSaving(true);
    console.log("Submitting formData to save:", formData);
    try {
      const updatedData = await updateBotConfig(formData);
      console.log("Bot config updated successfully:", updatedData);
      onSave(); // Refresca los datos usando el prop del parent
      alert("Configuración guardada exitosamente.");
    } catch (e: any) {
      console.error("Error from updateBotConfig:", e);
      alert("Error al guardar la configuración: " + (e.message || "Verifique que la tabla 'bot_config' exista en PocketBase con los permisos correctos."));
    } finally {
      setIsSaving(false);
    }
  };

  if (!formData) return null;

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px" }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: t.text + "88", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
               CONTROL DE OPERACIÓN
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div 
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "16px 20px", 
                  borderRadius: "12px", 
                  border: `1px solid ${formData.bot_activo ? t.green + '44' : t.border}`,
                  background: formData.bot_activo ? t.green + '05' : t.surf
                }}
              >
                <div>
                  <span style={{ fontWeight: 800, fontSize: "15px", display: "block", color: formData.bot_activo ? t.green : t.text }}>BOT ACTIVO</span>
                  <span style={{ fontSize: "11px", color: t.text + "66", fontWeight: 600 }}>Interruptor general de automatización.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="bot_activo" checked={formData.bot_activo} onChange={handleChange} className="sr-only peer" />
                  <div className={`w-11 h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500`}></div>
                </label>
              </div>

              {!formData.bot_activo && (
                <div style={{ fontSize: "11px", color: t.red, fontWeight: 700, padding: "8px 12px", background: t.red + "08", borderRadius: "8px", border: `1px solid ${t.red}15`, textAlign: "center" }}>
                  ⚠️ EL BOT ESTÁ COMPLETAMENTE APAGADO. NO HABRÁ RESPUESTAS AUTOMÁTICAS.
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.surf }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: "14px", display: "block", color: t.text }}>Modo 24/7 (Sin horario)</span>
                  <span style={{ fontSize: "12px", color: t.text + "66" }}>Ignora la apertura y cierre configurados.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="modo_247" checked={formData.modo_247} onChange={handleChange} className="sr-only peer" />
                  <div className={`w-11 h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500`}></div>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderRadius: "14px", border: `2px solid ${formData.modo_guardia ? t.indigo + "44" : t.border}`, background: formData.modo_guardia ? t.indigo + "05" : t.bg, transition: "all 0.2s" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: "14px", color: formData.modo_guardia ? t.indigo : t.text }}>MODO GUARDIA (SÁBADOS)</span>
                    <div style={{ padding: "2px 6px", background: t.indigo, color: "#fff", borderRadius: "4px", fontSize: "9px", fontWeight: 900 }}>PRO</div>
                  </div>
                  <span style={{ fontSize: "11px", color: t.text + "66", fontWeight: 600 }}>El Bot acredita a TODO cliente (CC y Prepago) ignorando filtros habituales.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="modo_guardia" checked={formData.modo_guardia} onChange={handleChange} className="sr-only peer" />
                  <div className={`w-11 h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600`}></div>
                </label>
              </div>

              {!formData.modo_247 && (
                <div style={{ padding: "20px", background: t.surf, borderRadius: "14px", border: `1px solid ${t.border}`, marginTop: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "16px" }}>
                    <Ic n="schedule" s={18} style={{ color: t.amber }} />
                    <div>
                      <span style={{ fontWeight: 800, fontSize: "13px", display: "block" }}>RANGO DE OPERACIÓN AUTOMÁTICA</span>
                      <span style={{ fontSize: "11px", color: t.text + "66" }}>Define en qué horario el bot procesará acreditaciones.</span>
                    </div>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <Fld label="Opera desde las:">
                      <select 
                        name="horario_inicio" 
                        value={formData.horario_inicio} 
                        onChange={(e: any) => setFormData({...formData, horario_inicio: parseInt(e.target.value)})}
                        style={{ width: "100%", height: "42px", borderRadius: "8px", border: `1px solid ${t.border}`, padding: "0 12px", fontSize: "14px", fontWeight: 700, background: t.bg, color: t.text }}
                      >
                        {Array.from({ length: 24 }).map((_, i) => (
                          <option key={i} value={i}>{i.toString().padStart(2, '0')}:00 hs</option>
                        ))}
                      </select>
                    </Fld>
                    <Fld label="Hasta las:">
                      <select 
                        name="horario_fin" 
                        value={formData.horario_fin} 
                        onChange={(e: any) => setFormData({...formData, horario_fin: parseInt(e.target.value)})}
                        style={{ width: "100%", height: "42px", borderRadius: "8px", border: `1px solid ${t.border}`, padding: "0 12px", fontSize: "14px", fontWeight: 700, background: t.bg, color: t.text }}
                      >
                        {Array.from({ length: 24 }).map((_, i) => (
                          <option key={i} value={i}>{i.toString().padStart(2, '0')}:00 hs</option>
                        ))}
                      </select>
                    </Fld>
                  </div>

                  <div style={{ marginTop: "16px", padding: "8px 12px", background: t.amber + "10", borderRadius: "8px", border: `1px dashed ${t.amber}44`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.amber, boxShadow: `0 0 8px ${t.amber}` }} />
                    <span style={{ fontSize: "11px", fontWeight: 700, color: t.amber }}>
                      EL BOT RESPONDERÁ ENTRE LAS {formData.horario_inicio.toString().padStart(2, '0')}:00 Y LAS {formData.horario_fin.toString().padStart(2, '0')}:00 HS
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: t.text + "88", marginBottom: "20px" }}>CREDENCIALES RGP-SEAC</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
               <Fld label="URL del Sistema">
                <Inp type="url" name="rgpseac_url" value={formData.rgpseac_url || ''} onChange={handleChange} placeholder="https://..." />
              </Fld>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <Fld label="Usuario">
                  <Inp type="text" name="rgpseac_user" value={formData.rgpseac_user || ''} onChange={handleChange} />
                </Fld>
                <Fld label="Contraseña">
                  <Inp type="password" name="rgpseac_pass" value={formData.rgpseac_pass || ''} onChange={handleChange} />
                </Fld>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <Fld label="Pin Maestro de Vendedor">
                  <Inp type="password" name="rgpseac_clave" value={formData.rgpseac_clave || ''} onChange={handleChange} />
                </Fld>
                <Fld label="Cód. Artículo Facturar (Clik)">
                  <Inp type="text" name="articulo_clik" value={formData.articulo_clik || ''} onChange={handleChange} placeholder="Ej: 044" />
                </Fld>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: t.text + "88", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Ic n="whatsapp" s={18} /> FLUJO CONVERSACIONAL DEL BOT
            </h3>
            
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "28px", paddingLeft: "32px" }}>
              {/* Línea conectora visual */}
              <div style={{ position: "absolute", left: "14px", top: "10px", bottom: "10px", width: "2px", background: `linear-gradient(to bottom, ${t.amber}, ${t.indigo}, ${t.green})`, opacity: 0.3 }} />

               {/* Paso 1: Saludo e Inicio */}
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "-23px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: t.amber, border: `2px solid ${t.bg}` }} />
                <div style={{ fontSize: "11px", fontWeight: 900, color: t.amber, marginBottom: "6px", textTransform: "uppercase", letterSpacing: 0.5 }}>1. Inicio de Conversación</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <Fld label="Saludo de Bienvenida inicial">
                    <textarea 
                      name="msg_bienvenida" 
                      value={formData.msg_bienvenida || ''} 
                      onChange={handleChange} 
                      style={{ 
                        width: "100%", 
                        background: isDark ? t.surf : "#fff", 
                        border: `1px solid ${t.border}`, 
                        borderRadius: "10px", 
                        padding: "12px 16px", 
                        color: t.text, 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        lineHeight: "1.5",
                        resize: "vertical", 
                        minHeight: "60px", 
                        outline: "none", 
                        fontFamily: "inherit",
                        boxSizing: "border-box", 
                        boxShadow: isDark ? "none" : "0 2px 4px rgba(0,0,0,0.03)",
                        transition: "border-color 0.2s"
                      }} 
                    />
                  </Fld>
                  <Fld label="Instrucciones al pedir el comprobante">
                    <textarea 
                      name="msg_instrucciones" 
                      value={formData.msg_instrucciones || ''} 
                      onChange={handleChange} 
                      style={{ 
                        width: "100%", 
                        background: isDark ? t.surf : "#fff", 
                        border: `1px solid ${t.border}`, 
                        borderRadius: "10px", 
                        padding: "12px 16px", 
                        color: t.text, 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        lineHeight: "1.5",
                        resize: "vertical", 
                        minHeight: "60px", 
                        outline: "none", 
                        fontFamily: "inherit",
                        boxSizing: "border-box", 
                        boxShadow: isDark ? "none" : "0 2px 4px rgba(0,0,0,0.03)",
                        transition: "border-color 0.2s"
                      }} 
                    />
                  </Fld>
                  <Fld label="Si el cliente escribe en horario de descanso (bot cerrado)">
                    <textarea 
                      name="msg_fuera_hora" 
                      value={formData.msg_fuera_hora || ''} 
                      onChange={handleChange} 
                      style={{ 
                        width: "100%", 
                        background: isDark ? t.surf : "#fff", 
                        border: `1px solid ${t.border}`, 
                        borderRadius: "10px", 
                        padding: "12px 16px", 
                        color: t.text, 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        lineHeight: "1.5",
                        resize: "vertical", 
                        minHeight: "80px", 
                        outline: "none", 
                        fontFamily: "inherit",
                        boxSizing: "border-box", 
                        boxShadow: isDark ? "none" : "0 2px 4px rgba(0,0,0,0.03)",
                        transition: "border-color 0.2s"
                      }} 
                    />
                  </Fld>
                </div>
              </div>

              {/* Paso 2: Análisis de Imagen */}
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "-23px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: t.indigo, border: `2px solid ${t.bg}` }} />
                <div style={{ fontSize: "11px", fontWeight: 900, color: t.indigo, marginBottom: "6px", textTransform: "uppercase", letterSpacing: 0.5 }}>2. Recepción de Comprobante</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <Fld label="Respuesta al recibir la imagen (Feedback de análisis)">
                    <textarea 
                      name="msg_analizando" 
                      value={formData.msg_analizando || ''} 
                      onChange={handleChange} 
                      style={{ 
                        width: "100%", 
                        background: isDark ? t.surf : "#fff", 
                        border: `1px solid ${t.border}`, 
                        borderRadius: "10px", 
                        padding: "12px 16px", 
                        color: t.text, 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        lineHeight: "1.5",
                        resize: "vertical", 
                        minHeight: "80px", 
                        outline: "none", 
                        fontFamily: "inherit",
                        boxSizing: "border-box", 
                        boxShadow: isDark ? "none" : "0 2px 4px rgba(0,0,0,0.03)",
                        transition: "border-color 0.2s"
                      }} 
                    />
                  </Fld>
                </div>
              </div>

              {/* Paso 3: Validación y Filtros */}
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "-23px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: t.red, border: `2px solid ${t.bg}` }} />
                <div style={{ fontSize: "11px", fontWeight: 900, color: t.red, marginBottom: "6px", textTransform: "uppercase", letterSpacing: 0.5 }}>3. Validación Automática (Casos de Error)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <Fld label="Si el número no está registrado">
                    <textarea 
                      name="msg_no_cliente" 
                      value={formData.msg_no_cliente || ''} 
                      onChange={handleChange} 
                      style={{ 
                        width: "100%", 
                        background: isDark ? t.surf : "#fff", 
                        border: `1px solid ${t.border}`, 
                        borderRadius: "10px", 
                        padding: "12px 16px", 
                        color: t.text, 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        lineHeight: "1.5",
                        resize: "vertical", 
                        minHeight: "80px", 
                        outline: "none", 
                        fontFamily: "inherit",
                        boxSizing: "border-box", 
                        boxShadow: isDark ? "none" : "0 2px 4px rgba(0,0,0,0.03)",
                        transition: "border-color 0.2s"
                      }} 
                    />
                  </Fld>
                  <Fld label="Si el comprobante ya fue usado (Duplicado)">
                    <textarea 
                      name="msg_duplicado" 
                      value={formData.msg_duplicado || ''} 
                      onChange={handleChange} 
                      style={{ 
                        width: "100%", 
                        background: isDark ? t.surf : "#fff", 
                        border: `1px solid ${t.border}`, 
                        borderRadius: "10px", 
                        padding: "12px 16px", 
                        color: t.text, 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        lineHeight: "1.5",
                        resize: "vertical", 
                        minHeight: "80px", 
                        outline: "none", 
                        fontFamily: "inherit",
                        boxSizing: "border-box", 
                        boxShadow: isDark ? "none" : "0 2px 4px rgba(0,0,0,0.03)",
                        transition: "border-color 0.2s"
                      }} 
                    />
                  </Fld>
                </div>
              </div>

              {/* Paso 4: Cierre y Éxito */}
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "-23px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: t.green, border: `2px solid ${t.bg}` }} />
                <div style={{ fontSize: "11px", fontWeight: 900, color: t.green, marginBottom: "6px", textTransform: "uppercase", letterSpacing: 0.5 }}>4. Finalización / Éxito</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <Fld label="Confirmación de acreditación exitosa">
                    <textarea 
                      name="msg_exito" 
                      value={formData.msg_exito || ''} 
                      onChange={handleChange} 
                      style={{ 
                        width: "100%", 
                        background: isDark ? t.surf : "#fff", 
                        border: `1px solid ${t.border}`, 
                        borderRadius: "10px", 
                        padding: "12px 16px", 
                        color: t.text, 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        lineHeight: "1.5",
                        resize: "vertical", 
                        minHeight: "80px", 
                        outline: "none", 
                        fontFamily: "inherit",
                        boxSizing: "border-box", 
                        boxShadow: isDark ? "none" : "0 2px 4px rgba(0,0,0,0.03)",
                        transition: "border-color 0.2s"
                      }} 
                    />
                  </Fld>
                  <Fld label="En caso de error inesperado del sistema">
                    <textarea 
                      name="msg_error" 
                      value={formData.msg_error || ''} 
                      onChange={handleChange} 
                      style={{ 
                        width: "100%", 
                        background: isDark ? t.surf : "#fff", 
                        border: `1px solid ${t.border}`, 
                        borderRadius: "10px", 
                        padding: "12px 16px", 
                        color: t.text, 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        lineHeight: "1.5",
                        resize: "vertical", 
                        minHeight: "80px", 
                        outline: "none", 
                        fontFamily: "inherit",
                        boxSizing: "border-box", 
                        boxShadow: isDark ? "none" : "0 2px 4px rgba(0,0,0,0.03)",
                        transition: "border-color 0.2s"
                      }} 
                    />
                  </Fld>
                </div>
              </div>

              {/* Paso 5: Reglas de Negocio Inteligentes */}
              <div style={{ position: "relative", marginTop: "12px", paddingTop: "24px", borderTop: `1px dashed ${t.border}` }}>
                <div style={{ position: "absolute", left: "-23px", top: "28px", width: "10px", height: "10px", borderRadius: "50%", background: t.indigo, border: `2px solid ${t.bg}` }} />
                <div style={{ fontSize: "11px", fontWeight: 900, color: t.indigo, marginBottom: "12px", textTransform: "uppercase", letterSpacing: 0.5 }}>5. Inteligencia de Negocio y Reglas</div>
                
                <div style={{ background: t.indigo + "08", padding: "16px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "16px", border: `1px solid ${t.indigo}20` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: t.text }}>Atender Clientes de Cuenta Corriente (CC)</div>
                      <div style={{ fontSize: "11px", color: t.sub }}>Define si el bot debe responder a clientes que no son Prepago.</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" name="atender_cc" checked={formData.atender_cc || false} onChange={handleChange} className="sr-only peer" />
                      <div className={`w-9 h-5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500`}></div>
                    </label>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: formData.atender_cc ? 1 : 0.5 }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: t.text }}>CC: Solo Notificar Recibo (Modo Informativo)</div>
                      <div style={{ fontSize: "11px", color: t.sub }}>El bot avisa que recibió el comprobante pero NO lo procesa en el portal RPA.</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" name="cc_solo_notificar" checked={formData.cc_solo_notificar || false} onChange={handleChange} disabled={!formData.atender_cc} className="sr-only peer" />
                      <div className={`w-9 h-5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500`}></div>
                    </label>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: t.text }}>Validar Límite de Deuda Automáticamente</div>
                      <div style={{ fontSize: "11px", color: t.sub }}>Si el cliente tiene deuda pendiente mayor al límite, el bot rechazará la carga.</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" name="validar_limite_deuda" checked={formData.validar_limite_deuda || false} onChange={handleChange} className="sr-only peer" />
                      <div className={`w-9 h-5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500`}></div>
                    </label>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${t.border}`, marginTop: "60px", paddingTop: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: "13px", color: t.text + "55", fontWeight: 600 }}>
          <Ic n="alert" s={14} style={{ marginRight: "8px" }} />
          Sincronización RPA activa en tiempo real.
        </p>
        <Btn v="primary" onClick={handleSubmit} loading={isSaving} style={{ padding: "0 40px", height: "48px" }}>
          Guardar Configuración
        </Btn>
      </div>
    </form>
  );
};
