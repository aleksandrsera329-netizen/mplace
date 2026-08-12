# Mplace Kubernetes

## Plain manifests

```bash
# Build images
docker build -t mplace-api:latest -f Dockerfile .
docker build -t mplace-web:latest -f apps/web/Dockerfile ./apps/web

# Apply
kubectl apply -k k8s/
# or:
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/

kubectl get pods -n mplace
```

## Helm

```bash
helm upgrade --install mplace ./helm/mplace \
  --namespace mplace \
  --create-namespace \
  --set api.tag=latest \
  --set web.tag=latest
```

## Monitoring (cluster-wide, optional)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --set grafana.adminPassword="mplace-admin-change-me"

# Then enable ServiceMonitors in chart:
# --set serviceMonitor.enabled=true
```

## Sentry

Set `SENTRY_DSN` in secret / Helm `sentry.dsn`. API already supports optional Sentry via `apps/api/src/sentry.ts`.
