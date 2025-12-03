<template>
  <q-card
    flat
    bordered
    class="my-card"
  >
    <q-card-section>
      <div class="text-h6 text-center">
        Login
      </div>
    </q-card-section>

    <q-separator inset />

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

      <q-card-section>
        <q-btn
          class="full-width q-mb-md"
          unelevated
          label="Submit"
          type="submit"
          color="primary"
          :loading="isLoading"
        />
        <q-btn
          class="full-width"
          label="Reset"
          type="reset"
          color="primary"
          outline
          :disable="isLoading"
        />
      </q-card-section>
    </q-form>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from 'stores/auth'
import { useNotify } from 'composables/notify'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const notify = useNotify()
const router = useRouter()

const isPwd = ref(true)
const isLoading = ref(false)

const form = ref({
  username: '',
  password: ''
})

const onSubmit = async () => {
  isLoading.value = true
  try {
    await authStore.signIn(form.value.username, form.value.password)
    onReset()
    notify.success('Login successful')
    setTimeout(() => {
      router.push({ name: 'queueStats' })
      isLoading.value = false
    }, 2000)
  } catch {
    notify.danger('Login failed')
    isLoading.value = false
  }
}

const onReset = () => {
  form.value = {
    username: '',
    password: ''
  }
}
</script>

<style lang="scss" scoped></style>
