import { useQuasar } from 'quasar'

export function useNotify () {
  const $q = useQuasar()

  const success = (message) => {
    $q.notify({
      color: 'green-5',
      textColor: 'white',
      icon: 'done',
      message,
      position: 'top'
    })
  }

  const warning = (message) => {
    $q.notify({
      color: 'yellow-5',
      textColor: 'dark',
      icon: 'priority_high',
      message,
      position: 'top'
    })
  }

  const danger = (message) => {
    $q.notify({
      color: 'red-5',
      textColor: 'white',
      icon: 'close',
      message,
      position: 'top'
    })
  }

  const error = (message) => {
    $q.notify({
      color: 'red-5',
      textColor: 'white',
      icon: 'close',
      message,
      position: 'top'
    })
  }

  const info = (message) => {
    $q.notify({
      color: 'blue-grey-8',
      textColor: 'white',
      icon: 'error',
      message,
      position: 'top'
    })
  }

  return {
    success,
    warning,
    danger,
    error,
    info
  }
}
