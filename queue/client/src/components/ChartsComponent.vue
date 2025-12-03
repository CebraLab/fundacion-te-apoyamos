<template>
  <div class="q-pa-md">
    <!-- Chart title -->
    <div class="text-h6 q-mb-md text-center text-grey-8">
      Message Statistics - <b class="text-uppercase">{{ props.queueName || 'Queue' }}</b> - {{ getPeriodLabel() }}
    </div>

    <!-- Timezone indicator and Auto-refresh status -->
    <div class="text-caption q-mb-md text-center text-grey-6">
      <q-icon
        name="schedule"
        size="16px"
        class="q-mr-xs"
      />
      Displaying data in your local timezone:
      <q-chip
        v-if="userTimezone"
        size="sm"
        color="primary"
        text-color="white"
        class="q-ml-sm"
      >
        {{ new Date().toLocaleString() }}
      </q-chip>

      <!-- Auto-refresh indicator -->
      <q-chip
        size="sm"
        color="positive"
        text-color="white"
        class="q-ml-sm"
      >
        <q-icon
          name="refresh"
          size="14px"
          class="q-mr-xs"
        />
        Auto-refresh: 5s
      </q-chip>
    </div>

    <!-- Loading indicator -->
    <div
      v-if="loading"
      class="text-center q-pa-md"
    >
      <q-spinner-dots
        size="50px"
        color="primary"
      />
      <div class="text-grey-6 q-mt-sm">
        Loading statistics...
      </div>
    </div>

    <!-- Chart -->
    <VueApexCharts
      v-else
      type="area"
      height="300"
      :options="chartConfig"
      :series="series"
    />

    <!-- Period controls and Statistics summary in same row -->
    <div class="row q-mt-md q-gutter-md items-center justify-between">
      <!-- Period controls - Left side -->
      <q-card
        class="row q-gutter-xs q-pa-md"
        flat
        bordered
      >
        <div class="col-12 text-h6 q-mb-md text-left text-grey-8">
          Period:
        </div>
        <q-btn-group
          outline
          class="col-12"
        >
          <q-btn
            v-for="period in timePeriods"
            :key="period.value"
            :color="selectedPeriod === period.value ? 'primary' : 'grey-7'"
            text-color="white"
            :label="period.label"
            unelevated
            @click="changePeriod(period.value)"
          />
        </q-btn-group>
      </q-card>

      <!-- Statistics summary - Right side -->
      <div class="row q-gutter-xs">
        <q-card
          class="bg-grey text-white summary-card"
          flat
          style="min-width: 120px"
        >
          <q-card-section class="text-center q-pa-sm">
            <div class="text-h6 q-mb-xs">
              {{ chartSummary.totalPending }}
            </div>
            <div class="text-caption">
              Pending
            </div>
          </q-card-section>
        </q-card>

        <q-card
          class="bg-positive text-white summary-card"
          flat
          style="min-width: 120px"
        >
          <q-card-section class="text-center q-pa-sm">
            <div class="text-h6 q-mb-xs">
              {{ chartSummary.totalSuccess }}
            </div>
            <div class="text-caption">
              Successful
            </div>
          </q-card-section>
        </q-card>

        <q-card
          class="bg-negative text-white summary-card"
          flat
          style="min-width: 120px"
        >
          <q-card-section class="text-center q-pa-sm">
            <div class="text-h6 q-mb-xs">
              {{ chartSummary.totalErrors }}
            </div>
            <div class="text-caption">
              Failed
            </div>
          </q-card-section>
        </q-card>

        <q-card
          class="bg-info text-white summary-card"
          flat
          style="min-width: 120px"
        >
          <q-card-section class="text-center q-pa-sm">
            <div class="text-h6 q-mb-xs">
              {{ chartSummary.successRate }}%
            </div>
            <div class="text-caption">
              Success Rate
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useQuasar } from 'quasar'
import { useQueuesStore } from 'stores/queues'

const $q = useQuasar()
const queuesStore = useQueuesStore()

// Props
const props = defineProps({
  queueName: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: false,
    default: ''
  }
})

// State
const loading = ref(false)
const selectedPeriod = ref('minute')
const userTimezone = ref('')
const REFRESH_INTERVAL = 5000
const isFetching = ref(false)
let refreshTimeoutId = null
let pendingAutoRefresh = false
let isComponentActive = false

// Available time periods
const timePeriods = [
  { value: 'minute', label: 'By Minute' },
  { value: 'hour', label: 'By Hour' },
  { value: 'day', label: 'By Day' },
  { value: 'week', label: 'By Week' }
]

// Function to detect user's timezone
const detectUserTimezone = () => {
  try {
    // Get timezone offset in hours (this is what we need to send to backend)
    const offset = new Date().getTimezoneOffset() / -60

    // Store the numeric offset directly for backend
    userTimezone.value = offset.toString()

    // Also get timezone name for display purposes
    let timezoneName = ''
    try {
      // This works in modern browsers
      timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      timezoneName = ''
    }

    console.log('Detected user timezone:', {
      timezoneName,
      offset,
      numericOffset: userTimezone.value,
      browserDate: new Date().toLocaleString(),
      utcDate: new Date().toISOString(),
      finalTimezone: userTimezone.value
    })
  } catch (error) {
    console.error('Error detecting timezone:', error)
    // Fallback to UTC (0)
    userTimezone.value = '0'
  }
}

// Computed properties from store
const chartData = computed(() => queuesStore.chartStats[props.queueName]?.data || [])
const chartSummary = computed(() => queuesStore.chartStats[props.queueName]?.summary || {
  totalPending: 0,
  totalSuccess: 0,
  totalErrors: 0,
  successRate: 0
})

// Chart series
const series = computed(() => [
  {
    name: 'Successful Messages',
    data: chartData.value.map(item => ({
      x: new Date(item.x).getTime(), // Asegurar que sea timestamp en milisegundos
      y: item.success
    })),
    color: '#28c76f'
  },
  {
    name: 'Failed Messages',
    data: chartData.value.map(item => ({
      x: new Date(item.x).getTime(), // Asegurar que sea timestamp en milisegundos
      y: item.failed
    })),
    color: '#ea5455'
  },
  {
    name: 'Pending Messages',
    data: chartData.value.map(item => ({
      x: new Date(item.x).getTime(), // Asegurar que sea timestamp en milisegundos
      y: item.pending
    })),
    color: '#5a5c5e'
  }
])

// Chart configuration
const chartConfig = computed(() => ({
  chart: {
    type: 'area',
    parentHeightOffset: 0,
    toolbar: { show: false },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 800
    }
  },
  stroke: {
    curve: 'smooth',
    width: 2
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.7,
      opacityTo: 0.2,
      stops: [0, 90, 100]
    }
  },
  markers: {
    size: 4,
    hover: {
      size: 6
    }
  },
  legend: {
    position: 'top',
    horizontalAlign: 'center',
    fontSize: '14px',
    markers: {
      radius: 12
    }
  },
  grid: {
    padding: { top: 10 },
    borderColor: $q.dark.isActive ? "rgba(208,212,241,0.42)" : "rgba(47,43,61,0.16)",
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: true } }
  },
  yaxis: {
    title: {
      text: 'Message Count',
      style: {
        color: $q.dark.isActive ? "rgba(208,212,241,0.42)" : "rgba(47,43,61,0.42)",
        fontSize: '14px'
      }
    },
    tooltip: { enabled: true },
    crosshairs: {
      stroke: {
        color: $q.dark.isActive ? "rgba(208,212,241,0.42)" : "rgba(47,43,61,0.16)"
      }
    },
    labels: {
      style: {
        colors: $q.dark.isActive ? "rgba(208,212,241,0.42)" : "rgba(47,43,61,0.42)",
        fontSize: "0.8125rem"
      }
    }
  },
  xaxis: {
    type: 'datetime',
    title: {
      text: 'Time',
      style: {
        color: $q.dark.isActive ? "rgba(208,212,241,0.42)" : "rgba(47,43,61,0.42)",
        fontSize: '14px'
      }
    },
    axisBorder: { show: false },
    axisTicks: {
      color: $q.dark.isActive ? "rgba(208,212,241,0.42)" : "rgba(47,43,61,0.16)"
    },
    crosshairs: {
      stroke: {
        color: $q.dark.isActive ? "rgba(208,212,241,0.42)" : "rgba(47,43,61,0.16)"
      }
    },
    labels: {
      style: {
        colors: $q.dark.isActive ? "rgba(208,212,241,0.42)" : "rgba(47,43,61,0.42)",
        fontSize: "0.8125rem"
      },
      format: selectedPeriod.value === 'minute' ? 'HH:mm' :
              selectedPeriod.value === 'hour' ? 'HH:mm' :
              selectedPeriod.value === 'day' ? 'dd/MM' : 'dd/MM',
      datetimeUTC: false, // Usar timezone local del navegador
      datetimeFormatter: {
        year: 'yyyy',
        month: 'MMM \'yy',
        day: 'dd MMM',
        hour: 'HH:mm'
      }
    }
  },
  tooltip: {
    x: {
      format: selectedPeriod.value === 'minute' ? 'dd/MM HH:mm' :
              selectedPeriod.value === 'hour' ? 'dd/MM HH:mm' :
              selectedPeriod.value === 'day' ? 'dd/MM/yyyy' : 'dd/MM/yyyy',
      formatter: (value) => {
        // Convertir timestamp a fecha local del navegador
        const date = new Date(value);
        return date.toLocaleString();
      }
    },
    y: {
      formatter: (value) => `${value} messages`
    }
  },
  colors: ['#28c76f', '#ea5455'],
  theme: {
    mode: $q.dark.isActive ? 'dark' : 'light'
  }
}))

// Function to get period label
const getPeriodLabel = () => {
  const period = timePeriods.find(p => p.value === selectedPeriod.value)
  return period ? period.label : 'By Day'
}

// Function to change period and fetch new data
const changePeriod = async (newPeriod) => {
  if (newPeriod === selectedPeriod.value) return

  selectedPeriod.value = newPeriod
  await fetchChartStats(true) // Cambio de período con loading
}

// Function to fetch chart statistics
const fetchChartStats = async ({ showLoading = true, fromAutoRefresh = false } = {}) => {
  if (!isComponentActive) {
    return
  }

  if (isFetching.value) {
    if (fromAutoRefresh) {
      pendingAutoRefresh = true
    }
    return
  }

  isFetching.value = true

  if (showLoading) {
    loading.value = true
  }

  try {
    console.log('fetchChartStats called with:', {
      queueName: props.queueName,
      period: selectedPeriod.value,
      timezone: userTimezone.value,
      timezoneType: typeof userTimezone.value,
      showLoading,
      fromAutoRefresh
    })

    // Send user's timezone to backend for correct data display
    await queuesStore.fetchChartStats(props.queueName, selectedPeriod.value, userTimezone.value)
  } catch (error) {
    console.error('Error fetching chart stats:', error)
  } finally {
    if (showLoading) {
      loading.value = false
    }

    isFetching.value = false
  }

  if (pendingAutoRefresh) {
    pendingAutoRefresh = false
    await fetchChartStats({ showLoading: false, fromAutoRefresh: true })
  }
}

const scheduleNextRefresh = () => {
  if (!isComponentActive) {
    return
  }

  refreshTimeoutId = setTimeout(async () => {
    await fetchChartStats({ showLoading: false, fromAutoRefresh: true })
    scheduleNextRefresh()
  }, REFRESH_INTERVAL)
}

// Lifecycle
onMounted(async () => {
  detectUserTimezone()
  isComponentActive = true
  await fetchChartStats({ showLoading: true }) // Primera carga con loading
  scheduleNextRefresh() // Auto-refresh controlado
})

onUnmounted(() => {
  isComponentActive = false
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId)
    refreshTimeoutId = null
  }
  pendingAutoRefresh = false
})
</script>

<style lang="scss" scoped>
.summary-card {
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}
</style>
