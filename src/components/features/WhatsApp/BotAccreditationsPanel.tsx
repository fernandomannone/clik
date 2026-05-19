import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { Tbl, Tr, Td, Bdg, Btn, Ic, Inp } from '../../common/UIBase';
import { BotOperacion } from '../../../types/botTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  operaciones: BotOperacion[];
  isLoading?: boolean;
}

export function BotAccreditationsPanel({ operaciones, isLoading }: Props) {
  const { t } = useApp();
  const [filter, setFilter] = useState('');
  const [onlyOutHours, setOnlyOutHours] = useState(false);

  const filtered = operaciones.filter(op => {
    const matchesSearch = 
      op.cliente_nombre?.toLowerCase().includes(filter.toLowerCase()) ||
      op.comprobante_id?.toLowerCase().includes(filter.toLowerCase()) ||
      op.clik_id?.toLowerCase().includes(filter.toLowerCase());
    
    // Asumimos que si tiene una nota o flag de "fuera de horario" la mostramos
    // O si la hora está fuera del rango estándar (esto es más complejo sin la config aquí)
    // Por ahora filtramos por el flag si existiera o por una búsqueda manual de "fuera"
    const isOutHours = op.notas?.toLowerCase().includes('fuera de horario') || op.fuera_horario;
    
    if (onlyOutHours) return matchesSearch && isOutHours;
    return matchesSearch;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 800, color: t.text + "88", marginBottom: "4px" }}>HISTORIAL DE ACREDITACIONES</h3>
          <p style={{ fontSize: "13px", color: t.text + "55" }}>
            Registro de todas las operaciones procesadas por la automatización RPA.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
           <div 
             onClick={() => setOnlyOutHours(!onlyOutHours)}
             style={{ 
               display: "flex", 
               alignItems: "center", 
               gap: "8px", 
               background: onlyOutHours ? t.amber + "15" : "transparent",
               padding: "8px 12px",
               borderRadius: "8px",
               border: `1px solid ${onlyOutHours ? t.amber + "44" : t.border}`,
               cursor: "pointer",
               fontSize: "12px",
               fontWeight: 700,
               color: onlyOutHours ? t.amber : t.text + "66"
             }}
           >
             <Ic n="schedule" s={14} /> Solo fuera de horario
           </div>
           <div style={{ width: "250px" }}>
              <Inp 
                placeholder="Buscar cliente o comprobante..." 
                value={filter} 
                onChange={(e: any) => setFilter(e.target.value)}
              />
           </div>
        </div>
      </div>

      <Tbl
        headers={['Fecha/Hora', 'Cliente', 'Monto', 'Banco / Origen', 'Foto', 'Estado', 'RPA / Notas', 'Concil.']}
      >
        {filtered.length === 0 ? (
          <Tr>
            <Td colSpan={6} align="center" style={{ padding: "40px", color: t.text + "44" }}>
              No se encontraron acreditaciones que coincidan con los filtros.
            </Td>
          </Tr>
        ) : (
          filtered.map((op) => (
            <Tr key={op.id}>
              <Td>
                <div style={{ fontWeight: 700, fontSize: "12px", color: t.text }}>
                  {format(new Date(op.fecha), 'dd MMM, HH:mm', { locale: es })}
                </div>
                {op.fuera_horario && (
                  <div style={{ fontSize: "10px", color: t.amber, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                    <Ic n="schedule" s={10} /> FUERA DE HORARIO
                  </div>
                )}
              </Td>
              <Td>
                <div style={{ fontWeight: 700, fontSize: "12px", color: t.text }}>{op.cliente_nombre || 'Cliente Desconocido'}</div>
                <div style={{ fontSize: "10px", color: t.text + "44" }}>ID CLIK: {op.clik_id}</div>
              </Td>
              <Td>
                <div style={{ fontWeight: 900, fontSize: "13px", color: t.green }}>
                  ${Number(op.monto).toLocaleString('es-AR')}
                </div>
              </Td>
              <Td>
                <div style={{ fontSize: "12px", fontWeight: 600 }}>{op.banco_nombre || 'S/D'}</div>
                <div style={{ fontSize: "10px", color: t.text + "44" }}>Ref: {op.comprobante_id}</div>
              </Td>
              <Td>
                {op.comprobante_url ? (
                  <div 
                    onClick={() => window.open(op.comprobante_url, '_blank')}
                    style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 8, 
                      overflow: 'hidden', 
                      cursor: 'pointer',
                      border: `1px solid ${t.border}`,
                      background: t.surf2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img src={op.comprobante_url} alt="Cpb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ color: t.text + "22" }}><Ic n="image" s={20} /></div>
                )}
              </Td>
              <Td>
                <Bdg c={
                  op.estado === 'completado' ? t.green :
                  op.estado === 'error' ? t.red :
                  op.estado === 'pendiente' ? t.amber : t.gray
                }>
                  {op.estado.toUpperCase()}
                </Bdg>
              </Td>
              <Td>
                <div style={{ fontSize: "11px", color: t.text + "66", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {op.notas || 'Sin observaciones'}
                </div>
                {op.recibo_id && (
                  <div style={{ fontSize: "9px", color: t.accent, fontWeight: 700, marginTop: 2 }}>
                    {op.recibo_id}
                  </div>
                )}
              </Td>
              <Td>
                {op.conciliado_banco ? (
                  <div title="Cruzado con Extracto Bancario" style={{ color: t.green }}>
                    <Ic n="check" s={16} />
                  </div>
                ) : (
                  <div title="Pendiente de Conciliación" style={{ color: t.text + "15" }}>
                    <Ic n="schedule" s={16} />
                  </div>
                )}
              </Td>
            </Tr>
          ))
        )}
      </Tbl>
    </div>
  );
}
