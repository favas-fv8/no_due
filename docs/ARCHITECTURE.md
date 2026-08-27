# Architecture Overview

The project is organized as a monorepo with a clear split between backend (Django REST API)
and frontend (React SPA).

```
no_due/
├── backend/                 # Django project (real project root)
│   ├── .venv/              # local virtual environment (git-ignored)
│   ├── manage.py           # Django entrypoint
│   ├── requirements.txt    # Python dependencies
│   ├── .env / .env.example # environment / secrets (real .env git-ignored)
│   ├── config/             # Django project configuration
│   │   ├── settings.py     # env-driven settings (decouple)
│   │   ├── urls.py         # root API routing
│   │   ├── wsgi.py / asgi.py
│   ├── accounts/           # User model, profiles, auth, admin user APIs
│   ├── submissions/        # 11-section no-due workflow, uploads, audit log
│   ├── verification/       # verification inbox + approve/reject actions
│   ├── media/              # user uploads (git-ignored)
├── frontend/               # React (Vite) SPA
│   ├── public/             # static assets
│   ├── src/
│   │   ├── pages/          # route-level pages (dashboards, login, profile)
│   │   ├── components/     # reusable UI (Navbar, Footer, ProtectedRoute)
│   │   ├── utils/          # api client, auth context, helpers
│   │   └── assets/         # images / styles
├── images/                 # shared background images
├── docs/                   # setup & architecture docs
├── scripts/               # setup helpers
├── manage.py               # shim → backend/manage.py
├── requirements.txt        # mirrors backend/requirements.txt
└── README.md
```

## Layers

- **Configuration (`config/`)** is kept separate from application/business logic (`accounts`, `submissions`, `verification`).
- Each Django app follows the standard structure: `models.py`, `serializers.py`, `views.py`, `urls.py`, `permissions.py`, `admin.py`, `migrations/`.
- Business rules for the no-due workflow (sequential enforcement, auto assignment) live in `submissions/utils.py`.
- The frontend API client (`src/utils/api.js`) centralizes all HTTP communication and JWT refresh.

## Roles & Workflow

Six roles: `ADMIN`, `STUDENT`, `VERIFIER`, `STAFF_ADVISOR`, `HOD`, `PRINCIPAL`.
Students complete 11 sequential verification sections; verifiers/Staff Advisors/HOD/Principal
approve or reject via the verification inbox. The full flow is documented in `README.md`.

## Security

- Secrets and environment-specific values are externalized to `.env` files (never committed).
- Uploads are stored under `media/` (git-ignored) with size/type validation.
- `.venv/`, `node_modules/`, `db.sqlite3`, and build artifacts are excluded via `.gitignore`.
