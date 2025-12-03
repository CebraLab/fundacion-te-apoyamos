import { defineBoot } from '#q-app/wrappers'
import { LocalStorage, Notify } from 'quasar'
import axios from 'axios'


// 1. URL pública/proxy para el navegador. El proxy reescribirá /api por /api/v1.
const PUBLIC_API_URL = '/api'
// 2. URL interna completa para el servidor (SSR). Debe incluir el prefijo de NestJS.
const PRIVATE_API_HOST = (process.env.API_BASE_URL || 'http://rmq_app_queue:3000').replace(/\/$/, '')
const PRIVATE_API_URL = `${PRIVATE_API_HOST.replace(/\/$/, '')}/api/v1`
// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
const api = axios.create({
  baseURL: process.env.SERVER ? PRIVATE_API_URL : PUBLIC_API_URL
})

console.log('[axios] baseURL set to', api.defaults.baseURL, '| server:', process.env.SERVER)

export default defineBoot(({ app, router }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API

  // Interceptor para agregar token a las peticiones
  api.interceptors.request.use(
    config => {
      const token = LocalStorage.getItem('auth_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    error => {
      return Promise.reject(error)
    }
  )

  // Interceptor para manejar respuestas y errores
  api.interceptors.response.use(
    response => response,
    error => {
      const status = error.response ? error.response.status : null

      if (status === 401) {
        // Handle unauthorized access - limpiar datos de autenticación
        LocalStorage.remove('auth_token')
        LocalStorage.remove('auth_user')
        LocalStorage.remove('auth_role')

        Notify.create({
          color: 'red-5',
          textColor: 'white',
          icon: 'close',
          message: 'Sesión expirada. Por favor, inicia sesión nuevamente.'
        })

        // Redirigir al login
        router.push({ name: 'home' })
      } else if (status === 404) {
        // Handle not found errors
        Notify.create({
          color: 'orange-5',
          textColor: 'white',
          icon: 'warning',
          message: 'Recurso no encontrado'
        })
      } else if (status >= 500) {
        // Handle server errors
        Notify.create({
          color: 'red-5',
          textColor: 'white',
          icon: 'error',
          message: 'Error del servidor. Intenta nuevamente.'
        })
      } else {
        // Handle other errors
        Notify.create({
          color: 'red-5',
          textColor: 'white',
          icon: 'error',
          message: 'Error inesperado'
        })
      }

      return Promise.reject(error)
    }
  )
})

export { api }
