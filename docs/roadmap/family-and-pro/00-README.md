# Family & Pro Launch — Master Index

- **Status**: Proposal locked, implementation not started
- **Target**: Family + Pro paralel lansman (~8 hafta paralel sprint)
- **Branch**: `claude/relaxed-franklin-OvI62`
- **Owner**: TBD
- **Decision log**: [`01-architecture-decisions.md`](./01-architecture-decisions.md) — *bu dosya tüm diğer doc'ların referans tabanıdır*

---

## Bu klasör nedir

LocateFlow'un mevcut **Individual** tek-tier modelini **Free Trial / Individual / Family / Pro** dört-tier'lı bir Workspace mimarisine evirmek için tüm feature spec'leri. Her dosya bir özelliği detaylı tarifler:

- Veri modeli (Prisma)
- API endpoint'leri (yeni + mevcut etkilenen)
- Web değişiklikleri (sayfa, component, buton)
- Mobile değişiklikleri
- Admin değişiklikleri
- Güvenlik gereksinimleri
- Migration / backward compat
- Etkilenen mevcut özellikler
- Test planı

Her doc'un başında `Status / Tier / Related docs` rubric'i vardır.

---

## Okuma sırası

İlk kez bakıyorsan:

1. [`01-architecture-decisions.md`](./01-architecture-decisions.md) — neye, **neden** karar verildi
2. [`02-workspace-model.md`](./02-workspace-model.md) — temel data nesnesi
3. [`06-entitlements-system.md`](./06-entitlements-system.md) — plan davranışı
4. [`11-address-change-event-model.md`](./11-address-change-event-model.md) — ürünün asıl mekaniği
5. [`33-partner-hub-ui.md`](./33-partner-hub-ui.md) — Pro'nun satış argümanı

Sonra ihtiyaca göre.

---

## Dosya indeksi

### Altyapı (00–10)

| # | Dosya | Açıklama |
|---|---|---|
| 00 | [README.md](./00-README.md) | Bu dosya |
| 01 | [architecture-decisions.md](./01-architecture-decisions.md) | Tüm mimari kararların tek kaynağı |
| 02 | [workspace-model.md](./02-workspace-model.md) | `Workspace` modeli, lifecycle, ownership |
| 03 | [workspace-member-roles.md](./03-workspace-member-roles.md) | 5 sabit rol, policy matrisi |
| 04 | [workspace-invitation.md](./04-workspace-invitation.md) | Davet token akışı, accept flow, güvenlik |
| 05 | [workspace-switcher-ui.md](./05-workspace-switcher-ui.md) | Web + mobile header chip |
| 06 | [entitlements-system.md](./06-entitlements-system.md) | Owner-resolved plan, grace period, seat overflow |
| 07 | [api-workspace-context-helper.md](./07-api-workspace-context-helper.md) | `requireWorkspaceContext` route helper |
| 08 | [x-workspace-id-header.md](./08-x-workspace-id-header.md) | ApiClient + header negotiation |
| 09 | [existing-user-migration.md](./09-existing-user-migration.md) | Mevcut User → PERSONAL workspace backfill |
| 10 | [backward-compat-rollback.md](./10-backward-compat-rollback.md) | Dual-read window, feature flag, rollback plan |

### Adres Değişikliği Çekirdeği (11–14)

| # | Dosya | Açıklama |
|---|---|---|
| 11 | [address-change-event-model.md](./11-address-change-event-model.md) | `AddressChangeEvent` modeli + lifecycle |
| 12 | [address-change-target-model.md](./12-address-change-target-model.md) | `AddressChangeTarget` + per-target status + USER/ADDRESS/CUSTOM semantik |
| 13 | [address-change-wizard-web.md](./13-address-change-wizard-web.md) | Web wizard UI (scope → target → service picker) |
| 14 | [bulk-queue-dashboard.md](./14-bulk-queue-dashboard.md) | Aktif event dashboard'u + progress UX |

### Güvenlik (15–18)

| # | Dosya | Açıklama |
|---|---|---|
| 15 | [workspace-auth-challenge.md](./15-workspace-auth-challenge.md) | Step-up auth için challenge tablosu |
| 16 | [step-up-auth-flow.md](./16-step-up-auth-flow.md) | Password / MFA / email OTP flow |
| 17 | [ios-subscription-conflict-guard.md](./17-ios-subscription-conflict-guard.md) | iOS aktif sub varken web checkout engelleme |
| 18 | [security-checklist.md](./18-security-checklist.md) | Lansman öncesi cross-cutting güvenlik kontrol listesi |

### Family Tier (20–25)

| # | Dosya | Açıklama |
|---|---|---|
| 20 | [family-plan-definition.md](./20-family-plan-definition.md) | Limit, fiyat, positioning, billing definition |
| 21 | [family-checkout-flow.md](./21-family-checkout-flow.md) | Stripe Price + checkout + upgrade akışı |
| 22 | [child-role.md](./22-child-role.md) | CHILD rolü özel davranış (finansal görmez, kendi adres) |
| 23 | [shared-services.md](./23-shared-services.md) | `paidByUserId` + `assignedUserIds` modeli |
| 24 | [family-budget-consolidated.md](./24-family-budget-consolidated.md) | Aile bütçe görünümü |
| 25 | [family-reminders-consolidated.md](./25-family-reminders-consolidated.md) | Aile çapında hatırlatıcı feed |

### Pro Tier (30–41)

| # | Dosya | Açıklama |
|---|---|---|
| 30 | [pro-plan-definition.md](./30-pro-plan-definition.md) | Limit, fiyat, üç-persona positioning |
| 31 | [pro-checkout-flow.md](./31-pro-checkout-flow.md) | Stripe Price + checkout + Family→Pro upgrade |
| 32 | [address-labels.md](./32-address-labels.md) | `Address.label` (Home/Office/Rental/Vacation/Warehouse/Dorm) |
| 33 | [partner-hub-ui.md](./33-partner-hub-ui.md) | Provider × action browse + filter UI |
| 34 | [service-provider-action-registry.md](./34-service-provider-action-registry.md) | `ServiceProviderAction` modeli + seed strategy |
| 35 | [partner-sync-attempts.md](./35-partner-sync-attempts.md) | `PartnerSyncAttempt` tracking model |
| 36 | [partner-deep-link-launcher.md](./36-partner-deep-link-launcher.md) | "Open & Update →" UX (clipboard + new tab + done) |
| 37 | [partner-pdf-letter-generator.md](./37-partner-pdf-letter-generator.md) | PDF mektup üretici (doktor/küçük utility) |
| 38 | [partner-mailto-templates.md](./38-partner-mailto-templates.md) | mailto: şablon kütüphanesi |
| 39 | [vendor-contact-book.md](./39-vendor-contact-book.md) | Kullanıcının özel partner template kaydı |
| 40 | [tax-property-export.md](./40-tax-property-export.md) | Vergi/mülk CSV/PDF export |
| 41 | [move-history-timeline.md](./41-move-history-timeline.md) | Geçmiş taşınma timeline'ı |

### Partner Faz 2 İskeletleri (45–46)

| # | Dosya | Açıklama |
|---|---|---|
| 45 | [partner-consent-skeleton.md](./45-partner-consent-skeleton.md) | `PartnerConsent` modeli (OAuth/API anlaşması geldiğinde aktif) |
| 46 | [partner-claim-skeleton.md](./46-partner-claim-skeleton.md) | Partner self-onboarding (disabled iskelet) |

### Admin (50–54)

| # | Dosya | Açıklama |
|---|---|---|
| 50 | [admin-workspace-inspector.md](./50-admin-workspace-inspector.md) | Destek tool: workspace + üye görüntüleme |
| 51 | [admin-provider-actions-crud.md](./51-admin-provider-actions-crud.md) | Provider action ekleme/düzenleme UI |
| 52 | [admin-provider-csv-import.md](./52-admin-provider-csv-import.md) | Toplu provider + action import |
| 53 | [admin-sync-attempts-dashboard.md](./53-admin-sync-attempts-dashboard.md) | Broken URL / dead mailto tespit |
| 54 | [admin-partner-claim-queue.md](./54-admin-partner-claim-queue.md) | Claim onay kuyruğu (disabled iskelet) |

### Çapraz Kesen Konular (60–67)

| # | Dosya | Açıklama |
|---|---|---|
| 60 | [mobile-billing-readonly.md](./60-mobile-billing-readonly.md) | Mobile read-only entitlement + IAP product ID config |
| 61 | [pricing-page-update.md](./61-pricing-page-update.md) | Marketing pricing 4 sütun yapısı |
| 62 | [subscription-plan-field-updates.md](./62-subscription-plan-field-updates.md) | `Subscription.plan` enum genişletme |
| 63 | [entitlement-banners-empty-states.md](./63-entitlement-banners-empty-states.md) | Plan gate, expired, seat overflow UI mesajları |
| 64 | [marketing-copy-updates.md](./64-marketing-copy-updates.md) | Anasayfa, FAQ, blog güncellemeleri |
| 65 | [analytics-events.md](./65-analytics-events.md) | Plan upgrade, partner action completion event'leri |
| 66 | [email-templates.md](./66-email-templates.md) | Invite, owner-sub-expired, partner-action-reminder mailleri |
| 67 | [i18n-tr-en.md](./67-i18n-tr-en.md) | TR/EN string envanteri |

---

## Lansman özet zaman çizelgesi

| Sprint | Hafta | Backend / DB | Web | Mobile | Admin |
|---|---|---|---|---|---|
| 1 | 1–2 | Workspace, Member, Invitation, migration, entitlements | Switcher iskelet | IAP product ID setup | Workspace inspector |
| 2 | 3–4 | AddressChangeEvent + Target, step-up challenge | Member UI, switcher canlı | Invite accept deep-link | Provider Actions CRUD + CSV |
| 3 | 5–6 | ServiceProviderAction seed (50 partner), PartnerSyncAttempt | Partner Hub + wizard | Launcher + queue | Sync attempts dashboard |
| 4 | 7–8 | Stripe Prices, gate'ler, conflict guard, PartnerConsent skeleton | Pricing 4 sütun + export | Read-only entitlement + invite kabul | Partner claim iskelet (disabled) + QA |

---

## Cross-cutting non-negotiable'lar

Her feature doc'unun **Güvenlik** bölümünde aşağıdakileri açıkça cevaplaması beklenir:

- Step-up auth gerekli mi?
- PII redaction nasıl?
- Audit log yazılır mı, nereye?
- Rate limit gerekiyor mu?
- Permission matris hangi rolleri kapsar?
- Encryption at rest gerekiyor mu?
- GDPR DSAR + erase için temas noktası?

Eksik bırakan doc reject edilir.
