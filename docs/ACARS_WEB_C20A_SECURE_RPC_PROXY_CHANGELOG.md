# C20A — Web Security Refactor: Secure RPC Proxy

## Objetivo

Centralizar llamadas RPC sensibles en una API route server-side (`/api/secure-rpc`) con allowlist explícita, sin seguir expandiendo permisos de Supabase desde browser.

## Archivos modificados/agregados

- `src/app/api/secure-rpc/route.ts`
- `src/lib/secure-rpc/client.ts`
- `src/lib/charter-ops.ts`
- `src/lib/flight-ops.ts`
- `src/lib/pilot-profile.ts`
- `src/lib/home-stats.ts`
- `src/components/PilotOfficePanel.tsx`

## Alcance

- Sustituye llamadas directas `supabase.rpc(...)` en despacho/charter/oficina piloto/perfil/métricas públicas por `callSecureRpc(...)`.
- La API valida sesión Supabase para RPC autenticadas.
- Las métricas públicas se sirven desde backend con service role.
- C20A conserva contexto de usuario para RPC autenticadas porque varias funciones actuales dependen de `auth.uid()`/`auth.jwt()`.

## No incluido en C20A

- No revoca todavía `authenticated` de las 22 funciones remanentes.
- No cambia lógica de economía, ACARS ni Supabase.
- No publica ni cambia versión.

## Próximo bloque C20B

Migrar función por función a ejecución service-role segura con validación explícita de usuario/callsign en API routes específicas. Solo después revocar `authenticated` de esas funciones.
