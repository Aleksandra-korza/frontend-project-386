// Контракт API «Календаря звонков». Источник истины для OpenAPI (api/generated),
// SDK frontend (apps/frontend/src/client) и типов backend (apps/backend/src/generated): `mise run codegen`.
import "@typespec/http";

using Http;

@service(#{ title: "Calendar Calls API" })
namespace CalendarCalls;

/** Состояние backend. */
model HealthStatus {
  status: "ok";
}

/** Проверка, что backend запущен и отвечает. */
@route("/api/health")
@get
op getHealth(): HealthStatus;

/** Тип встречи, который гость выбирает при записи (docs/specs/booking.md §2). */
model MeetingType {
  /** Идентификатор-slug: задаёт владелец, уникален и неизменяем. */
  @minLength(3)
  @maxLength(40)
  @pattern("^[a-z0-9]+(-[a-z0-9]+)*$")
  id: string;

  /** Название. */
  @minLength(1)
  @maxLength(80)
  title: string;

  /** Необязательное описание. */
  @maxLength(500)
  description?: string;

  /** Длительность встречи в минутах: 15–480 (BR-07); кратность 15 проверяет backend. */
  @minValue(15)
  @maxValue(480)
  durationMinutes: int32;
}

/** Каталог типов встреч в порядке создания, старые первыми. */
@route("/api/meeting-types")
@get
op listMeetingTypes(): MeetingType[];

/** Код ошибки ответа API. */
enum ErrorCode {
  VALIDATION_ERROR,
  MEETING_TYPE_NOT_FOUND,
  MEETING_TYPE_ID_TAKEN,
  SLOT_TAKEN,
}

/** Код ошибки поля. */
enum FieldErrorCode {
  REQUIRED,
  TOO_LONG,
  INVALID_FORMAT,
  OUT_OF_RANGE,
  INVALID_SLOT,
}

model FieldError {
  field: string;
  code: FieldErrorCode;
}

model ErrorResponse {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldError[];
}

/** Тип встречи не найден: `MEETING_TYPE_NOT_FOUND`. */
@error
model NotFoundError {
  @statusCode statusCode: 404;
  @bodyRoot body: ErrorResponse;
}

/** Тип встречи по идентификатору. */
@route("/api/meeting-types/{id}")
@get
op getMeetingType(@path id: string): MeetingType | NotFoundError;

/** Окно бронирования: местные дни Варшавы, 14 дней, начиная с завтрашнего (BR-01). */
model BookingWindow {
  /** Первый день окна. */
  from: plainDate;

  /** Последний день окна. */
  to: plainDate;
}

/** Слот: возможный интервал встречи выбранного типа (docs/specs/booking.md §3). */
model Slot {
  /** Начало, ISO 8601 со смещением Варшавы. */
  startsAt: offsetDateTime;

  /** Конец: начало + длительность типа. */
  endsAt: offsetDateTime;

  /** Свободен ли слот. */
  available: boolean;
}

/** День окна бронирования и все слоты выбранного типа. */
model AvailabilityDay {
  /** Местный день. */
  date: plainDate;

  slots: Slot[];
}

/** Доступность времени для типа встречи на всё окно бронирования (ADR-0004). */
model MeetingTypeAvailability {
  /** Часовой пояс дней и времени. */
  timeZone: "Europe/Warsaw";

  window: BookingWindow;

  /** Дни окна по возрастанию. */
  days: AvailabilityDay[];
}

/** Окно бронирования и слоты типа встречи со статусом «свободен / занят». */
@route("/api/meeting-types/{id}/availability")
@get
op getMeetingTypeAvailability(
  @path id: string,
): MeetingTypeAvailability | NotFoundError;
