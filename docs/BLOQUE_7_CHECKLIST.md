# Checklist Bloque 7 — prueba funcional

## 1. Aplicar parche
Copiar el contenido del ZIP sobre el repo web.

## 2. Validar build web
```powershell
npx tsc --noEmit
npm run build
```

## 3. Publicar web
Hacer push/deploy según flujo normal.

## 4. Prueba corta no operacional
Objetivo: no validar puntaje aún, solo confirmar que finalize deja huella.

1. Abrir ACARS actualizado.
2. Despachar vuelo desde la web.
3. Enviar vuelo a ACARS.
4. Iniciar vuelo.
5. Generar al menos 2-3 muestras live.
6. Finalizar.
7. Revisar en Supabase que aparezca:
   - `score_payload.acars_finalize_attempt`
   - `score_payload.raw_finalize_payload`
   - `score_payload.blackboxSummary`
   - `score_payload.sur_style_summary`
   - `score_payload.raw_pirep_xml` si ACARS envió XML.

## 5. Prueba real completa
Cuando el paso 4 esté OK:

1. Taxi.
2. Despegue.
3. Vuelo mínimo 120 segundos con movimiento real.
4. PIC radio si aparece.
5. Aterrizaje.
6. Parking brake.
7. Finalizar vuelo.
8. Abrir summaryUrl.
9. Revisar puntaje, resumen y economía.
