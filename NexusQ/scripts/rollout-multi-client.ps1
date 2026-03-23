param(
  [switch]$SkipDbPush,
  [switch]$SkipFunctionDeploy
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$migrationPath = Join-Path $repoRoot "supabase\migrations\20260320170000_multi_client_tenant_hardening.sql"
$projectRefPath = Join-Path $repoRoot "supabase\.temp\project-ref"
$npxCache = Join-Path $repoRoot "supabase\.temp\npx-cache"

function Invoke-SupabaseCli {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  if (Get-Command supabase -ErrorAction SilentlyContinue) {
    & supabase @Arguments
    return
  }

  New-Item -ItemType Directory -Force -Path $npxCache | Out-Null
  $previousCache = $env:npm_config_cache
  try {
    $env:npm_config_cache = $npxCache
    & npx --yes supabase @Arguments
  } finally {
    if ($null -eq $previousCache) {
      Remove-Item Env:npm_config_cache -ErrorAction SilentlyContinue
    } else {
      $env:npm_config_cache = $previousCache
    }
  }
}

if (-not (Test-Path $migrationPath)) {
  throw "Expected migration file not found: $migrationPath"
}

if (-not (Test-Path $projectRefPath)) {
  throw "Supabase project is not linked. Missing: $projectRefPath"
}

$projectRef = (Get-Content $projectRefPath -Raw).Trim()
Write-Host "Starting NexusQ multi-client rollout for Supabase project $projectRef" -ForegroundColor Cyan

if (-not $SkipDbPush) {
  Write-Host "Pushing database migrations..." -ForegroundColor Yellow
  Invoke-SupabaseCli -Arguments @("db", "push")
}

if (-not $SkipFunctionDeploy) {
  Write-Host "Deploying edge functions..." -ForegroundColor Yellow
  Invoke-SupabaseCli -Arguments @("functions", "deploy", "workflow-a-proxy")
  Invoke-SupabaseCli -Arguments @("functions", "deploy", "workflow-e-proxy")
}

Write-Host ""
Write-Host "Multi-client rollout commands completed." -ForegroundColor Green
Write-Host "Still required outside this script:" -ForegroundColor Cyan
Write-Host "  1. Import the updated n8n workflow JSONs A-E."
Write-Host "  2. Ensure each client has a unique client_key."
Write-Host "  3. Configure a unique clients.phone value before enabling multi-client messaging/replies."
