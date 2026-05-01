# VPS Deployment With Docker Compose

This is the easiest full self-host path. It runs the CMS app, Postgres, and uploaded media storage on one server.

## 1. Prepare The Server

Install Docker Engine and Docker Compose on the VPS. Point your domain to the server if you plan to put a reverse proxy in front of the app.

## 2. Create Production Environment

From the repository root:

```sh
cp .env.production.example .env
```

Edit `.env` and replace:

```txt
POSTGRES_PASSWORD=replace-with-a-long-random-hex-password
SESSION_SECRET=replace-with-a-long-random-hex-secret
```

Generate safe values with:

```sh
openssl rand -hex 24
openssl rand -hex 32
```

## 3. Start The Stack

```sh
docker compose -f compose.prod.yml up -d --build
```

Check status:

```sh
docker compose -f compose.prod.yml ps
curl http://localhost:3001/health
```

Open:

```txt
http://server-ip:3001/admin
```

Create the first admin account in the browser.

## 4. View Logs

```sh
docker compose -f compose.prod.yml logs -f app
docker compose -f compose.prod.yml logs -f postgres
```

## 5. Update

After pulling new code or changing the image:

```sh
docker compose -f compose.prod.yml up -d --build
```

If you later use a published registry image instead of building locally:

```sh
docker compose -f compose.prod.yml pull
docker compose -f compose.prod.yml up -d
```

## Data Safety

`docker compose -f compose.prod.yml down` stops containers and keeps named volumes.

`docker compose -f compose.prod.yml down -v` deletes the Postgres database and uploaded media volumes. Use it only when you intentionally want to wipe the CMS.
