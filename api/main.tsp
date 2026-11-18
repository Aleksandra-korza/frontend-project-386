// Контракт API «Календаря звонков». Источник истины для OpenAPI (api/generated)
// и клиентского SDK frontend (apps/frontend/src/client): `mise run codegen`.
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
