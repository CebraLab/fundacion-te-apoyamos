<template>
  <q-page class="q-pa-md">
    <q-card
      v-for="queue in queues"
      :key="queue.queueName"
      flat
      bordered
      class="my-card q-mb-md"
    >
      <q-card-section>
        <ChartsComponent
          :queue-name="queue.queueName"
          :title="queue.title"
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useQueuesStore } from 'stores/queues'

import ChartsComponent from 'components/ChartsComponent.vue'

const queuesStore = useQueuesStore()



const queues = computed(() => queuesStore.queuesRoutes)


</script>
