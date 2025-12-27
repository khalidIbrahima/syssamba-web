# PowerShell script to run Next.js with increased memory
Write-Host "Starting Samba One with increased memory (4GB)..." -ForegroundColor Green

# Set Node.js memory limit
$env:NODE_OPTIONS = "--max-old-space-size=4096"

# Run Next.js development server
npm run dev:simple
