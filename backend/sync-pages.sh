#!/usr/bin/env bash
# ============================================================
# KätheKiste – GitHub-Page-Sync
# Kopiert die App-Dateien (ohne .env!) in das Page-Repo und pusht.
# Nutzung:  ./sync-pages.sh "kurze Commit-Beschreibung"
# ============================================================
set -euo pipefail

SRC="/home/jonathan/scratch_opencode/kkg-fundsachen"
DST="/tmp/opencode/kaethekiste-repo"
MSG="${1:-Update}"

rsync -a --delete \
  --exclude ".git" \
  --exclude ".env" \
  "$SRC/" "$DST/"

cd "$DST"
git add -A
if git diff --cached --quiet; then
  echo "Keine Änderungen – nichts zu sychronisieren."
  exit 0
fi
git -c user.name="Klabundo" -c user.email="Klabundo@users.noreply.github.com" commit -m "$MSG"
git push
echo ""
echo "Gesynct und geladen (bitte 1–2 Min. abwarten, GitHub baut aus):"
echo "https://klabundo.github.io/kaethekiste/"
