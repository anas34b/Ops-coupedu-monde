# Optimisation du Dockerfile

Le `Dockerfile` fourni contenait 5 anti-patterns volontaires. Voici ce qui a été
corrigé et pourquoi.

## 1. `FROM node:latest` → `FROM node:22-alpine`

**Problème** : le tag `latest` est flottant — l'image construite aujourd'hui n'est
pas forcément celle construite demain (non reproductible). En plus, l'image de base
Debian fait ~1,1 Go.

**Correction** : on fige la version (`22-alpine`), basée sur Alpine Linux, beaucoup
plus légère.

## 2. Absence de `.dockerignore`

**Problème** : `COPY . .` embarquait `node_modules`, `.git`, `tests/`, les logs…
dans l'image, gonflant sa taille et exposant des fichiers inutiles voire sensibles.

**Correction** : ajout de `app/.dockerignore` qui exclut `node_modules`, `.git`,
`coverage`, `tests`, `*.log`, `.env`.

## 3. `COPY . .` avant `npm install`

**Problème** : copier tout le code avant d'installer les dépendances casse le cache
de build Docker — le moindre changement dans le code (même un commentaire) invalide
le cache et force une réinstallation complète des dépendances à chaque build.

**Correction** : on copie d'abord `package*.json`, on installe, puis seulement
ensuite on copie le reste du code. Le layer d'installation reste en cache tant que
les dépendances ne changent pas.

## 4. `npm install` → `npm ci --omit=dev`

**Problème** : `npm install` installe aussi les `devDependencies` (jest, fast-check,
supertest) dans l'image de production, et n'est pas garanti déterministe vis-à-vis
du lockfile.

**Correction** : `npm ci --omit=dev` installe exactement les versions du
`package-lock.json` (build reproductible) et exclut les dépendances de
développement.

## 5. Exécution en root

**Problème** : le conteneur tournait avec l'utilisateur `root` par défaut — si un
attaquant compromet le processus Node, il a les pleins droits dans le conteneur.

**Correction** : ajout de `USER node`, un utilisateur non-root déjà présent dans
l'image officielle `node:22-alpine`.

## Bonus : multi-stage build

En plus des 5 corrections, le build est passé en deux étapes (`builder` puis image
finale) : l'étape `builder` installe les dépendances, l'étape finale ne récupère que
`node_modules` et le code applicatif. Cela évite d'embarquer les outils de build dans
l'image livrée.

## Résultat mesuré

| | Avant | Après |
|---|---|---|
| Taille de l'image | ~1,1 Go (`node:latest`) | **169 Mo** (`node:22-alpine`) |
| Reproductibilité | Tag flottant | Tag figé + `npm ci` |
| Dépendances en prod | dev + prod | prod uniquement |
| Utilisateur | root | `node` (non-root) |
| Cache de build | cassé à chaque changement de code | optimisé (deps cachées séparément) |

Build et tests vérifiés en local avec `docker build` puis `docker compose up
--build` : toutes les routes (`/`, `/api/health/db`, `/metrics`,
`/api/admin/kill`) répondent correctement sous l'utilisateur non-root.
