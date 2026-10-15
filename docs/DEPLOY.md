# Deployment auf lab.hugobarthelmess.de

Film Lab ist eine statische Seite. Ein nginx-Container (`film-lab`) liefert den Vite-Build aus.
Er hängt im Netz `web-stack_default` des OTC-Servers (164.30.69.35), der zentrale `nginx`
aus `/opt/web-stack` beendet TLS und reicht weiter – genau wie beim Orbital Atlas (`tracker.`).

Dateien im Repo:

| Datei | Zweck |
|---|---|
| `deploy/Dockerfile` | Build mit Node 22, Auslieferung mit nginx 1.27 |
| `deploy/compose.yml` | Container `film-lab` im Netz `web-stack_default`, ohne Host-Port |
| `deploy/nginx.conf` | Auslieferung, Cache-Regeln, MIME für `.webmanifest`/`.wasm` |
| `deploy/security-headers.conf` | CSP und weitere Header (auch vom E2E-Test genutzt) |
| `deploy/lab.conf.template` | Vorlage für `/opt/web-stack/nginx/templates/lab.conf.template` |
| `deploy/deploy.sh` | Kopie nach `~/film-lab/deploy.sh`; holt einen Commit, baut, tauscht den Container |
| `.github/workflows/ci.yml` | Tests bei jedem Push; Deploy nur mit `DEPLOY_ENABLED=true` |

## 1. DNS (netcup-CCP)

A-Record `lab` → `164.30.69.35`. Prüfen: `dig +short lab.hugobarthelmess.de @1.1.1.1`.

## 2. Server einrichten (als `ubuntu`)

```bash
ssh otc 'bash -s' <<'SKRIPT'
set -euo pipefail
mkdir -p ~/film-lab && cd ~/film-lab
[ -d repo ] || git clone -q https://github.com/Hugo800/film-lab.git repo
cp repo/deploy/deploy.sh ./deploy.sh && chmod +x deploy.sh
./deploy.sh main
docker ps --filter name=^film-lab$ --format '{{.Names}} {{.Status}}'
SKRIPT
```

## 3. nginx: erst Port 80, Zertifikat, dann 443

```bash
ssh otc 'bash -s' <<'SKRIPT'
set -euo pipefail
T=/opt/web-stack/nginx/templates/lab.conf.template
# Nur den Port-80-Block übernehmen (bis zur ersten Leerzeile nach „server {“ … „}“)
awk '/^server \{/{n++} n==1' ~/film-lab/repo/deploy/lab.conf.template | sed '/^}/q' > "$T"
docker exec nginx sh -c "/docker-entrypoint.d/20-envsubst-on-templates.sh >/dev/null && nginx -t && nginx -s reload"
cd /opt/web-stack && docker compose run -T --rm --entrypoint certbot certbot certonly --webroot \
  -w /var/www/certbot -d lab.hugobarthelmess.de --agree-tos --register-unsafely-without-email --non-interactive </dev/null
cp ~/film-lab/repo/deploy/lab.conf.template "$T"
docker exec nginx sh -c "/docker-entrypoint.d/20-envsubst-on-templates.sh >/dev/null && nginx -t && nginx -s reload"
SKRIPT
```

Danach von außen prüfen (nicht vom Server selbst, dort kam bei `tracker.` direkt nach dem Reload `000`):

```bash
curl -sI https://lab.hugobarthelmess.de/ | head -5
```

## 4. Automatisches Deployment per GitHub Actions

```bash
K=$(mktemp -d)/film-lab-deploy
ssh-keygen -t ed25519 -N '' -C film-lab-deploy -f "$K"
ssh otc "cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak-$(date +%Y%m%d) && \
  echo 'restrict,command=\"/home/ubuntu/film-lab/deploy.sh\" $(cat "$K.pub")' >> ~/.ssh/authorized_keys"
gh secret set DEPLOY_SSH_KEY -R Hugo800/film-lab < "$K"
ssh-keyscan -t ed25519 164.30.69.35 2>/dev/null | gh secret set DEPLOY_KNOWN_HOSTS -R Hugo800/film-lab
gh variable set DEPLOY_ENABLED -R Hugo800/film-lab --body true
rm -f "$K" "$K.pub"
```

Den Keyscan vorher mit dem eigenen `~/.ssh/known_hosts` vergleichen
(`ssh-keygen -F 164.30.69.35 -l`). Ab dann geht jeder grüne Push auf `main` live.

## Zurücknehmen

```bash
ssh otc 'docker compose -f ~/film-lab/repo/deploy/compose.yml down && \
  rm /opt/web-stack/nginx/templates/lab.conf.template && \
  docker exec nginx sh -c "/docker-entrypoint.d/20-envsubst-on-templates.sh >/dev/null && nginx -t && nginx -s reload"'
gh variable set DEPLOY_ENABLED -R Hugo800/film-lab --body false
```
