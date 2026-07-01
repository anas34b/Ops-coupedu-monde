# Même structure que app/Dockerfile (voir OPTIMISATION.md pour le détail
# multi-stage / non-root) : ce job est un petit script, pas un serveur, donc
# pas d'EXPOSE de port nécessaire ici.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY job.js ./
USER node
# Lance le script une fois et s'arrête (pas de boucle infinie) : c'est le
# CronJob (job/cronjob.yaml) qui se charge de le relancer selon le planning.
CMD ["node", "job.js"]
