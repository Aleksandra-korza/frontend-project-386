import { cn } from 'cn'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useLoaderData, useSearchParams } from 'react-router'
import BookingCalendar from '@/components/BookingCalendar'
import { Button } from '@/components/ui/button'
import { formatDay, formatTime, parseDate } from '@/lib/dates'
import { formatDuration } from '@/lib/duration'
import type { chooseSlotLoader } from './chooseSlotLoader'

// Выбор дня и времени (docs/specs/booking.md §6.1). Слоты и их занятость считает
// сервер; клиент только считает свободные слоты дня (ADR-0004, п. 3).
function ChooseSlotPage() {
  const { meetingType, availability } = useLoaderData<typeof chooseSlotLoader>()
  const { timeZone } = availability
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedStartsAt, setSelectedStartsAt] = useState<string>()

  const freeSlots = new Map(
    availability.days.map((day) => [
      day.date,
      day.slots.filter((slot) => slot.available).length,
    ]),
  )
  // День из ?date= выбран, только если он в окне и в нём есть свободные слоты.
  const requestedDate = parseDate(searchParams.get('date'))
  const day = availability.days.find(
    (candidate) =>
      candidate.date === requestedDate?.toString() &&
      (freeSlots.get(candidate.date) ?? 0) > 0,
  )
  const selectedDate = day && requestedDate
  const slot = day?.slots.find(
    (candidate) =>
      candidate.available && candidate.startsAt === selectedStartsAt,
  )

  const time = (dateTime: string) => formatTime(dateTime, timeZone)

  return (
    <>
      <title>{`${meetingType.title} — Календарь звонков`}</title>
      <section className="flex flex-col gap-8">
        <div className="flex flex-col items-start gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/book">
              <ArrowLeft aria-hidden />
              Назад
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {meetingType.title}
          </h1>
          {meetingType.description && (
            <p className="text-lg text-muted-foreground">
              {meetingType.description}
            </p>
          )}
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
          <BookingCalendar
            window={availability.window}
            freeSlots={freeSlots}
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedStartsAt(undefined)
              setSearchParams({ date: date.toString() })
            }}
          />
          <div>
            {day ? (
              <ul aria-label="Время" className="grid grid-cols-2 gap-2">
                {day.slots.map(({ startsAt, available }) => {
                  const selected = startsAt === slot?.startsAt
                  return (
                    <li key={startsAt}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        disabled={!available}
                        onClick={() => setSelectedStartsAt(startsAt)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:border-primary',
                        )}
                      >
                        <span className="font-medium">{time(startsAt)}</span>{' '}
                        <span className="text-xs">
                          {available ? 'Свободно' : 'Занято'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground">Выберите дату</p>
            )}
          </div>
          <aside className="flex flex-col gap-6 rounded-xl border bg-background/80 p-4">
            <dl className="grid gap-3 text-sm">
              <PanelItem term="Тип встречи">{meetingType.title}</PanelItem>
              <PanelItem term="Длительность">
                {formatDuration(meetingType.durationMinutes)}
              </PanelItem>
              <PanelItem term="День">
                {selectedDate ? formatDay(selectedDate) : 'Выберите дату'}
              </PanelItem>
              {day && (
                <>
                  <PanelItem term="Свободных слотов">
                    {freeSlots.get(day.date)}
                  </PanelItem>
                  <PanelItem term="Время">
                    {slot
                      ? `${time(slot.startsAt)}–${time(slot.endsAt)}`
                      : 'Выберите время'}
                  </PanelItem>
                </>
              )}
              <PanelItem term="Часовой пояс">{timeZone}</PanelItem>
            </dl>
            {slot ? (
              <Button asChild>
                <Link
                  to={`/book/${meetingType.id}/confirm?${new URLSearchParams({ startsAt: slot.startsAt }).toString()}`}
                >
                  Продолжить
                </Link>
              </Button>
            ) : (
              <Button disabled>Продолжить</Button>
            )}
          </aside>
        </div>
      </section>
    </>
  )
}

function PanelItem({
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

export default ChooseSlotPage
