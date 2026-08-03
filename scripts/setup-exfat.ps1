$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $projectRoot
try {
  & pnpm.cmd install --frozen-lockfile
  $installExitCode = $LASTEXITCODE

  $copies = @(
    @("packages\shared", "apps\extension\node_modules\@ticket-radar\shared"),
    @(
      "packages\platform-adapters",
      "apps\extension\node_modules\@ticket-radar\platform-adapters"
    ),
    @("packages\shared", "apps\web\node_modules\@ticket-radar\shared"),
    @("packages\ui", "apps\web\node_modules\@ticket-radar\ui"),
    @("packages\shared", "workers\api\node_modules\@ticket-radar\shared"),
    @(
      "packages\shared",
      "packages\platform-adapters\node_modules\@ticket-radar\shared"
    )
  )

  foreach ($copy in $copies) {
    $source = Join-Path $projectRoot $copy[0]
    $target = Join-Path $projectRoot $copy[1]
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    robocopy $source $target /E /XD node_modules dist /NFL /NDL /NJH /NJS /NP |
      Out-Null
    if ($LASTEXITCODE -gt 7) {
      throw "Workspace 套件實體注入失敗：$source -> $target"
    }
  }

  if (-not (Test-Path -LiteralPath "node_modules\.bin\tsc.cmd")) {
    throw "依賴工具未完整建立；pnpm exit code: $installExitCode"
  }

  Write-Host "Ticket Radar exFAT 依賴與 workspace 實體注入完成。"
} finally {
  Pop-Location
}

