# Health Check Script
# Verifica el estado del proyecto localmente y en el VPS
# Uso: .\scripts\health-check.ps1 [-Remote] [-Verbose]

param(
    [switch]$Remote,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$exitCode = 0
$results = @()

function Write-Check {
    param([string]$Name, [bool]$Passed, [string]$Detail = "")
    $status = if ($Passed) { "PASS" } else { "FAIL" }
    $icon = if ($Passed) { "[OK]" } else { "[!!]" }
    $color = if ($Passed) { "Green" } else { "Red" }
    Write-Host "$icon $status - $Name" -ForegroundColor $color
    if ($Detail -and $Verbose) { Write-Host "      $Detail" -ForegroundColor Gray }
    $script:results += @{ Name = $Name; Status = $status; Detail = $Detail }
    if (-not $Passed) { $script:exitCode = 1 }
}

Write-Host ""
Write-Host "=== HEALTH CHECK ===" -ForegroundColor Cyan
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# --- LOCAL CHECKS ---
Write-Host "--- Verificaciones Locales ---" -ForegroundColor Yellow

# 1. Node.js
$nodeVersion = node --version 2>$null
$nodeOk = $LASTEXITCODE -eq 0
Write-Check "Node.js instalado" $nodeOk $(if ($nodeOk) { $nodeVersion } else { "No encontrado" })

# 2. npm
$npmVersion = npm --version 2>$null
$npmOk = $LASTEXITCODE -eq 0
Write-Check "npm instalado" $npmOk $(if ($npmOk) { "v$npmVersion" } else { "No encontrado" })

# 3. node_modules
$nmExists = Test-Path "node_modules"
Write-Check "node_modules existe" $nmExists $(if (-not $nmExists) { "Ejecutar: npm install" } else { "" })

# 4. .env
$envExists = Test-Path ".env"
Write-Check ".env existe" $envExists $(if (-not $envExists) { "Copiar .env.example a .env" } else { "" })

# 5. Variables de entorno requeridas
if ($envExists) {
    $envContent = Get-Content ".env" -Raw
    $requiredVars = @("DB_HOST", "DB_PORT", "DB_USER", "DB_PASS", "DB_NAME", "JWT_SECRET", "WEBHOOK_SECRET", "N8N_WEBHOOK_URL")
    foreach ($var in $requiredVars) {
        $pattern = "^$var=.+"
        $varOk = $envContent -match "(?m)$pattern"
        Write-Check "Variable .env: $var" $varOk $(if (-not $varOk) { "Falta en .env" } else { "Configurada" })
    }
}

# 6. .gitignore contiene .env
if (Test-Path ".gitignore") {
    $gitignore = Get-Content ".gitignore" -Raw
    $envIgnored = $gitignore -match "\.env"
    Write-Check ".env en .gitignore" $envIgnored $(if (-not $envIgnored) { "AGREGAR .env a .gitignore" } else { "" })
} else {
    Write-Check ".gitignore existe" $false "Archivo no encontrado"
}

# 7. SSH Tunnel (PostgreSQL local)
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("127.0.0.1", 5432)
    $tcpClient.Close()
    Write-Check "SSH tunnel (PostgreSQL en 127.0.0.1:5432)" $true "Activo"
} catch {
    Write-Check "SSH tunnel (PostgreSQL en 127.0.0.1:5432)" $false "Inactivo - Ejecutar: ssh -L 5432:localhost:5432 root@165.245.148.89"
}

# 8. Puerto 3001 disponible
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("127.0.0.1", 3001)
    $tcpClient.Close()
    Write-Check "Puerto 3001 (Backend)" $true "En uso (backend corriendo)"
} catch {
    Write-Check "Puerto 3001 (Backend)" $true "Disponible"
}

# 9. Build
if ($nmExists) {
    Write-Host "  Ejecutando npm run build..." -ForegroundColor Gray
    $buildOutput = npm run build 2>&1
    $buildOk = $LASTEXITCODE -eq 0
    Write-Check "npm run build" $buildOk $(if (-not $buildOk) { "Errores de compilacion" } else { "Compilacion exitosa" })
    if (-not $buildOk -and $Verbose) {
        $buildOutput | Select-Object -Last 10 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkRed }
    }
}

# 10. Tests (si existen)
if (Test-Path "jest.config.*") {
    $testOutput = npm test 2>&1
    $testOk = $LASTEXITCODE -eq 0
    Write-Check "npm test" $testOk $(if (-not $testOk) { "Tests fallaron" } else { "Tests pasaron" })
} else {
    Write-Check "Jest configurado" $false "Sin jest.config - Tests no configurados"
}

# --- REMOTE CHECKS ---
if ($Remote) {
    Write-Host ""
    Write-Host "--- Verificaciones VPS (165.245.148.89) ---" -ForegroundColor Yellow

    $vpsHost = "root@165.245.148.89"

    # Docker containers
    $dockerOutput = ssh $vpsHost "docker ps --format '{{.Names}}: {{.Status}}'" 2>$null
    $dockerOk = $LASTEXITCODE -eq 0
    Write-Check "SSH conexion al VPS" $dockerOk $(if (-not $dockerOk) { "Verificar SSH key" } else { "Conectado" })

    if ($dockerOk) {
        # PostgreSQL
        $pgOutput = ssh $vpsHost "docker exec postgres pg_isready" 2>$null
        $pgOk = $LASTEXITCODE -eq 0
        Write-Check "PostgreSQL" $pgOk $(if ($pgOk) { "Aceptando conexiones" } else { "No responde" })

        # n8n
        $n8nOutput = ssh $vpsHost "curl -s -o /dev/null -w '%{http_code}' http://localhost:5678/healthz" 2>$null
        $n8nOk = $n8nOutput -match "200"
        Write-Check "n8n" $n8nOk $(if ($n8nOk) { "HTTP 200" } else { "No responde" })

        # Backend
        $beOutput = ssh $vpsHost "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api" 2>$null
        $beOk = $beOutput -match "200|404"
        Write-Check "Backend" $beOk $(if ($beOk) { "HTTP $beOutput" } else { "No responde" })

        # Disk space
        $diskOutput = ssh $vpsHost "df -h / | tail -1 | awk '{print `$(5)}'" 2>$null
        Write-Check "Espacio en disco" ($diskOutput -notmatch "9[0-9]%|100%") "Uso: $diskOutput"

        # Docker containers detail
        Write-Host ""
        Write-Host "  Containers:" -ForegroundColor Gray
        ssh $vpsHost "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" 2>$null
    }
}

# --- SUMMARY ---
Write-Host ""
Write-Host "=== RESUMEN ===" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
Write-Host "Pasaron: $passed | Fallaron: $failed | Total: $($results.Count)"

if ($exitCode -eq 0) {
    Write-Host ""
    Write-Host "Todos los checks pasaron. Listo para trabajar." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Hay checks que fallaron. Arreglar antes de continuar." -ForegroundColor Red
    Write-Host "Revisar progress/errors.md para detalles." -ForegroundColor Yellow

    # Write errors to progress/errors.md
    $errorLog = "`n## Health Check - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
    $errorLog += "| Check | Estado |`n|-------|--------|`n"
    foreach ($r in $results) {
        if ($r.Status -eq "FAIL") {
            $errorLog += "| $($r.Name) | FAIL - $($r.Detail) |`n"
        }
    }
    $errorLog += "`n"

    if (-not (Test-Path "progress")) { New-Item -ItemType Directory -Path "progress" -Force | Out-Null }
    Add-Content -Path "progress/errors.md" -Value $errorLog -Encoding UTF8
}

Write-Host ""
exit $exitCode
