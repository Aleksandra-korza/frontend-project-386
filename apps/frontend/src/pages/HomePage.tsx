import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Как устроена запись (процесс получения бронирования, GLOSSARY.md).
// Тексты — docs/specs/home-page.md (Q5, Q17).
const bookingFlowFacts = [
  'без регистрации — достаточно имени и email;',
  'свободное время на 14 дней вперёд, начиная с завтрашнего дня;',
  'рабочие часы 09:00–18:00 по Варшаве (Europe/Warsaw), ежедневно, включая выходные;',
  'занятое время забронировать нельзя — сервер проверяет пересечения.',
]

function HomePage() {
  return (
    <>
      <title>Календарь звонков</title>
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-12">
        <section className="flex flex-col items-start gap-6">
          <span className="rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Быстрая запись на звонок
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Календарь звонков
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Выберите тип встречи, удобный день и свободное время — и запишитесь
            на звонок без регистрации.
          </p>
          <Button asChild size="lg">
            <Link to="/book">
              Записаться
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </section>
        <Card className="bg-background/80">
          <CardHeader>
            <CardTitle>
              <h2>Как устроена запись</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {bookingFlowFacts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default HomePage
