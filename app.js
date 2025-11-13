class VolleyballManager {
    constructor() {
        console.log('🏗️ Iniciando constructor VolleyballManager...');
        // Detectar automáticamente la URL del API (producción o local)
        this.API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000/api'
            : window.location.origin + '/api';
        console.log('🌐 API URL:', this.API_URL);
        this.syncEnabled = true; // Habilitar sincronización automática
        this.getUserId(); // Inicializar userId
        this.jugadoras = [];
        this.jornadas = [];
        this.currentTab = 'jornadas';
        this.eventListenersConfigurados = false; // Prevenir duplicación de event listeners
        this.inicializarAppAsync();
        console.log('✅ Constructor completado');
    }

    async inicializarAppAsync() {
        this.jugadoras = await this.cargarJugadoras();
        console.log('� Jugadoras cargadas en constructor:', this.jugadoras.length);
        this.jornadas = await this.cargarJornadas();
        console.log('📅 Jornadas cargadas en constructor:', this.jornadas.length);
        this.inicializarApp();
    }

    // ==================== SINCRONIZACIÓN MONGODB ====================
    getUserId() {
        const authData = JSON.parse(localStorage.getItem('volleyball_auth') || '{}');
        this.userId = authData.username || 'admin';
        return this.userId;
    }

    showSyncIndicator(status, message) {
        const indicator = document.getElementById('sync-indicator');
        if (!indicator) return;
        
        if (status === 'syncing') {
            indicator.style.background = '#ffc107';
            indicator.innerHTML = '🔄 Sincronizando...';
            indicator.style.display = 'block';
        } else if (status === 'success') {
            indicator.style.background = '#28a745';
            indicator.innerHTML = '☁️ Sincronizado';
            indicator.style.display = 'block';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 2000);
        } else if (status === 'offline') {
            indicator.style.background = '#6c757d';
            indicator.innerHTML = '📴 Modo Offline';
            indicator.style.display = 'block';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 3000);
        }
    }

    // Limpiar datos para MongoDB (eliminar null, undefined, _id de MongoDB y referencias circulares)
    limpiarDatosParaMongo(obj) {
        if (obj === null || obj === undefined) {
            return null;
        }
        
        if (Array.isArray(obj)) {
            return obj
                .filter(item => item !== null && item !== undefined)
                .map(item => this.limpiarDatosParaMongo(item));
        }
        
        if (typeof obj === 'object') {
            const cleaned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    // Saltar _id de MongoDB para evitar conflictos
                    if (key === '_id') continue;
                    
                    const value = obj[key];
                    if (value !== null && value !== undefined) {
                        cleaned[key] = this.limpiarDatosParaMongo(value);
                    }
                }
            }
            return cleaned;
        }
        
        return obj;
    }

    async syncToMongoDB(type, operation, data) {
        if (!this.syncEnabled) return;
        
        this.showSyncIndicator('syncing');
        
        try {
            const userId = this.getUserId();
            
            // Limpiar datos antes de enviar a MongoDB
            const jugadoresLimpios = this.limpiarDatosParaMongo(this.jugadoras || []);
            const jornadasLimpias = this.limpiarDatosParaMongo(this.jornadas || []);
            
            // Sincronización completa de todos los datos
            const response = await fetch(`${this.API_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jugadores: jugadoresLimpios,
                    jornadas: jornadasLimpias,
                    userId
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error del servidor:', errorText);
                throw new Error('Error en la sincronización');
            }
            
            const result = await response.json();
            console.log('☁️ Sincronizado con MongoDB:', result);
            
            this.showSyncIndicator('success');
        } catch (error) {
            console.warn('⚠️ Error sincronizando con MongoDB (continuando en modo offline):', error.message);
            this.showSyncIndicator('offline');
        }
    }

    async loadFromMongoDB() {
        try {
            const userId = this.getUserId();
            
            // Intentar cargar jugadores de MongoDB
            const jugadoresRes = await fetch(`${this.API_URL}/jugadores?userId=${userId}`);
            if (jugadoresRes.ok) {
                const jugadores = await jugadoresRes.json();
                if (jugadores.length > 0) {
                    console.log('☁️ Cargando jugadores desde MongoDB:', jugadores.length);
                    return { jugadores };
                }
            }
        } catch (error) {
            console.warn('⚠️ No se pudo cargar desde MongoDB, usando localStorage');
        }
        return null;
    }

    // ==================== SISTEMA DE ALMACENAMIENTO ====================
    async cargarJugadoras() {
        // Prevenir múltiples cargas
        if (this._jugadorasCargadas) {
            console.log('⚠️ Intento de cargar jugadoras duplicado - usando cache');
            return this.jugadoras || [];
        }
        
        console.log('📂 Cargando jugadoras desde MongoDB (prioridad)...');
        let jugadoras = [];
        
        // PRIMERO intentar cargar desde MongoDB (filtrado por usuario)
        try {
            const userId = this.getUserId();
            console.log('👤 Cargando jugadoras para userId:', userId);
            const response = await fetch(`${this.API_URL}/jugadores?userId=${userId}`);
            if (response.ok) {
                jugadoras = await response.json();
                console.log('☁️ Jugadoras cargadas desde MongoDB:', jugadoras.length);
                
                // Guardar en localStorage como backup (SIN mezclar con otros usuarios)
                if (jugadoras.length > 0) {
                    localStorage.setItem(`volleyball_jugadoras_${userId}`, JSON.stringify(jugadoras));
                }
            }
        } catch (error) {
            console.warn('⚠️ No se pudo cargar desde MongoDB, intentando localStorage:', error.message);
            
            // FALLBACK: usar localStorage SOLO del usuario actual
            const userId = this.getUserId();
            const data = localStorage.getItem(`volleyball_jugadoras_${userId}`);
            jugadoras = data ? JSON.parse(data) : [];
            console.log('💾 Jugadoras cargadas desde localStorage (userId-específico):', jugadoras.length);
        }
        
        console.log('👥 Jugadoras parseadas:', jugadoras.length);
        
        this._jugadorasCargadas = true;
        
        return jugadoras.map(j => ({
            ...j,
            puntosJugados: j.puntosJugados || 0,
            partidosJugados: j.partidosJugados || 0,
            entrenamientosAsistidos: j.entrenamientosAsistidos || 0,
            posicion: j.posicion || 'jugadora'
        }));
    }

    guardarJugadoras() {
        const userId = this.getUserId();
        localStorage.setItem(`volleyball_jugadoras_${userId}`, JSON.stringify(this.jugadoras));
        // Sincronización automática con MongoDB
        this.syncToMongoDB('jugadores', 'save');
    }
    guardarJugadora() {
        console.log('🏐 Iniciando guardarJugadora()...');
        
        const nombre = document.getElementById('nombreJugadora').value.trim();
        const dorsal = parseInt(document.getElementById('dorsalJugadora').value);
        const posicion = document.getElementById('posicionJugadora').value;

        console.log('📝 Datos del formulario:', { nombre, dorsal, posicion });

        if (!nombre) {
            alert('Ingresa el nombre de la jugadora');
            return;
        }
        if (!dorsal || dorsal < 1 || dorsal > 99) {
            alert('Ingresa un dorsal válido (1-99)');
            return;
        }
        if (this.jugadoras.find(j => j.dorsal === dorsal)) {
            alert('Ya existe una jugadora con ese dorsal');
            return;
        }

        const nuevaJugadora = {
            id: Date.now(),
            nombre,
            dorsal,
            posicion,
            puntosJugados: 0,
            partidosJugados: 0,
            entrenamientosAsistidos: 0,
            lesionada: false,
            notasLesion: ''
        };
        
        console.log('➕ Nueva jugadora creada:', nuevaJugadora);
        this.jugadoras.push(nuevaJugadora);
        this.guardarJugadoras();
        
        // Limpiar formulario
        document.getElementById('nombreJugadora').value = '';
        document.getElementById('dorsalJugadora').value = '';
        document.getElementById('posicionJugadora').value = 'jugadora';
        
        document.getElementById('formJugadora').style.display = 'none';
        this.actualizarEquipo();
        
        console.log('✅ Jugadora guardada exitosamente');
}
    async cargarJornadas() {
        console.log('📂 Cargando jornadas desde MongoDB (prioridad)...');
        let jornadas = [];
        
        // PRIMERO intentar cargar desde MongoDB (filtrado por usuario)
        try {
            const userId = this.getUserId();
            console.log('👤 Cargando jornadas para userId:', userId);
            const response = await fetch(`${this.API_URL}/jornadas?userId=${userId}`);
            if (response.ok) {
                jornadas = await response.json();
                console.log('☁️ Jornadas cargadas desde MongoDB:', jornadas.length);
                
                // Guardar en localStorage como backup (SIN mezclar con otros usuarios)
                if (jornadas.length > 0) {
                    localStorage.setItem(`volleyball_jornadas_${userId}`, JSON.stringify(jornadas));
                }
            }
        } catch (error) {
            console.warn('⚠️ No se pudo cargar desde MongoDB, intentando localStorage:', error.message);
            
            // FALLBACK: usar localStorage SOLO del usuario actual
            const userId = this.getUserId();
            const data = localStorage.getItem(`volleyball_jornadas_${userId}`);
            jornadas = data ? JSON.parse(data) : [];
            console.log('💾 Jornadas cargadas desde localStorage (userId-específico):', jornadas.length);
        }
        
        console.log('📅 Jornadas parseadas:', jornadas.length);
        
        // Limpiar null/undefined de sets y planificación existentes
        jornadas.forEach(jornada => {
            if (jornada.sets) {
                if (jornada.sets.set1) jornada.sets.set1 = jornada.sets.set1.filter(j => j !== null && j !== undefined);
                if (jornada.sets.set2) jornada.sets.set2 = jornada.sets.set2.filter(j => j !== null && j !== undefined);
                if (jornada.sets.set3) jornada.sets.set3 = jornada.sets.set3.filter(j => j !== null && j !== undefined);
            }
            if (jornada.planificacionManual) {
                if (jornada.planificacionManual.set1) jornada.planificacionManual.set1 = jornada.planificacionManual.set1.filter(j => j !== null && j !== undefined);
                if (jornada.planificacionManual.set2) jornada.planificacionManual.set2 = jornada.planificacionManual.set2.filter(j => j !== null && j !== undefined);
                if (jornada.planificacionManual.set3) jornada.planificacionManual.set3 = jornada.planificacionManual.set3.filter(j => j !== null && j !== undefined);
            }
        });
        
        return jornadas;
    }

    guardarJornadas() {
        const userId = this.getUserId();
        localStorage.setItem(`volleyball_jornadas_${userId}`, JSON.stringify(this.jornadas));
        // Sincronización automática con MongoDB (no esperar, es asíncrona)
        this.syncToMongoDB('jornadas', 'save');
    }
    
    async guardarJornadasSync() {
        const userId = this.getUserId();
        localStorage.setItem(`volleyball_jornadas_${userId}`, JSON.stringify(this.jornadas));
        // Sincronización SÍNCRONA con MongoDB (esperar a que termine)
        await this.syncToMongoDB('jornadas', 'save');
    }

    // ==================== CONFIGURACIÓN DE USUARIO ====================
    async cargarConfiguracion() {
        const userId = this.getUserId();
        
        try {
            // Intentar cargar desde MongoDB primero
            const configMongo = await fetch(`http://localhost:3000/api/config?userId=${userId}`);
            if (configMongo.ok) {
                const config = await configMongo.json();
                // Guardar en localStorage como caché
                localStorage.setItem(`volleyball_config_${userId}`, JSON.stringify(config));
                return config;
            }
        } catch (error) {
            console.warn('⚠️ No se pudo cargar config desde MongoDB, usando localStorage:', error);
        }
        
        // Fallback a localStorage si MongoDB falla
        const data = localStorage.getItem(`volleyball_config_${userId}`);
        return data ? JSON.parse(data) : {
            polideportivoCasa: '',
            ubicacionesGuardadas: [],
            rivalesGuardados: []
        };
    }

    async guardarConfiguracion(config) {
        const userId = this.getUserId();
        
        // Guardar en localStorage inmediatamente
        localStorage.setItem(`volleyball_config_${userId}`, JSON.stringify(config));
        
        // Sincronizar con MongoDB en segundo plano
        try {
            await fetch('http://localhost:3000/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...config })
            });
            console.log('✅ Configuración sincronizada con MongoDB');
        } catch (error) {
            console.error('❌ Error sincronizando config con MongoDB:', error);
        }
    }

    async agregarUbicacion(ubicacion) {
        if (!ubicacion || ubicacion.trim() === '') return;
        const config = await this.cargarConfiguracion();
        if (!config.ubicacionesGuardadas.includes(ubicacion)) {
            config.ubicacionesGuardadas.push(ubicacion);
            await this.guardarConfiguracion(config);
        }
    }

    async agregarRival(rival) {
        if (!rival || rival.trim() === '') return;
        const config = await this.cargarConfiguracion();
        if (!config.rivalesGuardados.includes(rival)) {
            config.rivalesGuardados.push(rival);
            await this.guardarConfiguracion(config);
        }
    }

    async populateAutocompleteDataLists() {
        const config = await this.cargarConfiguracion();
        
        // Populate ubicaciones datalist
        const ubicacionesList = document.getElementById('ubicacionesList');
        if (ubicacionesList) {
            ubicacionesList.innerHTML = '';
            config.ubicacionesGuardadas.forEach(ubicacion => {
                const option = document.createElement('option');
                option.value = ubicacion;
                ubicacionesList.appendChild(option);
            });
        }
        
        // Populate rivales datalist
        const rivalesList = document.getElementById('rivalesList');
        if (rivalesList) {
            rivalesList.innerHTML = '';
            config.rivalesGuardados.forEach(rival => {
                const option = document.createElement('option');
                option.value = rival;
                rivalesList.appendChild(option);
            });
        }
        
        // Pre-select "Casa" and fill ubicacion if polideportivoCasa exists
        const ubicacionInput = document.getElementById('ubicacionPartido');
        const radioCasa = document.getElementById('radioCasa');
        if (config.polideportivoCasa && ubicacionInput && radioCasa) {
            radioCasa.checked = true;
            ubicacionInput.value = config.polideportivoCasa;
        }
    }

    // ==================== INICIALIZACIÓN ====================
    inicializarApp() {
        // Sincronizar todas las jornadas existentes al iniciar
        this.jornadas.forEach(jornada => {
            this.sincronizarReferenciasJugadoras(jornada);
        });
        
        // TEMPORAL: Siempre mostrar la app principal, sin setup
        this.mostrarAppPrincipal();
    }

    mostrarSetup() {
        document.getElementById('setupInicial').style.display = 'flex';
        const mainApp = document.getElementById('mainApp') || document.querySelector('.container');
        if (mainApp) {
            mainApp.style.display = 'none';
        }
        this.configurarSetup();
    }

    mostrarAppPrincipal() {
        // FORZAR que NUNCA se muestre el setup
        const setupElements = document.querySelectorAll('.setup-modal, #setupInicial');
        setupElements.forEach(setup => {
            setup.style.display = 'none';
            setup.style.visibility = 'hidden';
        });
        
        // FORZAR mostrar la app principal
        const mainApp = document.getElementById('mainApp') || document.querySelector('.container');
        if (mainApp) {
            mainApp.style.display = 'block';
            mainApp.style.visibility = 'visible';
        }
        
        // ASEGURAR que el modal de sustitución esté oculto al iniciar
        const modalSustitucion = document.getElementById('modalSustitucion');
        if (modalSustitucion) {
            modalSustitucion.style.display = 'none';
        }
        
        this.configurarEventListeners();
        this.configurarTabs();
        this.actualizarInterfaz();
    }

    // ==================== SETUP INICIAL ====================
    configurarSetup() {
        const btnAgregar = document.getElementById('setupAgregar');
        const btnCompletar = document.getElementById('setupCompletar');
        const inputNombre = document.getElementById('setupNombre');
        const inputDorsal = document.getElementById('setupDorsal');
        
        // Añadir botón X para cerrar SIEMPRE
        const setupContent = document.querySelector('.setup-content');
        if (setupContent && !setupContent.querySelector('.btn-cerrar-setup')) {
            const btnCerrar = document.createElement('button');
            btnCerrar.className = 'btn-cerrar-setup';
            btnCerrar.innerHTML = '✕';
            btnCerrar.style.cssText = `
                position: absolute !important;
                top: 15px !important;
                right: 15px !important;
                background: #dc3545 !important;
                border: none !important;
                font-size: 20px !important;
                color: white !important;
                cursor: pointer !important;
                width: 35px !important;
                height: 35px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 50% !important;
                transition: all 0.3s ease !important;
                z-index: 9999 !important;
                font-weight: bold !important;
            `;
            
            btnCerrar.addEventListener('click', () => {
                this.cerrarSetupForzado();
            });
            
            setupContent.style.position = 'relative';
            setupContent.appendChild(btnCerrar);
        }
        
        if (btnAgregar) btnAgregar.addEventListener('click', () => this.agregarJugadoraSetup());
        if (btnCompletar) btnCompletar.addEventListener('click', () => this.completarSetup());
        
        if (inputNombre) {
            inputNombre.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.agregarJugadoraSetup();
            });
        }
        
        this.actualizarListaSetup();
    }
    
    cerrarSetupForzado() {
        // Cerrar el setup sin importar las condiciones
        document.getElementById('setupInicial').style.display = 'none';
        const mainApp = document.getElementById('mainApp') || document.querySelector('.container');
        if (mainApp) {
            mainApp.style.display = 'block';
        }
        
        // Si no se han configurado event listeners, configurarlos ahora
        try {
            this.configurarEventListeners();
            this.configurarTabs();
            this.actualizarInterfaz();
        } catch (error) {
            console.log('Event listeners ya configurados');
        }
    }

    agregarJugadoraSetup() {
        const nombre = document.getElementById('setupNombre').value.trim();
        const dorsal = parseInt(document.getElementById('setupDorsal').value);
        const posicion = document.getElementById('setupPosicion').value;
        
        if (!nombre) {
            alert('Ingresa el nombre de la jugadora');
            return;
        }
        
        if (!dorsal || dorsal < 1 || dorsal > 99) {
            alert('Ingresa un dorsal válido (1-99)');
            return;
        }
        
        if (this.jugadoras.find(j => j.dorsal === dorsal)) {
            alert('Ya existe una jugadora con ese dorsal');
            return;
        }
        
        const nuevaJugadora = {
            id: Date.now(),
            nombre: nombre,
            dorsal: dorsal,
            posicion: posicion,
            puntosJugados: 0,
            partidosJugados: 0,
            entrenamientosAsistidos: 0
        };
        
        this.jugadoras.push(nuevaJugadora);
        this.guardarJugadoras();
        
        // Limpiar formulario
        document.getElementById('setupNombre').value = '';
        document.getElementById('setupDorsal').value = '';
        
        this.actualizarListaSetup();
    }

    actualizarListaSetup() {
        const lista = document.getElementById('listaSetup');
        const btnCompletar = document.getElementById('setupCompletar');
        
        if (this.jugadoras.length === 0) {
            lista.innerHTML = '<p>No hay nadie agregado aún</p>';
        } else {
            lista.innerHTML = this.jugadoras
                .sort((a, b) => a.dorsal - b.dorsal)
                .map(j => `
                    <div class="jugadora-setup-item">
                        <span class="jugadora-setup-info">
                            ${j.posicion === 'colocadora' ? '🎯' : (j.posicion === 'central' ? '🛡️' : '🏐')} ${j.nombre} 
                            <span class="dorsal-badge">#${j.dorsal}</span>
                        </span>
                        <button onclick="app.eliminarJugadoraSetup(${j.id})">❌</button>
                    </div>
                `).join('');
        }
        
        btnCompletar.disabled = this.jugadoras.length < 6;
        btnCompletar.textContent = `Completar Setup (${this.jugadoras.length}/6 mín.)`;
    }

    eliminarJugadoraSetup(id) {
        this.jugadoras = this.jugadoras.filter(j => j.id !== id);
        this.guardarJugadoras();
        this.actualizarListaSetup();
    }

    completarSetup() {
        if (this.jugadoras.length >= 6) {
            this.mostrarAppPrincipal();
        }
    }

    omitirSetup() {
        if (confirm('¿Seguro que quieres continuar sin configurar el equipo? Podrás añadir jugadoras después en la pestaña "Equipo".')) {
            this.mostrarAppPrincipal();
        }
    }

    // ==================== CONFIGURACIÓN DE INTERFAZ ====================
    configurarTabs() {
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.cambiarTab(tab);
            });
        });
    }

    cambiarTab(tab) {
        console.log(`🔄 cambiarTab ejecutado con tab: "${tab}"`);
        
        // Actualizar botones
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        console.log(`🔍 Buscando botón con selector: [data-tab="${tab}"]`);
        
        const targetButton = document.querySelector(`[data-tab="${tab}"]`);
        console.log(`🎯 Botón encontrado:`, !!targetButton);
        if (targetButton) {
            targetButton.classList.add('active');
            console.log(`✅ Clase active agregada al botón ${tab}`);
        }
        
        // Actualizar contenido - MÉTODO SIMPLIFICADO
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            // Para admin, remover también la clase 'active' directamente
            if (content.id === 'admin') {
                content.classList.remove('active');
            }
        });
        
        console.log(`🔍 Buscando contenido con id: "${tab}"`);
        const targetContent = document.getElementById(tab);
        console.log(`🎯 Contenido encontrado:`, !!targetContent);
        
        if (targetContent) {
            targetContent.classList.add('active');
            console.log(`✅ Clase active agregada al contenido ${tab}`);
            
            // Para admin, forzar display
            if (tab === 'admin') {
                targetContent.style.display = 'block';
                targetContent.style.minHeight = '600px';
                targetContent.style.width = '100%';
                console.log(`🚀 Admin: Estilos forzados aplicados`);
            }
            
            console.log(`📏 Display CSS del contenido:`, getComputedStyle(targetContent).display);
        }
        
        this.currentTab = tab;
        console.log(`🏷️ currentTab actualizado a: ${this.currentTab}`);
        
        // Forzar actualización específica para la pestaña Equipo
        if (tab === 'jugadoras') {
            console.log('🏐 Cambiando a pestaña Equipo - Forzando actualización');
            this.actualizarEquipo();
            // Re-configurar event listeners para el equipo si es necesario
            this.configurarEventListenersEquipo();
        }
        
        this.actualizarInterfaz();
    }

    actualizarInterfaz() {
        if (this.currentTab === 'jornadas') {
            this.actualizarJornadas();
            // Populate autocomplete datalists when switching to jornadas tab
            this.populateAutocompleteDataLists();
        }
        if (this.currentTab === 'jugadoras') {
            console.log('🔄 Forzando actualización de equipo');
            this.actualizarEquipo();
        }
        if (this.currentTab === 'historial') this.actualizarHistorial();
        
        // Mostrar banner si hay jornadas pendientes (excepto si estamos editando)
        if (!this.jornadaActual || this.jornadaActual.completada) {
            this.mostrarBannerJornadaPendiente();
        }
    }

    // ==================== GESTIÓN DE JORNADAS ====================
    actualizarJornadas() {
        try {
            // Configurar fecha por defecto para nueva jornada
            const fechaInput = document.getElementById('fechaJornada');
            if (fechaInput && !fechaInput.value) {
                const hoy = new Date();
                console.log('🗓️ Configurando fecha por defecto desde:', hoy);
                const fechaString = hoy.toISOString().split('T')[0]; // Convertir a string YYYY-MM-DD
                console.log('🗓️ Fecha string generada:', fechaString);
                const lunes = this.obtenerProximoLunes(fechaString);
                console.log('🗓️ Lunes obtenido:', lunes);
                if (lunes && !isNaN(lunes.getTime())) {
                    fechaInput.value = lunes.toISOString().split('T')[0];
                    console.log('🗓️ Fecha asignada al input:', fechaInput.value);
                } else {
                    console.error('🗓️ Error: Lunes inválido');
                    fechaInput.value = fechaString; // Usar fecha actual como fallback
                }
            }
            
            // Actualizar lista de jornadas registradas
            this.actualizarListaJornadas();
        } catch (error) {
            console.error('❌ Error en actualizarJornadas:', error);
            // En caso de error, asignar fecha actual
            const fechaInput = document.getElementById('fechaJornada');
            if (fechaInput && !fechaInput.value) {
                const hoy = new Date();
                fechaInput.value = hoy.toISOString().split('T')[0];
            }
            this.actualizarListaJornadas();
        }
    }

    obtenerProximoLunes(fecha) {
        console.log('🗓️ DEBUG LUNES - Fecha entrada:', fecha, 'tipo:', typeof fecha);
        
        let seleccionada;
        try {
            // Si es un objeto Date, convertir a string primero
            if (fecha instanceof Date) {
                fecha = fecha.toISOString().split('T')[0];
            }
            
            // Asegurar que tiene el formato correcto YYYY-MM-DD
            if (typeof fecha === 'string' && fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
                seleccionada = new Date(fecha + 'T00:00:00');
            } else {
                // Si no es un formato válido, usar fecha actual
                console.warn('🗓️ Formato de fecha inválido, usando fecha actual');
                seleccionada = new Date();
            }
            
            console.log('🗓️ DEBUG LUNES - Fecha parseada:', seleccionada);
            
            // Verificar que la fecha es válida
            if (isNaN(seleccionada.getTime())) {
                console.error('🗓️ Fecha inválida, usando fecha actual');
                seleccionada = new Date();
            }
            
        } catch (error) {
            console.error('🗓️ Error al parsear fecha:', error);
            seleccionada = new Date();
        }
        
        const dia = seleccionada.getDay(); // 0=domingo, 1=lunes, 2=martes, ..., 6=sábado
        console.log('🗓️ DEBUG LUNES - Día de la semana (0=dom, 6=sab):', dia);
        
        // Calcular el lunes de la semana de la fecha seleccionada
        const lunes = new Date(seleccionada);
        
        // Si la fecha seleccionada es lunes (día 1), mantenerla
        // Si es martes a domingo, retroceder hasta el lunes de esa semana
        let diasAtras;
        if (dia === 0) { // Domingo
            diasAtras = 6; // Retroceder 6 días para llegar al lunes de esa semana
        } else if (dia === 1) { // Lunes
            diasAtras = 0; // No retroceder, es lunes
        } else { // Martes a sábado (2-6)
            diasAtras = dia - 1; // Retroceder los días necesarios para llegar al lunes
        }
        
        console.log('🗓️ DEBUG LUNES - Días a retroceder:', diasAtras);
        lunes.setDate(seleccionada.getDate() - diasAtras);
        console.log('🗓️ DEBUG LUNES - Lunes calculado:', lunes);
        console.log('🗓️ DEBUG LUNES - Día de la semana del lunes (debe ser 1):', lunes.getDay());
        
        return lunes;
    }

    async crearNuevaJornada() {
        const fechaInput = document.getElementById('fechaJornada');
        const fechaSeleccionada = fechaInput.value;
        
        if (!fechaSeleccionada) {
            alert('Selecciona una fecha para la jornada');
            return;
        }
        
        // Obtener ubicación y rival
        const ubicacionInput = document.getElementById('ubicacionPartido').value.trim();
        const rivalInput = document.getElementById('equipoRival').value.trim();
        const tipoUbicacion = document.querySelector('input[name="tipoUbicacion"]:checked').value;
        
        if (!ubicacionInput) {
            alert('Ingresa la ubicación del partido');
            return;
        }
        
        if (!rivalInput) {
            alert('Ingresa el equipo rival');
            return;
        }
        
        // Verificar si es la primera jornada y pedir polideportivo casa
        const config = await this.cargarConfiguracion();
        if (!config.polideportivoCasa && tipoUbicacion === 'casa') {
            const confirmar = confirm(
                `¿"${ubicacionInput}" es tu polideportivo casa?\n\n` +
                `Se guardará para futuras jornadas y podrás seleccionarlo rápidamente.`
            );
            if (confirmar) {
                config.polideportivoCasa = ubicacionInput;
                await this.guardarConfiguracion(config);
            }
        }
        
        // Guardar ubicación y rival en listas
        await this.agregarUbicacion(ubicacionInput);
        await this.agregarRival(rivalInput);
        
        // Convertir la fecha seleccionada a Date object (YYYY-MM-DD)
        const [year, month, day] = fechaSeleccionada.split('-').map(Number);
        const fechaObj = new Date(year, month - 1, day); // month - 1 porque enero es 0
        const diaSemana = fechaObj.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
        
        console.log('🗓️ Fecha seleccionada:', fechaSeleccionada);
        console.log('🗓️ Día de la semana seleccionado:', diaSemana);
        
        // Calcular el lunes de esa semana
        // Si es domingo (0), retroceder 6 días; si es lunes (1), es 0; si es martes (2), retroceder 1 día, etc.
        const diasHastaLunes = diaSemana === 0 ? -6 : -(diaSemana - 1);
        const fechaLunesObj = new Date(year, month - 1, day);
        fechaLunesObj.setDate(day + diasHastaLunes);
        
        // Calcular miércoles y sábado
        const fechaMiercolesObj = new Date(year, month - 1, day);
        fechaMiercolesObj.setDate(day + diasHastaLunes + 2);
        
        const fechaSabadoObj = new Date(year, month - 1, day);
        fechaSabadoObj.setDate(day + diasHastaLunes + 5);
        
        // Convertir a formato YYYY-MM-DD
        const formatoYYYYMMDD = (fecha) => {
            const y = fecha.getFullYear();
            const m = String(fecha.getMonth() + 1).padStart(2, '0');
            const d = String(fecha.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };
        
        const fechaLunes = formatoYYYYMMDD(fechaLunesObj);
        const fechaMiercoles = formatoYYYYMMDD(fechaMiercolesObj);
        const fechaSabado = formatoYYYYMMDD(fechaSabadoObj);
        
        console.log('🗓️ Lunes de esa semana:', fechaLunes, 'Día:', fechaLunesObj.getDay());
        console.log('🗓️ Miércoles de esa semana:', fechaMiercoles, 'Día:', fechaMiercolesObj.getDay());
        console.log('🗓️ Sábado de esa semana:', fechaSabado, 'Día:', fechaSabadoObj.getDay());
        
        // Verificar si ya existe una jornada para esa semana
        const existeJornada = this.jornadas.find(j => j.fechaLunes === fechaLunes);
        if (existeJornada) {
            alert('Ya existe una jornada para esa semana');
            return;
        }
        
        const nuevaJornada = {
            id: Date.now(),
            fechaSeleccionada: fechaSeleccionada, // Guardar la fecha que seleccionó el usuario
            fechaLunes: fechaLunes,
            fechaMiercoles: fechaMiercoles,
            fechaSabado: fechaSabado,
            asistenciaLunes: [],
            asistenciaMiercoles: [],
            asistenciaSabado: [],
            planificacionManual: null,
            rotacion: null,
            completada: false,
            fechaCreacion: new Date().toISOString(),
            ubicacion: ubicacionInput,
            tipoUbicacion: tipoUbicacion, // 'casa' o 'fuera'
            rival: rivalInput
        };
        
        this.jornadas.unshift(nuevaJornada);
        this.jornadaActual = nuevaJornada;
        this.pasoActual = 'lunes';
        
        // Resetear planificación de sets para nueva jornada
        this.planificacionSets = {
            set1: [],
            set2: [],
            set3: []
        };
        
        // Cerrar planificador si estaba abierto
        const planificadorContainer = document.getElementById('planificadorSets');
        if (planificadorContainer) {
            planificadorContainer.style.display = 'none';
        }
        
        this.guardarJornadas();
        this.mostrarJornadaActual();
        this.generarGridsAsistencia(); // Generar las grillas de jugadoras
        this.irAPaso('lunes');
    }

    mostrarJornadaActual() {
        if (!this.jornadaActual) return;
        
        document.getElementById('jornadaActual').style.display = 'block';
        
        // Usar fechaSeleccionada si existe, sino usar fechaLunes (para compatibilidad con jornadas antiguas)
        const fechaMostrar = this.jornadaActual.fechaSeleccionada || this.jornadaActual.fechaLunes;
        document.getElementById('tituloJornada').textContent = 
            `Jornada: Semana del ${this.formatearFecha(fechaMostrar)}`;
        
        // Actualizar títulos de días con fechas específicas
        this.actualizarTitulosDias();
        
        this.generarGridsAsistencia();
    }

    generarGridsAsistencia() {
        console.log('🔄 Generando grids de asistencia... Jugadoras disponibles:', this.jugadoras.length);
        
        const grids = [
            { id: 'asistenciaLunesGrid', asistencia: 'asistenciaLunes', dia: 'Lunes' },
            { id: 'asistenciaMiercolesGrid', asistencia: 'asistenciaMiercoles', dia: 'Miércoles' }, 
            { id: 'asistenciaSabadoGrid', asistencia: 'asistenciaSabado', dia: 'Sábado' }
        ];
        
        grids.forEach(grid => {
            const gridElement = document.getElementById(grid.id);
            console.log(`📋 Grid ${grid.id}:`, !!gridElement);
            
            if (gridElement) {
                if (this.jugadoras.length === 0) {
                    gridElement.innerHTML = '<div class="no-jugadoras">⚠️ No hay nadie registrado. Ve a la pestaña "Equipo" para añadir jugador/as.</div>';
                    return;
                }
                
                // Ordenar jugadoras por dorsal
                const jugadorasOrdenadas = [...this.jugadoras].sort((a, b) => a.dorsal - b.dorsal);
                
                // Calcular seleccionadas para este día
                const seleccionadas = this.jornadaActual ? this.jornadaActual[grid.asistencia].length : 0;
                const total = this.jugadoras.length;
                
                const htmlContent = jugadorasOrdenadas.map(jugadora => {
                    const isSelected = this.jornadaActual && this.jornadaActual[grid.asistencia].includes(jugadora.id);
                    return `
                        <div class="jugadora-card ${isSelected ? 'selected' : ''}" 
                             onclick="app.toggleAsistencia('${grid.asistencia}', ${jugadora.id})">
                            <div class="jugadora-header">
                                <span class='emoji'>${jugadora.posicion === 'colocadora' ? '🎯' : (jugadora.posicion === 'central' ? '🛡️' : '🏐')}</span>
                                <span class="jugadora-dorsal">#${jugadora.dorsal}</span>
                                <span class="jugadora-nombre">${jugadora.nombre}</span>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Añadir contador antes de las jugadoras
                gridElement.innerHTML = `
                    <div class="contador-asistencia">
                        <strong>Seleccionados/as: ${seleccionadas}/${total}</strong>
                    </div>
                    ${htmlContent}
                `;
                
                console.log(`✅ Grid ${grid.id} actualizado con ${this.jugadoras.length} jugadoras (ordenadas por dorsal)`);
            } else {
                console.log(`❌ No se encontró el elemento ${grid.id}`);
            }
        });
    }

    toggleAsistencia(tipoAsistencia, jugadoraId) {
        if (!this.jornadaActual) return;
        
        const asistencia = this.jornadaActual[tipoAsistencia];
        const index = asistencia.indexOf(jugadoraId);
        
        // Si estamos deseleccionando del sábado, verificar si está en sets
        if (index > -1 && tipoAsistencia === 'asistenciaSabado') {
            if (this.verificarJugadoraEnSets(jugadoraId)) {
                const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
                const mensaje = `⚠️ ${jugadora.nombre} está actualmente en los sets planificados.\n\n` +
                               `Al quitarla del sábado se eliminará de:\n` +
                               `• Los sets donde esté asignada\n` +
                               `• Todas las sustituciones relacionadas\n\n` +
                               `¿Estás seguro de continuar?`;
                
                if (!confirm(mensaje)) {
                    return; // Cancelar la acción
                }
            }
        }
        
        if (index > -1) {
            asistencia.splice(index, 1);
        } else {
            asistencia.push(jugadoraId);
        }
        
        this.guardarJornadas();
        this.generarGridsAsistencia();
        
        // Si estamos en el paso sábado, actualizar todo automáticamente
        if (tipoAsistencia === 'asistenciaSabado' && this.pasoActual === 'sabado') {
            // Si la jugadora fue deseleccionada, limpiarla completamente
            if (!this.jornadaActual.asistenciaSabado.includes(jugadoraId)) {
                this.limpiarJugadoraCompletamente(jugadoraId);
            }
            
            // NUNCA regenerar planificación si ya existe una - solo actualizar vistas
            const planificadorContainer = document.getElementById('planificadorSets');
            const yaTienePlanificacion = planificadorContainer && 
                planificadorContainer.style.display === 'block' &&
                planificadorContainer.innerHTML.trim().length > 0;
            
            console.log('🔍 Verificando planificación existente:', yaTienePlanificacion);
            
            if (!yaTienePlanificacion) {
                console.log('🆕 Generando planificación inicial');
                this.generarPlanificacionPartido();
            } else {
                console.log('🛡️ Planificación existente - SOLO actualizando vistas sin regenerar');
                // CRÍTICO: Solo actualizar jugadoras disponibles Y vistas de sets, NO regenerar HTML
                this.actualizarVistasSets();
                this.actualizarJugadorasDisponibles();
            }
        }
        
        // Si cambian asistencias de entrenamientos y estamos planificando, actualizar colores
        if ((tipoAsistencia === 'asistenciaLunes' || tipoAsistencia === 'asistenciaMiercoles') && this.pasoActual === 'sabado') {
            const planificacionContainer = document.querySelector('.planificacion-container');
            if (planificacionContainer && planificacionContainer.style.display !== 'none') {
                this.actualizarJugadorasDisponibles();
            }
        }
            // Actualizar prioridad por entrenamientos en tiempo real al seleccionar/deseleccionar jugadoras
            if (tipoAsistencia === 'asistenciaSabado' && this.pasoActual === 'sabado') {
                this.generarPlanificacionPartido();
            }
    }

    verificarJugadoraEnSets(jugadoraId) {
        // Verificar si está en set1, set2 o set3 (filtrar null primero)
        const enSet1 = this.planificacionSets?.set1?.filter(j => j !== null && j !== undefined).find(j => j.id === jugadoraId);
        const enSet2 = this.planificacionSets?.set2?.filter(j => j !== null && j !== undefined).find(j => j.id === jugadoraId);
        const enSet3 = this.planificacionSets?.set3?.filter(j => j !== null && j !== undefined).find(j => j.id === jugadoraId);
        
        // Verificar si tiene sustituciones
        const tieneSustitucionesSet1 = this.tieneSustituciones(jugadoraId, 1);
        const tieneSustitucionesSet2 = this.tieneSustituciones(jugadoraId, 2);
        const tieneSustitucionesSet3 = this.tieneSustituciones(jugadoraId, 3);
        
        return !!(enSet1 || enSet2 || enSet3 || tieneSustitucionesSet1 || tieneSustitucionesSet2 || tieneSustitucionesSet3);
    }

    tieneSustituciones(jugadoraId, set) {
        const container = document.getElementById(`suplentesSet${set}`);
        if (!container) return false;
        
        const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadora) return false;
        
        const items = container.querySelectorAll('.sustitucion-item');
        for (let item of items) {
            const texto = item.textContent.replace('×', '').trim();
            if (texto.includes(jugadora.nombre)) {
                return true;
            }
        }
        return false;
    }

    limpiarJugadoraCompletamente(jugadoraId) {
        const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadora) return;
        
        console.log(`🧹 Limpiando completamente a ${jugadora.nombre} de planificación`);
        
        // Reemplazar la jugadora con null en lugar de eliminarla (para mantener posiciones)
        this.planificacionSets.set1 = this.planificacionSets.set1.map(j => (j && j.id === jugadoraId) ? null : j);
        this.planificacionSets.set2 = this.planificacionSets.set2.map(j => (j && j.id === jugadoraId) ? null : j);
        this.planificacionSets.set3 = this.planificacionSets.set3.map(j => (j && j.id === jugadoraId) ? null : j);
        
        // Quitar de sustituciones (todos los sets)
        this.eliminarSustitucionesDeJugadora(jugadoraId, 'set1');
        this.eliminarSustitucionesDeJugadora(jugadoraId, 'set2');
        this.eliminarSustitucionesDeJugadora(jugadoraId, 'set3');
        
        // Auto-guardar cambios
        this.autoGuardarCambiosSets();
    }

    // Limpiar jugadora de sets cuando se deselecciona del sábado
    limpiarJugadoraDePlanificacion(jugadoraId) {
        console.log('🧹 Limpiando jugadora', jugadoraId, 'de la planificación de sets solamente');
        
        // Remover de set 1 - USAR FILTER en lugar de splice para evitar undefined
        if (this.planificacionSets.set1) {
            const antes = this.planificacionSets.set1.length;
            this.planificacionSets.set1 = this.planificacionSets.set1.filter(j => j && j.id !== jugadoraId);
            if (antes !== this.planificacionSets.set1.length) {
                console.log('🗑️ Removida del Set 1');
            }
        }
        
        // Remover de set 2 - USAR FILTER en lugar de splice para evitar undefined
        if (this.planificacionSets.set2) {
            const antes = this.planificacionSets.set2.length;
            this.planificacionSets.set2 = this.planificacionSets.set2.filter(j => j && j.id !== jugadoraId);
            if (antes !== this.planificacionSets.set2.length) {
                console.log('🗑️ Removida del Set 2');
            }
        }
        
        // SÍ limpiar sustituciones automáticamente cuando se quita del sábado
        this.limpiarSustitucionesDeJugadora(jugadoraId);
        
        // Actualizar vista inmediatamente
        this.actualizarJugadorasDisponibles();
        
        console.log('ℹ️ Vista actualizada sin regenerar planificación completa');
    }

    // Limpiar sustituciones donde esta jugadora participa automáticamente
    limpiarSustitucionesDeJugadora(jugadoraId) {
        const jugadoraObj = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadoraObj) return;
        
        let sustitucionesEliminadas = [];
        
        ['set1', 'set2'].forEach((setKey, index) => {
            const setNum = index + 1;
            const sustitucionesContainer = document.getElementById(`suplentesSet${setNum}`);
            
            if (sustitucionesContainer) {
                const sustitucionItems = sustitucionesContainer.querySelectorAll('.sustitucion-item');
                let eliminadas = 0;
                
                sustitucionItems.forEach(item => {
                    const texto = item.textContent || '';
                    const contieneJugadora = texto.includes(`${jugadoraObj.nombre} entra por`) || 
                                           texto.includes(`por ${jugadoraObj.nombre} en`);
                    
                    if (contieneJugadora) {
                        sustitucionesEliminadas.push(`Set ${setNum}: ${texto.replace('×', '').trim()}`);
                        item.remove();
                        eliminadas++;
                    }
                });
                
                if (eliminadas > 0) {
                    console.log(`✅ Eliminadas ${eliminadas} sustituciones del Set ${setNum}`);
                } else {
                    console.log(`ℹ️ No había sustituciones de ${jugadoraObj.nombre} en Set ${setNum}`);
                }
            }
        });
        
        if (sustitucionesEliminadas.length > 0) {
            console.log(`🧹 Sustituciones eliminadas automáticamente para ${jugadoraObj.nombre}:`);
            sustitucionesEliminadas.forEach(s => console.log(`   ✓ ${s}`));
        }
    }

    // Mostrar advertencia sobre sustituciones que pueden ser inválidas
    mostrarAdvertenciaSustitucionesInvalidas(jugadoraId) {
        const jugadoraObj = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadoraObj) return;
        
        let sustitucionesAfectadas = [];
        
        ['set1', 'set2'].forEach((setKey, index) => {
            const setNum = index + 1;
            const sustitucionesContainer = document.getElementById(`suplentesSet${setNum}`);
            
            if (sustitucionesContainer) {
                const sustitucionItems = sustitucionesContainer.querySelectorAll('.sustitucion-item');
                
                sustitucionItems.forEach(item => {
                    const texto = item.textContent || '';
                    const contieneJugadora = texto.includes(`${jugadoraObj.nombre} entra por`) || 
                                           texto.includes(`por ${jugadoraObj.nombre} en`);
                    
                    if (contieneJugadora) {
                        sustitucionesAfectadas.push(`Set ${setNum}: ${texto.replace('×', '').trim()}`);
                    }
                });
            }
        });
        
        if (sustitucionesAfectadas.length > 0) {
            console.warn(`⚠️ ADVERTENCIA: ${jugadoraObj.nombre} fue deseleccionada del sábado pero tiene sustituciones activas:`);
            sustitucionesAfectadas.forEach(s => console.warn(`   - ${s}`));
            console.warn('   💡 Puedes eliminar estas sustituciones manualmente si es necesario.');
        }
    }

    // Limpiar sustituciones donde esta jugadora participa (SOLO cuando se llama manualmente)
    limpiarSustitucionesDeJugadora(jugadoraId) {
        console.log('🧹 Limpiando sustituciones de jugadora', jugadoraId);
        
        const jugadoraObj = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadoraObj) {
            console.warn('⚠️ No se encontró la jugadora con ID', jugadoraId);
            return;
        }
        
        ['set1', 'set2'].forEach((setKey, index) => {
            const setNum = index + 1;
            const sustitucionesContainer = document.getElementById(`suplentesSet${setNum}`);
            
            if (sustitucionesContainer) {
                // Buscar y remover SOLO las sustituciones que involucren esta jugadora específica
                const sustitucionItems = sustitucionesContainer.querySelectorAll('.sustitucion-item');
                let eliminadas = 0;
                
                sustitucionItems.forEach(item => {
                    const texto = item.textContent || '';
                    // Verificar si el texto contiene exactamente el nombre de esta jugadora
                    // Buscar patrones como "Nombre entra por" o "por Nombre en"
                    const contieneJugadora = texto.includes(`${jugadoraObj.nombre} entra por`) || 
                                           texto.includes(`por ${jugadoraObj.nombre} en`);
                    
                    if (contieneJugadora) {
                        console.log(`🗑️ Removiendo sustitución del Set ${setNum}:`, texto.replace('×', '').trim());
                        item.remove();
                        eliminadas++;
                    }
                });
                
                if (eliminadas > 0) {
                    console.log(`✅ Eliminadas ${eliminadas} sustituciones del Set ${setNum}`);
                } else {
                    console.log(`ℹ️ No había sustituciones de ${jugadoraObj.nombre} en Set ${setNum}`);
                }
            }
        });
    }

    irAPaso(paso) {
        // Ocultar todos los pasos
        document.querySelectorAll('.jornada-paso').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.btn-nav').forEach(btn => btn.classList.remove('active'));
        
        // Mostrar paso actual
        document.getElementById(`paso${paso.charAt(0).toUpperCase() + paso.slice(1)}`).classList.add('active');
        document.getElementById(`ir${paso.charAt(0).toUpperCase() + paso.slice(1)}`).classList.add('active');
        
        this.pasoActual = paso;
        this.actualizarProgreso();
        
        if (paso === 'sabado') {
            this.generarPlanificacionPartido();
        }
        // El planificador se mantiene automáticamente por la lógica en mostrarAnalisisEntrenamientos()
    }

    actualizarProgreso() {
        const pasos = { lunes: 1, miercoles: 2, sabado: 3 };
        const pasoNum = pasos[this.pasoActual] || 1;
        document.getElementById('progresoJornada').textContent = `Paso ${pasoNum} de 3`;
    }

    generarPlanificacionPartido() {
        const container = document.getElementById('configuracionPartido');
        if (!container) return;
        
        if (!this.jornadaActual || this.jornadaActual.asistenciaSabado.length === 0) {
            container.innerHTML = '<div class="mensaje-info">Selecciona jugadoras para el partido</div>';
            return;
        }
        
        const jugadorasPartido = this.jornadaActual.asistenciaSabado.map(id => 
            this.jugadoras.find(j => j.id === id)
        ).filter(j => j);
        
        // Mostrar indicador y análisis por entrenamientos
        this.mostrarAnalisisEntrenamientos(jugadorasPartido, container);
    }

    mostrarAnalisisEntrenamientos(jugadorasPartido, container) {
        const totalJugadoras = jugadorasPartido.length;
        const minimo = 6;
        
        // Verificar si el planificador está abierto antes de regenerar
        const planificadorContainer = document.getElementById('planificadorSets');
        const estabaPlanificando = planificadorContainer && planificadorContainer.style.display === 'block';
        
        // Generar info del partido
        let partidoInfoHTML = '';
        if (this.jornadaActual.ubicacion || this.jornadaActual.rival) {
            const ubicacion = this.jornadaActual.ubicacion || 'Sin ubicación';
            const tipoUbic = this.jornadaActual.tipoUbicacion === 'fuera' ? '🏠 Fuera' : '🏡 Casa';
            const rival = this.jornadaActual.rival || 'Sin rival';
            partidoInfoHTML = `
                <div class="partido-info-banner">
                    <strong>${tipoUbic}:</strong> ${ubicacion} <strong>VS</strong> ${rival}
                </div>
            `;
        }
        
        // Analizar entrenamientos de la semana actual
        const jugadorasConEntrenamientos = jugadorasPartido.map(j => {
            const asistioLunes = this.jornadaActual.asistenciaLunes.includes(j.id);
            const asistioMiercoles = this.jornadaActual.asistenciaMiercoles.includes(j.id);
            const entrenamientos = (asistioLunes ? 1 : 0) + (asistioMiercoles ? 1 : 0);
            
            let color = 'rojo'; // 0 entrenamientos
            if (entrenamientos === 1) color = 'amarillo';
            if (entrenamientos === 2) color = 'verde';
            
            return { ...j, entrenamientos, color };
        });
        
        // Ordenar por entrenamientos (VERDE primero, luego AMARILLO, luego ROJO)
        const ordenadas = jugadorasConEntrenamientos.sort((a, b) => {
            // Primero ordenar por entrenamientos (MÁS entrenamientos primero: 2 > 1 > 0)
            if (a.entrenamientos !== b.entrenamientos) return b.entrenamientos - a.entrenamientos;
            // Dentro del mismo nivel de entrenamientos, ordenar por puntos jugados (menor a mayor)
            if ((a.puntosJugados || 0) !== (b.puntosJugados || 0)) return (a.puntosJugados || 0) - (b.puntosJugados || 0);
            // Si tienen los mismos puntos, ordenar por partidos jugados (menor a mayor)
            if ((a.partidosJugados || 0) !== (b.partidosJugados || 0)) return (a.partidosJugados || 0) - (b.partidosJugados || 0);
            // Si todo es igual, ordenar por dorsal
            return a.dorsal - b.dorsal;
        });
        
        // Preservar el estado del planificador al regenerar HTML
        const planificadorDisplay = estabaPlanificando ? 'block' : 'none';
        
        container.innerHTML = `
            ${partidoInfoHTML}
            <div class="indicador-minimo">
                <strong>Seleccionados/as: ${totalJugadoras}/${minimo} mínimo</strong>
                ${totalJugadoras < minimo ? 
                    `<span class="faltan"> - Faltan ${minimo - totalJugadoras}</span>` : 
                    '<span class="completo"> ✓ Listo para planificar</span>'}
            </div>
            
            <div class="analisis-entrenamientos">
                <h4>Prioridad por entrenamientos esta semana:</h4>
                <div class="jugadoras-por-entrenamientos-horizontal">
                    ${ordenadas.map(j => `
                        <div class="jugadora-entrenamiento-box ${j.color}">
                            <span class="dorsal">#${j.dorsal}</span> <span class="nombre">${j.nombre}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="leyenda-colores">
                    <span class="leyenda-item verde">2 Entrenamientos</span>
                    <span class="leyenda-item amarillo">1 Entrenamiento</span>
                    <span class="leyenda-item rojo">0 Entrenamientos</span>
                </div>
            </div>
            
            ${totalJugadoras >= minimo ? `
                <div class="boton-planificar-container">
                    <button id="btnPlanificarSets" class="btn-planificar-sets">📋 Planificar Sets</button>
                </div>
                <div id="planificadorSets" class="planificador-sets" style="display: ${planificadorDisplay};"></div>
            ` : ''}
        `;
        
        // Event listener para el botón
        if (totalJugadoras >= minimo) {
            document.getElementById('btnPlanificarSets')?.addEventListener('click', () => {
                this.mostrarPlanificadorSets(ordenadas);
            });
            
            // Si el planificador estaba abierto, restaurar su contenido
            if (estabaPlanificando) {
                setTimeout(() => {
                    this.mostrarPlanificadorSets(ordenadas);
                    this.actualizarJugadorasDisponibles();
                }, 50);
            }
        }
    }

    mostrarPlanificadorSets(jugadorasDisponibles) {
        const container = document.getElementById('planificadorSets');
        if (!container) return;
        
        // Inicializar estructuras de sets solo si no existen
        if (!this.planificacionSets) {
            this.planificacionSets = {
                set1: [],
                set2: [],
                set3: []
            };
        }
        
        container.style.display = 'block';
        container.innerHTML = `
            <div class="sets-container">
                <div class="set-column">
                    <h4>Set 1</h4>
                    <div id="set1Container" class="set-container-campo">
                        <div class="jugadoras-set" id="jugadorasSet1"></div>
                    </div>
                    <div class="suplentes-container">
                        <h5>Suplentes Set 1</h5>
                        <div id="suplentesSet1" class="suplentes-list"></div>
                        <button id="btnAddSuplente1" class="btn-add-suplente">+ Añadir Sustitución</button>
                    </div>
                </div>
                
                <div class="set-column">
                    <h4>Set 2</h4>
                    <div id="set2Container" class="set-container-campo">
                        <div class="jugadoras-set" id="jugadorasSet2"></div>
                    </div>
                    <div class="suplentes-container">
                        <h5>Suplentes Set 2</h5>
                        <div id="suplentesSet2" class="suplentes-list"></div>
                        <button id="btnAddSuplente2" class="btn-add-suplente">+ Añadir Sustitución</button>
                    </div>
                </div>
                
                <div class="set-column">
                    <h4>Set 3 (Opcional)</h4>
                    <div id="set3Container" class="set-container-campo">
                        <div class="jugadoras-set" id="jugadorasSet3"></div>
                    </div>
                    <div class="suplentes-container">
                        <h5>Suplentes Set 3</h5>
                        <div id="suplentesSet3" class="suplentes-list"></div>
                        <button id="btnAddSuplente3" class="btn-add-suplente">+ Añadir Sustitución</button>
                    </div>
                </div>
            </div>
            
            <div class="jugadoras-disponibles-container">
                <h4>Disponibles</h4>
                <div id="jugadorasDisponibles" class="jugadoras-disponibles-grid"></div>
            </div>
        `;
        
        // Event listeners para suplentes
        document.getElementById('btnAddSuplente1')?.addEventListener('click', () => this.añadirSustitucion(1));
        document.getElementById('btnAddSuplente2')?.addEventListener('click', () => this.añadirSustitucion(2));
        document.getElementById('btnAddSuplente3')?.addEventListener('click', () => this.añadirSustitucion(3));
        
        this.actualizarVistasSets();
        this.actualizarJugadorasDisponibles();
        
        // Restaurar sustituciones existentes después de regenerar HTML
        this.restaurarSustitucionesExistentes();
    }

    restaurarSustitucionesExistentes() {
        if (!this.jornadaActual?.sustituciones) {
            // Inicializar estructura de sustituciones vacía si no existe
            if (this.jornadaActual) {
                this.jornadaActual.sustituciones = { set1: [], set2: [], set3: [] };
            }
            return;
        }
        
        console.log('🔄 Restaurando sustituciones existentes:', this.jornadaActual.sustituciones);
        
        // Restaurar sustituciones del Set 1
        if (this.jornadaActual.sustituciones.set1?.length > 0) {
            const container1 = document.getElementById('suplentesSet1');
            if (container1) {
                this.jornadaActual.sustituciones.set1.forEach(sustitucion => {
                    const entraJugadora = this.jugadoras.find(j => j.id === sustitucion.entraId);
                    const saleJugadora = this.jugadoras.find(j => j.id === sustitucion.saleId);
                    
                    if (entraJugadora && saleJugadora) {
                        const sustitucionElement = document.createElement('div');
                        sustitucionElement.className = 'sustitucion-item';
                        sustitucionElement.innerHTML = `
                            <span>${entraJugadora.nombre} entra por ${saleJugadora.nombre} en el punto ${sustitucion.punto}</span>
                            <button class="btn-eliminar-sustitucion" onclick="app.eliminarSustitucion(this)">×</button>
                        `;
                        container1.appendChild(sustitucionElement);
                    }
                });
            }
        }
        
        // Restaurar sustituciones del Set 2
        if (this.jornadaActual.sustituciones.set2?.length > 0) {
            const container2 = document.getElementById('suplentesSet2');
            if (container2) {
                this.jornadaActual.sustituciones.set2.forEach(sustitucion => {
                    const entraJugadora = this.jugadoras.find(j => j.id === sustitucion.entraId);
                    const saleJugadora = this.jugadoras.find(j => j.id === sustitucion.saleId);
                    
                    if (entraJugadora && saleJugadora) {
                        const sustitucionElement = document.createElement('div');
                        sustitucionElement.className = 'sustitucion-item';
                        sustitucionElement.innerHTML = `
                            <span>${entraJugadora.nombre} entra por ${saleJugadora.nombre} en el punto ${sustitucion.punto}</span>
                            <button class="btn-eliminar-sustitucion" onclick="app.eliminarSustitucion(this)">×</button>
                        `;
                        container2.appendChild(sustitucionElement);
                    }
                });
            }
        }
        
        // Restaurar sustituciones del Set 3
        if (this.jornadaActual.sustituciones.set3?.length > 0) {
            const container3 = document.getElementById('suplentesSet3');
            if (container3) {
                this.jornadaActual.sustituciones.set3.forEach(sustitucion => {
                    const entraJugadora = this.jugadoras.find(j => j.id === sustitucion.entraId);
                    const saleJugadora = this.jugadoras.find(j => j.id === sustitucion.saleId);
                    
                    if (entraJugadora && saleJugadora) {
                        const sustitucionElement = document.createElement('div');
                        sustitucionElement.className = 'sustitucion-item';
                        sustitucionElement.innerHTML = `
                            <span>${entraJugadora.nombre} entra por ${saleJugadora.nombre} en el punto ${sustitucion.punto}</span>
                            <button class="btn-eliminar-sustitucion" onclick="app.eliminarSustitucion(this)">×</button>
                        `;
                        container3.appendChild(sustitucionElement);
                    }
                });
            }
        }
        
        console.log('✅ Sustituciones restauradas visualmente');
    }

    seleccionarJugadora(jugadoraId) {
        const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadora) return;
        
        // Construir opciones disponibles
        const set1Count = this.planificacionSets.set1.length;
        const set2Count = this.planificacionSets.set2.length;
        const set3Count = this.planificacionSets.set3.length;
        
        let opciones = '';
        let opcionesValidas = [];
        
        if (set1Count < 6) {
            opciones += `1 - Set 1 (${set1Count}/6)\n`;
            opcionesValidas.push('1');
        }
        
        if (set2Count < 6) {
            opciones += `2 - Set 2 (${set2Count}/6)\n`;
            opcionesValidas.push('2');
        }
        
        if (set3Count < 6) {
            opciones += `3 - Set 3 - Opcional (${set3Count}/6)\n`;
            opcionesValidas.push('3');
        }
        
        if (opcionesValidas.length === 0) {
            alert('Todos los sets están completos (6 jugadoras cada uno)');
            return;
        }
        
        // Preguntar en qué set quiere añadirla
        const set = prompt(`¿En qué set quieres añadir a ${jugadora.nombre}?\n${opciones}`);
        
        if (opcionesValidas.includes(set)) {
            this.añadirJugadoraASet(jugadoraId, set);
        }
    }

    añadirJugadoraASet(jugadoraId, set) {
        const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadora) {
            console.error('Jugadora no encontrada:', jugadoraId);
            return;
        }
        
        console.log(`Intentando añadir ${jugadora.nombre} al Set ${set}`);
        
        // Verificar límites
        if ((set === '1' && this.planificacionSets.set1.length >= 6) ||
            (set === '2' && this.planificacionSets.set2.length >= 6) ||
            (set === '3' && this.planificacionSets.set3.length >= 6)) {
            alert('El set ya tiene 6 jugadoras');
            return;
        }
        
        // Verificar si ya está en ese set
        const yaEnSet1 = this.planificacionSets.set1.find(j => j.id === jugadoraId);
        const yaEnSet2 = this.planificacionSets.set2.find(j => j.id === jugadoraId);
        const yaEnSet3 = this.planificacionSets.set3.find(j => j.id === jugadoraId);
        
        if ((set === '1' && yaEnSet1) || (set === '2' && yaEnSet2) || (set === '3' && yaEnSet3)) {
            alert('La jugadora ya está en ese set');
            return;
        }
        
        // Añadir a la estructura correspondiente
        if (set === '1') {
            this.planificacionSets.set1.push(jugadora);
            console.log(`${jugadora.nombre} añadida al Set 1. Total: ${this.planificacionSets.set1.length}`);
        } else if (set === '2') {
            this.planificacionSets.set2.push(jugadora);
            console.log(`${jugadora.nombre} añadida al Set 2. Total: ${this.planificacionSets.set2.length}`);
        } else if (set === '3') {
            this.planificacionSets.set3.push(jugadora);
            console.log(`${jugadora.nombre} añadida al Set 3. Total: ${this.planificacionSets.set3.length}`);
        }
        
        // NO remover de disponibles - solo actualizar vistas
        this.actualizarVistasSets();
        this.actualizarJugadorasDisponibles();
        
        // Auto-guardar cambios en modo edición
        if (this.jornadaActual && this.jornadaActual.id) {
            this.autoGuardarCambiosSets();
        }
    }

    autoGuardarCambiosSets() {
        if (!this.jornadaActual) return;
        
        // Guardar estado actual de sets (filtrar null para evitar undefined)
        this.jornadaActual.sets = {
            set1: this.planificacionSets.set1.filter(j => j !== null && j !== undefined),
            set2: this.planificacionSets.set2.filter(j => j !== null && j !== undefined),
            set3: this.planificacionSets.set3.filter(j => j !== null && j !== undefined)
        };
        
        // Guardar sustituciones actuales
        this.jornadaActual.sustituciones = {
            set1: this.obtenerSustituciones(1),
            set2: this.obtenerSustituciones(2),
            set3: this.obtenerSustituciones(3)
        };
        
        // Guardar en localStorage
        this.guardarJornadas();
        
        console.log('💾 Auto-guardado: sets y sustituciones actualizados');
    }

    actualizarVistasSets() {
        // Actualizar Set 1 - Campo de voleibol con posiciones fijas (4,3,2 arriba / 5,6,1 abajo)
        const set1Container = document.getElementById('jugadorasSet1');
        if (set1Container) {
            set1Container.innerHTML = this.generarCampoVoleibol('set1');
        }
        
        // Actualizar Set 2 - Campo de voleibol con posiciones fijas
        const set2Container = document.getElementById('jugadorasSet2');
        if (set2Container) {
            set2Container.innerHTML = this.generarCampoVoleibol('set2');
        }
        
        // Actualizar Set 3 - Campo de voleibol con posiciones fijas
        const set3Container = document.getElementById('jugadorasSet3');
        if (set3Container) {
            set3Container.innerHTML = this.generarCampoVoleibol('set3');
        }
    }

    generarCampoVoleibol(setKey) {
        // Asegurar que existe el array de jugadoras
        if (!this.planificacionSets[setKey]) {
            this.planificacionSets[setKey] = [];
        }
        
        const jugadoras = this.planificacionSets[setKey];
        
        // Convertir array a objeto de posiciones si no lo es
        if (Array.isArray(jugadoras) && jugadoras.length > 0 && typeof jugadoras[0] !== 'object') {
            // Ya es un array de objetos jugadora
        }
        
        // Crear objeto de posiciones (1-6)
        const posiciones = {};
        jugadoras.forEach((jugadora, index) => {
            if (jugadora) {
                posiciones[index + 1] = jugadora;
            }
        });
        
        // Orden de voleibol: 4,3,2 (arriba) / 5,6,1 (abajo)
        const ordenArriba = [4, 3, 2];
        const ordenAbajo = [5, 6, 1];
        
        let html = '<div class="fila-campo">';
        ordenArriba.forEach(pos => {
            html += this.generarPosicion(posiciones[pos], pos, setKey);
        });
        html += '</div><div class="fila-campo">';
        ordenAbajo.forEach(pos => {
            html += this.generarPosicion(posiciones[pos], pos, setKey);
        });
        html += '</div>';
        
        return html;
    }

    generarPosicion(jugadora, posicion, setKey) {
        // Verificar que jugadora existe y no es null ni undefined
        if (jugadora !== null && jugadora !== undefined && jugadora.nombre) {
            // Obtener emoji según el rol
            let emojiRol = '🏐'; // Jugadora normal
            if (jugadora.posicion === 'colocadora') emojiRol = '🎯';
            else if (jugadora.posicion === 'central') emojiRol = '🛡️';
            
            return `
                <div class="posicion-campo ocupada" onclick="app.removerJugadoraDePosicion(${posicion}, '${setKey}')" title="Posición ${posicion} - Click para quitar">
                    <span class="numero-posicion">${posicion}</span>
                    <span class="dorsal-campo">#${jugadora.dorsal}</span>
                    <span class="rol-campo">${emojiRol}</span>
                    <span class="nombre-campo">${jugadora.nombre}</span>
                </div>
            `;
        } else {
            return `
                <div class="posicion-campo vacia" onclick="app.añadirJugadoraAPosicion(${posicion}, '${setKey}')" title="Posición ${posicion} - Click para añadir jugadora">
                    <span class="numero-posicion">${posicion}</span>
                    <span>Libre</span>
                </div>
            `;
        }
    }

    añadirJugadoraAPosicion(posicion, setKey) {
        const setNum = setKey === 'set1' ? 1 : (setKey === 'set2' ? 2 : 3);
        
        // Obtener jugadoras disponibles (del sábado que NO estén en este set)
        const jugadorasDelSabado = this.jornadaActual.asistenciaSabado.map(id =>
            this.jugadoras.find(j => j.id === id)
        ).filter(j => j);
        
        const jugadorasEnSet = this.planificacionSets[setKey] || [];
        const jugadorasDisponibles = jugadorasDelSabado.filter(j =>
            !jugadorasEnSet.find(js => js && js.id === j.id)
        );
        
        if (jugadorasDisponibles.length === 0) {
            alert('No hay personas disponibles para añadir');
            return;
        }
        
        // Mostrar modal con jugadoras disponibles
        this.mostrarModalSeleccionJugadora(jugadorasDisponibles, posicion, setKey, setNum);
    }

    mostrarModalSeleccionJugadora(jugadorasDisponibles, posicion, setKey, setNum) {
        const modal = document.getElementById('modal-seleccion-jugadora');
        const titulo = document.getElementById('titulo-seleccion-jugadora');
        const lista = document.getElementById('lista-jugadoras-modal');
        
        titulo.textContent = `Seleccionar Jugador/a - Posición ${posicion} (Set ${setNum})`;
        
        // ORDENAR jugadoras: primero por entrenamientos (2→1→0), luego por puntos (menor a mayor)
        const jugadorasConDatos = jugadorasDisponibles.map(j => {
            const asistioLunes = this.jornadaActual.asistenciaLunes.includes(j.id);
            const asistioMiercoles = this.jornadaActual.asistenciaMiercoles.includes(j.id);
            const entrenamientos = (asistioLunes ? 1 : 0) + (asistioMiercoles ? 1 : 0);
            
            return {
                jugadora: j,
                entrenamientos: entrenamientos,
                puntosJugados: j.puntosJugados || 0
            };
        });
        
        // Ordenar: Verde (2) > Naranja (1) > Rojo (0), dentro de cada grupo por puntos, luego por dorsal
        jugadorasConDatos.sort((a, b) => {
            // Primero por entrenamientos (descendente: 2, 1, 0)
            if (b.entrenamientos !== a.entrenamientos) {
                return b.entrenamientos - a.entrenamientos;
            }
            // Luego por puntos jugados (ascendente: menos puntos primero)
            if (a.puntosJugados !== b.puntosJugados) {
                return a.puntosJugados - b.puntosJugados;
            }
            // Finalmente por dorsal (ascendente: menor dorsal primero)
            return a.jugadora.dorsal - b.jugadora.dorsal;
        });
        
        // Generar lista de jugadoras
        lista.innerHTML = jugadorasConDatos.map(({jugadora: j, entrenamientos}) => {
            // Verificar si está en otros sets
            const setsActuales = [];
            if (setKey !== 'set1' && this.planificacionSets.set1.find(js => js && js.id === j.id)) setsActuales.push('1');
            if (setKey !== 'set2' && this.planificacionSets.set2.find(js => js && js.id === j.id)) setsActuales.push('2');
            if (setKey !== 'set3' && this.planificacionSets.set3.find(js => js && js.id === j.id)) setsActuales.push('3');
            
            // Emoji según la posición/rol
            let emojiRol = '🏐'; // Jugadora normal
            if (j.posicion === 'colocadora') emojiRol = '🎯';
            else if (j.posicion === 'central') emojiRol = '🛡️';
            
            let estadoTexto = '';
            let colorFondo = '';
            
            // Colores según entrenamientos
            if (entrenamientos === 2) {
                colorFondo = 'background: #d4edda; border-color: #28a745;'; // Verde
            } else if (entrenamientos === 1) {
                colorFondo = 'background: #fff3cd; border-color: #ffc107;'; // Naranja/Amarillo
            } else {
                colorFondo = 'background: #f8d7da; border-color: #dc3545;'; // Rojo
            }
            
            // Texto SOLO si está en otro set
            if (setsActuales.length > 0) {
                estadoTexto = `⚠️ Ya en Set ${setsActuales.join(', ')}`;
            }
            
            return `
                <div class="jugadora-modal-item" style="${colorFondo}" onclick="app.seleccionarJugadoraParaPosicion(${j.id}, ${posicion}, '${setKey}')">
                    <div class="jugadora-modal-info">
                        <span class="jugadora-modal-dorsal">#${j.dorsal}</span>
                        <span class="jugadora-modal-rol">${emojiRol}</span>
                        <span class="jugadora-modal-nombre">${j.nombre}</span>
                    </div>
                    ${estadoTexto ? `<span class="jugadora-modal-estado">${estadoTexto}</span>` : ''}
                </div>
            `;
        }).join('');
        
        modal.style.display = 'flex';
        
        // Listener para tecla ESC (agregar solo una vez)
        if (!modal.hasAttribute('data-esc-listener')) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' || e.key === 'Esc') {
                    const modalVisible = document.getElementById('modal-seleccion-jugadora');
                    if (modalVisible && modalVisible.style.display === 'flex') {
                        this.cerrarModalSeleccion();
                    }
                }
            });
            modal.setAttribute('data-esc-listener', 'true');
        }
        
        // Listener para cerrar al hacer clic fuera del modal
        if (!modal.hasAttribute('data-click-listener')) {
            // Prevenir que clicks en el contenido cierren el modal
            const modalContent = modal.querySelector('.modal-seleccion-content');
            if (modalContent) {
                modalContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
            
            // Cerrar al hacer clic en el overlay (fondo)
            modal.addEventListener('click', () => {
                this.cerrarModalSeleccion();
            });
            
            modal.setAttribute('data-click-listener', 'true');
        }
    }

    seleccionarJugadoraParaPosicion(jugadoraId, posicion, setKey) {
        const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
        
        if (jugadora) {
            // Asegurar que el array tenga 6 posiciones
            while (this.planificacionSets[setKey].length < 6) {
                this.planificacionSets[setKey].push(null);
            }
            
            // Añadir en la posición específica (posición 1-6, array 0-5)
            this.planificacionSets[setKey][posicion - 1] = jugadora;
            
            this.actualizarVistasSets();
            this.actualizarJugadorasDisponibles();
            
            // Auto-guardar
            if (this.jornadaActual && this.jornadaActual.id) {
                this.autoGuardarCambiosSets();
            }
            
            // Cerrar modal
            this.cerrarModalSeleccion();
        }
    }

    cerrarModalSeleccion() {
        const modal = document.getElementById('modal-seleccion-jugadora');
        modal.style.display = 'none';
    }

    removerJugadoraDePosicion(posicion, setKey) {
        // Remover la jugadora de la posición específica (dejar null)
        if (this.planificacionSets[setKey] && this.planificacionSets[setKey][posicion - 1]) {
            const jugadora = this.planificacionSets[setKey][posicion - 1];
            
            if (confirm(`¿Quitar a ${jugadora.nombre} de la posición ${posicion}?`)) {
                this.planificacionSets[setKey][posicion - 1] = null;
                
                // Eliminar sustituciones relacionadas
                this.eliminarSustitucionesDeJugadora(jugadora.id, setKey);
                
                this.actualizarVistasSets();
                this.actualizarJugadorasDisponibles();
                
                // Auto-guardar
                if (this.jornadaActual && this.jornadaActual.id) {
                    this.autoGuardarCambiosSets();
                }
            }
        }
    }

    actualizarJugadorasDisponibles() {
        const container = document.getElementById('jugadorasDisponibles');
        if (!container) return;
        
        // Obtener todas las jugadoras del sábado
        const jugadorasPartido = this.jornadaActual.asistenciaSabado.map(id => 
            this.jugadoras.find(j => j.id === id)
        ).filter(j => j);
        
        // Ordenar por color (verde > amarillo > rojo) y DENTRO DE CADA COLOR por puntos jugados (menor a mayor)
        const jugadorasOrdenadas = jugadorasPartido.map(j => {
            const asistioLunes = this.jornadaActual.asistenciaLunes.includes(j.id);
            const asistioMiercoles = this.jornadaActual.asistenciaMiercoles.includes(j.id);
            const entrenamientos = (asistioLunes ? 1 : 0) + (asistioMiercoles ? 1 : 0);
            
            let color = 'rojo';
            let prioridad = 3;
            if (entrenamientos === 1) {
                color = 'amarillo';
                prioridad = 2;
            }
            if (entrenamientos === 2) {
                color = 'verde';
                prioridad = 1;
            }
            
            return { ...j, color, prioridad };
        }).sort((a, b) => {
            // Primero ordenar por prioridad de color (verde=1 primero, amarillo=2, rojo=3)
            if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
            // Dentro del mismo color, ordenar por puntos jugados (menor a mayor)
            if ((a.puntosJugados || 0) !== (b.puntosJugados || 0)) return (a.puntosJugados || 0) - (b.puntosJugados || 0);
            // Si tienen los mismos puntos, ordenar por partidos jugados (menor a mayor)
            if ((a.partidosJugados || 0) !== (b.partidosJugados || 0)) return (a.partidosJugados || 0) - (b.partidosJugados || 0);
            // Si todo es igual, ordenar por dorsal
            return a.dorsal - b.dorsal;
        });
        
        container.innerHTML = jugadorasOrdenadas.map(j => {
            // Determinar estado en sets y suplentes (SIN FILTRAR para mantener posiciones)
            const enSet1 = this.planificacionSets.set1.find(js => js && js.id === j.id);
            const enSet2 = this.planificacionSets.set2.find(js => js && js.id === j.id);
            const enSet3 = this.planificacionSets.set3.find(js => js && js.id === j.id);
            
            // Verificar si es suplente en algún set
            const esSuplente1 = this.verificarSiEsSuplente(j.id, 1);
            const esSuplente2 = this.verificarSiEsSuplente(j.id, 2);
            const esSuplente3 = this.verificarSiEsSuplente(j.id, 3);
            
            // Contar en cuántos sets está
            const setsConJugadora = [];
            if (enSet1 || esSuplente1) setsConJugadora.push('1');
            if (enSet2 || esSuplente2) setsConJugadora.push('2');
            if (enSet3 || esSuplente3) setsConJugadora.push('3');
            
            let etiqueta = '';
            if (setsConJugadora.length === 3) {
                etiqueta = '<span class="etiqueta-estado">Ya en Set 1, 2 y 3</span>';
            } else if (setsConJugadora.length === 2) {
                etiqueta = `<span class="etiqueta-estado">Ya en Set ${setsConJugadora.join(' y ')}</span>`;
            } else if (setsConJugadora.length === 1) {
                etiqueta = `<span class="etiqueta-estado">Ya en Set ${setsConJugadora[0]}</span>`;
            }
            
            return `
                <div class="jugadora-disponible ${j.color}" data-id="${j.id}">
                    ${etiqueta}
                    <span class="jugadora-info">#${j.dorsal} ${j.nombre}</span>
                </div>
            `;
        }).join('');
    }

    verificarSiEsSuplente(jugadoraId, set) {
        const container = document.getElementById(`suplentesSet${set}`);
        if (!container) return false;
        
        const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadora) return false;
        
        const items = container.querySelectorAll('.sustitucion-item');
        for (let item of items) {
            const texto = item.textContent.replace('×', '').trim();
            if (texto.includes(jugadora.nombre)) {
                return true;
            }
        }
        return false;
    }

    removerJugadoraDeSet(jugadoraId, set) {
        const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadora) return;
        
        // Remover del set
        if (set === 'set1') {
            this.planificacionSets.set1 = this.planificacionSets.set1.filter(j => j.id !== jugadoraId);
        } else if (set === 'set2') {
            this.planificacionSets.set2 = this.planificacionSets.set2.filter(j => j.id !== jugadoraId);
        } else if (set === 'set3') {
            this.planificacionSets.set3 = this.planificacionSets.set3.filter(j => j.id !== jugadoraId);
        }
        
        // Auto-eliminar sustituciones relacionadas con esta jugadora
        this.eliminarSustitucionesDeJugadora(jugadoraId, set);
        
        // Actualizar vistas sin remover de disponibles
        this.actualizarVistasSets();
        this.actualizarJugadorasDisponibles();
        
        // Auto-guardar cambios en modo edición
        if (this.jornadaActual && this.jornadaActual.id) {
            this.autoGuardarCambiosSets();
        }
    }

    eliminarSustitucionesDeJugadora(jugadoraId, set) {
        const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadora) return;
        
        const setNum = set === 'set1' ? 1 : (set === 'set2' ? 2 : 3);
        const container = document.getElementById(`suplentesSet${setNum}`);
        if (!container) return;
        
        // Buscar y eliminar todas las sustituciones donde esta jugadora es la que sale
        const items = container.querySelectorAll('.sustitucion-item');
        items.forEach(item => {
            const texto = item.textContent;
            if (texto.includes(`por ${jugadora.nombre}`)) {
                console.log(`🗑️ Auto-eliminando sustitución de ${jugadora.nombre} en Set ${setNum}`);
                item.remove();
                
                // También eliminar de la estructura de datos si existe
                if (this.jornadaActual?.sustituciones?.[`set${setNum}`]) {
                    this.jornadaActual.sustituciones[`set${setNum}`] = 
                        this.jornadaActual.sustituciones[`set${setNum}`].filter(s => s.saleId !== jugadoraId);
                }
            }
        });
    }

    volverADisponibles(jugadora) {
        const container = document.getElementById('jugadorasDisponibles');
        if (!container) return;
        
        // Determinar color por entrenamientos
        const asistioLunes = this.jornadaActual.asistenciaLunes.includes(jugadora.id);
        const asistioMiercoles = this.jornadaActual.asistenciaMiercoles.includes(jugadora.id);
        const entrenamientos = (asistioLunes ? 1 : 0) + (asistioMiercoles ? 1 : 0);
        
        let color = 'rojo';
        if (entrenamientos === 1) color = 'amarillo';
        if (entrenamientos === 2) color = 'verde';
        
        const div = document.createElement('div');
        div.className = `jugadora-disponible ${color}`;
        div.dataset.id = jugadora.id;
        div.onclick = () => this.seleccionarJugadora(jugadora.id);
        div.innerHTML = `
            <span class="jugadora-info">#${jugadora.dorsal} ${jugadora.nombre}</span>
        `;
        
        container.appendChild(div);
    }

    añadirSustitucion(set) {
        console.log('🔄 Añadiendo sustitución para set', set);
        console.log('🎯 Total jugadoras en sistema:', this.jugadoras.length);
        console.log('⚡ Asistencia sábado:', this.jornadaActual.asistenciaSabado);
        
        // Obtener jugadoras del set correspondiente (filtrar null)
        const jugadorasSetOriginales = (set === 1 ? this.planificacionSets.set1 : (set === 2 ? this.planificacionSets.set2 : this.planificacionSets.set3)).filter(j => j !== null && j !== undefined);
        console.log('🏐 Jugadoras originales del set:', jugadorasSetOriginales.length);
        
        // Obtener sustituciones ya realizadas en este set
        const sustitucionesExistentes = this.obtenerSustituciones(set);
        const jugadorasQueSalieron = sustitucionesExistentes.map(s => s.saleId);
        
        // Filtrar jugadoras que aún están en el campo (no han sido sustituidas)
        const jugadorasEnCampo = jugadorasSetOriginales.filter(j => 
            j && j.id && !jugadorasQueSalieron.includes(j.id)
        );
        console.log('👥 Jugadoras en campo:', jugadorasEnCampo.length);
        
        // Obtener jugadoras disponibles (las que NO están en este set específico)
        const todasLasJugadoras = this.jornadaActual.asistenciaSabado.map(id => 
            this.jugadoras.find(j => j.id === id)
        ).filter(j => j && j.nombre && j.dorsal !== undefined); // Filtrar undefined y datos incompletos
        
        console.log('✅ Jugadoras válidas disponibles:', todasLasJugadoras.length);
        
        const jugadorasDisponibles = todasLasJugadoras.filter(j => 
            !jugadorasSetOriginales.find(js => js && js.id === j.id)
        );
        
        console.log('🎪 Jugadoras disponibles para entrar:', jugadorasDisponibles.length);
        
        if (jugadorasEnCampo.length === 0) {
            alert('No hay nadie en el campo para sustituir (todas/os han sido sustituidos)');
            return;
        }
        
        if (jugadorasDisponibles.length === 0) {
            alert('No hay personas disponibles para entrar como suplentes');
            return;
        }
        
        // Crear modal de sustitución
        this.mostrarModalSustitucion(set, jugadorasEnCampo, jugadorasDisponibles);
    }

    mostrarModalSustitucion(set, jugadorasSet, jugadorasDisponibles) {
        console.log('🔄 Abriendo modal de sustitución para set', set);
        console.log('👥 Jugadoras en campo:', jugadorasSet.length);
        console.log('🏃 Jugadoras disponibles:', jugadorasDisponibles.length);
        
        // Usar el modal estático del HTML
        const modal = document.getElementById('modalSustitucion');
        const jugadoraSaleSelect = document.getElementById('jugadoraSale');
        const jugadoraEntraSelect = document.getElementById('jugadoraEntra');
        
        if (!modal || !jugadoraSaleSelect || !jugadoraEntraSelect) {
            console.error('❌ No se encontraron los elementos del modal');
            return;
        }
        
        // Actualizar título del modal
        const titulo = modal.querySelector('h4');
        if (titulo) titulo.textContent = `Sustitución Set ${set}`;
        
        // Limpiar y llenar el select de jugadoras que salen (en campo)
        jugadoraSaleSelect.innerHTML = '<option value="">Seleccionar...</option>';
        jugadorasSet.forEach(j => {
            // Validar que la jugadora tenga datos completos
            if (!j || !j.nombre || j.dorsal === undefined) {
                console.warn('⚠️ Jugadora con datos incompletos:', j);
                return;
            }
            
            const option = document.createElement('option');
            option.value = j.id;
            option.textContent = `#${j.dorsal} ${j.nombre}`;
            jugadoraSaleSelect.appendChild(option);
        });
        
        // Limpiar y llenar el select de jugadoras que entran (disponibles)
        jugadoraEntraSelect.innerHTML = '<option value="">Seleccionar...</option>';
        jugadorasDisponibles.forEach(j => {
            // Validar que la jugadora tenga datos completos
            if (!j || !j.nombre || j.dorsal === undefined) {
                console.warn('⚠️ Jugadora disponible con datos incompletos:', j);
                return;
            }
            
            // Determinar en qué sets ya ha jugado
            const enSet1 = this.planificacionSets.set1.find(js => js && js.id === j.id);
            const enSet2 = this.planificacionSets.set2.find(js => js && js.id === j.id);
            const enSet3 = this.planificacionSets.set3.find(js => js && js.id === j.id);
            const esSuplente1 = this.verificarSiEsSuplente(j.id, 1);
            const esSuplente2 = this.verificarSiEsSuplente(j.id, 2);
            const esSuplente3 = this.verificarSiEsSuplente(j.id, 3);
            
            // Contar en cuántos sets está
            const setsConJugadora = [];
            if (enSet1 || esSuplente1) setsConJugadora.push('1');
            if (enSet2 || esSuplente2) setsConJugadora.push('2');
            if (enSet3 || esSuplente3) setsConJugadora.push('3');
            
            let estado = '';
            let color = '#dc3545'; // Rojo por defecto (no ha jugado)
            
            if (setsConJugadora.length === 0) {
                estado = ' (No ha jugado)';
                color = '#dc3545';
            } else if (setsConJugadora.length === 1) {
                estado = ` (Ya en Set ${setsConJugadora[0]})`;
                color = '#28a745';
            } else if (setsConJugadora.length === 2) {
                estado = ` (Ya en Set ${setsConJugadora.join(' y ')})`;
                color = '#28a745';
            } else {
                estado = ' (Ya en Set 1, 2 y 3)';
                color = '#28a745';
            }
            
            const option = document.createElement('option');
            option.value = j.id;
            option.textContent = `#${j.dorsal} ${j.nombre}${estado}`;
            option.style.color = color;
            jugadoraEntraSelect.appendChild(option);
        });
        
        // Configurar el botón de confirmar para este set específico
        const btnConfirmar = document.getElementById('confirmarSustitucion');
        if (btnConfirmar) {
            btnConfirmar.onclick = () => this.confirmarSustitucion(set);
        }
        
        // Configurar el botón de cancelar
        const btnCancelar = document.getElementById('cancelarSustitucion');
        if (btnCancelar) {
            btnCancelar.onclick = () => this.cerrarModalSustitucion();
        }
        
        // Establecer valor por defecto en el punto de cambio
        const puntoCambio = document.getElementById('puntoCambio');
        if (puntoCambio) {
            puntoCambio.value = "12'5"; // Valor por defecto
        }
        
        // Mostrar el modal
        modal.style.display = 'block';
        
        console.log('✅ Modal de sustitución configurado y mostrado');
    }
    
    cerrarModalSustitucion() {
        const modal = document.getElementById('modalSustitucion');
        if (modal) {
            modal.style.display = 'none';
            
            // Limpiar los selects
            const jugadoraSale = document.getElementById('jugadoraSale');
            const jugadoraEntra = document.getElementById('jugadoraEntra');
            const puntoCambio = document.getElementById('puntoCambio');
            
            if (jugadoraSale) jugadoraSale.value = '';
            if (jugadoraEntra) jugadoraEntra.value = '';
            if (puntoCambio) puntoCambio.value = '';
        }
    }

    confirmarSustitucion(set) {
        console.log('🔄 Confirmando sustitución para set', set);
        
        const saleId = document.getElementById('jugadoraSale').value;
        const entraId = document.getElementById('jugadoraEntra').value;
        const punto = document.getElementById('puntoCambio').value; // Corregido: era puntoSustitucion
        
        console.log('📋 Datos:', { saleId, entraId, punto });
        
        if (!saleId || saleId === '') {
            alert('Selecciona una jugadora que sale');
            return;
        }
        
        if (!entraId || entraId === '') {
            alert('Selecciona una jugadora que entra');
            return;
        }
        
        if (!punto || punto === '') {
            alert('Especifica el punto del cambio');
            return;
        }
        
        const jugadoraSale = this.jugadoras.find(j => j.id === parseInt(saleId));
        const jugadoraEntra = this.jugadoras.find(j => j.id === parseInt(entraId));
        
        if (!jugadoraSale || !jugadoraEntra) {
            alert('Error: No se encontraron las jugadoras seleccionadas');
            return;
        }
        
        // VALIDACIÓN CRÍTICA: Verificar que ambas jugadoras están en el sábado
        const saleEstaEnSabado = this.jornadaActual.asistenciaSabado.includes(parseInt(saleId));
        const entraEstaEnSabado = this.jornadaActual.asistenciaSabado.includes(parseInt(entraId));
        
        if (!saleEstaEnSabado) {
            alert(`Error: ${jugadoraSale.nombre} ya no está seleccionada para el sábado. No se puede crear la sustitución.`);
            return;
        }
        
        if (!entraEstaEnSabado) {
            alert(`Error: ${jugadoraEntra.nombre} ya no está seleccionada para el sábado. No se puede crear la sustitución.`);
            return;
        }
        
        // Crear texto de sustitución
        const textoSustitucion = `${jugadoraEntra.nombre} entra por ${jugadoraSale.nombre} en el punto ${punto}`;
        
        console.log('✅ Sustitución:', textoSustitucion);
        
        // Añadir a la lista de suplentes del set
        const containerId = `suplentesSet${set}`;
        const container = document.getElementById(containerId);
        if (container) {
            const div = document.createElement('div');
            div.className = 'sustitucion-item';
            div.innerHTML = `
                <span>${textoSustitucion}</span>
                <button onclick="app.eliminarSustitucion(this, ${set})" class="btn-eliminar-sustitucion">×</button>
            `;
            container.appendChild(div);
            console.log('📝 Sustitución añadida al contenedor', containerId);
        } else {
            console.error('❌ No se encontró el contenedor', containerId);
        }
        
        // Guardar en planificación
        if (!this.planificacionSets[`set${set}`]) {
            this.planificacionSets[`set${set}`] = [];
        }
        
        const sustitucion = {
            saleId: parseInt(saleId),
            entraId: parseInt(entraId),
            punto: punto,
            texto: textoSustitucion
        };
        
        this.planificacionSets[`set${set}`].push(sustitucion);
        
        // Cerrar modal usando la función específica
        this.cerrarModalSustitucion();
        
        // Actualizar vista de jugadoras disponibles para mostrar etiquetas
        this.actualizarJugadorasDisponibles();
        
        // Auto-guardar cambios en modo edición
        if (this.jornadaActual && this.jornadaActual.id) {
            this.autoGuardarCambiosSets();
        }
        
        console.log('✅ Sustitución confirmada y guardada');
    }

    eliminarSustitucion(botonElement, set) {
        // Remover el elemento de sustitución
        botonElement.parentElement.remove();
        
        // Pequeña pausa para asegurar que el DOM se actualice
        setTimeout(() => {
            // Actualizar las jugadoras disponibles para quitar etiquetas
            this.actualizarJugadorasDisponibles();
        }, 50);
    }

    generarRotacionAutomatica(jugadorasPartido) {
        // Calcular prioridades basadas en estadísticas
        const jugadorasConPrioridad = jugadorasPartido.map(j => ({
            ...j,
            prioridad: this.calcularPrioridad(j),
            minutosJugados: j.puntosJugados || 0
        })).sort((a, b) => a.prioridad - b.prioridad);
        
        // Generar rotación inteligente para maximizar equidad
        const rotacion = this.crearRotacionEquitativa(jugadorasConPrioridad);
        
        // Guardar rotación generada
        this.rotacionGenerada = rotacion;
    }

    calcularPrioridad(jugadora) {
        const puntos = jugadora.puntosJugados || 0;
        const partidos = jugadora.partidosJugados || 0;
        const entrenamientos = jugadora.entrenamientosAsistidos || 0;
        
        // Calcular score base - menor score = mayor prioridad para jugar
        let prioridad = 0;
        
        // Factor principal: tiempo de juego (puntos y partidos)
        prioridad += puntos * 0.3; // Puntos acumulados
        prioridad += partidos * 15; // Partidos jugados (peso mayor)
        
        // Factor positivo: entrenamientos (quien entrena más, tiene menos prioridad para descansar)
        prioridad += entrenamientos * 3;
        
        // Factor especial: colocadoras tienen prioridad (score menor)
        if (jugadora.posicion === 'colocadora') {
            prioridad -= 20; // Mayor prioridad para colocadoras
        }
        
        // Factor aleatorio pequeño para evitar empates exactos
        prioridad += Math.random() * 0.1;
        
        return prioridad;
    }

    crearRotacionEquitativa(jugadorasConPrioridad) {
        const totalJugadoras = jugadorasConPrioridad.length;
        const sets = Math.min(3, Math.ceil(totalJugadoras / 6)); // Máximo 3 sets
        
        const rotacion = {
            set1: { titulares: [], suplentes: [] },
            set2: { titulares: [], suplentes: [] },
            set3: { titulares: [], suplentes: [] }
        };
        
        // Set 1: Jugadoras con mayor prioridad (menos tiempo jugado)
        rotacion.set1.titulares = jugadorasConPrioridad.slice(0, 6);
        rotacion.set1.suplentes = jugadorasConPrioridad.slice(6);
        
        if (sets >= 2 && totalJugadoras >= 8) {
            // Set 2: Rotar para dar oportunidad a suplentes
            const mitad = Math.ceil(totalJugadoras / 2);
            rotacion.set2.titulares = [
                ...jugadorasConPrioridad.slice(3, 6), // Últimos 3 titulares del set 1
                ...jugadorasConPrioridad.slice(6, 9)  // Primeros 3 suplentes
            ].slice(0, 6);
            rotacion.set2.suplentes = jugadorasConPrioridad.filter(j => 
                !rotacion.set2.titulares.includes(j)
            );
        }
        
        if (sets >= 3 && totalJugadoras >= 10) {
            // Set 3: Equilibrar aún más
            rotacion.set3.titulares = [
                ...jugadorasConPrioridad.slice(0, 3), // Primeros 3 del set 1
                ...jugadorasConPrioridad.slice(7, 10) // Más suplentes
            ].slice(0, 6);
            rotacion.set3.suplentes = jugadorasConPrioridad.filter(j => 
                !rotacion.set3.titulares.includes(j)
            );
        }
        
        return rotacion;
    }

    mostrarPlanificacionGenerada(jugadorasPartido) {
        const container = document.getElementById('configuracionPartido');
        if (!container) return;
        
        const rotacion = this.rotacionGenerada;
        const recomendaciones = this.generarRecomendaciones(jugadorasPartido);
        
        container.innerHTML = `
            <div class="planificacion-header">
                <h4>🎯 Planificación Automática Inteligente</h4>
                <div class="planificacion-controles">
                    <button id="planificarManual" class="btn-planificar-manual">
                        ⚙️ Planificar Manualmente
                    </button>
                    <button id="guardarPlanificacion" class="btn-guardar-planificacion">
                        💾 Guardar Planificación
                    </button>
                </div>
            </div>
            
            <div class="recomendaciones-panel">
                <h5>📊 Análisis y Recomendaciones:</h5>
                <div class="recomendaciones-lista">
                    ${recomendaciones.map(rec => `
                        <div class="recomendacion-item ${rec.tipo}">
                            <span class="recomendacion-icono">${rec.icono}</span>
                            <span class="recomendacion-texto">${rec.texto}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="sets-planificacion">
                ${Object.keys(rotacion).map((setKey, index) => {
                    const setData = rotacion[setKey];
                    if (!setData.titulares.length) return '';
                    
                    return `
                        <div class="set-planificacion">
                            <h5>Set ${index + 1}</h5>
                            <div class="titulares-grid">
                                ${setData.titulares.map((j, pos) => `
                                    <div class="titular-slot occupied ${j.posicion === 'colocadora' ? 'colocadora' : ''}">
                                        <div class="titular-info">
                                            <div class="titular-nombre">
                                                ${j.posicion === 'colocadora' ? '🎯' : (j.posicion === 'central' ? '🛡️' : '🏐')} #${j.dorsal} ${j.nombre}
                                            </div>
                                            <div class="titular-stats">
                                                P: ${j.puntosJugados || 0}
                                            </div>
                                        </div>
                                        <div class="posicion-numero">P${pos + 1}</div>
                                    </div>
                                `).join('')}
                            </div>
                            ${setData.suplentes.length > 0 ? `
                                <div class="suplentes-container">
                                    <strong>Suplentes:</strong>
                                    <div class="suplentes-lista">
                                        ${setData.suplentes.map(j => 
                                            `<span class="suplente-item">${j.nombre} #${j.dorsal}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // Configurar event listeners dinámicos
        this.configurarEventListenersDinamicos();
    }

    generarRecomendaciones(jugadorasPartido) {
        const recomendaciones = [];
        
        if (jugadorasPartido.length === 0) {
            recomendaciones.push({
                tipo: 'advertencia',
                icono: '⚠️',
                texto: 'No hay nadie seleccionado para el partido'
            });
            return recomendaciones;
        }
        
        // Calcular estadísticas del grupo
        const totalPuntos = jugadorasPartido.reduce((sum, j) => sum + (j.puntosJugados || 0), 0);
        const promedioPuntos = totalPuntos / jugadorasPartido.length;
        const totalPartidos = jugadorasPartido.reduce((sum, j) => sum + (j.partidosJugados || 0), 0);
        const promedioPartidos = totalPartidos / jugadorasPartido.length;
        
        // Identificar jugadoras con poco tiempo de juego (prioritarias)
        const jugadorasPocoTiempo = jugadorasPartido.filter(j => {
            const puntos = j.puntosJugados || 0;
            const partidos = j.partidosJugados || 0;
            return puntos < promedioPuntos * 0.6 || partidos < promedioPartidos * 0.6;
        }).sort((a, b) => (a.puntosJugados || 0) - (b.puntosJugados || 0));
        
        // Identificar jugadoras con mucho tiempo de juego (rotar más)
        const jugadorasMuchoTiempo = jugadorasPartido.filter(j => {
            const puntos = j.puntosJugados || 0;
            const partidos = j.partidosJugados || 0;
            return puntos > promedioPuntos * 1.4 || partidos > promedioPartidos * 1.4;
        }).sort((a, b) => (b.puntosJugados || 0) - (a.puntosJugados || 0));
        
        // Recomendaciones específicas
        if (jugadorasPocoTiempo.length > 0) {
            recomendaciones.push({
                tipo: 'prioridad',
                icono: '🎯',
                texto: `PRIORIDAD - Dar más tiempo a: ${jugadorasPocoTiempo.slice(0, 3).map(j => 
                    `${j.nombre} (${j.puntosJugados || 0}pts)`
                ).join(', ')}`
            });
        }
        
        if (jugadorasMuchoTiempo.length > 0) {
            recomendaciones.push({
                tipo: 'rotacion',
                icono: '🔄',
                texto: `ROTAR - Descansar más a: ${jugadorasMuchoTiempo.slice(0, 2).map(j => 
                    `${j.nombre} (${j.puntosJugados || 0}pts)`
                ).join(', ')}`
            });
        }
        
        // Analizar colocadoras
        const colocadoras = jugadorasPartido.filter(j => j.posicion === 'colocadora');
        if (colocadoras.length === 0) {
            recomendaciones.push({
                tipo: 'advertencia',
                icono: '⚠️',
                texto: 'No hay colocadoras disponibles - asignar colocadora temporal'
            });
        } else if (colocadoras.length === 1) {
            recomendaciones.push({
                tipo: 'info',
                icono: '🎯',
                texto: `${colocadoras[0].nombre} será la colocadora principal (${colocadoras[0].puntosJugados || 0}pts)`
            });
        } else {
            recomendaciones.push({
                tipo: 'info',
                icono: '🎯',
                texto: `Colocadoras disponibles: ${colocadoras.map(j => j.nombre).join(', ')} - Rotar según cansancio`
            });
        }
        
        // Análisis del equilibrio del equipo
        const diferenciaPuntos = Math.max(...jugadorasPartido.map(j => j.puntosJugados || 0)) - 
                                Math.min(...jugadorasPartido.map(j => j.puntosJugados || 0));
        
        if (diferenciaPuntos > 100) {
            recomendaciones.push({
                tipo: 'advertencia',
                icono: '⚖️',
                texto: `Gran diferencia en tiempo de juego (${diferenciaPuntos}pts) - Equilibrar rotaciones`
            });
        } else if (diferenciaPuntos < 30) {
            recomendaciones.push({
                tipo: 'info',
                icono: '✅',
                texto: 'Tiempo de juego bien equilibrado entre jugadoras'
            });
        }
        
        // Verificar número de jugadoras
        if (jugadorasPartido.length < 7) {
            recomendaciones.push({
                tipo: 'advertencia',
                icono: '👥',
                texto: `Solo ${jugadorasPartido.length} jugadoras - Rotaciones muy limitadas`
            });
        } else if (jugadorasPartido.length >= 10) {
            recomendaciones.push({
                tipo: 'info',
                icono: '✨',
                texto: `${jugadorasPartido.length} jugadoras disponibles - Rotaciones flexibles posibles`
            });
        }
        
        // Mostrar el análisis detallado
        recomendaciones.push({
            tipo: 'info',
            icono: '📊',
            texto: `Promedio de puntos del grupo: ${Math.round(promedioPuntos)} | Diferencia máx: ${diferenciaPuntos}pts`
        });
        
        return recomendaciones;
    }

    abrirPlanificadorManual() {
        const modal = document.createElement('div');
        modal.className = 'modal-planificador';
        modal.innerHTML = `
            <div class="modal-content-planificador">
                <div class="modal-header">
                    <h3>⚙️ Planificador Manual de Sets</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                
                <div class="planificador-content">
                    <div class="jugadoras-disponibles">
                        <h4>👥 Jugadoras Disponibles</h4>
                        <div id="jugadorasDisponibles" class="jugadoras-pool">
                            ${this.jornadaActual.asistenciaSabado.map(id => {
                                const j = this.jugadoras.find(jug => jug.id === id);
                                return `
                                    <div class="jugadora-draggable" data-id="${j.id}" draggable="true">
                                        <div class="jugadora-nombre">
                                            ${j.posicion === 'colocadora' ? '🎯' : (j.posicion === 'central' ? '🛡️' : '🏐')} <span style="font-weight:bold">#${j.dorsal} ${j.nombre}</span>
                                        </div>
                                        <div class="jugadora-stats-mini">
                                            P: ${j.puntosJugados || 0}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="sets-manual">
                        ${[1, 2, 3].map(setNum => `
                            <div class="set-manual">
                                <h4>Set ${setNum}</h4>
                                <div class="drop-zone titulares-zone" data-set="${setNum}" data-tipo="titulares">
                                    <div class="zone-header">Titulares (0/6)</div>
                                    <div class="zone-content"></div>
                                </div>
                                <div class="drop-zone suplentes-zone" data-set="${setNum}" data-tipo="suplentes">
                                    <div class="zone-header">Suplentes</div>
                                    <div class="zone-content"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button id="resetearPlanificacion" class="btn-reset">🔄 Resetear</button>
                    <button id="aplicarPlanificacion" class="btn-aplicar">✅ Aplicar Planificación</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.configurarPlanificadorManual();
    }

    configurarPlanificadorManual() {
        // Configurar drag and drop
        const jugadoras = document.querySelectorAll('.jugadora-draggable');
        const dropZones = document.querySelectorAll('.drop-zone');
        
        jugadoras.forEach(j => {
            j.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', j.dataset.id);
                j.classList.add('dragging');
            });
            
            j.addEventListener('dragend', () => {
                j.classList.remove('dragging');
            });
        });
        
        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });
            
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });
            
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                
                const jugadoraId = e.dataTransfer.getData('text/plain');
                const jugadoraElement = document.querySelector(`[data-id="${jugadoraId}"]`);
                const setNum = zone.dataset.set;
                const tipo = zone.dataset.tipo;
                
                this.moverJugadoraManual(jugadoraElement, zone, setNum, tipo);
            });
        });
        
        // Event listeners para botones del modal
        setTimeout(() => {
            document.getElementById('resetearPlanificacion')?.addEventListener('click', () => this.resetearPlanificacionManual());
            document.getElementById('aplicarPlanificacion')?.addEventListener('click', () => this.aplicarPlanificacionManual());
        }, 100);
    }

    moverJugadoraManual(jugadoraElement, targetZone, setNum, tipo) {
        // Verificar límites
        if (tipo === 'titulares') {
            const currentTitulares = targetZone.querySelectorAll('.jugadora-draggable').length;
            if (currentTitulares >= 6) {
                alert('Máximo 6 titulares por set');
                return;
            }
        }
        
        // Mover elemento
        targetZone.querySelector('.zone-content').appendChild(jugadoraElement);
        
        // Actualizar contador si es zona de titulares
        if (tipo === 'titulares') {
            const newCount = targetZone.querySelectorAll('.jugadora-draggable').length;
            targetZone.querySelector('.zone-header').textContent = `Titulares (${newCount}/6)`;
        }
        
        this.actualizarContadoresPlanificacion();
    }

    actualizarContadoresPlanificacion() {
        document.querySelectorAll('.titulares-zone').forEach(zone => {
            const count = zone.querySelectorAll('.jugadora-draggable').length;
            zone.querySelector('.zone-header').textContent = `Titulares (${count}/6)`;
        });
    }

    resetearPlanificacionManual() {
        // Mover todas las jugadoras de vuelta al pool
        const pool = document.getElementById('jugadorasDisponibles');
        document.querySelectorAll('.drop-zone .jugadora-draggable').forEach(j => {
            pool.appendChild(j);
        });
        
        this.actualizarContadoresPlanificacion();
    }

    aplicarPlanificacionManual() {
        const planificacionManual = {
            set1: { titulares: [], suplentes: [] },
            set2: { titulares: [], suplentes: [] },
            set3: { titulares: [], suplentes: [] }
        };
        
        // Recopilar planificación de cada set
        [1, 2, 3].forEach(setNum => {
            const titularesZone = document.querySelector(`[data-set="${setNum}"][data-tipo="titulares"]`);
            const suplentesZone = document.querySelector(`[data-set="${setNum}"][data-tipo="suplentes"]`);
            
            const titulares = Array.from(titularesZone.querySelectorAll('.jugadora-draggable')).map(j => {
                const id = parseInt(j.dataset.id);
                return this.jugadoras.find(jug => jug.id === id);
            });
            
            const suplentes = Array.from(suplentesZone.querySelectorAll('.jugadora-draggable')).map(j => {
                const id = parseInt(j.dataset.id);
                return this.jugadoras.find(jug => jug.id === id);
            });
            
            planificacionManual[`set${setNum}`] = { titulares, suplentes };
        });
        
        // Guardar planificación
        this.jornadaActual.planificacionManual = planificacionManual;
        this.planificacionGuardada = planificacionManual;
        this.guardarJornadas();
        
        // Cerrar modal y actualizar vista
        document.querySelector('.modal-planificador').remove();
        this.mostrarPlanificacionGuardada();
        
        alert('✅ Planificación manual guardada correctamente');
    }

    mostrarPlanificacionGuardada() {
        const container = document.getElementById('configuracionPartido');
        if (!container) return;
        
        const planificacion = this.jornadaActual.planificacionManual || this.planificacionGuardada;
        
        container.innerHTML = `
            <div class="planificacion-header saved">
                <h4>💾 Planificación Guardada</h4>
                <div class="planificacion-controles">
                    <button id="editarPlanificacion" class="btn-editar-planificacion">
                        ✏️ Editar Planificación
                    </button>
                    <button id="limpiarPlanificacion" class="btn-limpiar-planificacion">
                        🗑️ Limpiar
                    </button>
                </div>
            </div>
            
            <div class="sets-planificacion guardada">
                ${Object.keys(planificacion).map((setKey, index) => {
                    const setData = planificacion[setKey];
                    if (!setData.titulares.length) return '';
                    
                    return `
                        <div class="set-planificacion saved">
                            <h5>Set ${index + 1}</h5>
                            <div class="titulares-grid">
                                ${setData.titulares.map((j, pos) => `
                                    <div class="titular-slot occupied saved ${j.posicion === 'colocadora' ? 'colocadora' : ''}">
                                        <div class="titular-info">
                                            <div class="titular-nombre">
                                                ${j.posicion === 'colocadora' ? '🎯' : (j.posicion === 'central' ? '🛡️' : '🏐')} #${j.dorsal} ${j.nombre}
                                            </div>
                                            <div class="titular-stats">
                                                P: ${j.puntosJugados || 0}
                                            </div>
                                        </div>
                                        <div class="posicion-numero">P${pos + 1}</div>
                                    </div>
                                `).join('')}
                            </div>
                            ${setData.suplentes.length > 0 ? `
                                <div class="suplentes-container">
                                    <strong>Suplentes:</strong>
                                    <div class="suplentes-lista">
                                        ${setData.suplentes.map(j => 
                                            `<span class="suplente-item saved">${j.nombre} #${j.dorsal}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // Configurar event listeners dinámicos
        this.configurarEventListenersDinamicos();
    }

    guardarPlanificacionActual() {
        if (this.rotacionGenerada) {
            this.jornadaActual.planificacionManual = this.rotacionGenerada;
            this.planificacionGuardada = this.rotacionGenerada;
            this.guardarJornadas();
            
            this.mostrarPlanificacionGuardada();
            alert('✅ Planificación automática guardada');
        }
    }

    limpiarPlanificacion() {
        if (confirm('¿Limpiar la planificación guardada?')) {
            this.jornadaActual.planificacionManual = null;
            this.planificacionGuardada = null;
            this.guardarJornadas();
            this.generarPlanificacionPartido();
            alert('Planificación limpiada');
        }
    }

    guardarBorrador() {
        if (!this.jornadaActual) return;
        
        // Guardar la planificación actual y sustituciones como borrador (filtrar null)
        this.jornadaActual.sets = {
            set1: this.planificacionSets.set1.filter(j => j !== null && j !== undefined),
            set2: this.planificacionSets.set2.filter(j => j !== null && j !== undefined),
            set3: this.planificacionSets.set3.filter(j => j !== null && j !== undefined)
        };
        
        // Guardar sustituciones temporales
        this.jornadaActual.sustituciones = {
            set1: this.obtenerSustituciones(1),
            set2: this.obtenerSustituciones(2),
            set3: this.obtenerSustituciones(3)
        };
        
        // NO marcar como completada - mantener como borrador
        this.jornadaActual.completada = false;
        
        // Guardar los cambios
        this.guardarJornadas();
        
        alert('Borrador guardado. Puedes continuar editándolo más tarde desde el historial.');
        
        // Volver al inicio pero mantener en jornadas
        this.volverAInicioJornada();
    }

    completarJornada() {
        if (!this.jornadaActual) return;
        
        // IMPORTANTE: Sincronizar referencias antes de validar y completar
        this.sincronizarReferenciasJugadoras(this.jornadaActual);
        
        if (this.jornadaActual.asistenciaSabado.length < 6) {
            alert('Se necesitan al menos 6 jugador/as para completar la jornada');
            return;
        }
        
        // VALIDACIÓN 1: Verificar que Set 1 y Set 2 tengan 6 jugadoras en las POSICIONES
        // Solo contar las primeras 6 posiciones (índices 0-5), ignorando extras
        const set1Validas = this.planificacionSets.set1.slice(0, 6).filter(j => j !== null && j !== undefined);
        const set2Validas = this.planificacionSets.set2.slice(0, 6).filter(j => j !== null && j !== undefined);
        const set3Validas = this.planificacionSets.set3.slice(0, 6).filter(j => j !== null && j !== undefined);
        
        if (set1Validas.length !== 6) {
            alert('⚠️ El Set 1 debe tener exactamente 6 jugador/as en las posiciones.\n\nActualmente tiene: ' + set1Validas.length + ' jugador/as.');
            return;
        }
        
        if (set2Validas.length !== 6) {
            alert('⚠️ El Set 2 debe tener exactamente 6 jugador/as en las posiciones.\n\nActualmente tiene: ' + set2Validas.length + ' jugador/as.');
            return;
        }
        
        // VALIDACIÓN 2: Si Set 3 tiene jugadoras, debe tener exactamente 6 en las posiciones
        if (set3Validas.length > 0 && set3Validas.length !== 6) {
            alert('⚠️ El Set 3 está incompleto.\n\nTiene ' + set3Validas.length + ' jugador/as en las posiciones pero debe tener 6 o estar vacío.\n\nCompleta las 6 posiciones o elimina todas las jugador/as del Set 3.');
            return;
        }
        
        // Verificar que todas las jugadoras disponibles estén en algún set
        const jugadorasDisponibles = this.jornadaActual.asistenciaSabado;
        
        // Obtener jugadoras en planificación original (filtrar null)
        const jugadorasEnSets = [...new Set([
            ...this.planificacionSets.set1.filter(j => j !== null && j !== undefined).map(j => j.id),
            ...this.planificacionSets.set2.filter(j => j !== null && j !== undefined).map(j => j.id),
            ...this.planificacionSets.set3.filter(j => j !== null && j !== undefined).map(j => j.id)
        ])];
        
        // Obtener jugadoras que entran como sustitutas
        const sustitucionesSet1 = this.obtenerSustituciones(1);
        const sustitucionesSet2 = this.obtenerSustituciones(2);
        const sustitucionesSet3 = this.obtenerSustituciones(3);
        const jugadorasSustitutas = [...new Set([
            ...sustitucionesSet1.map(s => s.entraId),
            ...sustitucionesSet2.map(s => s.entraId),
            ...sustitucionesSet3.map(s => s.entraId)
        ])];
        
        // Combinar jugadoras en sets y sustitutas
        const todasLasJugadorasAsignadas = [...new Set([...jugadorasEnSets, ...jugadorasSustitutas])];
        
        const jugadorasSinAsignar = jugadorasDisponibles.filter(id => !todasLasJugadorasAsignadas.includes(id));
        
        console.log('📊 Validación de asignación:');
        console.log('- Jugadoras disponibles:', jugadorasDisponibles.length);
        console.log('- Jugadoras en sets originales:', jugadorasEnSets.length);
        console.log('- Jugadoras sustitutas:', jugadorasSustitutas.length);
        console.log('- Total jugadoras asignadas:', todasLasJugadorasAsignadas.length);
        console.log('- Jugadoras sin asignar:', jugadorasSinAsignar.length);
        
        if (jugadorasSinAsignar.length > 0) {
            const nombresNoAsignadas = jugadorasSinAsignar
                .map(id => {
                    const jugadora = this.jugadoras.find(j => j.id === id);
                    return jugadora ? jugadora.nombre : null;
                })
                .filter(nombre => nombre !== null) // Eliminar jugadoras que ya no existen
                .join(', ');
            
            // Si después de filtrar no hay nombres, significa que las jugadoras sin asignar ya no existen
            if (!nombresNoAsignadas) {
                console.log('✅ Las jugadoras sin asignar ya no existen en el equipo, continuando...');
            } else {
                console.log('🚫 Jugadoras sin asignar encontradas:', nombresNoAsignadas);
                alert(`⚠️ No puedes completar la jornada. Las siguientes jugadoras disponibles no están asignadas a ningún set:\n\n${nombresNoAsignadas}\n\nAsegúrate de que todas las jugadoras disponibles estén en al menos un set antes de completar.`);
                return false;
            }
        }
        
        // Guardar planificación manual y sustituciones si existen
        if (this.planificacionSets && (this.planificacionSets.set1.length > 0 || this.planificacionSets.set2.length > 0 || this.planificacionSets.set3.length > 0)) {
            // Filtrar null, undefined y jugadoras sin datos válidos antes de guardar
            const limpiarSet = (set) => {
                return set
                    .filter(j => j !== null && j !== undefined)
                    .filter(j => j.id && j.nombre) // Solo jugadoras con ID y nombre válidos
                    .map(j => {
                        // Sincronizar con datos actuales de la jugadora
                        const jugadoraActual = this.jugadoras.find(jug => jug.id === j.id);
                        return jugadoraActual ? { ...jugadoraActual } : j;
                    });
            };
            
            this.jornadaActual.planificacionManual = {
                set1: limpiarSet(this.planificacionSets.set1),
                set2: limpiarSet(this.planificacionSets.set2),
                set3: limpiarSet(this.planificacionSets.set3)
            };
            
            // Guardar sustituciones
            this.jornadaActual.sustituciones = {
                set1: this.obtenerSustituciones(1),
                set2: this.obtenerSustituciones(2),
                set3: this.obtenerSustituciones(3)
            };
        }
        
        // Marcar como completada
        this.jornadaActual.completada = true;
        
        // Actualizar estadísticas de jugadoras
        this.actualizarEstadisticasJornada();
        
        // Guardar
        this.guardarJornadas();
        this.guardarJugadoras();
        
        // Volver al inicio y cambiar a pestaña historial
        this.volverAInicioJornada();
        this.cambiarTab('historial');
    }

    // ==================== RECÁLCULO COMPLETO DE ESTADÍSTICAS ====================
    recalcularTodasLasEstadisticas() {
        console.log('🔄 === RECALCULANDO TODAS LAS ESTADÍSTICAS ===');
        
        // Resetear todas las estadísticas de las jugadoras
        this.jugadoras.forEach(jugadora => {
            jugadora.puntosJugados = 0;
            jugadora.partidosJugados = 0;
            jugadora.entrenamientosAsistidos = 0;
        });
        
        // Procesar cada jornada completada
        this.jornadas.filter(j => j.completada).forEach(jornada => {
            console.log(`📊 Procesando jornada ${jornada.id} (${jornada.fechaLunes})`);
            
            // Actualizar entrenamientos
            jornada.asistenciaLunes?.forEach(jugadoraId => {
                const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
                if (jugadora) {
                    jugadora.entrenamientosAsistidos = (jugadora.entrenamientosAsistidos || 0) + 1;
                }
            });
            
            jornada.asistenciaMiercoles?.forEach(jugadoraId => {
                const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
                if (jugadora) {
                    jugadora.entrenamientosAsistidos = (jugadora.entrenamientosAsistidos || 0) + 1;
                }
            });
            
            // Calcular puntos del partido
            this.recalcularPuntosJornada(jornada);
        });
        
        console.log('✅ Recálculo completo finalizado');
    }
    
    recalcularPuntosJornada(jornada) {
        console.log(`🎯 Recalculando puntos para jornada ${jornada.id}`);
        
        if (!jornada.asistenciaSabado || jornada.asistenciaSabado.length === 0) {
            console.log('No hay jugadoras en sábado para esta jornada');
            return;
        }
        
        // Inicializar puntos temporales para esta jornada
        const puntosJornada = {};
        jornada.asistenciaSabado.forEach(jugadoraId => {
            puntosJornada[jugadoraId] = 0;
        });
        
        // Obtener planificación y sustituciones de la jornada
        const planificacionSet1 = jornada.planificacionManual?.set1 || [];
        const planificacionSet2 = jornada.planificacionManual?.set2 || [];
        const sustitucionesSet1 = jornada.sustituciones?.set1 || [];
        const sustitucionesSet2 = jornada.sustituciones?.set2 || [];
        
        console.log(`Set 1: ${planificacionSet1.length} jugadoras, ${sustitucionesSet1.length} sustituciones`);
        console.log(`Set 2: ${planificacionSet2.length} jugadoras, ${sustitucionesSet2.length} sustituciones`);
        
        // Calcular puntos Set 1
        planificacionSet1.forEach(jugadora => {
            const sustitucion = sustitucionesSet1.find(s => s.saleId === jugadora.id);
            let puntosSet = 25;
            
            if (sustitucion) {
                puntosSet = this.calcularPuntosPorSustitucion(sustitucion.punto);
            }
            
            puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosSet;
        });
        
        // Calcular puntos Set 2
        planificacionSet2.forEach(jugadora => {
            const sustitucion = sustitucionesSet2.find(s => s.saleId === jugadora.id);
            let puntosSet = 25;
            
            if (sustitucion) {
                puntosSet = this.calcularPuntosPorSustitucion(sustitucion.punto);
            }
            
            puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosSet;
        });
        
        // Calcular puntos de suplentes
        sustitucionesSet1.forEach(sustitucion => {
            const puntosJugados = 25 - this.calcularPuntosPorSustitucion(sustitucion.punto);
            puntosJornada[sustitucion.entraId] = (puntosJornada[sustitucion.entraId] || 0) + puntosJugados;
        });
        
        sustitucionesSet2.forEach(sustitucion => {
            const puntosJugados = 25 - this.calcularPuntosPorSustitucion(sustitucion.punto);
            puntosJornada[sustitucion.entraId] = (puntosJornada[sustitucion.entraId] || 0) + puntosJugados;
        });
        
        // Aplicar puntos a las jugadoras
        Object.keys(puntosJornada).forEach(jugadoraId => {
            const jugadora = this.jugadoras.find(j => j.id == jugadoraId);
            if (jugadora && puntosJornada[jugadoraId] > 0) {
                jugadora.puntosJugados = (jugadora.puntosJugados || 0) + puntosJornada[jugadoraId];
                jugadora.partidosJugados = (jugadora.partidosJugados || 0) + 1;
                console.log(`${jugadora.nombre}: +${puntosJornada[jugadoraId]} puntos`);
            }
        });
    }
    
    ejecutarRecalculoCompleto() {
        if (!confirm('¿Estás seguro de que quieres recalcular todas las estadísticas?\n\nEsto afectará a todas las jugadoras y jornadas completadas. La operación no se puede deshacer.')) {
            return;
        }
        
        console.log('👤 Iniciando recálculo completo por solicitud del usuario');
        
        // Mostrar mensaje de progreso
        this.mostrarMensaje('🔄 Recalculando todas las estadísticas...', 'info');
        
        // Ejecutar recálculo
        this.recalcularTodasLasEstadisticas();
        
        // Guardar cambios
        this.guardarJugadoras();
        
        // Actualizar vistas
        this.cargarJugadoras();
        this.cargarHistorial();
        
        // Mensaje de confirmación
        this.mostrarMensaje('✅ Estadísticas recalculadas correctamente', 'success');
        
        console.log('✅ Recálculo completo finalizado por el usuario');
    }

    actualizarEstadisticasJornada() {
        console.log('🎯 === ACTUALIZANDO ESTADÍSTICAS DE JORNADA ===');
        if (!this.jornadaActual) {
            console.log('❌ No hay jornada actual');
            return;
        }
        
        console.log('🏐 Jornada actual:', this.jornadaActual.id);
        console.log('🏐 Jugadoras en sábado:', this.jornadaActual.asistenciaSabado.length);
        
        // Actualizar entrenamientos - 1 por cada asistencia
        this.jornadaActual.asistenciaLunes.forEach(jugadoraId => {
            const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
            if (jugadora) {
                jugadora.entrenamientosAsistidos = (jugadora.entrenamientosAsistidos || 0) + 1;
            }
        });
        
        this.jornadaActual.asistenciaMiercoles.forEach(jugadoraId => {
            const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
            if (jugadora) {
                jugadora.entrenamientosAsistidos = (jugadora.entrenamientosAsistidos || 0) + 1;
            }
        });
        
        // Actualizar partidos - Calcular puntos basado en si jugaron completo o sustitución
        console.log('🎯 Llamando a actualizarPuntosPartido...');
        this.actualizarPuntosPartido();
        console.log('✅ Estadísticas actualizadas');
    }

    actualizarPuntosPartido() {
        console.log('🎯 === CALCULANDO PUNTOS DEL PARTIDO ===');
        
        // Resetear puntos de todas las jugadoras que participaron en esta jornada antes de recalcular
        const jugadorasPartido = this.jornadaActual.asistenciaSabado.map(id => 
            this.jugadoras.find(j => j.id === id)
        ).filter(j => j);
        
        console.log('👥 Jugadoras en el partido:', jugadorasPartido.map(j => j.nombre));
        
        // Inicializar puntos temporales para esta jornada
        const puntosJornada = {};
        jugadorasPartido.forEach(j => {
            puntosJornada[j.id] = 0;
        });
        
        // Usar las sustituciones guardadas en la jornada si existen
        let sustitucionesSet1 = [];
        let sustitucionesSet2 = [];
        let sustitucionesSet3 = [];
        let planificacionSet1 = [];
        let planificacionSet2 = [];
        let planificacionSet3 = [];
        
        if (this.jornadaActual.sustituciones) {
            sustitucionesSet1 = this.jornadaActual.sustituciones.set1 || [];
            sustitucionesSet2 = this.jornadaActual.sustituciones.set2 || [];
            sustitucionesSet3 = this.jornadaActual.sustituciones.set3 || [];
            console.log('📚 Usando sustituciones guardadas de la jornada');
        } else {
            // Si no hay sustituciones guardadas, obtenerlas del DOM (para jornadas en progreso)
            sustitucionesSet1 = this.obtenerSustituciones(1);
            sustitucionesSet2 = this.obtenerSustituciones(2);
            sustitucionesSet3 = this.obtenerSustituciones(3);
            console.log('🔄 Obteniendo sustituciones del DOM');
        }
        
        if (this.jornadaActual.planificacionManual) {
            planificacionSet1 = this.jornadaActual.planificacionManual.set1 || [];
            planificacionSet2 = this.jornadaActual.planificacionManual.set2 || [];
            planificacionSet3 = this.jornadaActual.planificacionManual.set3 || [];
            console.log('📚 Usando planificación guardada de la jornada');
        } else if (this.planificacionSets) {
            planificacionSet1 = this.planificacionSets.set1 || [];
            planificacionSet2 = this.planificacionSets.set2 || [];
            planificacionSet3 = this.planificacionSets.set3 || [];
            console.log('🔄 Usando planificación actual del DOM');
        }
        
        // Filtrar null ANTES de cualquier operación
        planificacionSet1 = planificacionSet1.filter(j => j !== null && j !== undefined && j.id);
        planificacionSet2 = planificacionSet2.filter(j => j !== null && j !== undefined && j.id);
        planificacionSet3 = planificacionSet3.filter(j => j !== null && j !== undefined && j.id);
        
        console.log('🔄 Sustituciones Set 1:', sustitucionesSet1);
        console.log('🔄 Sustituciones Set 2:', sustitucionesSet2);
        console.log('� Sustituciones Set 3:', sustitucionesSet3);
        // Removed problematic console.log
        // Removed problematic console.log
        // Removed problematic console.log
        
        // Verificar si tenemos planificación de sets
        if (planificacionSet1.length === 0 && planificacionSet2.length === 0 && planificacionSet3.length === 0) {
            console.warn('⚠️ No hay planificación de sets disponible');
            return;
        }
        
        // Actualizar jugadoras del Set 1
        planificacionSet1.forEach(jugadora => {
            const sustitucion = sustitucionesSet1.find(s => s.saleId === jugadora.id);
            let puntosSet = 25; // Por defecto jugó todo el set
            
            if (sustitucion) {
                // Calcular puntos basado en cuándo salió
                puntosSet = this.calcularPuntosPorSustitucion(sustitucion.punto);
                console.log(`🔄 ${jugadora.nombre || `ID:${jugadora.id}`} sale en punto ${sustitucion.punto} -> ${puntosSet} puntos`);
            } else {
                console.log(`✅ ${jugadora.nombre || `ID:${jugadora.id}`} jugó set completo -> 25 puntos`);
            }
            
            puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosSet;
        });
        
        // Actualizar jugadoras del Set 2
        planificacionSet2.forEach(jugadora => {
            const sustitucion = sustitucionesSet2.find(s => s.saleId === jugadora.id);
            let puntosSet = 25; // Por defecto jugó todo el set
            
            if (sustitucion) {
                // Calcular puntos basado en cuándo salió
                puntosSet = this.calcularPuntosPorSustitucion(sustitucion.punto);
                console.log(`🔄 SET2: ${jugadora.nombre || `ID:${jugadora.id}`} sale en punto ${sustitucion.punto} -> ${puntosSet} puntos`);
            } else {
                console.log(`✅ SET2: ${jugadora.nombre || `ID:${jugadora.id}`} jugó set completo -> 25 puntos`);
            }
            
            puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosSet;
        });
        
        // Actualizar jugadoras del Set 3 (opcional)
        planificacionSet3.forEach(jugadora => {
            const sustitucion = sustitucionesSet3.find(s => s.saleId === jugadora.id);
            let puntosSet = 25; // Por defecto jugó todo el set
            
            if (sustitucion) {
                // Calcular puntos basado en cuándo salió
                puntosSet = this.calcularPuntosPorSustitucion(sustitucion.punto);
                console.log(`🔄 SET3: ${jugadora.nombre || `ID:${jugadora.id}`} sale en punto ${sustitucion.punto} -> ${puntosSet} puntos`);
            } else {
                console.log(`✅ SET3: ${jugadora.nombre || `ID:${jugadora.id}`} jugó set completo -> 25 puntos`);
            }
            
            puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosSet;
        });
        
        // Actualizar suplentes que entraron
        console.log('🔄 Actualizando puntos de suplentes...');
        this.actualizarPuntosSuplentes(sustitucionesSet1, sustitucionesSet2, sustitucionesSet3, puntosJornada);
        
        console.log('📊 Puntos calculados para esta jornada:', puntosJornada);
        
        // Aplicar los puntos calculados a las jugadoras
        Object.keys(puntosJornada).forEach(jugadoraId => {
            const jugadora = this.jugadoras.find(j => j.id == jugadoraId);
            if (jugadora) {
                // Solo sumar los puntos si la jugadora realmente participó
                if (puntosJornada[jugadoraId] > 0) {
                    const puntosAnteriores = jugadora.puntosJugados || 0;
                    jugadora.puntosJugados = puntosAnteriores + puntosJornada[jugadoraId];
                    jugadora.partidosJugados = (jugadora.partidosJugados || 0) + 1;
                    console.log(`✅ ${jugadora.nombre}: ${puntosAnteriores} + ${puntosJornada[jugadoraId]} = ${jugadora.puntosJugados} puntos totales`);
                }
            }
        });
        
        console.log('🎯 === FIN CÁLCULO PUNTOS ===');
    }

    obtenerSustituciones(set) {
        const container = document.getElementById(`suplentesSet${set}`);
        if (!container) return [];
        
        const sustituciones = [];
        const items = container.querySelectorAll('.sustitucion-item');
        
        items.forEach(item => {
            const texto = item.textContent.replace('×', '').trim();
            // Parsear "Nadia entra por Patricia en el punto 12'5"
            const match = texto.match(/(.+) entra por (.+) en el punto (.+)/);
            if (match) {
                const entraJugadora = this.jugadoras.find(j => j.nombre === match[1].trim());
                const saleJugadora = this.jugadoras.find(j => j.nombre === match[2].trim());
                if (entraJugadora && saleJugadora) {
                    const sustitucion = {
                        entraId: entraJugadora.id,
                        saleId: saleJugadora.id,
                        punto: match[3].trim()
                    };
                    
                    // Validar que los datos están completos antes de añadir
                    if (sustitucion.entraId && sustitucion.saleId && sustitucion.punto) {
                        sustituciones.push(sustitucion);
                    } else {
                        console.warn('⚠️ Sustitución con datos incompletos filtrada:', {
                            texto: texto,
                            entraJugadora: entraJugadora?.nombre || 'No encontrada',
                            saleJugadora: saleJugadora?.nombre || 'No encontrada',
                            sustitucion: sustitucion
                        });
                    }
                } else {
                    console.warn('⚠️ Jugadora(s) no encontrada(s) en sustitución:', { 
                        entra: match[1].trim(), 
                        sale: match[2].trim() 
                    });
                }
            }
        });
        
        return sustituciones;
    }

    calcularPuntosPorSustitucion(puntoSustitucion) {
        // Convertir punto a número (ej: "12'5" -> 12.5)
        const puntoStr = puntoSustitucion.replace("'", ".");
        const punto = parseFloat(puntoStr);
        
        console.log(`🔢 Calculando puntos: "${puntoSustitucion}" -> "${puntoStr}" -> ${punto}`);
        
        // Validar que sea un punto válido
        if (isNaN(punto) || punto < 0 || punto > 25) {
            console.warn(`Punto de sustitución inválido: ${puntoSustitucion}`);
            return 0;
        }
        
        // Retornar el valor exacto, sin redondeo
        return punto;
    }

    actualizarPuntosSuplentes(sustitucionesSet1, sustitucionesSet2, sustitucionesSet3, puntosJornada) {
        console.log('🔄 === CALCULANDO PUNTOS SUPLENTES ===');
        
        // Actualizar suplentes del Set 1
        sustitucionesSet1.forEach(sustitucion => {
            const jugadora = this.jugadoras.find(j => j.id === sustitucion.entraId);
            if (jugadora) {
                const puntosJugados = 25 - this.calcularPuntosPorSustitucion(sustitucion.punto);
                puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosJugados;
                console.log(`🔄 SET1: ${jugadora.nombre} entra en punto ${sustitucion.punto} -> ${puntosJugados} puntos (25 - ${this.calcularPuntosPorSustitucion(sustitucion.punto)})`);
            }
        });
        
        // Actualizar suplentes del Set 2
        sustitucionesSet2.forEach(sustitucion => {
            const jugadora = this.jugadoras.find(j => j.id === sustitucion.entraId);
            if (jugadora) {
                const puntosJugados = 25 - this.calcularPuntosPorSustitucion(sustitucion.punto);
                puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosJugados;
                console.log(`🔄 SET2: ${jugadora.nombre} entra en punto ${sustitucion.punto} -> ${puntosJugados} puntos (25 - ${this.calcularPuntosPorSustitucion(sustitucion.punto)})`);
            }
        });
        
        // Actualizar suplentes del Set 3 (opcional)
        sustitucionesSet3.forEach(sustitucion => {
            const jugadora = this.jugadoras.find(j => j.id === sustitucion.entraId);
            if (jugadora) {
                const puntosJugados = 25 - this.calcularPuntosPorSustitucion(sustitucion.punto);
                puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosJugados;
                console.log(`🔄 SET3: ${jugadora.nombre} entra en punto ${sustitucion.punto} -> ${puntosJugados} puntos (25 - ${this.calcularPuntosPorSustitucion(sustitucion.punto)})`);
            }
        });
    }

    volverAInicioJornada() {
        document.getElementById('jornadaActual').style.display = 'none';
        document.getElementById('jornada-nueva').style.display = 'block'; // AGREGAR ESTA LÍNEA
        this.jornadaActual = null;
        
        // Resetear planificación de sets
        this.planificacionSets = {
            set1: [],
            set2: [],
            set3: []
        };
        
        // Cerrar planificador
        const planificadorContainer = document.getElementById('planificadorSets');
        if (planificadorContainer) {
            planificadorContainer.style.display = 'none';
        }
        
        this.actualizarListaJornadas();
    }

    actualizarListaJornadas() {
        // Esta función se implementará para mostrar la lista de jornadas creadas
        console.log('Jornadas registradas:', this.jornadas.length);
    }

    // ==================== GESTIÓN DE EQUIPO ====================
    
    actualizarEquipo() {
        console.log('🔧 Actualizando equipo... Jugadoras:', this.jugadoras.length);
        
        // Buscar el container más específicamente
        let container = document.getElementById('listaJugadoras');
        if (!container) {
            console.log('⚠️ No se encontró listaJugadoras, buscando listaEquipo...');
            container = document.getElementById('listaEquipo');
        }
        
        console.log('📦 Container encontrado:', !!container, container?.id);
        
        if (!container) {
            console.error('❌ No se encontró ningún container válido para jugadoras');
            console.log('🔍 Elementos disponibles con ID que contienen "lista":', 
                Array.from(document.querySelectorAll('[id*="lista"]')).map(el => el.id));
            return;
        }
        
        if (this.jugadoras.length === 0) {
            console.log('⚠️ No hay nadie registrado');
            container.innerHTML = '<div class="empty-state"><h3>No hay nadie registrado</h3><p>Añade jugador/as usando el formulario de arriba</p></div>';
            return;
        }

        console.log('✅ Generando lista de', this.jugadoras.length, 'jugadoras');
        container.innerHTML = this.jugadoras
            .sort((a, b) => a.dorsal - b.dorsal)
            .map(jugadora => {
                const emoji = jugadora.posicion === 'colocadora' ? '🎯' : (jugadora.posicion === 'central' ? '🛡️' : '🏐');
                
                // Posición con formato inclusivo
                let posicion;
                if (jugadora.posicion === 'colocadora') {
                    posicion = 'Colocador/a';
                } else if (jugadora.posicion === 'central') {
                    posicion = 'Central';
                } else {
                    posicion = 'Jugador/a';
                }
                
                // Calcular sustituciones totales (tanto si entra como si sale) - SOLO DE JORNADAS COMPLETADAS
                let totalSustituciones = 0;
                this.jornadas.forEach(jornada => {
                    // Solo contar sustituciones de jornadas completadas
                    if (jornada.completada && jornada.sustituciones) {
                        // Contar en set1
                        if (jornada.sustituciones.set1) {
                            totalSustituciones += jornada.sustituciones.set1.filter(s => 
                                s.entraId === jugadora.id || s.saleId === jugadora.id
                            ).length;
                        }
                        // Contar en set2
                        if (jornada.sustituciones.set2) {
                            totalSustituciones += jornada.sustituciones.set2.filter(s => 
                                s.entraId === jugadora.id || s.saleId === jugadora.id
                            ).length;
                        }
                    }
                });
                
                return `
                    <div class="jugadora-item">
                        <div>
                            <div class="jugadora-nombre">${emoji} #${jugadora.dorsal} ${jugadora.nombre}</div>
                            <div class="jugadora-stats">
                                Posición: ${emoji} ${posicion} | 
                                Partidos Jugados: ${jugadora.partidosJugados || 0} | 
                                Sustituciones: ${totalSustituciones} | 
                                Puntos Totales: ${jugadora.puntosJugados || 0} | 
                                Entrenamientos: ${jugadora.entrenamientosAsistidos || 0}
                            </div>
                        </div>
                        <div>
                            <button class="info-btn" onclick="verInfoJugadoraGlobal(${jugadora.id})">Ver Info</button>
                            <button class="edit-btn" onclick="app.editarJugadora(${jugadora.id})">EDITAR</button>
                            <button class="delete-btn" onclick="app.eliminarJugadora(${jugadora.id})">ELIMINAR</button>
                        </div>
                    </div>
                `;
            }).join('');
        
        console.log('✅ Lista de jugadoras actualizada');
    }

    agregarJugadora() {
        const nombre = prompt('Nombre de la jugadora:');
        if (!nombre || !nombre.trim()) return;
        
        const dorsalesUsados = this.jugadoras.map(j => j.dorsal);
        let dorsal = 1;
        while (dorsalesUsados.includes(dorsal)) {
            dorsal++;
        }
        
        const nuevaJugadora = {
            id: Date.now(),
            nombre: nombre.trim(),
            dorsal: dorsal,
            posicion: 'jugadora',
            puntosJugados: 0,
            partidosJugados: 0,
            entrenamientosAsistidos: 0
        };
        
        this.jugadoras.push(nuevaJugadora);
        this.guardarJugadoras();
        this.actualizarEquipo();
        alert(`Jugadora ${nombre} agregada correctamente`);
    }

    editarJugadora(id) {
        const jugadora = this.jugadoras.find(j => j.id === id);
        if (!jugadora) return;
        
        // Abrir modal y rellenar con datos actuales
        const modal = document.getElementById('modalEditarJugadora');
        const nombreInput = document.getElementById('editNombre');
        const dorsalInput = document.getElementById('editDorsal');
        const posicionSelect = document.getElementById('editPosicion');
        
        nombreInput.value = jugadora.nombre;
        dorsalInput.value = jugadora.dorsal;
        posicionSelect.value = jugadora.posicion || 'jugadora';
        
        modal.style.display = 'flex';
        
        // Configurar botones (limpiar eventos previos)
        const btnConfirmar = document.getElementById('confirmarEdicion');
        const btnCancelar = document.getElementById('cancelarEdicion');
        
        // Remover listeners previos
        const newBtnConfirmar = btnConfirmar.cloneNode(true);
        const newBtnCancelar = btnCancelar.cloneNode(true);
        btnConfirmar.parentNode.replaceChild(newBtnConfirmar, btnConfirmar);
        btnCancelar.parentNode.replaceChild(newBtnCancelar, btnCancelar);
        
        // Nuevo listener para confirmar
        newBtnConfirmar.addEventListener('click', () => {
            const nuevoNombre = nombreInput.value.trim();
            const nuevoDorsal = parseInt(dorsalInput.value);
            const nuevaPosicion = posicionSelect.value;
            
            // Validaciones
            if (!nuevoNombre) {
                alert('El nombre no puede estar vacío');
                return;
            }
            
            if (!nuevoDorsal || nuevoDorsal < 1 || nuevoDorsal > 99) {
                alert('Ingresa un dorsal válido (1-99)');
                return;
            }
            
            // Verificar que el dorsal no esté usado por otra jugadora
            const dorsalDuplicado = this.jugadoras.find(j => j.id !== id && j.dorsal === nuevoDorsal);
            if (dorsalDuplicado) {
                alert(`El dorsal ${nuevoDorsal} ya está siendo usado por ${dorsalDuplicado.nombre}`);
                return;
            }
            
            // Guardar valores antiguos para actualizar referencias
            const nombreAntiguo = jugadora.nombre;
            const dorsalAntiguo = jugadora.dorsal;
            
            // Actualizar jugadora
            jugadora.nombre = nuevoNombre;
            jugadora.dorsal = nuevoDorsal;
            jugadora.posicion = nuevaPosicion;
            
            // IMPORTANTE: Actualizar todas las referencias en jornadas
            this.jornadas.forEach(jornada => {
                // Las referencias se mantienen por ID, no por nombre
                // Pero aseguramos que los datos estén sincronizados
                if (jornada.planificacionManual) {
                    ['set1', 'set2', 'set3'].forEach(setKey => {
                        if (jornada.planificacionManual[setKey]) {
                            jornada.planificacionManual[setKey] = jornada.planificacionManual[setKey].map(j => {
                                if (j && j.id === id) {
                                    return { ...jugadora }; // Actualizar con datos nuevos
                                }
                                return j;
                            });
                        }
                    });
                }
            });
            
            this.guardarJugadoras();
            this.guardarJornadas();
            this.actualizarEquipo();
            
            // Cerrar modal
            modal.style.display = 'none';
            
            console.log(`✅ Jugadora editada: ${nombreAntiguo} (#${dorsalAntiguo}) → ${nuevoNombre} (#${nuevoDorsal})`);
        });
        
        // Listener para cancelar
        newBtnCancelar.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Cerrar con ESC
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    eliminarJugadora(id) {
        const jugadora = this.jugadoras.find(j => j.id === id);
        if (!jugadora) return;
        
        if (confirm(`¿Eliminar a ${jugadora.nombre}?`)) {
            this.jugadoras = this.jugadoras.filter(j => j.id !== id);
            this.guardarJugadoras();
            this.actualizarEquipo();
        }
    }

    resetearEquipo() {
        if (confirm('⚠️ ¿Resetear todo el equipo? Esta acción no se puede deshacer.')) {
            localStorage.removeItem('volleyball_jugadoras');
            localStorage.removeItem('volleyball_jornadas');
            this.jugadoras = [];
            this.jornadas = [];
            this.mostrarAppPrincipal();
        }
    }

    resetearEstadisticas() {
        if (confirm('⚠️ ¿Resetear todas las estadísticas? Esto borrará puntos, partidos y entrenamientos de todas las jugadoras, así como el historial de jornadas.')) {
            // Resetear estadísticas de todas las jugadoras
            this.jugadoras.forEach(jugadora => {
                jugadora.puntosJugados = 0;
                jugadora.partidosJugados = 0;
                jugadora.entrenamientosAsistidos = 0;
            });
            
            // Guardar jugadoras con estadísticas reseteadas
            this.guardarJugadoras();
            
            // Borrar historial de jornadas
            localStorage.removeItem('volleyball_jornadas');
            this.jornadas = [];
            
            // Actualizar todas las vistas
            this.actualizarEquipo();
            this.actualizarHistorial();
            
            alert('✅ Estadísticas reseteadas correctamente. Todos los puntos, partidos y entrenamientos han sido puestos a 0.');
        }
    }

    recalcularTodasLasEstadisticas() {
        if (!confirm('📊 ¿Recalcular todas las estadísticas desde el historial de jornadas?\n\nEsto actualizará los puntos, partidos y entrenamientos de todas las jugadoras basándose en las jornadas guardadas.')) {
            return;
        }

        console.log('🔄 Iniciando recalculación de estadísticas...');

        // Resetear estadísticas de todas las jugadoras
        this.jugadoras.forEach(jugadora => {
            jugadora.puntosJugados = 0;
            jugadora.partidosJugados = 0;
            jugadora.entrenamientosAsistidos = 0;
        });

        // Procesar cada jornada completada
        let jornadasProcesadas = 0;
        this.jornadas.forEach(jornada => {
            if (!jornada.completada) {
                console.log(`⏭️ Omitiendo jornada no completada: ${jornada.fechaLunes}`);
                return;
            }

            console.log(`📅 Procesando jornada: ${jornada.fechaLunes}`);
            console.log('🔍 Estructura de la jornada:', {
                asistenciaLunes: jornada.asistenciaLunes?.length || 0,
                asistenciaMiercoles: jornada.asistenciaMiercoles?.length || 0,
                asistenciaSabado: jornada.asistenciaSabado?.length || 0,
                planificacionManual: !!jornada.planificacionManual,
                sabado: !!jornada.sabado,
                sets: !!jornada.sets,
                sustituciones: !!jornada.sustituciones
            });

            // Procesar entrenamientos (Lunes y Miércoles)
            if (jornada.asistenciaLunes && Array.isArray(jornada.asistenciaLunes)) {
                console.log(`  📚 Lunes: ${jornada.asistenciaLunes.length} asistentes`);
                jornada.asistenciaLunes.forEach(jugadoraId => {
                    const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
                    if (jugadora) {
                        jugadora.entrenamientosAsistidos++;
                        if (jugadora.id === 5) {
                            console.log(`  🔵 ILINA (ID:5) Lunes: +1 entrenamiento (Total: ${jugadora.entrenamientosAsistidos})`);
                        }
                    }
                });
            }
            
            if (jornada.asistenciaMiercoles && Array.isArray(jornada.asistenciaMiercoles)) {
                console.log(`  📚 Miércoles: ${jornada.asistenciaMiercoles.length} asistentes`);
                jornada.asistenciaMiercoles.forEach(jugadoraId => {
                    const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
                    if (jugadora) {
                        jugadora.entrenamientosAsistidos++;
                        if (jugadora.id === 5) {
                            console.log(`  � ILINA (ID:5) Miércoles: +1 entrenamiento (Total: ${jugadora.entrenamientosAsistidos})`);
                        }
                    }
                });
            }

            // Procesar partido (Sábado) - Sets con sustituciones
            const puntosJornada = {};

            // Función para procesar jugadoras titulares de un set
            const procesarSet = (setData, sustitucionesSet, nombreSet) => {
                if (!setData || setData.length === 0) return;

                // Filtrar null/undefined
                const jugadorasTitulares = setData.filter(j => j !== null && j !== undefined);

                jugadorasTitulares.forEach(jugadora => {
                    // Verificar si fue sustituida
                    const sustitucion = sustitucionesSet.find(s => s.saleId === jugadora.id);
                    
                    if (sustitucion) {
                        // Jugadora titular sustituida - puntos parciales
                        const puntosJugados = this.calcularPuntosPorSustitucion(sustitucion.punto);
                        puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosJugados;
                        if (jugadora.id === 5) {
                            console.log(`  🔵 ILINA (ID:5) ${nombreSet}: sustituida en ${sustitucion.punto}' -> ${puntosJugados} puntos (Total jornada: ${puntosJornada[jugadora.id]})`);
                        } else {
                            console.log(`  ↔️ ${nombreSet}: ${jugadora.nombre} sustituida en ${sustitucion.punto}' -> ${puntosJugados} puntos`);
                        }
                    } else {
                        // Jugadora titular completa - 25 puntos
                        puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + 25;
                        if (jugadora.id === 5) {
                            console.log(`  🔵 ILINA (ID:5) ${nombreSet}: titular completo -> 25 puntos (Total jornada: ${puntosJornada[jugadora.id]})`);
                        } else {
                            console.log(`  ✅ ${nombreSet}: ${jugadora.nombre} titular completo -> 25 puntos`);
                        }
                    }
                });
            };

            // Función para procesar suplentes de un set
            const procesarSuplentes = (sustitucionesSet, nombreSet) => {
                sustitucionesSet.forEach(sustitucion => {
                    const jugadora = this.jugadoras.find(j => j.id === sustitucion.entraId);
                    if (jugadora) {
                        const puntosJugados = 25 - this.calcularPuntosPorSustitucion(sustitucion.punto);
                        puntosJornada[jugadora.id] = (puntosJornada[jugadora.id] || 0) + puntosJugados;
                        console.log(`  🔄 ${nombreSet}: ${jugadora.nombre} entra en ${sustitucion.punto}' -> ${puntosJugados} puntos`);
                    }
                });
            };

            // Obtener sustituciones de cada set
            const sustitucionesSet1 = jornada.sustituciones?.set1 || [];
            const sustitucionesSet2 = jornada.sustituciones?.set2 || [];
            const sustitucionesSet3 = jornada.sustituciones?.set3 || [];

            // Procesar Set 1 (soportar 3 estructuras: planificacionManual, sabado, o sets)
            const set1Data = jornada.planificacionManual?.set1 || jornada.sabado?.set1 || jornada.sets?.set1 || [];
            if (set1Data.length > 0) {
                console.log(`  🏐 SET1: ${set1Data.length} jugadoras, sustituciones: ${sustitucionesSet1.length}`);
                procesarSet(set1Data, sustitucionesSet1, 'SET1');
                procesarSuplentes(sustitucionesSet1, 'SET1');
            }

            // Procesar Set 2
            const set2Data = jornada.planificacionManual?.set2 || jornada.sabado?.set2 || jornada.sets?.set2 || [];
            if (set2Data.length > 0) {
                console.log(`  🏐 SET2: ${set2Data.length} jugadoras, sustituciones: ${sustitucionesSet2.length}`);
                procesarSet(set2Data, sustitucionesSet2, 'SET2');
                procesarSuplentes(sustitucionesSet2, 'SET2');
            }

            // Procesar Set 3
            const set3Data = jornada.planificacionManual?.set3 || jornada.sabado?.set3 || jornada.sets?.set3 || [];
            if (set3Data.length > 0) {
                console.log(`  🏐 SET3: ${set3Data.length} jugadoras, sustituciones: ${sustitucionesSet3.length}`);
                procesarSet(set3Data, sustitucionesSet3, 'SET3');
                procesarSuplentes(sustitucionesSet3, 'SET3');
            }

            // Aplicar puntos y partido jugado
            Object.keys(puntosJornada).forEach(jugadoraId => {
                const jugadora = this.jugadoras.find(j => j.id == jugadoraId);
                if (jugadora) {
                    jugadora.puntosJugados += puntosJornada[jugadoraId];
                    jugadora.partidosJugados++;
                    if (jugadora.id === 5) {
                        console.log(`  🔵 ILINA (ID:5) RESUMEN: +${puntosJornada[jugadoraId]} puntos, +1 partido | TOTAL ACUMULADO: ${jugadora.puntosJugados} puntos, ${jugadora.partidosJugados} partidos`);
                    } else {
                        console.log(`  📊 ${jugadora.nombre}: +${puntosJornada[jugadoraId]} puntos, +1 partido`);
                    }
                }
            });

            jornadasProcesadas++;
        });

        // Guardar estadísticas actualizadas
        this.guardarJugadoras();

        // Actualizar todas las vistas
        this.actualizarEquipo();
        this.actualizarHistorial();

        console.log('✅ Recalculación completada');
        alert(`✅ Estadísticas recalculadas correctamente.\n\n${jornadasProcesadas} jornadas procesadas.\n${this.jugadoras.length} jugadoras actualizadas.`);
    }

    // ==================== HISTORIAL ====================
    actualizarHistorial() {
        // Actualizar selects de filtros
        this.actualizarFiltrosMes();
        this.actualizarFiltrosJugadora();
        
        // Actualizar estadísticas y lista
        this.actualizarResumenStats();
        this.actualizarListaHistorial();
    }

    actualizarFiltrosMes() {
        const select = document.getElementById('filtroMes');
        if (!select) return;
        
        const meses = [...new Set(this.jornadas.map(j => {
            const fecha = new Date(j.fechaLunes + 'T00:00:00');
            return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        }))].sort().reverse();
        
        select.innerHTML = '<option value="">Todos los meses</option>' +
            meses.map(mes => {
                const [año, mesNum] = mes.split('-');
                const nombreMes = new Date(año, mesNum - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                return `<option value="${mes}">${nombreMes}</option>`;
            }).join('');
    }

    actualizarFiltrosJugadora() {
        const select = document.getElementById('filtroJugadora');
        if (!select) return;
        
        select.innerHTML = '<option value="">Todos/as</option>' +
            this.jugadoras.map(j => `<option value="${j.id}">${j.nombre}</option>`).join('');
    }

    actualizarResumenStats() {
        const container = document.getElementById('resumenStats');
        if (!container) return;
        
        const totalJornadas = this.jornadas.length;
        const jornadasCompletadas = this.jornadas.filter(j => j.completada).length;
        const totalEntrenamientos = this.jornadas.reduce((total, j) => 
            total + (j.asistenciaLunes?.length || 0) + (j.asistenciaMiercoles?.length || 0), 0
        );
        const promedioPorJornada = totalJornadas > 0 ? Math.round(totalEntrenamientos / totalJornadas) : 0;
        
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalJornadas}</div>
                <div class="stat-label">Total Jornadas</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${jornadasCompletadas}</div>
                <div class="stat-label">Completadas</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.jugadoras.length}</div>
                <div class="stat-label">Jugadoras</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${promedioPorJornada}</div>
                <div class="stat-label">Prom. Asistencia</div>
            </div>
        `;
    }

    actualizarListaHistorial(jornadasFiltradas = null) {
        const container = document.getElementById('listaHistorial');
        if (!container) return;
        
        const jornadas = jornadasFiltradas || this.jornadas;
        const filtroJugadora = document.getElementById('filtroJugadora')?.value;
        const jugadoraFiltrada = filtroJugadora ? this.jugadoras.find(j => j.id === parseInt(filtroJugadora)) : null;
        
        if (jornadas.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No hay jornadas que mostrar</h3></div>';
            return;
        }
        
        // Ordenar jornadas de más reciente a más antigua
        const jornadasOrdenadas = [...jornadas].sort((a, b) => {
            const fechaA = a.fechaSeleccionada || a.fechaSabado || a.fechaLunes;
            const fechaB = b.fechaSeleccionada || b.fechaSabado || b.fechaLunes;
            return fechaB.localeCompare(fechaA); // Descendente (más reciente primero)
        });
        
        container.innerHTML = jornadasOrdenadas.map(jornada => {
            const jugadorasLunes = jornada.asistenciaLunes?.map(id => 
                this.jugadoras.find(j => j.id === id)?.nombre
            ).filter(n => n) || [];
            
            const jugadorasMiercoles = jornada.asistenciaMiercoles?.map(id => 
                this.jugadoras.find(j => j.id === id)?.nombre
            ).filter(n => n) || [];
            
            const jugadorasSabado = jornada.asistenciaSabado?.map(id => 
                this.jugadoras.find(j => j.id === id)?.nombre
            ).filter(n => n) || [];
            
            // Determinar qué fecha mostrar: si existe fechaSabado, usarla; si no, calcular desde fechaLunes
            let fechaMostrar;
            if (jornada.fechaSabado) {
                fechaMostrar = jornada.fechaSabado;
            } else {
                // Jornada antigua, calcular sábado desde lunes
                const [y, m, d] = jornada.fechaLunes.split('-').map(Number);
                const sabadoObj = new Date(y, m - 1, d + 5);
                const ys = sabadoObj.getFullYear();
                const ms = String(sabadoObj.getMonth() + 1).padStart(2, '0');
                const ds = String(sabadoObj.getDate()).padStart(2, '0');
                fechaMostrar = `${ys}-${ms}-${ds}`;
            }

            // Si existe fechaSeleccionada, usarla en lugar de fechaMostrar calculada
            if (jornada.fechaSeleccionada) {
                fechaMostrar = jornada.fechaSeleccionada;
            }

            // Generar texto de partido info
            let partidoInfo = '';
            if (jornada.ubicacion || jornada.rival) {
                const ubicacion = jornada.ubicacion || 'Sin ubicación';
                const tipoUbic = jornada.tipoUbicacion === 'fuera' ? 'Fuera' : 'Casa';
                const rival = jornada.rival || 'Sin rival';
                partidoInfo = ` - ${tipoUbic}: ${ubicacion} VS ${rival}`;
            }

            return `
                <div class="jornada-historial colapsada" data-jornada-id="${jornada.id}">
                    <div class="jornada-header" onclick="app.toggleJornadaDetalle(${jornada.id})">
                        <div class="jornada-header-izquierda">
                            <input type="checkbox" class="checkbox-jornada" value="${jornada.id}" onclick="event.stopPropagation()">
                            <span class="icono-expandir">▶</span>
                            <span class="jornada-titulo">Semana del ${this.formatearFecha(fechaMostrar)}${partidoInfo}</span>
                            <span class="estado ${jornada.completada ? 'completada' : 'pendiente'}">
                                ${jornada.completada ? '✅ Completada' : '⏳ Pendiente'}
                            </span>
                        </div>
                        <div class="jornada-acciones" onclick="event.stopPropagation()">
                            ${!jornada.completada ? `
                                <button onclick="app.continuarEditandoJornada(${jornada.id})" class="btn-editar-jornada">✏️ Editar</button>
                                <button onclick="app.eliminarJornada(${jornada.id})" class="btn-eliminar-jornada">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="jornada-detalle" style="display: none;">
                        <div class="dia-detalle">
                            <h5>📅 Lunes</h5>
                            <div class="asistentes-lista">
                                ${jugadorasLunes.length > 0 ? 
                                    jugadorasLunes.map(n => {
                                        const claseResaltado = jugadoraFiltrada && n === jugadoraFiltrada.nombre ? 'resaltado' : '';
                                        return `<span class="jugadora-asistente ${claseResaltado}">${n}</span>`;
                                    }).join('') :
                                    '<span class="no-asistentes">Sin asistentes</span>'
                                }
                            </div>
                        </div>
                        
                        <div class="dia-detalle">
                            <h5>📅 Miércoles</h5>
                            <div class="asistentes-lista">
                                ${jugadorasMiercoles.length > 0 ? 
                                    jugadorasMiercoles.map(n => {
                                        const claseResaltado = jugadoraFiltrada && n === jugadoraFiltrada.nombre ? 'resaltado' : '';
                                        return `<span class="jugadora-asistente ${claseResaltado}">${n}</span>`;
                                    }).join('') :
                                    '<span class="no-asistentes">Sin asistentes</span>'
                                }
                            </div>
                        </div>
                        
                        <div class="dia-detalle">
                            <h5>🏐 Sábado</h5>
                            ${this.generarVistaPartidoHistorial(jornada, jugadoraFiltrada)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    generarVistaPartidoHistorial(jornada, jugadoraFiltrada) {
        const jugadorasSabado = jornada.asistenciaSabado?.map(id => 
            this.jugadoras.find(j => j.id === id)
        ).filter(j => j) || [];

        if (jugadorasSabado.length === 0) {
            return '<div class="no-asistentes">Sin jugadoras</div>';
        }

        // Si hay planificación manual guardada O sets guardados en la jornada, mostrarlos
        const tienePlanificacion = jornada.planificacionManual || 
                                 (jornada.sets?.set1 && jornada.sets.set1.length > 0) || 
                                 (jornada.sets?.set2 && jornada.sets.set2.length > 0) ||
                                 (jornada.sets?.set3 && jornada.sets.set3.length > 0);
        
        if (tienePlanificacion) {
            // Priorizar planificacionManual, sino usar los sets del borrador
            const set1Data = jornada.planificacionManual?.set1 || jornada.sets?.set1 || [];
            const set2Data = jornada.planificacionManual?.set2 || jornada.sets?.set2 || [];
            const set3Data = jornada.planificacionManual?.set3 || jornada.sets?.set3 || [];
            
            let html = '';
            
            // Set 1
            if (set1Data && set1Data.length > 0) {
                html += '<div class="set-historial">';
                html += '<strong>Set 1:</strong>';
                html += '<div class="asistentes-lista">';
                html += set1Data.filter(j => j !== null && j !== undefined).map(j => {
                    // Si j es solo ID, buscar jugadora
                    const jugadora = typeof j === 'object' ? j : this.jugadoras.find(jug => jug.id === j);
                    if (!jugadora || !jugadora.nombre) return '';
                    const claseResaltado = jugadoraFiltrada && jugadora.nombre === jugadoraFiltrada.nombre ? 'resaltado' : '';
                    return `<span class="jugadora-asistente ${claseResaltado}">${jugadora.nombre}</span>`;
                }).filter(html => html !== '').join('');
                html += '</div>';
                html += '</div>';
            }
            
            // Set 2
            if (set2Data && set2Data.length > 0) {
                html += '<div class="set-historial">';
                html += '<strong>Set 2:</strong>';
                html += '<div class="asistentes-lista">';
                html += set2Data.filter(j => j !== null && j !== undefined).map(j => {
                    // Si j es solo ID, buscar jugadora
                    const jugadora = typeof j === 'object' ? j : this.jugadoras.find(jug => jug.id === j);
                    if (!jugadora || !jugadora.nombre) return '';
                    const claseResaltado = jugadoraFiltrada && jugadora.nombre === jugadoraFiltrada.nombre ? 'resaltado' : '';
                    return `<span class="jugadora-asistente ${claseResaltado}">${jugadora.nombre}</span>`;
                }).filter(html => html !== '').join('');
                html += '</div>';
                html += '</div>';
            }
            
            // Set 3
            if (set3Data && set3Data.length > 0) {
                html += '<div class="set-historial">';
                html += '<strong>Set 3:</strong>';
                html += '<div class="asistentes-lista">';
                html += set3Data.filter(j => j !== null && j !== undefined).map(j => {
                    // Si j es solo ID, buscar jugadora
                    const jugadora = typeof j === 'object' ? j : this.jugadoras.find(jug => jug.id === j);
                    if (!jugadora || !jugadora.nombre) return '';
                    const claseResaltado = jugadoraFiltrada && jugadora.nombre === jugadoraFiltrada.nombre ? 'resaltado' : '';
                    return `<span class="jugadora-asistente ${claseResaltado}">${jugadora.nombre}</span>`;
                }).filter(html => html !== '').join('');
                html += '</div>';
                html += '</div>';
            }
            
            // Mostrar sustituciones si existen y tienen contenido
            const tieneSustitucionesSet1 = jornada.sustituciones?.set1?.length > 0;
            const tieneSustitucionesSet2 = jornada.sustituciones?.set2?.length > 0;
            const tieneSustitucionesSet3 = jornada.sustituciones?.set3?.length > 0;
            
            if (tieneSustitucionesSet1 || tieneSustitucionesSet2 || tieneSustitucionesSet3) {
                html += '<div class="sustituciones-historial">';
                html += '<strong>Cambios realizados:</strong>';
                
                // Sustituciones Set 1
                if (tieneSustitucionesSet1) {
                    html += '<div class="sustituciones-set">';
                    html += '<em>Set 1:</em>';
                    html += '<div class="cambios-lista">';
                    html += jornada.sustituciones.set1.map((sust, index) => {
                        const jugadoraSale = this.jugadoras.find(j => j.id === sust.saleId);
                        const jugadoraEntra = this.jugadoras.find(j => j.id === sust.entraId);
                        
                        // Validar que las jugadoras existan y tengan nombre
                        if (!jugadoraSale || !jugadoraEntra || !jugadoraSale.nombre || !jugadoraEntra.nombre) {
                            return ''; // Omitir sustituciones con datos incompletos
                        }
                        
                        // Agregar resaltado si coincide con el filtro
                        let nombreSale = jugadoraSale.nombre;
                        let nombreEntra = jugadoraEntra.nombre;
                        
                        if (jugadoraFiltrada) {
                            if (nombreSale === jugadoraFiltrada.nombre) {
                                nombreSale = `<span class="jugadora-filtrada">${nombreSale}</span>`;
                            }
                            if (nombreEntra === jugadoraFiltrada.nombre) {
                                nombreEntra = `<span class="jugadora-filtrada">${nombreEntra}</span>`;
                            }
                        }
                        
                        return `• ${nombreEntra} entra por ${nombreSale} (${sust.punto}')`;
                    }).filter(s => s !== '').join('<br>');
                    html += '</div>'; // cierra cambios-lista
                    html += '</div>'; // cierra sustituciones-set
                }
                
                // Sustituciones Set 2
                if (tieneSustitucionesSet2) {
                    html += '<div class="sustituciones-set">';
                    html += '<em>Set 2:</em>';
                    html += '<div class="cambios-lista">';
                    html += jornada.sustituciones.set2.map((sust, index) => {
                        const jugadoraSale = this.jugadoras.find(j => j.id === sust.saleId);  
                        const jugadoraEntra = this.jugadoras.find(j => j.id === sust.entraId);
                        
                        // Validar que las jugadoras existan y tengan nombre
                        if (!jugadoraSale || !jugadoraEntra || !jugadoraSale.nombre || !jugadoraEntra.nombre) {
                            return ''; // Omitir sustituciones con datos incompletos
                        }
                        
                        // Agregar resaltado si coincide con el filtro
                        let nombreSale = jugadoraSale.nombre;
                        let nombreEntra = jugadoraEntra.nombre;
                        
                        if (jugadoraFiltrada) {
                            if (nombreSale === jugadoraFiltrada.nombre) {
                                nombreSale = `<span class="jugadora-filtrada">${nombreSale}</span>`;
                            }
                            if (nombreEntra === jugadoraFiltrada.nombre) {
                                nombreEntra = `<span class="jugadora-filtrada">${nombreEntra}</span>`;
                            }
                        }
                        
                        return `• ${nombreEntra} entra por ${nombreSale} (${sust.punto}')`;
                    }).filter(s => s !== '').join('<br>');
                    html += '</div>'; // cierra cambios-lista
                    html += '</div>'; // cierra sustituciones-set
                }
                
                // Sustituciones Set 3
                if (tieneSustitucionesSet3) {
                    html += '<div class="sustituciones-set">';
                    html += '<em>Set 3:</em>';
                    html += '<div class="cambios-lista">';
                    html += jornada.sustituciones.set3.map((sust, index) => {
                        const jugadoraSale = this.jugadoras.find(j => j.id === sust.saleId);  
                        const jugadoraEntra = this.jugadoras.find(j => j.id === sust.entraId);
                        
                        // Validar que las jugadoras existan y tengan nombre
                        if (!jugadoraSale || !jugadoraEntra || !jugadoraSale.nombre || !jugadoraEntra.nombre) {
                            return ''; // Omitir sustituciones con datos incompletos
                        }
                        
                        // Agregar resaltado si coincide con el filtro
                        let nombreSale = jugadoraSale.nombre;
                        let nombreEntra = jugadoraEntra.nombre;
                        
                        if (jugadoraFiltrada) {
                            if (nombreSale === jugadoraFiltrada.nombre) {
                                nombreSale = `<span class="jugadora-filtrada">${nombreSale}</span>`;
                            }
                            if (nombreEntra === jugadoraFiltrada.nombre) {
                                nombreEntra = `<span class="jugadora-filtrada">${nombreEntra}</span>`;
                            }
                        }
                        
                        return `• ${nombreEntra} entra por ${nombreSale} (${sust.punto}')`;
                    }).filter(s => s !== '').join('<br>');
                    html += '</div>'; // cierra cambios-lista
                    html += '</div>'; // cierra sustituciones-set
                }
                
                html += '</div>'; // cierra sustituciones-historial
            }

            // Si no hay sets pero hay jugadoras disponibles, mostrar lista simple
            if (set1Data.length === 0 && set2Data.length === 0 && set3Data.length === 0) {
                html += `
                    <div class="asistentes-lista">
                        ${jugadorasSabado.map(j => {
                            const claseResaltado = jugadoraFiltrada && j.nombre === jugadoraFiltrada.nombre ? 'resaltado' : '';
                            return `<span class="jugadora-asistente ${claseResaltado}">${j.nombre}</span>`;
                        }).join('')}
                    </div>
                `;
            }

            // Si la jornada NO está completada, mostrar jugadoras que asistirán
            if (!jornada.completada && jugadorasSabado.length > 0) {
                html += `
                    <div class="jugadoras-asistiran" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #007bff;">
                        <strong>Jugadoras que asistirán:</strong>
                        <div style="margin-top: 5px;">
                            ${jugadorasSabado.map(j => {
                                const claseResaltado = jugadoraFiltrada && j.nombre === jugadoraFiltrada.nombre ? 'resaltado' : '';
                                return `<span class="jugadora-asistente ${claseResaltado}">${j.nombre}</span>`;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
            
            return html;
        } else {
            // Vista simple sin sets definidos
            return `
                <div class="asistentes-lista">
                    ${jugadorasSabado.map(j => {
                        const claseResaltado = jugadoraFiltrada && j.nombre === jugadoraFiltrada.nombre ? 'resaltado' : '';
                        return `<span class="jugadora-asistente ${claseResaltado}">${j.nombre}</span>`;
                    }).join('')}
                </div>
            `;
        }
    }

    // Toggle para expandir/colapsar detalles de una jornada en el historial
    toggleJornadaDetalle(jornadaId) {
        const jornadaElement = document.querySelector(`[data-jornada-id="${jornadaId}"]`);
        if (!jornadaElement) return;
        
        const detalle = jornadaElement.querySelector('.jornada-detalle');
        const icono = jornadaElement.querySelector('.icono-expandir');
        
        // Verificar si está oculto (puede ser 'none' o '')
        const estaOculto = detalle.style.display === 'none' || detalle.style.display === '';
        
        if (estaOculto) {
            detalle.style.display = 'grid';
            icono.textContent = '▼';
            jornadaElement.classList.remove('colapsada');
        } else {
            detalle.style.display = 'none';
            icono.textContent = '▶';
            jornadaElement.classList.add('colapsada');
        }
    }

    // Sincronizar referencias de jugadoras en una jornada
    // Esto actualiza los objetos de jugadoras en los sets con los datos actuales
    sincronizarReferenciasJugadoras(jornada) {
        if (!jornada) return;
        
        console.log('🔄 Sincronizando referencias de jugadoras en jornada...');
        
        // Limpiar asistencias de jugadoras que ya no existen
        const jugadorasExistentes = new Set(this.jugadoras.map(j => j.id));
        
        if (jornada.asistenciaLunes) {
            jornada.asistenciaLunes = jornada.asistenciaLunes.filter(id => jugadorasExistentes.has(id));
        }
        if (jornada.asistenciaMiercoles) {
            jornada.asistenciaMiercoles = jornada.asistenciaMiercoles.filter(id => jugadorasExistentes.has(id));
        }
        if (jornada.asistenciaSabado) {
            jornada.asistenciaSabado = jornada.asistenciaSabado.filter(id => jugadorasExistentes.has(id));
        }
        
        // Sincronizar en planificación manual
        if (jornada.planificacionManual) {
            ['set1', 'set2', 'set3'].forEach(setKey => {
                if (jornada.planificacionManual[setKey]) {
                    jornada.planificacionManual[setKey] = jornada.planificacionManual[setKey]
                        .filter(jugadoraEnSet => jugadoraEnSet !== null && jugadoraEnSet !== undefined && jugadoraEnSet.id)
                        .map(jugadoraEnSet => {
                            // Buscar la jugadora actual con ese ID
                            const jugadoraActual = this.jugadoras.find(j => j.id === jugadoraEnSet.id);
                            
                            if (jugadoraActual) {
                                // Retornar una copia actualizada de la jugadora
                                return { ...jugadoraActual };
                            } else {
                                console.warn(`⚠️ Jugadora con ID ${jugadoraEnSet.id} no encontrada en equipo actual`);
                                return null; // Marcar para eliminar
                            }
                        })
                        .filter(j => j !== null); // Eliminar jugadoras no encontradas
                }
            });
        }
        
        // Sincronizar en sets (si existen)
        if (jornada.sets) {
            ['set1', 'set2', 'set3'].forEach(setKey => {
                if (jornada.sets[setKey]) {
                    jornada.sets[setKey] = jornada.sets[setKey]
                        .filter(jugadoraEnSet => jugadoraEnSet !== null && jugadoraEnSet !== undefined && jugadoraEnSet.id)
                        .map(jugadoraEnSet => {
                            const jugadoraActual = this.jugadoras.find(j => j.id === jugadoraEnSet.id);
                            
                            if (jugadoraActual) {
                                return { ...jugadoraActual };
                            } else {
                                console.warn(`⚠️ Jugadora con ID ${jugadoraEnSet.id} no encontrada en equipo actual`);
                                return null;
                            }
                        })
                        .filter(j => j !== null);
                }
            });
        }
        
        console.log('✅ Referencias sincronizadas');
    }

    continuarEditandoJornada(jornadaId) {
        console.log('🔄 Continuando edición de jornada:', jornadaId);
        
        // Buscar la jornada a editar
        const jornada = this.jornadas.find(j => j.id === jornadaId);
        if (!jornada) {
            alert('Jornada no encontrada');
            return;
        }

        // Establecer como jornada actual
        this.jornadaActual = jornada;
        
        // IMPORTANTE: Sincronizar referencias de jugadoras antes de cargar
        this.sincronizarReferenciasJugadoras(jornada);
        
        // Cargar datos existentes si los hay
        if (jornada.sets) {
            this.planificacionSets = {
                set1: jornada.sets.set1 || [],
                set2: jornada.sets.set2 || [],
                set3: jornada.sets.set3 || []
            };
        } else {
            // Si no hay sets guardados, resetear
            this.planificacionSets = {
                set1: [],
                set2: [],
                set3: []
            };
        }

        // Cambiar a la pestaña de Jornadas
        this.cambiarTab('jornadas');
        
        // Ocultar banner mientras editamos
        this.ocultarBanner();
        
        // IMPORTANTE: Mostrar la interfaz de jornada activa y ocultar la de creación nueva
        document.getElementById('jornada-nueva').style.display = 'none';
        document.getElementById('jornadaActual').style.display = 'block';
        
        // Actualizar el título de la jornada - usar fechaSeleccionada si existe
        const fechaMostrar = jornada.fechaSeleccionada || jornada.fechaLunes;
        document.getElementById('tituloJornada').textContent = `Jornada: Semana del ${this.formatearFecha(fechaMostrar)}`;
        
        // Actualizar títulos de días con fechas específicas
        this.actualizarTitulosDias();
        
        // Cargar asistencias en los grids
        this.cargarAsistenciasEnGrids(jornada);
        
        // Ir al paso de planificación de sets
        this.irAPaso('sabado');
        
        // Obtener jugadoras disponibles
        const jugadorasDisponibles = this.jugadoras.filter(j => 
            jornada.asistenciaSabado && jornada.asistenciaSabado.includes(j.id)
        );
        
        // Forzar mostrar el planificador directamente
        setTimeout(() => {
            console.log('🎯 Forzando mostrar planificador de sets...');
            this.mostrarPlanificadorSets(jugadorasDisponibles);
            
            // Actualizar vistas
            this.actualizarVistasSets();
            this.actualizarJugadorasDisponibles();
            
            // Hacer scroll al planificador
            const planificador = document.querySelector('.planificador-sets');
            if (planificador) {
                planificador.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 500);
        
        console.log('✅ Planificador de sets mostrado para edición');
        alert(`Editando jornada del ${this.formatearFecha(jornada.fechaLunes)}`);
        this.configurarEventListeners();
    }

    formatearFecha(fechaString) {
        const fecha = new Date(fechaString + 'T00:00:00');
        return fecha.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    }

    actualizarTitulosDias() {
        if (!this.jornadaActual) return;
        
        console.log('🗓️ DEBUG FECHAS - Jornada actual:', this.jornadaActual);
        
        // Si la jornada tiene las fechas guardadas, usarlas directamente
        let fechaLunes, fechaMiercoles, fechaSabado;
        
        if (this.jornadaActual.fechaMiercoles && this.jornadaActual.fechaSabado) {
            // Jornada nueva con fechas específicas guardadas
            fechaLunes = new Date(this.jornadaActual.fechaLunes.split('-').join('/'));
            fechaMiercoles = new Date(this.jornadaActual.fechaMiercoles.split('-').join('/'));
            fechaSabado = new Date(this.jornadaActual.fechaSabado.split('-').join('/'));
        } else {
            // Jornada antigua, calcular fechas a partir del lunes
            const [y, m, d] = this.jornadaActual.fechaLunes.split('-').map(Number);
            fechaLunes = new Date(y, m - 1, d);
            fechaMiercoles = new Date(y, m - 1, d + 2);
            fechaSabado = new Date(y, m - 1, d + 5);
        }
        
        console.log('🗓️ DEBUG FECHAS - Fecha lunes:', fechaLunes.toLocaleDateString('es-ES'));
        console.log('🗓️ DEBUG FECHAS - Fecha miércoles:', fechaMiercoles.toLocaleDateString('es-ES'));
        console.log('🗓️ DEBUG FECHAS - Fecha sábado:', fechaSabado.toLocaleDateString('es-ES'));

        // Formatear fechas cortas (día/mes)
        const formatearCorto = (fecha) => {
            return fecha.toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: '2-digit'
            });
        };

        // Actualizar títulos con fechas
        const tituloLunes = document.getElementById('tituloLunes');
        const tituloMiercoles = document.getElementById('tituloMiercoles');
        const tituloSabado = document.getElementById('tituloSabado');

        if (tituloLunes) {
            const textoLunes = `📅 Entrenamiento Lunes ${formatearCorto(fechaLunes)}`;
            console.log('🗓️ DEBUG FECHAS - Texto lunes:', textoLunes);
            tituloLunes.textContent = textoLunes;
        }
        if (tituloMiercoles) {
            const textoMiercoles = `📅 Entrenamiento Miércoles ${formatearCorto(fechaMiercoles)}`;
            console.log('🗓️ DEBUG FECHAS - Texto miércoles:', textoMiercoles);
            tituloMiercoles.textContent = textoMiercoles;
        }
        if (tituloSabado) {
            const textoSabado = `🏐 Partido Sábado ${formatearCorto(fechaSabado)}`;
            console.log('🗓️ DEBUG FECHAS - Texto sábado:', textoSabado);
            tituloSabado.textContent = textoSabado;
        }
    }

    cargarAsistenciasEnGrids(jornada) {
        console.log('📋 Cargando asistencias en grids para jornada:', jornada.id);
        
        // Cargar asistencia Lunes
        const asistenciaLunesGrid = document.getElementById('asistenciaLunesGrid');
        if (asistenciaLunesGrid && jornada.asistenciaLunes) {
            this.generarGridAsistencia(asistenciaLunesGrid, jornada.asistenciaLunes, 'lunes');
        }
        
        // Cargar asistencia Miércoles  
        const asistenciaMiercolesGrid = document.getElementById('asistenciaMiercolesGrid');
        if (asistenciaMiercolesGrid && jornada.asistenciaMiercoles) {
            this.generarGridAsistencia(asistenciaMiercolesGrid, jornada.asistenciaMiercoles, 'miercoles');
        }
        
        // Cargar asistencia Sábado
        const asistenciaSabadoGrid = document.getElementById('asistenciaSabadoGrid');
        if (asistenciaSabadoGrid && jornada.asistenciaSabado) {
            this.generarGridAsistencia(asistenciaSabadoGrid, jornada.asistenciaSabado, 'sabado');
        }
    }

    generarGridAsistencia(container, asistenciasIds, dia) {
        container.innerHTML = '';
        
        // Añadir leyenda de colores SOLO para el sábado en jornadas nuevas (no al continuar editando)
        const esContinuarEditando = this.jornadaActual && this.jornadaActual.id;
        
        if (dia === 'sabado' && this.jornadaActual && !esContinuarEditando) {
            const leyenda = document.createElement('div');
            leyenda.className = 'leyenda-entrenamientos';
            leyenda.innerHTML = `
                <h5>📊 Significado de los colores según asistencia a entrenamientos:</h5>
                <div class="leyenda-items">
                    <div class="leyenda-item">
                        <div class="leyenda-color verde"></div>
                        <span class="leyenda-texto">Asistió lunes Y miércoles</span>
                    </div>
                    <div class="leyenda-item">
                        <div class="leyenda-color amarillo"></div>
                        <span class="leyenda-texto">Asistió solo 1 día</span>
                    </div>
                    <div class="leyenda-item">
                        <div class="leyenda-color rojo"></div>
                        <span class="leyenda-texto">No asistió a entrenamientos</span>
                    </div>
                </div>
            `;
            container.appendChild(leyenda);
        }
        
        this.jugadoras.forEach(jugadora => {
            const isSelected = asistenciasIds.includes(jugadora.id);
            const card = document.createElement('div');
            
            // Determinar el color según asistencia a entrenamientos (solo para sábado en jornadas NUEVAS, NO al editar)
            let colorClass = '';
            if (dia === 'sabado' && this.jornadaActual && !esContinuarEditando) {
                const asistioLunes = this.jornadaActual.asistenciaLunes.includes(jugadora.id);
                const asistioMiercoles = this.jornadaActual.asistenciaMiercoles.includes(jugadora.id);
                
                if (asistioLunes && asistioMiercoles) {
                    colorClass = 'verde';
                } else if (asistioLunes || asistioMiercoles) {
                    colorClass = 'amarillo';
                } else {
                    colorClass = 'rojo';
                }
            }
            
            card.className = `jugadora-card ${colorClass} ${isSelected ? 'selected' : ''}`;
            card.onclick = () => this.toggleAsistencia(`asistencia${dia.charAt(0).toUpperCase() + dia.slice(1)}`, jugadora.id);
            
            card.innerHTML = `
                <div class="jugadora-header">
                    <span class='emoji'>${jugadora.posicion === 'colocadora' ? '🎯' : (jugadora.posicion === 'central' ? '🛡️' : '🏐')}</span>
                    <span class="jugadora-dorsal">#${jugadora.dorsal}</span>
                    <span class="jugadora-nombre">${jugadora.nombre}</span>
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    // ==================== EVENT LISTENERS ====================
    configurarEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
        // Prevenir duplicación de event listeners
        if (this.eventListenersConfigurados) {
            console.log('⚠️ Event listeners ya configurados, omitiendo...');
            return;
        }
        
        // Jornadas
        document.getElementById('crearJornada')?.addEventListener('click', () => this.crearNuevaJornada());
        document.getElementById('siguienteLunes')?.addEventListener('click', () => this.irAPaso('miercoles'));
        document.getElementById('volverLunes')?.addEventListener('click', () => this.irAPaso('lunes'));
        document.getElementById('siguienteMiercoles')?.addEventListener('click', () => this.irAPaso('sabado'));
        document.getElementById('volverMiercoles')?.addEventListener('click', () => this.irAPaso('miercoles'));
        document.getElementById('volverInicio')?.addEventListener('click', () => this.volverAInicioJornada());
        document.getElementById('completarJornada')?.addEventListener('click', () => this.completarJornada());
        document.getElementById('guardarBorrador')?.addEventListener('click', () => this.guardarBorrador());
        
        // Radio buttons para ubicación del partido
        const radioCasa = document.getElementById('radioCasa');
        const radioFuera = document.getElementById('radioFuera');
        const ubicacionInput = document.getElementById('ubicacionPartido');
        
        if (radioCasa && ubicacionInput) {
            radioCasa.addEventListener('change', async () => {
                if (radioCasa.checked) {
                    const config = await this.cargarConfiguracion();
                    if (config.polideportivoCasa) {
                        ubicacionInput.value = config.polideportivoCasa;
                    }
                }
            });
        }
        
        if (radioFuera && ubicacionInput) {
            radioFuera.addEventListener('change', () => {
                if (radioFuera.checked) {
                    ubicacionInput.value = '';
                }
            });
        }
        
        // Botones de equipo - CON VERIFICACIÓN EXTRA
        const btnAdd = document.getElementById('addJugadora');
        const btnReset = document.getElementById('resetearEquipo');
        const btnRecalcular = document.getElementById('recalcularEstadisticas');
        const btnGuardar = document.getElementById('guardarJugadora');
        const btnCancelar = document.getElementById('cancelarJugadora');
        
        console.log('🔍 Verificando elementos del equipo:', {
            btnAdd: !!btnAdd,
            btnReset: !!btnReset,
            btnRecalcular: !!btnRecalcular,
            btnGuardar: !!btnGuardar,
            btnCancelar: !!btnCancelar
        });
        
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                console.log('🔘 Botón Añadir Jugadora presionado');
                const form = document.getElementById('formJugadora');
                if (form) {
                    form.style.display = 'block';
                    console.log('📝 Formulario mostrado');
                } else {
                    console.error('❌ Formulario no encontrado');
                }
            });
            console.log('✅ Event listener addJugadora configurado');
        } else {
            console.error('❌ Botón addJugadora NO encontrado');
        }
        
        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetearEquipo());
            console.log('✅ Event listener resetearEquipo configurado');
        }
        
        if (btnRecalcular) {
            btnRecalcular.addEventListener('click', () => this.recalcularTodasLasEstadisticas());
            console.log('✅ Event listener recalcularEstadisticas configurado');
        }
        
        if (btnGuardar) {
            btnGuardar.addEventListener('click', () => {
                console.log('💾 Botón Guardar Jugadora presionado');
                this.guardarJugadora();
            });
            console.log('✅ Event listener guardarJugadora configurado');
        }
        
        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => {
                console.log('❌ Botón Cancelar presionado');
                const form = document.getElementById('formJugadora');
                if (form) {
                    form.style.display = 'none';
                }
            });
            console.log('✅ Event listener cancelarJugadora configurado');
        }
        
        document.getElementById('resetearEstadisticas')?.addEventListener('click', () => this.resetearEstadisticas());
        
        // Historial
        document.getElementById('filtrarHistorial')?.addEventListener('click', () => this.filtrarHistorial());
        document.getElementById('limpiarFiltro')?.addEventListener('click', () => this.limpiarFiltros());
        document.getElementById('borrarHistorial')?.addEventListener('click', () => this.borrarHistorial());
        document.getElementById('eliminarSeleccionadas')?.addEventListener('click', () => this.eliminarJornadasSeleccionadas());
        document.getElementById('exportarDatos')?.addEventListener('click', () => this.exportarDatos());
        document.getElementById('importarDatos')?.addEventListener('click', () => this.importarDatos());
        document.getElementById('archivoImportar')?.addEventListener('change', (e) => this.procesarArchivoImportacion(e));
        
        // Banner jornada pendiente
        document.getElementById('continuarPlanificando')?.addEventListener('click', () => this.continuarDesdeBanner());
        document.getElementById('eliminarBorrador')?.addEventListener('click', () => this.eliminarBorradorDesdeBanner());
        document.getElementById('cerrarBanner')?.addEventListener('click', () => this.cerrarBanner());
        
        // Marcar como configurados para evitar duplicación
        this.eventListenersConfigurados = true;
        
        console.log('✅ Event listeners configurados');
    }

    // Función específica para configurar event listeners del equipo
    configurarEventListenersEquipo() {
        console.log('🔧 Re-configurando event listeners del equipo...');
        
        const btnAdd = document.getElementById('addJugadora');
        const btnGuardar = document.getElementById('guardarJugadora');
        const btnCancelar = document.getElementById('cancelarJugadora');
        
        // Remover listeners anteriores si existen
        if (btnAdd) {
            // Clonar el elemento para remover todos los event listeners
            const newBtnAdd = btnAdd.cloneNode(true);
            btnAdd.parentNode.replaceChild(newBtnAdd, btnAdd);
            
            // Añadir el nuevo event listener
            newBtnAdd.addEventListener('click', () => {
                console.log('🔘 [RE-CONFIG] Botón Añadir Jugadora presionado');
                const form = document.getElementById('formJugadora');
                if (form) {
                    form.style.display = 'block';
                    console.log('📝 [RE-CONFIG] Formulario mostrado');
                } else {
                    console.error('❌ [RE-CONFIG] Formulario no encontrado');
                }
            });
            console.log('✅ Event listener addJugadora RE-configurado');
        }
        
        if (btnGuardar) {
            const newBtnGuardar = btnGuardar.cloneNode(true);
            btnGuardar.parentNode.replaceChild(newBtnGuardar, btnGuardar);
            
            newBtnGuardar.addEventListener('click', () => {
                console.log('💾 [RE-CONFIG] Botón Guardar presionado');
                this.guardarJugadora();
            });
            console.log('✅ Event listener guardarJugadora RE-configurado');
        }
        
        if (btnCancelar) {
            const newBtnCancelar = btnCancelar.cloneNode(true);
            btnCancelar.parentNode.replaceChild(newBtnCancelar, btnCancelar);
            
            newBtnCancelar.addEventListener('click', () => {
                console.log('❌ [RE-CONFIG] Botón Cancelar presionado');
                const form = document.getElementById('formJugadora');
                if (form) {
                    form.style.display = 'none';
                }
            });
            console.log('✅ Event listener cancelarJugadora RE-configurado');
        }
    }

    // Configurar event listeners dinámicos (se llama cuando se crean elementos)
    configurarEventListenersDinamicos() {
        // Planificación manual
        document.getElementById('planificarManual')?.addEventListener('click', () => this.abrirPlanificadorManual());
        document.getElementById('guardarPlanificacion')?.addEventListener('click', () => this.guardarPlanificacionActual());
        document.getElementById('editarPlanificacion')?.addEventListener('click', () => this.abrirPlanificadorManual());
        document.getElementById('limpiarPlanificacion')?.addEventListener('click', () => this.limpiarPlanificacion());
    }

    filtrarHistorial() {
        const filtroMes = document.getElementById('filtroMes').value;
        const filtroJugadora = document.getElementById('filtroJugadora').value;
        
        let jornadasFiltradas = [...this.jornadas];
        
        // Filtrar por mes
        if (filtroMes) {
            jornadasFiltradas = jornadasFiltradas.filter(jornada => {
                const fecha = new Date(jornada.fechaLunes + 'T00:00:00');
                const mesJornada = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
                return mesJornada === filtroMes;
            });
        }
        
        // Filtrar por jugadora
        if (filtroJugadora) {
            const jugadoraId = parseInt(filtroJugadora);
            jornadasFiltradas = jornadasFiltradas.filter(jornada => {
                return jornada.asistenciaLunes?.includes(jugadoraId) ||
                       jornada.asistenciaMiercoles?.includes(jugadoraId) ||
                       jornada.asistenciaSabado?.includes(jugadoraId);
            });
        }
        
        this.actualizarListaHistorial(jornadasFiltradas);
        
        // Mostrar mensaje de resultados
        const totalFiltradas = jornadasFiltradas.length;
        const mensaje = totalFiltradas === this.jornadas.length ? 
            'Mostrando todas las jornadas' : 
            `Mostrando ${totalFiltradas} de ${this.jornadas.length} jornadas`;
        
        console.log(mensaje);
    }

    limpiarFiltros() {
        document.getElementById('filtroMes').value = '';
        document.getElementById('filtroJugadora').value = '';
        this.actualizarListaHistorial();
    }

    eliminarJornadasSeleccionadas() {
        const checkboxes = document.querySelectorAll('.checkbox-jornada:checked');
        
        if (checkboxes.length === 0) {
            alert('Selecciona al menos una jornada para eliminar');
            return;
        }
        
        const jornadasAEliminar = Array.from(checkboxes).map(cb => parseInt(cb.value));
        const nombresFechas = jornadasAEliminar.map(id => {
            const jornada = this.jornadas.find(j => j.id === id);
            return this.formatearFecha(jornada.fechaLunes);
        });
        
        const confirmacion = confirm(
            `¿Estás seguro de que quieres eliminar ${jornadasAEliminar.length} jornada(s)?\n\n` +
            `Se eliminarán:\n${nombresFechas.join('\n')}\n\n` +
            `Esto también actualizará las estadísticas de las jugadoras.`
        );
        
        if (!confirmacion) return;
        
        // Eliminar jornadas y actualizar estadísticas
        jornadasAEliminar.forEach(jornadaId => {
            this.eliminarJornada(jornadaId, false); // false = no mostrar confirmación individual
        });
        
        // Recalcular todas las estadísticas después de eliminar múltiples jornadas
        this.recalcularEstadisticasCompletas();
        
        // NO mostrar alert de confirmación - solo actualizar la vista
        this.actualizarListaHistorial();
    }

    async eliminarJornada(jornadaId, mostrarConfirmacion = true) {
        if (mostrarConfirmacion) {
            const jornada = this.jornadas.find(j => j.id === jornadaId);
            if (!jornada) return;
            
            const confirmacion = confirm(
                `¿Eliminar la jornada del ${this.formatearFecha(jornada.fechaLunes)}?\n\n` +
                `Se actualizarán las estadísticas de las jugadoras.`
            );
            
            if (!confirmacion) return;
        }
        
        // Si es la jornada actual en edición, limpiar completamente
        if (this.jornadaActual && this.jornadaActual.id === jornadaId) {
            this.jornadaActual = null;
            this.planificacionSets = {
                set1: [],
                set2: [],
                set3: []
            };
            
            // Ocultar el planificador
            const planificadorContainer = document.getElementById('planificadorSets');
            if (planificadorContainer) {
                planificadorContainer.style.display = 'none';
                planificadorContainer.innerHTML = '';
            }
            
            // Ocultar la vista de jornada actual
            const jornadaActualDiv = document.getElementById('jornadaActual');
            if (jornadaActualDiv) {
                jornadaActualDiv.style.display = 'none';
            }
            
            // Resetear el paso actual
            this.pasoActual = null;
        }
        
        // Si es la jornada pendiente del banner, limpiar el banner
        if (this.jornadaPendienteId === jornadaId) {
            this.jornadaPendienteId = null;
            const banner = document.getElementById('bannerJornadaPendiente');
            if (banner) {
                banner.style.display = 'none';
            }
        }
        
        // Eliminar la jornada
        this.jornadas = this.jornadas.filter(j => j.id !== jornadaId);
        
        // Guardar de forma SÍNCRONA para asegurar que MongoDB se actualice
        await this.guardarJornadasSync();
        
        if (mostrarConfirmacion) {
            this.recalcularEstadisticasCompletas();
            this.actualizarListaHistorial();
        }
    }

    recalcularEstadisticasCompletas() {
        console.log('🔄 Recalculando estadísticas completas...');
        
        // Resetear estadísticas de todas las jugadoras
        this.jugadoras.forEach(jugadora => {
            jugadora.partidosJugados = 0;
            jugadora.entrenamientosAsistidos = 0;
            jugadora.puntosJugados = 0;
        });
        
        // Recalcular desde todas las jornadas restantes (SOLO COMPLETADAS)
        this.jornadas.forEach(jornada => {
            // Solo procesar jornadas completadas
            if (!jornada.completada) return;
            
            // Entrenamientos Lunes
            if (jornada.asistenciaLunes) {
                jornada.asistenciaLunes.forEach(jugadoraId => {
                    const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
                    if (jugadora) {
                        jugadora.entrenamientosAsistidos = (jugadora.entrenamientosAsistidos || 0) + 1;
                    }
                });
            }
            
            // Entrenamientos Miércoles
            if (jornada.asistenciaMiercoles) {
                jornada.asistenciaMiercoles.forEach(jugadoraId => {
                    const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
                    if (jugadora) {
                        jugadora.entrenamientosAsistidos = (jugadora.entrenamientosAsistidos || 0) + 1;
                    }
                });
            }
            
            // Partidos y puntos (solo jornadas completadas)
            if (jornada.asistenciaSabado) {
                jornada.asistenciaSabado.forEach(jugadoraId => {
                    const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
                    if (jugadora) {
                        jugadora.partidosJugados = (jugadora.partidosJugados || 0) + 1;
                        
                        // Calcular puntos basado en sets jugados
                        let puntos = 0;
                        if (jornada.planificacionManual) {
                            if (jornada.planificacionManual.set1?.some(j => j.id === jugadoraId)) {
                                puntos += parseInt(jornada.puntosSet1) || 25;
                            }
                            if (jornada.planificacionManual.set2?.some(j => j.id === jugadoraId)) {
                                puntos += parseInt(jornada.puntosSet2) || 25;
                            }
                        }
                        jugadora.puntosJugados = (jugadora.puntosJugados || 0) + puntos;
                    }
                });
            }
        });
        
        this.guardarJugadoras();
        console.log('✅ Estadísticas recalculadas');
    }

    borrarHistorial() {
        if (confirm('⚠️ ¿Borrar todo el historial? Esta acción no se puede deshacer.')) {
            localStorage.removeItem('volleyball_jornadas');
            this.jornadas = [];
            this.actualizarHistorial();
            alert('Historial borrado');
        }
    }

    // ==================== BANNER JORNADA PENDIENTE ====================
    mostrarBannerJornadaPendiente() {
        const jornadaPendiente = this.jornadas.find(j => !j.completada);
        const banner = document.getElementById('bannerJornadaPendiente');
        const bannerTexto = banner.querySelector('.banner-texto');
        
        if (jornadaPendiente) {
            const fechaMostrar = jornadaPendiente.fechaSeleccionada || jornadaPendiente.fechaLunes;
            bannerTexto.textContent = `Tienes una jornada pendiente: Semana del ${this.formatearFecha(fechaMostrar)}`;
            banner.style.display = 'block';
            document.body.classList.add('banner-activo');
            
            // Guardar la jornada pendiente para uso posterior
            this.jornadaPendienteId = jornadaPendiente.id;
        } else {
            this.ocultarBanner();
        }
    }
    
    continuarDesdeBanner() {
        if (this.jornadaPendienteId) {
            this.continuarEditandoJornada(this.jornadaPendienteId);
            this.ocultarBanner();
        }
    }
    
    eliminarBorradorDesdeBanner() {
        if (this.jornadaPendienteId) {
            if (confirm('¿Estás seguro de eliminar esta jornada borrador?')) {
                this.eliminarJornada(this.jornadaPendienteId);
                this.ocultarBanner();
            }
        }
    }
    
    cerrarBanner() {
        this.ocultarBanner();
    }
    
    ocultarBanner() {
        const banner = document.getElementById('bannerJornadaPendiente');
        banner.style.display = 'none';
        document.body.classList.remove('banner-activo');
        this.jornadaPendienteId = null;
    }
}

// ==================== FUNCIONES GLOBALES ====================
function verInfoJugadoraGlobal(jugadoraId) {
    const jugadora = app.jugadoras.find(j => j.id === jugadoraId);
    if (!jugadora) {
        alert('Jugadora no encontrada');
        return;
    }
    
    // Posición con formato inclusivo
    let posicionTexto;
    if (jugadora.posicion === 'colocadora') {
        posicionTexto = '🎯 Colocador/a';
    } else if (jugadora.posicion === 'central') {
        posicionTexto = '🛡️ Central';
    } else {
        posicionTexto = '🏐 Jugador/a';
    }

    // Calcular sustituciones totales (tanto si entra como si sale) - SOLO DE JORNADAS COMPLETADAS
    let totalSustituciones = 0;
    app.jornadas.forEach(jornada => {
        // Solo contar sustituciones de jornadas completadas
        if (jornada.completada && jornada.sustituciones) {
            // Contar en set1
            if (jornada.sustituciones.set1) {
                totalSustituciones += jornada.sustituciones.set1.filter(s => 
                    s.entraId === jugadoraId || s.saleId === jugadoraId
                ).length;
            }
            // Contar en set2
            if (jornada.sustituciones.set2) {
                totalSustituciones += jornada.sustituciones.set2.filter(s => 
                    s.entraId === jugadoraId || s.saleId === jugadoraId
                ).length;
            }
        }
    });

    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%;">
            <div style="background: #007bff; color: white; margin: -30px -30px 20px -30px; padding: 20px; border-radius: 15px 15px 0 0;">
                <h3 style="margin: 0; text-align: center;">📊 ${jugadora.nombre} #${jugadora.dorsal}</h3>
            </div>
            
            <div style="margin-bottom: 20px;">
                <p><strong>Posición:</strong> ${posicionTexto}</p>
                <p><strong>Partidos Jugados:</strong> ${jugadora.partidosJugados || 0}</p>
                <p><strong>Sustituciones:</strong> ${totalSustituciones}</p>
                <p><strong>Puntos Totales:</strong> ${jugadora.puntosJugados || 0}</p>
                <p><strong>Entrenamientos:</strong> ${jugadora.entrenamientosAsistidos || 0}</p>
            </div>
            
            <div style="text-align: center;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                        style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });

    document.body.appendChild(modal);
}

// ==================== EXPORTACIÓN DE DATOS ====================
VolleyballManager.prototype.exportarDatos = function() {
    try {
        console.log('📥 Iniciando exportación de datos...');
        
        // Preparar datos de jugadoras con estadísticas
        const jugadorasData = this.jugadoras.map(jugadora => {
            // Calcular estadísticas solo de jornadas completadas
            const jornadasCompletadas = this.jornadas.filter(j => j.completada);
            
            let partidosJugados = 0;
            let entrenamientosAsistidos = 0;
            let totalSustituciones = 0;
            
            jornadasCompletadas.forEach(jornada => {
                // Contar partidos jugados (si estuvo en el sábado)
                if (jornada.asistenciaSabado && jornada.asistenciaSabado.includes(jugadora.id)) {
                    partidosJugados++;
                }
                
                // Contar entrenamientos
                if (jornada.asistenciaLunes && jornada.asistenciaLunes.includes(jugadora.id)) {
                    entrenamientosAsistidos++;
                }
                if (jornada.asistenciaMiercoles && jornada.asistenciaMiercoles.includes(jugadora.id)) {
                    entrenamientosAsistidos++;
                }
                
                // Contar sustituciones
                if (jornada.sustituciones) {
                    if (jornada.sustituciones.set1) {
                        totalSustituciones += jornada.sustituciones.set1.filter(s => 
                            s.entraId === jugadora.id || s.saleId === jugadora.id
                        ).length;
                    }
                    if (jornada.sustituciones.set2) {
                        totalSustituciones += jornada.sustituciones.set2.filter(s => 
                            s.entraId === jugadora.id || s.saleId === jugadora.id
                        ).length;
                    }
                }
            });
            
            return {
                id: jugadora.id,
                nombre: jugadora.nombre,
                dorsal: jugadora.dorsal,
                posicion: jugadora.posicion,
                partidosJugados: partidosJugados,
                entrenamientosAsistidos: entrenamientosAsistidos,
                totalSustituciones: totalSustituciones,
                puntosJugados: jugadora.puntosJugados || 0,
                porcentajeAsistenciaPartidos: jornadasCompletadas.length > 0 ? ((partidosJugados / jornadasCompletadas.length) * 100).toFixed(1) : 0
            };
        });
        
        // Preparar datos de jornadas completadas
        const jornadasData = this.jornadas.filter(j => j.completada).map(jornada => {
            return {
                id: jornada.id,
                fechaLunes: jornada.fechaLunes,
                asistenciaLunes: jornada.asistenciaLunes?.map(id => {
                    const jugadora = this.jugadoras.find(j => j.id === id);
                    return jugadora ? `${jugadora.nombre} (#${jugadora.dorsal})` : `ID: ${id}`;
                }) || [],
                asistenciaMiercoles: jornada.asistenciaMiercoles?.map(id => {
                    const jugadora = this.jugadoras.find(j => j.id === id);
                    return jugadora ? `${jugadora.nombre} (#${jugadora.dorsal})` : `ID: ${id}`;
                }) || [],
                asistenciaSabado: jornada.asistenciaSabado?.map(id => {
                    const jugadora = this.jugadoras.find(j => j.id === id);
                    return jugadora ? `${jugadora.nombre} (#${jugadora.dorsal})` : `ID: ${id}`;
                }) || [],
                sets: jornada.sets || {},
                sustituciones: jornada.sustituciones || {},
                resultado: jornada.resultado || 'No registrado'
            };
        });
        
        // Crear objeto final de exportación
        const dataExportacion = {
            fechaExportacion: new Date().toISOString(),
            version: '1.0',
            equipo: {
                jugadoras: jugadorasData,
                totalJugadoras: jugadorasData.length
            },
            jornadas: {
                completadas: jornadasData,
                totalCompletadas: jornadasData.length,
                totalEnSistema: this.jornadas.length
            },
            resumen: {
                jornadasCompletadas: jornadasData.length,
                jornadasPendientes: this.jornadas.filter(j => !j.completada).length,
                jugadorasActivas: jugadorasData.length,
                fechaUltimaJornada: jornadasData.length > 0 ? jornadasData[jornadasData.length - 1].fechaLunes : null
            }
        };
        
        // Mostrar modal de confirmación antes de descargar
        this.mostrarModalExportacion(dataExportacion, () => {
            // Crear y descargar archivo JSON
            const dataStr = JSON.stringify(dataExportacion, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `volleyball_data_${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
            console.log('✅ Datos exportados correctamente');
            alert('✅ Datos exportados correctamente. El archivo se ha descargado.');
        });
        
    } catch (error) {
        console.error('❌ Error al exportar datos:', error);
        alert('❌ Error al exportar datos. Revisa la consola para más detalles.');
    }
};

VolleyballManager.prototype.mostrarModalExportacion = function(data, onConfirm) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="background: #17a2b8; color: white; margin: -30px -30px 20px -30px; padding: 20px; border-radius: 15px 15px 0 0;">
                <h3 style="margin: 0; text-align: center;">📥 Exportar Datos del Sistema</h3>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4>📊 Resumen de datos a exportar:</h4>
                <ul style="line-height: 1.6;">
                    <li><strong>Jugadoras:</strong> ${data.equipo.totalJugadoras} (con estadísticas completas)</li>
                    <li><strong>Jornadas completadas:</strong> ${data.jornadas.totalCompletadas}</li>
                    <li><strong>Fecha de exportación:</strong> ${new Date(data.fechaExportacion).toLocaleString()}</li>
                    <li><strong>Última jornada:</strong> ${data.resumen.fechaUltimaJornada ? this.formatearFecha(data.resumen.fechaUltimaJornada) : 'Ninguna'}</li>
                </ul>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h5 style="margin: 0 0 10px 0; color: #495057;">💡 Información importante:</h5>
                    <p style="margin: 0; font-size: 0.9rem; color: #6c757d;">
                        • Los datos se exportarán en formato JSON<br>
                        • Solo se incluyen jornadas completadas<br>
                        • Las estadísticas se calculan automáticamente<br>
                        • El archivo será compatible para futuras importaciones
                    </p>
                </div>
            </div>
            
            <div style="text-align: center; display: flex; gap: 10px; justify-content: center;">
                <button id="cancelarExportacion" 
                        style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem;">
                    ❌ Cancelar
                </button>
                <button id="confirmarExportacion"
                        style="background: #17a2b8; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem;">
                    📥 Exportar Datos
                </button>
            </div>
        </div>
    `;

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    modal.querySelector('#cancelarExportacion').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('#confirmarExportacion').addEventListener('click', () => {
        modal.remove();
        onConfirm();
    });

    document.body.appendChild(modal);
};

// ==================== IMPORTACIÓN DE DATOS ====================
VolleyballManager.prototype.importarDatos = function() {
    const input = document.getElementById('archivoImportar');
    input.click();
};

VolleyballManager.prototype.procesarArchivoImportacion = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json') {
        alert('❌ Por favor selecciona un archivo JSON válido.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            this.validarYImportarDatos(data);
        } catch (error) {
            console.error('❌ Error al leer archivo JSON:', error);
            alert('❌ Error: El archivo no tiene un formato JSON válido.');
        }
    };
    reader.readAsText(file);
};

VolleyballManager.prototype.validarYImportarDatos = function(data) {
    try {
        // Validar estructura básica
        if (!data.equipo || !data.jornadas || !data.version) {
            throw new Error('Estructura de datos inválida');
        }

        // Mostrar modal de confirmación
        this.mostrarModalImportacion(data, () => {
            this.ejecutarImportacion(data);
        });

    } catch (error) {
        console.error('❌ Error al validar datos:', error);
        alert('❌ Error: El archivo no tiene el formato esperado para esta aplicación.');
    }
};

VolleyballManager.prototype.mostrarModalImportacion = function(data, onConfirm) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;

    const fechaExportacion = data.fechaExportacion ? new Date(data.fechaExportacion).toLocaleString() : 'Desconocida';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="background: #28a745; color: white; margin: -30px -30px 20px -30px; padding: 20px; border-radius: 15px 15px 0 0;">
                <h3 style="margin: 0; text-align: center;">📤 Importar Datos</h3>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4>📊 Datos encontrados en el archivo:</h4>
                <ul style="line-height: 1.6;">
                    <li><strong>Jugadoras:</strong> ${data.equipo.totalJugadoras || 0}</li>
                    <li><strong>Jornadas completadas:</strong> ${data.jornadas.totalCompletadas || 0}</li>
                    <li><strong>Fecha de exportación:</strong> ${fechaExportacion}</li>
                    <li><strong>Versión:</strong> ${data.version}</li>
                </ul>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h5 style="margin: 0 0 10px 0; color: #856404;">⚠️ Advertencia importante:</h5>
                    <p style="margin: 0; font-size: 0.9rem; color: #856404;">
                        • Esta acción REEMPLAZARÁ todos los datos actuales<br>
                        • Se perderán las jugadoras y jornadas existentes<br>
                        • Esta acción no se puede deshacer<br>
                        • Asegúrate de haber exportado tus datos actuales
                    </p>
                </div>
            </div>
            
            <div style="text-align: center; display: flex; gap: 10px; justify-content: center;">
                <button id="cancelarImportacion" 
                        style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem;">
                    ❌ Cancelar
                </button>
                <button id="confirmarImportacion"
                        style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem;">
                    📤 Importar Datos
                </button>
            </div>
        </div>
    `;

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    modal.querySelector('#cancelarImportacion').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('#confirmarImportacion').addEventListener('click', () => {
        modal.remove();
        onConfirm();
    });

    document.body.appendChild(modal);
};

VolleyballManager.prototype.ejecutarImportacion = function(data) {
    try {
        console.log('📤 Iniciando importación de datos...');
        
        // Limpiar datos actuales
        this.jugadoras = [];
        this.jornadas = [];
        
        // Importar jugadoras
        if (data.equipo && data.equipo.jugadoras) {
            this.jugadoras = data.equipo.jugadoras.map(j => ({
                id: j.id,
                nombre: j.nombre,
                dorsal: j.dorsal,
                posicion: j.posicion,
                partidosJugados: j.partidosJugados || 0,
                entrenamientosAsistidos: j.entrenamientosAsistidos || 0,
                puntosJugados: j.puntosJugados || 0
            }));
        }
        
        // Importar jornadas
        if (data.jornadas && data.jornadas.completadas) {
            this.jornadas = data.jornadas.completadas.map(j => ({
                id: j.id,
                fechaLunes: j.fechaLunes,
                asistenciaLunes: j.asistenciaLunes?.map(nombre => {
                    // Convertir nombres de vuelta a IDs
                    const jugadora = this.jugadoras.find(jug => 
                        nombre.includes(jug.nombre) && nombre.includes(`#${jug.dorsal}`)
                    );
                    return jugadora ? jugadora.id : null;
                }).filter(id => id !== null) || [],
                asistenciaMiercoles: j.asistenciaMiercoles?.map(nombre => {
                    const jugadora = this.jugadoras.find(jug => 
                        nombre.includes(jug.nombre) && nombre.includes(`#${jug.dorsal}`)
                    );
                    return jugadora ? jugadora.id : null;
                }).filter(id => id !== null) || [],
                asistenciaSabado: j.asistenciaSabado?.map(nombre => {
                    const jugadora = this.jugadoras.find(jug => 
                        nombre.includes(jug.nombre) && nombre.includes(`#${jug.dorsal}`)
                    );
                    return jugadora ? jugadora.id : null;
                }).filter(id => id !== null) || [],
                sets: j.sets || {},
                sustituciones: j.sustituciones || {},
                resultado: j.resultado || 'No registrado',
                completada: true
            }));
        }
        
        // Guardar en localStorage
        this.guardarJugadoras();
        this.guardarJornadas();
        
        console.log('✅ Datos guardados en localStorage');
        console.log('👥 Jugadoras importadas:', this.jugadoras.length);
        console.log('📋 Jornadas importadas:', this.jornadas.length);
        
        // Actualizar interfaz
        this.actualizarEquipo();
        this.actualizarListaHistorial();
        this.actualizarListaJornadas();
        
        // Ir a la pestaña de historial para ver los datos importados
        this.cambiarTab('historial');
        
        console.log('✅ Importación completada correctamente');
        alert(`✅ Datos importados correctamente!\n\n📊 Resumen:\n• ${this.jugadoras.length} jugadoras\n• ${this.jornadas.length} jornadas\n\nPuedes verlos en la pestaña Historial.`);
        
    } catch (error) {
        console.error('❌ Error durante la importación:', error);
        alert('❌ Error durante la importación. Es posible que algunos datos no se hayan importado correctamente.');
    }
};

// ==================== FUNCIONES DE TEST ====================
function testFormularioJugadora() {
    console.log('🧪 === TEST FORMULARIO JUGADORA ===');
    
    // Test 1: Verificar que el botón existe
    const btnAdd = document.getElementById('addJugadora');
    console.log('1. Botón addJugadora existe:', !!btnAdd);
    
    // Test 2: Verificar que el formulario existe
    const form = document.getElementById('formJugadora');
    console.log('2. Formulario existe:', !!form);
    
    // Test 3: Verificar campos del formulario
    const nombre = document.getElementById('nombreJugadora');
    const dorsal = document.getElementById('dorsalJugadora');
    const posicion = document.getElementById('posicionJugadora');
    const btnGuardar = document.getElementById('guardarJugadora');
    const btnCancelar = document.getElementById('cancelarJugadora');
    
    console.log('3. Campos del formulario:');
    console.log('   - Nombre:', !!nombre);
    console.log('   - Dorsal:', !!dorsal);
    console.log('   - Posición:', !!posicion);
    console.log('   - Btn Guardar:', !!btnGuardar);
    console.log('   - Btn Cancelar:', !!btnCancelar);
    
    // Test 4: Simular click en addJugadora
    if (btnAdd) {
        console.log('4. Simulando click en addJugadora...');
        btnAdd.click();
        setTimeout(() => {
            console.log('   - Formulario visible después del click:', form.style.display !== 'none');
        }, 100);
    }
    
    console.log('🧪 === FIN TEST ===');
}

// Función para forzar la configuración del formulario
function repararFormulario() {
    console.log('🔧 === REPARANDO FORMULARIO ===');
    
    if (window.app) {
        // Ir a la pestaña Equipo
        app.cambiarTab('jugadoras');
        
        // Re-configurar event listeners
        setTimeout(() => {
            app.configurarEventListenersEquipo();
            console.log('✅ Formulario reparado');
        }, 200);
    } else {
        console.error('❌ App no encontrada');
    }
}

// Hacer disponible globalmente para testing
window.testFormularioJugadora = testFormularioJugadora;
window.repararFormulario = repararFormulario;

// ==================== INICIALIZACIÓN ====================
let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏐 Iniciando sistema de voleibol...');
    
    // CERRAR TODOS LOS MODALES AL CARGAR
    setTimeout(() => closeAllModals(), 100);
    
    // ==================== PROTECCIÓN DE AUTENTICACIÓN ====================
    // Verificar autenticación antes de inicializar la app
    if (!Auth.requireAuth()) {
        console.log('❌ Usuario no autenticado - redirigiendo a login');
        return; // Sale de la función si no está autenticado
    }
    
    console.log('✅ Usuario autenticado:', Auth.getCurrentUser());
    
    try {
        app = new VolleyballManager();
        window.app = app; // Para debugging
        console.log('✅ Sistema iniciado correctamente');
        
        // CERRAR MODALES NUEVAMENTE DESPUÉS DE CARGAR
        setTimeout(() => closeAllModals(), 500);
        
        // Test directo del botón después de la inicialización
        setTimeout(() => {
            const btnAdd = document.getElementById('addJugadora');
            console.log('🔍 Test botón addJugadora:', !!btnAdd);
            if (btnAdd) {
                console.log('🎯 Botón encontrado, event listeners configurados');
            } else {
                console.error('❌ Botón addJugadora NO encontrado');
            }
        }, 100);
    } catch (error) {
        console.error('❌ Error al iniciar el sistema:', error);
    }
});

// ==================== FUNCIONES DE ADMINISTRACIÓN ====================

function initializeAdminPanel() {
    console.log('🔧 Inicializando panel de admin');
    
    // CERRAR TODOS LOS MODALES PRIMERO
    closeAllModals();
    
    // Configurar eventos del panel de administración
    setupAdminEvents();
    // Inicializar editor de usuarios del sistema
    initSystemUsersEditor();
    
    console.log('✅ Panel de admin inicializado');
}

function setupAdminEvents() {
    // Logout
    // Botón logout en admin panel
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                logout(); // Función global de logout
            }
        });
    }

    // Botones de sistema
    document.getElementById('backup-data-btn').addEventListener('click', backupSystemData);
    document.getElementById('clear-data-btn').addEventListener('click', clearSystemData);
    document.getElementById('reset-users-btn').addEventListener('click', resetUsers);

    // Modal de confirmación
    document.getElementById('confirm-no').addEventListener('click', function() {
        document.getElementById('confirm-modal').style.display = 'none';
    });

    // Cerrar modal al hacer clic fuera
    document.getElementById('confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
        }
    });
}

function createNewUser() {
    const username = document.getElementById('new-username').value.trim();
    const name = document.getElementById('new-name').value.trim();
    const password = document.getElementById('new-password').value;
    const isAdmin = document.getElementById('new-is-admin').value === 'true';

    const result = Auth.createUser(username, password, name, isAdmin);
    
    if (result.success) {
        showNotification('✅ ' + result.message, 'success');
        // Limpiar formulario
        document.getElementById('create-user-form').reset();
        // Recargar lista
        loadUsersList();
    } else {
        showNotification('❌ ' + result.message, 'error');
    }
}

function loadUsersList() {
    const result = Auth.listUsers();
    
    if (!result.success) {
        showNotification('❌ ' + result.message, 'error');
        return;
    }

    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    if (result.users.length === 0) {
        usersList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No hay usuarios registrados</p>';
        return;
    }

    result.users.forEach(user => {
        const userElement = createUserElement(user);
        usersList.appendChild(userElement);
    });
}

function createUserElement(user) {
    const userDiv = document.createElement('div');
    userDiv.className = 'user-item';
    
    const lastLogin = user.lastLogin 
        ? new Date(user.lastLogin).toLocaleDateString() 
        : 'Nunca';
    
    userDiv.innerHTML = `
        <div class="user-info">
            <div class="user-username">${escapeHtml(user.username)}</div>
            <div class="user-name">${escapeHtml(user.name)}</div>
            <div class="user-badge ${user.isAdmin ? 'admin' : 'user'}">
                ${user.isAdmin ? '👑 Administrador' : '👤 Usuario'}
            </div>
            <small style="color: #7f8c8d;">Último acceso: ${lastLogin}</small>
        </div>
        <div class="user-actions">
            <button class="btn-user-action btn-edit-user" data-username="${user.username}" onclick="openEditUserModalSafe(this)">
                ✏️ Editar Usuario
            </button>
            <button class="btn-user-action btn-delete-user" 
                    data-username="${user.username}" onclick="confirmDeleteUserSafe(this)"
                    ${user.username === 'admin' ? 'disabled title="No se puede eliminar el usuario admin"' : ''}>
                🗑️ Eliminar
            </button>
        </div>
    `;
    
    return userDiv;
}

// Funciones seguras que usan data attributes
function openEditUserModalSafe(button) {
    const username = button.getAttribute('data-username');
    openEditUserModal(username);
}

function confirmDeleteUserSafe(button) {
    const username = button.getAttribute('data-username');
    confirmDeleteUser(username);
}

function openEditUserModal(username) {
    console.log('🔍 Abriendo modal para usuario:', username);
    
    // Función helper para convertir objeto a array
    function objectToUserArray(userObj) {
        if (Array.isArray(userObj)) {
            return userObj; // Ya es array
        }
        if (typeof userObj === 'object' && userObj !== null) {
            // Convertir objeto {username: userData} a array [{username, ...userData}]
            return Object.keys(userObj).map(username => ({
                username: username,
                ...userObj[username]
            }));
        }
        return [];
    }
    
    // Intentar diferentes fuentes de usuarios
    let users = [];
    
    try {
        // Intentar Auth.getUsers() primero
        const authUsers = Auth.getUsers();
        const authArray = objectToUserArray(authUsers);
        
        if (authArray.length > 0) {
            users = authArray;
            console.log('👥 Usuarios de Auth.getUsers() (convertido):', users.map(u => u.username));
        } else {
            throw new Error('Auth.getUsers() no devolvió datos válidos');
        }
    } catch (e) {
        console.warn('⚠️ Auth.getUsers() falló, usando localStorage directo:', e.message);
        
        // Fallback a localStorage directo
        const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
        const systemUsers = JSON.parse(localStorage.getItem('system_users') || '{}');
        
        // Convertir y usar el que tenga datos
        const localArray = objectToUserArray(localUsers);
        const systemArray = objectToUserArray(systemUsers);
        
        if (localArray.length > 0) {
            users = localArray;
            console.log('👥 Usuarios de localStorage "users":', users.map(u => u.username));
        } else if (systemArray.length > 0) {
            users = systemArray;
            console.log('👥 Usuarios de localStorage "system_users":', users.map(u => u.username));
        } else {
            console.error('❌ No se encontraron usuarios en ningún lado');
            showNotification('❌ No se encontraron usuarios registrados', 'error');
            return;
        }
    }
    
    const user = users.find(u => u.username === username);
    
    if (!user) {
        console.error('❌ Usuario no encontrado:', username);
        console.log('📋 Lista completa de usuarios:', users);
        showNotification(`❌ Usuario "${username}" no encontrado`, 'error');
        return;
    }
    
    console.log('✅ Usuario encontrado:', user);
    
    // Llenar el formulario con los datos actuales
    document.getElementById('edit-user-username').value = user.username;
    document.getElementById('edit-user-name').value = user.name || '';
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-type').value = user.isAdmin ? 'true' : 'false';
    
    // Guardar username original para la edición
    document.getElementById('edit-user-modal').setAttribute('data-original-username', username);
    
    // Mostrar modal
    document.getElementById('edit-user-modal').style.display = 'flex';
}

function editUser() {
    const originalUsername = document.getElementById('edit-user-modal').getAttribute('data-original-username');
    const newUsername = document.getElementById('edit-user-username').value.trim();
    const newName = document.getElementById('edit-user-name').value.trim();
    const newPassword = document.getElementById('edit-user-password').value;
    const isAdmin = document.getElementById('edit-user-type').value === 'true';

    if (!newUsername || !newName) {
        showNotification('❌ El usuario y nombre son obligatorios', 'error');
        return;
    }

    if (newPassword && newPassword.length < 4) {
        showNotification('❌ La contraseña debe tener al menos 4 caracteres', 'error');
        return;
    }

    // Función helper para convertir objeto a array (reutilizable)
    function objectToUserArray(userObj) {
        if (Array.isArray(userObj)) {
            return userObj; // Ya es array
        }
        if (typeof userObj === 'object' && userObj !== null) {
            // Convertir objeto {username: userData} a array [{username, ...userData}]
            return Object.keys(userObj).map(username => ({
                username: username,
                ...userObj[username]
            }));
        }
        return [];
    }
    
    // Función helper para convertir array a objeto
    function userArrayToObject(userArray) {
        const obj = {};
        userArray.forEach(user => {
            const {username, ...userData} = user;
            obj[username] = userData;
        });
        return obj;
    }
    
    // Obtener usuarios de forma segura
    let users = [];
    let storageKey = 'users'; // Por defecto
    let useObjectFormat = false; // Si necesitamos guardar como objeto
    
    try {
        const authUsers = Auth.getUsers();
        users = objectToUserArray(authUsers);
        
        if (users.length === 0) {
            throw new Error('Auth.getUsers() no devolvió datos válidos');
        }
        
        // Detectar formato basándose en lo que existe en localStorage
        if (localStorage.getItem('system_users')) {
            storageKey = 'system_users';
            useObjectFormat = true; // system_users usa formato objeto
        }
        
    } catch (e) {
        console.warn('⚠️ Usando localStorage directo para editUser');
        
        const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
        const systemUsers = JSON.parse(localStorage.getItem('system_users') || '{}');
        
        const localArray = objectToUserArray(localUsers);
        const systemArray = objectToUserArray(systemUsers);
        
        if (localArray.length > 0) {
            users = localArray;
            storageKey = 'users';
            useObjectFormat = false;
        } else if (systemArray.length > 0) {
            users = systemArray;
            storageKey = 'system_users';
            useObjectFormat = true;
        }
    }
    
    const userIndex = users.findIndex(u => u.username === originalUsername);
    
    if (userIndex === -1) {
        showNotification('❌ Usuario no encontrado', 'error');
        return;
    }

    // Verificar si el nuevo username ya existe (excepto el usuario actual)
    const existingUser = users.find(u => u.username === newUsername && u.username !== originalUsername);
    if (existingUser) {
        showNotification('❌ Ya existe un usuario con ese nombre', 'error');
        return;
    }

    // Actualizar usuario
    const user = users[userIndex];
    user.username = newUsername;
    user.name = newName;
    user.isAdmin = isAdmin;
    
    // Solo cambiar contraseña si se proporcionó una nueva
    if (newPassword) {
        user.password = newPassword;
    }

    // Guardar cambios en el formato correcto
    const dataToSave = useObjectFormat ? userArrayToObject(users) : users;
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    console.log(`💾 Usuarios guardados en localStorage["${storageKey}"] formato:`, useObjectFormat ? 'objeto' : 'array');
    
    // Si se cambió el username del usuario logueado, actualizar la sesión
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser.username === originalUsername) {
        currentUser.username = newUsername;
        currentUser.name = newName;
        currentUser.isAdmin = isAdmin;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateCurrentUserInfo();
    }

    showNotification('✅ Usuario actualizado correctamente', 'success');
    document.getElementById('edit-user-modal').style.display = 'none';
    loadUsersList();
}

function changeUserPassword() {
    const username = document.getElementById('change-password-user').value;
    const newPassword = document.getElementById('change-password-new').value;

    const result = Auth.changePassword(username, newPassword);
    
    if (result.success) {
        showNotification('✅ ' + result.message, 'success');
        document.getElementById('change-password-modal').style.display = 'none';
    } else {
        showNotification('❌ ' + result.message, 'error');
    }
}

function confirmDeleteUser(username) {
    showConfirmModal(
        '⚠️ Confirmar Eliminación',
        `¿Estás seguro de que quieres eliminar al usuario "${username}"?\n\nEsta acción no se puede deshacer.`,
        () => deleteUser(username)
    );
}

function deleteUser(username) {
    const result = Auth.deleteUser(username);
    
    if (result.success) {
        showNotification('✅ ' + result.message, 'success');
        loadUsersList();
    } else {
        showNotification('❌ ' + result.message, 'error');
    }
}

function backupSystemData() {
    try {
        // Obtener todos los datos del sistema
        const systemData = {
            users: Auth.getUsers(),
            jornadas: obtenerJornadas(),
            jugadoras: obtenerJugadoras(),
            configuracion: obtenerConfiguracion(),
            timestamp: new Date().toISOString(),
            version: '1.0'
        };

        // Crear archivo de respaldo
        const dataStr = JSON.stringify(systemData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        // Descargar archivo
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `voleibol-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        showNotification('✅ Respaldo creado exitosamente', 'success');
    } catch (error) {
        console.error('Error al crear respaldo:', error);
        showNotification('❌ Error al crear respaldo', 'error');
    }
}

function clearSystemData() {
    showConfirmModal(
        '⚠️ Limpiar Datos del Sistema',
        '¿Estás seguro de que quieres eliminar TODOS los datos del sistema?\n\n• Jornadas\n• Entrenamientos\n• Configuración\n• Historial\n\nLos usuarios NO se eliminarán.\n\nEsta acción NO se puede deshacer.',
        () => {
            try {
                // Limpiar datos pero mantener usuarios
                localStorage.removeItem('jornadas');
                localStorage.removeItem('jugadoras');
                localStorage.removeItem('configuracion');
                localStorage.removeItem('equipos');
                localStorage.removeItem('entrenamientos');
                
                showNotification('✅ Datos del sistema eliminados', 'success');
                
                // Recargar página para refrescar la interfaz
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } catch (error) {
                console.error('Error al limpiar datos:', error);
                showNotification('❌ Error al limpiar datos', 'error');
            }
        }
    );
}

function resetUsers() {
    showConfirmModal(
        '⚠️ Resetear Usuarios',
        '¿Estás seguro de que quieres ELIMINAR TODOS los usuarios?\n\nSe conservará únicamente:\n• admin / admin\n\nTodos los demás usuarios se perderán.\n\nEsta acción NO se puede deshacer.',
        () => {
            try {
                // Eliminar todos los usuarios excepto admin
                const defaultUsers = {
                    admin: {
                        password: Auth.hashPassword('admin'),
                        name: 'Administrador',
                        isAdmin: true,
                        createdAt: new Date().toISOString(),
                        lastLogin: null
                    }
                };
                
                Auth.saveUsers(defaultUsers);
                showNotification('✅ Usuarios reseteados. Solo queda admin/admin', 'success');
                loadUsersList();
            } catch (error) {
                console.error('Error al resetear usuarios:', error);
                showNotification('❌ Error al resetear usuarios', 'error');
            }
        }
    );
}

function showConfirmModal(title, message, onConfirm) {
    console.log('📋 Mostrando modal:', title);
    
    // Limpiar contenido
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    // Mostrar modal
    document.getElementById('confirm-modal').style.display = 'flex';
    
    // Limpiar eventos anteriores
    const confirmBtn = document.getElementById('confirm-yes');
    const cancelBtn = document.getElementById('confirm-no');
    
    // Clonar botones para limpiar eventos
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // Agregar eventos frescos
    newConfirmBtn.addEventListener('click', function() {
        console.log('✅ Botón confirmar presionado');
        document.getElementById('confirm-modal').style.display = 'none';
        if (onConfirm) {
            try {
                onConfirm();
            } catch(e) {
                console.error('Error en onConfirm:', e);
            }
        }
    });
    
    newCancelBtn.addEventListener('click', function() {
        console.log('❌ Botón cancelar presionado');
        document.getElementById('confirm-modal').style.display = 'none';
    });
}

// FUNCIÓN PARA CERRAR TODOS LOS MODALES
function closeAllModals() {
    console.log('🚪 Cerrando todos los modales');
    
    // Lista de todos los modales
    const modals = [
        'confirm-modal',
        'edit-user-modal',
        'change-password-modal',
        'modalSustitucion'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            console.log(`✅ Modal ${modalId} cerrado`);
        }
    });
}

// FUNCIÓN DE PRUEBA PARA MODALES
window.testModal = function() {
    console.log('🧪 === TESTING MODALES ===');
    
    // Probar modal de confirmación
    showConfirmModal(
        '🧪 Prueba de Modal',
        'Este es un test del nuevo modal de confirmación.\n\n¿Se ve bien?',
        () => {
            console.log('✅ Modal funcionó - botón SÍ');
            showNotification('✅ Modal de confirmación funciona correctamente', 'success');
        }
    );
};

// FUNCIÓN DE DEBUG PARA USUARIOS
window.debugUsers = function() {
    console.log('🔍 === DEBUG USUARIOS COMPLETO ===');
    
    console.log('1. localStorage "users":', JSON.parse(localStorage.getItem('users') || '[]'));
    console.log('2. localStorage "system_users":', JSON.parse(localStorage.getItem('system_users') || '[]'));
    
    try {
        const authUsers = Auth.getUsers();
        console.log('3. Auth.getUsers() resultado:', authUsers);
        console.log('3. Auth.getUsers() es array:', Array.isArray(authUsers));
        console.log('3. Auth.getUsers() tipo:', typeof authUsers);
        console.log('3. Auth.getUsers() length:', authUsers ? authUsers.length : 'N/A');
        if (Array.isArray(authUsers)) {
            console.log('3. Auth users usernames:', authUsers.map(u => u.username));
        }
    } catch (e) {
        console.error('3. Auth.getUsers() ERROR:', e);
    }
    
    console.log('4. currentUser:', JSON.parse(localStorage.getItem('currentUser') || '{}'));
    
    // Verificar todas las claves de localStorage
    console.log('5. Todas las claves de localStorage:');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('user') || key.includes('User')) {
            console.log(`   ${key}:`, JSON.parse(localStorage.getItem(key) || '{}'));
        }
    }
    
    console.log('🔍 === FIN DEBUG ===');
};

// FUNCIÓN DE TESTING RÁPIDO
window.testEditUser = function() {
    console.log('🧪 === TESTING EDITAR USUARIO ===');
    
    // Simular apertura del modal para 'juan'
    try {
        openEditUserModal('juan');
        console.log('✅ openEditUserModal funcionó');
    } catch (e) {
        console.error('❌ Error en openEditUserModal:', e);
    }
};

// FUNCIÓN PARA TESTING DE CREACIÓN DE USUARIO
window.testCreateUser = function() {
    console.log('🧪 === TESTING CREAR USUARIO ===');
    
    // Crear usuario de prueba
    const result = Auth.createUser('test123', 'pass123', 'Usuario Test', false);
    console.log('📋 Resultado:', result);
    
    // Verificar que se guardó
    const users = Auth.getUsers();
    console.log('👥 Usuarios después de crear:', Object.keys(users));
    
    if (users['test123']) {
        console.log('✅ Usuario test123 creado correctamente');
        console.log('📋 Datos del usuario:', users['test123']);
    } else {
        console.error('❌ Usuario test123 NO se encontró después de crear');
    }
};

// FUNCIÓN PARA LOGOUT FORZADO
window.forceLogout = function() {
    console.log('🚪 === LOGOUT FORZADO ===');
    
    // Limpiar todo manualmente
    sessionStorage.clear();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('voleibol_session');
    localStorage.removeItem('voleibol_users');
    
    console.log('✅ Todo limpiado');
    console.log('📋 localStorage después:', Object.keys(localStorage));
    
    // Recargar página
    window.location.reload();
};

// FUNCIÓN PARA VERIFICAR SESIONES
window.debugSession = function() {
    console.log('🔍 === DEBUG SESIONES ===');
    
    console.log('1. sessionStorage voleibol_session:', sessionStorage.getItem('voleibol_session'));
    console.log('2. localStorage voleibol_session:', localStorage.getItem('voleibol_session'));
    console.log('3. localStorage currentUser:', localStorage.getItem('currentUser'));
    console.log('4. localStorage voleibol_users:', localStorage.getItem('voleibol_users'));
    
    console.log('5. Todas las claves localStorage:', Object.keys(localStorage));
    console.log('6. Todas las claves sessionStorage:', Object.keys(sessionStorage));
    
    // Probar función de auth.js
    if (typeof getSessionFromMultipleSources !== 'undefined') {
        console.log('7. getSessionFromMultipleSources():', getSessionFromMultipleSources());
    } else {
        console.log('7. getSessionFromMultipleSources() no disponible');
    }
};

// FUNCIÓN PARA CREAR USUARIO DE TESTING INMEDIATAMENTE
window.createTestUser = function() {
    console.log('🧪 === CREANDO USUARIO DE TESTING ===');
    
    // Crear usuario directamente sin usar el formulario
    const result = Auth.createUser('test123', '1234', 'Usuario Test', false);
    console.log('📋 Resultado creación:', result);
    
    // Verificar inmediatamente
    const users = Auth.getUsers();
    console.log('👥 Usuarios después de crear:', users);
    console.log('🔍 Usuario test123 existe:', !!users['test123']);
    
    if (users['test123']) {
        console.log('✅ Usuario test123 creado correctamente');
        console.log('📋 Datos completos:', users['test123']);
        
        // Probar login inmediatamente
        console.log('🔐 Probando login...');
        console.log('Username: test123, Password: 1234');
    } else {
        console.error('❌ Usuario test123 NO se encontró');
    }
    
    return result;
};

// Función auxiliar para escapar HTML y prevenir XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
    // Validar mensaje
    if (!message || message === 'undefined' || typeof message === 'undefined') {
        console.warn('showNotification: mensaje inválido recibido:', message);
        message = 'Operación completada';
    }
    
    const container = document.getElementById('notifications-container');
    if (!container) {
        console.warn('Contenedor de notificaciones no encontrado');
        return;
    }

    const notification = document.createElement('div');
    notification.style.cssText = `
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 12px 20px;
        margin-bottom: 10px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        max-width: 300px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-in;
        cursor: pointer;
    `;
    
    notification.textContent = String(message); // Asegurar que sea string
    
    // Agregar animación CSS si no existe
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    container.appendChild(notification);
    
    // Remover automáticamente después de 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
    
    // Remover al hacer click
    notification.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    });
}

// ===== GESTIÓN DE USUARIOS PREDEFINIDOS DEL SISTEMA =====
let systemUsersConfig = [];

function initSystemUsersEditor() {
    console.log('🔧 Inicializando editor de usuarios del sistema');
    
    // Event listeners
    document.getElementById('add-system-user-btn').addEventListener('click', addSystemUserRow);
    document.getElementById('save-system-users-btn').addEventListener('click', saveSystemUsersLocally);
    document.getElementById('load-current-users-btn').addEventListener('click', loadCurrentSystemUsers);
    
    // Cargar usuarios actuales por defecto
    loadCurrentSystemUsers();
}

function loadCurrentSystemUsers() {
    console.log('📥 Cargando usuarios actuales del sistema');
    
    // Primero intentar cargar desde MongoDB
    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api'
        : window.location.origin + '/api';
    
    fetch(`${API_URL}/users`)
        .then(response => response.json())
        .then(usersArray => {
            console.log('☁️ Usuarios cargados desde MongoDB:', usersArray.length);
            systemUsersConfig = [];
            
            usersArray.forEach(user => {
                systemUsersConfig.push({
                    username: user.username,
                    password: user.password,
                    name: user.name,
                    isAdmin: user.isAdmin || false
                });
            });
            
            renderSystemUsersEditor();
            showNotification('✅ Usuarios cargados desde la base de datos', 'success');
        })
        .catch(error => {
            console.warn('⚠️ No se pudo cargar desde MongoDB, usando localStorage:', error.message);
            
            // Fallback a localStorage
            const users = Auth.getUsers();
            systemUsersConfig = [];
            
            Object.keys(users).forEach(username => {
                const user = users[username];
                systemUsersConfig.push({
                    username: user.username || username,
                    password: user.password,
                    name: user.name,
                    isAdmin: user.isAdmin
                });
            });
            
            renderSystemUsersEditor();
            showNotification('✅ Usuarios cargados desde localStorage', 'info');
        });
}

function addSystemUserRow() {
    systemUsersConfig.push({
        username: '',
        password: '',
        name: '',
        isAdmin: false
    });
    renderSystemUsersEditor();
}

function removeSystemUserRow(index) {
    systemUsersConfig.splice(index, 1);
    renderSystemUsersEditor();
}

function saveSystemUsersLocally() {
    console.log('💾 Guardando usuarios localmente');
    
    // Validar campos
    const invalid = systemUsersConfig.find(u => !u.username || !u.password || !u.name);
    if (invalid) {
        showNotification('❌ Todos los campos son obligatorios', 'error');
        return;
    }
    
    // Validar duplicados
    const usernames = systemUsersConfig.map(u => u.username);
    const duplicates = usernames.filter((item, index) => usernames.indexOf(item) !== index);
    if (duplicates.length > 0) {
        showNotification(`❌ Usuarios duplicados: ${duplicates.join(', ')}`, 'error');
        return;
    }
    
    // Convertir a objeto
    const usersObject = {};
    systemUsersConfig.forEach(user => {
        usersObject[user.username] = {
            username: user.username,
            password: user.password,
            name: user.name,
            isAdmin: user.isAdmin,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
    });
    
    // Guardar en localStorage
    Auth.saveUsers(usersObject);
    
    console.log('✅ Usuarios guardados:', Object.keys(usersObject));
    showNotification('✅ Usuarios guardados correctamente', 'success');
}

function renderSystemUsersEditor() {
    const container = document.getElementById('system-users-editor');
    
    if (systemUsersConfig.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">No hay usuarios configurados. Haz clic en "Agregar Usuario al Sistema" para comenzar.</p>';
        return;
    }
    
    let html = '<div class="system-users-grid">';
    html += '<style>.system-users-grid { display: flex; flex-direction: column; gap: 15px; }</style>';
    html += '<style>.system-user-row { display: grid; grid-template-columns: 1.5fr 1.5fr 2fr 150px 100px; gap: 10px; align-items: center; padding: 15px; background: #f9f9f9; border-radius: 8px; }</style>';
    html += '<style>.system-user-row input, .system-user-row select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }</style>';
    html += '<style>.system-user-row label { font-size: 11px; color: #666; margin-bottom: 3px; display: block; }</style>';
    
    systemUsersConfig.forEach((user, index) => {
        html += `
            <div class="system-user-row">
                <div>
                    <label>Usuario</label>
                    <input type="text" 
                           class="system-user-username" 
                           data-index="${index}" 
                           value="${user.username}" 
                           placeholder="usuario123"
                           style="width: 100%;">
                </div>
                <div>
                    <label>Contraseña</label>
                    <input type="text" 
                           class="system-user-password" 
                           data-index="${index}" 
                           value="${user.password}" 
                           placeholder="1234"
                           style="width: 100%;">
                </div>
                <div>
                    <label>Nombre Completo</label>
                    <input type="text" 
                           class="system-user-name" 
                           data-index="${index}" 
                           value="${user.name}" 
                           placeholder="Juan Pérez"
                           style="width: 100%;">
                </div>
                <div>
                    <label>Tipo</label>
                    <select class="system-user-admin" data-index="${index}" style="width: 100%;">
                        <option value="false" ${!user.isAdmin ? 'selected' : ''}>Usuario</option>
                        <option value="true" ${user.isAdmin ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <div>
                    <label>&nbsp;</label>
                    <button onclick="removeSystemUserRow(${index})" 
                            class="btn-system btn-danger" 
                            style="width: 100%; padding: 8px;">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Agregar event listeners para actualizar datos
    container.querySelectorAll('.system-user-username').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            systemUsersConfig[index].username = e.target.value.trim();
        });
    });
    
    container.querySelectorAll('.system-user-password').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            systemUsersConfig[index].password = e.target.value;
        });
    });
    
    container.querySelectorAll('.system-user-name').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            systemUsersConfig[index].name = e.target.value.trim();
        });
    });
    
    container.querySelectorAll('.system-user-admin').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            systemUsersConfig[index].isAdmin = e.target.value === 'true';
        });
    });
}

function generateSystemUsersCode() {
    console.log('� Guardando usuarios del sistema');
    
    // Validar que no haya campos vacíos
    const invalid = systemUsersConfig.find(u => !u.username || !u.password || !u.name);
    if (invalid) {
        showNotification('❌ Todos los campos son obligatorios', 'error');
        return;
    }
    
    // Validar que no haya usernames duplicados
    const usernames = systemUsersConfig.map(u => u.username);
    const duplicates = usernames.filter((item, index) => usernames.indexOf(item) !== index);
    if (duplicates.length > 0) {
        showNotification(`❌ Nombres de usuario duplicados: ${duplicates.join(', ')}`, 'error');
        return;
    }
    
    // Convertir array a objeto
    const usersObject = {};
    systemUsersConfig.forEach(user => {
        usersObject[user.username] = {
            username: user.username,
            password: user.password,
            name: user.name,
            isAdmin: user.isAdmin,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
    });
    
    // Guardar directamente en localStorage
    Auth.saveUsers(usersObject);
    
    console.log('✅ Usuarios guardados:', Object.keys(usersObject));
    showNotification('✅ Usuarios guardados. Disponibles inmediatamente sin tocar código.', 'success');
}

function generateGitHubCode() {
    console.log('📝 Generando código para GitHub');
    
    // Validar que no haya campos vacíos
    const invalid = systemUsersConfig.find(u => !u.username || !u.password || !u.name);
    if (invalid) {
        showNotification('❌ Todos los campos son obligatorios', 'error');
        return;
    }
    
    // Validar que no haya usernames duplicados
    const usernames = systemUsersConfig.map(u => u.username);
    const duplicates = usernames.filter((item, index) => usernames.indexOf(item) !== index);
    if (duplicates.length > 0) {
        showNotification(`❌ Nombres de usuario duplicados: ${duplicates.join(', ')}`, 'error');
        return;
    }
    
    // Generar código
    let code = 'const systemUsers = {\n';
    
    systemUsersConfig.forEach((user, index) => {
        code += `    ${user.username}: {\n`;
        code += `        username: '${user.username}',\n`;
        code += `        password: '${user.password}',\n`;
        code += `        name: '${user.name}',\n`;
        code += `        isAdmin: ${user.isAdmin},\n`;
        code += `        createdAt: '${new Date().toISOString()}',\n`;
        code += `        lastLogin: null\n`;
        code += `    }${index < systemUsersConfig.length - 1 ? ',' : ''}\n`;
    });
    
    code += '};';
    
    // Mostrar código
    document.getElementById('github-code').textContent = code;
    document.getElementById('github-code-section').style.display = 'block';
    
    // Scroll al código
    document.getElementById('github-code-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    showNotification('✅ Código generado. Copia y pega en auth.js para GitHub', 'success');
}

function copyGitHubCode() {
    const code = document.getElementById('github-code').textContent;
    
    navigator.clipboard.writeText(code).then(() => {
        showNotification('✅ Código copiado al portapapeles. Pégalo en auth.js línea ~202', 'success');
        
        // Cambiar texto del botón temporalmente
        const btn = document.getElementById('copy-github-code-btn');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copiado';
        
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        showNotification('❌ Error al copiar. Copia manualmente el código', 'error');
        console.error('Error al copiar:', err);
    });
}

// Hacer funciones globales
window.removeSystemUserRow = removeSystemUserRow;
