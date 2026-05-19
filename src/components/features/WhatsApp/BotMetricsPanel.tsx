import { BotOperacion } from '../../../types/botTypes';
import { CheckCircle2, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Bdg } from '../../common/UIBase';

interface Props {
  operaciones: BotOperacion[];
  erroresCount: number;
}

export const BotMetricsPanel = ({ operaciones, erroresCount }: Props) => {
  const { t } = useApp();
  const hoy = new Date().toISOString().split('T')[0];
  const opsHoy = operaciones.filter(o => o.fecha === hoy || (o.fecha && o.fecha.startsWith(hoy)));
  const montoHoy = opsHoy.filter(o => o.estado === 'completado').reduce((acc, curr) => acc + curr.monto, 0);
  
  const sortedOps = [...operaciones].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  const lastOp = sortedOps.length > 0 ? sortedOps[0] : null;

  const cardStyle = {
    background: t.surf,
    border: `1px solid ${t.border}`,
    borderRadius: '12px',
    padding: '20px'
  };

  const opsFueraHorario = opsHoy.filter(o => o.fuera_horario);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div style={cardStyle}>
          <div className="flex items-center gap-2 mb-3" style={{ color: t.accent }}>
            <TrendingUp size={16} />
            <h4 style={{ fontWeight: 700, fontSize: '13px' }}>Acreditaciones Hoy</h4>
          </div>
          <p style={{ fontSize: '28px', fontWeight: 800, color: t.text }}>${montoHoy.toLocaleString()}</p>
          <p style={{ fontSize: '11px', color: t.green, fontWeight: 700, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
             {opsHoy.length} operaciones procesadas
          </p>
        </div>

        <div style={{ ...cardStyle, background: opsFueraHorario.length > 0 ? t.amber + '08' : t.surf }}>
          <div className="flex items-center gap-2 mb-3" style={{ color: opsFueraHorario.length > 0 ? t.amber : t.text + '55' }}>
            <Clock size={16} />
            <h4 style={{ fontWeight: 700, fontSize: '13px' }}>Fuera de Horario</h4>
          </div>
          <p style={{ fontSize: '28px', fontWeight: 800, color: opsFueraHorario.length > 0 ? t.amber : t.text + '33' }}>{opsFueraHorario.length}</p>
          <p style={{ fontSize: '11px', color: t.text + '66', fontWeight: 500, marginTop: '8px' }}>Operaciones nocturnas/finde</p>
        </div>

        <div style={{ ...cardStyle, background: erroresCount > 0 ? t.red + '08' : t.surf }}>
          <div className="flex items-center gap-2 mb-3" style={{ color: erroresCount > 0 ? t.red : t.text + '55' }}>
            <AlertTriangle size={16} />
            <h4 style={{ fontWeight: 700, fontSize: '13px' }}>Cola de Incidencias</h4>
          </div>
          <p style={{ fontSize: '28px', fontWeight: 800, color: erroresCount > 0 ? t.red : t.text + '33' }}>{erroresCount}</p>
          <p style={{ fontSize: '11px', color: t.text + '66', fontWeight: 500, marginTop: '8px' }}>Requieren revisión manual</p>
        </div>

        <div style={cardStyle}>
           <div className="flex items-center gap-2 mb-3" style={{ color: t.green }}>
            <CheckCircle2 size={16} />
            <h4 style={{ fontWeight: 700, fontSize: '13px' }}>Actividad Reciente</h4>
          </div>
          {lastOp ? (
             <div className="flex items-center justify-between">
               <div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: t.text }}>${lastOp.monto.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Bdg c={lastOp.estado === 'completado' ? t.green : t.red}>
                      {lastOp.estado.toUpperCase()}
                    </Bdg>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: t.text + '66' }}>WA: {lastOp.numero_wa}</span>
                  </div>
               </div>
               <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: t.text }}>{new Date(lastOp.created).toLocaleTimeString()}</p>
                  <p style={{ fontSize: '10px', fontWeight: 500, color: t.text + '44' }}>ID BANC: {lastOp.id_bancario}</p>
               </div>
             </div>
          ) : (
            <p style={{ fontSize: '11px', color: t.text + '44', fontStyle: 'italic', padding: '10px 0' }}>Esperando actividad...</p>
          )}
        </div>
      </div>
    </div>
  );
};
