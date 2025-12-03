<template>
  <div class="q-pa-md">
    <div class="text-h5 q-mb-md">
      Api Keys
    </div>

    <q-card
      flat
      bordered
      class="my-card q-mb-md"
    >
      <q-form
        @submit="onSubmit"
        @reset="onReset"
      >
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="form.name"
            outlined
            label="Name"
          />
        </q-card-section>

        <q-card-section class="q-gutter-md text-right">
          <q-btn
            unelevated
            label="Create Api Key"
            type="submit"
            color="primary"
            :loading="isLoading"
          />
          <q-btn
            label="Reset"
            type="reset"
            color="primary"
            outline
            :disable="isLoading"
          />
        </q-card-section>
      </q-form>
    </q-card>

    <q-table
      flat
      bordered
      title=""
      :rows="apiKeys"
      :columns="columns"
      row-key="name"
      :loading="loading"
    >
      <template #body-cell-key="props">
        <q-td :props="props">
          <span
            v-if="!visibleKeys[props.row.name]"
            class="text-muted"
          >
            {{ getMaskedKey(props.row.key) }}
          </span>
          <span
            v-else
            class="text-weight-medium"
          >
            {{ props.row.key }}
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td
          :props="props"
          class=""
        >
          <div class="row q-gutter-xs justify-end">
            <q-btn
              round
              unelevated
              color="primary"
              :icon="visibleKeys[props.row.name] ? 'visibility_off' : 'visibility'"
              size="sm"
              @click="toggleKeyVisibility(props.row.name)"
            >
              <q-tooltip>
                {{ visibleKeys[props.row.name] ? 'Hide key' : 'Show key' }}
              </q-tooltip>
            </q-btn>
            <q-btn
              round
              unelevated
              color="teal"
              icon="content_copy"
              size="sm"
              @click="copyKey(props.row.key)"
            >
              <q-tooltip>
                Copy key
              </q-tooltip>
            </q-btn>
            <q-btn
              v-if="props.row.user_type !== 'ADMIN'"
              round
              unelevated
              color="red-5"
              icon="delete"
              size="sm"
              @click="confirmDelete(props.row)"
            >
              <q-tooltip>
                Delete api key
              </q-tooltip>
            </q-btn>
          </div>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from 'stores/auth'
import { useNotify } from 'composables/notify'
import { useQuasar, copyToClipboard } from 'quasar'

const authStore = useAuthStore()
const notify = useNotify()
const $q = useQuasar()

// Estado reactivo
const apiKeys = computed(() => authStore.apiKeys)
const loading = ref(false)
const isLoading = ref(false)

// Estado para controlar la visibilidad de las keys
const visibleKeys = ref({})

const form = ref({
  name: '',
})



const onSubmit = async () => {
  isLoading.value = true
  try {
    await authStore.createApiKey(form.value)
    onReset()
    notify.success('Api key created successfully')
    await loadApiKeys()
  } catch {
    notify.error('Error creating api key')
  } finally {
    isLoading.value = false
  }
}

const onReset = () => {
  form.value = {
    name: '',
  }
}

// Función para toggle de visibilidad de keys
const toggleKeyVisibility = (keyName) => {
  visibleKeys.value[keyName] = !visibleKeys.value[keyName]
}

// Función para enmascarar la key (mostrar solo los primeros caracteres)
const getMaskedKey = (key) => {
  if (!key) return ''
  const visibleChars = 8
  const maskedChars = key.length - visibleChars
  if (maskedChars <= 0) return key
  return key.substring(0, visibleChars) + '*'.repeat(maskedChars)
}

// Función para copiar la key al portapapeles
const copyKey = async (key) => {
  try {
    await copyToClipboard(key)
    notify.success('API key copied to clipboard')
  } catch (error) {
    notify.error('Failed to copy API key')
    console.error('Error copying to clipboard:', error)
  }
}


// Definición de columnas
const columns = [
  {
    name: 'name',
    required: true,
    label: 'Name',
    align: 'left',
    field: 'name',
    sortable: true
  },
  {
    name: 'key',
    label: 'Private Key',
    align: 'left',
    field: 'key',
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'right',
    field: 'actions',
    sortable: false
  }
]


// Función para cargar usuarios
const loadApiKeys = async () => {
  loading.value = true
  try {
    await authStore.fetchApiKeys()
  } catch  {
    notify.error('Error fetching api keys')
  } finally {
    loading.value = false
  }
}

// Función para confirmar eliminación
const confirmDelete = (apiKey) => {
  $q.dialog({
    title: 'Confirm deletion',
    message: `Are you sure you want to delete api key "${apiKey.name}"?`,
    persistent: true,
    ok: {
      label: 'Delete',
      color: 'negative'
    },
    cancel: {
      label: 'Cancel',
      color: 'grey'
    }
  }).onOk(() => {
    deleteApiKey(apiKey)
  })
}

// Función para eliminar usuario
const deleteApiKey = async (apiKey) => {
  loading.value = true
  try {
    await authStore.deleteApiKey(apiKey.name)
    notify.success(`Api key "${apiKey.name}" deleted successfully`)
    await loadApiKeys() // Recargar la lista
  } catch (error) {
    notify.error('Error deleting user')
    console.error('Error deleting user:', error)
  } finally {
    loading.value = false
  }
}


// Cargar usuarios al montar el componente
onMounted(() => {
  loadApiKeys()
})
</script>

<style lang="scss" scoped>

</style>
