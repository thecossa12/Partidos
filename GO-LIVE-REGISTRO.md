# Registro de Go-Live

Este archivo documenta la salida a produccion para trazabilidad tecnica y operativa.

## Entrada 1

- Fecha y hora (Europe/Madrid): 2026-05-14 12:50:39 +02:00
- Proyecto: Partidos
- Entorno: production (Railway)
- URL publica: https://volleyballmanager.up.railway.app
- Version aplicacion (package.json): 1.0.0
- Git branch: main
- Git commit: d0cc034
- Responsable: Christian Cosa Coronado

### Verificaciones de salida

- go-live-check: OK
  - Healthcheck /api/health: OK
  - Readiness /api/health/ready: OK
  - Proteccion JWT sin token: OK
- security-smoke-check: OK
  - Login: OK
  - Token JWT: OK
  - Anti-suplantacion userId: OK

### Estado operativo (Railway)

- Servicio principal: Partidos
- Servicio cron diario: cron-daily
- Servicio cron semanal de checks: cron-weekly-checks
- Variables criticas en produccion confirmadas:
  - AUTH_MODE=strict
  - TRUST_PROXY=1
  - ALLOW_BOOTSTRAP=false
  - ALLOWED_ORIGINS=https://volleyballmanager.up.railway.app

### Notas

- Recomendacion de seguridad: rotar periodicamente JWT_SECRET, MONGO_URI y CHECK_PASS.
- CHECK_PASS actual de test deberia reemplazarse por una clave robusta.
