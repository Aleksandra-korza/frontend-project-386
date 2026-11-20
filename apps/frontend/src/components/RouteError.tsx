import { RotateCw } from 'lucide-react'
import { useRevalidator } from 'react-router'
import { Button } from '@/components/ui/button'

// Ошибка загрузки данных маршрута: сеть и 5xx не различаются (docs/specs/booking.md §6.3).
function RouteError() {
  const revalidator = useRevalidator()

  return (
    <section className="flex max-w-2xl flex-col items-start gap-6">
      <p role="alert" className="text-lg">
        Не удалось загрузить данные
      </p>
      <Button
        variant="outline"
        disabled={revalidator.state === 'loading'}
        onClick={() => void revalidator.revalidate()}
      >
        <RotateCw aria-hidden />
        Повторить
      </Button>
    </section>
  )
}

export default RouteError
