const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const url = process.env.MONGO_URI;

// Opciones de conexión más robustas para Railway
const clientOptions = {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    retryWrites: true,
    w: 'majority',
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 30000,
    maxPoolSize: 10,
    minPoolSize: 2,
};

const client = new MongoClient(url, clientOptions);

async function connectDB() {
    try {
        console.log("🔄 Intentando conectar a MongoDB Atlas...");
        await client.connect();
        console.log("🔄 Verificando conexión...");
        await client.db("admin").command({ ping: 1 });
        console.log("✅ Conectado a MongoDB Atlas");
        const db = client.db("volleyball");
        return db;
    } catch (error) {
        console.error("❌ Error al conectar:", error.message);
        console.error("💡 Verifica que:");
        console.error("   1. La variable MONGO_URI esté configurada en Railway");
        console.error("   2. La IP de Railway esté en la whitelist de MongoDB Atlas (usa 0.0.0.0/0)");
        console.error("   3. El usuario/contraseña sean correctos");
        throw error;
    }
}

module.exports = { connectDB };
