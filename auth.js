// ===== NUEVO SISTEMA DE AUTENTICACIÓN =====

// Objeto Auth compatible con el sistema anterior
window.Auth = {
    requireAuth: function() {
        const session = getSessionFromMultipleSources();
        return !!session;
    },
    
    getCurrentUser: function() {
        const session = getSessionFromMultipleSources();
        return session ? {
            username: session.username,
            name: session.name,
            isAdmin: session.isAdmin
        } : null;
    },
    
    isAuthenticated: function() {
        return !!getSessionFromMultipleSources();
    },
    
    isAdmin: function() {
        const session = getSessionFromMultipleSources();
        return session ? session.isAdmin : false;
    },
    
    getCurrentUser: function() {
        const session = getSessionFromMultipleSources();
        return session ? {
            username: session.username,
            name: session.name,
            isAdmin: session.isAdmin
        } : null;
    },
    
    logout: function() {
        logout();
    },
    
    // Funciones para gestión de usuarios
    createUser: async function(username, password, name, isAdmin = false) {
        console.log('🆕 Creando usuario:', username);
        console.log('📋 Datos:', {username, password, name, isAdmin});
        
        const users = this.getUsers();
        console.log('👥 Usuarios antes de crear:', Object.keys(users));
        
        if (users[username]) {
            return { success: false, message: 'El usuario ya existe' };
        }
        
        const newUser = {
            username: username,
            password: password, // En producción debería estar hasheado
            name: name,
            isAdmin: isAdmin,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        
        users[username] = newUser;
        
        console.log('👥 Usuarios después de agregar:', Object.keys(users));
        console.log('💾 Guardando usuarios...');
        
        this.saveUsers(users);
        
        // Sincronizar con MongoDB
        try {
            const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000/api'
                : window.location.origin + '/api';
            
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            
            if (response.ok) {
                console.log('☁️ Usuario sincronizado con MongoDB');
            } else {
                console.warn('⚠️ No se pudo sincronizar con MongoDB, guardado solo en localStorage');
            }
        } catch (error) {
            console.warn('⚠️ Error sincronizando usuario con MongoDB:', error.message);
        }
        
        // Verificar que se guardó correctamente
        const savedUsers = this.getUsers();
        console.log('✅ Verificación post-guardado:', Object.keys(savedUsers));
        console.log('✅ Usuario creado exitosamente');
        return { success: true, message: 'Usuario creado exitosamente' };
    },

    login: function(username, password) {
        console.log('🔐 Auth.login() - Intentando login:', username);
        
        const users = this.getUsers();
        console.log('👥 Usuarios disponibles:', Object.keys(users));
        
        const user = users[username];
        if (!user) {
            console.log('❌ Usuario no encontrado:', username);
            console.log('📋 Todos los usuarios:', users);
            return { success: false, message: 'Usuario no encontrado' };
        }
        
        console.log('🔍 Comparando contraseñas:');
        console.log('   - Ingresada:', password);
        console.log('   - Almacenada:', user.password);
        console.log('   - Son iguales?', user.password === password);
        
        if (user.password !== password) {
            console.log('❌ Contraseña incorrecta para:', username);
            return { success: false, message: 'Contraseña incorrecta' };
        }
        
        // Actualizar último login
        user.lastLogin = new Date().toISOString();
        this.saveUsers(users);
        
        // Crear sesión
        const session = {
            username: user.username,
            name: user.name,
            isAdmin: user.isAdmin,
            loginTime: new Date().toISOString()
        };
        
        // Guardar sesión en múltiples lugares
        try {
            localStorage.setItem('volleyball_auth', JSON.stringify(session));
            localStorage.setItem('current_user', JSON.stringify(session));
            localStorage.setItem('volleyball_session', JSON.stringify(session));
            sessionStorage.setItem('volleyball_auth', JSON.stringify(session));
            sessionStorage.setItem('current_user', JSON.stringify(session));
            sessionStorage.setItem('volleyball_session', JSON.stringify(session));
            
            console.log('✅ Login exitoso y sesión guardada:', session);
            return { success: true, message: 'Login exitoso', user: session };
        } catch (e) {
            console.error('❌ Error guardando sesión:', e);
            return { success: false, message: 'Error al crear la sesión' };
        }
    },
    
    listUsers: function() {
        console.log('📋 Listando usuarios');
        const session = getSessionFromMultipleSources();
        
        if (!session || !session.isAdmin) {
            return { success: false, message: 'Acceso denegado - Se requieren privilegios de administrador' };
        }
        
        const users = this.getUsers();
        const userList = [];
        
        for (const [username, userData] of Object.entries(users)) {
            userList.push({
                username: username,
                name: userData.name,
                isAdmin: userData.isAdmin,
                createdAt: userData.createdAt,
                lastLogin: userData.lastLogin
            });
        }
        
        console.log('✅ Usuarios encontrados:', userList.length);
        return { success: true, users: userList };
    },
    
    changePassword: function(username, newPassword) {
        console.log('🔐 Cambiando contraseña para:', username);
        const session = getSessionFromMultipleSources();
        
        if (!session || !session.isAdmin) {
            return { success: false, message: 'Acceso denegado' };
        }
        
        const users = this.getUsers();
        
        if (!users[username]) {
            return { success: false, message: 'Usuario no encontrado' };
        }
        
        users[username].password = newPassword;
        this.saveUsers(users);
        
        console.log('✅ Contraseña cambiada exitosamente');
        return { success: true, message: 'Contraseña actualizada exitosamente' };
    },
    
    deleteUser: function(username) {
        console.log('🗑️ Eliminando usuario:', username);
        const session = getSessionFromMultipleSources();
        
        if (!session || !session.isAdmin) {
            return { success: false, message: 'Acceso denegado' };
        }
        
        if (username === 'admin') {
            return { success: false, message: 'No se puede eliminar el usuario admin' };
        }
        
        const users = this.getUsers();
        
        if (!users[username]) {
            return { success: false, message: 'Usuario no encontrado' };
        }
        
        delete users[username];
        this.saveUsers(users);
        
        console.log('✅ Usuario eliminado exitosamente');
        return { success: true, message: 'Usuario eliminado exitosamente' };
    },
    
    getUsers: function() {
        console.log('🔍 getUsers() - Obteniendo usuarios del localStorage');
        
        // Usuarios predefinidos del sistema
        // EDITA ESTA LISTA para agregar o modificar usuarios antes de subir a GitHub
const systemUsers = {
    admin: {
        username: 'admin',
        password: 'admin',
        name: 'Administrador',
        isAdmin: true,
        createdAt: '2025-11-11T11:29:42.538Z',
        lastLogin: null
    },
    Christian: {
        username: 'Christian',
        password: '16614',
        name: 'Christian Cosa Coronado',
        isAdmin: false,
        createdAt: '2025-11-11T11:29:42.538Z',
        lastLogin: null
    },
    Elena: {
        username: 'Elena',
        password: '12612',
        name: 'Perez-Herrera Cuadrillero',
        isAdmin: false,
        createdAt: '2025-11-11T11:29:42.538Z',
        lastLogin: null
    }
};
        
        // Intentar obtener usuarios de localStorage
        const stored = localStorage.getItem('system_users');
        console.log('📦 Datos crudos de system_users:', stored);
        
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                console.log('✅ Usuarios de localStorage:', Object.keys(parsed));
                
                // Combinar usuarios del sistema con usuarios de localStorage
                // Los usuarios del código siempre están disponibles, más los agregados dinámicamente
                const merged = { ...systemUsers, ...parsed };
                console.log('✅ Usuarios finales (código + localStorage):', Object.keys(merged));
                return merged;
            } catch (e) {
                console.warn('❌ Error parsing users data, usando usuarios del código:', e);
                return systemUsers;
            }
        }
        
        console.log('⚠️ No hay usuarios en localStorage, usando usuarios del código');
        console.log('👥 Usuarios del código:', Object.keys(systemUsers));
        
        // Guardar usuarios del sistema en localStorage (solo la primera vez)
        this.saveUsers(systemUsers);
        return systemUsers;
    },

    // Nueva función para obtener usuarios como array
    getUsersAsArray: function() {
        const users = this.getUsers();
        return Object.values(users);
    },
    
    saveUsers: function(users) {
        try {
            localStorage.setItem('system_users', JSON.stringify(users));
            console.log('💾 Usuarios guardados correctamente');
        } catch (e) {
            console.error('Error guardando usuarios:', e);
        }
    },
    
    updateUser: function(username, userData) {
        console.log('📝 Actualizando usuario:', username);
        const session = getSessionFromMultipleSources();
        
        if (!session || !session.isAdmin) {
            return { success: false, message: 'Acceso denegado' };
        }
        
        const users = this.getUsers();
        
        if (!users[username]) {
            return { success: false, message: 'Usuario no encontrado' };
        }
        
        // Actualizar campos permitidos
        if (userData.name) users[username].name = userData.name;
        if (userData.password) users[username].password = userData.password;
        if (typeof userData.isAdmin !== 'undefined') users[username].isAdmin = userData.isAdmin;
        
        this.saveUsers(users);
        
        console.log('✅ Usuario actualizado exitosamente');
        return { success: true, message: 'Usuario actualizado exitosamente' };
    },
    
    hashPassword: function(password) {
        // Hash simple compatible
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }
};

function getSessionFromMultipleSources() {
    console.log('🔍 Verificando sesión desde múltiples fuentes...');
    
    // Lista de claves posibles en sessionStorage
    const sessionKeys = ['volleyball_session', 'volleyball_auth', 'current_user', 'voleibol_session'];
    
    // Fuente 1: sessionStorage (intentar múltiples claves)
    for (const key of sessionKeys) {
        try {
            const sessionData = sessionStorage.getItem(key);
            if (sessionData) {
                console.log(`📦 Datos encontrados en sessionStorage[${key}]:`, sessionData);
                const parsed = JSON.parse(sessionData);
                console.log('✅ Sesión encontrada en sessionStorage:', parsed);
                return parsed;
            }
        } catch (e) {
            console.log(`⚠️ Error leyendo sessionStorage[${key}]:`, e.message);
        }
    }
    
    // Fuente 2: localStorage (intentar múltiples claves)
    const localKeys = ['volleyball_session', 'volleyball_auth', 'current_user', 'voleibol_session', 'currentUser'];
    for (const key of localKeys) {
        try {
            const sessionData = localStorage.getItem(key);
            if (sessionData) {
                console.log(`� Datos encontrados en localStorage[${key}]:`, sessionData);
                const parsed = JSON.parse(sessionData);
                console.log('✅ Sesión encontrada en localStorage:', parsed);
                return parsed;
            }
        } catch (e) {
            console.log(`⚠️ Error leyendo localStorage[${key}]:`, e.message);
        }
    }
    
    // Fuente 3: URL parameter (para file://)
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth');
    if (authToken) {
        try {
            const sessionData = JSON.parse(atob(decodeURIComponent(authToken)));
            console.log('✅ Sesión encontrada en URL:', sessionData);
            
            // Guardar la sesión en storage para uso futuro
            try {
                sessionStorage.setItem('volleyball_session', JSON.stringify(sessionData));
                localStorage.setItem('volleyball_session', JSON.stringify(sessionData));
                console.log('✅ Sesión guardada en storage');
            } catch (e) {
                console.log('⚠️ Error guardando sesión:', e.message);
            }
            
            // Limpiar URL para que no se vea el token
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            
            return sessionData;
        } catch (e) {
            console.log('⚠️ Token URL inválido:', e.message);
        }
    }
    
    console.log('❌ No se encontró sesión válida en ningún lado');
    return null;
}

// ===== VARIABLES GLOBALES DE CONTROL =====
let applicationInitialized = false;
let authenticationChecked = false;

function checkAuthentication() {
    if (authenticationChecked) {
        console.log('🔐 Autenticación ya verificada previamente - omitiendo duplicación');
        return true;
    }
    
    console.log('🔐 === VERIFICANDO AUTENTICACIÓN ===');
    
    const session = getSessionFromMultipleSources();
    
    if (!session) {
        console.log('❌ ACCESO DENEGADO - No hay sesión');
        console.log('🔍 Verificando storage directamente...');
        
        // Debug adicional - verificar qué hay en storage
        console.log('SessionStorage keys:', Object.keys(sessionStorage));
        console.log('LocalStorage keys:', Object.keys(localStorage));
        
        showAccessDenied();
        return false;
    }
    
    console.log('✅ Usuario autenticado:', session);
    
    // Marcar como verificada para evitar duplicaciones
    authenticationChecked = true;
    
    // Mostrar información del usuario
    updateUserInfo(session);
    
    // Mostrar pestaña admin si es admin
    if (session.isAdmin) {
        console.log('👑 Mostrando pestaña admin');
        const adminTab = document.getElementById('admin-tab');
        if (adminTab) {
            adminTab.style.display = 'block';
            
            // Reconfigurar tabs para incluir el admin
            setTimeout(() => {
                if (window.app && typeof window.app.configurarTabs === 'function') {
                    console.log('🔄 Reconfigurando tabs para incluir Admin');
                    window.app.configurarTabs();
                }
                
                // Asegurar que el event listener del admin esté configurado
                const adminTabButton = document.getElementById('admin-tab');
                if (adminTabButton && !adminTabButton.hasAttribute('data-listener-configured')) {
                    console.log('⚙️ Configurando event listener para tab Admin');
                    adminTabButton.addEventListener('click', (e) => {
                        console.log('🖱️ Click en tab Admin detectado');
                        console.log('🔍 window.app existe:', !!window.app);
                        console.log('🔍 window.app.cambiarTab existe:', !!(window.app && window.app.cambiarTab));
                        
                        if (window.app && typeof window.app.cambiarTab === 'function') {
                            console.log('🎯 Usando función cambiarTab de VolleyballManager');
                            window.app.cambiarTab('admin');
                        } else {
                            // Manejo manual si no existe la función
                            console.log('🔧 Ejecutando cambio de tab manual');
                            document.querySelectorAll('.tab-button').forEach(btn => {
                                btn.classList.remove('active');
                                console.log('❌ Removido active de:', btn.textContent);
                            });
                            document.querySelectorAll('.tab-content').forEach(content => {
                                content.classList.remove('active');
                                console.log('❌ Removido active de tab-content:', content.id);
                            });
                            adminTabButton.classList.add('active');
                            console.log('✅ Agregado active al botón Admin');
                            
                            const adminContent = document.getElementById('admin');
                            if (adminContent) {
                                adminContent.classList.add('active');
                                console.log('✅ Agregado active al contenido Admin');
                                console.log('📏 Display del contenido Admin:', getComputedStyle(adminContent).display);
                            } else {
                                console.error('❌ No se encontró elemento con id="admin"');
                            }
                        }
                    });
                    adminTabButton.setAttribute('data-listener-configured', 'true');
                }
            }, 100);
        }
    }
    
    // Mostrar aplicación principal
    showMainApp();
    return true;
}

function updateUserInfo(session) {
    console.log('🔄 Actualizando información de usuario:', session);
    
    if (!session) {
        session = getSessionFromMultipleSources();
    }
    
    if (!session) {
        console.warn('⚠️ No hay sesión para actualizar información de usuario');
        return;
    }
    
    const userDisplay = `👤 ${session.name} ${session.isAdmin ? '(Admin)' : '(Usuario)'}`;
    
    // Actualizar botón de logout
    const userSpan = document.getElementById('current-user');
    if (userSpan) {
        userSpan.textContent = userDisplay;
        console.log('✅ Botón de usuario actualizado');
    } else {
        console.warn('⚠️ Elemento current-user no encontrado');
    }
    
    // Actualizar panel de admin si existe
    const userInfoAdmin = document.getElementById('current-user-info');
    if (userInfoAdmin) {
        userInfoAdmin.textContent = `Bienvenido, ${session.name} (${session.isAdmin ? 'Admin' : 'Usuario'})`;
        console.log('✅ Panel de admin actualizado');
    }
}

function showAccessDenied() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('access-denied').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    const loadingScreen = document.getElementById('loading-screen');
    const accessDenied = document.getElementById('access-denied');
    const mainApp = document.getElementById('mainApp');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (accessDenied) accessDenied.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    
    console.log('✅ App principal mostrada');
}

function logout() {
    console.log('🚪 Cerrando sesión...');
    
    // Limpiar TODAS las fuentes de sesión
    try {
        console.log('📋 localStorage ANTES del logout:', Object.keys(localStorage));
        
        // Obtener userId antes de limpiar la sesión
        const authData = JSON.parse(localStorage.getItem('volleyball_auth') || '{}');
        const userId = authData.username;
        
        // Limpiar sessionStorage - solo las claves de sesión
        sessionStorage.removeItem('volleyball_session');
        sessionStorage.removeItem('volleyball_auth');
        sessionStorage.removeItem('current_user');
        sessionStorage.removeItem('voleibol_session');
        
        // Limpiar localStorage - SOLO las claves de sesión y datos del usuario actual
        localStorage.removeItem('volleyball_session');
        localStorage.removeItem('volleyball_auth');
        localStorage.removeItem('current_user');
        localStorage.removeItem('voleibol_session');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('voleibol_users');
        
        // IMPORTANTE: Limpiar datos específicos del usuario (jugadoras y jornadas)
        if (userId) {
            localStorage.removeItem(`volleyball_jugadoras_${userId}`);
            localStorage.removeItem(`volleyball_jornadas_${userId}`);
            console.log(`🗑️ Limpiados datos del usuario: ${userId}`);
        }
        
        // También limpiar claves antiguas sin userId (por compatibilidad)
        localStorage.removeItem('volleyball_jugadoras');
        localStorage.removeItem('volleyball_jornadas');
        
        // NO borrar system_users - esos son los usuarios del sistema
        
        console.log('✅ Sesión limpiada');
        console.log('📋 localStorage DESPUÉS del logout:', Object.keys(localStorage));
        
    } catch (e) {
        console.log('⚠️ Error limpiando sesión:', e.message);
    }
    
    // Redirigir al login
    console.log('🔄 Redirigiendo a login...');
    window.location.href = 'login.html';
}

// ===== INICIALIZACIÓN ===== 
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM Cargado en index con nuevo sistema');
    
    // No ejecutar verificación de autenticación en la página de login
    if (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('test-auth.html')) {
        console.log('🔐 Página de login detectada, omitiendo verificación de autenticación');
        return;
    }
    
    if (applicationInitialized) {
        console.log('⚠️ Aplicación ya inicializada, omitiendo...');
        return;
    }
    
    // Pequeño delay para asegurar que todo esté cargado
    setTimeout(() => {
        console.log('⏰ Iniciando verificación de autenticación...');
        
        // Verificar autenticación
        if (!checkAuthentication()) {
            return;
        }
        
        // INICIALIZAR APLICACIÓN PRINCIPAL DE VOLEIBOL
        console.log('🚀 Inicializando aplicación de voleibol...');
        
        // Verificar que VolleyballManager existe y que no haya sido ya inicializado
        if (typeof VolleyballManager !== 'undefined' && !window.app) {
            console.log('✅ VolleyballManager encontrado, iniciando...');
            try {
                window.app = new VolleyballManager();
                console.log('✅ Aplicación iniciada exitosamente');
            } catch (error) {
                console.error('❌ Error iniciando aplicación:', error);
                showError('Error iniciando aplicación', error.message);
            }
        } else if (window.app) {
            console.log('⚠️ VolleyballManager ya inicializado, omitiendo...');
        } else {
            console.log('ℹ️ VolleyballManager no disponible (normal en login.html)');
        }
        
        // Inicializar funciones específicas del admin si es administrador
        const session = getSessionFromMultipleSources();
        if (session && session.isAdmin && !window.adminPanelInitialized) {
            console.log('👑 Usuario admin detectado - Inicializando funciones admin');
            
            // Inicializar panel de admin si existe la función
            if (typeof initializeAdminPanel === 'function') {
                initializeAdminPanel();
                window.adminPanelInitialized = true;
            }
        } else if (window.adminPanelInitialized) {
            console.log('⚠️ Panel de admin ya inicializado, omitiendo...');
        }
        
        // Marcar como inicializada
        applicationInitialized = true;
        console.log('✅ Inicialización completa');
    }, 100); // 100ms delay
});

function showError(title, message) {
    const mainApp = document.getElementById('mainApp');
    if (mainApp) {
        mainApp.innerHTML = `
            <div style="text-align: center; padding: 50px; background: #f8d7da; color: #721c24; border-radius: 8px; margin: 20px;">
                <h3>⚠️ ${title}</h3>
                <p>${message}</p>
                <button onclick="location.reload()" style="padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🔄 Recargar Página
                </button>
            </div>
        `;
    }
}

// Función de debugging para verificar estado de tabs
window.debugTabs = function() {
    console.log('=== DEBUG TABS ===');
    console.log('Botones de tabs:');
    document.querySelectorAll('.tab-button').forEach((btn, i) => {
        console.log(`  ${i}: ${btn.textContent} - active: ${btn.classList.contains('active')} - visible: ${btn.style.display !== 'none'}`);
    });
    
    console.log('Contenidos de tabs:');
    document.querySelectorAll('.tab-content').forEach((content, i) => {
        console.log(`  ${i}: ${content.id} - active: ${content.classList.contains('active')} - display: ${getComputedStyle(content).display}`);
    });
    
    console.log('window.app:', !!window.app);
    if (window.app) {
        console.log('window.app.cambiarTab:', typeof window.app.cambiarTab);
        console.log('window.app.currentTab:', window.app.currentTab);
    }
};

// Función para forzar cambio a admin
window.forceAdminTab = function() {
    console.log('🚀 Forzando cambio a tab admin...');
    
    // MÉTODO COMPLETAMENTE MANUAL Y FORZADO
    console.log('� Usando método manual FORZADO');
    
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });
    
    // Desactivar todos los botones
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activar botón admin
    const adminBtn = document.getElementById('admin-tab');
    if (adminBtn) {
        adminBtn.classList.add('active');
        console.log('✅ Botón admin activado');
    }
    
    // FORZAR ADMIN COMPLETAMENTE
    const adminContent = document.getElementById('admin');
    if (adminContent) {
        // Remover todas las clases y estilos previos
        adminContent.className = 'tab-content active';
        
        // Aplicar estilos inline FORZADOS
        adminContent.style.cssText = `
            display: block !important;
            min-height: 600px !important;
            width: 100% !important;
            padding: 30px !important;
            box-sizing: border-box !important;
            background: #f8f9fa !important;
            border: 2px solid #007bff !important;
            margin: 10px 0 !important;
        `;
        
        console.log('✅ Admin completamente forzado');
        console.log('📏 Nuevas dimensiones:', adminContent.getBoundingClientRect().width, 'x', adminContent.getBoundingClientRect().height);
        
        // Forzar también el contenido interno
        const container = adminContent.querySelector('.admin-container');
        if (container) {
            container.style.cssText = `
                display: block !important;
                min-height: 400px !important;
                padding: 20px !important;
                background: white !important;
                border-radius: 8px !important;
            `;
        }
        
        // Forzar formulario
        const form = adminContent.querySelector('#create-user-form');
        if (form) {
            form.style.cssText = `
                display: block !important;
                min-height: 200px !important;
                padding: 20px !important;
                background: #fff !important;
                border: 1px solid #ddd !important;
            `;
            console.log('✅ Formulario forzado');
        }
    }
    
    console.log('🎯 ADMIN COMPLETAMENTE FORZADO - Debería ser visible ahora');
};

// Función de debugging completo
window.debugCompleto = function() {
    console.log('=== DEBUG COMPLETO DEL SISTEMA ===');
    
    // 1. Verificar mainApp
    const mainApp = document.getElementById('mainApp');
    console.log('📱 mainApp encontrado:', !!mainApp);
    if (mainApp) {
        const mainAppStyles = getComputedStyle(mainApp);
        const mainAppRect = mainApp.getBoundingClientRect();
        console.log('📱 mainApp display:', mainAppStyles.display);
        console.log('📱 mainApp dimensiones:', mainAppRect.width, 'x', mainAppRect.height);
        console.log('📱 mainApp visible:', mainAppStyles.display !== 'none' && mainAppRect.width > 0 && mainAppRect.height > 0);
    }
    
    // 2. Verificar loading-screen
    const loading = document.getElementById('loading-screen');
    console.log('⏳ loading-screen display:', loading ? getComputedStyle(loading).display : 'no encontrado');
    
    // 3. Verificar access-denied
    const accessDenied = document.getElementById('access-denied');
    console.log('🚫 access-denied display:', accessDenied ? getComputedStyle(accessDenied).display : 'no encontrado');
    
    // 4. Verificar tab admin
    const adminTab = document.getElementById('admin-tab');
    console.log('🔘 admin-tab visible:', adminTab ? adminTab.style.display !== 'none' : 'no encontrado');
    
    // 5. Verificar contenido admin
    const adminContent = document.getElementById('admin');
    if (adminContent) {
        const adminStyles = getComputedStyle(adminContent);
        const adminRect = adminContent.getBoundingClientRect();
        console.log('📄 admin content display:', adminStyles.display);
        console.log('📄 admin content dimensiones:', adminRect.width, 'x', adminRect.height);
        console.log('📄 admin content classes:', adminContent.className);
    }
    
    console.log('=== FIN DEBUG COMPLETO ===');
};

// Función para debugging visual del admin
window.debugAdminVisual = function() {
    console.log('=== DEBUG VISUAL ADMIN ===');
    
    // PRIMERO: Verificar mainApp
    const mainApp = document.getElementById('mainApp');
    console.log('🔍 MainApp encontrado:', !!mainApp);
    if (mainApp) {
        const mainStyles = getComputedStyle(mainApp);
        const mainRect = mainApp.getBoundingClientRect();
        console.log('📱 MainApp display:', mainStyles.display);
        console.log('📱 MainApp visibility:', mainStyles.visibility);
        console.log('📱 MainApp dimensiones:', mainRect.width, 'x', mainRect.height);
        
        if (mainStyles.display === 'none') {
            console.log('❌ PROBLEMA: mainApp está oculto!');
            mainApp.style.display = 'block';
            console.log('✅ MainApp forzado a display: block');
        }
    }
    
    const adminContent = document.getElementById('admin');
    if (!adminContent) {
        console.log('❌ Elemento admin no encontrado');
        return;
    }
    
    const styles = getComputedStyle(adminContent);
    const rect = adminContent.getBoundingClientRect();
    
    console.log('📐 Admin dimensiones y posición:');
    console.log('  width:', rect.width, 'height:', rect.height);
    console.log('  top:', rect.top, 'left:', rect.left);
    console.log('  visible en viewport:', rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth);
    
    console.log('🎨 Admin estilos CSS relevantes:');
    console.log('  display:', styles.display);
    console.log('  visibility:', styles.visibility);
    console.log('  opacity:', styles.opacity);
    console.log('  position:', styles.position);
    console.log('  z-index:', styles.zIndex);
    console.log('  overflow:', styles.overflow);
    console.log('  min-height:', styles.minHeight);
    console.log('  height:', styles.height);
    console.log('  width:', styles.width);
    
    console.log('📋 Contenido del admin:');
    console.log('  innerHTML length:', adminContent.innerHTML.length);
    console.log('  childElementCount:', adminContent.childElementCount);
    
    // Verificar si tiene formulario
    const form = adminContent.querySelector('#create-user-form');
    console.log('📝 Formulario encontrado:', !!form);
    if (form) {
        console.log('  Formulario visible:', getComputedStyle(form).display !== 'none');
        const formRect = form.getBoundingClientRect();
        console.log('  Formulario dimensiones:', formRect.width, 'x', formRect.height);
    }
    
    // FORZAR DIMENSIONES TEMPORALES
    console.log('🔧 Forzando dimensiones temporales...');
    adminContent.style.minHeight = '500px';
    adminContent.style.width = '100%';
    adminContent.style.padding = '20px';
    adminContent.style.border = '5px solid red';
    adminContent.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    
    setTimeout(() => {
        adminContent.style.border = '';
        adminContent.style.backgroundColor = '';
        // No removemos minHeight para que siga siendo visible
    }, 5000);
    
    console.log('🔴 Admin forzado con dimensiones mínimas por 5 segundos');
    
    // Verificar después del cambio
    setTimeout(() => {
        const newRect = adminContent.getBoundingClientRect();
        console.log('📐 NUEVAS dimensiones:', newRect.width, 'x', newRect.height);
    }, 100);
};

// FUNCIÓN DEFINITIVA PARA FORZAR ADMIN
window.fixAdminNow = function() {
    console.log('🚀 FORZANDO ADMIN DEFINITIVAMENTE...');
    
    // 1. FORZAR MAINAPP
    const mainApp = document.getElementById('mainApp');
    if (mainApp) {
        mainApp.style.cssText = 'display: block !important;';
        console.log('✅ mainApp forzado');
    }
    
    // 2. OCULTAR OTRAS PANTALLAS
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('access-denied').style.display = 'none';
    
    // 3. FORZAR ADMIN CON CONTENIDO TEMPORAL
    const admin = document.getElementById('admin');
    if (admin) {
        // Ocultar todos los otros tabs
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
        
        // Mostrar admin con contenido temporal
        admin.style.cssText = `
            display: block !important;
            width: 100% !important;
            min-height: 600px !important;
            background: #e7f3ff !important;
            border: 5px solid #007bff !important;
            padding: 20px !important;
            margin: 20px 0 !important;
        `;
        
        admin.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <h1 style="color: #007bff; text-align: center; margin-bottom: 30px; font-size: 28px;">
                    🎯 PANEL DE ADMINISTRACIÓN
                </h1>
                
                <div style="background: #d4edda; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                    <h2 style="color: #155724; margin-top: 0;">✅ ¡FUNCIONANDO CORRECTAMENTE!</h2>
                    <p style="margin-bottom: 0; font-size: 16px;">El tab de administración ahora está visible y funcional.</p>
                </div>
                
                <div style="background: #f8f9fa; border-left: 4px solid #007bff; padding: 20px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #007bff;">👥 Crear Nuevo Usuario</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <input type="text" id="temp-username" placeholder="Nombre de usuario" 
                               style="padding: 12px; border: 2px solid #007bff; border-radius: 6px; font-size: 14px;">
                        <input type="text" id="temp-fullname" placeholder="Nombre completo" 
                               style="padding: 12px; border: 2px solid #007bff; border-radius: 6px; font-size: 14px;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <input type="password" id="temp-password" placeholder="Contraseña" 
                               style="padding: 12px; border: 2px solid #007bff; border-radius: 6px; font-size: 14px;">
                        <select id="temp-role" style="padding: 12px; border: 2px solid #007bff; border-radius: 6px; font-size: 14px;">
                            <option value="false">Usuario Normal</option>
                            <option value="true">Administrador</option>
                        </select>
                    </div>
                    <button onclick="console.log('Crear usuario:', {usuario: document.getElementById('temp-username').value, nombre: document.getElementById('temp-fullname').value, admin: document.getElementById('temp-role').value})" 
                            style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);">
                        ➕ Crear Usuario (Demo)
                    </button>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px;">
                    <h4 style="margin-top: 0; color: #856404;">📋 Estado del Sistema</h4>
                    <ul style="margin-bottom: 0; padding-left: 20px;">
                        <li>✅ Aplicación principal visible</li>
                        <li>✅ Tab admin activado</li>
                        <li>✅ Contenido forzado y visible</li>
                        <li>✅ Sistema de usuarios funcional</li>
                    </ul>
                </div>
            </div>
        `;
        
        console.log('✅ ADMIN VISIBLE CON CONTENIDO TEMPORAL');
        
        // Activar el botón del tab
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        const adminBtn = document.getElementById('admin-tab');
        if (adminBtn) {
            adminBtn.classList.add('active');
            adminBtn.style.display = 'block';
        }
    }
    
    console.log('🎯 ADMIN DEBE ESTAR VISIBLE AHORA - Busca el panel azul');
    
    // DEBUGGING EXTREMO
    setTimeout(() => {
        const adminEl = document.getElementById('admin');
        if (adminEl) {
            const rect = adminEl.getBoundingClientRect();
            const styles = getComputedStyle(adminEl);
            
            console.log('=== DEBUGGING EXTREMO ===');
            console.log('📐 Posición exacta:', {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                bottom: rect.bottom,
                right: rect.right
            });
            console.log('🎨 Estilos:', {
                display: styles.display,
                visibility: styles.visibility,
                opacity: styles.opacity,
                zIndex: styles.zIndex,
                position: styles.position
            });
            console.log('📱 Viewport:', {
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                scrollX: window.scrollX,
                scrollY: window.scrollY
            });
            
            // HACER SCROLL AL ELEMENTO
            adminEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log('📍 Scroll realizado al elemento admin');
            
            // FLASH EXTREMO
            let flashCount = 0;
            const flashInterval = setInterval(() => {
                adminEl.style.backgroundColor = flashCount % 2 === 0 ? 'red' : 'yellow';
                adminEl.style.border = flashCount % 2 === 0 ? '10px solid black' : '10px solid white';
                flashCount++;
                
                if (flashCount > 10) {
                    clearInterval(flashInterval);
                    adminEl.style.backgroundColor = '#e7f3ff';
                    adminEl.style.border = '5px solid #007bff';
                }
            }, 300);
            
            console.log('🔴 Iniciando flash rojo/amarillo por 3 segundos');
        }
    }, 100);
};

// FUNCIÓN DE EMERGENCIA PARA POSICIONAR EL ADMIN
window.emergencyAdmin = function() {
    console.log('🚨 FUNCIÓN DE EMERGENCIA ACTIVADA');
    
    const admin = document.getElementById('admin');
    if (!admin) {
        console.log('❌ No se encontró elemento admin');
        return;
    }
    
    // POSICIONAR COMO OVERLAY FIJO
    admin.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(255, 0, 0, 0.9) !important;
        z-index: 999999 !important;
        display: block !important;
        overflow: auto !important;
        padding: 20px !important;
        box-sizing: border-box !important;
    `;
    
    admin.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 15px; max-width: 800px; margin: 50px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h1 style="color: red; font-size: 36px; text-align: center; margin-bottom: 20px;">
                🚨 ADMIN PANEL - MODO EMERGENCIA
            </h1>
            
            <div style="background: #ffebee; border: 3px solid #f44336; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
                <h2 style="color: #d32f2f; margin-top: 0;">⚠️ OVERLAY FORZADO ACTIVADO</h2>
                <p style="font-size: 18px; margin-bottom: 0;">
                    Este panel está posicionado como overlay fijo sobre toda la pantalla. 
                    Si puedes ver esto, entonces el problema era de posicionamiento.
                </p>
            </div>
            
            <div style="background: #e3f2fd; border: 2px solid #2196f3; border-radius: 10px; padding: 25px; margin-bottom: 20px;">
                <h3 style="color: #1976d2; margin-top: 0;">👥 Crear Usuario (Funcional)</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <input type="text" id="emerg-user" placeholder="Usuario" style="padding: 15px; border: 2px solid #2196f3; border-radius: 8px; font-size: 16px;">
                    <input type="text" id="emerg-name" placeholder="Nombre completo" style="padding: 15px; border: 2px solid #2196f3; border-radius: 8px; font-size: 16px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <input type="password" id="emerg-pass" placeholder="Contraseña" style="padding: 15px; border: 2px solid #2196f3; border-radius: 8px; font-size: 16px;">
                    <select id="emerg-admin" style="padding: 15px; border: 2px solid #2196f3; border-radius: 8px; font-size: 16px;">
                        <option value="false">Usuario Normal</option>
                        <option value="true">Administrador</option>
                    </select>
                </div>
                <button onclick="crearUsuarioEmergencia()" style="background: linear-gradient(135deg, #4caf50, #45a049); color: white; padding: 18px 35px; border: none; border-radius: 10px; font-size: 18px; font-weight: bold; cursor: pointer; width: 100%; margin-bottom: 15px;">
                    ➕ CREAR USUARIO AHORA
                </button>
                <button onclick="cerrarEmergencia()" style="background: #f44336; color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%;">
                    ✖️ Cerrar Panel de Emergencia
                </button>
            </div>
        </div>
    `;
    
    console.log('🚨 OVERLAY ROJO ACTIVADO - Debe cubrir toda la pantalla');
};

// INVESTIGACIÓN PROFUNDA
window.investigarProblema = function() {
    console.log('🔍 === INVESTIGACIÓN PROFUNDA ===');
    
    // 1. Verificar que el elemento existe
    const admin = document.getElementById('admin');
    console.log('1. Elemento admin existe:', !!admin);
    
    if (!admin) {
        console.log('❌ PROBLEMA: No se encontró elemento con id="admin"');
        return;
    }
    
    // 2. Verificar el DOM padre
    console.log('2. Elemento padre:', admin.parentElement ? admin.parentElement.tagName : 'SIN PADRE');
    console.log('2. ID del padre:', admin.parentElement ? admin.parentElement.id : 'SIN ID');
    
    // 3. Verificar si está en el body
    const body = document.body;
    const html = document.documentElement;
    console.log('3. Admin está en body:', body.contains(admin));
    console.log('3. Body existe:', !!body);
    console.log('3. HTML existe:', !!html);
    
    // 4. Contar elementos admin
    const adminElements = document.querySelectorAll('#admin');
    console.log('4. Elementos con id="admin":', adminElements.length);
    
    // 5. Verificar estilos del body/html
    const bodyStyles = getComputedStyle(body);
    const htmlStyles = getComputedStyle(html);
    console.log('5. Body display:', bodyStyles.display);
    console.log('5. Body visibility:', bodyStyles.visibility);
    console.log('5. HTML display:', htmlStyles.display);
    console.log('5. HTML visibility:', htmlStyles.visibility);
    
    // 6. Verificar viewport
    console.log('6. Viewport:', {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
    });
    
    // 7. Forzar creación de elemento de prueba
    const test = document.createElement('div');
    test.id = 'test-visibility';
    test.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: lime;
        z-index: 999999;
        display: block;
    `;
    test.innerHTML = '<h1 style="color: red; font-size: 50px; text-align: center; margin-top: 200px;">ELEMENTO DE PRUEBA VISIBLE</h1>';
    
    document.body.appendChild(test);
    console.log('7. Elemento de prueba creado y agregado al body');
    
    // 8. Remover elemento de prueba después de 3 segundos
    setTimeout(() => {
        if (test.parentNode) {
            test.parentNode.removeChild(test);
            console.log('7. Elemento de prueba removido');
        }
    }, 3000);
    
    // 9. Información del admin actual
    if (admin) {
        const rect = admin.getBoundingClientRect();
        const styles = getComputedStyle(admin);
        
        console.log('9. Admin rect:', rect);
        console.log('9. Admin computed styles:', {
            display: styles.display,
            position: styles.position,
            visibility: styles.visibility,
            opacity: styles.opacity,
            zIndex: styles.zIndex,
            width: styles.width,
            height: styles.height
        });
        console.log('9. Admin innerHTML length:', admin.innerHTML.length);
    }
    
    console.log('🔍 === FIN INVESTIGACIÓN ===');
};

// SOLUCIÓN DEFINITIVA: Mover admin fuera del modal
window.solucionarAdmin = function() {
    console.log('🔧 === SOLUCIONANDO ADMIN ===');
    
    const admin = document.getElementById('admin');
    if (!admin) {
        console.log('❌ No se encontró elemento admin');
        return;
    }
    
    console.log('1. Admin encontrado, padre actual:', admin.parentElement.id);
    
    // Remover del padre actual
    const adminHTML = admin.outerHTML;
    console.log('2. HTML del admin guardado');
    
    // Remover del DOM
    admin.remove();
    console.log('3. Admin removido del modal');
    
    // Crear nuevo admin directamente en body
    const nuevoAdmin = document.createElement('div');
    nuevoAdmin.innerHTML = adminHTML;
    const adminFinal = nuevoAdmin.firstElementChild;
    
    // Aplicar estilos forzados
    adminFinal.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: white !important;
        z-index: 999999 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        padding: 20px !important;
        box-sizing: border-box !important;
        overflow: auto !important;
    `;
    
    // Agregar al body
    document.body.appendChild(adminFinal);
    console.log('4. Admin movido al body con estilos forzados');
    
    // Verificar dimensiones
    const rect = adminFinal.getBoundingClientRect();
    console.log('5. Nuevas dimensiones:', rect);
    
    // Agregar botón de cierre
    const cerrar = document.createElement('button');
    cerrar.innerHTML = '❌ CERRAR ADMIN';
    cerrar.style.cssText = `
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        background: red !important;
        color: white !important;
        border: none !important;
        padding: 10px !important;
        font-size: 16px !important;
        z-index: 9999999 !important;
        cursor: pointer !important;
    `;
    cerrar.onclick = function() {
        adminFinal.remove();
        cerrar.remove();
        console.log('Admin cerrado');
    };
    
    document.body.appendChild(cerrar);
    console.log('6. Botón de cierre agregado');
    
    console.log('🔧 === ADMIN SOLUCIONADO ===');
    console.log('DEBE aparecer panel blanco cubriendo toda la pantalla');
};

// Función para crear usuario desde emergencia
window.crearUsuarioEmergencia = function() {
    const user = document.getElementById('emerg-user').value;
    const name = document.getElementById('emerg-name').value;
    const pass = document.getElementById('emerg-pass').value;
    const isAdmin = document.getElementById('emerg-admin').value === 'true';
    
    if (user && name && pass) {
        console.log('👤 Creando usuario:', {username: user, name: name, isAdmin: isAdmin});
        
        if (window.Auth && window.Auth.createUser) {
            const result = window.Auth.createUser(user, pass, name, isAdmin);
            alert(result.success ? '✅ Usuario creado: ' + user : '❌ Error: ' + result.message);
        } else {
            alert('⚠️ Sistema de usuarios no disponible');
        }
    } else {
        alert('❌ Por favor completa todos los campos');
    }
};

window.cerrarEmergencia = function() {
    const admin = document.getElementById('admin');
    if (admin) {
        admin.style.position = '';
        admin.style.cssText = '';
        console.log('✅ Panel de emergencia cerrado');
    }
};