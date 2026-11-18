import { useEffect, useState } from 'react'
import { getHealth } from '@/client'

type ApiState = 'loading' | 'ok' | 'error'

const apiStateLabel: Record<ApiState, string> = {
  loading: 'проверка…',
  ok: 'доступен',
  error: 'недоступен',
}

function App() {
  const [apiState, setApiState] = useState<ApiState>('loading')

  useEffect(() => {
    // Сгенерированный SDK (apps/frontend/src/client); в dev-режиме /api проксирует Vite.
    getHealth()
      .then(({ data }) => setApiState(data?.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setApiState('error'))
  }, [])

  return (
    <main>
      <h1>Календарь звонков</h1>
      <p>Каркас приложения. Функциональность появится на следующих этапах.</p>
      <p>API: {apiStateLabel[apiState]}</p>
    </main>
  )
}

export default App
