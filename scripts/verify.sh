#!/usr/bin/env bash
set -euo pipefail
red() { printf "\033[31m%s\033[0m\n" "$*"; }
grn() { printf "\033[32m%s\033[0m\n" "$*"; }
ylw() { printf "\033[33m%s\033[0m\n" "$*"; }

fail=0
check_file() {
  local p="$1"
  if [[ -f "$p" ]]; then grn "✓ $p"; else red "✗ MISSING: $p"; fail=1; fi
}

echo "== Checking expected files =="
check_file services/api/package.json
check_file services/api/src/index.js
check_file services/api/Dockerfile
check_file docker-compose.yml
check_file monitor/prometheus/prometheus.yml
check_file monitor/prometheus/rules.yml
check_file monitor/alertmanager/alertmanager.yml
check_file remediator/package.json
check_file remediator/app.js
check_file remediator/Dockerfile

echo
echo "== Validating key content =="
has() { grep -Eiq "$2" "$1" && grn "✓ $1 contains $2" || { red "✗ $1 missing $2"; fail=1; }; }

# API
has services/api/package.json '"express"'
has services/api/package.json '"prom-client"'
has services/api/src/index.js 'app\.get\("/healthz"'
has services/api/src/index.js 'app\.get\("/metrics"'
has services/api/src/index.js 'app\.get\("/api/chaos"'
has services/api/Dockerfile 'HEALTHCHECK'
has services/api/Dockerfile 'EXPOSE 3000'

# docker-compose
has docker-compose.yml '^version:|^services:'
has docker-compose.yml 'api:'
has docker-compose.yml 'restart: always'
has docker-compose.yml 'labels:.*autoheal=true'
has docker-compose.yml 'prometheus:'
has docker-compose.yml 'alertmanager:'
has docker-compose.yml 'remediator:'
has docker-compose.yml '/var/run/docker\.sock'
has docker-compose.yml 'grafana:'

# Prometheus
has monitor/prometheus/prometheus.yml 'scrape_interval'
has monitor/prometheus/prometheus.yml 'job_name:.*api'
has monitor/prometheus/rules.yml 'alert: TargetDown'
has monitor/prometheus/rules.yml 'alert: ApiHighErrorRate'

# Alertmanager
has monitor/alertmanager/alertmanager.yml 'webhook_configs:'
has monitor/alertmanager/alertmanager.yml 'http://remediator:8080/alerts'

# Remediator
has remediator/package.json '"dockerode"'
has remediator/app.js 'dockerode'
has remediator/app.js 'ALLOWED_LABEL'
has remediator/app.js 'restart\('
has remediator/Dockerfile 'EXPOSE 8080'

echo
if [[ $fail -eq 0 ]]; then grn "✅ All checks passed"; else ylw "⚠ Some checks failed — see above"; fi
exit $fail
