import { cn } from 'cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Temporal } from 'temporal-polyfill'
import { Button } from '@/components/ui/button'
import { WEEKDAYS_SHORT, formatDayMonth, formatMonth } from '@/lib/dates'

type Props = {
  /** Окно бронирования из ответа API. */
  window: { from: string; to: string }
  /** Число свободных слотов по дням окна (`YYYY-MM-DD`). */
  freeSlots: ReadonlyMap<string, number>
  selected: Temporal.PlainDate | undefined
  onSelect: (date: Temporal.PlainDate) => void
}

// Календарь месяца Пн–Вс (docs/specs/booking.md §6.1): в днях окна — счётчик
// свободных слотов; дни вне окна и полностью занятые недоступны; месяцы — только
// в пределах окна.
function BookingCalendar({ window, freeSlots, selected, onSelect }: Props) {
  const first = Temporal.PlainDate.from(window.from).toPlainYearMonth()
  const last = Temporal.PlainDate.from(window.to).toPlainYearMonth()
  const [month, setMonth] = useState(
    () => selected?.toPlainYearMonth() ?? first,
  )

  const start = month.toPlainDate({ day: 1 })
  const cells: (Temporal.PlainDate | undefined)[] = [
    ...Array.from({ length: start.dayOfWeek - 1 }, () => undefined),
    ...Array.from({ length: month.daysInMonth }, (_, index) =>
      start.add({ days: index }),
    ),
  ]
  const weeks = Array.from(
    { length: Math.ceil(cells.length / 7) },
    (_, index) => cells.slice(index * 7, index * 7 + 7),
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Предыдущий месяц"
          disabled={Temporal.PlainYearMonth.compare(month, first) <= 0}
          onClick={() => setMonth(month.subtract({ months: 1 }))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <p className="font-medium">{formatMonth(month)}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Следующий месяц"
          disabled={Temporal.PlainYearMonth.compare(month, last) >= 0}
          onClick={() => setMonth(month.add({ months: 1 }))}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <table
        role="grid"
        className="w-full table-fixed border-separate border-spacing-1"
      >
        <thead>
          <tr>
            {WEEKDAYS_SHORT.map((weekday) => (
              <th
                key={weekday}
                scope="col"
                className="text-xs font-medium text-muted-foreground"
              >
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, index) => (
            <tr key={index}>
              {week.map((date, column) => (
                <td key={date?.toString() ?? `empty-${String(column)}`}>
                  {date && (
                    <Day
                      date={date}
                      free={freeSlots.get(date.toString())}
                      selected={selected?.equals(date) ?? false}
                      onSelect={onSelect}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Day({
  date,
  free,
  selected,
  onSelect,
}: {
  date: Temporal.PlainDate
  /** Свободных слотов; undefined — день вне окна. */
  free: number | undefined
  selected: boolean
  onSelect: (date: Temporal.PlainDate) => void
}) {
  const label =
    free === undefined
      ? formatDayMonth(date)
      : `${formatDayMonth(date)}, свободно: ${String(free)}`

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      disabled={!free}
      onClick={() => onSelect(date)}
      className={cn(
        'flex h-14 w-full flex-col items-center justify-center rounded-lg border text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:border-transparent disabled:text-muted-foreground/60',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background hover:border-primary',
      )}
    >
      <span className="font-medium">{date.day}</span>
      {free !== undefined && (
        <span
          className={cn(
            'text-xs',
            selected ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        >
          {free}
        </span>
      )}
    </button>
  )
}

export default BookingCalendar
