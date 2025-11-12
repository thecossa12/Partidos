# INSTRUCCIONES DE INSTALACIÓN Y MIGRACIÓN

## 1. Instalar dependencias (si no están instaladas)

Abre una terminal CMD (no PowerShell) y ejecuta:

```cmd
cd "c:\Users\Christian Cosa\Desktop\VSC\Partidos"
npm install express cors body-parser
```

## 2. Iniciar el servidor

```cmd
node server.js
```

Deberías ver:
```
✅ Base de datos conectada
🚀 Servidor corriendo en http://localhost:3000
```

## 3. Migrar datos existentes

Abre el navegador en: http://localhost:3000

Presiona F12 para abrir la consola del navegador y ejecuta este código:

```javascript
// Obtener datos de localStorage
const jugadoras = JSON.parse(localStorage.getItem('volleyball_jugadoras') || '[]');
const jornadas = JSON.parse(localStorage.getItem('volleyball_jornadas') || '[]');

// Enviar a MongoDB
fetch('http://localhost:3000/api/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jugadoras, jornadas })
})
.then(res => res.json())
.then(data => {
    console.log('✅ Migración completada:', data);
    alert(`Migración exitosa!\nJugadoras: ${data.jugadorasCount}\nJornadas: ${data.jornadasCount}`);
})
.catch(err => console.error('❌ Error:', err));
```

## 4. Verificar en MongoDB Atlas

Ve a MongoDB Atlas → Browse Collections → volleyball
Deberías ver las colecciones 'jugadoras' y 'jornadas' con tus datos.

## 5. IMPORTANTE - Backup de localStorage

ANTES de migrar, haz un backup ejecutando en la consola del navegador:

```javascript
// Backup de localStorage
const backup = {
    jugadoras: localStorage.getItem('volleyball_jugadoras'),
    jornadas: localStorage.getItem('volleyball_jornadas'),
    auth: localStorage.getItem('volleyball_auth')
};
console.log('BACKUP:', JSON.stringify(backup));
// Copia y guarda este texto en un archivo .txt por si acaso
```

## Problemas comunes

### Error "npm: No se puede cargar el archivo"
- Usa CMD en vez de PowerShell
- O ejecuta en PowerShell: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

### Error de conexión a MongoDB
- Verifica que el archivo .env tenga la URL correcta
- Verifica que tu IP esté en la whitelist de MongoDB Atlas

### Puerto 3000 ocupado
- Cambia el puerto en server.js (línea: `const PORT = 3000;`)
