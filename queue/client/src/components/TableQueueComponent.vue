<!-- eslint-disable vue/no-template-shadow -->
<template>
  <div class="q-pa-md">
    <q-table
      v-model:pagination="pagination"
      flat
      bordered
      :rows="tableData"
      :columns="columns"
      :row-key="rowKey"
      :loading="loading"
      :filter="filter"
      class="bg-white full-width"
      @request="onRequest"
      @update:pagination="handlePaginationUpdate"
    >
      <!-- Custom header -->
      <template #top-left>
        <div class="text-h6 q-mb-md text-grey-8 text-uppercase">
          Queue: {{ queueName }}
        </div>
      </template>

      <template #top-right>
        <div class="row items-center q-gutter-sm">
          <q-select
            v-model="statuses"
            outlined
            multiple
            dense
            emit-value
            map-options
            use-chips
            :options="statusOptions"
            label="Status Filter"
            style="min-width: 250px;"
          >
            <template #selected-item="scope">
              <q-chip
                removable
                dense
                :tabindex="scope.tabindex"
                :color="getStatusColor(scope.opt.value)"
                text-color="white"
                class="q-ma-none"
                @remove="scope.removeAtIndex(scope.index)"
              >
                {{ scope.opt.label }}
              </q-chip>
            </template>
          </q-select>
          <q-input
            v-model="filter"
            borderless
            dense
            outlined
            debounce="300"
            placeholder="Search"
          >
            <template #append>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </template>

      <template #header="props">
        <q-tr :props="props">
          <q-th
            key="expand"
            auto-width
          />
          <q-th
            key="id"
            :props="props"
          >
            ID
          </q-th>
          <!-- Columnas dinámicas adicionales -->
          <q-th
            v-for="col in getDynamicColumns()"
            :key="col.name"
            :props="props"
          >
            {{ col.label }}
          </q-th>
          <q-th
            key="status"
            :props="props"
          >
            Estado
          </q-th>
          <q-th
            key="updated_at"
            :props="props"
          >
            Fecha Creación
          </q-th>
        </q-tr>
      </template>

      <!-- Custom body slot for expansion -->
      <template #body="props">
        <q-tr :props="props">
          <!-- Expansion button column -->
          <q-td
            key="expand"
            auto-width
          >
            <q-btn
              size="sm"
              :color="props.expand ? 'blue-5' : 'blue-7'"
              round
              dense
              unelevated
              :icon="props.expand ? 'expand_less' : 'expand_more'"
              @click="props.expand = !props.expand"
            />
          </q-td>


          <!-- ID column -->
          <q-td
            key="id"
            :props="props"
          >
            {{ props.row.id }}
          </q-td>

          <!-- Columnas dinámicas adicionales -->
          <q-td
            v-for="col in getDynamicColumns()"
            :key="col.name"
            :props="props"
          >
            {{ props.row[col.name] }}
          </q-td>

          <!-- Status column -->
          <q-td
            key="status"
            :props="props"
          >
            <q-chip
              :color="getStatusColor(props.row.status)"
              text-color="white"
              size="sm"
              :label="props.row.status"
            />
          </q-td>

          <!-- Created At column -->
          <q-td
            key="updated_at"
            :props="props"
          >
            {{ formatDate(props.row.updated_at) }}
          </q-td>
        </q-tr>

        <!-- Expanded row content -->
        <q-tr
          v-show="props.expand"
          :props="props"
        >
          <q-td colspan="100%">
            <div
              class="q-pa-md"
              :class="props.row.status === 'ERROR' ? 'bg-red-1' : props.row.status === 'SUCCESS' ? 'bg-green-1' : 'bg-grey-1'"
            >
              <div class="text-subtitle2 q-mb-md text-weight-bold">
                Queue Information
              </div>

              <!-- Tabs para organizar la información -->
              <q-tab-panels
                :model-value="getActiveTabForRow(props.row.id)"
                animated
                class="bg-white rounded"
                @update:model-value="(value) => setActiveTabForRow(props.row.id, value)"
              >
                <!-- Payload Data Tab -->
                <q-tab-panel
                  v-if="props.row.payload"
                  name="payload"
                  class="q-pa-md"
                >
                  <div class="text-caption text-grey-7 q-mb-sm">
                    Payload Data (JSON)
                  </div>
                  <JsonViewer
                    :value="props.row.payload"
                    :expanded="true"
                    copyable
                    boxed
                    sort
                    theme="dark"
                    @on-key-click="() => {}"
                  />
                </q-tab-panel>

                <!-- Error Data Tab -->
                <q-tab-panel
                  v-if="props.row.error_data"
                  name="error"
                  class="q-pa-md"
                >
                  <div class="text-caption text-grey-7 q-mb-sm">
                    Error Data (JSON)
                  </div>
                  <JsonViewer
                    :value="props.row.error_data"
                    :expanded="true"
                    copyable
                    boxed
                    sort
                    theme="dark"
                    @on-key-click="() => {}"
                  />
                </q-tab-panel>

                <!-- Stack Trace Tab -->
                <q-tab-panel
                  v-if="props.row.error_stack"
                  name="stack"
                  class="q-pa-md"
                >
                  <div class="text-caption text-grey-7 q-mb-sm">
                    Stack Trace
                  </div>
                  <JsonViewer
                    :value="props.row.error_stack"
                    :expanded="true"
                    copyable
                    boxed
                    sort
                    theme="dark"
                    @on-key-click="() => {}"
                  />
                </q-tab-panel>
              </q-tab-panels>

              <!-- Tabs Navigation -->
              <div class="q-mt-md">
                <q-tabs
                  :model-value="getActiveTabForRow(props.row.id)"
                  dense
                  class="q-tabs--bordered bg-white rounded"
                  :active-color="getActiveTabForRow(props.row.id) === 'payload' ? 'primary' : 'negative'"
                  :indicator-color="getActiveTabForRow(props.row.id) === 'payload' ? 'primary' : 'negative'"
                  align="justify"
                  @update:model-value="(value) => setActiveTabForRow(props.row.id, value)"
                >
                  <q-tab
                    v-if="props.row.payload"
                    name="payload"
                    label="Payload Data"
                    icon="data_object"
                  />
                  <q-tab
                    v-if="props.row.error_data"
                    name="error"
                    label="Error Data"
                    icon="error_outline"
                  />
                  <q-tab
                    v-if="props.row.error_stack"
                    name="stack"
                    label="Stack Trace"
                    icon="code"
                  />
                </q-tabs>
              </div>
            </div>
          </q-td>
        </q-tr>
      </template>

      <!-- No data slot -->
      <template #no-data>
        <div class="full-width row flex-center q-gutter-sm">
          <q-icon
            size="2em"
            name="sentiment_dissatisfied"
          />
          <span class="text-subtitle2">No hay datos disponibles</span>
        </div>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch, onUnmounted } from 'vue'
import { useQueuesStore } from 'stores/queues'

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

// Reactive data
const loading = ref(false)
const tableData = computed(() => queuesStore.queues[props.queueName] || [])
const tableMeta = computed(() => queuesStore.queuesMeta[props.queueName] || {})
// const pagination = computed(() => queuesStore.pagination)
// Map para almacenar el tab activo de cada fila
const activeTabs = ref(new Map())
const statuses = ref(['SUCCESS', 'FAILED'])
const statusOptions = ref([
  { label: 'SUCCESS', value: 'SUCCESS' },
  { label: 'FAILED', value: 'FAILED' },
  { label: 'PENDING', value: 'PENDING' },
])


// Pagination configuration
const pagination = ref({
  sortBy: 'updated_at',
  descending: true,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0
})

const filter = ref('')

const REFRESH_INTERVAL = 5000
const isFetching = ref(false)
let refreshTimeoutId = null
let pendingRequest = null
let isComponentActive = false

const buildFetchArgs = ({
  page,
  rowsPerPage,
  sortBy,
  descending,
  filterTerm,
  statusList,
  showLoading = true
}) => ({
  page: page ?? pagination.value.page,
  rowsPerPage: rowsPerPage ?? pagination.value.rowsPerPage,
  sortBy: sortBy ?? pagination.value.sortBy,
  descending: descending ?? pagination.value.descending,
  filterTerm: filterTerm ?? filter.value,
  statusList: statusList ?? statuses.value,
  showLoading
})

const fetchQueueData = async (args = {}) => {
  if (!isComponentActive) {
    return
  }

  const requestArgs = buildFetchArgs(args)

  if (isFetching.value) {
    pendingRequest = requestArgs
    return
  }

  isFetching.value = true

  if (requestArgs.showLoading) {
    loading.value = true
  }

  try {
    await queuesStore.fetchQueues(
      props.queueName,
      requestArgs.page,
      requestArgs.rowsPerPage,
      {
        sortBy: requestArgs.sortBy,
        descending: requestArgs.descending,
        filter: requestArgs.filterTerm,
        statuses: requestArgs.statusList
      }
    )
  } catch (error) {
    console.error('Error fetching queue data:', error)
  } finally {
    if (requestArgs.showLoading) {
      loading.value = false
    }

    isFetching.value = false
  }

  if (pendingRequest) {
    const nextRequest = pendingRequest
    pendingRequest = null
    await fetchQueueData(nextRequest)
  }
}

watch(tableMeta, (newMeta) => {
  if (newMeta) {
    pagination.value = {
      ...pagination.value,
      page: newMeta.currentPage || 1,
      rowsPerPage: newMeta.itemsPerPage || 10,
      rowsNumber: newMeta.totalItems
    }
  }
}, { immediate: false })

// Table columns definition
const columns = computed(() => {
  // Columnas fijas que siempre existen
  const fixedColumns = [
    {
      name: 'expand',
      label: '',
      field: 'expand',
      align: 'center',
      required: true,
      style: 'width: 50px'
    },
    {
      name: 'id',
      label: 'ID',
      field: 'id',
      align: 'left',
      sortable: true,
      required: true,
      style: 'width: 200px'
    },
    {
      name: 'status',
      label: 'Estado',
      field: 'status',
      align: 'center',
      sortable: true,
      required: true
    },
    {
      name: 'updated_at',
      label: 'Fecha Ejecución',
      field: 'updated_at',
      align: 'center',
      sortable: true,
      required: true
    }
  ]

  // Detectar columnas dinámicas adicionales
  if (tableData.value.length > 0) {
    const firstRow = tableData.value[0]
    const dynamicColumns = []

    // Obtener todas las propiedades del primer registro
    Object.keys(firstRow).forEach(key => {
      // Excluir las columnas fijas y las que van en el expand
      if (!['id', 'status', 'updated_at', 'payload', 'error_data', 'error_stack', 'updated_at'].includes(key)) {
        dynamicColumns.push({
          name: key,
          label: key,
          field: key,
          align: 'left',
          sortable: true,
          required: false
        })
      }
    })

    // Insertar las columnas dinámicas después de 'id' y antes de 'status'
    return [
      ...fixedColumns.slice(0, 2), // expand, id
      ...dynamicColumns,           // columnas dinámicas
      ...fixedColumns.slice(2)     // status, updated_at
    ]
  }

  return fixedColumns
})

// Función para obtener las columnas dinámicas
const getDynamicColumns = () => {
  if (tableData.value.length > 0) {
    const firstRow = tableData.value[0]
    const dynamicColumns = []

    Object.keys(firstRow).forEach(key => {
      if (!['id', 'status', 'created_at', 'payload', 'error_data', 'error_stack', 'created_at', 'queue_name', 'updated_at'].includes(key)) {
        console.log('key', key)
        dynamicColumns.push({
          name: key,
          label: key,
          field: key
        })
      }
    })
    console.log('dynamicColumns', dynamicColumns)

    return dynamicColumns
  }

  return []
}

// Computed properties
const rowKey = 'id'

// Methods
const onRequest = async (requestProps) => {
  const { page, rowsPerPage, sortBy, descending } = requestProps.pagination

  pagination.value = {
    ...pagination.value,
    page,
    rowsPerPage,
    sortBy,
    descending
  }

  await fetchQueueData({
    page,
    rowsPerPage,
    sortBy,
    descending,
    showLoading: true
  })
}

const handlePaginationUpdate = (newPagination) => {
  pagination.value = {
    ...pagination.value,
    ...newPagination
  }
}

const getStatusColor = (status) => {
  switch (status) {
    case 'SUCCESS':
      return 'positive'
    case 'FAILED':
      return 'negative'
    case 'PENDING':
      return 'grey'
    default:
      return 'warning'
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Función para obtener el tab activo de una fila específica
const getActiveTabForRow = (rowId) => {
  if (!activeTabs.value.has(rowId)) {
    // Determinar el tab inicial basado en la existencia de errores
    const row = tableData.value.find(r => r.id === rowId)
    if (row) {
      let initialTab = 'payload'
      if (row.error_data || row.error_stack) {
        initialTab = 'error'
      }
      activeTabs.value.set(rowId, initialTab)
    }
  }
  return activeTabs.value.get(rowId) || 'payload'
}

// Función para cambiar el tab activo de una fila específica
const setActiveTabForRow = (rowId, tabName) => {
  activeTabs.value.set(rowId, tabName)
}

// Función para actualización automática
const startAutoRefresh = () => {
  const scheduleNext = () => {
    if (!isComponentActive) {
      return
    }

    refreshTimeoutId = setTimeout(async () => {
      await fetchQueueData({
        showLoading: false
      })

      scheduleNext()
    }, REFRESH_INTERVAL)
  }

  scheduleNext()
}

// Función para detener la actualización automática
const stopAutoRefresh = () => {
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId)
    refreshTimeoutId = null
  }
  pendingRequest = null
}

// Lifecycle
onMounted(async () => {
  isComponentActive = true

  await fetchQueueData({
    showLoading: true
  })

  // Iniciar actualización automática
  startAutoRefresh()
})

// Limpiar el interval cuando el componente se desmonte
onUnmounted(() => {
  isComponentActive = false
  stopAutoRefresh()
})
</script>

<style lang="scss" scoped>

</style>
