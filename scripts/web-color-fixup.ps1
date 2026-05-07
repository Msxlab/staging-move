# Recovery sweep — fixes artifacts left by web-color-sweep.ps1:
#   1. Trailing residue from alternation order bug: `bg-tone-X-bg0/10` -> `bg-tone-X-bg`
#   2. Wrong suffix for text/border: `text-tone-X-bg` -> `text-tone-X-fg`,
#      `border-tone-X-bg` -> `border-tone-X-br`
#   3. ring-primary/400/40 (residue from ring-orange-500/40 going through gray sweep) -> ring-primary/40
#   4. bg-tone-X-bg0/X opacity garbage

$files = Get-ChildItem -Path "apps\web\src" -Filter *.tsx -Recurse -File | ForEach-Object { $_.FullName }

$rules = @(
  # 1. Trailing residue after alternation matched too short (50 instead of 500)
  @{ p = "(bg|text|border|hover:bg|hover:text|hover:border|focus:bg|focus:text|focus:border|dark:bg|dark:text|dark:border|group-hover:text|group-hover:bg)-tone-([a-z]+)-(bg|fg|br)0(/\d+)?"; r = '$1-tone-$2-$3' },
  # 2. Wrong suffix: text/border with -bg should be -fg/-br
  @{ p = "(hover:|focus:|dark:|group-hover:)?text-tone-([a-z]+)-bg\b"; r = '$1text-tone-$2-fg' },
  @{ p = "(hover:|focus:|dark:)?border-tone-([a-z]+)-bg\b"; r = '$1border-tone-$2-br' },
  # 3. ring-primary/400/40 -> ring-primary/40 (alternation residue)
  @{ p = "ring-primary/4000?/(\d+)";        r = 'ring-primary/$1' },
  @{ p = "ring-primary/400";               r = 'ring-primary/40' },
  # 4. Standalone hover:bg-tone-X-bg with same-color text usually means a button.
  #    No rule needed — designer judgement; leave as-is.
  # 5. Double-slash opacity artifacts (e.g. bg-destructive/20/10 from rose -> destructive/20 carrying its own /X)
  @{ p = "(bg|text|border|ring)-destructive/20/(\d+)"; r = '$1-destructive/$2' },
  @{ p = "(bg|text|border|ring)-destructive/20\b";    r = '$1-destructive' },
  # 6. Same artifact pattern for tone tokens (rare but possible)
  @{ p = "(bg|text|border|ring)-tone-([a-z]+)-(bg|fg|br)/(\d+)/(\d+)"; r = '$1-tone-$2-$3/$5' },
  # 7. Collapse double-space inside className="..." strings only
  @{ p = '(className=")([^"]*)  +([^"]*)("\s)'; r = '$1$2 $3$4' }
)

foreach ($full in $files) {
  if (-not (Test-Path -LiteralPath $full)) { continue }
  $content = Get-Content -Raw -LiteralPath $full
  $original = $content
  foreach ($rule in $rules) {
    $content = [regex]::Replace($content, $rule.p, $rule.r)
  }
  if ($content -ne $original) {
    Set-Content -Encoding UTF8 -LiteralPath $full -Value $content -NoNewline
    Write-Host "OK $full"
  }
}
