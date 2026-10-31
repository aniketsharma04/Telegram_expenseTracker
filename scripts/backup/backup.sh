#!/usr/bin/env bash
# Database backup: dump the app's data (the public schema), prove the dump
# restores into a fresh Postgres with the same row counts, then encrypt it.
# Runs nightly from .github/workflows/backup.yml; see scripts/backup/README.md.
#
# Env:
#   SUPABASE_DB_URL    session-pooler connection string (with password), or
#   LINKED=1           use the Supabase CLI's linked project instead (local runs)
#   BACKUP_PASSPHRASE  encrypts the backup (AES-256); keep it in a password manager
#   OUT_DIR            where the encrypted file goes (default: backup-out)
#   SUPABASE_BIN       Supabase CLI command (default: supabase)
set -euo pipefail

OUT_DIR="${OUT_DIR:-backup-out}"
SUPABASE_BIN="${SUPABASE_BIN:-supabase}"
# Same Postgres build as the hosted database, so the test restore is faithful.
PG_IMAGE="${PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.155}"
VERIFY=aaj-backup-verify
STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  target=(--db-url "$SUPABASE_DB_URL")
elif [ "${LINKED:-}" = 1 ]; then
  target=(--linked)
else
  echo "Set SUPABASE_DB_URL (or LINKED=1 for the linked project)" >&2
  exit 1
fi

# Relative work dir: Git Bash on Windows rewrites absolute /tmp paths.
mkdir -p "$OUT_DIR"
WORK="$OUT_DIR/.work"
rm -rf "${WORK:?}"
mkdir -p "$WORK"
cleanup() {
  docker rm -f "$VERIFY" >/dev/null 2>&1 || true
  rm -rf "${WORK:?}"
}
trap cleanup EXIT

echo "1/4 Dumping schema and data"
$SUPABASE_BIN db dump "${target[@]}" -s public -f "$WORK/schema.sql"
$SUPABASE_BIN db dump "${target[@]}" -s public --data-only --use-copy -f "$WORK/data.sql"

# Rows per table, counted from the COPY blocks in the dump.
awk '
  /^COPY "public"\."[^"]+"/ { match($0, /"public"\."[^"]+"/); t = substr($0, RSTART + 10, RLENGTH - 11); n = 0; inside = 1; next }
  inside && /^\\\.$/ { print t, n; inside = 0; next }
  inside { n++ }
' "$WORK/data.sql" | sort > "$WORK/counts.txt"
tables=$(wc -l < "$WORK/counts.txt")
if [ "$tables" -eq 0 ]; then
  echo "The dump has no tables; refusing to save it" >&2
  exit 1
fi

echo "2/4 Restoring into a fresh Postgres to prove the dump works"
docker rm -f "$VERIFY" >/dev/null 2>&1 || true
docker run -d --name "$VERIFY" -e POSTGRES_PASSWORD=verify "$PG_IMAGE" >/dev/null
psql_verify() { docker exec -i "$VERIFY" psql -U postgres -h localhost -v ON_ERROR_STOP=1 -qtA "$@"; }
# The image restarts once after its init scripts; wait until the roles exist and it stays up.
for _ in $(seq 1 90); do
  if [ "$(psql_verify -c "select count(*) from pg_roles where rolname = 'authenticator'" 2>/dev/null)" = 1 ]; then
    sleep 3
    psql_verify -c "select 1" >/dev/null 2>&1 && break
  fi
  sleep 2
done
{
  cat "$WORK/schema.sql"
  echo "SET session_replication_role = replica;"
  cat "$WORK/data.sql"
} | psql_verify --single-transaction >/dev/null

mismatch=0
while read -r table expected; do
  got=$(psql_verify -c "select count(*) from public.\"$table\"")
  if [ "$got" != "$expected" ]; then
    echo "  $table: dump has $expected rows, restore has $got" >&2
    mismatch=1
  fi
done < "$WORK/counts.txt"
if [ "$mismatch" -ne 0 ]; then
  echo "Restore check failed" >&2
  exit 1
fi
rows=$(awk '{ s += $2 } END { print s }' "$WORK/counts.txt")
echo "  restored $tables tables, $rows rows, all counts match"

echo "3/4 Encrypting"
FILE="$OUT_DIR/aaj-db-$STAMP.tar.gz.gpg"
tar -C "$WORK" -czf - schema.sql data.sql counts.txt |
  gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 \
    --passphrase-fd 3 -o "$FILE" 3<<<"$BACKUP_PASSPHRASE"

echo "4/4 Checking the encrypted file opens"
gpg --batch --quiet --pinentry-mode loopback --decrypt --passphrase-fd 3 "$FILE" 3<<<"$BACKUP_PASSPHRASE" |
  tar -tzf - | sort | tr '\n' ' '
echo
echo "Saved $FILE ($(du -h "$FILE" | cut -f1))"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Database backup $STAMP"
    echo "Restored into a fresh Postgres: $tables tables, $rows rows, all counts match."
    echo
    echo "| Table | Rows |"
    echo "|---|---|"
    awk '{ print "| " $1 " | " $2 " |" }' "$WORK/counts.txt"
  } >> "$GITHUB_STEP_SUMMARY"
fi
