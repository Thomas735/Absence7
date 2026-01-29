@echo off
echo 🚀 Demarrage de Absence7...
echo Le navigateur va s'ouvrir dans quelques instants...

REM Change directory to the script's location
cd /d "%~dp0"

REM Open browser
start http://localhost:3000

REM Start server
npm run dev
pause
