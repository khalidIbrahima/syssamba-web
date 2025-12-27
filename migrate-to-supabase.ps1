# Script PowerShell pour migrer Clerk vers Supabase
# Remplace les imports et appels Clerk par Supabase

$files = Get-ChildItem -Path "src\app\api" -Recurse -Filter "*.ts" | Where-Object { $_.FullName -notlike "*node_modules*" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Remplacer les imports
    $content = $content -replace "import \{ auth \} from '@clerk/nextjs/server';", ""
    $content = $content -replace "import \{ getCurrentUser, getCurrentOrganization \} from '@/lib/clerk';", "import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';"
    $content = $content -replace "import \{ getCurrentUser \} from '@/lib/clerk';", "import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';"
    $content = $content -replace "import \{ getCurrentOrganization \} from '@/lib/clerk';", "import { getCurrentOrganization } from '@/lib/auth-helpers';"
    
    # Ajouter l'import checkAuth si nécessaire
    if ($content -match "checkAuth" -and $content -notmatch "from '@/lib/auth-helpers'") {
        $content = $content -replace "(import.*from.*['""];)", "`$1`nimport { checkAuth } from '@/lib/auth-helpers';"
    }
    
    # Remplacer les appels auth()
    $content = $content -replace "const \{ userId \} = await auth\(\);", "const { userId } = await checkAuth();"
    
    # Nettoyer les lignes vides multiples
    $content = $content -replace "(`r?`n){3,}", "`r`n`r`n"
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
    Write-Host "Updated: $($file.FullName)"
}

Write-Host "Migration complete!"

