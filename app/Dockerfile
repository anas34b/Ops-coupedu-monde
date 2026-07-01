# Multi-stage build : cette étape "builder" installe les dépendances, mais
# n'est PAS conservée dans l'image finale. Ça évite d'embarquer les outils de
# build inutiles en prod (détail complet : OPTIMISATION.md).
# node:22-alpine (et pas "latest") : tag figé + base Alpine légère.
FROM node:22-alpine AS builder

WORKDIR /app

# On copie SEULEMENT les fichiers de dépendances d'abord, pas tout le code.
# Tant que package.json ne change pas, Docker réutilise le cache de cette
# couche -> npm ci ne se relance pas à chaque modif de code.
COPY package*.json ./
# "ci" (et pas "install") = installation déterministe depuis le lockfile.
# "--omit=dev" = n'installe pas jest/supertest/fast-check (utiles seulement
# pour les tests, pas pour faire tourner l'app en prod).
RUN npm ci --omit=dev

# ---- Étape 2 : l'image qui sera réellement déployée ----
FROM node:22-alpine

WORKDIR /app

# On récupère uniquement le résultat de l'install (node_modules) depuis
# l'étape précédente, pas les outils de build.
COPY --from=builder /app/node_modules ./node_modules
# Le .dockerignore à côté de ce fichier exclut node_modules/.git/tests/...
# de cette copie, donc l'image ne contient que le code applicatif utile.
COPY . .

# Sécurité : "node" est un utilisateur non-root déjà présent dans l'image
# officielle node:alpine. Sans cette ligne, le process tournerait en root.
USER node

EXPOSE 3000

CMD ["node", "main.js"]
