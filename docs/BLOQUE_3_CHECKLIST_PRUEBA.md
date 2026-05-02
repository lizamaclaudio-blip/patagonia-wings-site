# Checklist Bloque 3 — Resumen estilo SUR Air

## 1. Aplicación
Copiar el contenido del ZIP sobre la raíz del repo web.

## 2. Validación técnica
Ejecutar:

```powershell
npx tsc --noEmit
npm run build
```

## 3. Validación visual
Abrir un resumen de vuelo `/flights/[reservationId]` y verificar que aparezcan estas secciones:

- Pirep / resumen oficial
- Piloto al mando
- Vuelo programado
- Vuelo realizado
- Puntaje del vuelo
- Tabla de métricas: vientos, PIC False, stall, overspeed, G-Force, touchdown
- Evaluación de procedimientos
- Evaluación de performance
- Feedback del jefe de flota
- Economía / coins del vuelo
- Despacho de peso y combustible
- Plan de vuelo
- Parámetros de vuelo
- Detalles del simulador
- Planificado vs real
- Trazabilidad de cierre
- Derecho a réplica

## 4. Validación funcional no evaluable
En un vuelo con `pending_server_closeout`, `incomplete_closeout` o `no_evaluable`, confirmar:

- Estado: No evaluable
- Puntajes en 0 o no aplicable
- Wallet sin movimiento
- Salary mensual no devengado
- Ledger no generado
- Motivo de no evaluación visible

## 5. Validación funcional evaluable
En un vuelo completado con evidencia real, confirmar:

- Puntaje procedimientos + performance + total
- Métricas de touchdown/G-force/stall/overspeed si ACARS las envía
- Economía computable
- Snapshot actual creado
- Ledger creado
- Salary mensual visible

## 6. Owner tester
Como PWG001/owner, confirmar que se ve la herramienta:

- `Probar PIREP XML`
- Fixture XML
- XML manual opcional
- Resultado preview sin mover wallet ni ledger
