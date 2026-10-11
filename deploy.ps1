# Optional manual deployment of the inc-games Worker; normal updates deploy through Workers Builds after a Git push.
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment; nothing secret lives here.
#   PS> $env:CLOUDFLARE_API_TOKEN = '...'; $env:CLOUDFLARE_ACCOUNT_ID = '...'; .\deploy.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
node (Join-Path $root 'build.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Site build failed.' }
Push-Location $root
try { npx --yes wrangler@4 deploy; if ($LASTEXITCODE -ne 0) { throw 'Cloudflare deployment failed.' } }
finally { Pop-Location }
