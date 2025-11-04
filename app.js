class VolleyballManager {
    constructor() {
        console.log('🏗️ Iniciando constructor VolleyballManager...');
        this.jugadoras = this.cargarJugadoras();
        console.log('👥 Jugadoras cargadas en constructor:', this.jugadoras.length);
        this.jornadas = this.cargarJornadas();
        console.log('📅 Jornadas cargadas en constructor:', this.jornadas.length);
        this.currentTab = 'jornadas';
        this.eventListenersConfigurados = false; // Prevenir duplicación de event listeners
        this.inicializarApp();
        console.log('✅ Constructor completado');
    }

    // ==================== SISTEMA DE ALMACENAMIENTO ====================
    cargarJugadoras() {
        // Prevenir múltiples cargas
        if (this._jugadorasCargadas) {
            console.log('⚠️ Intento de cargar jugadoras duplicado - usando cache');
            return this.jugadoras || [];
        }
        
        console.log('📂 Cargando jugadoras desde localStorage...', new Error().stack);
        const data = localStorage.getItem('volleyball_jugadoras');
        console.log('📄 Datos raw:', data);
        const jugadoras = data ? JSON.parse(data) : [];
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
        localStorage.setItem('volleyball_jugadoras', JSON.stringify(this.jugadoras));
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
            entrenamientosAsistidos: 0
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
    cargarJornadas() {
        console.log('📂 Cargando jornadas desde localStorage...');
        const data = localStorage.getItem('volleyball_jornadas');
        console.log('📄 Datos jornadas raw:', data);
        const jornadas = data ? JSON.parse(data) : [];
        console.log('📅 Jornadas parseadas:', jornadas.length);
        return jornadas;
    }

    guardarJornadas() {
        localStorage.setItem('volleyball_jornadas', JSON.stringify(this.jornadas));
    }

    // ==================== INICIALIZACIÓN ====================
    inicializarApp() {
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
            lista.innerHTML = '<p>No hay jugadoras agregadas</p>';
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
        // Actualizar botones
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // Actualizar contenido
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tab).classList.add('active');
        
        this.currentTab = tab;
        
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
        if (this.currentTab === 'jornadas') this.actualizarJornadas();
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

    crearNuevaJornada() {
        const fechaInput = document.getElementById('fechaJornada');
        const fecha = fechaInput.value;
        
        if (!fecha) {
            alert('Selecciona una fecha para la jornada');
            return;
        }
        
        // Verificar si ya existe una jornada para esa semana
        const existeJornada = this.jornadas.find(j => j.fechaLunes === fecha);
        if (existeJornada) {
            alert('Ya existe una jornada para esa semana');
            return;
        }
        
        const nuevaJornada = {
            id: Date.now(),
            fechaLunes: fecha,
            asistenciaLunes: [],
            asistenciaMiercoles: [],
            asistenciaSabado: [],
            planificacionManual: null,
            rotacion: null,
            completada: false,
            fechaCreacion: new Date().toISOString()
        };
        
        this.jornadas.unshift(nuevaJornada);
        this.jornadaActual = nuevaJornada;
        this.pasoActual = 'lunes';
        
        // Resetear planificación de sets para nueva jornada
        this.planificacionSets = {
            set1: [],
            set2: []
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
        document.getElementById('tituloJornada').textContent = 
            `Jornada: Semana del ${this.formatearFecha(this.jornadaActual.fechaLunes)}`;
        
        // Actualizar títulos de días con fechas específicas
        this.actualizarTitulosDias();
        
        this.generarGridsAsistencia();
    }

    generarGridsAsistencia() {
        console.log('🔄 Generando grids de asistencia... Jugadoras disponibles:', this.jugadoras.length);
        
        const grids = [
            { id: 'asistenciaLunesGrid', asistencia: 'asistenciaLunes' },
            { id: 'asistenciaMiercolesGrid', asistencia: 'asistenciaMiercoles' }, 
            { id: 'asistenciaSabadoGrid', asistencia: 'asistenciaSabado' }
        ];
        
        grids.forEach(grid => {
            const gridElement = document.getElementById(grid.id);
            console.log(`📋 Grid ${grid.id}:`, !!gridElement);
            
            if (gridElement) {
                if (this.jugadoras.length === 0) {
                    gridElement.innerHTML = '<div class="no-jugadoras">⚠️ No hay jugadoras registradas. Ve a la pestaña "Equipo" para añadir jugadoras.</div>';
                    return;
                }
                
                const htmlContent = this.jugadoras.map(jugadora => {
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
                
                gridElement.innerHTML = htmlContent;
                console.log(`✅ Grid ${grid.id} actualizado con ${this.jugadoras.length} jugadoras`);
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
        // Verificar si está en set1 o set2
        const enSet1 = this.planificacionSets?.set1?.find(j => j.id === jugadoraId);
        const enSet2 = this.planificacionSets?.set2?.find(j => j.id === jugadoraId);
        
        // Verificar si tiene sustituciones
        const tieneSustitucionesSet1 = this.tieneSustituciones(jugadoraId, 1);
        const tieneSustitucionesSet2 = this.tieneSustituciones(jugadoraId, 2);
        
        return !!(enSet1 || enSet2 || tieneSustitucionesSet1 || tieneSustitucionesSet2);
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
        
        // Quitar de sets
        this.planificacionSets.set1 = this.planificacionSets.set1.filter(j => j.id !== jugadoraId);
        this.planificacionSets.set2 = this.planificacionSets.set2.filter(j => j.id !== jugadoraId);
        
        // Quitar de sustituciones (ambos sets)
        this.eliminarSustitucionesDeJugadora(jugadoraId, 'set1');
        this.eliminarSustitucionesDeJugadora(jugadoraId, 'set2');
        
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
            <div class="indicador-minimo">
                <strong>Jugadoras seleccionadas: ${totalJugadoras}/${minimo} mínimo</strong>
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
                set2: []
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
            </div>
            
            <div class="jugadoras-disponibles-container">
                <h4>Jugadoras Disponibles</h4>
                <div id="jugadorasDisponibles" class="jugadoras-disponibles-grid"></div>
            </div>
        `;
        
        // Event listeners para suplentes
        document.getElementById('btnAddSuplente1')?.addEventListener('click', () => this.añadirSustitucion(1));
        document.getElementById('btnAddSuplente2')?.addEventListener('click', () => this.añadirSustitucion(2));
        
        this.actualizarVistasSets();
        this.actualizarJugadorasDisponibles();
        
        // Restaurar sustituciones existentes después de regenerar HTML
        this.restaurarSustitucionesExistentes();
    }

    restaurarSustitucionesExistentes() {
        if (!this.jornadaActual?.sustituciones) {
            // Inicializar estructura de sustituciones vacía si no existe
            if (this.jornadaActual) {
                this.jornadaActual.sustituciones = { set1: [], set2: [] };
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
        
        console.log('✅ Sustituciones restauradas visualmente');
    }

    seleccionarJugadora(jugadoraId) {
        const jugadora = this.jugadoras.find(j => j.id === jugadoraId);
        if (!jugadora) return;
        
        // Construir opciones disponibles
        const set1Count = this.planificacionSets.set1.length;
        const set2Count = this.planificacionSets.set2.length;
        
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
        
        if (opcionesValidas.length === 0) {
            alert('Ambos sets están completos (6 jugadoras cada uno)');
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
            (set === '2' && this.planificacionSets.set2.length >= 6)) {
            alert('El set ya tiene 6 jugadoras');
            return;
        }
        
        // Verificar si ya está en ese set
        const yaEnSet1 = this.planificacionSets.set1.find(j => j.id === jugadoraId);
        const yaEnSet2 = this.planificacionSets.set2.find(j => j.id === jugadoraId);
        
        if ((set === '1' && yaEnSet1) || (set === '2' && yaEnSet2)) {
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
        
        // Guardar estado actual de sets
        this.jornadaActual.sets = {
            set1: [...this.planificacionSets.set1],
            set2: [...this.planificacionSets.set2]
        };
        
        // Guardar sustituciones actuales
        this.jornadaActual.sustituciones = {
            set1: this.obtenerSustituciones(1),
            set2: this.obtenerSustituciones(2)
        };
        
        // Guardar en localStorage
        this.guardarJornadas();
        
        console.log('💾 Auto-guardado: sets y sustituciones actualizados');
    }

    actualizarVistasSets() {
        // Actualizar Set 1 - Campo de voleibol (3 arriba, 3 abajo)
        const set1Container = document.getElementById('jugadorasSet1');
        if (set1Container) {
            const jugadoras = this.planificacionSets.set1;
            set1Container.innerHTML = `
                <div class="fila-campo">
                    ${this.generarPosicionesCampo(jugadoras, 0, 3, 'set1')}
                </div>
                <div class="fila-campo">
                    ${this.generarPosicionesCampo(jugadoras, 3, 6, 'set1')}
                </div>
            `;
        }
        
        // Actualizar Set 2 - Campo de voleibol (3 arriba, 3 abajo)
        const set2Container = document.getElementById('jugadorasSet2');
        if (set2Container) {
            const jugadoras = this.planificacionSets.set2;
            set2Container.innerHTML = `
                <div class="fila-campo">
                    ${this.generarPosicionesCampo(jugadoras, 0, 3, 'set2')}
                </div>
                <div class="fila-campo">
                    ${this.generarPosicionesCampo(jugadoras, 3, 6, 'set2')}
                </div>
            `;
        }
    }

    generarPosicionesCampo(jugadoras, inicio, fin, set) {
        let html = '';
        for (let i = inicio; i < fin; i++) {
            if (jugadoras[i]) {
                html += `
                    <div class="posicion-campo ocupada" onclick="app.removerJugadoraDeSet(${jugadoras[i].id}, '${set}')" title="Click para quitar del set">
                        <span class="dorsal-campo">#${jugadoras[i].dorsal}</span><span class="nombre-campo">${jugadoras[i].nombre}</span>
                    </div>
                `;
            } else {
                html += '<div class="posicion-campo vacia">Libre</div>';
            }
        }
        return html;
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
            // Limpiar arrays de sets de elementos undefined antes de buscar
            this.planificacionSets.set1 = this.planificacionSets.set1.filter(js => js && js.id);
            this.planificacionSets.set2 = this.planificacionSets.set2.filter(js => js && js.id);
            
            // Determinar estado en sets y suplentes
            const enSet1 = this.planificacionSets.set1.find(js => js.id === j.id);
            const enSet2 = this.planificacionSets.set2.find(js => js.id === j.id);
            
            // Verificar si es suplente en algún set
            const esSuplente1 = this.verificarSiEsSuplente(j.id, 1);
            const esSuplente2 = this.verificarSiEsSuplente(j.id, 2);
            
            let etiqueta = '';
            if (enSet1 && enSet2) {
                etiqueta = '<span class="etiqueta-estado">Ya en Set 1 y 2</span>';
            } else if (enSet1 && esSuplente2) {
                etiqueta = '<span class="etiqueta-estado">Ya en Set 1 y 2</span>';
            } else if (esSuplente1 && enSet2) {
                etiqueta = '<span class="etiqueta-estado">Ya en Set 1 y 2</span>';
            } else if (esSuplente1 && esSuplente2) {
                etiqueta = '<span class="etiqueta-estado">Ya en Set 1 y 2</span>';
            } else if (enSet1 || esSuplente1) {
                etiqueta = '<span class="etiqueta-estado">Ya en Set 1</span>';
            } else if (enSet2 || esSuplente2) {
                etiqueta = '<span class="etiqueta-estado">Ya en Set 2</span>';
            }
            
            return `
                <div class="jugadora-disponible ${j.color}" data-id="${j.id}" onclick="app.seleccionarJugadora(${j.id})">
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
        
        const setNum = set === 'set1' ? 1 : 2;
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
        
        // Obtener jugadoras del set correspondiente
        const jugadorasSetOriginales = set === 1 ? this.planificacionSets.set1 : this.planificacionSets.set2;
        console.log('🏐 Jugadoras originales del set:', jugadorasSetOriginales.length);
        
        // Obtener sustituciones ya realizadas en este set
        const sustitucionesExistentes = this.obtenerSustituciones(set);
        const jugadorasQueSalieron = sustitucionesExistentes.map(s => s.saleId);
        
        // Filtrar jugadoras que aún están en el campo (no han sido sustituidas)
        const jugadorasEnCampo = jugadorasSetOriginales.filter(j => 
            !jugadorasQueSalieron.includes(j.id)
        );
        console.log('👥 Jugadoras en campo:', jugadorasEnCampo.length);
        
        // Obtener jugadoras disponibles (las que NO están en este set específico)
        const todasLasJugadoras = this.jornadaActual.asistenciaSabado.map(id => 
            this.jugadoras.find(j => j.id === id)
        ).filter(j => j && j.nombre && j.dorsal !== undefined); // Filtrar undefined y datos incompletos
        
        console.log('✅ Jugadoras válidas disponibles:', todasLasJugadoras.length);
        
        const jugadorasDisponibles = todasLasJugadoras.filter(j => 
            !jugadorasSetOriginales.find(js => js.id === j.id)
        );
        
        console.log('🎪 Jugadoras disponibles para entrar:', jugadorasDisponibles.length);
        
        if (jugadorasEnCampo.length === 0) {
            alert('No hay jugadoras en el campo para sustituir (todas han sido sustituidas)');
            return;
        }
        
        if (jugadorasDisponibles.length === 0) {
            alert('No hay jugadoras disponibles para entrar como suplentes');
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
        jugadoraSaleSelect.innerHTML = '<option value="">Seleccionar jugadora...</option>';
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
        jugadoraEntraSelect.innerHTML = '<option value="">Seleccionar jugadora...</option>';
        jugadorasDisponibles.forEach(j => {
            // Validar que la jugadora tenga datos completos
            if (!j || !j.nombre || j.dorsal === undefined) {
                console.warn('⚠️ Jugadora disponible con datos incompletos:', j);
                return;
            }
            
            // Determinar si ya ha jugado
            const enSet1 = this.planificacionSets.set1.find(js => js.id === j.id);
            const enSet2 = this.planificacionSets.set2.find(js => js.id === j.id);
            const esSuplente1 = this.verificarSiEsSuplente(j.id, 1);
            const esSuplente2 = this.verificarSiEsSuplente(j.id, 2);
            
            const yaJugo = enSet1 || enSet2 || esSuplente1 || esSuplente2;
            const estado = yaJugo ? ' (Ya ha jugado)' : ' (No ha jugado)';
            
            const option = document.createElement('option');
            option.value = j.id;
            option.textContent = `#${j.dorsal} ${j.nombre}${estado}`;
            option.style.color = yaJugo ? '#28a745' : '#dc3545';
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
                texto: 'No hay jugadoras seleccionadas para el partido'
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
        
        // Guardar la planificación actual y sustituciones como borrador
        this.jornadaActual.sets = {
            set1: [...this.planificacionSets.set1],
            set2: [...this.planificacionSets.set2]
        };
        
        // Guardar sustituciones temporales
        this.jornadaActual.sustituciones = {
            set1: this.obtenerSustituciones(1),
            set2: this.obtenerSustituciones(2)
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
        
        if (this.jornadaActual.asistenciaSabado.length < 6) {
            alert('Se necesitan al menos 6 jugadoras para completar la jornada');
            return;
        }
        
        // Verificar que todas las jugadoras disponibles estén en algún set
        const jugadorasDisponibles = this.jornadaActual.asistenciaSabado;
        
        // Obtener jugadoras en planificación original
        const jugadorasEnSets = [...new Set([
            ...this.planificacionSets.set1.map(j => j.id),
            ...this.planificacionSets.set2.map(j => j.id)
        ])];
        
        // Obtener jugadoras que entran como sustitutas
        const sustitucionesSet1 = this.obtenerSustituciones(1);
        const sustitucionesSet2 = this.obtenerSustituciones(2);
        const jugadorasSustitutas = [...new Set([
            ...sustitucionesSet1.map(s => s.entraId),
            ...sustitucionesSet2.map(s => s.entraId)
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
            const nombresNoAsignadas = jugadorasSinAsignar.map(id => {
                const jugadora = this.jugadoras.find(j => j.id === id);
                return jugadora ? jugadora.nombre : 'Desconocida';
            }).join(', ');
            
            console.log('🚫 Jugadoras sin asignar encontradas:', nombresNoAsignadas);
            alert(`⚠️ No puedes completar la jornada. Las siguientes jugadoras disponibles no están asignadas a ningún set:\n\n${nombresNoAsignadas}\n\nAsegúrate de que todas las jugadoras disponibles estén en al menos un set antes de completar.`);
            return false; // Cambiar a return false para ser más explícito
        }
        
        // Guardar planificación manual y sustituciones si existen
        if (this.planificacionSets && (this.planificacionSets.set1.length > 0 || this.planificacionSets.set2.length > 0)) {
            this.jornadaActual.planificacionManual = {
                set1: [...this.planificacionSets.set1],
                set2: [...this.planificacionSets.set2]
            };
            
            // Guardar sustituciones
            this.jornadaActual.sustituciones = {
                set1: this.obtenerSustituciones(1),
                set2: this.obtenerSustituciones(2)
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
        let planificacionSet1 = [];
        let planificacionSet2 = [];
        
        if (this.jornadaActual.sustituciones) {
            sustitucionesSet1 = this.jornadaActual.sustituciones.set1 || [];
            sustitucionesSet2 = this.jornadaActual.sustituciones.set2 || [];
            console.log('📚 Usando sustituciones guardadas de la jornada');
        } else {
            // Si no hay sustituciones guardadas, obtenerlas del DOM (para jornadas en progreso)
            sustitucionesSet1 = this.obtenerSustituciones(1);
            sustitucionesSet2 = this.obtenerSustituciones(2);
            console.log('🔄 Obteniendo sustituciones del DOM');
        }
        
        if (this.jornadaActual.planificacionManual) {
            planificacionSet1 = this.jornadaActual.planificacionManual.set1 || [];
            planificacionSet2 = this.jornadaActual.planificacionManual.set2 || [];
            console.log('📚 Usando planificación guardada de la jornada');
        } else if (this.planificacionSets) {
            planificacionSet1 = this.planificacionSets.set1 || [];
            planificacionSet2 = this.planificacionSets.set2 || [];
            console.log('🔄 Usando planificación actual del DOM');
        }
        
        console.log('🔄 Sustituciones Set 1:', sustitucionesSet1);
        console.log('🔄 Sustituciones Set 2:', sustitucionesSet2);
        console.log('📋 Set 1 inicial:', planificacionSet1.map(j => j.nombre || `ID:${j.id}`));
        console.log('📋 Set 2 inicial:', planificacionSet2.map(j => j.nombre || `ID:${j.id}`));
        
        // Verificar si tenemos planificación de sets
        if (planificacionSet1.length === 0 && planificacionSet2.length === 0) {
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
        
        // Actualizar suplentes que entraron
        console.log('🔄 Actualizando puntos de suplentes...');
        this.actualizarPuntosSuplentes(sustitucionesSet1, sustitucionesSet2, puntosJornada);
        
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

    actualizarPuntosSuplentes(sustitucionesSet1, sustitucionesSet2, puntosJornada) {
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
    }

    volverAInicioJornada() {
        document.getElementById('jornadaActual').style.display = 'none';
        document.getElementById('jornada-nueva').style.display = 'block'; // AGREGAR ESTA LÍNEA
        this.jornadaActual = null;
        
        // Resetear planificación de sets
        this.planificacionSets = {
            set1: [],
            set2: []
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
            console.log('⚠️ No hay jugadoras registradas');
            container.innerHTML = '<div class="empty-state"><h3>No hay jugadoras registradas</h3><p>Añade jugadoras usando el formulario de arriba</p></div>';
            return;
        }

        console.log('✅ Generando lista de', this.jugadoras.length, 'jugadoras');
        container.innerHTML = this.jugadoras
            .sort((a, b) => a.dorsal - b.dorsal)
            .map(jugadora => {
                const emoji = jugadora.posicion === 'colocadora' ? '🎯' : (jugadora.posicion === 'central' ? '🛡️' : '🏐');
                const posicion = jugadora.posicion === 'colocadora' ? 'Colocadora' : (jugadora.posicion === 'central' ? 'Central' : 'Jugadora');
                
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
        
        const nuevoNombre = prompt('Nuevo nombre:', jugadora.nombre);
        if (nuevoNombre && nuevoNombre.trim()) {
            jugadora.nombre = nuevoNombre.trim();
            this.guardarJugadoras();
            this.actualizarEquipo();
        }
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
        
        select.innerHTML = '<option value="">Todas las jugadoras</option>' +
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
        
        container.innerHTML = jornadas.map(jornada => {
            const jugadorasLunes = jornada.asistenciaLunes?.map(id => 
                this.jugadoras.find(j => j.id === id)?.nombre
            ).filter(n => n) || [];
            
            const jugadorasMiercoles = jornada.asistenciaMiercoles?.map(id => 
                this.jugadoras.find(j => j.id === id)?.nombre
            ).filter(n => n) || [];
            
            const jugadorasSabado = jornada.asistenciaSabado?.map(id => 
                this.jugadoras.find(j => j.id === id)?.nombre
            ).filter(n => n) || [];

            return `
                <div class="jornada-historial" data-jornada-id="${jornada.id}">
                    <div class="jornada-fecha">
                        <div class="jornada-info">
                            <input type="checkbox" class="checkbox-jornada" value="${jornada.id}">
                            Semana del ${this.formatearFecha(jornada.fechaLunes)}
                            <span class="estado ${jornada.completada ? 'completada' : 'pendiente'}">
                                ${jornada.completada ? '✅ Completada' : '⏳ Pendiente'}
                            </span>
                        </div>
                        <div class="jornada-acciones">
                            ${!jornada.completada ? `
                                <button onclick="app.continuarEditandoJornada(${jornada.id})" class="btn-editar-jornada">✏️ Editar</button>
                                <button onclick="app.eliminarJornada(${jornada.id})" class="btn-eliminar-jornada">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="jornada-detalle">
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
                                 (jornada.sets?.set2 && jornada.sets.set2.length > 0);
        
        if (tienePlanificacion) {
            // Priorizar planificacionManual, sino usar los sets del borrador
            const set1Data = jornada.planificacionManual?.set1 || jornada.sets?.set1 || [];
            const set2Data = jornada.planificacionManual?.set2 || jornada.sets?.set2 || [];
            
            let html = '';
            
            // Set 1
            if (set1Data && set1Data.length > 0) {
                html += '<div class="set-historial">';
                html += '<strong>Set 1:</strong> ';
                html += set1Data.map(j => {
                    // Si j es solo ID, buscar jugadora
                    const jugadora = typeof j === 'object' ? j : this.jugadoras.find(jug => jug.id === j);
                    const claseResaltado = jugadoraFiltrada && jugadora.nombre === jugadoraFiltrada.nombre ? 'resaltado' : '';
                    return `<span class="jugadora-asistente ${claseResaltado}">${jugadora.nombre}</span>`;
                }).join('');
                html += '</div>';
            }
            
            // Set 2
            if (set2Data && set2Data.length > 0) {
                html += '<div class="set-historial">';
                html += '<strong>Set 2:</strong> ';
                html += set2Data.map(j => {
                    // Si j es solo ID, buscar jugadora
                    const jugadora = typeof j === 'object' ? j : this.jugadoras.find(jug => jug.id === j);
                    const claseResaltado = jugadoraFiltrada && jugadora.nombre === jugadoraFiltrada.nombre ? 'resaltado' : '';
                    return `<span class="jugadora-asistente ${claseResaltado}">${jugadora.nombre}</span>`;
                }).join('');
                html += '</div>';
            }
            
            // Mostrar sustituciones si existen y tienen contenido
            const tieneSustitucionesSet1 = jornada.sustituciones?.set1?.length > 0;
            const tieneSustitucionesSet2 = jornada.sustituciones?.set2?.length > 0;
            
            if (tieneSustitucionesSet1 || tieneSustitucionesSet2) {
                html += '<div class="sustituciones-historial">';
                html += '<strong>Cambios realizados:</strong><br>';
                
                // Sustituciones Set 1
                if (tieneSustitucionesSet1) {
                    html += '<div class="sustituciones-set">';
                    html += '<em>Set 1:</em> ';
                    html += jornada.sustituciones.set1.map(sust => {
                        const jugadoraSale = this.jugadoras.find(j => j.id === sust.saleId);
                        const jugadoraEntra = this.jugadoras.find(j => j.id === sust.entraId);
                        
                        // Agregar resaltado si coincide con el filtro
                        let nombreSale = jugadoraSale?.nombre || 'Desconocida';
                        let nombreEntra = jugadoraEntra?.nombre || 'Desconocida';
                        
                        if (jugadoraFiltrada) {
                            if (nombreSale === jugadoraFiltrada.nombre) {
                                nombreSale = `<span class="jugadora-filtrada">${nombreSale}</span>`;
                            }
                            if (nombreEntra === jugadoraFiltrada.nombre) {
                                nombreEntra = `<span class="jugadora-filtrada">${nombreEntra}</span>`;
                            }
                        }
                        
                        return `${nombreEntra} entra por ${nombreSale} (${sust.punto}')`;
                    }).join(', ');
                    html += '</div>';
                }
                
                // Sustituciones Set 2
                if (tieneSustitucionesSet2) {
                    html += '<div class="sustituciones-set">';
                    html += '<em>Set 2:</em> ';
                    html += jornada.sustituciones.set2.map(sust => {
                        const jugadoraSale = this.jugadoras.find(j => j.id === sust.saleId);  
                        const jugadoraEntra = this.jugadoras.find(j => j.id === sust.entraId);
                        
                        // Agregar resaltado si coincide con el filtro
                        let nombreSale = jugadoraSale?.nombre || 'Desconocida';
                        let nombreEntra = jugadoraEntra?.nombre || 'Desconocida';
                        
                        if (jugadoraFiltrada) {
                            if (nombreSale === jugadoraFiltrada.nombre) {
                                nombreSale = `<span class="jugadora-filtrada">${nombreSale}</span>`;
                            }
                            if (nombreEntra === jugadoraFiltrada.nombre) {
                                nombreEntra = `<span class="jugadora-filtrada">${nombreEntra}</span>`;
                            }
                        }
                        
                        return `${nombreEntra} entra por ${nombreSale} (${sust.punto}')`;
                    }).join(', ');
                    html += '</div>';
                }
                
                html += '</div>';
            }

            // Si no hay sets pero hay jugadoras disponibles, mostrar lista simple
            if (set1Data.length === 0 && set2Data.length === 0) {
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

    eliminarJornada(jornadaId) {
        if (confirm('¿Estás seguro de eliminar esta jornada?')) {
            // Si se elimina la jornada actual, resetear planificación
            if (this.jornadaActual && this.jornadaActual.id === jornadaId) {
                this.planificacionSets = {
                    set1: [],
                    set2: []
                };
                
                const planificadorContainer = document.getElementById('planificadorSets');
                if (planificadorContainer) {
                    planificadorContainer.style.display = 'none';
                }
            }
            
            this.jornadas = this.jornadas.filter(j => j.id !== jornadaId);
            this.guardarJornadas();
            this.actualizarHistorial();
            alert('Jornada eliminada');
        }
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
        
        // Cargar datos existentes si los hay
        if (jornada.sets) {
            this.planificacionSets = {
                set1: jornada.sets.set1 || [],
                set2: jornada.sets.set2 || []
            };
        } else {
            // Si no hay sets guardados, resetear
            this.planificacionSets = {
                set1: [],
                set2: []
            };
        }

        // Cambiar a la pestaña de Jornadas
        this.cambiarTab('jornadas');
        
        // Ocultar banner mientras editamos
        this.ocultarBanner();
        
        // IMPORTANTE: Mostrar la interfaz de jornada activa y ocultar la de creación nueva
        document.getElementById('jornada-nueva').style.display = 'none';
        document.getElementById('jornadaActual').style.display = 'block';
        
        // Actualizar el título de la jornada
        document.getElementById('tituloJornada').textContent = `Jornada: Semana del ${this.formatearFecha(jornada.fechaLunes)}`;
        
        // Actualizar títulos de días con fechas específicas
        this.actualizarTitulosDias();
        
        // Configurar los campos del partido si existen
        if (jornada.puntosSet1) {
            document.getElementById('puntosSet1Jornada').value = jornada.puntosSet1;
        }
        if (jornada.puntosSet2) {
            document.getElementById('puntosSet2Jornada').value = jornada.puntosSet2;
        }
        
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
        
        console.log('🗓️ DEBUG FECHAS - Fecha lunes de jornada:', this.jornadaActual.fechaLunes);
        
        // Calcular fechas basadas en el lunes de la jornada
        const fechaLunes = new Date(this.jornadaActual.fechaLunes + 'T00:00:00');
        console.log('🗓️ DEBUG FECHAS - Fecha lunes parseada:', fechaLunes);
        console.log('🗓️ DEBUG FECHAS - Día de la semana del lunes:', fechaLunes.getDay()); // Debe ser 1
        
        const fechaMiercoles = new Date(fechaLunes);
        fechaMiercoles.setDate(fechaLunes.getDate() + 2);
        console.log('🗓️ DEBUG FECHAS - Fecha miércoles:', fechaMiercoles);
        console.log('🗓️ DEBUG FECHAS - Día de la semana del miércoles:', fechaMiercoles.getDay()); // Debe ser 3
        
        const fechaSabado = new Date(fechaLunes);
        fechaSabado.setDate(fechaLunes.getDate() + 5);
        console.log('🗓️ DEBUG FECHAS - Fecha sábado:', fechaSabado);
        console.log('🗓️ DEBUG FECHAS - Día de la semana del sábado:', fechaSabado.getDay()); // Debe ser 6

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
        
        // Añadir leyenda de colores SOLO para jornadas nuevas (no al continuar editando)
        const esContinuarEditando = this.jornadaActual && this.jornadaActual.id && this.jornadaActual.sets;
        
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
            
            // Determinar el color según asistencia a entrenamientos (solo para sábado Y solo jornadas nuevas)
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
        
        // Botones de equipo - CON VERIFICACIÓN EXTRA
        const btnAdd = document.getElementById('addJugadora');
        const btnReset = document.getElementById('resetearEquipo');
        const btnGuardar = document.getElementById('guardarJugadora');
        const btnCancelar = document.getElementById('cancelarJugadora');
        
        console.log('🔍 Verificando elementos del equipo:', {
            btnAdd: !!btnAdd,
            btnReset: !!btnReset,
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

    eliminarJornada(jornadaId, mostrarConfirmacion = true) {
        if (mostrarConfirmacion) {
            const jornada = this.jornadas.find(j => j.id === jornadaId);
            if (!jornada) return;
            
            const confirmacion = confirm(
                `¿Eliminar la jornada del ${this.formatearFecha(jornada.fechaLunes)}?\n\n` +
                `Se actualizarán las estadísticas de las jugadoras.`
            );
            
            if (!confirmacion) return;
        }
        
        // Eliminar la jornada
        this.jornadas = this.jornadas.filter(j => j.id !== jornadaId);
        this.guardarJornadas();
        
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
            bannerTexto.textContent = `Tienes una jornada pendiente: Semana del ${this.formatearFecha(jornadaPendiente.fechaLunes)}`;
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
                <p><strong>Posición:</strong> ${jugadora.posicion === 'colocadora' ? '🎯 Colocadora' : (jugadora.posicion === 'central' ? '🛡️ Central' : '🏐 Jugadora')}</p>
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
        this.mostrarModalImportacion(data);

    } catch (error) {
        console.error('❌ Error al validar datos:', error);
        alert('❌ Error: El archivo no tiene el formato esperado para esta aplicación.');
    }
};

VolleyballManager.prototype.mostrarModalImportacion = function(data) {
    const self = this; // Capturar el contexto
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
        self.ejecutarImportacion(data);
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
        localStorage.setItem('volleyball_jugadoras', JSON.stringify(this.jugadoras));
        localStorage.setItem('volleyball_jornadas', JSON.stringify(this.jornadas));
        
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
    try {
        app = new VolleyballManager();
        window.app = app; // Para debugging
        console.log('✅ Sistema iniciado correctamente');
        
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