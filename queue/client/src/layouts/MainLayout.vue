<template>
  <q-layout view="hHh Lpr lFf">
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      class="bg-blue-grey-10 text-white"
    >
      <q-list separator>
        <q-item
          clickable
          class="bg-blue-grey-9"
          @click="router.push({ name: 'queueStats' })"
        >
          <q-item-section class="q-py-lg text-center">
            <q-item-label class="text-h6 text-weight-bold">
              🎯 Queues Dashboard
            </q-item-label>
          </q-item-section>
        </q-item>

        <EssentialLink
          v-for="link in linksList"
          :key="link.title"
          v-bind="link"
        />
        <q-item />
      </q-list>

      <!-- Texto "by mcra02" en la parte inferior -->
      <q-list
        separator
        class="absolute-bottom"
      >
        <q-item class="text-center" />
        <EssentialLink
          v-for="link in aditionalLinksList"
          :key="link.title"
          v-bind="link"
        />
        <q-item
          clickable
          @click="openDocumentation"
        >
          <q-item-section>
            <q-item-label>Documentation</q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-avatar rounded>
              <q-icon name="open_in_new" />
            </q-avatar>
          </q-item-section>
        </q-item>
        <q-item class="text-center">
          <q-item-section>
            <q-btn
              color="primary"
              label="Sign Out"
              icon="logout"
              @click="signOut"
            />
          </q-item-section>
        </q-item>
        <q-item class="text-center">
          <q-item-section>
            <q-item-label class="text-grey-5 text-subtitle2">
              By mcra02
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import EssentialLink from 'components/EssentialLink.vue'
import { useQueuesStore } from 'stores/queues'
import { useAuthStore } from 'stores/auth'
import { useRouter } from 'vue-router'
import { useNotify } from 'composables/notify'

const authStore = useAuthStore()
const router = useRouter()
const notify = useNotify()

const queuesStore = useQueuesStore()

const loading = ref(false)

const fetchHealth = async () => {
  const response = await queuesStore.fetchHealth()
  console.log(response)
}

const fetchRouterQueues = async () => {
  loading.value = true
  await queuesStore.fetchRouterQueues()
  loading.value = false
}

const signOut = async () => {
  await authStore.signOut()
  notify.success('Signed out successfully')
  router.push({ name: 'home' })
}

const openDocumentation = () => {
  window.open('/api/v1/swagger', '_blank')
}

const linksList = computed(() => queuesStore.queuesRoutes)
const aditionalLinksList = computed(() => queuesStore.aditionalRoutes)

const leftDrawerOpen = ref(true)

onMounted(() => {
  fetchHealth()
  fetchRouterQueues()
})

</script>
