// API Utilities - Funciones para conectar con el backend MongoDB

// Detectar automáticamente si estamos en producción o desarrollo
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`;

console.log('🌐 API_URL configurada:', API_URL);

const api = {
    // ==================== JUGADORES ====================
    
    async getJugadores() {
        try {
            const response = await fetch(`${API_URL}/jugadores`);
            return await response.json();
        } catch (error) {
            console.error('Error obteniendo jugadores:', error);
            return [];
        }
    },
    
    async createJugador(jugador) {
        try {
            const response = await fetch(`${API_URL}/jugadores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jugador)
            });
            return await response.json();
        } catch (error) {
            console.error('Error creando jugador:', error);
            throw error;
        }
    },
    
    async updateJugador(id, jugador) {
        try {
            const response = await fetch(`${API_URL}/jugadores/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jugador)
            });
            return await response.json();
        } catch (error) {
            console.error('Error actualizando jugador:', error);
            throw error;
        }
    },
    
    async deleteJugador(id) {
        try {
            const response = await fetch(`${API_URL}/jugadores/${id}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Error eliminando jugador:', error);
            throw error;
        }
    },
    
    // ==================== JORNADAS ====================
    
    async getJornadas() {
        try {
            const response = await fetch(`${API_URL}/jornadas`);
            return await response.json();
        } catch (error) {
            console.error('Error obteniendo jornadas:', error);
            return [];
        }
    },
    
    async createJornada(jornada) {
        try {
            const response = await fetch(`${API_URL}/jornadas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jornada)
            });
            return await response.json();
        } catch (error) {
            console.error('Error creando jornada:', error);
            throw error;
        }
    },
    
    async updateJornada(id, jornada) {
        try {
            const response = await fetch(`${API_URL}/jornadas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jornada)
            });
            return await response.json();
        } catch (error) {
            console.error('Error actualizando jornada:', error);
            throw error;
        }
    },
    
    async deleteJornada(id) {
        try {
            const response = await fetch(`${API_URL}/jornadas/${id}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Error eliminando jornada:', error);
            throw error;
        }
    },
    
    async deleteMultipleJornadas(ids) {
        try {
            const response = await fetch(`${API_URL}/jornadas/delete-multiple`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            return await response.json();
        } catch (error) {
            console.error('Error eliminando jornadas:', error);
            throw error;
        }
    },
    
    // ==================== MIGRACIÓN ====================
    
    async migrate(jugadoras, jornadas) {
        try {
            const response = await fetch(`${API_URL}/migrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jugadoras, jornadas })
            });
            return await response.json();
        } catch (error) {
            console.error('Error en migración:', error);
            throw error;
        }
    },

    // ==================== CONFIGURACIÓN ====================
    
    async getConfig(userId) {
        try {
            const response = await fetch(`${API_URL}/config?userId=${userId}`);
            if (!response.ok) {
                throw new Error('Error obteniendo configuración');
            }
            return await response.json();
        } catch (error) {
            console.error('Error obteniendo config:', error);
            return {
                polideportivoCasa: '',
                ubicacionesGuardadas: [],
                rivalesGuardados: []
            };
        }
    },

    async saveConfig(userId, config) {
        try {
            const response = await fetch(`${API_URL}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...config })
            });
            if (!response.ok) {
                throw new Error('Error guardando configuración');
            }
            return await response.json();
        } catch (error) {
            console.error('Error guardando config:', error);
            throw error;
        }
    }
};

// Exportar para usar en app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
