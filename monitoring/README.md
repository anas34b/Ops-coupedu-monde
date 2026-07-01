# Monitoring — procédure d'installation

Stack : **Prometheus + Grafana** (métriques) + **Loki + Promtail** (logs
centralisés) + **Alertmanager → Slack** (alerting).

## 1. Métriques : Prometheus + Grafana

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Copier le template de secret et y mettre le vrai webhook Slack (jamais commité)
cp monitoring/prometheus-values.secret.yaml.example monitoring/prometheus-values.secret.yaml
# éditer monitoring/prometheus-values.secret.yaml avec l'URL réelle

helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/prometheus-values.yaml \
  -f monitoring/prometheus-values.secret.yaml
```

## 2. Logs centralisés : Loki + Promtail

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install loki grafana/loki-stack -n monitoring -f monitoring/loki-values.yaml
```

Grafana est déjà configuré pour interroger Loki (datasource `Loki` ajoutée dans
`prometheus-values.yaml` → `grafana.additionalDataSources`).

## 3. Scraping de l'app + alertes

```bash
kubectl apply -f monitoring/servicemonitor.yaml
kubectl apply -f monitoring/alerts.yaml
```

## 4. Dashboard Grafana (auto-provisionné)

Le sidecar Grafana charge automatiquement toute ConfigMap labellisée
`grafana_dashboard: "1"` dans le namespace `monitoring` (activé dans
`prometheus-values.yaml` → `grafana.sidecar.dashboards`). On génère la
ConfigMap directement depuis le JSON existant (pas de copie à maintenir) :

```bash
kubectl create configmap worldcup-dashboard \
  --from-file=grafana-dashboard.json=monitoring/grafana-dashboard.json \
  -n monitoring

kubectl label configmap worldcup-dashboard -n monitoring grafana_dashboard=1
```

Le dashboard "Worldcup 2026 - App & Scaling" apparaît dans Grafana sous 1-2
minutes, avec un panel logs branché sur Loki.

## 5. Accéder à Grafana

```bash
kubectl get svc monitoring-grafana -n monitoring
# type LoadBalancer -> noter le hostname externe
# login : admin / valeur de grafana.adminPassword (prometheus-values.yaml)
```

## Vérification rapide

```bash
kubectl get prometheusrule -n monitoring        # → worldcup-alerts présent
kubectl get servicemonitor -n monitoring        # → worldcup-app présent
kubectl get pods -n monitoring | grep promtail  # → 1 pod par node (DaemonSet)
kubectl get configmap worldcup-dashboard -n monitoring --show-labels
```
