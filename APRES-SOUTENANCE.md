# Corrections post-soutenance — Worldcup CDM 2026

**Date soutenance** : 2026-07-02
**Problème constaté** : le site est tombé en pleine démo (OOM sur les nœuds t3.micro).
**Promesse au prof** : tout corriger proprement et remettre le cluster dans un état stable.

---

## Cause racine identifiée

Les nœuds t3.micro (1 Go RAM) ne supportaient pas le stack monitoring complet.
Prometheus + Grafana + node-exporter consommaient ~900 Mo — les nœuds OOMKillaient les pods.

---

## Ce qui a été fait après la soutenance

### 1. Reconstruction du cluster (t3.micro → t3.small)

- Suppression de l'ancien cluster `worldcup-cluster` (bloqué par des dépendances CloudFormation sur les subnets RDS)
- Recréation de l'infrastructure réseau (IGW, subnet eu-west-3b, route table) pour conserver la RDS existante `worldcup-db2`
- Nouveau cluster `worldcup-cluster-2` en t3.small (2 Go RAM) — élimine définitivement la cause racine OOM
- VPC réutilisé : `vpc-06519cbd0c0cb09dc`
- Subnets publics : `subnet-08f479d4fa1581241` (3a) + `subnet-00155be342ed73d25` (3b)

### 2. Redeploiement de l'application

- Secret `db-credentials` recréé (connecté à `worldcup-db2`, RDS existante, mot de passe réinitialisé)
- Helm install : 2 replicas, HPA (2→10), PDB (minAvailable=1), podAntiAffinity inter-AZ
- ALB Ingress recréé avec healthchecks accélérés (5s/2 checks) pour tenir l'exigence < 15s de recovery

**URL app** : `http://k8s-default-worldcup-96df94cced-1678723651.eu-west-3.elb.amazonaws.com`

### 3. Crash test / self-healing vérifié

```
worldcup-worldcup-84b4d47fcc-54t46   1/1 Running   0    → kill envoyé
worldcup-worldcup-84b4d47fcc-54t46   0/1 Error     0    → pod mort
worldcup-worldcup-84b4d47fcc-54t46   0/1 Running   1    → K8s redémarre (1s)
worldcup-worldcup-84b4d47fcc-54t46   1/1 Running   1    → healthy (2s)
```

- Pod `dslhk` n'a jamais été interrompu → zéro downtime utilisateur
- Recovery en **2 secondes** (exigence : < 15s)

### 4. Monitoring déployé (kube-prometheus-stack)

- Prometheus + Grafana + Alertmanager + node-exporter installés via Helm
- Mémoire Prometheus réduite (request: 64Mi, limit: 512Mi) pour tenir sur t3.small
- Dashboards Kubernetes auto-provisionnés (Compute Resources / Cluster, Pod, Node…)
- Ingress ALB créés pour exposition publique
- Dashboard custom `monitoring/dashboard-pods.yaml` provisionné via ConfigMap (label `grafana_dashboard: "1"`) — affiche en temps réel (refresh 5s) :
  - Nombre de pods Running dans le namespace `default`
  - Consommation CPU totale de l'app (millicores)

**URL Grafana** : `http://k8s-monitori-grafana-3b0d9d46dd-153495616.eu-west-3.elb.amazonaws.com`
Login : `admin` / `changeme-avant-la-demo`
Dashboard : **"Worldcup — Pods en temps réel"**

**URL Prometheus** : `http://k8s-monitori-promethe-008cbb6d6a-1177838317.eu-west-3.elb.amazonaws.com`

### 5. CronJob + IRSA

- Bucket S3 recréé : `worldcup-exports-673586358333`
- Policy IAM `WorldCupS3ExportPolicy` créée
- Service account IRSA `worldcup-cronjob-sa` créé via eksctl (pas de clé AWS dans les pods)
- CronJob `classement-quotidien` déployé — planifié à minuit UTC
- Test manuel : fichier `reports/classement-2026-07-02.json` (20 Ko) généré en S3 ✅

### 6. Cluster Autoscaler

- Déployé sur `worldcup-cluster-2` (discovery tag corrigé)
- Surveille le nodegroup `workers` (min: 2, max: 4) et scale automatiquement selon la charge

---

## Correctifs techniques rencontrés et résolus

| Problème | Solution |
|----------|----------|
| CF stack bloquée en DELETE_FAILED (subnet utilisé par RDS) | `--retain-resources SubnetPublicEUWEST3A` + nouveau nom de cluster |
| IGW supprimé par la dépilation CF | Recréé manuellement + route table 0.0.0.0/0 |
| ALB `AccessDenied: DescribeListenerAttributes` | Policy ALB mise à jour vers v2.12.0 |
| ALB `AccessDenied: DescribeRouteTables` | Inline policy ajoutée sur `AmazonEKSLoadBalancerControllerRole-v2` |
| ALB `couldn't auto-discover subnets` | Tags `kubernetes.io/role/elb: 1` + `kubernetes.io/cluster/worldcup-cluster-2: owned` ajoutés |
| Grafana LoadBalancer pending (NLB sans annotations) | Changé en ClusterIP + Ingress ALB |
| PowerShell `curl -X POST` syntaxe invalide | Remplacé par `Invoke-WebRequest -Method POST` |

---

## État final du cluster (2026-07-03)

| Composant | Statut |
|-----------|--------|
| Cluster EKS `worldcup-cluster-2` (t3.small x2) | ✅ Running |
| App (2 pods, HPA, PDB, anti-affinity multi-AZ) | ✅ Running |
| RDS `worldcup-db2` connectée | ✅ |
| ALB + Ingress | ✅ |
| Crash test / self-healing (< 2s) | ✅ Vérifié |
| Prometheus + Grafana (URLs publiques) | ✅ Running |
| Dashboard custom "Pods + CPU en temps réel" | ✅ Provisionné |
| CronJob classement quotidien + IRSA → S3 | ✅ Testé |
| Cluster Autoscaler | ✅ Running |
| CI/CD GitHub Actions | ✅ (existant) |
