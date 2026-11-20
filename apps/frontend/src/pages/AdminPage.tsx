import { type ReactNode, useEffect, useId, useRef } from 'react'
import { Form, useActionData, useLoaderData, useNavigation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDuration } from '@/lib/duration'
import { fieldErrorMessage, MEETING_TYPE_ID_HINT } from '@/lib/fieldErrors'
import type { adminLoader } from './adminLoader'
import type { CreateMeetingTypeResult } from './createMeetingTypeAction'

// Длительности типа встречи: 15…480 минут с шагом 15 (BR-07).
const DURATIONS = Array.from({ length: 32 }, (_, index) => (index + 1) * 15)

const controlClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'

// Поле формы: подпись, элемент ввода, подсказка и ошибка, связанные с элементом.
function Field({
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

// «Раздел владельца»: типы встреч — список и форма создания (docs/specs/booking.md §6.2).
function AdminPage() {
  const { meetingTypes } = useLoaderData<typeof adminLoader>()

  return (
    <>
      <title>Раздел владельца — Календарь звонков</title>
      <div className="flex flex-col gap-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Раздел владельца
        </h1>
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
