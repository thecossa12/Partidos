# Checklist de salida comercial en 48h

Objetivo: cerrar lo minimo necesario para vender con seguridad operativa, legal y comercial.

Nota: este checklist no sustituye asesoramiento legal profesional.

## Dia 1 - Bloque legal y riesgo

- [x] Revisar y adaptar [privacidad.html](privacidad.html) y [aviso-legal.html](aviso-legal.html) con datos finales del titular y canal de contacto.
- [x] Publicar terminos de servicio usando [terminos-servicio.html](terminos-servicio.html).
- [x] Publicar acuerdo de encargado del tratamiento (DPA) usando [dpa-encargado-tratamiento.html](dpa-encargado-tratamiento.html).
- [x] Definir politica de soporte y SLA con [sla-soporte.html](sla-soporte.html).
- [x] Validar que AUTH_MODE=strict, TRUST_PROXY, ALLOW_BOOTSTRAP=false y ALLOWED_ORIGINS esten definidos en produccion.
- [x] Ejecutar verificaciones:
  - npm run go-live:check
  - npm run test:securityxºº

## Dia 2 - Bloque operacion y ventas

- [x] Definir planes y precio (por equipo/mes o por club/mes) (ver x[PLANES-Y-PRECIOS.md](PLANES-Y-PRECIOS.md)).
- [x] Definir proceso de alta de cliente (formulario + provision de usuario admin del club) (ver [PROCESO-ALTA-CLIENTE.md](PROCESO-ALTA-CLIENTE.md)).
- [x] Definir proceso de baja (cancelacion + exportacion + borrado).
- [x] Definir responsable de incidentes y canal de soporte (email y horario).
- [x] Registrar fecha de go-live y version desplegada (ver [GO-LIVE-REGISTRO.md](GO-LIVE-REGISTRO.md)).
- [x] Confirmar backups y cron activos en Railway.

## Criterio de listo para vender

Se considera listo cuando:

1. Legal publico: privacidad, aviso legal, terminos y DPA listos.
2. Seguridad minima: checks en verde y variables de produccion cerradas.
3. Operacion definida: SLA, soporte, alta/baja y responsable de incidentes.
4. Comercial definido: precio, oferta y flujo de onboarding.

## Evidencias recomendadas

- Captura o log de salud: /api/health y /api/health/ready.
- Resultado de npm run go-live:check y npm run test:security.
- Version y fecha de despliegue en un changelog interno.
- URL publica de documentos legales.
 