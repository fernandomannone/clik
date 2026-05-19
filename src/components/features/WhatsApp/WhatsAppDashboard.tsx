import React, { useState, useEffect } from 'react';
import { BotConfigPanel } from './BotConfigPanel';
import { BotMetricsPanel } from './BotMetricsPanel';
import { BotErrorsPanel } from './BotErrorsPanel';
import { BotAccreditationsPanel } from './BotAccreditationsPanel';
import { getBotConfig, getBotErrors, getBotOperations, DEFAULT_CONFIG } from '../../../services/botService';
import { BotConfig, BotError, BotOperacion } from '../../../types/botTypes';
import { useApp } from '../../../context/AppContext';
import { Btn, Ic } from '../../common/UIBase';
import { PageContainer } from '../../layout/AppShell';

export default function WhatsAppDashboard() {
  const { t } = useApp();
  const [activeBotTab, setActiveBotTab] = useState<'ventas' | 'soporte' | 'alertas'>('ventas');
  const [activeTab, setActiveTab] = useState<'config' | 'monitor' | 'acreditaciones'>('config');
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [errores, setErrores] = useState<BotError[]>([]);
  const [operaciones, setOperaciones] = useState<BotOperacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const timeout = (ms: number, fallback: any) => new Promise<any>(r => setTimeout(() => r(fallback), ms));
      
      const conf = await Promise.race([
        getBotConfig().catch(() => null),
        timeout(2500, null)
      ]);
      const errs = await Promise.race([
        getBotErrors(true).catch(() => []),
        timeout(2500, [])
      ]);
      const ops = await Promise.race([
        getBotOperations().catch(() => []),
        timeout(2500, [])
      ]);
      
      setConfig(conf || DEFAULT_CONFIG);
      setErrores(errs || []);
      setOperaciones(ops || []);
    } catch (e) {
      console.error(e);
      setConfig(DEFAULT_CONFIG);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <PageContainer
      title="Sala de Control: Bots"
      stickyHeader={false}
      sub="Administración central de agentes automatizados (Bot Ventas / Soporte)."
      actions={
        <Btn v="ghost" onClick={fetchData} style={{ position: "relative" }}>
          {isLoading ? (
            <svg 
              className="animate-spin" 
              viewBox="0 0 24 24" 
              style={{ width: 14, height: 14, marginRight: 8, color: t.accent }}
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" style={{ opacity: 0.25 }} />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <Ic n="sync" s={14} />
          )}
          Refrescar Datos
        </Btn>
      }
    >
      {/* Selector Principal de Bots */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
        {[
          { id: 'ventas', label: 'Bot de Ventas', icon: 'ventas', color: t.green },
          { id: 'soporte', label: 'Bot Consultas (Técnico)', icon: 'config', color: t.indigo },
          { id: 'alertas', label: 'Bot Alertas (Saldo)', icon: 'alert', color: t.amber }
        ].map(bot => (
          <button
            key={bot.id}
            onClick={() => setActiveBotTab(bot.id as any)}
            style={{
              padding: "12px 20px",
              borderRadius: "12px",
              border: `1px solid ${activeBotTab === bot.id ? bot.color : t.border}`,
              background: activeBotTab === bot.id ? bot.color + "10" : t.surf,
              color: activeBotTab === bot.id ? bot.color : t.text,
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: activeBotTab === bot.id ? 1 : 0.7
            }}
          >
            <Ic n={bot.icon} s={16} />
            {bot.label}
          </button>
        ))}
      </div>

      {activeBotTab === 'ventas' ? (
        <>
          {/* Tabs Estilo Clik para Ventas */}
          <div style={{ borderBottom: `1px solid ${t.border}`, marginBottom: "32px", display: "flex", gap: "24px" }}>
            {[
              { id: 'config', label: 'Configuración y Horarios' },
              { id: 'monitor', label: 'Monitor y Errores', badge: errores.length },
              { id: 'acreditaciones', label: 'Historial de Acreditaciones' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: "12px 4px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: activeTab === tab.id ? t.accent : t.text + "66",
                  borderBottom: `2px solid ${activeTab === tab.id ? t.accent : "transparent"}`,
                  background: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  borderTop: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                {tab.label}
                {tab.badge ? (
                  <span style={{ background: t.red, color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "10px" }}>{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "24px" }}>
            {isLoading && !config ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
                <Ic n="sync" s={32} style={{ opacity: 0.2 }} />
              </div>
            ) : (
              <>
                {activeTab === 'config' && <BotConfigPanel config={config} onSave={fetchData} />}
                {activeTab === 'monitor' && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
                    <BotMetricsPanel operaciones={operaciones} erroresCount={errores.length} />
                    <BotErrorsPanel errores={errores} onResolved={fetchData} />
                  </div>
                )}
                {activeTab === 'acreditaciones' && <BotAccreditationsPanel operaciones={operaciones} isLoading={isLoading} />}
              </>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", padding: "80px 20px", background: t.surf, borderRadius: "16px", border: `1px dashed ${t.border}`, marginTop: "24px" }}>
          <div style={{ background: t.indigo + "15", color: t.indigo, width: "64px", height: "64px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
            <Ic n="config" s={32} />
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: 800, color: t.text, marginBottom: "8px" }}>Módulo en Construcción</h3>
          <p style={{ fontSize: "14px", color: t.sub, maxWidth: "400px", textAlign: "center", lineHeight: "1.6" }}>
            Estamos preparando la estructura para el {activeBotTab === 'soporte' ? 'Bot de Consultas Técnicas' : 'Bot de Alertas de Saldo'}. Esta funcionalidad estará disponible en la próxima actualización.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
