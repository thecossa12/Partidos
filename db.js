const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const url = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "volleyball";
if (!url || typeof url !== "string" || !url.trim()) {
    throw new Error("MONGO_URI no está configurada. Define la variable de entorno antes de iniciar la app.");
}

const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let dbInstance = null;
let connectPromise = null;

async function connectDB() {
    if (dbInstance) {
        return dbInstance;
    }

    if (connectPromise) {
        return connectPromise;
    }

    connectPromise = (async () => {
    try {
        await client.connect();
        console.log("✅ Conectado a MongoDB Atlas");
        dbInstance = client.db(DB_NAME);
        return dbInstance;
    } catch (error) {
        console.error("❌ Error al conectar:", error);
        connectPromise = null;
        throw error;
    }
    })();

    return connectPromise;
}

module.exports = { connectDB };
