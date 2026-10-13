# ============================================================
#  export_wp.ps1 — выгрузка всех статей + картинок на Windows.
#  PowerShell уже встроен в Windows — ставить ничего не надо.
#
#  Как запустить:
#    1. Нажми "Пуск" → набери "PowerShell" → открой
#    2. Перейди в папку со скриптом, напр.:  cd C:\Users\Ты\Downloads
#    3. Разреши запуск (один раз):
#         Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#    4. Запусти:
#         .\export_wp.ps1
#
#  Опции:
#    .\export_wp.ps1 -NoImages          # без скачивания картинок
#    .\export_wp.ps1 -Site "https://ulagatttyustaz.kz" -Out "export"
# ============================================================
param(
  [string]$Site = "https://ulagatttyustaz.kz",
  [string]$Out  = "export",
  [switch]$NoImages
)
$ErrorActionPreference = "Stop"
$Site = $Site.TrimEnd("/")
$imgDir = Join-Path $Out "images"
New-Item -ItemType Directory -Force -Path $imgDir | Out-Null
$headers = @{ "User-Agent" = "UlagattyExport/1.0" }

function Get-AllItems($endpoint) {
  $items = @(); $page = 1
  while ($true) {
    $url = "$Site/wp-json/wp/v2/$endpoint" + "?per_page=100&page=$page&_embed=1"
    try { $data = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 60 }
    catch { break }
    if (-not $data) { break }
    if ($data -isnot [System.Array]) { $data = @($data) }
    if ($data.Count -eq 0) { break }
    $items += $data
    Write-Host "  $endpoint — страница $page (всего $($items.Count))"
    if ($data.Count -lt 100) { break }
    $page++
    Start-Sleep -Milliseconds 300
  }
  return $items
}

function Save-Image($url) {
  try {
    $name = [System.IO.Path]::GetFileName(([System.Uri]$url).AbsolutePath)
    if (-not $name) { return $null }
    $path = Join-Path $imgDir $name
    if (-not (Test-Path $path)) {
      Invoke-WebRequest -Uri $url -OutFile $path -Headers $headers -TimeoutSec 120
      Start-Sleep -Milliseconds 120
    }
    return $name
  } catch { Write-Host "  не удалось: $url" -ForegroundColor Yellow; return $null }
}

function Convert-Items($items) {
  $out = @()
  foreach ($it in $items) {
    $content = $it.content.rendered
    $featured = $null
    if ($it._embedded.'wp:featuredmedia') {
      $featured = $it._embedded.'wp:featuredmedia'[0].source_url
    }
    $cats = @()
    if ($it._embedded.'wp:term') {
      foreach ($group in $it._embedded.'wp:term') {
        foreach ($t in $group) { if ($t.taxonomy -eq "category") { $cats += $t.name } }
      }
    }
    if (-not $NoImages) {
      $srcs = [regex]::Matches($content, 'src="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
      foreach ($src in $srcs) {
        if ($src -like "http*") {
          $local = Save-Image $src
          if ($local) { $content = $content.Replace($src, "images/$local") }
        }
      }
      if ($featured) {
        $fn = Save-Image $featured
        if ($fn) { $featured = "images/$fn" }
      }
    }
    $out += [PSCustomObject]@{
      id             = $it.id
      title          = ($it.title.rendered -replace '<[^>]+>', '')
      slug           = $it.slug
      date           = $it.date
      link           = $it.link
      categories     = $cats
      excerpt_html   = $it.excerpt.rendered
      content_html   = $content
      featured_image = $featured
    }
  }
  return $out
}

Write-Host "1) Записи (posts)…"
$posts = Get-AllItems "posts"
$articles = Convert-Items $posts
$articles | ConvertTo-Json -Depth 10 | Out-File (Join-Path $Out "articles.json") -Encoding utf8

Write-Host "2) Страницы (pages)…"
$pages = Get-AllItems "pages"
$pagesOut = Convert-Items $pages
$pagesOut | ConvertTo-Json -Depth 10 | Out-File (Join-Path $Out "pages.json") -Encoding utf8

Write-Host ""
Write-Host "Готово!" -ForegroundColor Green
Write-Host "  Статей:  $($articles.Count)  -> $Out\articles.json"
Write-Host "  Страниц: $($pagesOut.Count) -> $Out\pages.json"
Write-Host "  Картинки: $Out\images\"
