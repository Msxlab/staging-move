import fs from "fs";
import path from "path";

/**
 * Make pdfkit's built-in (standard-14) AFM font metrics resolvable in the
 * Next.js `output: "standalone"` production build.
 *
 * ── Why this exists (root cause of dossier-pdf-500) ──────────────────────
 * pdfkit loads the metrics for its standard fonts (Helvetica, Helvetica-Bold,
 * Helvetica-Oblique, …) by doing, inside its own source:
 *
 *     fs.readFileSync(__dirname + "/data/Helvetica.afm", "utf8")
 *
 * In a normal Node install `__dirname` is the real pdfkit package dir, so the
 * read succeeds. But Next 16's production bundler (Turbopack) BUNDLES pdfkit
 * into a server chunk and resolves that `__dirname + "/data/..."` expression at
 * BUILD time to an ABSOLUTE path rooted at the file-tracing root — it ships in
 * the bundle literally as:
 *
 *     readFileSync("/ROOT/node_modules/pdfkit/js/data/Helvetica.afm", "utf8")
 *
 * `/ROOT` is the tracing-root placeholder. At runtime in the standalone Docker
 * image the app runs from `/app`, so `/ROOT/...` does not exist → every standard
 * font read throws ENOENT. The very first text render (`doc.font("Helvetica-Bold")`,
 * reached even by `new PDFDocument()`'s default-font init and our header) throws,
 * the route's catch turns it into HTTP 500. This is why the earlier
 * missing-data-section guard didn't help: the failure is in font init, before any
 * dossier section is touched, and only in the standalone/prod build.
 *
 * Next's file-tracing DOES copy the .afm/.icc data into the standalone output,
 * but at `<standalone-root>/node_modules/pdfkit/js/data/` — NOT at the baked
 * `/ROOT/...` path, and WITHOUT pdfkit's package.json (so `require.resolve`
 * cannot find it either).
 *
 * ── The fix ──────────────────────────────────────────────────────────────
 * Narrowly wrap `fs.readFileSync` (and `existsSync`) so that any read of a
 * `pdfkit/js/data/<file>` path that misses is retried against the real bundled
 * copy, located via a list of candidate roots that work in dev, in vitest, and
 * in the standalone image. This keeps pdfkit's exact standard-14 metrics (no
 * appearance change, no bundled binary fonts) and is robust to whatever absolute
 * path the bundler baked in. Applied once, idempotently.
 */

const DATA_SEGMENT = `pdfkit${path.sep}js${path.sep}data${path.sep}`;
const DATA_SEGMENT_POSIX = "pdfkit/js/data/";

// Capture the ORIGINAL fs functions up front. Internal candidate-resolution
// must use these (not the patched versions installed below), otherwise the
// patched existsSync — which itself redirects pdfkit data basenames — would
// report every candidate dir as present and break resolution.
const originalReadFileSync = fs.readFileSync.bind(fs);
const originalExistsSync = fs.existsSync.bind(fs);

/** Candidate directories that may hold pdfkit's traced `data` files at runtime. */
function candidateDataDirs(): string[] {
  const dirs: string[] = [];
  const add = (dir: string | undefined | null) => {
    if (dir && !dirs.includes(dir)) dirs.push(dir);
  };

  // 1) Runtime cwd variants. Docker usually starts from the standalone root, but
  //    local scripts/tests can run from apps/web; walk a few ancestors so both
  //    layouts find <root>/node_modules/pdfkit/js/data.
  let cursor = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    add(path.join(cursor, "node_modules", "pdfkit", "js", "data"));
    add(path.join(cursor, "apps", "web", "node_modules", "pdfkit", "js", "data"));
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  // 2) Resolvable install (dev, tests, non-bundled): ask Node where pdfkit is.
  try {
    const pkg = require.resolve("pdfkit/package.json");
    add(path.join(path.dirname(pkg), "js", "data"));
  } catch {
    // pdfkit is bundled (no resolvable package.json) — fine, other roots cover it.
  }
  return dirs;
}

/** Resolve `<basename>.afm` (etc.) to the first candidate dir that has it. */
function resolveBundledDataFile(basename: string): string | null {
  for (const dir of candidateDataDirs()) {
    const full = path.join(dir, basename);
    try {
      if (originalExistsSync(full)) return full;
    } catch {
      // ignore and try the next candidate
    }
  }
  return null;
}

/** True for a path that points at a pdfkit `js/data` asset (afm/icc). */
function pdfkitDataBasename(p: unknown): string | null {
  if (typeof p !== "string") return null;
  const norm = p.split("\\").join("/");
  const idx = norm.indexOf(DATA_SEGMENT_POSIX);
  if (idx === -1 && !p.includes(DATA_SEGMENT)) return null;
  const base = norm.slice(norm.lastIndexOf("/") + 1);
  return base || null;
}

let installed = false;

/**
 * Install the pdfkit standard-font data shim. Idempotent and safe to call from
 * any number of PDF generators — the first call patches `fs`, the rest no-op.
 */
export function ensurePdfkitStandardFonts(): void {
  if (installed) return;
  installed = true;

  // Wrap readFileSync: only redirect when the original read fails AND the path
  // looks like a pdfkit data asset. Behavior is otherwise unchanged.
  (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = function patchedReadFileSync(
    this: unknown,
    p: Parameters<typeof fs.readFileSync>[0],
    options?: Parameters<typeof fs.readFileSync>[1],
  ): string | Buffer {
    try {
      return originalReadFileSync(p as never, options as never);
    } catch (err) {
      const base = pdfkitDataBasename(p);
      if (base) {
        const fallback = resolveBundledDataFile(base);
        if (fallback) return originalReadFileSync(fallback as never, options as never);
      }
      throw err;
    }
  } as typeof fs.readFileSync;

  // Wrap existsSync so any pdfkit pre-check also sees the bundled copy.
  (fs as { existsSync: typeof fs.existsSync }).existsSync = function patchedExistsSync(
    p: Parameters<typeof fs.existsSync>[0],
  ): boolean {
    if (originalExistsSync(p)) return true;
    const base = pdfkitDataBasename(p);
    if (base) return resolveBundledDataFile(base) !== null;
    return false;
  } as typeof fs.existsSync;
}

// Install on import so a simple `import "@/lib/pdf/standard-font-data"` (or any
// re-export through layout) is enough to harden every PDF generator.
ensurePdfkitStandardFonts();
