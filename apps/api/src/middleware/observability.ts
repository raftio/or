/**
 * RFC-021: Request id (trace_id), structured logging, optional metrics.
 */
import type { Context, Next } from "hono";

const REQUEST_ID = "request_id";

export function getRequestId(c: Context): string {
  return (c.get(REQUEST_ID) as string) ?? "";
}

const requestCount = new Map<string, number>();
const requestDurationSum = new Map<string, number>();

function normalizePath(pathname: string): string {
  const v1 = "/v1/";
  if (pathname.startsWith(v1)) {
    const rest = pathname.slice(v1.length);
    const segs = rest.split("/");
    const out: string[] = [];
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s && !/^\d+$/.test(s) && !/^[a-f0-9-]{36}$/i.test(s)) {
        out.push(s);
      } else if (s) {
        out.push(":id");
      }
    }
    return "/v1/" + (out.join("/") || "");
  }
  return pathname;
}

export async function observabilityMiddleware(
  c: Context,
  next: Next
): Promise<Response | void> {
  const reqId = crypto.randomUUID();
  c.set(REQUEST_ID, reqId);
  const start = Date.now();
  await next();
  const status = c.res.status;
  const pathname = new URL(c.req.url).pathname;
  const method = c.req.method;
  const duration = Date.now() - start;
  const pathKey = `${method} ${normalizePath(pathname)}`;
  requestCount.set(pathKey, (requestCount.get(pathKey) ?? 0) + 1);
  requestDurationSum.set(
    pathKey,
    (requestDurationSum.get(pathKey) ?? 0) + duration
  );
  console.log(
    JSON.stringify({
      request_id: reqId,
      method,
      path: pathname,
      status,
      duration_ms: duration,
    })
  );
}

export function getMetrics(): string {
  const lines: string[] = [
    "# HELP orqestra_http_requests_total Total requests by method and path",
    "# TYPE orqestra_http_requests_total counter",
  ];
  for (const [key, count] of requestCount) {
    lines.push(`orqestra_http_requests_total{path="${key}"} ${count}`);
  }
  lines.push(
    "",
    "# HELP orqestra_http_request_duration_ms_total Sum of request duration in ms",
    "# TYPE orqestra_http_request_duration_ms_total counter"
  );
  for (const [key, sum] of requestDurationSum) {
    lines.push(`orqestra_http_request_duration_ms_total{path="${key}"} ${sum}`);
  }
  return lines.join("\n");
}
