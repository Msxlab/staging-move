#!/usr/bin/env python3
"""
Repair UTF-8 mojibake (UTF-8 bytes were decoded as cp1252, then re-encoded
as UTF-8) in source files.

Approach:
- Generate every plausible mojibake sequence by taking each "interesting"
  Unicode codepoint U+0080..U+2FFF, encoding it as UTF-8, mapping each byte
  through cp1252 to get the mojibake string. Build a longest-first
  replacement table.
- Walk source files (selected extensions, skipping vendor/build dirs),
  and apply the replacements byte-stably.

Replacement order matters: longer (3-char) sequences are applied before
shorter (2-char) ones, so that patterns like 'â€"' for em-dash are not
partially caught by a 2-char rule.

Whitelist of interesting ranges:
  U+00A0..U+00FF  Latin-1 supplement
  U+0100..U+017F  Latin Extended-A (Turkish ş, ğ, ı, etc.)
  U+0180..U+024F  Latin Extended-B (rare but cheap to include)
  U+02B0..U+02FF  Spacing modifier letters
  U+2000..U+206F  General punctuation (em/en dash, smart quotes, …, •)
  U+2100..U+214F  Letterlike symbols (™, ℃)
  U+2150..U+218F  Number forms
  U+2190..U+21FF  Arrows (→, ←, ↑, ↓)
  U+2200..U+22FF  Mathematical operators
  U+2300..U+23FF  Misc technical
  U+25A0..U+25FF  Geometric shapes (■, ●)
  U+2600..U+26FF  Misc symbols
  U+2700..U+27BF  Dingbats
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

INTERESTING_RANGES = [
    (0x00A0, 0x00FF),
    (0x0100, 0x017F),
    (0x0180, 0x024F),
    (0x02B0, 0x02FF),
    (0x2000, 0x206F),
    (0x2100, 0x214F),
    (0x2150, 0x218F),
    (0x2190, 0x21FF),
    (0x2200, 0x22FF),
    (0x2300, 0x23FF),
    (0x25A0, 0x25FF),
    (0x2600, 0x26FF),
    (0x2700, 0x27BF),
]


def cp1252_char(byte: int) -> str | None:
    # cp1252 leaves 0x81, 0x8D, 0x8F, 0x90, 0x9D undefined. When the broken
    # encoder mapped one of those bytes through Latin-1 instead, the file
    # ends up with U+0081/U+008D/U+008F/U+0090/U+009D control codepoints.
    # We treat both possibilities by emitting two variants per byte at call
    # sites; here we return the cp1252 mapping when defined, else fall back
    # to Latin-1 (which is identity for U+0080..U+00FF).
    try:
        return bytes([byte]).decode("cp1252")
    except UnicodeDecodeError:
        return chr(byte)


_CP1252_UNDEFINED = {0x81, 0x8D, 0x8F, 0x90, 0x9D}


def alt_chars(byte: int) -> list[str]:
    """All plausible characters a single mojibake byte may have become."""
    out: list[str] = []
    try:
        out.append(bytes([byte]).decode("cp1252"))
    except UnicodeDecodeError:
        pass
    # Latin-1 (raw control char) form, if not already covered by cp1252.
    raw = chr(byte)
    if raw not in out:
        out.append(raw)
    return out


def build_replacements() -> list[tuple[str, str]]:
    table: dict[str, str] = {}
    for start, end in INTERESTING_RANGES:
        for cp in range(start, end + 1):
            ch = chr(cp)
            try:
                utf8_bytes = ch.encode("utf-8")
            except UnicodeEncodeError:
                continue
            # Cartesian product of per-byte char options to cover both cp1252
            # and Latin-1 fallbacks for undefined cp1252 bytes.
            variants: list[list[str]] = [[]]
            for b in utf8_bytes:
                opts = alt_chars(b)
                variants = [prefix + [opt] for prefix in variants for opt in opts]
            for parts in variants:
                mojibake = "".join(parts)
                if mojibake == ch:
                    continue
                if all(ord(c) < 0x80 for c in mojibake):
                    continue
                table.setdefault(mojibake, ch)
    return sorted(table.items(), key=lambda kv: -len(kv[0]))


REPLACEMENTS = build_replacements()


SKIP_DIRS = {
    "node_modules", ".next", ".turbo", ".vercel", "dist", "build",
    "coverage", ".git", ".cache", "out", ".pnpm",
    ".claude", ".expo", "android", "ios",
}

EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs",
    ".css", ".scss", ".html",
    ".md", ".mdx",
    ".json", ".yml", ".yaml",
    ".sql", ".prisma",
}


def should_process(path: Path, root: Path) -> bool:
    if path.suffix.lower() not in EXTENSIONS:
        return False
    rel_parts = set(path.relative_to(root).parts)
    if rel_parts & SKIP_DIRS:
        return False
    return True


def fix_text(text: str) -> tuple[str, int]:
    fixes = 0
    for src, dst in REPLACEMENTS:
        if src not in text:
            continue
        count = text.count(src)
        text = text.replace(src, dst)
        fixes += count
    return text, fixes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    total_files = 0
    changed_files = 0
    total_fixes = 0
    changed_paths: list[tuple[Path, int]] = []

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            p = Path(dirpath) / name
            if not should_process(p, root):
                continue
            total_files += 1
            try:
                raw = p.read_bytes()
            except OSError:
                continue
            try:
                original = raw.decode("utf-8")
            except UnicodeDecodeError:
                continue
            fixed, fixes = fix_text(original)
            if fixes == 0 or fixed == original:
                continue
            changed_files += 1
            total_fixes += fixes
            changed_paths.append((p.relative_to(root), fixes))
            if not args.dry_run:
                p.write_bytes(fixed.encode("utf-8"))

    print(f"Generated {len(REPLACEMENTS)} replacement patterns")
    print(f"Scanned: {total_files} files")
    print(f"Changed: {changed_files} files, {total_fixes} substitutions")
    if args.verbose or args.dry_run:
        for rel, fixes in sorted(changed_paths, key=lambda x: -x[1]):
            print(f"  {fixes:>5}  {rel}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
