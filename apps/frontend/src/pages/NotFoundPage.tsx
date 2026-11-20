import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

// Любой неизвестный адрес (Q15).
function NotFoundPage() {
  return (
    <>
      <title>Страница не найдена — Календарь звонков</title>
      <section className="flex max-w-2xl flex-col items-start gap-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Страница не найдена
        </h1>
        <Button asChild variant="outline">
          <Link to="/">На главную</Link>
        </Button>
      </section>
    </>
  )
}

export default NotFoundPage
