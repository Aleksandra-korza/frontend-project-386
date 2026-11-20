import { type ReactNode, useId } from 'react'

/** Классы поля ввода формы. */
export const controlClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'

// Поле формы: подпись, элемент ввода, подсказка и ошибка, связанные с элементом.
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby'?: string
  }) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [error && errorId, hint && !error && hintId]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        ...(describedBy && { 'aria-describedby': describedBy }),
      })}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
