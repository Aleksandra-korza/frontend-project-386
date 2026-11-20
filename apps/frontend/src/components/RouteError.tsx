import { RotateCw } from 'lucide-react'
import {
  Link,
  isRouteErrorResponse,
  useRevalidator,
  useRouteError,
} from 'react-router'
import { Button } from '@/components/ui/button'

// Ошибка загрузки данных маршрута (docs/specs/booking.md §6.3): 404 маршрута —
// неизвестный тип встречи (MEETING_TYPE_NOT_FOUND); сеть и 5xx не различаются.
function RouteError() {
  const error = useRouteError()
  const revalidator = useRevalidator()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <section className="flex max-w-2xl flex-col items-start gap-6">
        <p role="alert" className="text-lg">
          Тип встречи не найден
        </p>
        <Button asChild variant="outline">
          <Link to="/book">К каталогу</Link>
        </Button>
      </section>
    )
  }

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
