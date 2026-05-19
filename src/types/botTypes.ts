export interface BotConfig {
  bot_activo: boolean;
  modo_247: boolean;
  horario_inicio: number;
  horario_fin: number;
  msg_bienvenida: string;
  msg_instrucciones?: string;
  msg_analizando: string;
  msg_exito: string;
  msg_fuera_hora: string;
  msg_no_cliente: string;
  msg_duplicado: string;
  msg_error: string;
  rgpseac_url?: string;
  rgpseac_user?: string;
  rgpseac_pass?: string;
  rgpseac_clave?: string;
  articulo_clik: string;
  modo_guardia: boolean;
  atender_cc: boolean;
  cc_solo_notificar: boolean;
  validar_limite_deuda: boolean;
}

export interface BotCliente {
  id: string;
  cliente_id_clik: number;
  nombre_clik: string;
  numero_wa: string;
  nombre_rgpseac: string;
  tipo: 'Prepago' | 'Cuenta Corriente';
  cuenta_destino: number;
}

export interface BotOperacion {
  id: string;
  cliente_id_clik: number;
  clik_id?: string; // ID visual de Clik
  cliente_nombre?: string;
  numero_wa: string;
  monto: number;
  fecha: string;
  id_bancario: string;
  comprobante_id?: string;
  banco_nombre?: string;
  cuenta_destino: number;
  articulo_clik: string;
  estado: 'completado' | 'rechazado' | 'error' | 'duplicado' | 'sin_cliente' | 'pendiente';
  comprobante_valido: boolean;
  fuera_horario?: boolean;
  notas?: string;
  comprobante_url?: string;
  recibo_id?: string | number; // ID del recibo generado en Clik
  conciliado_banco?: boolean; // Si ya se cruzó con el extracto bancario
  created: string;
}

export interface BotError {
  id: string;
  operacion_id: string;
  motivo: string;
  detalle: string;
  intentos: number;
  resuelto: boolean;
  created: string;
}
