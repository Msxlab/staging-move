# `X-Workspace-Id` Header — Client-Side Negotiation

- **Status**: Proposed (Family/Pro launch, Sprint 1 → consumed Sprint 2)
- **Tier**: Infrastructure
- **Related decisions**: D13, D11, D17
- **Related docs**: `01-architecture-decisions.md`, `05-workspace-switcher-ui.md`, `07-api-workspace-context-helper.md`, `09-existing-user-migration.md`, `10-backward-compat-rollback.md`, `60-mobile-billing-readonly.md`

## Amaç

Hem web hem mobile client'larının her API request'inde "şu anda hangi workspace context'inden konuşuyorum" bilgisini taşıması için tek standart kanal. Server tarafı `requireWorkspaceContext` (→ 07) bu header'ı okur. Bu doc client tarafının nasıl set ettiğini, persistence'ı, ve eksik header durumundaki backward-compat fallback'i tarif eder.

Tek header standardize edilirse mobile, web SSR, web client-side fetch ve admin impersonation aynı resolution path'inden geçer. Header **eksik olabilir** — bu durumda primary workspace fallback'i (D17 sayesinde) garanti çalışır, böylece migration tamamlanmamış client deploy'larda kırılma olmaz.

## Kapsam

**In scope**
- `packages/shared/src/api-client.ts` — `ApiClientConfig` genişlemesi (`getWorkspaceId?: () => string | null`)
- Web cookie: `lf_workspace_id` (set, replay, clear)
- Mobile storage: AsyncStorage key `lf.workspace.id` (read on boot, write on switch)
- Server-side header validation (boyut, format)
- CORS preflight notları
- Missing header durumunda fallback davranışı

**Out of scope**
- Workspace switcher UI (→ 05)
- Server tarafı resolution (→ 07)
- Migration / dual-read flag (→ 10)

## User stories

- **As a web user**: Header chip'ten Family workspace'e geçtim, sonraki tüm API çağrılarım otomatik o workspace'in datasını görüyor; tab kapatıp açtığımda hâlâ Family'deyim (cookie persist).
- **As a mobile user**: App'i kapatıp açtığımda son seçili workspace'imdeyim; switcher'dan geçince hem mevcut hem sonraki request'ler doğru workspace'i hedefliyor.
- **As a developer**: Eski mobile build'imde `X-Workspace-Id` header yok; server primary workspace fallback'i ile çalışmaya devam ediyor (D17), zorla update prompt'u görmüyorum.

## Veri modeli

DB tarafında yeni model yok. **Client persistence**:

- Web: `Cookie: lf_workspace_id=<cuid>` — `HttpOnly=false`, `SameSite=Lax`, `Secure` prod'da, `Path=/`, `Max-Age=180 gün`. HttpOnly **false** çünkü hem SSR hem client fetch okur; içerik PII değil opaque ID.
- Mobile: `AsyncStorage` key `lf.workspace.id` → cuid string. Logout'ta silinir.

## API endpoint'leri

### Yeni
Yok bu doc'a özgü. Server tarafı `/api/workspace/entitlements` ve `/api/workspaces` (→ 02) header tüketicileri.

### Mevcut endpoint'lere etki

Tüm `apps/web/src/app/api/**` endpoint'leri `X-Workspace-Id` header'ını kabul eder (case-insensitive). Eksik header → 07 helper primary workspace fallback'i.

Header validation kuralları:
- Format: cuid (`/^c[a-z0-9]{24}$/`) — invalid format 400 BAD_REQUEST
- Length: max 30 karakter — daha uzun 400
- Whitespace stripped
- Multiple `X-Workspace-Id` header → ilk değer (RFC 7230 conformant)

CORS:
- `apps/web/src/middleware.ts` (varsa) veya route handler `OPTIONS` response'unda `Access-Control-Allow-Headers` listesine `X-Workspace-Id` eklenir
- Mobile native fetch CORS'a tabi değil ama Expo dev tool web preview için gerekli

## Web

### Yeni sayfa/route
Yok.

### Mevcut sayfalara etki

**SSR data fetching (`fetch()` in server components)**
- `apps/web/src/lib/server-fetch.ts` (yeni utility) — `cookies()` API'sinden `lf_workspace_id` okuyup outgoing fetch'e header olarak ekler.

**Client-side fetch (browser)**
- `apps/web/src/lib/api-client.ts` — internal API çağrıları zaten same-origin; `document.cookie` ile `lf_workspace_id`'yi okur veya React context'ten alır. Browser otomatik cookie göndereceği için cookie path/scope yeterli — ek header sadece **server tarafının açık niyetli okuması** için ek güvence olarak konur (alternatif fallback path).

**Cookie set akışı**
- Workspace switcher (→ 05) bir workspace seçince `POST /api/workspace/switch { workspaceId }` çağırır.
- Endpoint membership'i doğrular, başarılıysa `Set-Cookie: lf_workspace_id=<id>; Path=/; Max-Age=15552000; SameSite=Lax; Secure` döner.
- Client routing refresh eder (`router.refresh()`).

**Logout akışı**
- `Set-Cookie: lf_workspace_id=; Max-Age=0` cookie temizler.

### Componentler
- `lib/server-fetch.ts` — yeni
- `lib/workspace-cookie.ts` — yeni, helpers (`readWorkspaceCookie`, `setWorkspaceCookie`, `clearWorkspaceCookie`)
- `hooks/useActiveWorkspace.ts` — client context provider

### Butonlar / actionlar
Switcher dropdown item click → `POST /api/workspace/switch`.

## Mobile

### Yeni ekran
Yok.

### Mevcut ekranlara etki

**ApiClient genişlemesi (`packages/shared/src/api-client.ts`)**

```diff
 export interface ApiClientConfig {
   baseUrl: string;
   getToken: () => Promise<string | null>;
+  getWorkspaceId?: () => string | Promise<string | null> | null;
   clientType?: "web" | "mobile";
   onUnauthorized?: () => void | Promise<void>;
   onError?: (error: Error) => void;
   timeoutMs?: number;
 }

 // inside getHeaders():
   const token = await this.config.getToken();
   if (token) headers["Authorization"] = `Bearer ${token}`;
+  if (this.config.getWorkspaceId) {
+    const wsId = await this.config.getWorkspaceId();
+    if (wsId) headers["X-Workspace-Id"] = wsId;
+  }
```

**Boot sequence (mobile)**
1. `App.tsx` mount'unda `AsyncStorage.getItem("lf.workspace.id")` okunur.
2. ApiClient construct'unda `getWorkspaceId: async () => await AsyncStorage.getItem("lf.workspace.id")` callback'i geçilir.
3. İlk `/api/workspace/entitlements` çağrısı header'sız da yapılabilir; response içinde `workspaceId` döndüğünde AsyncStorage'a yazılır (cold start için).

**Switcher tarafından**
Mobile workspace switcher (→ 05) bir item seçince:
1. `AsyncStorage.setItem("lf.workspace.id", id)`
2. ApiClient cache invalidate (next call header yeni id taşır)
3. Ekran reload (React Query / SWR re-fetch)

**Logout**
`AsyncStorage.removeItem("lf.workspace.id")` + ApiClient client reset.

### Componentler
- `apps/mobile/src/lib/workspace-storage.ts` — yeni: `getWorkspaceId / setWorkspaceId / clearWorkspaceId` wrappers
- `apps/mobile/src/contexts/WorkspaceContext.tsx` — React context

## Admin

### Yeni sayfa
Yok.

### Yetenekler
Admin impersonation endpoint'leri header değil `?workspace=` query param kullanır (07'de tanımlı). `lf_workspace_id` cookie admin oturumunda set edilmez (admin oturumu kendi cookie'sini taşır).

## Güvenlik

- [x] **Step-up auth?** Hayır — header tek başına auth değil, session ile kombine.
- [x] **PII redaction?** Cookie/header değeri opaque cuid; PII değil. Audit log'a workspaceId yazılır (zaten log'da kayıtlı).
- [x] **Audit log?** Workspace switch event'i `WORKSPACE_SWITCHED` action'ı ile `audit.ts` üzerinden loglanır (kim, eski → yeni workspaceId).
- [x] **Rate limit?** `POST /api/workspace/switch` per-user 20/min (UX olarak spam değil ama abuse koruması).
- [x] **Permission matris?** Header'ı set etmek free; server validation'ı membership olmadan çalışmaz (07'de 403).
- [x] **Encryption at rest?** N/A.
- [x] **GDPR DSAR + erase?** Cookie ve AsyncStorage logout'ta silinir; server-side persist yok.

**Ek güvenlik notları**
- Cross-site request forgery: cookie `SameSite=Lax` ile state-changing request'lerde otomatik gönderim engellenir (login akışı dışında zaten POST'lar CSRF token'a tabi).
- Header injection: cuid regex validation 07 helper'da yapılır.
- Session fixation: workspaceId session-bound değil (her user kendi membership'i ile cross-check edilir), session fixation riski yok.

## Migration / backward compat

D17 migration sonrası her user'ın en az bir workspace'i var → header eksikse 07 helper "primary workspace" döner. Bu sayede:

- Eski mobile build'ler (header göndermeyen) Sprint 2 deploy'undan sonra hâlâ çalışır.
- Web'de cookie set edilmemiş kullanıcı ilk request'te primary fallback'e düşer, switcher load olunca cookie set edilir.
- Dual-read window (→ 10) süresince `workspaceId IS NULL` rows hâlâ erişilebilir.

**Future hardening**: `WORKSPACE_MODE = WORKSPACE_ONLY` (10) aktif olunca, primary fallback hâlâ çalışır (D17 garantisi), sadece eski `userId`-only query path'i kaldırılır.

## Etkilenen mevcut özellikler

- `packages/shared/src/api-client.ts` — `getWorkspaceId` field eklenir, optional, mevcut kullanımı bozmaz
- `apps/mobile/App.tsx` (veya equivalent boot file) — workspace storage init
- `apps/web/src/lib/api-client.ts` (if exists) — cookie reader entegrasyonu
- `apps/web` middleware yoksa eklenmesine gerek yok; cookie zaten auto-send
- CORS config (varsa) `X-Workspace-Id` allow list'e eklenir

## Test plan

**Unit (`packages/shared/src/api-client.test.ts`)**
- `getWorkspaceId` provided → header attached
- `getWorkspaceId` returns null → header absent
- `getWorkspaceId` throws → request still proceeds without header (graceful)

**Unit (`apps/web/src/lib/workspace-cookie.test.ts`)**
- Cookie set / read / clear roundtrip
- SSR `cookies()` API integration smoke test

**Integration**
- Web: switcher tıkla → POST switch → cookie değişir → sonraki API call doğru workspaceId döner
- Mobile: AsyncStorage'a workspace id koy → app reload → ilk API call doğru header gönderir
- Header eksik → primary workspace döner (D17 fallback)
- Invalid header format → 400

**E2E**
- Web Playwright: iki workspace oluştur → switcher ile geç → addresses listesi farklı sonuç verir
- Mobile Detox / manual: aynı senaryo

**Manual QA**
- Cookie devtools'tan elle değiştir, başka workspace id koy → 403 (membership yok)
- Logout → cookie temizlendi mi
- Mobile zorla quit + relaunch → workspace context kayboldu mu (kaybolmamalı)

## Açık sorular

1. `lf_workspace_id` cookie HttpOnly olmalı mı? Argüman lehine: XSS exfiltration koruma; aleyhine: client-side React context'in cookie okumasına gerek olabilir (alternative: `/api/workspace/current` endpoint ile fetch). **Öneri**: HttpOnly **true** + endpoint approach.
2. Cookie max-age 180 gün uzun mu? Stripe Customer Portal benzeri persistent. Öneri 90 gün olsun, rolling refresh her switch'te.
3. Multi-tab senaryosu: tab A Family'ye geç, tab B Pro'da. Cookie shared → tab B'nin sonraki request'i Family'ye gider. Önerilen UX: switcher chip her tab'da SSE / focus event'inde re-sync olsun, banner "Active workspace changed in another tab".
4. iOS app group / Android shared prefs ile aynı kullanıcının başka cihazlardaki workspace seçimini sync etmek istiyor muyuz? MVP'de hayır (per-device).
5. Web fetch hem cookie hem header gönderirse hangisi kazanır? 07 precedence header → cookie → query; tutarlı.
6. Server response'unda hangi workspace'in döndüğünü `X-Workspace-Id` response header'ı ile echo etmeli miyiz? Debug kolaylığı için faydalı, security riski yok. **Öneri**: evet.
