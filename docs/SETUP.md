# Setup & Installation

## Prerequisites
- Python 3.12+
- Node.js 18+ (with npm)

## Backend (Django)

```bash
cd backend
python -m venv .venv

# Activate the virtual environment
#   Windows :  .venv\Scripts\activate
#   macOS/Linux: source .venv/bin/activate

pip install -r requirements.txt

# Environment configuration (secrets live in .env, never committed)
cp .env.example .env
# Generate a strong secret and paste it into .env:
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Apply migrations (preserves existing database)
python manage.py migrate

# (Optional) Create an admin account
python manage.py shell -c "from django.contrib.auth import get_user_model; U=get_user_model(); U.objects.create_superuser('admin','admin@example.com','admin123',role='ADMIN') if not U.objects.filter(username='admin').exists() else None"

# Run the API server
python manage.py runserver
# API base: http://127.0.0.1:8000/api/
```

> The repository-root `manage.py` is a thin shim that delegates to `backend/manage.py`,
> so `python manage.py <command>` also works from the project root.

## Frontend (React + Vite)

```bash
cd frontend
npm install

# Optional: configure the API base URL (defaults to /api)
cp .env.example .env

npm run dev      # http://127.0.0.1:5173
npm run build    # production build into frontend/dist
```

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | dev placeholder |
| `DEBUG` | Debug mode (`True`/`False`) | `True` |
| `ALLOWED_HOSTS` | Comma/whitespace separated hosts | `*` |
| `CORS_ALLOW_ALL_ORIGINS` | Allow all CORS origins | `True` |

### Frontend (`frontend/.env`)
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Base URL used by the API client | `/api` |

See `.env.example` in each directory for templates. Never commit real `.env` files.
