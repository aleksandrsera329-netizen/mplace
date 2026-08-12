# MONITORING.md — Stage 27

Production visibility: health probes, Prometheus metrics, alert rules.

## Endpoints

| Path | Purpose | k8s probe |
|------|---------|-----------|
| `GET /api/health` | **Liveness** — process up | `livenessProbe` |
| `GET /api/health/live` | Liveness alias | same |
| `GET /api/health/ready` | **Readiness** — Postgres + Redis + Meili | `readinessProbe` → **503** if not ready |
| `GET /api/health/status` | UI badge JSON (degraded-friendly) | — |
| `GET /api/health/full` | Terminus aggregate (compat) | — |
| `GET /api/metrics` | **Prometheus** text exposition | scrape target |

### Readiness rules

| Dependency | When checked | Fail ready? |
|------------|--------------|-------------|
| PostgreSQL | always | **yes** |
| Redis | if `REDIS_URL` set | **yes** if down |
| Meilisearch | if `MEILISEARCH_URL` set | **yes** if down |
| Stripe | config presence only | no (status only) |

Example probes:

```yaml
livenessProbe:
  httpGet: { path: /api/health, port: 3000 }
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /api/health/ready, port: 3000 }
  initialDelaySeconds: 15
  periodSeconds: 10
```

---

## Prometheus metrics

Scrape:

```yaml
# deploy/prometheus/prometheus.yml
scrape_configs:
  - job_name: mplace-api
    metrics_path: /api/metrics
    scrape_interval: 15s
    static_configs:
      - targets: ["api:3000"]  # or host.docker.internal:3001
```

### Key metrics

| Metric | Type | Labels | Meaning |
|--------|------|--------|---------|
| `http_requests_total` | counter | method, route, status_code | Request count |
| `http_request_duration_seconds` | histogram | method, route, status_code | Latency (use histogram_quantile for p95/p99) |
| `bullmq_queue_waiting` | gauge | queue | Waiting + delayed jobs |
| `bullmq_queue_active` | gauge | queue | Active jobs |
| `bullmq_jobs_failed` | gauge | queue | Failed jobs (queue count) |
| `bullmq_jobs_completed` | gauge | queue | Completed (approx) |
| `payments_failed_total` | counter | reason | Payment failures |
| `payments_succeeded_total` | counter | — | Payment success |
| `webhooks_failed_total` | counter | reason | Stripe webhook failures |
| `webhooks_processed_total` | counter | status | processed / ignored / already_processed |
| `payouts_failed_total` | counter | reason | Payout failures |
| `mplace_dependency_up` | gauge | name | postgres / redis / meilisearch (1/0) |
| `mplace_*` | — | — | Default Node process metrics (prom-client) |

### Useful PromQL

```promql
# Request rate
rate(http_requests_total[5m])

# 5xx rate (share)
sum(rate(http_requests_total{status_code=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))

# p95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))

# p99 latency
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))

# Queue depth
bullmq_queue_waiting

# Failed jobs
bullmq_jobs_failed

# Dependencies
mplace_dependency_up
```

---

## Alert rules (minimum set)

Define in Prometheus / Alertmanager (or Grafana). Thresholds are starting points.

| Alert | Condition | For | Severity |
|-------|-----------|-----|----------|
| APIHigh5xxRate | 5xx rate > 5% of traffic | 5m | critical |
| APIHighLatencyP95 | p95 latency > 2s | 10m | warning |
| APINotReady | `probe_success` on `/ready` == 0 **or** scrape fail | 2m | critical |
| PostgresDown | `mplace_dependency_up{name="postgres"} == 0` | 1m | critical |
| RedisDown | `mplace_dependency_up{name="redis"} == 0` | 2m | critical |
| MeiliDown | `mplace_dependency_up{name="meilisearch"} == 0` | 5m | warning |
| QueueDepthHigh | `bullmq_queue_waiting > 500` (any queue) | 10m | warning |
| QueueFailedJobs | `bullmq_jobs_failed > 50` | 10m | warning |
| PaymentFailureSpike | `increase(payments_failed_total[10m]) > 20` | — | critical |
| WebhookFailures | `increase(webhooks_failed_total[15m]) > 10` | — | critical |
| PayoutFailures | `increase(payouts_failed_total[30m]) > 5` | — | critical |

### Example Prometheus rules

```yaml
groups:
  - name: mplace
    rules:
      - alert: APIHigh5xxRate
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[5m]))
            /
            clamp_min(sum(rate(http_requests_total[5m])), 0.001)
          ) > 0.05
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "API 5xx rate > 5% for 5m"

      - alert: PostgresDown
        expr: mplace_dependency_up{name="postgres"} == 0
        for: 1m
        labels: { severity: critical }

      - alert: QueueDepthHigh
        expr: bullmq_queue_waiting > 500
        for: 10m
        labels: { severity: warning }

      - alert: PaymentFailureSpike
        expr: increase(payments_failed_total[10m]) > 20
        labels: { severity: critical }

      - alert: WebhookFailures
        expr: increase(webhooks_failed_total[15m]) > 10
        labels: { severity: critical }
```

---

## Stack

```bash
# Optional local monitoring
docker compose -f docker-compose.yml -f deploy/docker-compose.monitoring.yml up -d
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3002  (admin/admin)
```

### Grafana

1. Add Prometheus datasource: `http://prometheus:9090`  
2. Import panels: request rate, p95 latency, 5xx ratio, queue depth, dependency up, payment/webhook counters  
3. Optional dashboard links (after import):  
   - Local Prometheus: http://localhost:9090  
   - Local Grafana: http://localhost:3002  

---

## Logs → alerts (Stage 26)

- Every response has `X-Request-Id` / `X-Correlation-Id`  
- Structured logs include `requestId`, `userId`, `orderId`, …  
- On error: filter logs by `level=error` and `requestId=…`  
- Wire log-based alerts (e.g. Datadog/ELK) on:  
  - `Payment mark paid failed`  
  - `Payout completed` / payout failed  
  - webhook failed status  

---

## Sentry (optional)

Set `SENTRY_DSN` — see `apps/api/src/sentry.ts`.  
Complements metrics for stack traces; does not replace Prometheus SLIs.

---

## What we monitor (TZ checklist)

| Area | How |
|------|-----|
| API uptime | readiness + scrape up |
| 5xx rate | `http_requests_total{status_code=~"5.."}` |
| Latency p95/p99 | `http_request_duration_seconds` histogram |
| DB connections | readiness + process metrics / PG exporter (optional) |
| Redis | readiness + `mplace_dependency_up{name="redis"}` |
| Queue depth | `bullmq_queue_waiting` |
| Failed jobs | `bullmq_jobs_failed` |
| Stripe webhook failures | `webhooks_failed_total` |
| Payment failures | `payments_failed_total` |
| Payout failures | `payouts_failed_total` |
