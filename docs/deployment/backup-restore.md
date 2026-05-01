# Backup And Restore

Backups must include both the Postgres database and uploaded files.

## Compose Backup

Create a local backup directory:

```sh
mkdir -p backups
```

Load environment values from `.env`:

```sh
set -a
. ./.env
set +a
```

Dump Postgres:

```sh
docker compose -f compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  > "backups/page-builder-$(date +%F).sql"
```

Archive uploads:

```sh
docker run --rm \
  -v page-builder-cms-prod_uploads:/uploads:ro \
  -v "$PWD/backups:/backup" \
  alpine \
  tar czf "/backup/page-builder-uploads-$(date +%F).tgz" -C /uploads .
```

If your Compose project name is not `page-builder`, find the actual uploads volume:

```sh
docker volume ls | grep uploads
```

## Compose Restore

Start Postgres before restoring:

```sh
docker compose -f compose.prod.yml up -d postgres
```

Restore the database:

```sh
set -a
. ./.env
set +a

cat backups/page-builder-YYYY-MM-DD.sql | docker compose -f compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Restore uploads:

```sh
docker run --rm \
  -v page-builder-cms-prod_uploads:/uploads \
  -v "$PWD/backups:/backup" \
  alpine \
  sh -lc "rm -rf /uploads/* && tar xzf /backup/page-builder-uploads-YYYY-MM-DD.tgz -C /uploads"
```

Then start the full stack:

```sh
docker compose -f compose.prod.yml up -d
```

## Managed Host Backups

Use the provider's Postgres backup tools for the database.

For uploads, back up the provider disk or volume mounted at `UPLOADS_DIR`. If the provider does not offer persistent upload storage, use that host only after S3-compatible media storage is implemented.
