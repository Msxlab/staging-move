# API Workspace Context Helper (`requireWorkspaceContext`)

- **Status**: Proposed (Family/Pro launch, Sprint 1 → routes retrofit Sprint 2)
- **Tier**: Infrastructure
- **Related decisions**: D13, D2, D17
- **Related docs**: `01-architecture-decisions.md`, `02-workspace-model.md`, `03-workspace-member-roles.md`, `06-entitlements-system.md`, `08-x-workspace-id-header.md`, `09-existing-user-migration.md`

## Amaç

Tüm API route handler'larının ilk satırda çağırdığı tek standart helper: caller user'ı doğrular, hangi workspace'te konuştuğunu çözer, üyelik rolünü kontrol eder, owner-resolved entitlement'ı yükler. Edge runtime'da Prisma çalışmadığı için (D13) bu helper **route-level async** kalır, `middleware.ts` değil.

Sonuç: hiçbir handler artık ham `userId` ile sorgu yazmaz; "bu request hangi workspace'in datasına dokunuyor" sorusu tek noktada cevaplanır. Bu, dual-read window (→ 10) ve nihayetinde workspaceId-only mode'a geçişi mümkün kılan tutamak.

## Kapsam

**In scope**
- `apps/web/src/lib/workspace-context.ts` — yeni dosya
- Header / cookie / query precedence kuralı
- Default workspace fallback (user'ın `createdAt` asc en eski owned workspace)
- Error response sözleşmesi (401, 403, 410, 404)
- Helper'ı entitlement (06) ile birleştirip tek return objesi vermesi
- Mevcut route'ların retrofit listesi

**Out of scope**
- `X-Workspace-Id` header'ı **client** tarafında üretmek (→ 08)
- Workspace switcher UI (→ 05)
- Migration script (→ 09)

## User stories

N/A — Infrastructure. Down-stream feature doc'ları bu helper'ı consume eder.

## Veri modeli

Yeni model yok. Mevcut/planlı:
- `Workspace`: `id`, `ownerUserId`, `deletedAt`, `createdAt`
- `WorkspaceMember`: `workspaceId`, `userId`, `role`, `status`

## API endpoint'leri

### Yeni
Yok (bu doc helper, endpoint değil).

### Mevcut endpoint'lere etki

**Sprint 2'de retrofit edilecek route'lar** (her biri ilk satırda `requireWorkspaceContext(request)` çağırır):

**Veri sahibi route'lar (workspace-scoped data)**
- `/api/addresses` (GET, POST), `/api/addresses/[id]` (GET, PATCH, DELETE)
- `/api/services` (GET, POST), `/api/services/[id]` (GET, PATCH, DELETE)
- `/api/moving` (GET, POST), `/api/moving/[id]/*`, `/api/moving/migration`
- `/api/budget` (GET, POST)
- `/api/custom-providers/*`
- `/api/move-tasks/*`
- `/api/export/*` (workspace-level export)
- `/api/notifications/*` (workspace-scoped notif feed)

**User-scoped route'lar (default workspace fallback yeterli)**
- `/api/profile` — user-level ama default workspace entitlement döner
- `/api/onboarding/progress` — user-level
- `/api/account/*` — user-level

**Workspace dışı kalmaya devam edenler**
- `/api/auth/*` — workspace context yok
- `/api/subscription/*` — user-level (owner endpoint için ayrı admin guard)
- `/api/health`, `/api/ready` — public
- `/api/webhooks/*` — server-to-server (stripe webhook handler'ı user-id'den workspace çözer)
- `/api/cron/*` — cron-guard.ts
- `/api/internal/*` — internal secrets
- `/api/help/*`, `/api/legal/*`, `/api/blog/*` — public read

Sprint 2 PR'ı her route için tek satır diff + test ekleyerek ilerler; topluca açılan dev-loop migration.

## Web

### Yeni sayfa/route
Yok.

### Mevcut sayfalara etki
Tüm `app/api/**/route.ts` dosyaları üst kısımda eski user-only auth çağrısı yerine `requireWorkspaceContext`'a geçer. Route handler signature aynı kalır (`Request → NextResponse`).

### Componentler

Helper imzası:

```ts
// apps/web/src/lib/workspace-context.ts
import type { ResolvedEntitlements } from "./entitlements";
import type { WorkspaceRole } from "@/lib/workspace-roles";

export interface WorkspaceContext {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  memberRole: WorkspaceRole;
  memberStatus: "ACTIVE" | "OVERFLOW" | "SUSPENDED";
  entitlements: ResolvedEntitlements;
  // Convenience booleans materialized for handlers:
  canManageMembers: boolean;
  canRunBulkSync: boolean;
  canUseAdvancedExport: boolean;
  isOwner: boolean;
}

export class WorkspaceContextError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404 | 410,
    public readonly code:
      | "UNAUTHENTICATED"
      | "NO_WORKSPACE_ACCESS"
      | "WORKSPACE_NOT_FOUND"
      | "WORKSPACE_DELETED"
      | "MEMBER_SUSPENDED",
    message: string,
  ) {
    super(message);
  }
}

export async function requireWorkspaceContext(
  request: Request,
): Promise<WorkspaceContext>;

// Helper to render error in route handler:
export function workspaceContextErrorResponse(err: WorkspaceContextError): NextResponse;
```

**Resolution algorithm (priority order)**

1. `X-Workspace-Id` header (set by ApiClient / web cookie replay, → 08)
2. `lf_workspace_id` cookie (web only, set by switcher → 05)
3. `?workspace=` query param (debug + admin impersonation use)
4. **Fallback**: user'ın owned veya member olduğu workspace'lerden `ORDER BY createdAt ASC LIMIT 1` (D17 migration sonucu her user'ın en az bir workspace'i vardır)

Çözüm sonrası:
- `Workspace.deletedAt IS NOT NULL` → throw `WORKSPACE_DELETED` (410)
- `WorkspaceMember` row yoksa → throw `NO_WORKSPACE_ACCESS` (403)
- `WorkspaceMember.status = SUSPENDED` → throw `MEMBER_SUSPENDED` (403)
- `WorkspaceMember.status = OVERFLOW`: handler döner ama gate'ler write-block uygular (D2)

User yoksa (no session) → throw `UNAUTHENTICATED` (401).

**Örnek kullanım**

```ts
// apps/web/src/app/api/addresses/route.ts
import { requireWorkspaceContext, workspaceContextErrorResponse, WorkspaceContextError } from "@/lib/workspace-context";

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireWorkspaceContext(request);
  } catch (err) {
    if (err instanceof WorkspaceContextError) return workspaceContextErrorResponse(err);
    throw err;
  }

  if (ctx.memberStatus === "OVERFLOW") {
    return NextResponse.json({ error: "Workspace is over seat limit; cannot create resources." }, { status: 403 });
  }

  const gate = await canCreateAddress(ctx.workspaceId);
  if (!gate.allowed) return NextResponse.json(gate, { status: 403 });

  // … create using workspaceId
}
```

### Butonlar / actionlar
Yok.

## Mobile

### Yeni ekran
Yok.

### Mevcut ekranlara etki
Mobile bu helper'ı doğrudan çağırmaz; backend'e gönderdiği `X-Workspace-Id` header'ı bu helper tarafından okunur (→ 08). Mobile için tek anlamı: 401/403/410 response kodlarına anlamlı UX vermek (re-login, workspace switch, workspace-gone modal).

### Componentler
Yok bu doc'ta.

## Admin

### Yeni sayfa
Yok.

### Yetenekler
Admin impersonation akışı (`impersonation-audit.ts`) `?workspace=` query param ile inspection endpoint'lerine geçer; helper bunu accept eder ama ek `requireAdminSession` çağrısı ile sarmalanır (admin tarafı ayrı bir wrapper'da yaşar, normal route'larda admin path kullanılmaz).

## Güvenlik

- [x] **Step-up auth?** Hayır — helper auth doğrular, step-up `15-workspace-auth-challenge.md`'de event-bazlı.
- [x] **PII redaction?** Helper response'u handler'a iç data döner, dışarı sızmaz. Error response'ları workspaceId leak etmez (sadece status code + opaque kod).
- [x] **Audit log?** Hayır helper-level; ama 403 `NO_WORKSPACE_ACCESS` durumunda **suspicious access** olarak `audit.ts` `WORKSPACE_ACCESS_DENIED` action log'u atılır (low-noise — fingerprint hash ile dedup).
- [x] **Rate limit?** Helper kendi başına rate-limit etmez; route'un kendi rate-limit'i (varsa) önce çalışır, helper ondan sonra invoke edilir.
- [x] **Permission matris?**
  - Tüm roller: ctx döner, `memberRole` field'ında rapor edilir
  - Handler `ctx.memberRole`'a göre fine-grained gate yapar (örn. `OWNER | ADMIN` only routes için)
  - OVERFLOW: read OK, write block (handler tarafında kontrol)
  - SUSPENDED: 403 (helper tarafından)
- [x] **Encryption at rest?** N/A.
- [x] **GDPR DSAR + erase?** User erase olunca `WorkspaceMember` cascade ile silinir → helper 403 döner. Erase sırasında active session'ın bir sonraki çağrısı `UNAUTHENTICATED` olur.

## Migration / backward compat

- Sprint 1: helper merge edilir, hiçbir route çağırmaz (dead code, test'leri çalışır).
- Sprint 2: route'lar batch halinde retrofit edilir. Her batch için: handler değişir + e2e test eklenir + dual-read flag (→ 10) ile uyumlu kalır.
- Dual-read window (D17): helper `workspaceId` döner ama prisma query'leri `WHERE workspaceId = ? OR (workspaceId IS NULL AND userId = ?)` filtresi kullanır. `WORKSPACE_MODE = WORKSPACE_ONLY` olunca OR kalkar.

## Etkilenen mevcut özellikler

- `apps/web/src/lib/auth.ts` `requireDbUserId` — kullanılmaya devam eder (helper içeride çağırır)
- `apps/web/src/lib/user-auth.ts` — auth çekirdeği, değişmez
- `apps/web/src/lib/impersonation-audit.ts` — admin path için kullanılır, helper ek log atmaz
- Tüm `route.test.ts` dosyaları yeni 401/403/410 senaryoları eklemek zorunda

## Test plan

**Unit (`apps/web/src/lib/workspace-context.test.ts`)**
- No session → 401 UNAUTHENTICATED
- Session var, no WorkspaceMember → 403 NO_WORKSPACE_ACCESS
- Header + cookie + query birlikte → header kazanır (precedence)
- Header missing → cookie kullanılır
- Hiçbiri yok → primary workspace fallback (createdAt asc)
- `Workspace.deletedAt` set → 410
- Member status SUSPENDED → 403 MEMBER_SUSPENDED
- Member status OVERFLOW → ctx döner, `memberStatus = "OVERFLOW"`
- Entitlements field populated (delegation to 06)

**Integration**
- Sprint 2 retrofit edilen her route için: cross-workspace data leak yok testi (User A header'ında User B'nin workspaceId'si → 403)

**E2E**
- Manual: web header chip ile workspace değiştir, `/api/addresses` farklı dataset döner
- Mobile: AsyncStorage'da farklı workspace.id set ederek aynı doğrulama

**Manual QA**
- Admin impersonation `?workspace=` ile farklı workspace'e bakar, audit log yazılır

## Açık sorular

1. Header precedence cookie'den önce mi? — Öneri: evet, çünkü mobile/SSR cookie göndermez, header explicit.
2. `?workspace=` query param production'da açık mı kalmalı? Önerilen: yalnızca admin oturumlu request'lerde kabul edilsin (regular user için ignored, audit log).
3. Helper'ın per-request cache'i Next.js `cache()` kullanmalı mı? Test edilebilirlik için manual context object'ini route handler'da paylaşmak yeterli olabilir.
4. OVERFLOW member'lar `/api/profile` çağırınca normal response mu downgrade banner payload'ı mı dönsün? Öneri: normal response + entitlement snapshot içinde `seatStatus = "OVERFLOW"` flag.
5. Webhook handler'ları (stripe, iap-apple, iap-google) bu helper'ı kullanmaz — `userId → ownerOfWorkspace` çevirisi için ayrı helper `resolveOwnerWorkspaces(userId)` gerek mi? Öneri: evet, ufak utility.
