# Schéma d'architecture

> Diagramme source (Mermaid), à exporter en PNG (draw.io / Excalidraw / capture
> d'écran du rendu Mermaid) pour la slide de soutenance → `docs/architecture.png`.

## Version simplifiée (pour la slide de présentation)

```mermaid
flowchart TB
    User((Utilisateur)) --> ALB[ALB]
    ALB --> EKS["Cluster EKS<br/>2 à 10 pods, 2 AZ"]
    EKS --> RDS[("RDS PostgreSQL")]

    EKS -.-> Obs["Prometheus + Grafana + Loki"]
    EKS -.-> Job["CronJob"] --> S3[("S3")]
    GH["GitHub Actions"] -.déploie.-> EKS
```

Cette version garde juste l'essentiel pour une slide lisible à distance : le
chemin de la requête (Utilisateur → ALB → EKS → RDS) + les 3 briques annexes
(observabilité, Job, CI/CD) sans détailler chaque flèche technique.

## Version détaillée (pour répondre aux questions techniques)

```mermaid
flowchart TB
    Internet((Internet))

    subgraph AWS["AWS - eu-west-3"]
        ALB["ALB<br/>(AWS Load Balancer Controller / Ingress)"]

        subgraph EKS["EKS Cluster - 2 AZ"]
            direction TB
            subgraph AZ_A["AZ eu-west-3a"]
                Pod1["Pod app #1"]
            end
            subgraph AZ_B["AZ eu-west-3b"]
                Pod2["Pod app #2..N"]
            end
            MS["metrics-server<br/>(fournit le CPU au HPA)"]
            HPA["HPA<br/>(CPU > 70%)"]
            CA["Cluster Autoscaler<br/>(ajoute des nœuds EC2)"]
            Prom["Prometheus"]
            Loki["Loki<br/>(logs centralisés)"]
            Graf["Grafana"]
            CronJob["CronJob<br/>rapport quotidien"]
        end

        RDS[("RDS PostgreSQL<br/>single-AZ")]
        S3[("S3<br/>rapports")]
        ECR["ECR<br/>(images Docker)"]
    end

    GH["GitHub Actions<br/>(CI/CD, OIDC)"]

    Internet --> ALB
    ALB --> Pod1
    ALB --> Pod2
    Pod1 --> RDS
    Pod2 --> RDS
    MS -.fournit CPU.-> HPA
    HPA -.scale pods.-> Pod1
    HPA -.scale pods.-> Pod2
    CA -.scale nœuds.-> EKS
    Prom -.scrape /metrics.-> Pod1
    Prom -.scrape /metrics.-> Pod2
    Loki -.collecte logs.-> Pod1
    Loki -.collecte logs.-> Pod2
    Graf --> Prom
    Graf --> Loki
    CronJob -->|lit| RDS
    CronJob -->|écrit| S3
    GH -->|build & push| ECR
    GH -->|helm upgrade| EKS
    ECR -.pull image.-> Pod1
    ECR -.pull image.-> Pod2
```

## Lecture du schéma

1. **Internet → ALB** : point d'entrée public, répartit le trafic entre les pods.
2. **2 AZ** : les pods sont répartis sur deux zones de disponibilité → haute dispo.
3. **HPA** : ajoute/retire des pods selon le CPU (élasticité applicative).
4. **Cluster Autoscaler** : ajoute/retire des nœuds EC2 quand les pods ne tiennent
   plus sur les machines existantes (élasticité infra, nécessaire pour les pics de
   charge type 100k utilisateurs).
5. **RDS PostgreSQL single-AZ** : seul composant stateful, géré par AWS, hors du
   cluster.
6. **metrics-server** : collecte le CPU/RAM réel des pods, c'est la seule
   source d'info du HPA — sans lui, aucun scaling n'est possible.
7. **Prometheus + Grafana + Loki** : Prometheus scrape `/metrics` (déjà exposé
   par l'app), Loki centralise les logs de tous les pods, Grafana affiche les
   deux dans les mêmes dashboards en direct pendant la démo.
7. **CronJob** : tâche planifiée (Mission 3) qui lit la base et dépose un rapport
   JSON sur S3.
8. **GitHub Actions** : à chaque push sur `main`, build l'image, la pousse sur ECR,
   puis déploie via `helm upgrade` (authentification AWS par OIDC, sans clé statique).
