# SLA y Politica de Soporte (plantilla base)

Ultima actualizacion: [COMPLETAR FECHA]

## 1. Alcance

Este documento define objetivos de disponibilidad, tiempos de respuesta y canal de soporte para clientes del servicio.

## 2. Horario y canal

- Canal principal: [COMPLETAR EMAIL/TICKET]
- Horario de soporte: [COMPLETAR]
- Idioma de soporte: [COMPLETAR]

## 3. Objetivo de disponibilidad

- Objetivo mensual: 99.5% (recomendado para fase inicial).
- Ventanas de mantenimiento programado: [COMPLETAR].

## 4. Severidades y respuesta

### Sev 1 - Servicio caido para todos
- Ejemplo: login inutilizable o API no disponible.
- Primera respuesta: <= 1 hora (horario laboral) o <= 4 horas (fuera de horario).
- Actualizaciones: cada 2 horas hasta mitigacion.

### Sev 2 - Funcion critica degradada
- Ejemplo: errores persistentes en guardado/exportacion.
- Primera respuesta: <= 4 horas laborables.
- Actualizaciones: cada dia laborable.

### Sev 3 - Incidencia menor o consulta
- Ejemplo: duda funcional, bug con workaround.
- Primera respuesta: <= 1 dia laborable.

## 5. Exclusiones

No se incluyen en SLA:
- Caidas de internet del cliente.
- Fallos de terceros fuera de control razonable.
- Uso contrario a terminos de servicio.

## 6. Backup y continuidad

- Frecuencia de backup: diaria.
- Pruebas de restauracion: periodicas.
- Retencion: segun configuracion vigente.

## 7. Proceso de incidentes

- Responsable tecnico: [COMPLETAR]
- Escalado interno: [COMPLETAR]
- Postmortem para Sev 1/2: recomendado en 72h.

## 8. Comunicacion al cliente

Las incidencias relevantes se comunican por [COMPLETAR], incluyendo estado, impacto y estimacion de recuperacion.
