// Script k6 — démonstration de l'élasticité (HPA + Cluster Autoscaler) sous charge.
// Usage : k6 run -e BASE_URL=http://<url-publique> tests/load-test.js
//
// Pendant que ce script tourne, ouvrir Grafana à côté : on doit voir le CPU
// monter, puis le nombre de pods augmenter (HPA), et si besoin le nombre de
// nœuds augmenter aussi (Cluster Autoscaler).

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  // "target" = nombre d'utilisateurs virtuels simulés en simultané.
  // Une montée progressive (pas un pic brutal d'entrée) pour laisser le
  // temps au HPA de réagir et au Cluster Autoscaler de provisionner des
  // machines si besoin (ça prend 1-2 minutes pour une nouvelle machine EC2).
  stages: [
    { duration: "1m", target: 100 }, // montée progressive
    { duration: "3m", target: 1000 }, // charge soutenue
    { duration: "5m", target: 5000 }, // pic (simule l'objectif "100k users" à l'échelle)
    { duration: "2m", target: 0 }, // descente -> on doit aussi voir le HPA redescendre
  ],
  // Si ces seuils ne sont pas respectés, k6 sort en erreur (utile en CI,
  // ici surtout pour avoir un signal clair pendant la démo).
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% des requêtes < 2s
    http_req_failed: ["rate<0.01"], // moins de 1% d'erreurs
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Chaque "utilisateur virtuel" exécute cette fonction en boucle. À chaque
// itération, on tire une route au hasard pour simuler un trafic réaliste
// (pas juste un seul endpoint matraqué).
export default function () {
  const routes = [
    () => http.get(`${BASE_URL}/`),
    () => http.get(`${BASE_URL}/api/votes/results`),
    () =>
      http.post(
        `${BASE_URL}/api/vote`,
        JSON.stringify({ team_id: Math.ceil(Math.random() * 48) }),
        { headers: { "Content-Type": "application/json" } }
      ),
    () => http.get(`${BASE_URL}/api/compute`), // sature le CPU -> déclenche le HPA
  ];

  const fn = routes[Math.floor(Math.random() * routes.length)];
  const res = fn();
  check(res, { "status < 500": (r) => r.status < 500 });
  sleep(1); // pause entre 2 requêtes du même utilisateur virtuel (réalisme)
}
