import { Clock } from 'lucide-react'
import { Link, useLoaderData } from 'react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDuration } from '@/lib/duration'
import type { meetingTypesLoader } from './meetingTypesLoader'

// Страница записи — каталог типов встреч (ADR-0002, docs/specs/booking.md §6.1).
function BookPage() {
  const meetingTypes = useLoaderData<typeof meetingTypesLoader>()

  return (
    <>
      <title>Запись — Календарь звонков</title>
      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Запись на встречу
          </h1>
          <p className="text-lg text-muted-foreground">Выберите тип встречи.</p>
        </div>
        {meetingTypes.length === 0 ? (
          <p className="text-muted-foreground">
            Пока нет доступных типов встреч
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meetingTypes.map((meetingType) => (
              <li key={meetingType.id}>
                <Link
                  to={`/book/${meetingType.id}`}
                  className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card className="h-full bg-background/80 transition-colors hover:border-primary">
                    <CardHeader>
                      <CardTitle>
                        <h2>{meetingType.title}</h2>
                      </CardTitle>
                      {meetingType.description && (
                        <CardDescription>
                          {meetingType.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="mt-auto">
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock aria-hidden className="size-4" />
                        {formatDuration(meetingType.durationMinutes)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export default BookPage
