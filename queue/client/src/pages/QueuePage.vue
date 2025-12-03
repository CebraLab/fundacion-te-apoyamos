<template>
  <q-page class="q-pa-md">
    <ChartsComponent :queue-name="queueName" />
    <ListProcessingComponent :queue-name="queueName" />
    <TableQueueComponent :queue-name="queueName" />
  </q-page>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'

import ListProcessingComponent from 'components/ListProcessingComponent.vue'
import TableQueueComponent from 'components/TableQueueComponent.vue'
import ChartsComponent from 'components/ChartsComponent.vue'

const route = useRoute()
const queueName = computed(() => route.params.queueName)
</script>
