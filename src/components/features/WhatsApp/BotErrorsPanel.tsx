import { BotError } from '../../../types/botTypes';
import { markErrorResolved } from '../../../services/botService';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { Tbl, Tr, Td, Bdg, Btn, Ic } from '../../common/UIBase';

interface Props {
  errores: BotError[];
  onResolved: () => void;
}

export const BotErrorsPanel = ({ errores, onResolved }: Props) => {
  const { t } = useApp();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await markErrorResolved(id);
      onResolved();
    } catch(e) {
      console.error(e);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div>
      <div style={{ borderBottom: `1px solid ${t.border}`, paddingBottom: "12px", marginBottom: "24px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 800, color: t.text + "88" }}>COLA DE ERRORES - INTERVENCIÓN MANUAL</h3>
      </div>
      
      {errores.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", background: t.surf, borderRadius: "12px", border: `1px solid ${t.border}` }}>
          <div style={{ width: "64px", height: "64px", background: t.green + "11", borderRadius: "100%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
             <CheckCircle2 size={32} style={{ color: t.green, margin: "auto" }} />
          </div>
          <h4 style={{ fontWeight: 800, color: t.text, fontSize: "18px" }}>Sistema Operativo</h4>
          <p style={{ color: t.text + "66", fontSize: "14px", marginTop: "4px" }}>No hay incidencias pendientes que requieran tu atención.</p>
        </div>
      ) : (
        <Tbl headers={['Trazabilidad', 'Motivo', 'Detalle Técnico', 'Acción']}>
          {errores.map(err => (
            <Tr key={err.id}>
              <Td>
                <div style={{ fontWeight: 700, fontSize: "12px", color: t.text }}>{err.operacion_id}</div>
                <div style={{ fontSize: "11px", color: t.text + "66" }}>{new Date(err.created).toLocaleString()}</div>
              </Td>
              <Td>
                <Bdg c={t.red}>
                  {err.motivo.toUpperCase()}
                </Bdg>
              </Td>
              <Td>
                <div style={{ maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "13px", color: t.text + "88", fontStyle: "italic" }}>
                  "{err.detalle}"
                </div>
              </Td>
              <Td align="right">
                <Btn 
                  v="primary" 
                  onClick={() => handleResolve(err.id)}
                  loading={resolvingId === err.id}
                  style={{ height: "32px", fontSize: "12px" }}
                >
                  Resolver
                </Btn>
              </Td>
            </Tr>
          ))}
        </Tbl>
      )}
    </div>
  );
};
