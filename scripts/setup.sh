#!/usr/bin/env bash
# Quick setup script (macOS / Linux)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Backend =="
cd "$ROOT/backend"
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
[ -f .env ] || cp .env.example .env
python manage.py migrate

echo "== Frontend =="
cd "$ROOT/frontend"
npm install

echo ""
echo "Setup complete."
echo "Run backend : cd backend && python manage.py runserver"
echo "Run frontend: cd frontend && npm run dev"
