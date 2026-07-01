# 🏆 Capstone — Coupe du Monde 2026 : Déploiement Cloud

## Le Scénario

En vue de la nouvelle Coupe de Monde, la FIFA a missionner votre entreprise pour moderniser son site internet utilisé pour suivre les résultats sportif du championnat et de l’héberger dans une solution Cloud ou Cloud-Native capable de s’adapter à la charge.

Votre équipe a été choisit pour:
- Déployer une application Node.js + PostgreSQL sur le cloud
- Démontrer la haute disponibilité, l’élasticité, la résilience et en  l’observabilité de la platforme dans sa version modernisée.

Vous présenterez votre solution lors d’une soutenance de 40 minutes

> **Votre mission :** Migrer, moderniser et sécuriser cette application pour la rendre hautement disponible, résiliente, scalable et industrialisée. Vous avez carte blanche sur les choix d'architecture, mais le temps presse : **vous avez 2,5 jours avant la mise en production officielle (le crash-test en soutenance de 40 minutes).**

---

## Démarrage rapide

```bash
# 1. Cloner le dépôt
git clone <url-du-depot>
cd capstone-dplc

# 2. Lancer en local
docker-compose up --build

# 3. Vérifier
curl http://localhost:3000/api/health    # → {"status":"ok"}
curl http://localhost:3000/metrics       # → métriques Prometheus
```

---

## Déploiement (AWS / EKS)

- **URL publique** : _à compléter après déploiement_ (`kubectl get ingress`)
- **Grafana** : _à compléter après déploiement_ (admin / voir `monitoring/prometheus-values.yaml`)
- **Coût estimé** : voir [docs/FINOPS.md](docs/FINOPS.md)
- **Architecture** : voir [docs/architecture.md](docs/architecture.md)

```bash
# Construire et pousser l'image sur ECR, puis créer le cluster
eksctl create cluster -f infra/cluster.yaml
kubectl apply -f infra/cluster-autoscaler.yaml

# Créer le secret DB (jamais en clair dans Git)
kubectl create secret generic db-credentials \
  --from-literal=DB_HOST=<endpoint-rds> --from-literal=DB_PORT=5432 \
  --from-literal=DB_USER=postgres --from-literal=DB_PASSWORD=<mdp> \
  --from-literal=DB_NAME=worldcup2026

# Déployer l'application
helm install worldcup ./helm/worldcup --set image.repository=<ecr-url>

# Monitoring (procédure détaillée : monitoring/README.md)
# -> Prometheus/Grafana, Loki/Promtail (logs centralisés), alerting Slack,
#    dashboard auto-provisionné

# Job Mission 3
kubectl apply -f job/serviceaccount.yaml -f job/cronjob.yaml
```

---

## Structure du projet

```
.
├── app/                          # Code source de l'application (Node.js) — non modifié
│   ├── main.js
│   ├── Dockerfile                # ✅ optimisé (voir OPTIMISATION.md)
│   ├── .dockerignore
│   └── tests/
├── helm/worldcup/                # ✅ Helm Chart : Deployment, Service, HPA, Ingress
├── infra/                        # ✅ Config eksctl (= CloudFormation) + Cluster Autoscaler
│   ├── cluster.yaml
│   └── cluster-autoscaler.yaml
├── monitoring/                   # ✅ Prometheus/Grafana + Loki/Promtail (logs) + alerting Slack
│   ├── README.md                 # Procédure d'installation complète
│   ├── prometheus-values.yaml
│   ├── prometheus-values.secret.yaml.example  # Template webhook Slack (le vrai fichier est gitignoré)
│   ├── loki-values.yaml
│   ├── servicemonitor.yaml
│   ├── alerts.yaml
│   └── grafana-dashboard.json
├── job/                          # ✅ Mission 3 : CronJob rapport quotidien → S3
│   ├── job.js
│   ├── Dockerfile
│   ├── cronjob.yaml
│   └── serviceaccount.yaml       # IRSA (accès S3 sans clé statique)
├── tests/load-test.js            # ✅ Script k6 (démo élasticité)
├── .github/workflows/deploy.yml  # ✅ CI/CD : test → build → push ECR → helm upgrade
├── docs/
│   ├── GUIDE-ETUDIANT.md         # Guide technique fourni (routes API, variables, conseils)
│   ├── FINOPS.md                 # ✅ Estimation de coût chiffrée
│   └── architecture.md           # ✅ Schéma d'architecture (Mermaid)
├── OPTIMISATION.md                # ✅ Anti-patterns Dockerfile corrigés + pourquoi
├── docker-compose.yml             # Orchestration locale — non modifié
└── README.md                      # Ce fichier
```

---

## Vos missions

### 1. Optimiser le Dockerfile

Le Dockerfile fourni est volontairement mauvais. Vous devez le réécrire selon les bonnes pratiques professionnelles (image légère, sécurité, performance de build). Il y a 5 anti-patterns.

### 2. Déployer sur le cloud

Choisissez **une** des deux approches :

| Option A — AWS (Cloud Managé) | Option B — Kubernetes (Cloud Agnostique) |
|-------------------------------|------------------------------------------|
| VPC multi-AZ, Load Balancer, Compute auto-scalé, Base de données managée | Deployment avec auto-scaling, Ingress, Probes, Base de données persistante |
| Observabilité via CloudWatch | Observabilité via Prometheus + Grafana |

### 3. Répondre aux challenges techniques

| Challenge | Objectif |
|-----------|----------|
| **Industrialisation** | Déploiement reproductible (IaC ou Runbook rigoureux) |
| **Mur de charge** | Votre infra doit absorber un pic de trafic sans s'effondrer |
| **Bouton rouge** | L'application doit se rétablir automatiquement après un crash |
| **FinOps** | Justifier le dimensionnement et estimer le coût mensuel |

### 4. Job créatif (bonus)

Concevez un Job qui lit les données sportives en base et produit un résultat exploitable de votre choix (stats, classement, rapport, notification…).

---

## Livrables attendus

1. **Infrastructure** — Fichiers IaC (Terraform, Helm, CloudFormation…) ou `RUNBOOK.md` reproductible
2. **Dockerfile optimisé** — Selon les bonnes pratiques de conteneurisation
3. **Schéma d'architecture** — Diagramme technique clair et légendé
4. **README.md de votre dépôt** — URL publique d'accès + accès métriques/dashboards

---

## Soutenance (35 min)

La soutenance est une **revue d'ingénierie en direct** — pas de PowerPoint.

| Phase | Durée | Contenu |
|-------|-------|---------|
| Architecture & Pitch | 10 min | Présentation du diagramme, justification des choix techniques, stratégie budgétaire |
| Démo en direct | 10 min | Preuve que l'infra fonctionne (CI/CD ou exécution du Runbook) |
| Crash Test du jury | 15 min | Tests automatisés pilotés par l'enseignant sur votre infrastructure |

---

## Grille d'évaluation (sur 20 points)

| Critère | Points |
|---------|:------:|
| **Soutenance & Maîtrise technique orale** — Clarté, profondeur technique, réponses aux questions | **6** |
| **Choix architecturaux & Design** — Pertinence, reproductibilité, sécurité | **5** |
| **Élasticité & Auto-scaling** — Réaction autonome face à la charge | **4** |
| **Résilience & Self-Healing** — Rétablissement automatique après panne | **3** |
| **Observabilité & FinOps** — Dashboard opérationnel + estimation de coût chiffrée | **2** |
| **Total** | **20** |

**Bonus** (+2 pts max, plafond à 20) : Job créatif (+1) | CI/CD ou GitOps démontré (+1)

> La soutenance orale et la maîtrise technique représentent le plus gros coefficient. Comprendre et défendre vos choix compte autant que les avoir implémentés.

---

## Documentation

Consultez le [Guide Étudiant](docs/GUIDE-ETUDIANT.md) pour les détails techniques : routes API, variables d'environnement, exemples de requêtes, et conseils.
