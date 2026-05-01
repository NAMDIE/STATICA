# Page Builder CMS

Self-hosted CMS with an integrated visual page builder. The app serves the public website, admin editor, CMS API, published pages, and uploaded media from one Bun server backed by Postgres.

## Local Development

Install dependencies:

```sh
bun install
```

Start the local CMS stack with Postgres:

```sh
docker compose up --build
```

Open:

```txt
http://localhost:3001/admin
```

The first visit creates the site and admin account.

## Production Deployment

The production artifact is a Docker image built from `Dockerfile`.

For a VPS/self-host install with bundled Postgres:

```sh
cp .env.production.example .env
docker compose -f compose.prod.yml up -d --build
```

Then open:

```txt
http://server-ip:3001/admin
```

For managed hosts, deploy the Dockerfile and connect it to managed Postgres with `DATABASE_URL`.

Deployment docs:

- [Production Docker image](docs/deployment/docker-image.md)
- [VPS Docker Compose](docs/deployment/vps-compose.md)
- [Managed hosts](docs/deployment/managed-hosts.md)
- [Backup and restore](docs/deployment/backup-restore.md)

## Required Production Data

Back up both:

- Postgres database
- uploads directory or uploads volume

Do not run `docker compose -f compose.prod.yml down -v` unless you intentionally want to delete CMS data.

## Useful Commands

```sh
bun run build
bun test
docker build -t page-builder-cms:local .
curl http://localhost:3001/health
```
