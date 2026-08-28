# Production Deployment — crm.origami.dev

Static Next.js export served **directly by nginx** (no PM2, no systemd app unit, no Node process at runtime).

| | |
|---|---|
| App path | `/home/sales-crm/crm.origami.dev` |
| Deploy user | `sales-crm` |
| Runtime | **nginx** → files in `current/` |
| Layout | `repo` / `releases` / `shared` / `current` |

---

## 1. Prerequisites

- Node.js **18+** (build machine / server; only needed to run `deploy.sh`)
- `npm`
- `nginx`
- Git SSH access for `sales-crm`

---

## 2. Secure directory structure

```bash
cd ~
mkdir -p /home/sales-crm/crm.origami.dev/{repo,releases,shared,logs,tmp}
ls ~/crm.origami.dev
# logs  releases  repo  shared  tmp

chown -R sales-crm:sales-crm /home/sales-crm/crm.origami.dev

chmod 711 /home/sales-crm/crm.origami.dev
chmod 750 /home/sales-crm/crm.origami.dev/{repo,releases,shared,logs,tmp}
```

| Path | Role |
|------|------|
| `repo/` | Git working tree + `deploy.sh` |
| `releases/` | Timestamped static builds (`out/`) |
| `shared/` | Persistent `.env` (build-time vars) |
| `logs/` | nginx logs |
| `tmp/` | Scratch |
| `current` | Symlink → live static files (nginx `root`) |

---

## 3. SSH key for GitHub

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
vim ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa
# Add public key on GitHub (Deploy key or user SSH key)

ssh -T git@github.com
```

---

## 4. Git checkout (first time)

```bash
cd ~/crm.origami.dev/repo
git clone git@github.com:eorigami-software/sale-crm.git .
```

---

## 5. Shared env

```bash
cat > ~/crm.origami.dev/shared/.env <<'EOF'
NEXT_PUBLIC_API_URL=https://salescrm-api.duckdns.org/api/v1
# NEXT_PUBLIC_CLOUDTALK_ENABLED=true
# NEXT_PUBLIC_CLOUDTALK_PARTNER=sale-crm
EOF

chmod 640 ~/crm.origami.dev/shared/.env
```

> `NEXT_PUBLIC_*` are baked into the static JS at **build** time. Change → re-run `./deploy.sh`.

---

## 6. Static export

`next.config.js`:

```js
output: "export",
trailingSlash: true,
images: { unoptimized: true },
```

Auth is enforced in the browser (`CRMLayout` / `useAuth`), not via Next middleware (incompatible with static export).

---

## 7. Deploy script

```bash
chmod +x ~/crm.origami.dev/repo/deploy.sh
~/crm.origami.dev/repo/deploy.sh
```

What it does:

1. `git pull` in `repo/`
2. Link `shared/.env` → `repo/.env`
3. `npm ci` + `npm run build` → writes `out/`
4. Copy `out/` into a new `releases/…` folder
5. Symlink `current` → that release
6. Prune old releases (keep 5)

No process restart — nginx only reads files from `current/`.

---

## 8. Nginx (serves static files directly)

`/etc/nginx/sites-available/crm.origami.dev`:

```nginx
server {
    listen 80;
    server_name crm.origami.dev;
    client_max_body_size 50M;

    root /home/sales-crm/crm.origami.dev/current;
    index index.html;

    # Prefer real files from the static export
    location / {
        try_files $uri $uri/ $uri.html @spa_detail;
    }

    # Detail routes (/leads/<id>/, etc.): serve the prerendered "_" shell.
    # The client reads the real id from the browser URL.
    location @spa_detail {
        rewrite ^/(leads|contacts|accounts|companies|deals|campaigns|raw-leads|qualified-leads|proposals|documents|tasks|meetings|calls|visits|projects)/([^/]+)/index\.txt$ /$1/_/index.txt last;
        rewrite ^/(leads|contacts|accounts|companies|deals|campaigns|raw-leads|qualified-leads|proposals|documents|tasks|meetings|calls|visits|projects)/([^/]+)/?$ /$1/_/index.html last;
        rewrite ^/settings/sales-targets/([^/]+)/edit/?$ /settings/sales-targets/_/edit/index.html last;
        return 404;
    }

    error_log  /home/sales-crm/crm.origami.dev/logs/nginx_error.log;
    access_log /home/sales-crm/crm.origami.dev/logs/nginx_access.log;
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/crm.origami.dev /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d crm.origami.dev
```

### Fix: `stat() ".../current/" failed (13: Permission denied)`

nginx runs as `www-data` and must **traverse every directory** on the path and **read** files under `current/`. `750` on `releases/` or `700`/`750` on `/home/sales-crm` blocks it.

Run as root (or with `sudo`):

```bash
# 1) Allow traverse down the path (execute bit only — no world listing)
chmod 711 /home/sales-crm
chmod 711 /home/sales-crm/crm.origami.dev

# 2) releases must be enterable; static files world-readable
chmod 755 /home/sales-crm/crm.origami.dev/releases
chmod -R a+rX /home/sales-crm/crm.origami.dev/current

# Keep private dirs locked down
chmod 750 /home/sales-crm/crm.origami.dev/{repo,shared,logs,tmp}
chmod 640 /home/sales-crm/crm.origami.dev/shared/.env 2>/dev/null || true
```

Verify as the nginx user:

```bash
sudo -u www-data stat /home/sales-crm/crm.origami.dev/current/
sudo -u www-data head -c 20 /home/sales-crm/crm.origami.dev/current/index.html
# should print without "Permission denied"
```

Then reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://crm.origami.dev
```

(`deploy.sh` applies the same `releases` / release-dir permissions on every deploy.)

---

## 9. Permissions checklist

| Target | Mode | Why |
|--------|------|-----|
| `/home/sales-crm` | `711` | nginx can traverse home |
| `/home/sales-crm/crm.origami.dev` | `711` | Traverse |
| `releases/` | `755` | nginx can enter release dirs |
| `current/` → release files | `a+rX` | nginx can read HTML/JS/CSS |
| `repo`, `shared`, `logs`, `tmp` | `750` | Private |
| `shared/.env` | `640` | Secrets (build only) |

```bash
chmod 711 /home/sales-crm
chmod 711 /home/sales-crm/crm.origami.dev
chmod 755 /home/sales-crm/crm.origami.dev/releases
chmod 750 /home/sales-crm/crm.origami.dev/{repo,shared,logs,tmp}
chmod 640 /home/sales-crm/crm.origami.dev/shared/.env 2>/dev/null || true
chown -R sales-crm:sales-crm /home/sales-crm/crm.origami.dev
```

---

## 10. Environment reference

| Variable | Default | Notes |
|----------|---------|--------|
| `NEXT_PUBLIC_API_URL` | `https://salescrm-api.duckdns.org/api/v1` | API base (build-time) |
| `NEXT_PUBLIC_CLOUDTALK_ENABLED` | unset | Set `false` to disable CloudTalk |
| `NEXT_PUBLIC_CLOUDTALK_PARTNER` | `sale-crm` | CloudTalk iframe partner id |

---

## 11. Rollback

```bash
APP=/home/sales-crm/crm.origami.dev
ls -1dt $APP/releases/*/
ln -sfn $APP/releases/YYYYMMDD_HHMMSS $APP/current
# no app restart — flip symlink is enough
```

---

## 12. Health check

```bash
curl -I https://crm.origami.dev
curl -I https://crm.origami.dev/login/
ls -la ~/crm.origami.dev/current/index.html
```

---

## Notes

- **No PM2 / no Node systemd unit** — production is static HTML/JS/CSS only.
- API traffic goes from the browser to `NEXT_PUBLIC_API_URL` (CORS must allow `https://crm.origami.dev`).
- Deploys are atomic: build → new `releases/…` → flip `current`.
