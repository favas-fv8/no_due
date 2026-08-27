# Windows quick setup script
$ErrorActionPreference = 'Stop'
$ROOT = Resolve-Path (Join-Path $PSScriptRoot '..')

Write-Host '== Backend =='
Set-Location "$ROOT\backend"
python -m venv .venv
& '.\.venv\Scripts\Activate.ps1'
pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
python manage.py migrate

Write-Host '== Frontend =='
Set-Location "$ROOT\frontend"
npm install

Write-Host ''
Write-Host 'Setup complete.'
Write-Host 'Run backend : cd backend ; python manage.py runserver'
Write-Host 'Run frontend: cd frontend ; npm run dev'
