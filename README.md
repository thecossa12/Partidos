# 🏐 Gestor de Rotaciones - Volleyball

## Descripción
Aplicación web local para gestionar de manera equitativa la rotación de jugadoras de volleyball, considerando la asistencia a entrenamientos y el historial de participación. **Completamente rediseñada** para máxima facilidad de uso.

## 🆕 Nuevas Características Principales

### ✅ Setup Inicial Automático
- **Configuración única**: Al abrir por primera vez, registra todas las jugadoras con nombres y dorsales
- **Validación inteligente**: No permite dorsales duplicados ni nombres repetidos
- **Mínimo requerido**: Necesitas al menos 6 jugadoras para comenzar

### ✅ Sistema de Jornadas Completas
- **Flujo paso a paso**: Lunes → Miércoles → Sábado en una sola pantalla
- **Selección por clicks**: Marca asistencia simplemente haciendo click en las jugadoras
- **Vista previa en tiempo real**: Ve la rotación automáticamente mientras seleccionas

### ✅ Interfaz Ultra Simplificada
- **Sin escribir nombres**: Todo por selección visual con dorsales
- **Progreso visual**: Sabes exactamente en qué paso estás (1 de 3, 2 de 3, etc.)
- **Tarjetas de jugadoras**: Información clara con nombre, dorsal y estadísticas

### ✅ Gestión Dinámica del Equipo
- **Altas y bajas fáciles**: Agregar o quitar jugadoras cuando sea necesario
- **Edición completa**: Cambiar nombres y dorsales en cualquier momento
- **Reset total**: Opción para empezar de cero si es necesario

### ✅ Algoritmo Mejorado
- **Prioridad por entrenamientos**: 2 días > 1 día > 0 días automáticamente
- **Balance histórico**: Las que menos han jugado tienen prioridad
- **Distribución justa**: Mínimo 15 puntos garantizados
- **Cálculo en tiempo real**: Ve los resultados antes de confirmar

### ✅ Historial Avanzado
- **Filtros múltiples**: Por mes, por jugadora, o combinados
- **Estadísticas automáticas**: Promedios de asistencia y participación
- **Vista completa**: Entrenamientos + partido en una sola pantalla
- **Búsqueda rápida**: Encuentra cualquier jornada fácilmente

### ✅ Base de Datos Local Mejorada
- **Almacenamiento inteligente**: Todo en localStorage del navegador
- **Portabilidad 100%**: Mueve la carpeta completa y conserva datos
- **Backup automático**: Los datos nunca se pierden

## 🚀 Cómo Usar la Nueva Aplicación

### 1. Primera Vez (Setup Inicial)
1. **Abre `index.html`** en tu navegador
2. **Aparece automáticamente** la pantalla de configuración
3. **Agrega jugadoras una por una**:
   - Escribe el nombre
   - Pon el número de dorsal (1-99)
   - Click en "Agregar"
4. **Completa el setup** cuando tengas mínimo 6 jugadoras
5. ¡Ya puedes usar la aplicación!

### 2. Crear una Jornada Semanal (¡Súper fácil!)
1. Ve a **"Jornadas"** (primera pestaña)
2. **Selecciona el lunes** de la semana
3. Click en **"Crear Jornada"**
4. **Paso 1 - Lunes**: Click en las jugadoras que vinieron
5. **Paso 2 - Miércoles**: Click en las jugadoras que vinieron  
6. **Paso 3 - Sábado**: 
   - Click en las jugadoras que van al partido
   - Ajusta puntos de sets si es necesario
   - Ve la vista previa automática
   - Click en "Calcular Rotación"
   - Click en "Guardar Jornada"

### 3. Gestionar el Equipo
1. Ve a **"Equipo"** (segunda pestaña)
2. **Agregar jugadora**: Click en "➕ Agregar Jugadora"
3. **Editar**: Click en "Editar" junto a cualquier jugadora
4. **Eliminar**: Click en "Eliminar" (se pierde el historial)
5. **Reset completo**: Click en "🔄 Resetear Equipo" (¡cuidado!)

### 4. Consultar Historial Avanzado
1. Ve a **"Historial"** (tercera pestaña)
2. **Filtros disponibles**:
   - Por mes específico
   - Por jugador/a específico/a
   - Combinación de ambos
3. **Ve estadísticas automáticas** en la parte superior
4. **Revisa jornadas completas**: Entrenamientos + partido juntos

## Algoritmo de Distribución

El sistema usa un algoritmo inteligente que considera:

### Prioridad por Entrenamientos
- **2 entrenamientos**: Máxima prioridad
- **1 entrenamiento**: Prioridad media
- **0 entrenamientos**: Prioridad baja

### Balance Histórico
- Jugadoras con menos puntos acumulados tienen mayor prioridad
- Se evita que las mismas jugadoras siempre jueguen menos

### Distribución Equitativa
- **Mínimo garantizado**: 15 puntos por jugadora
- **Cálculo automático**: Divide puntos totales entre jugadoras disponibles
- **Ajuste inteligente**: Distribuye puntos extras a quienes más lo necesitan

### Ejemplo de Funcionamiento
Si vienen **14 jugadoras** y el partido es **2-0 (25-25 = 50 puntos totales)**:
- 50 puntos ÷ 14 jugadoras = **3.57 puntos promedio**
- Como el mínimo son 15 puntos, solo **3 jugadoras juegan** (3 × 15 = 45 puntos)
- Los 5 puntos restantes se distribuyen entre quienes tienen menos puntos históricos

## Ventajas del Sistema

### ✅ Justicia y Transparencia
- Criterios claros y objetivos para la rotación
- Historial completo para verificar equidad
- No hay favoritismos, solo datos

### ✅ Motivación para Entrenar
- Quienes asisten más entrenan más
- Sistema de recompensas por compromiso
- Balance para evitar exclusión permanente

### ✅ Facilidad de Uso
- Interfaz intuitiva y amigable
- Solo 3 clics para planificar un partido
- Totalmente offline, sin internet requerido

### ✅ Portabilidad Total
- Mueve la carpeta completa a cualquier PC
- Todos los datos se conservan
- No depende de servidores externos

## Instalación y Portabilidad

### Instalación
1. Descarga todos los archivos (`index.html`, `styles.css`, `app.js`)
2. Colócalos en una carpeta
3. Abre `index.html` con cualquier navegador moderno

### Para Mover a Otro PC
1. Copia la carpeta completa
2. Abre `index.html` en el nuevo PC
3. Todos los datos se mantendrán intactos

## Requerimientos Técnicos
- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- JavaScript habilitado
- No requiere conexión a internet
- Compatible con Windows, Mac, Linux

## Solución de Problemas

### "No se guardan los datos"
- Verifica que JavaScript esté habilitado
- Usa un navegador moderno
- No uses modo incógnito/privado

### "La distribución no parece justa"
- Revisa el historial de entrenamientos
- Verifica que todas las jugadoras estén registradas
- Recuerda que prioriza asistencia a entrenamientos

### "Quiero cambiar la distribución"
- Puedes editar manualmente los puntos de cada set
- El sistema recalculará automáticamente
- Guarda solo cuando estés conforme

## Consejos de Uso

1. **Registra entrenamientos semanalmente** para mantener el sistema actualizado
2. **Revisa el historial regularmente** para verificar equidad a largo plazo
3. **Explica el sistema a las jugadoras** para mayor transparencia
4. **Haz backup de la carpeta** copiándola periódicamente

## Soporte
Si tienes problemas o sugerencias:
- Revisa que todos los archivos estén en la misma carpeta
- Verifica que uses un navegador actualizado
- Los datos se almacenan localmente, no se pierden al cerrar el navegador

---

**¡Disfruta de partidos más justos y organizados!** 🏐