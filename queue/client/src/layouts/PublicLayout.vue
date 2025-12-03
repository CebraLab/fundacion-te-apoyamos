<template>
  <q-layout view="hHh Lpr lFf">
    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer>
      <!-- Texto "by mcra02" en la parte inferior -->
      <q-item class="absolute-bottom text-center">
        <q-item-section>
          <q-item-label class="text-grey-5 text-subtitle2">
            By mcra02
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { useQueuesStore } from 'stores/queues'
import { onMounted } from 'vue'

const queuesStore = useQueuesStore()

const fetchHealth = async () => {
  const response = await queuesStore.fetchHealth()
  console.log(response)
}

onMounted(() => {
  fetchHealth()
})
</script>
