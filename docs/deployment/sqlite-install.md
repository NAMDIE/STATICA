# SQLite deployment (default)

**SQLite is the default database engine for self-hosting Page Builder CMS.** It's a first-class adapter alongside Postgres — same code, same migrations, same image — selected by `DATABASE_URL`. For most users this is the right choice: one container, file-based backups, near-zero ops surface.

If you have a multi-author editorial team or need to run more than one app container, see [the deployment overview](README.md#advanced-postgres) for when to upgrade to Postgres instead.

## Quickstart — production install, one command, no `.env`

```sh
docker compose -f compose.prod.yml -f compose.sqlite.yml up -d
```

That's the full install. **No `.env` file required.** SQLite mode disables the Postgres service entirely (`compose.sqlite.yml` puts it in the `_disabled` profile), and every other variable in `compose.prod.yml` has a working default. Copy `.env.production.example` only if you want to customize `HOST_PORT`, the image tag (`PAGE_BUILDER_IMAGE`), or set `DOMAIN` for TLS.

Until the public Docker image is published, build the image from source instead:

```sh
docker compose -f compose.prod.yml -f compose.sqlite.yml -f compose.build.yml up -d --build
```

What you get:

- One `app` container with the CMS, admin, public site, and uploads handler.
- A named Docker volume mounted at `/app/data` containing `cms.db`.
- A second named volume at `/app/uploads` for uploaded media.
- Migrations run automatically on first boot.

Open `http://server-ip:3001/admin` and create the first admin account.

To put HTTPS in front (auto-provisioned Let's Encrypt cert), layer `compose.tls.yml` on top — see [tls-caddy.md](tls-caddy.md):

```sh
docker compose -f compose.prod.yml -f compose.sqlite.yml -f compose.tls.yml up -d
```

## Local development

```sh
bun install
bun run dev
# Editor at http://localhost:5173, CMS at http://localhost:3001, SQLite at .tmp/dev.db
```

No Docker, no postgres, no setup. The migrations run automatically on first boot. This is the same SQLite engine the production image uses.

## No-Docker production install

If you'd rather run Bun directly on the host (no container around it):

```sh
bun install
bun run build
DATABASE_URL=sqlite:./data/cms.db \
  STATIC_DIR=./dist \
  UPLOADS_DIR=./uploads \
  bun run server/index.ts
```

Wrap that in your process manager of choice (systemd, pm2, supervisord). Put any HTTPS-capable reverse proxy in front (Caddy, Nginx, Cloudflare).

## Backup & durability

### Quick backup — copy the file

```sh
docker compose exec app sh -c 'cp /app/data/cms.db /app/data/cms.db.bak'
docker cp $(docker compose ps -q app):/app/data/cms.db.bak ./cms.db.bak
```

For occasional snapshots that's enough. For continuous off-site replication, use Litestream.

### Continuous replication with Litestream

[Litestream](https://litestream.io) replicates SQLite databases to S3, Backblaze, GCS, etc. in real time, with second-level RPO. Recommended for any production SQLite deployment that matters:

```yaml
# Add to compose.sqlite.yml or a separate compose file layered on top:
  litestream:
    image: litestream/litestream
    command: replicate
    volumes:
      - data:/app/data:ro
      - ./litestream.yml:/etc/litestream.yml
    depends_on:
      - app
```

See [backup-restore.md](backup-restore.md) for the full Litestream config and restore drill.

## Single-writer trade-off

SQLite supports one concurrent writer at a time. For the CMS workload this is fine in the common case:

- Public visitor traffic hits generated static HTML — it never touches the database.
- Admin writes (saving a page, uploading media, installing a plugin) are infrequent and short.
- WAL mode (enabled by the SQLite adapter) means readers don't block writers.

The constraint only bites when **multiple humans save in the admin at the same time** — for example, a 5-person editorial team all hitting "Publish" within the same second. In practice that's rare; if it's your situation, [upgrade to Postgres](#when-to-upgrade-to-postgres).

## When to upgrade to Postgres

| Signal | Action |
|---|---|
| One or two admins, infrequent saves | Stay on SQLite |
| Several admins, occasional simultaneous saves | Stay on SQLite (WAL handles it) |
| Editorial team with constant simultaneous saves | Upgrade to Postgres |
| You need to run more than one app container | Upgrade to Postgres (SQLite is file-locked) |
| You already operate Postgres and prefer to use it | Upgrade to Postgres |
| You want `pg_dump` / streaming replication instead of file copy / Litestream | Upgrade to Postgres |

To upgrade, follow [vps-compose.md](vps-compose.md) and migrate your data:

1. Stop the SQLite stack: `docker compose -f compose.prod.yml -f compose.sqlite.yml down`
2. Export from SQLite with `sqlite3 cms.db .dump > dump.sql` or a custom tool.
3. Stand up Postgres, run migrations against it (the CMS does this on first boot of `compose.prod.yml`).
4. Import the data into Postgres via `psql`.
5. Set `DATABASE_URL=postgres://...` (the default in `compose.prod.yml`) and restart.

The migrations are dialect-translated but otherwise identical, so the schema shape matches. Field-by-field data import is the part you have to write yourself — there's no built-in migration tool yet (PRs welcome).

## Comparison reference

For the full SQLite vs Postgres trade-off matrix see [the deployment overview](README.md#per-mode-trade-offs).
