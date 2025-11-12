# 🏐 Sistema de Rotaciones de Volleyball

Aplicación web para gestionar de manera equitativa la rotación de jugadores de volleyball, con sincronización automática a MongoDB Atlas.

## 🚀 Despliegue en Railway

### Variables de entorno requeridas:

En Railway, configura la siguiente variable de entorno:

```
MONGO_URI=mongodb+srv://Christian:Rolomolo12@cluster0.t7cper9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

### Start Command:

Railway detectará automáticamente el script `start` de `package.json`:

```
npm start
```

## 📦 Instalación local

```bash
npm install
npm start
```

Abre http://localhost:3000

## ✨ Características

- 💾 Almacenamiento dual: localStorage + MongoDB
- ☁️ Sincronización automática
- 🔄 Recuperación de datos desde la nube
- 📴 Modo offline automático
- 👥 Multi-usuario con aislamiento de datos
