<template>
  <q-list
    :bordered="queueProcessing.length > 0"
    class="q-mx-md"
  >
    <q-expansion-item
      v-for="item in queueProcessing"
      :key="item.id"
      class="bg-grey-2"
    >
      <template #header>
        <q-item-section avatar>
          <q-spinner-bars
            color="primary"
            size="2em"
          />
        </q-item-section>

        <q-item-section>
          <div class="text-h6">
            {{ getMainIdentifier(item) }}
          </div>
          <div class="text-caption text-grey-6">
            ID: {{ item.id }}
          </div>
        </q-item-section>

        <q-item-section side>
          <div class="row items-center">
            <q-chip
              :color="getStatusColor(item.status)"
              text-color="white"
              size="sm"
            >
              {{ item.status }}
            </q-chip>
          </div>
        </q-item-section>
      </template>

      <q-card>
        <q-card-section class="q-pa-sm">
          <div class="row q-gutter-sm">
            <!-- Propiedades extra -->
            <div class="col-12 q-mb-sm q-pr-sm">
              <div class="text-weight-bold text-caption q-mb-xs">
                Propiedades:
              </div>
              <div class="row">
                <div
                  v-for="prop in getExtraProperties(item)"
                  :key="prop"
                  class="col"
                >
                  <q-card
                    flat
                    bordered
                    class="q-pa-xs"
                  >
                    <div class="row items-center q-gutter-xs">
                      <div>
                        <span class="text-caption text-grey-6">{{ prop }}:</span>
                        <span class="text-caption q-ml-xs">{{ item[prop] }}</span>
                      </div>
                    </div>
                  </q-card>
                </div>
              </div>
            </div>

            <!-- Información del payload -->
            <div class="col-12 q-mb-sm">
              <div class="text-weight-bold text-caption q-mb-xs">
                Payload:
              </div>
              <div class="q-pa-xs rounded">
                <JsonViewer
                  :value="item.payload"
                  :expanded="true"
                  copyable
                  boxed
                  sort
                  theme="dark"
                  @on-key-click="() => {}"
                />
              </div>
            </div>

            <!-- Fechas -->
            <div class="col">
              <q-card
                flat
                bordered
                class="q-pa-xs"
              >
                <div class="row items-center q-gutter-xs">
                  <q-icon
                    name="schedule"
                    color="primary"
                    size="16px"
                  />
                  <div>
                    <span class="text-caption text-grey-6">Created:</span>
                    <span class="text-caption q-ml-xs">{{ new Date(item.created_at).toLocaleString() }}</span>
                  </div>
                </div>
              </q-card>
            </div>
            <div class="col">
              <q-card
                flat
                bordered
                class="q-pa-xs"
              >
                <div class="row items-center q-gutter-xs">
                  <q-icon
                    name="update"
                    color="primary"
                    size="16px"
                  />
                  <div>
                    <span class="text-caption text-grey-6">Updated:</span>
                    <span class="text-caption q-ml-xs">{{ new Date(item.updated_at).toLocaleString() }}</span>
                  </div>
                </div>
              </q-card>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-expansion-item>
  </q-list>
</template>

<script setup>
import { useQueuesStore } from 'stores/queues'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import {JsonViewer} from "vue3-json-viewer"
import "vue3-json-viewer/dist/vue3-json-viewer.css";

const queuesStore = useQueuesStore()

// Props
const props = defineProps({
  queueName: {
    type: String,
    required: true
  }
})

const queueProcessing = computed(() => queuesStore.queuesProcessing[props.queueName] || [])
const autoRefreshInterval = ref(null)

const fetchQueueProcessing = async () => {
  await queuesStore.fetchQueueProcessing(props.queueName)
}

// Función para obtener el identificador principal (objectId u otra propiedad extra)
const getMainIdentifier = (item) => {
  // Propiedades estándar que siempre vienen
  const standardProps = ['id', 'status', 'created_at', 'payload', 'error_data', 'error_stack', 'queue_name', 'updated_at']

  // Buscar propiedades extra (que no están en la lista estándar)
  const extraProps = Object.keys(item).filter(key => !standardProps.includes(key))

    // Mostrar todas las propiedades extra concatenadas
  if (extraProps.length > 0) {
    const extraPropsText = extraProps
      .map(prop => `${prop}: ${item[prop]}`)
      .join(' - ')
    return extraPropsText
  }

  // Fallback si no hay propiedades extra
  return 'Processing Item'
}

// Función para obtener todas las propiedades extra
const getExtraProperties = (item) => {
  const standardProps = ['id', 'status', 'created_at', 'payload', 'error_data', 'error_stack', 'queue_name', 'updated_at']
  return Object.keys(item).filter(key => !standardProps.includes(key))
}

// Función para obtener el color del status
const getStatusColor = (status) => {
  switch (status?.toUpperCase()) {
    case 'PROCESSING':
      return 'blue'
    case 'SUCCESS':
      return 'positive'
    case 'FAILED':
    case 'ERROR':
      return 'negative'
    case 'PENDING':
      return 'orange'
    default:
      return 'grey'
  }
}

onMounted(() => {
  fetchQueueProcessing() // Primera carga
  autoRefreshInterval.value = setInterval(() => fetchQueueProcessing(), 5000) // Auto-refresh cada 5 segundos
})

onUnmounted(() => {
  if (autoRefreshInterval.value) {
    clearInterval(autoRefreshInterval.value)
    autoRefreshInterval.value = null
  }
})

</script>

<style lang="scss" scoped>

</style>
