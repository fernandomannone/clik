# Clik - Brief Técnico Bot de Ventas WhatsApp

**Versión:** 1.1 | **Mes:** Mayo 2026

## 1. Contexto del Proyecto
Clik es un sistema de gestión comercial para una tabaquería y negocio de Carga Virtual (CV) en San Juan, Argentina. El sistema corre sobre PocketBase localmente en una intranet de 4 PCs.

El negocio vende saldo prepago a clientes directos mediante WhatsApp. El objetivo de este bot es operar en el horario no comercial de forma autónoma, sin intervención humana, acreditando saldo (RGP-SEAC) y registrando la venta en Clik automáticamente.

- **Cliente objetivo:** Clientes DIRECTOS prepago (excluye Vendedores Cuenta Corriente).
- **Horario del bot:** Configurable desde el panel de control de Clik.
- **Modos de operación especiales:**
  - **Modo 24/7:** Activa el bot para operar de corrido, ignorando el esquema de horarios.
  - **Modo Guardia (NUEVO):** Modo especial para sábados/fines de semana. Cuando se activa, el bot ignora el filtro de "Solo Clientes Prepago" y **acredita saldo automáticamente a TODOS los clientes**, incluyendo Vendedores de Cuenta Corriente (CC), permitiéndoles operar y facturar sin depender de un humano en los días de guardia.

## 2. Arquitectura del Sistema
- **Runtime:** Node.js 18+
- **Mensajería:** whatsapp-web.js
- **Extracción de datos IA:** Gemini API (Google Gen AI) para evitar sobrecostos innecesarios con intermediarios y simplificar el análisis del comprobante bancario.
- **RPA web:** Puppeteer 19.x (para acreditar en RGP-SEAC)
- **Base de datos:** API REST a la instancia local de PocketBase existente.

## 3. Seguridad de Credenciales y Contraseñas
Se han flexibilizado las pautas originales respecto a los archivos `.env`.
Dado que PocketBase se encuentra en una red local (intranet) y es de uso exclusivo, es **seguro y conveniente** administrar las credenciales operativas de RGP-SEAC directamente desde el Panel de Configuración del Bot dentro de la UI de Clik.

Esto favorece la usabilidad, permitiendo al administrador cambiar o resetear cualquier acceso sin intervenir la consola o reiniciar servicios oscuros del bot.

*Nota:* Al utilizar Gemini API, la `GEMINI_API_KEY` sí debe conservarse de manera segura (idealmente en el Panel de Secrets o en `.env` local).

## 4. Estructura y Panel de Clik (Integración)
El panel de "Bot WhatsApp" de Clik provee un control de mando exhaustivo.
Las métricas operan leyendo:
- **`bot_config`**: Controla "bot_activo", "modo_247", "modo_guardia", "tope_maximo", horarios y mensajería de respuesta inteligente.
- **`bot_operaciones`**: Historial universal de intentos (completados, rechazados, errores).
- **`bot_cola_errores`**: Registro vital donde el bot aborta y delega la acreditación manual a los operadores cuando la plataforma bancaria se desmadró o existe un gap en las lecturas de cuenta.

## 5. Criterios de Aceptación Modificados
- Comprobante válido + Cliente en regla -> Impacta RGP + Loguea DB + Respuesta OK.
- Cliente no en BD / Duplicados / Ilegibles -> Notificación + Aborte.
- Modo Guardia On -> El bot acredita operaciones para CC y Prepago indiscriminadamente, asegurando el flujo durante la guardia.
- Fallo de RPA -> Aborta sesión Puppeteer limpio + Anota en Errores + Responde Aviso al Cliente.
