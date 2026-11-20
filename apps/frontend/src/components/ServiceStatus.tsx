import { useEffect, useState } from 'react'
import { getHealth } from '@/client'

type HealthState = 'loading' | 'ok' | 'error'

const healthStateLabel: Record<HealthState, string> = {
  loading: 'проверка…',
  ok: 'доступен',
  error: 'недоступен',
}

// Строка статуса сервиса через сгенерированный SDK (TC-05, AC-27; пересмотр Q11).
function ServiceStatus() {
  const [status, setStatus] = useState<HealthState>('loading')

  useEffect(() => {
    let active = true
    getHealth()
      .then(({ data }) => {
        if (active) setStatus(data?.status === 'ok' ? 'ok' : 'error')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [])

  return <p>Статус сервиса: {healthStateLabel[status]}</p>
}

export default ServiceStatus
