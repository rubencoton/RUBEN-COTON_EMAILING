# IMPLEMENT RUNBOOK

## 1) LOCAL

1. Copiar `.env.example` a `.env`.
2. Ajustar contrasena y canal (`MAIL_TRANSPORT_MODE`).
3. `npm install`
4. `npm run dev`
5. Abrir `http://localhost:3000`

## 2) PRODUCCION COOLIFY

1. Push a `main`.
2. Verificar auto-deploy activo.
3. Confirmar variables de entorno.
4. Revisar `/health` y `/api/panel`.

## 3) OPERACION DIARIA

1. Importar contactos.
2. Crear segmento.
3. Crear plantilla.
4. Crear y enviar campana.
5. Revisar analitica.
6. Ejecutar workflows (manual o automatico).

## 4) CHECK DNS (FASE FINAL)

- SPF
- DKIM
- DMARC
- A/PTR para host de envio
