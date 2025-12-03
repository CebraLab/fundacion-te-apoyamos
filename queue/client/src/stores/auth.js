import { defineStore, acceptHMRUpdate } from 'pinia'
import { api } from 'boot/axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    users: [],
    user: null,
    token: null,
    role: null,
    isAuthenticated: false,
    apiKeys: []
  }),

  getters: {
    getUser: (state) => state.user,
    getToken: (state) => state.token,
    getRole: (state) => state.role,
    isAuthenticated: (state) => state.isAuthenticated
  },

  actions: {
    async signIn(username, password) {
      try {
        const response = await api.post('/auth/sign-in', { username, password })

        // Guardar en localStorage según la estructura del router/auth.js
        localStorage.setItem('auth_token', response.data.access_token)
        localStorage.setItem('auth_user', JSON.stringify(response.data.user))
        localStorage.setItem('auth_role', response.data.user.user_type)

        // Actualizar estado del store
        this.user = response.data.user
        this.token = response.data.access_token
        this.role = response.data.user.user_type
        this.isAuthenticated = true

        return response.data
      } catch (error) {
        console.error('Sign in error:', error)
        throw error
      }
    },

    async me() {
      try {
        const response = await api.get('/auth/me')
        this.user = response.data
        return response.data
      } catch (error) {
        console.error('Me error:', error)
        throw error
      }
    },

    async signOut() {
      // Limpiar estado local
      this.user = null
      this.token = null
      this.role = null
      this.isAuthenticated = false

      // Limpiar localStorage
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('auth_role')
    },

    async fetchUsers() {
      const response = await api.get('/auth/users')
      this.users = response.data
      return response.data
    },

    async createUser(user) {
      const response = await api.post('/auth/users', user)
      return response.data
    },

    async deleteUser(username) {
      const response = await api.delete(`/auth/users/${username}`)
      return response.data
    },

    async fetchApiKeys() {
      const response = await api.get('/auth/api-keys')
      this.apiKeys = response.data
      return response.data
    },

    async createApiKey(apiKey) {
      const response = await api.post('/auth/api-keys', apiKey)
      return response.data
    },

    async deleteApiKey(name) {
      const response = await api.delete(`/auth/api-keys/${name}`)
      return response.data
    }
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
