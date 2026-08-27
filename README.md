# No-Due Portal — React + Django + SQLite

Clean modular architecture with role-based auth, 11-section sequential workflow, file uploads, and audit history.

## Stack
- **Backend**: Django 6 + Django REST Framework + SimpleJWT + SQLite3 + Pillow
- **Frontend**: React (Vite) + react-router-dom + axios
- **DB**: SQLite (`db.sqlite3`), media in `media/uploads/`

## Roles
- `ADMIN` | `STUDENT` | `VERIFIER` | `STAFF_ADVISOR` | `HOD` | `PRINCIPAL`
- JWT auth (access 12h, refresh 7d). Passwords hashed via Django.

## Environment & Secrets
All secrets and environment-specific values are externalized to `.env` files (git-ignored).
- `backend/.env` — Django `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOW_ALL_ORIGINS` (template: `backend/.env.example`).
- `frontend/.env` — `VITE_API_BASE_URL` (template: `frontend/.env.example`).

Python dependencies are managed inside `backend/.venv`. See [`docs/SETUP.md`](docs/SETUP.md) for full instructions
and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the project layout.

## Project Structure (reorganized, functions unchanged)
```
no_due/
├── backend/               # Django + SQLite
│   ├── config/            # settings, urls, wsgi
│   ├── accounts/          # User, profiles, auth, admin APIs
│   ├── submissions/       # 11-section workflow, uploads, audit
│   ├── verification/      # inbox + approve/reject
│   ├── manage.py
│   ├── db.sqlite3
│   ├── media/uploads/     # uploaded files
│   └── requirements.txt
├── frontend/              # React (Vite)
├── manage.py              # shim → backend/manage.py
└── requirements.txt       # shim → backend/requirements.txt
```

## Setup

### Backend
```bash
cd backend
python -m venv .venv
# Windows :  .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt   # Django, djangorestframework, django-cors-headers, Pillow, djangorestframework-simplejwt, python-decouple
cp .env.example .env             # then set a strong SECRET_KEY in .env
python manage.py migrate
python manage.py shell -c "from django.contrib.auth import get_user_model; User=get_user_model(); User.objects.create_superuser('admin','admin@example.com','admin123',role='ADMIN') if not User.objects.filter(username='admin').exists() else print('exists')"
python manage.py runserver
# http://127.0.0.1:8000/api/
# Admin seeded: admin / admin123
# Also works from root: python manage.py runserver (shim)
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://127.0.0.1:5173  (proxies /api + /media to Django)
npm run build # production
```

## Database Models
- **accounts.User** (AbstractUser) + `role`
- **StudentProfile**, **VerifierProfile**, **StaffAdvisorProfile**, **HODProfile**, **PrincipalProfile**
- **VerificationType** (manageable by admin)
- **submissions.Submission** (OneToOne Student), **SectionStatus** (11 rows per student), **UploadedFile**, **VerificationRequest**, **AuditLog**

## Verification Workflow (11 sections)
1 Office (PDF) → file → verifier `Office`
2 Placement (image) → `Placement`
3 PTA (image) → `PTA`
4 Bus (image) → `Bus Maintenance`
5 Lab (request) → `Lab` verifier
6 Hostel (≤5 images, hosteller only, `NOT_REQUIRED` for day scholars)
7 Library (request) → `Library`
8 Staff Advisor (request, auto-matched by dept/div/sem) — enabled after 1-7 approved
9 HOD (request, auto-matched by dept) — after 1-8 approved
10 Principal (request → Principal) — after 1-9 approved
11 Final Status = APPROVED only if all required sections APPROVED

Sequential enforcement in `submissions/utils.py:can_send_request`. `find_assignee()` auto-routes requests.

## REST API
- `POST /api/auth/login/` `{username,password}` → `{access,refresh,user,profile_complete}`
- `POST /api/auth/refresh/` `{refresh}`
- `GET  /api/auth/me/` (auth)
- `GET/POST/PUT /api/profile/` (auth) — role-specific fields, validates completeness
- `GET  /api/submissions/my/` (student)
- `POST /api/submissions/upload/<SECTION>/` (file, validates PDF vs image, 10MB, hostel ≤5)
- `POST /api/submissions/request/<SECTION>/` (sequential check + auto-assign)
- `GET  /api/submissions/audit/` + `GET /api/submissions/admin/list/` + `/<id>/` (admin)
- `GET  /api/verification/inbox/?status=PENDING` (verifier-scoped)
- `GET  /api/verification/request/<id>/` + `POST /api/verification/request/<id>/action/` `{action:APPROVE|REJECT, remark}`
- `GET  /api/verification/admin/all/` (admin)
- `GET/POST /api/verification-types/` + `GET /api/admin/users/` `POST /api/admin/users/` `PUT /api/admin/users/<id>/` `POST /api/admin/users/<id>/reset-password/` (admin)

Media served at `/media/<path>` in DEBUG.

## File Upload Security
- `FILE_UPLOAD_MAX_MEMORY_SIZE=10MB`, content-type + extension check, per-section rules, `media/uploads/%Y/%m/%d/`, original name + size stored.

## Frontend Routes
- `/` home, `/login`, `/profile` (forced if incomplete), `/student` (student 11 cards + progress tracker + audit), `/verifier` (inbox split pane + approve/reject), `/admin` (users/submissions/requests/verifier-types tabs). Navbar + ProtectedRoute + JWT refresh interceptor.

## Creating Users
Login as `admin` → Admin dashboard → Create User (choose role) → user logs in → completes profile → proceeds.

## Test Accounts (seeded for demo)
- `stu1` / `pass123` (Student CS/A/4 hosteller)
- `ver_off` / `pass123` (Office verifier CS)
- `ver_lab` / `pass123` (Lab A/4/CS)
- `ver_lib` / `pass123` (Library)
- `advisor1` / `pass123` (Staff Advisor CS/A/4)
- `hod_cs` / `pass123` (HOD CS)
- `principal` / `pass123` (Principal)

## Notes
- Vite proxy in `frontend/vite.config.js` — no CORS needed in dev.
- `backend/config/settings.py` has `CORS_ALLOW_ALL_ORIGINS=True` for flexibility.
- All sections show `Pending/Approved/Rejected/Not Required` with remark + timestamp + audit log.
