import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

// Страница записи (ADR-0002). Пока заглушка; на этапе бронирования здесь появится каталог типов встреч.
function BookPage() {
  return (
    <>
      <title>Запись — Календарь звонков</title>
      <section className="flex max-w-2xl flex-col items-start gap-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Запись на встречу
        </h1>
        <p className="text-lg text-muted-foreground">
          Скоро здесь можно будет выбрать тип встречи, удобный день и свободное
          время. Запись пока недоступна.
        </p>
        <Button asChild variant="outline">
          <Link to="/">На главную</Link>
        </Button>
      </section>
    </>
  )
}

export default BookPage
