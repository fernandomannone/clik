import { BotConfig, BotOperacion, BotError, BotCliente } from '../types/botTypes';
import { pb } from '../lib/pocketbase';

// Mantenemos una config base por si no existe en DB
export const DEFAULT_CONFIG: BotConfig = {
  bot_activo: true,
  modo_247: false,
  horario_inicio: 8,
  horario_fin: 20,
  msg_bienvenida: "¡Hola! Bienvenido al sistema de autogestión de Clik.",
  msg_instrucciones: "Por favor, envíanos la imagen de tu comprobante de transferencia para acreditar tu saldo.",
  msg_analizando: "He recibido tu comprobante. Estoy analizando los datos para procesar la acreditación. Aguarda un momento...",
  msg_exito: "¡Éxito! Tu saldo ha sido acreditado correctamente. Muchas gracias.",
  atender_cc: false,
  cc_solo_notificar: true,
  validar_limite_deuda: false,
  msg_fuera_hora: "Hola. Actualmente estamos fuera de nuestro horario de atención (8 a 20hs). Tu solicitud será procesada apenas iniciemos nuestra jornada.",
  msg_no_cliente: "Lo sentimos, este número de WhatsApp no se encuentra vinculado a ningún cliente registrado en Clik. Por favor, contacta a la administración.",
  msg_duplicado: "Este comprobante ya ha sido procesado anteriormente. Por favor, verifica tus movimientos.",
  msg_error: "Hubo un problema al procesar tu solicitud. Un operador revisará tu caso a la brevedad.",
  rgpseac_url: 'https://sistema.rgp-seac.com.ar/login',
  rgpseac_user: '',
  rgpseac_pass: '',
  rgpseac_clave: '',
  articulo_clik: '044',
  modo_guardia: false
};

export const getBotConfig = async (): Promise<BotConfig> => {
  try {
    // Intentamos obtener el primer registro de la colección bot_config
    const record = await pb.collection('bot_config').getFirstListItem('', { $autoCancel: false });
    return { 
      ...DEFAULT_CONFIG, 
      ...record,
      // Map properties with typos from DB back to our standard keys
      horario_inicio: record.hoario_inicio !== undefined ? record.hoario_inicio : record.horario_inicio,
      rgpseac_pass: record.fieldrgpseac_pass !== undefined ? record.fieldrgpseac_pass : record.rgpseac_pass,
      id: record.id 
    } as any;
  } catch (e) {
    console.warn("No se encontró configuración del bot en PocketBase, usando valores por defecto.");
    return DEFAULT_CONFIG;
  }
};

export const updateBotConfig = async (newConfig: Partial<BotConfig & { id?: string }>): Promise<BotConfig> => {
  try {
    // Evitar que PocketBase tire 400 Bad Request si enviamos campos del sistema
    const { id, collectionId, collectionName, created, updated, expand, ...cleanData } = newConfig as any;

    // Map properties from UI side to match DB typo columns before saving
    const dataToSave = { ...cleanData };
    if (dataToSave.horario_inicio !== undefined) {
      dataToSave.hoario_inicio = dataToSave.horario_inicio;
      delete dataToSave.horario_inicio; // Avoid sending invalid fields
    }
    if (dataToSave.rgpseac_pass !== undefined) {
      dataToSave.fieldrgpseac_pass = dataToSave.rgpseac_pass;
      delete dataToSave.rgpseac_pass; // Avoid sending invalid fields
    }

    if (id) {
      const record = await pb.collection('bot_config').update(id, dataToSave);
      return { ...DEFAULT_CONFIG, ...record } as any;
    } else {
      // Si no hay ID, intentamos ver si hay alguno para actualizar o creamos
      try {
        const existing = await pb.collection('bot_config').getFirstListItem('', { $autoCancel: false });
        const record = await pb.collection('bot_config').update(existing.id, dataToSave);
        return { ...DEFAULT_CONFIG, ...record } as any;
      } catch (err) {
        const record = await pb.collection('bot_config').create(dataToSave);
        return { ...DEFAULT_CONFIG, ...record } as any;
      }
    }
  } catch (e) {
    console.error("Error actualizando config en PocketBase:", e);
    throw e;
  }
};

export const getBotErrors = async (onlyUnresolved = false): Promise<BotError[]> => {
  try {
    const filter = onlyUnresolved ? 'resuelto = false' : '';
    const records = await pb.collection('bot_cola_errores').getFullList({
      filter,
      sort: '-created',
      $autoCancel: false
    });
    return records.map(r => ({ ...r, id: r.id })) as any;
  } catch (e: any) {
    if (e.status !== 404 && e.status !== 400 && !e?.message?.includes("Something went wrong")) {
      console.error("Error cargando errores del bot:", e?.message || e);
    }
    return [];
  }
};

export const markErrorResolved = async (id: string): Promise<void> => {
  try {
    await pb.collection('bot_cola_errores').update(id, { resuelto: true });
  } catch (e: any) {
    if (e.status !== 404 && e.status !== 400 && !e?.message?.includes("Something went wrong")) {
      console.error("Error resolviendo error:", e?.message || e);
    }
  }
};

export const getBotOperations = async (): Promise<BotOperacion[]> => {
  try {
    const records = await pb.collection('bot_operaciones').getFullList({
      sort: '-created',
      $autoCancel: false
    });
    return records.map(r => ({ ...r, id: r.id })) as any;
  } catch (e: any) {
    if (e.status !== 404 && e.status !== 400 && !e?.message?.includes("Something went wrong")) {
      console.error("Error cargando operaciones:", e?.message || e);
    }
    return [];
  }
};

export const getBotClients = async (): Promise<BotCliente[]> => {
  try {
    const records = await pb.collection('bot_clientes').getFullList({
      sort: 'nombre_clik',
      $autoCancel: false
    });
    return records.map(r => ({ ...r, id: r.id })) as any;
  } catch (e: any) {
    if (e.status !== 404 && e.status !== 400 && !e?.message?.includes("Something went wrong")) {
      console.error("Error cargando clientes del bot:", e?.message || e);
    }
    return [];
  }
};

export const updateBotClient = async (id: string, updates: Partial<BotCliente>): Promise<BotCliente> => {
  try {
    const record = await pb.collection('bot_clientes').update(id, updates);
    return { ...record, id: record.id } as any;
  } catch (e) {
    console.error("Error actualizando cliente del bot:", e);
    throw e;
  }
};

