# 2026-06-25 Web Dossier PDF Standalone Shim Fix

## Context
- Staging showed `GET /api/addresses/[id]/dossier/pdf` returning 500 with `{"error":"Failed to build dossier PDF"}`.
- Source already had a pdfkit standard-font shim, but the standalone production build did not retain the side-effect-only import in the dossier route chunk.

## Finding
- `pnpm --filter @locateflow/web build` succeeded and produced `/api/addresses/[id]/dossier/pdf`.
- The first standalone build had pdfkit data files in `.next/standalone/node_modules/pdfkit/js/data`, but `standard-font-data`/shim symbols were not present in the route bundle.
- The bundled pdfkit still contains baked `/ROOT/node_modules/pdfkit/js/data/*.afm` reads, so a missing shim can still produce the live 500 in standalone.

## Changes Made
- Changed PDF layout wiring from side-effect import to a used value import:
  `import { ensurePdfkitStandardFonts } from "@/lib/pdf/standard-font-data";`
- Called `ensurePdfkitStandardFonts()` in `layout.ts`, which protects shared PDF helpers.
- Called `ensurePdfkitStandardFonts()` directly inside `generateDossierReportPdf()` before creating `PDFDocument`.
- Updated `standard-font-data.test.ts` to call the shim explicitly and assert the used-import wiring exists.

## Files Changed
- `apps/web/src/lib/pdf/layout.ts`
- `apps/web/src/lib/pdf/dossier-report.ts`
- `apps/web/src/lib/pdf/standard-font-data.ts`
- `apps/web/src/lib/pdf/standard-font-data.test.ts`

## Verification
- `pnpm --filter @locateflow/web test -- "src/app/api/addresses/[id]/dossier/pdf/route.test.ts" "src/lib/pdf/standard-font-data.test.ts"`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`
- Post-build search confirmed the production dossier route chunk now contains `ensurePdfkitStandardFonts()`.
- Post-build data check confirmed standalone includes 14 `.afm` files and 1 `.icc` file under `node_modules/pdfkit/js/data`.

## Notes
- Build warnings observed but not introduced: local Node is `v24.13.0` while the repo wants `22.x`; Next also warns about the deprecated middleware convention and an existing Prisma CommonJS export warning.
- No environment files, deployment files, dependencies, mobile files, or production data were changed.
