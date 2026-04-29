# ACARS 7.0.0 - Ready To Fly Checklist

Fecha: 2026-04-29

1. Build ACARS oficial:
- `"C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\amd64\MSBuild.exe" PatagoniaWings.Acars.sln /t:Clean,Build /p:Configuration=Debug /p:Platform=x64 /m`

2. Iniciar ACARS y confirmar footer `ACARS 7.0.0`.
3. Enviar vuelo desde web (selector sin cambios: tipo + matricula).
4. Validar `aircraftTypeCode` recibido.
5. Validar variante interna detectada (`aircraftVariantCode/profile`).
6. Validar 4 LED preflight (misma logica que habilita Iniciar vuelo).
7. Validar altitud indicada como valor principal.
8. Validar XPDR en UI/payload segun capabilities.
9. Validar payload caja negra (telemetria + events + capabilities + exclusions).
10. Validar cierre `completed` vs `cancelled`.
11. Validar finalize/retry sin duplicar.
12. Validar en web planificado vs real intacto.
13. Validar que wallet no sube por vuelo.
14. Validar que liquidacion mensual mantiene el credito wallet.
15. Registrar cualquier senal no confirmada como N/D no penalizable.
