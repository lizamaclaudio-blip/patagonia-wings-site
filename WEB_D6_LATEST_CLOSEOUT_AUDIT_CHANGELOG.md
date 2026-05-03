# WEB D6 — Latest Closeout Audit Endpoint

## Base esperada
Web con D1-D5 aplicados y build OK.

## Archivos agregados
- `src/app/api/acars/audit/latest/route.ts`

## Objetivo
Agregar un endpoint diagnóstico protegido para revisar el último cierre ACARS/PIREP Perfect C0-C8 sin tocar score final, economía ni Supabase schema.

## Endpoint
`GET /api/acars/audit/latest?token=<ACARS_AUDIT_TOKEN>&limit=5`

Opcional:
`GET /api/acars/audit/latest?token=<ACARS_AUDIT_TOKEN>&reservationId=<uuid>`

## Seguridad
Requiere variable de entorno `ACARS_AUDIT_TOKEN`. Si no está configurada, responde `503 audit_token_not_configured`.

## No toca
- SQL/schema
- score oficial
- wallet/salary/ledger
- HUD/SayIntentions
- SimBrief/Route Finder

## Validación
- `npm run build`
- Verificar que el endpoint compile y no quede público sin token.
