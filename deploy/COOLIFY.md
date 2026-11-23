# Healthy Fruit Game production

GitHub Actions tests the backend and browser game, builds the Docker image, and
publishes `ghcr.io/dehghangit/healthyfruit-game:main` and a `sha-<commit>` tag.
Coolify deploys the prebuilt image only after the workflow succeeds.

## Dedicated resource

- Project: Healthy Fruit Game (`ei9zsedixblujgnx1p8qsmsv`)
- Application: healthyfruit-game (`cfwbghtpmpzwfiog05e2uulz`)
- URL: https://fruit.xoobin.ir
- Internal port: 8080. Do not publish this port directly on the host.
- Health check: GET `/healthz`, port 8080, expected status 200.
- Dedicated volume: `cfwbghtpmpzwfiog05e2uulz-healthyfruit-sqlite` at `/data`.
- One instance with a consistent container name to avoid overlapping instances.
- Initial limits: 256 MiB RAM and 0.5 CPU. Adjust based on actual usage.

The application starts with an empty SQLite database on its first deployment.
The local database is excluded from the image and is never imported automatically.
Existing server applications, storage, and proxy settings must not be modified.

## Runtime environment

Set `ADMIN_PASSWORD` to a long random secret and `ADMIN_USER=admin`.
Set `APP_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`,
`DB_PATH=/data/health_battle.db`, `COOKIE_SECURE=1`, `TRUST_PROXY=1`,
and `WEB_THREADS=8`. Proxy trust is appropriate only with the internal port
accessible through the trusted reverse proxy.

## GitHub Actions secrets

Set `COOLIFY_WEBHOOK` to the authenticated deployment URL for this application's
UUID, and `COOLIFY_TOKEN` to an application-scoped deployment token. Secrets must
never be committed. The initial setup token should be replaced with a restricted
deployment token after provisioning.

The GHCR package must be public, or Coolify's configured deployment user must have
registry credentials with permission to pull this specific package.

## Backups and restore

A persistent volume is not a backup. Use Python's `sqlite3.Connection.backup()`
inside the running container to create a consistent snapshot; do not copy only
the live `.db` file while WAL writes are active. Copy snapshots to separate
storage and verify restore before relying on backups. A backup destination and
retention policy are still required to automate off-server backups.

For example, inside this application's container only:

```sh
python -c "import sqlite3; source=sqlite3.connect('/data/health_battle.db'); target=sqlite3.connect('/data/backup.db'); source.backup(target); target.close(); source.close()"
```

Copy that snapshot off the server. To restore, stop only this game, preserve its
current database and WAL files, restore the snapshot into its dedicated volume
with UID/GID 10001 ownership, and start the game. Never delete or replace shared
server volumes.

## Release verification and rollback

Check the Actions run, Coolify deployment log, `/healthz`, player registration,
score submission, and administrator login. Redeploy this application and verify
that the player data persists. To roll back code, select its previous `sha-<commit>`
image tag in Coolify. Image rollback does not restore database contents; review
schema compatibility and take a snapshot before future schema changes.
