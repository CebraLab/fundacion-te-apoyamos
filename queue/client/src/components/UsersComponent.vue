<template>
  <div class="q-pa-md">
    <div class="text-h5 q-mb-md">
      Users
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
            v-model="form.username"
            outlined
            label="Username"
          />
          <q-input
            v-model="form.password"
            outlined
            label="Password"
            :type="isPwd ? 'password' : 'text'"
          >
            <template #append>
              <q-icon
                :name="isPwd ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="isPwd = !isPwd"
              />
            </template>
          </q-input>
        </q-card-section>

        <q-card-section class="q-gutter-md text-right">
          <q-btn
            unelevated
            label="Create User"
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
      :rows="users"
      :columns="columns"
      row-key="name"
      :loading="loading"
    >
      <template #body-cell-actions="props">
        <q-td :props="props">
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
              Delete user
            </q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from 'stores/auth'
import { useNotify } from 'composables/notify'
import { useQuasar } from 'quasar'

const authStore = useAuthStore()
const notify = useNotify()
const $q = useQuasar()

// Estado reactivo
const users = computed(() => authStore.users)
const loading = ref(false)

const form = ref({
  username: '',
  password: '',
})

const isPwd = ref(true)
const isLoading = ref(false)

const onSubmit = async () => {
  isLoading.value = true
  try {
    await authStore.createUser(form.value)
    onReset()
    notify.success('User created successfully')
    await loadUsers()
  } catch {
    notify.error('Error creating user')
  } finally {
    isLoading.value = false
  }
}

const onReset = () => {
  form.value = {
    username: '',
    password: '',
  }
}


// Definición de columnas
const columns = [
  {
    name: 'username',
    required: true,
    label: 'User',
    align: 'left',
    field: 'username',
    sortable: true
  },
  {
    name: 'user_type',
    label: 'User Type',
    align: 'center',
    field: 'user_type',
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
    field: 'actions',
    sortable: false
  }
]


// Función para cargar usuarios
const loadUsers = async () => {
  loading.value = true
  try {
    await authStore.fetchUsers()
  } catch  {
    notify.error('Error fetching users')
  } finally {
    loading.value = false
  }
}

// Función para confirmar eliminación
const confirmDelete = (user) => {
  $q.dialog({
    title: 'Confirm deletion',
    message: `Are you sure you want to delete user "${user.username}"?`,
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
    deleteUser(user)
  })
}

// Función para eliminar usuario
const deleteUser = async (user) => {
  loading.value = true
  try {
    await authStore.deleteUser(user.username)
    notify.success(`User "${user.username}" deleted successfully`)
    await loadUsers() // Recargar la lista
  } catch (error) {
    notify.error('Error deleting user')
    console.error('Error deleting user:', error)
  } finally {
    loading.value = false
  }
}


// Cargar usuarios al montar el componente
onMounted(() => {
  loadUsers()
})
</script>

<style lang="scss" scoped>

</style>
