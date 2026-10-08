# Optional manual deployment; normal updates deploy automatically after a Git push.
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment; nothing secret lives here.
#   PS> $env:CLOUDFLARE_API_TOKEN = '...'; $env:CLOUDFLARE_ACCOUNT_ID = '...'; .\deploy.ps1
param([string]$Project = 'inc-games-git')
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$out = Join-Path $root 'dist'
node (Join-Path $root 'build.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Site build failed.' }
npx --yes wrangler@4 pages deploy $out --project-name $Project --branch main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Cloudflare deployment failed.' }
