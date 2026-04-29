# ACARS 7.0.1 - Addon Validation Guide

Fecha: 2026-04-29

## Proposito
Validar manualmente deteccion de variante/addon, telemetria critica y cierre operational sin penalizar señales unsupported.

## Flujo base por prueba
1. Abrir simulador y cargar aeronave.
2. Abrir ACARS y recibir despacho desde web.
3. Confirmar en diagnostico/log: aircraft title, profile_code, addon_source, detection_confidence, detection_reason.
4. Validar 4 LED preflight y boton Iniciar vuelo.
5. Validar altitud indicada, XPDR, luces, fuel.
6. Ejecutar cierre completed y luego caso cancelled.
7. Revisar que unsupported quede N/D y en penalty_exclusions.

## ASOBO / DEFAULT
- Title esperado: incluye Asobo o modelo base.
- Profile esperado: variante *_MSFS o MSFS_NATIVE fallback.
- Capabilities: luces/fuel/gear/parking brake por SimConnect.
- N/D posible: puertas avanzadas, señales addon-specific.

## BLACKSQUARE
- Title esperado: contiene Black Square.
- Profile esperado: *_BLACKSQUARE.
- Capabilities: electricos/cabina pueden ser parciales.
- N/D posible: puertas o señales LVAR no confirmadas.

## PMDG
- Title esperado: contiene PMDG + 737/777.
- Profile esperado: *_PMDG.
- Capabilities: XPDR/luces/fuel/gear via SimConnect + SDK si activo.
- N/D posible: señales cabin-specific no mapeadas.

## FENIX
- Title esperado: contiene Fenix.
- Profile esperado: A319_FENIX/A320_FENIX/A321_FENIX.
- Capabilities: base via SimConnect; cabin-specific parcial.
- N/D posible: puertas/seatbelt/no-smoking si no confiable.

## FBW
- Title esperado: contiene FBW/A32NX/FlyByWire.
- Profile esperado: A20N_FBW.
- Capabilities: base + posibles LVAR si bridge disponible.
- N/D posible: señales no confirmadas de cabina.

## MADDOG
- Title esperado: contiene Maddog/MD82/MD83/MD88.
- Profile esperado: *_MADDOG.
- Capabilities: base via SimConnect, addon-specific parcial.
- N/D posible: cabin switches avanzados.

## INIBUILDS / AEROSOFT
- Title esperado: contiene iniBuilds/Aerosoft.
- Profile esperado: A359_INIBUILDS / DHC6_AEROSOFT.
- Validar capacidades base y marcar no confirmado como N/D.

## UNKNOWN fallback
- Condicion: sin match confiable.
- Debe quedar: detection_confidence=fallback|unknown, profile_status=fallback_profile.
- Regla: excluir penalizacion automatica de señales ambiguas.

## Validaciones de cierre
- completed -> status completed.
- cancelled -> status cancelled.
- crash/incident -> status incidente/crash cuando aplique.
- Confirmar en payload: blackbox_summary, event_summary, capability_snapshot, unsupported_signals, penalty_exclusions.
