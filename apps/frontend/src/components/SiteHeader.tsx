import { CalendarClock } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { cn } from '@/lib/utils'

// Общая шапка: логотип ведёт на главную, единственный пункт — «Записаться» (D-11).
function SiteHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <CalendarClock aria-hidden className="size-6 text-primary" />
          Календарь звонков
        </Link>
        <nav aria-label="Основная навигация">
          <NavLink
            to="/book"
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            Записаться
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export default SiteHeader
