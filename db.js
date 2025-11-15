const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const url = process.env.MONGO_URI;
const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function connectDB() {
    try {
        await client.connect();
        console.log("✅ Conectado a MongoDB Atlas");
        const db = client.db("volleyball"); // nombre de tu base de datos
        return db;
    } catch (error) {
        console.error("❌ Error al conectar:", error);
        throw error;
    }
}

module.exports = { connectDB };
