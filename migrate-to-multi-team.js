/**
 * Script de migración para datos existentes al sistema multi-equipo
 * 
 * Este script añade equipoId por defecto a:
 * - Jugadores sin equipoId
 * - Jornadas sin equipoId
 * - Crea un equipo por defecto para cada usuario si no tiene equipos
 */

const { connectDB } = require('./db');
require('dotenv').config();

async function migrarDatos() {
    console.log('🔄 Iniciando migración a sistema multi-equipo...\n');
    
    try {
        const db = await connectDB();
        console.log('✅ Conectado a MongoDB\n');
        
        // Obtener todos los usuarios
        const users = await db.collection('users').find({}).toArray();
        console.log(`📊 Usuarios encontrados: ${users.length}\n`);
        
        for (const user of users) {
            const username = user.username;
            console.log(`\n👤 Procesando usuario: ${username}`);
            console.log('─'.repeat(50));
            
            // Verificar si el usuario tiene equipos
            const equiposExistentes = await db.collection('equipos').find({ userId: username }).toArray();
            
            let equipoDefaultId;
            
            if (equiposExistentes.length === 0) {
                // Crear equipo por defecto
                console.log('  ➕ Creando equipo por defecto...');
                
                equipoDefaultId = `equipo_${username}_${Date.now()}`;
                const equipoDefault = {
                    id: equipoDefaultId,
                    nombre: 'Mi Equipo',
                    userId: username,
                    fechaCreacion: new Date().toISOString()
                };
                
                await db.collection('equipos').insertOne(equipoDefault);
                console.log(`  ✅ Equipo creado: "${equipoDefault.nombre}" (${equipoDefaultId})`);
            } else {
                // Usar el primer equipo existente
                equipoDefaultId = equiposExistentes[0].id;
                console.log(`  ℹ️  Equipo existente encontrado: "${equiposExistentes[0].nombre}" (${equipoDefaultId})`);
            }
            
            // Migrar jugadores sin equipoId
            const jugadoresSinEquipo = await db.collection('jugadores').find({ 
                userId: username,
                equipoId: { $exists: false }
            }).toArray();
            
            if (jugadoresSinEquipo.length > 0) {
                console.log(`  ➡️ Migrando ${jugadoresSinEquipo.length} jugador/a(s) sin equipoId...`);
                for (const jugador/a of jugadoresSinEquipo) {
                    await db.collection('jugadores').updateOne(
                        { _id: jugador/a._id },
                        { $set: { equipoId: equipoDefaultId } }
                    );
                }
                console.log(`  ✅ Jugador/a(s) migrados: ${jugadoresSinEquipo.length}`);
            } else {
                console.log(`  ℹ️  No hay jugadores sin equipoId`);
            }
            
            // Migrar jornadas sin equipoId
            const jornadasSinEquipo = await db.collection('jornadas').find({ 
                userId: username,
                equipoId: { $exists: false }
            }).toArray();
            
            if (jornadasSinEquipo.length > 0) {
                console.log(`  🔄 Migrando ${jornadasSinEquipo.length} jornadas...`);
                
                // Obtener nombre del equipo
                const equipo = await db.collection('equipos').findOne({ id: equipoDefaultId });
                const nombreEquipo = equipo ? equipo.nombre : 'Mi Equipo';
                
                const resultJornadas = await db.collection('jornadas').updateMany(
                    { 
                        userId: username,
                        equipoId: { $exists: false }
                    },
                    { 
                        $set: { 
                            equipoId: equipoDefaultId,
                            nombreEquipo: nombreEquipo
                        }
                    }
                );
                
                console.log(`  ✅ ${resultJornadas.modifiedCount} jornadas actualizadas`);
            } else {
                console.log(`  ℹ️  No hay jornadas sin equipoId`);
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ Migración completada exitosamente');
        console.log('='.repeat(50));
        
        // Mostrar resumen
        console.log('\n📊 RESUMEN:');
        const totalEquipos = await db.collection('equipos').countDocuments();
        const totalJugadores = await db.collection('jugadores').countDocuments();
        const totalJornadas = await db.collection('jornadas').countDocuments();
        
        console.log(`   Equipos totales: ${totalEquipos}`);
        console.log(`   Jugadores totales: ${totalJugadores}`);
        console.log(`   Jornadas totales: ${totalJornadas}`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        process.exit(1);
    }
}

// Ejecutar migración
migrarDatos();
