{{/*
Fichier "helpers" : des bouts de texte réutilisables par tous les autres
templates (deployment.yaml, service.yaml, etc.), pour éviter de répéter le
même nom ou les mêmes labels partout. Standard dans tous les Helm Charts.
*/}}

{{/* Le nom court de l'app, ex: "worldcup" */}}
{{- define "worldcup.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{/* Nom complet utilisé pour toutes les ressources K8s : "<release>-<chart>" */}}
{{- define "worldcup.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Labels "informatifs" posés sur chaque ressource (visibles dans kubectl get -o yaml) */}}
{{- define "worldcup.labels" -}}
app.kubernetes.io/name: {{ include "worldcup.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/* Labels utilisés pour le MATCHING (Service -> Pods, HPA -> Deployment, etc.) */}}
{{- define "worldcup.selectorLabels" -}}
app.kubernetes.io/name: {{ include "worldcup.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
