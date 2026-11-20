import { ArrowLeft, CircleCheck } from 'lucide-react'
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router'
import { controlClass, Field } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { formatDay, formatTime, localDate } from '@/lib/dates'
import { formatDuration } from '@/lib/duration'
import { fieldErrorMessage } from '@/lib/fieldErrors'
import type { confirmBookingLoader } from './confirmBookingLoader'
import type { CreateBookingResult } from './createBookingAction'

type Summary = {
  title: string
  /** Без длительности — экран успеха (§6.3: тип, день, время, часовой пояс). */
  durationMinutes?: number
  startsAt: string
  endsAt: string
  timeZone: string
}

// Сводка бронирования: тип, длительность (если передана), день, время, часовой пояс из ответа API.
function BookingSummary({
  title,
  durationMinutes,
  startsAt,
  endsAt,
  timeZone,
}: Summary) {
  const time = (dateTime: string) => formatTime(dateTime, timeZone)
  return (
    <dl className="grid gap-3 text-sm">
      <SummaryItem term="Тип встречи">{title}</SummaryItem>
      {durationMinutes !== undefined && (
        <SummaryItem term="Длительность">
          {formatDuration(durationMinutes)}
        </SummaryItem>
      )}
      <SummaryItem term="День">
        {formatDay(localDate(startsAt, timeZone))}
      </SummaryItem>
      <SummaryItem term="Время">{`${time(startsAt)}–${time(endsAt)}`}</SummaryItem>
      <SummaryItem term="Часовой пояс">{timeZone}</SummaryItem>
    </dl>
  )
}

function SummaryItem({
  term,
  children,
}: {
  term: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

// Подтверждение бронирования и экран успеха на том же адресе (docs/specs/booking.md §6.1, §6.3).
function ConfirmBookingPage() {
  const { meetingType, slot, timeZone } =
    useLoaderData<typeof confirmBookingLoader>()
  const result = useActionData<CreateBookingResult>()
  const isSubmitting = useNavigation().state === 'submitting'

  if (result?.status === 'booked') {
    return (
      <>
        <title>Бронирование подтверждено — Календарь звонков</title>
        <section className="flex max-w-xl flex-col items-start gap-6">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
            <CircleCheck aria-hidden className="size-8 text-primary" />
            Бронирование подтверждено. До встречи!
          </h1>
          <div className="w-full rounded-xl border bg-background/80 p-4">
            <BookingSummary
              title={meetingType.title}
              startsAt={result.booking.startsAt}
              endsAt={result.booking.endsAt}
              timeZone={timeZone}
            />
          </div>
          <Button asChild>
            <Link to="/book">Забронировать ещё</Link>
          </Button>
        </section>
      </>
    )
  }

  const errorOf = (field: string) => {
    const code =
      result?.status === 'invalid' ? result.fieldErrors[field] : undefined
    return code && fieldErrorMessage(field, code)
  }
  const date = localDate(slot.startsAt, timeZone).toString()

  return (
    <>
      <title>{`Подтверждение — ${meetingType.title} — Календарь звонков`}</title>
      <section className="flex flex-col gap-8">
        <div className="flex flex-col items-start gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link
              to={`/book/${meetingType.id}?${new URLSearchParams({ date }).toString()}`}
            >
              <ArrowLeft aria-hidden />
              Изменить
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {meetingType.title}
          </h1>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Form method="post" className="flex max-w-xl flex-col gap-4">
            <input type="hidden" name="startsAt" value={slot.startsAt} />
            <Field label="Имя" error={errorOf('guestName')}>
              {(props) => (
                <input
                  {...props}
                  name="guestName"
                  required
                  autoComplete="name"
                  className={controlClass}
                />
              )}
            </Field>
            <Field label="Email" error={errorOf('guestEmail')}>
              {(props) => (
                <input
                  {...props}
                  name="guestEmail"
                  type="email"
                  required
                  autoComplete="email"
                  className={controlClass}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={isSubmitting}>
                Подтвердить запись
              </Button>
              {result?.status === 'failed' && (
                <p role="alert" className="text-sm text-destructive">
                  Не удалось отправить. Попробуйте ещё раз.
                </p>
              )}
            </div>
          </Form>
          <aside className="rounded-xl border bg-background/80 p-4">
            <BookingSummary
              title={meetingType.title}
              durationMinutes={meetingType.durationMinutes}
              startsAt={slot.startsAt}
              endsAt={slot.endsAt}
              timeZone={timeZone}
            />
          </aside>
        </div>
      </section>
    </>
  )
}

export default ConfirmBookingPage
