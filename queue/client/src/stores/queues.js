import { defineStore, acceptHMRUpdate } from 'pinia'
import { api } from 'boot/axios'

export const useQueuesStore = defineStore('queues', {
  state: () => ({
    queues: {},
    queuesMeta: {},
    chartStats: {},
    queuesRoutes: [],
    aditionalRoutes: [],
    queuesProcessing: [],
  }),

  getters: {
    meta: (state) => state.queuesMeta,
  },

  actions: {
    async fetchHealth() {
      const response = await api.get('/client/health')
      return response.data
    },

    async fetchRouterQueues() {
      const response = await api.get('/client/queues')
      this.queuesRoutes = response.data.routerQueues
      this.aditionalRoutes = response.data.aditionalRouters
      return response.data
    },

    async fetchQueues(queueName, page = 1, limit = 10, options = {}) {
      const response = await api.post(`/client/queues/${queueName}`, {
        page,
        limit,
        sortBy: options.sortBy,
        descending: options.descending,
        filter: options.filter,
        statuses: options.statuses
      })
      this.queues[queueName] = response.data.items
      this.queuesMeta[queueName] = response.data.meta
    },

    async fetchChartStats(queueName, period = 'day', timezone = '-5') {
      try {
        const params = { period }
        if (timezone) {
          params.timezone = timezone
        }

        const response = await api.get(`/client/queues/${queueName}/stats`, {
          params
        })

        this.chartStats[queueName] = {
          data: response.data.data || [],
          summary: response.data.summary || {
            totalSuccess: 0,
            totalErrors: 0,
            successRate: 0
          }
        }

        return this.chartStats[queueName]
      } catch (error) {
        console.error('Error fetching chart stats:', error)
        // Fallback to empty data
        this.chartStats[queueName] = {
          data: [],
          summary: {
            totalSuccess: 0,
            totalErrors: 0,
            successRate: 0
          }
        }
        return this.chartStats[queueName]
      }
    },

    async fetchQueueProcessing(queueName) {
      const response = await api.get(`/client/queues/${queueName}/processing`)
      this.queuesProcessing[queueName] = response.data
      return response.data
    }
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useQueuesStore, import.meta.hot))
}
