import { useEffect, useRef } from 'react'
import { Temporal } from 'temporal-polyfill'
import { Form, useActionData, useLoaderData, useNavigation } from 'react-router'
import { controlClass, Field } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  formatDateTime,
  formatDayTitle,
  formatTime,
  localDate,
  TIME_ZONE,
} from '@/lib/dates'
import { formatDuration } from '@/lib/duration'
import { fieldErrorMessage, MEETING_TYPE_ID_HINT } from '@/lib/fieldErrors'
import type { adminLoader } from './adminLoader'
import type { CreateMeetingTypeResult } from './createMeetingTypeAction'

// Длительности типа встречи: 15…480 минут с шагом 15 (BR-07).
const DURATIONS = Array.from({ length: 32 }, (_, index) => (index + 1) * 15)

function CreateMeetingTypeForm() {
  const result = useActionData<CreateMeetingTypeResult>()
  const isSubmitting = useNavigation().state === 'submitting'
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (result?.status === 'created') formRef.current?.reset()
  }, [result])

  const errorOf = (field: string) => {
    if (field === 'id' && result?.status === 'idTaken') {
      return 'Тип встречи с таким идентификатором уже существует'
    }
    const code =
      result?.status === 'invalid' ? result.fieldErrors[field] : undefined
    return code && fieldErrorMessage(field, code)
  }

  return (
    <Form
      ref={formRef}
      method="post"
      noValidate
      className="flex max-w-xl flex-col gap-4"
    >
      <Field
        label="Идентификатор (id)"
        hint={MEETING_TYPE_ID_HINT}
        error={errorOf('id')}
      >
        {(props) => (
          <input
            {...props}
            name="id"
            autoComplete="off"
            className={controlClass}
          />
        )}
      </Field>
      <Field label="Название" error={errorOf('title')}>
        {(props) => (
          <input
            {...props}
            name="title"
            autoComplete="off"
            className={controlClass}
          />
        )}
      </Field>
      <Field label="Описание" error={errorOf('description')}>
        {(props) => (
          <textarea
            {...props}
            name="description"
            rows={3}
            className={controlClass}
          />
        )}
      </Field>
      <Field label="Длительность" error={errorOf('durationMinutes')}>
        {(props) => (
          <select
            {...props}
            name="durationMinutes"
            defaultValue=""
            className={controlClass}
          >
            <option value="">—</option>
            {DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isSubmitting}>
          Создать
        </Button>
        {result?.status === 'created' && (
          <p role="status" className="text-sm">
            Тип встречи создан
          </p>
        )}
        {result?.status === 'failed' && (
          <p role="alert" className="text-sm text-destructive">
            Не удалось отправить. Попробуйте ещё раз.
          </p>
        )}
      </div>
    </Form>
  )
}

type UpcomingBooking = Awaited<
  ReturnType<typeof adminLoader>
>['bookings'][number]

// Предстоящие бронирования всех типов, сгруппированные по местным дням.
// Порядок — из ответа API (по возрастанию начала); без автообновления.
function UpcomingBookings({ bookings }: { bookings: UpcomingBooking[] }) {
  const days = new Map<string, UpcomingBooking[]>()
  for (const booking of bookings) {
    const date = localDate(booking.startsAt, TIME_ZONE).toString()
    days.set(date, [...(days.get(date) ?? []), booking])
  }
  const time = (dateTime: string) => formatTime(dateTime, TIME_ZONE)

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Предстоящие бронирования
        </h2>
        <span className="text-sm text-muted-foreground">{TIME_ZONE}</span>
      </div>
      {days.size === 0 ? (
        <p className="text-muted-foreground">Предстоящих бронирований нет</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {[...days].map(([date, dayBookings]) => (
            <li key={date} className="flex flex-col gap-3">
              <h3 className="text-lg font-medium">
                {formatDayTitle(Temporal.PlainDate.from(date))}
              </h3>
              <ul className="flex flex-col gap-3">
                {dayBookings.map((booking) => (
                  <li key={booking.id}>
                    <Card className="bg-background/80">
                      <CardContent className="flex flex-col gap-1">
                        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-medium tabular-nums">
                            {`${time(booking.startsAt)}–${time(booking.endsAt)}`}
                          </span>
                          <span>{booking.meetingTypeTitle}</span>
                        </p>
                        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                          <span>{booking.guestName}</span>
                          <span className="text-muted-foreground">
                            {booking.guestEmail}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {`Создано: ${formatDateTime(booking.createdAt, TIME_ZONE)}`}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// «Раздел владельца»: предстоящие бронирования, затем типы встреч — список
// и форма создания (docs/specs/booking.md §6.2).
function AdminPage() {
  const { bookings, meetingTypes } = useLoaderData<typeof adminLoader>()

  return (
    <>
      <title>Раздел владельца — Календарь звонков</title>
      <div className="flex flex-col gap-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Раздел владельца
        </h1>
        <UpcomingBookings bookings={bookings} />
        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-semibold tracking-tight">Типы встреч</h2>
          {meetingTypes.length === 0 ? (
            <p className="text-muted-foreground">Типов встреч пока нет</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {meetingTypes.map((meetingType) => (
                <li key={meetingType.id}>
                  <Card className="bg-background/80">
                    <CardContent className="flex flex-col gap-1">
                      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-medium">{meetingType.title}</span>
                        <code className="text-sm text-muted-foreground">
                          {meetingType.id}
                        </code>
                        <span className="text-sm text-muted-foreground">
                          {formatDuration(meetingType.durationMinutes)}
                        </span>
                      </p>
                      {meetingType.description && (
                        <p className="text-sm text-muted-foreground">
                          {meetingType.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <CreateMeetingTypeForm />
        </section>
      </div>
    </>
  )
}

export default AdminPage
