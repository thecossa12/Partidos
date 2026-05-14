# Checklist Go-Live Comercial

## 1) Seguridad y autenticacion
- AUTH_MODE=strict en produccion.
- JWT_SECRET de 32+ caracteres.
- TRUST_PROXY configurado para el entorno de despliegue.
- ALLOW_BOOTSTRAP=false tras crear el primer admin.
- CORS con ALLOWED_ORIGINS definido.

## 2) Salud y observabilidad
- Endpoint de vida: /api/health
- Endpoint de disponibilidad: /api/health/ready
- Logs de auditoria activos en coleccion audit_logs.
- Verificacion automatica: node scripts/go-live-check.js

## 3) Cumplimiento y datos
- Exportacion de datos personales operativa.
- Borrado de cuenta operativa.
- Politica de privacidad y aviso legal publicados.
- Banner de cookies visible para nuevos usuarios.
- Tratamiento de datos descrito claramente (finalidad, base juridica, derechos).
- Retencion y borrado documentados para backups y auditorias.

## 4) Continuidad de negocio
- Backup periodico: node scripts/backup-data.js
- Rotacion de backups: node scripts/rotate-backups.js
- Limpieza de auditoria: node scripts/cleanup-audit-logs.js
- Prueba de restauracion real ejecutada con `npm run backup:restore -- --file <backup> --force` en staging.
- Retencion de backups definida (ejemplo: 30-90 dias).

## 7) Horarios de cron en Railway
- `cron-daily`: `0 1 * * *` UTC
	- Equivale a las 03:00 en España durante horario de verano (CEST).
- `cron-weekly-checks`: `0 4 * * 1` UTC
	- Equivale a las 06:00 en España durante horario de verano (CEST).
- Nota:
	- Railway usa UTC para cron jobs.
	- Si cambia el horario de invierno/verano, recalcula la hora local respecto a UTC.

## 5) Operacion comercial
- SLA de soporte definido.
- Proceso de alta/baja de clientes documentado.
- Responsable de incidentes definido.
- Canal de soporte al cliente habilitado.

## 6) Validacion final
- Ejecutar security smoke check.
- Ejecutar go-live-check.
- Registrar fecha de go-live y version desplegada.
- Revisar textos legales con criterio final antes de vender.
