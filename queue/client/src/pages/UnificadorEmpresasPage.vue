<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <h4 class="col-auto q-ma-none">Unificador de Empresas por RUT</h4>
    </div>
    <ChartsComponent queue-name="companies_rut_unified" />
    <ListProcessingComponent queue-name="companies_rut_unified" />
    <TableQueueComponent queue-name="companies_rut_unified" />
  </q-page>
</template>

<script setup>
import ListProcessingComponent from 'components/ListProcessingComponent.vue';
import TableQueueComponent from 'components/TableQueueComponent.vue';
import ChartsComponent from 'components/ChartsComponent.vue';
</script>
