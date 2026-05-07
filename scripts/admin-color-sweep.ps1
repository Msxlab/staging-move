$files = Get-ChildItem -Path "apps\admin\src" -Filter *.tsx -Recurse -File | ForEach-Object { $_.FullName }

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
  # tail-end residue (faded text shades, dark: variants, leftover borders)
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
  @{ p = "bg-white\b";               r = 'bg-card' },
  @{ p = "focus:bg-white\b";         r = 'focus:bg-card' }
)

foreach ($full in $files) {
  if (-not (Test-Path -LiteralPath $full)) { Write-Host "SKIP $full"; continue }
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
