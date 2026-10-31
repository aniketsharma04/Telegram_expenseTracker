# Database backups

Supabase Free has no backups. `.github/workflows/backup.yml` runs
`backup.sh` every night at 02:00 IST. It:

1. dumps the `public` schema (all app data; Supabase Auth and Storage are unused);
2. restores the dump into a fresh Postgres 17 and checks every table's row count;
3. encrypts it with AES-256 (`gpg`) and keeps it as a workflow artifact for 30 days.

The job summary of each run lists the tables and row counts.

## One-time setup

Add two repository secrets (Settings → Secrets and variables → Actions):

- `SUPABASE_DB_URL`: Supabase dashboard → Connect → **Session pooler** URI, with the
  database password filled in. GitHub runners have no IPv6, so the direct connection
  string doesn't work.
- `BACKUP_PASSPHRASE`: a long random passphrase. Keep a copy in your password manager:
  without it the backups can't be opened.

Then run the workflow once by hand (Actions → Database backup → Run workflow).

## Restore

1. Download the artifact from the run (Actions → Database backup → the run → Artifacts) and unzip it.
2. Decrypt and unpack:

   ```sh
   gpg --decrypt aaj-db-<time>.tar.gz.gpg | tar -xzf -
   ```

3. Load it into an empty Supabase project (or a local `supabase/postgres` container):

   ```sh
   psql "<connection string>" -v ON_ERROR_STOP=1 --single-transaction \
     -f schema.sql -c "SET session_replication_role = replica" -f data.sql
   ```

   `session_replication_role = replica` skips foreign-key checks while loading, because
   `expenses`, `incomes` and `bank_messages` refer to each other.

4. Compare the row counts with `counts.txt`.

## Run it locally

```sh
LINKED=1 SUPABASE_BIN="npx supabase" BACKUP_PASSPHRASE=... bash scripts/backup/backup.sh
```

Needs Docker running. The file lands in `backup-out/` (git-ignored).
