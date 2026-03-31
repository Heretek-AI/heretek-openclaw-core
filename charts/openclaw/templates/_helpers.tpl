{{/*
Expand the name of the chart.
*/}}
{{- define "openclaw.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "openclaw.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "openclaw.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "openclaw.labels" -}}
helm.sh/chart: {{ include "openclaw.chart" . }}
{{ include "openclaw.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.global.labels }}
{{ toYaml .Values.global.labels }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "openclaw.selectorLabels" -}}
app.kubernetes.io/name: {{ include "openclaw.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "openclaw.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "openclaw.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
OpenClaw Gateway labels
*/}}
{{- define "openclaw.gateway.labels" -}}
app.kubernetes.io/component: gateway
{{ include "openclaw.labels" . }}
{{- end }}

{{/*
OpenClaw Gateway selector labels
*/}}
{{- define "openclaw.gateway.selectorLabels" -}}
{{ include "openclaw.selectorLabels" . }}
app.kubernetes.io/component: gateway
{{- end }}

{{/*
LiteLLM labels
*/}}
{{- define "openclaw.litellm.labels" -}}
app.kubernetes.io/component: litellm
{{ include "openclaw.labels" . }}
{{- end }}

{{/*
LiteLLM selector labels
*/}}
{{- define "openclaw.litellm.selectorLabels" -}}
{{ include "openclaw.selectorLabels" . }}
app.kubernetes.io/component: litellm
{{- end }}

{{/*
PostgreSQL labels
*/}}
{{- define "openclaw.postgresql.labels" -}}
app.kubernetes.io/component: postgresql
{{ include "openclaw.labels" . }}
{{- end }}

{{/*
PostgreSQL selector labels
*/}}
{{- define "openclaw.postgresql.selectorLabels" -}}
{{ include "openclaw.selectorLabels" . }}
app.kubernetes.io/component: postgresql
{{- end }}

{{/*
Redis labels
*/}}
{{- define "openclaw.redis.labels" -}}
app.kubernetes.io/component: redis
{{ include "openclaw.labels" . }}
{{- end }}

{{/*
Redis selector labels
*/}}
{{- define "openclaw.redis.selectorLabels" -}}
{{ include "openclaw.selectorLabels" . }}
app.kubernetes.io/component: redis
{{- end }}

{{/*
Ollama labels
*/}}
{{- define "openclaw.ollama.labels" -}}
app.kubernetes.io/component: ollama
{{ include "openclaw.labels" . }}
{{- end }}

{{/*
Ollama selector labels
*/}}
{{- define "openclaw.ollama.selectorLabels" -}}
{{ include "openclaw.selectorLabels" . }}
app.kubernetes.io/component: ollama
{{- end }}

{{/*
Neo4j labels
*/}}
{{- define "openclaw.neo4j.labels" -}}
app.kubernetes.io/component: neo4j
{{ include "openclaw.labels" . }}
{{- end }}

{{/*
Neo4j selector labels
*/}}
{{- define "openclaw.neo4j.selectorLabels" -}}
{{ include "openclaw.selectorLabels" . }}
app.kubernetes.io/component: neo4j
{{- end }}

{{/*
Langfuse labels
*/}}
{{- define "openclaw.langfuse.labels" -}}
app.kubernetes.io/component: langfuse
{{ include "openclaw.labels" . }}
{{- end }}

{{/*
Langfuse selector labels
*/}}
{{- define "openclaw.langfuse.selectorLabels" -}}
{{ include "openclaw.selectorLabels" . }}
app.kubernetes.io/component: langfuse
{{- end }}

{{/*
Generate secret key if not provided
*/}}
{{- define "openclaw.generateSecret" -}}
{{- if . }}
{{- . | b64enc | quote }}
{{- else }}
{{- randAlphaNum 32 | b64enc | quote }}
{{- end }}
{{- end }}
