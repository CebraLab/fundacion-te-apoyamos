<template>
  <q-item
    clickable
    :class="{
      'bg-blue-grey-8 text-white': isActive,
    }"
    @click="onClick"
  >
    <!-- Indicador visual de ruta activa -->
    <div
      v-if="isActive"
      class="bg-primary absolute-left"
      style="width: 4px; height: 100%; top: 0; left: 0;"
    />

    <q-item-section class="q-py-md">
      <q-item-label>{{ props.title }}</q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const props = defineProps({
  title: {
    type: String,
    required: true
  },

  to: {
    type: String,
    required: true
  },

  queueName: {
    type: String,
    required: true
  }
})

// Computed property para determinar si el item está activo
const isActive = computed(() => {
  return route.name === props.to && route.params.queueName === props.queueName
})

const onClick = () => {
  console.warn(props);
  console.warn(route);
  router.push({ name: props.to, params: { queueName: props.queueName } })
}
</script>
