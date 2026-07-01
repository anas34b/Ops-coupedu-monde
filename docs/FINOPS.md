# FinOps — Estimation de coût

## Architecture cible

EKS (2 AZ, nodegroup managé t3.micro 2→8) + RDS PostgreSQL single-AZ (Free Tier) +
ALB + ECR + S3 (rapports du Job).

> **Ajustement en cours de déploiement** : `t3.medium` a été refusé par AWS
> (compte restreint aux instances éligibles Free Tier). Passage à `t3.micro`,
> avec la densité de pods par nœud compensée via le prefix delegation du CNI
> (voir `infra/cluster.yaml`). Bonne nouvelle FinOps : `t3.micro` est éligible
> au Free Tier EC2 (750h/mois gratuites la 1ère année), donc le coût nœuds
> ci-dessous est en réalité un plafond haut, pas le coût réel attendu.

## Estimation de coût mensuel (run 24h/24)

| Poste | Coût mensuel estimé | Détail |
|---|---:|---|
| Control plane EKS | ~73 $ | Tarif fixe AWS par cluster |
| Nœuds EC2 (2-4× t3.micro en moyenne) | ~0-15 $ | Éligible Free Tier (750h/mois) ; scale 2 → 8 selon charge (HPA + Cluster Autoscaler) |
| ALB (Application Load Balancer) | ~18 $ | + coût par Go traité |
| RDS PostgreSQL `db.t3.micro` single-AZ | ~0 $ | Couvert par le Free Tier (12 mois) |
| ECR (stockage images) | ~1-2 $ | Quelques images Docker (~150-200 Mo chacune) |
| S3 (rapports du Job) | < 1 $ | Fichiers JSON légers, faible volume |
| **Total (run permanent)** | **~95-110 $/mois** | |

## Coût réel pour le projet (infra éphémère)

Le cluster n'est créé que pour la phase de build/tests et la soutenance, puis détruit :

| Poste | Coût réel estimé (~1 semaine d'usage + destruction) |
|---|---:|
| Control plane EKS | ~17 $ |
| Nœuds EC2 (t3.micro, Free Tier) | ~0-5 $ |
| ALB | ~5 $ |
| RDS / ECR / S3 | ~qq $ |
| **Total réel** | **~25-30 $** |

→ Largement couvert par les crédits du Free Tier / crédits étudiants AWS.

## Stratégie de maîtrise des coûts

1. **AWS Budgets** : alarme configurée à 25 $ / 50 $ / 75 $ avec notification par e-mail
   (à faire en premier, avant toute création de ressource).
2. **Infra éphémère** : le cluster est créé via `eksctl create cluster -f infra/cluster.yaml`
   pour les phases de travail et la soutenance, et détruit via `eksctl delete cluster`
   ensuite — on ne paie que ce qu'on utilise.
3. **Pas de NAT Gateway** (~32 $/mois) : les nœuds sont placés en subnet public pour la
   démo (`infra/cluster.yaml`), ce qui est acceptable pour un projet de courte durée
   mais à revoir pour une vraie mise en production.
4. **RDS single-AZ plutôt que Multi-AZ** : économise ~30 $/mois. Trade-off assumé —
   en production, le passage en Multi-AZ (réplication + failover automatique) ne
   nécessite qu'un paramètre.
5. **Rétention Prometheus réduite à 6h** (`monitoring/prometheus-values.yaml`) :
   suffisant pour la démo, évite de payer du stockage EBS supplémentaire.

## Trade-off coût vs performance vs complexité

| Choix | Coût | Performance/HA | Complexité |
|---|---|---|---|
| EKS managé (retenu) | $$ (control plane fixe) | Multi-AZ, scaling nœuds + pods | Moyenne (eksctl simplifie) |
| k3s single-node (écarté) | $ (gratuit) | ❌ ne scale pas, pas de HA | Faible |
| ECS Fargate (alternative) | $$ | Bonne, serverless | Faible, mais pas Kubernetes |
| RDS Multi-AZ (écarté pour la démo) | +30 $/mois | Vraie HA BDD | Aucune (paramètre RDS) |
