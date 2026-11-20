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
enum ErrorCode { VALIDATION_ERROR, MEETING_TYPE_NOT_FOUND, MEETING_TYPE_ID_TAKEN, SLOT_TAKEN }
/** Код ошибки поля. */
enum FieldErrorCode { REQUIRED, TOO_LONG, INVALID_FORMAT, OUT_OF_RANGE, INVALID_SLOT }
model FieldError { field: string; code: FieldErrorCode; }
model ErrorResponse { code: ErrorCode; message: string; fieldErrors?: FieldError[]; }

/** Ошибка проверки запроса: `fieldErrors` перечисляет все поля с ошибками (docs/specs/booking.md §5). */
@error
model BadRequestError {
  @statusCode statusCode: 400;
  @body body: ErrorResponse;
}

/** Конфликт с уже существующими данными. */
@error
model ConflictError {
  @statusCode statusCode: 409;
  @body body: ErrorResponse;
}

/** Создание типа встречи владельцем; `title` и `description` обрезаются по краям, пустое описание = отсутствует. */
@route("/api/meeting-types")
@post
op createMeetingType(@body body: MeetingType): {
  @statusCode statusCode: 201;
  @body body: MeetingType;
} | BadRequestError | ConflictError;
