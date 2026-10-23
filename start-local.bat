@echo off
rem Double-click to run Lyla's Investment Memo at http://localhost:3000
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

if not exist .env.local (
  echo.
  echo [!] .env.local not found. Copy .env.local.example to .env.local
  echo     and put your Anthropic API key in it, then run this again.
  echo.
  pause
  exit /b 1
)

rem Open the browser a few seconds after the server starts
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
call npm run dev
