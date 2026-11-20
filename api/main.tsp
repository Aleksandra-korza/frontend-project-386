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
