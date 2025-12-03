import { LocalStorage } from 'quasar'
import { useAuthStore } from 'stores/auth'

// Configuración de autenticación
const AUTH_CONFIG = {
  TOKEN_KEY: 'auth_token',
  USER_KEY: 'auth_user',
  ROLE_KEY: 'auth_role'
}

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = ['home']


export const AuthModule = (router) => {
  router.beforeEach(async (to, from, next) => {
    try {
      // Limpiar console.warn en producción
      if (process.env.NODE_ENV === 'development') {
        console.log('🛡️ Auth Guard - Route:', to.name, 'Meta:', to.meta)
      }

      // Verificar si la ruta es pública
      if (isPublicRoute(to)) {
        return next()
      }

      // Verificar si el usuario está autenticado
      const isAuthenticated = await checkAuthentication()

      if (!isAuthenticated) {
        // Usuario no autenticado, redirigir al login
        return redirectToLogin(to, next)
      }

      // Verificar permisos de rol si la ruta los requiere
      if (to.meta.roles && !hasRequiredRole(to.meta.roles)) {
        return redirectToUnauthorized(to, next)
      }

      // Verificar si la ruta requiere autenticación específica
      if (to.meta.auth && !isAuthenticated) {
        return redirectToLogin(to, next)
      }

      // Usuario autenticado y autorizado
      return next()

    } catch (error) {
      console.error('❌ Auth Guard Error:', error)

      // En caso de error, limpiar datos de sesión y redirigir al login
      clearAuthData()
      return redirectToLogin(to, next)
    }
  })

  // Guardia después de la navegación (simplificado)
  router.afterEach(() => {
    // No hay funcionalidad adicional necesaria
  })
}

/**
 * Verifica si la ruta es pública
 */
function isPublicRoute(route) {
  return PUBLIC_ROUTES.includes(route.name) || route.meta?.public === true
}

/**
 * Verifica la autenticación del usuario
 */
async function checkAuthentication() {
  try {
    const token = LocalStorage.getItem(AUTH_CONFIG.TOKEN_KEY)
    const user = LocalStorage.getItem(AUTH_CONFIG.USER_KEY)
    const role = LocalStorage.getItem(AUTH_CONFIG.ROLE_KEY)

    if (!token || !user || !role) {
      return false
    }

    // Verificar que el token sea válido (opcional: llamada al backend)
    if (process.env.NODE_ENV === 'production') {
      const isValid = await validateTokenWithBackend()
      if (!isValid) {
        clearAuthData()
        return false
      }
    }

    return true

  } catch (error) {
    console.error('❌ Error checking authentication:', error)
    return false
  }
}





/**
 * Valida el token con el backend usando el store de autenticación
 */
async function validateTokenWithBackend() {
  try {
    const authStore = useAuthStore()
    await authStore.me()
    return true
  } catch (error) {
    console.error('❌ Error validating token:', error)
    return false
  }
}

/**
 * Verifica si el usuario tiene el rol requerido
 */
function hasRequiredRole(requiredRoles) {
  const role = LocalStorage.getItem(AUTH_CONFIG.ROLE_KEY)
  if (!role) return false

  // Verificar si el usuario tiene uno de los roles requeridos
  return requiredRoles.includes(role)
}

/**
 * Redirige al usuario al login
 */
function redirectToLogin(to, next) {
  // Guardar la ruta original para redirigir después del login
  if (to.name !== 'home') {
    LocalStorage.set('redirect_after_login', to.fullPath)
  }

  return next({
    name: 'home',
    query: {
      redirect: to.fullPath,
      message: 'Please login to continue'
    }
  })
}

/**
 * Redirige al usuario a página de acceso no autorizado
 */
function redirectToUnauthorized(to, next) {
  return next({
    name: 'unauthorized',
    query: {
      required: to.meta.roles?.join(', '),
      attempted: to.fullPath
    }
  })
}

/**
 * Limpia todos los datos de autenticación
 */
function clearAuthData() {
  LocalStorage.remove(AUTH_CONFIG.TOKEN_KEY)
  LocalStorage.remove(AUTH_CONFIG.USER_KEY)
  LocalStorage.remove(AUTH_CONFIG.ROLE_KEY)

  // Limpiar store de autenticación si existe
  try {
    const authStore = useAuthStore()
    if (authStore && typeof authStore.logout === 'function') {
      authStore.logout()
    }
  } catch {
    console.warn('⚠️ Auth store not available for cleanup')
  }
}



/**
 * Función de utilidad para verificar si el usuario está autenticado
 */
export function isUserAuthenticated() {
  return checkAuthentication()
}

/**
 * Función de utilidad para obtener el usuario actual
 */
export function getCurrentUser() {
  try {
    const user = LocalStorage.getItem(AUTH_CONFIG.USER_KEY)
    return user ? JSON.parse(user) : null
  } catch (error) {
    console.error('❌ Error getting current user:', error)
    return null
  }
}

/**
 * Función de utilidad para obtener el rol actual
 */
export function getCurrentRole() {
  return LocalStorage.getItem(AUTH_CONFIG.ROLE_KEY)
}

/**
 * Función de utilidad para obtener el token actual
 */
export function getCurrentToken() {
  return LocalStorage.getItem(AUTH_CONFIG.TOKEN_KEY)
}

/**
 * Función de utilidad para cerrar sesión
 */
export function logout(routerInstance) {
  clearAuthData()

  // Redirigir al login
  if (routerInstance && routerInstance.currentRoute.value.name !== 'home') {
    routerInstance.push({ name: 'home' })
  }
}
