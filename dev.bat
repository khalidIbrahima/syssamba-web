@echo off
REM Windows batch file to run Next.js with increased memory
echo Starting Samba One with increased memory (4GB)...
set NODE_OPTIONS=--max-old-space-size=4096
npm run dev:simple
pause
