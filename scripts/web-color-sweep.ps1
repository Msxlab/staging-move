$files = Get-ChildItem -Path "apps\web\src" -Filter *.tsx -Recurse -File | ForEach-Object { $_.FullName }

$rules = @(
  @{ p = "bg-green-500/(\d+)";       r = 'bg-tone-sage-bg' },
  @{ p = "bg-green-500\b";           r = 'bg-tone-sage-fg' },
  @{ p = "border-green-500/(\d+)";   r = 'border-tone-sage-br' },
  @{ p = "text-green-(400|500|600|700)\b"; r = 'text-tone-sage-fg' },
  @{ p = "hover:bg-green-500/?\d*"; r = 'hover:bg-tone-sage-bg' },
  @{ p = "hover:bg-green-50\b"; r = 'hover:bg-tone-sage-bg' },
  @{ p = "border-green-200\b"; r = 'border-tone-sage-br' },
  @{ p = "bg-emerald-500/(\d+)";     r = 'bg-tone-emerald-bg' },
  @{ p = "bg-emerald-500\b";         r = 'bg-tone-emerald-fg' },
  @{ p = "text-emerald-(400|500|600)\b"; r = 'text-tone-emerald-fg' },
  @{ p = "bg-blue-500/(\d+)";        r = 'bg-tone-sky-bg' },
  @{ p = "bg-blue-500\b";            r = 'bg-tone-sky-fg' },
  @{ p = "border-blue-500/(\d+)";    r = 'border-tone-sky-br' },
  @{ p = "text-blue-(400|500|600)\b"; r = 'text-tone-sky-fg' },
  @{ p = "hover:bg-blue-500\b";      r = 'hover:bg-tone-sky-fg' },
  @{ p = "bg-cyan-500/(\d+)";        r = 'bg-tone-cyan-bg' },
  @{ p = "bg-cyan-500\b";            r = 'bg-tone-cyan-fg' },
  @{ p = "text-cyan-(400|500|600)\b"; r = 'text-tone-cyan-fg' },
  @{ p = "bg-red-500/(\d+)";         r = 'bg-destructive/$1' },
  @{ p = "bg-red-500\b";             r = 'bg-destructive' },
  @{ p = "border-red-500/(\d+)";     r = 'border-destructive/$1' },
  @{ p = "text-red-(400|500|600|700)\b"; r = 'text-destructive' },
  @{ p = "hover:bg-red-50\b"; r = 'hover:bg-destructive/10' },
  @{ p = "border-red-200\b"; r = 'border-destructive/30' },
  @{ p = "bg-amber-500/(\d+)";       r = 'bg-tone-honey-bg' },
  @{ p = "bg-amber-500\b";           r = 'bg-tone-honey-fg' },
  @{ p = "border-amber-500/(\d+)";   r = 'border-tone-honey-br' },
  @{ p = "text-amber-(400|500|600|700)\b"; r = 'text-tone-honey-fg' },
  @{ p = "bg-yellow-500/(\d+)";      r = 'bg-tone-honey-bg' },
  @{ p = "bg-yellow-500\b";          r = 'bg-tone-honey-fg' },
  @{ p = "border-yellow-500/(\d+)";  r = 'border-tone-honey-br' },
  @{ p = "text-yellow-(400|500|600)\b"; r = 'text-tone-honey-fg' },
  @{ p = "bg-purple-500/(\d+)";      r = 'bg-tone-foil-bg' },
  @{ p = "bg-purple-500\b";          r = 'bg-tone-foil-fg' },
  @{ p = "text-purple-(400|500|600)\b"; r = 'text-tone-foil-fg' },
  @{ p = "bg-orange-500/(\d+)";      r = 'bg-tone-orange-bg' },
  @{ p = "bg-orange-500\b";          r = 'bg-tone-orange-fg' },
  @{ p = "border-orange-500/(\d+)";  r = 'border-tone-orange-br' },
  @{ p = "text-orange-(400|500|600)\b"; r = 'text-tone-orange-fg' },
  @{ p = "bg-gray-500/(\d+)";        r = 'bg-tone-slate-bg' },
  @{ p = "bg-gray-(300|400|500|600)\b"; r = 'bg-tone-slate-fg' },
  @{ p = "text-gray-(300|400|500|600)\b"; r = 'text-muted-foreground' },
  @{ p = "bg-slate-500/(\d+)";       r = 'bg-tone-slate-bg' },
  @{ p = "text-slate-(400|500|600)\b"; r = 'text-muted-foreground' },
  @{ p = "bg-zinc-(\d{3})/?\d*";     r = 'bg-muted' },
  @{ p = "text-zinc-(\d{3})\b";      r = 'text-muted-foreground' },
  @{ p = "bg-black/50";              r = 'bg-foreground/30 backdrop-blur-sm' },
  @{ p = "bg-black/30";              r = 'bg-foreground/20 backdrop-blur-sm' },
  @{ p = "bg-black/60";              r = 'bg-foreground/40 backdrop-blur-sm' },
  @{ p = "border-slate-500/(\d+)";   r = 'border-tone-slate-br' },
  @{ p = "border-emerald-500/(\d+)"; r = 'border-tone-emerald-br' },
  @{ p = "border-cyan-500/(\d+)";    r = 'border-tone-cyan-br' },
  @{ p = "border-gray-500/(\d+)";    r = 'border-tone-slate-br' },
  @{ p = "border-red-500\b";         r = 'border-destructive' },
  @{ p = "focus:border-red-500\b";   r = 'focus:border-destructive' },
  @{ p = "focus:ring-red-500/(\d+)"; r = 'focus:ring-destructive/$1' },
  @{ p = "text-amber-(100|200|300|800|900)\b"; r = 'text-tone-honey-fg' },
  @{ p = "text-amber-100/80\b";      r = 'text-tone-honey-fg/80' },
  @{ p = "text-emerald-(200|300)\b"; r = 'text-tone-emerald-fg' },
  @{ p = "text-red-(300|800|900)\b"; r = 'text-destructive' },
  @{ p = "text-rose-(400|500|600)\b"; r = 'text-destructive' },
  @{ p = "dark:text-amber-(100|200|300)\b"; r = '' },
  @{ p = "dark:text-emerald-(200|300)\b"; r = '' },
  @{ p = "bg-green-600\b";           r = 'bg-tone-sage-fg' },
  # Round 2: shades not yet covered + ring/focus + remaining brand shades
  # green
  @{ p = "(hover:|focus:)?(bg|text|border)-green-(50|100|200|300|800|900)(/\d+)?";  r = '$1$2-tone-sage-bg' },
  # emerald
  @{ p = "(hover:|focus:)?(bg|text|border)-emerald-(50|100|200|300|400|600|700|800|900)(/\d+)?"; r = '$1$2-tone-emerald-bg' },
  # blue
  @{ p = "(hover:|focus:)?(bg|text|border)-blue-(50|100|200|300|700|800|900)(/\d+)?"; r = '$1$2-tone-sky-bg' },
  # cyan
  @{ p = "(hover:|focus:)?(bg|text|border)-cyan-(50|100|200|300|700|800|900)(/\d+)?"; r = '$1$2-tone-cyan-bg' },
  # red
  @{ p = "(hover:|focus:)?(bg|text|border)-red-(50|100|200|300|800|900)(/\d+)?";   r = '$1$2-destructive/20' },
  # amber
  @{ p = "(hover:|focus:)?(bg|text|border)-amber-(50|100|400|800|900)(/\d+)?";       r = '$1$2-tone-honey-bg' },
  # yellow
  @{ p = "(hover:|focus:)?(bg|text|border)-yellow-(50|100|200|300|700|800|900)(/\d+)?"; r = '$1$2-tone-honey-bg' },
  # purple / violet
  @{ p = "(hover:|focus:)?(bg|text|border)-purple-(50|100|200|300|700|800|900)(/\d+)?"; r = '$1$2-tone-foil-bg' },
  @{ p = "(hover:|focus:)?(bg|text|border)-violet-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = '$1$2-tone-foil-bg' },
  # orange
  @{ p = "(hover:|focus:)?(bg|text|border)-orange-(50|100|200|300|400|600|700|800|900)(/\d+)?"; r = '$1$2-tone-orange-bg' },
  # rose / pink (treat as destructive accent)
  @{ p = "(hover:|focus:)?(bg|text|border)-rose-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = '$1$2-destructive/20' },
  @{ p = "(hover:|focus:)?(bg|text|border)-pink-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = '$1$2-destructive/20' },
  # gray / slate / zinc / neutral / stone shades
  @{ p = "(hover:|focus:)?(bg|text|border)-(gray|slate|zinc|neutral|stone)-(50|100|200|700|800|900)(/\d+)?"; r = '$1$2-muted' },
  # ring-{color}-{shade}/X (no fg/bg suffix, ring uses the color directly)
  @{ p = "(focus:|hover:)?ring-(orange|amber|yellow|red|green|emerald|blue|cyan|sky|purple|violet|rose|pink|gray|slate|zinc|neutral|stone)-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = '$1ring-primary/40' },
  # gradient stops (from-/to-/via-) — fold to primary/accent for now
  @{ p = "from-(orange|amber|yellow|red|green|emerald|blue|cyan|sky|purple|violet|rose|pink)-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = 'from-primary' },
  @{ p = "to-(orange|amber|yellow|red|green|emerald|blue|cyan|sky|purple|violet|rose|pink)-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = 'to-accent' },
  @{ p = "via-(orange|amber|yellow|red|green|emerald|blue|cyan|sky|purple|violet|rose|pink)-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = 'via-primary/60' },
  # Round 3: hover shade-600 + sky/teal/lime/indigo + bg-destructive/200 fix
  @{ p = "hover:bg-red-(600|700|800)\b";   r = 'hover:bg-destructive/80' },
  @{ p = "hover:bg-amber-(600|700|800)\b"; r = 'hover:bg-tone-honey-fg/80' },
  @{ p = "hover:bg-cyan-(600|700|800)\b";  r = 'hover:bg-tone-cyan-fg/80' },
  @{ p = "hover:bg-orange-(600|700|800)\b"; r = 'hover:bg-tone-orange-fg/80' },
  @{ p = "hover:bg-blue-(600|700|800)\b";  r = 'hover:bg-tone-sky-fg/80' },
  @{ p = "hover:bg-green-(600|700|800)\b"; r = 'hover:bg-tone-sage-fg/80' },
  @{ p = "hover:bg-purple-(600|700|800)\b"; r = 'hover:bg-tone-foil-fg/80' },
  # sky / teal / lime / indigo / fuchsia (Aurora doesn't have these — fold to closest tone)
  @{ p = "(hover:|focus:)?(bg|text|border)-sky-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = '$1$2-tone-sky-bg' },
  @{ p = "(hover:|focus:)?(bg|text|border)-teal-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = '$1$2-tone-emerald-bg' },
  @{ p = "(hover:|focus:)?(bg|text|border)-lime-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = '$1$2-tone-sage-bg' },
  @{ p = "(hover:|focus:)?(bg|text|border)-indigo-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = '$1$2-tone-foil-bg' },
  @{ p = "(hover:|focus:)?(bg|text|border)-fuchsia-(50|100|200|300|400|500|600|700|800|900)(/\d+)?"; r = '$1$2-tone-foil-bg' },
  # gray/slate shade-400
  @{ p = "(hover:|focus:)?(bg|text|border)-(gray|slate)-400\b"; r = '$1$2-muted-foreground' },
  # bg-destructive/200 artifact -> bg-destructive/20 (actually use 20 for /20)
  @{ p = "bg-destructive/200\b";          r = 'bg-destructive/20' },
  @{ p = "border-destructive/200\b";      r = 'border-destructive/20' },
  @{ p = "text-destructive/200\b";        r = 'text-destructive' },
  # Solid bg with text-fg suffix typo (script earlier produced bg-tone-X-fg with shade artifacts)
  @{ p = "(bg|text|border)-tone-([a-z]+)-bg/(\d+)";  r = '$1-tone-$2-bg' }
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
