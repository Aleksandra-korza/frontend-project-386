import { LoaderCircle } from 'lucide-react'

// Индикатор загрузки данных страницы (FR-25).
function Loading() {
  return (
    <p
      role="status"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      Загрузка…
    </p>
  )
}

export default Loading
