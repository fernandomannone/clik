import fs from 'fs';

const pb_schema = [
  {
    "id": "clientes00000000",
    "name": "clientes",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_cliente_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_cliente_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_cliente_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  },
  {
    "id": "articulos0000000",
    "name": "articulos",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_articulo_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_articulo_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_articulo_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  },
  {
    "id": "facturas00000000",
    "name": "facturas",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_factura_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_factura_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_factura_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  },
  {
    "id": "compras000000000",
    "name": "compras",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_compra_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_compra_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_compra_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  },
  {
    "id": "pagos00000000000",
    "name": "pagos",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_pago_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_pago_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_pago_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  },
  {
    "id": "cuentas000000000",
    "name": "cuentas",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_cuenta_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_cuenta_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_cuenta_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  },
  {
    "id": "conceptos0000000",
    "name": "conceptos",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_concepto_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_concepto_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_concepto_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  },
  {
    "id": "proveedores00000",
    "name": "proveedores",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_proveedor_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_proveedor_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_proveedor_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  },
  {
    "id": "movimientos00000",
    "name": "movimientos",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_movimiento_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_movimiento_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_movimiento_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  },
  {
    "id": "usuarios00000000",
    "name": "usuarios_clik",
    "type": "base",
    "system": false,
    "schema": [
      { "system": false, "id": "f_usuario_payload", "name": "payload", "type": "json", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_usuario_legacy", "name": "legacyId", "type": "text", "required": false, "unique": false, "options": {} },
      { "system": false, "id": "f_usuario_user", "name": "userId", "type": "text", "required": false, "unique": false, "options": {} }
    ]
  }
];

fs.writeFileSync('pb_schema.json', JSON.stringify(pb_schema, null, 2));
