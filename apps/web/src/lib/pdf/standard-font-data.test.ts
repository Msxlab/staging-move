import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { ensurePdfkitStandardFonts } from "@/lib/pdf/standard-font-data";

ensurePdfkitStandardFonts();

// Regression for dossier-pdf-500. In the Next standalone/prod build, Turbopack
// bundles pdfkit and bakes an ABSOLUTE path for its standard-font metrics
// (e.g. readFileSync("/ROOT/node_modules/pdfkit/js/data/Helvetica.afm")). That
// path does not exist in the container, so the read throws ENOENT and the first
// text render 500s. The standard-font-data shim wraps fs.readFileSync to retry
// such pdfkit/js/data reads against the real bundled copy. These tests prove the
// shim is installed and recovers a broken baked path WITHOUT changing behavior
// for unrelated reads.

describe("pdfkit standard-font data shim (dossier-pdf-500)", () => {
  it("redirects a missing pdfkit/js/data .afm read to the real bundled copy", () => {
    // Simulate the standalone build's baked-but-nonexistent absolute path.
    const bakedBrokenPath = path.join(
      path.sep === "\\" ? "C:\\ROOT" : "/ROOT",
      "node_modules",
      "pdfkit",
      "js",
      "data",
      "Helvetica.afm",
    );
    // The literal baked path genuinely does not exist on disk (statSync is not
    // shimmed, so it reflects real filesystem state).
    expect(() => fs.statSync(bakedBrokenPath)).toThrow();

    // The shim must let pdfkit read it anyway by falling back to the bundled copy.
    const contents = fs.readFileSync(bakedBrokenPath, "utf8");
    expect(typeof contents).toBe("string");
    // AFM metrics files start with this header line.
    expect(contents).toContain("StartFontMetrics");
  });

  it("still throws for a genuinely missing non-pdfkit file (no behavior change)", () => {
    const missing = path.join(process.cwd(), "definitely-not-a-real-file-xyz.txt");
    expect(() => fs.readFileSync(missing, "utf8")).toThrow();
  });

  it("is wired through used imports so standalone bundling keeps the shim", () => {
    const layout = fs.readFileSync(new URL("./layout.ts", import.meta.url), "utf8");
    const dossier = fs.readFileSync(new URL("./dossier-report.ts", import.meta.url), "utf8");

    expect(layout).toContain('import { ensurePdfkitStandardFonts } from "@/lib/pdf/standard-font-data";');
    expect(layout).toContain("ensurePdfkitStandardFonts();");
    expect(dossier).toContain('import { ensurePdfkitStandardFonts } from "@/lib/pdf/standard-font-data";');
    expect(dossier).toContain("ensurePdfkitStandardFonts();");
  });
});
