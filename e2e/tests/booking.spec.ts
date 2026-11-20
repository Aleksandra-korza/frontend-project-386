import { randomUUID } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { BACKEND_URL } from './servers.ts'

// Браузерные сценарии записи (docs/specs/booking.md §7, UC-01…UC-04).
// Seed-данных нет: каждый сценарий создаёт свой тип встречи с уникальным id.

/** Уникальный id типа встречи: slug, 3–40 символов. */
const uniqueMeetingTypeId = () => `e2e-${randomUUID().slice(0, 8)}`

/**
 * Гость в каталоге выбирает тип, первый день со свободными слотами и первый
 * свободный слот, затем переходит к подтверждению. Возвращает время слота («10:00»).
 */
async function chooseFirstFreeSlot(page: Page, title: string) {
  await page.goto('/book')
  await page.getByRole('link', { name: title }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible()

  await page
    .getByRole('grid')
    .getByRole('button', { name: /свободно: \d+/, disabled: false })
    .first()
    .click()

  const slot = page
    .getByRole('list', { name: 'Время' })
    .getByRole('button', { name: /Свободно/ })
    .first()
  const time = (await slot.locator('span').first().textContent()) ?? ''
  expect(time).toMatch(/^\d{2}:\d{2}$/)
  await slot.click()

  await page.getByRole('link', { name: 'Продолжить' }).click()
  await expect(page).toHaveURL(/\/confirm\?startsAt=/)
  return time
}

test('гость бронирует слот типа, созданного владельцем, и владелец видит бронирование', async ({
  page,
}) => {
  const id = uniqueMeetingTypeId()
  const title = `Знакомство ${id}`
  const guestName = `Гость ${id}`

  // Владелец создаёт тип встречи.
  await page.goto('/admin')
  await page.getByLabel('Идентификатор (id)').fill(id)
  await page.getByLabel('Название').fill(title)
  await page.getByLabel('Описание').fill('Короткий звонок для знакомства')
  await page.getByLabel('Длительность').selectOption({ label: '30 мин' })
  await page.getByRole('button', { name: 'Создать' }).click()
  // Пока список типов перезагружается, рядом виден индикатор «Загрузка…» (тоже status).
  await expect(
    page.getByRole('status').filter({ hasText: 'Тип встречи создан' }),
  ).toBeVisible()
  await expect(page.getByText(id, { exact: true })).toBeVisible()

  // Гость бронирует первый свободный слот.
  const time = await chooseFirstFreeSlot(page, title)
  await page.getByLabel('Имя').fill(guestName)
  await page.getByLabel('Email').fill(`${id}@example.com`)
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Бронирование подтверждено. До встречи!',
    }),
  ).toBeVisible()
  await expect(page.getByText(`${time}–`)).toBeVisible()

  // Владелец видит бронирование в списке предстоящих.
  await page.goto('/admin')
  // Запись бронирования — вложенный элемент списка внутри группы дня.
  const booking = page
    .getByRole('listitem')
    .filter({ hasNot: page.getByRole('list') })
    .filter({ hasText: guestName })
    .filter({ hasText: title })
  await expect(booking).toBeVisible()
  await expect(booking).toContainText(`${id}@example.com`)
  await expect(booking).toContainText(`${time}–`)
})

test('слот заняли, пока гость заполнял форму: сообщение о конфликте и обновлённая доступность', async ({
  page,
  request,
}) => {
  const id = uniqueMeetingTypeId()
  const title = `Консультация ${id}`
  const created = await request.post(`${BACKEND_URL}/api/meeting-types`, {
    data: { id, title, durationMinutes: 30 },
  })
  expect(created.status()).toBe(201)

  const time = await chooseFirstFreeSlot(page, title)
  const startsAt = new URL(page.url()).searchParams.get('startsAt')
  await page.getByLabel('Имя').fill('Гость')
  await page.getByLabel('Email').fill(`${id}@example.com`)

  // Тот же слот занимают прямым запросом к API, пока форма не отправлена.
  const taken = await request.post(`${BACKEND_URL}/api/bookings`, {
    data: {
      meetingTypeId: id,
      startsAt,
      guestName: 'Другой гость',
      guestEmail: `other-${id}@example.com`,
    },
  })
  expect(taken.status()).toBe(201)

  await page.getByRole('button', { name: 'Подтвердить запись' }).click()

  await expect(page.getByRole('alert')).toHaveText(
    'Это время уже заняли. Выберите другое.',
  )
  await expect(page).toHaveURL(new RegExp(`/book/${id}\\?`))
  const slot = page
    .getByRole('list', { name: 'Время' })
    .getByRole('button', { name: new RegExp(`^${time}`) })
  await expect(slot).toHaveText(new RegExp('Занято'))
  await expect(slot).toBeDisabled()
})
