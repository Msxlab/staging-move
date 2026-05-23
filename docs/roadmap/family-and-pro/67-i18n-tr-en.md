# i18n — TR / EN String Inventory

- **Status**: Proposed (Family/Pro launch, per-sprint addition)
- **Tier**: Cross-cutting
- **Related decisions**: D1 (workspace labels), D20 (pricing labels)
- **Related docs**: [61](./61-pricing-page-update.md), [63](./63-entitlement-banners-empty-states.md), [64](./64-marketing-copy-updates.md), [66](./66-email-templates.md)

## Amaç

Family/Pro lansmanı kapsamında eklenen tüm UI string'leri için TR + EN translation envanteri, key naming convention, plural form yönetimi, shared-key strategy (web + mobile), QA workflow tanımlamak. **Workspace, billing, partner-hub, address-change, banners, emails** alanları kapsanır.

## Önemli uyarı: TR henüz repo'da yok

Mevcut codebase **`en` + `es`** locale'lerini taşıyor:
- `apps/web/src/i18n/messages/{en,es}.json`
- `apps/mobile/src/i18n/messages/{en,es}.json`

User-facing TR locale **şu an aktif değil**. Bu doc, kullanıcı brief'ine uyarak TR ↔ EN inventory'sini hazırlar, ama **lansman scope'u kararı** açık sorudur:

- **Opsiyon A** (Faz 1): TR locale dosyalarını yarat (`tr.json`), TR çevirileri infrastructure'a ekle, language switcher'da TR option çıkar.
- **Opsiyon B** (Faz 1.5): Sadece EN string'leri Family/Pro için ekle, ES tutarlılığı koru, TR'yi Faz 2'ye al.
- **Opsiyon C**: EN + ES + TR üçü paralel (mevcut iki dile TR eklerken Family/Pro string'leri de aynı anda).

Bu doc **Opsiyon C** varsayar (en kapsamlı). Cross-ref Açık sorular #1.

## Kapsam

**In scope**
- Yeni string'lerin **key naming convention** (Family/Pro genişlemeleri için)
- Tüm yeni feature alanları için key envanter (workspace, partner-hub, address-change, billing, banners, emails)
- Plural form (1 member / N members) handling — Intl.PluralRules
- Date/currency formatting — Intl.NumberFormat (USD), Intl.DateTimeFormat
- Shared keys: web + mobile common (örnek: role labels) için `packages/shared/src/i18n-keys.ts`
- RTL: not supported (US-only product, EN/ES/TR LTR yeterli)
- Locale persistence (mevcut user preference DB field, değişmez)
- QA checklist + lint rule önerisi (hardcoded string detection)
- Translation workflow PR pattern

**Out of scope**
- Mevcut EN/ES string'lerinin retranslate'i
- Marketing kopya (cross-ref 64 — copy team scope'u)
- Email template body çevirisi içerikçe (cross-ref 66 — template seed'de yer alır)
- RTL support, Arabic, etc.
- Translation memory / TMS entegrasyonu (Lokalise/Phrase — Faz 2)

## User stories

- **US-67.1** — TR user mobile app açar; settings > language "Türkçe" seçer; tüm yeni Family/Pro string'leri TR render olur.
- **US-67.2** — Developer yeni component yazıyor; "Invite member" hardcoded string'i geçirmeye çalışırsa ESLint rule uyarı verir; key olarak `workspace.members.invite_button` kullanmaya yönlendirir.
- **US-67.3** — TR/EN review PR'ı geliyor; yeni 50 key için her iki dil mevcut; reviewer plural form'larını TR'de doğru tradusyon görür ("1 üye" / "{n} üye").
- **US-67.4** — Family plan paylaşımı için "6 members" → TR "6 üye" / EN "6 members" — plural fallback EN sayı/birim, TR -ler eki yok (sayı sabit, doğru).

## Veri modeli

N/A — pure string envanteri. Mevcut i18n infrastructure (`apps/web/src/i18n/config.ts` + `messages/*.json`) yeterli.

User locale persist: `User.preferredLocale` (varsa, yoksa eklenir) `String @db.VarChar(8)` default `"en"`. Login sonrası `next-intl` veya equivalent middleware locale'i okur.

## API endpoint'leri

Yeni endpoint yok. Mevcut `GET /api/profile` `preferredLocale` döner; `PUT /api/profile` set eder.

## Key naming convention

```
{feature_area}.{ui_element}[.{state}|.{variant}]
```

Örnekler:
- `workspace.members.role.OWNER` (label)
- `workspace.members.invite_button` (button label)
- `workspace.invite.accept_cta` (CTA)
- `partner_hub.action.open_and_update` (button)
- `partner_hub.action.mark_done` (status action)
- `address_change.wizard.scope.USER` (scope option label)
- `billing.plan.FAMILY.display_name` (plan label — şared with `BILLING_PLAN_DEFINITIONS`)
- `banner.upgrade_prompt.title` (template)
- `banner.upgrade_prompt.cta_upgrade` (button)
- `email.workspace_invitation.subject` (email subject — uses Mustache, key only for env)

Kurallar:
1. snake_case key segmenti
2. Domain (workspace, billing, partner_hub, address_change, banner, email)
3. UI element (button, label, title, description, error, placeholder)
4. State/variant ALL_CAPS enum benzeri (`OWNER`, `FAMILY`)
5. Dynamic value `{var}` ICU MessageFormat syntax (next-intl uyumlu)

## Shared keys strategy

**`packages/shared/src/i18n-keys.ts`** (yeni) — web + mobile arası ortak key constants:

```ts
export const WORKSPACE_ROLE_KEYS = {
  OWNER: "workspace.members.role.OWNER",
  ADMIN: "workspace.members.role.ADMIN",
  MEMBER: "workspace.members.role.MEMBER",
  CHILD: "workspace.members.role.CHILD",
  VIEW_ONLY: "workspace.members.role.VIEW_ONLY",
} as const;

export const BILLING_PLAN_KEYS = {
  FREE_TRIAL: "billing.plan.FREE_TRIAL",
  INDIVIDUAL: "billing.plan.INDIVIDUAL",
  FAMILY: "billing.plan.FAMILY",
  PRO: "billing.plan.PRO",
} as const;
```

Hem `apps/web/src/...` hem `apps/mobile/src/...` import eder. Tek değişiklik yerinden yapılır; mismatch riski yok.

Her dilin JSON'ında karşılığı tanımlı:

```jsonc
// apps/web/src/i18n/messages/en.json
{
  "workspace.members.role.OWNER": "Owner",
  "billing.plan.FAMILY": "Family",
  ...
}
```

```jsonc
// apps/web/src/i18n/messages/tr.json (yeni)
{
  "workspace.members.role.OWNER": "Sahip",
  "billing.plan.FAMILY": "Aile",
  ...
}
```

Web/mobile message dosyaları sembolik link **değil**, paralel kopyalar (Expo bundler / Next.js bundler ayrı). Eşitlik için lint script: `scripts/i18n-diff.ts` — web ve mobile JSON'lar farklılaştıysa CI uyarır.

## String envanter (TR + EN)

Aşağıda yeni eklenen alanlar için **örnek key'ler + TR/EN** karşılıkları. Tam envanter çıkarılan PR'da `messages/en.json` + `messages/tr.json` diff'inde görünür; bu tablo dokümantasyon için temsili (~80 key, gerçek toplam 200–300).

### Workspace — members, roles, invitations

| Key | EN | TR |
|---|---|---|
| `workspace.label.PERSONAL` | My Move | Taşınmam |
| `workspace.label.FAMILY` | Household | Hanem |
| `workspace.label.PRO` | Workspace | Çalışma Alanı |
| `workspace.members.role.OWNER` | Owner | Sahip |
| `workspace.members.role.ADMIN` | Admin | Yönetici |
| `workspace.members.role.MEMBER` | Member | Üye |
| `workspace.members.role.CHILD` | Child | Çocuk |
| `workspace.members.role.VIEW_ONLY` | View only | Sadece görüntüleme |
| `workspace.members.invite_button` | Invite member | Üye davet et |
| `workspace.members.remove_confirm` | Remove {name} from {workspace}? | {name} kişisini {workspace}'den kaldır? |
| `workspace.members.count` | `{n, plural, =0 {No members} one {1 member} other {# members}}` | `{n, plural, =0 {Üye yok} other {# üye}}` |
| `workspace.members.seat_label` | {active} of {total} active{overflow, plural, =0 {} other {, # overflow}} | {active}/{total} aktif{overflow, plural, =0 {} other {, # taşma}} |
| `workspace.switcher.button_aria` | Switch workspace | Çalışma alanını değiştir |
| `workspace.switcher.create_new` | Create new workspace | Yeni çalışma alanı oluştur |
| `workspace.invite.accept_cta` | Accept invitation | Davetı kabul et |
| `workspace.invite.expired_title` | This invitation expired | Bu davet süresi doldu |
| `workspace.invite.role_description.MEMBER` | Members can manage their own services and addresses. | Üyeler kendi hizmet ve adreslerini yönetebilir. |
| `workspace.invite.role_description.CHILD` | Children manage their own data; financial info is hidden by default. | Çocuklar kendi verilerini yönetir; finansal bilgiler varsayılan olarak gizlidir. |

### Billing — plan names, pricing labels

| Key | EN | TR |
|---|---|---|
| `billing.plan.FREE_TRIAL` | Free Trial | Ücretsiz Deneme |
| `billing.plan.INDIVIDUAL` | Individual | Bireysel |
| `billing.plan.FAMILY` | Family | Aile |
| `billing.plan.PRO` | Pro | Pro |
| `billing.plan.FAMILY.short_description` | One workspace for your whole household. | Tüm hanen için tek çalışma alanı. |
| `billing.plan.PRO.short_description` | Built for landlords and property managers. | Mülk sahipleri ve yöneticileri için. |
| `billing.interval.monthly` | per month | aylık |
| `billing.interval.yearly` | per year | yıllık |
| `billing.savings.percent` | save {percent}% | %{percent} tasarruf |
| `billing.cta.start_with_plan` | Start with {planName} | {planName} ile başla |
| `billing.cta.upgrade_to_plan` | Upgrade to {planName} | {planName}'a yükselt |
| `billing.cta.current_plan` | Current plan | Mevcut planın |
| `billing.cta.manage_on_web` | Manage on web | Web'den yönet |
| `billing.cta.manage_on_app_store` | Manage on App Store | App Store'dan yönet |
| `billing.cta.manage_on_play_store` | Manage on Google Play | Google Play'den yönet |
| `billing.ios_conflict.title` | Subscription managed in App Store | Abonelik App Store'dan yönetiliyor |
| `billing.ios_conflict.body` | To switch to {planName}, first cancel in App Store > Subscriptions, then upgrade here once your current plan expires. | {planName}'a geçmek için önce App Store > Abonelikler'den iptal et, mevcut planın bittikten sonra buradan yükselt. |

### Partner Hub

| Key | EN | TR |
|---|---|---|
| `partner_hub.title` | Partner Hub | Partner Merkezi |
| `partner_hub.subtitle` | Update your address with 100+ providers. | Adresini 100+ sağlayıcıda güncelle. |
| `partner_hub.action.open_and_update` | Open & Update → | Aç ve Güncelle → |
| `partner_hub.action.mark_done` | Mark as done | Tamamlandı işaretle |
| `partner_hub.action.mark_failed` | Couldn't update | Güncellenemedi |
| `partner_hub.action.skip` | Skip this one | Bunu atla |
| `partner_hub.action.copy_to_clipboard` | Copy details | Bilgileri kopyala |
| `partner_hub.action.clipboard_copied` | Copied to clipboard | Panoya kopyalandı |
| `partner_hub.status.PENDING` | Not started | Başlanmadı |
| `partner_hub.status.OPENED` | In progress | Devam ediyor |
| `partner_hub.status.DONE` | Completed | Tamamlandı |
| `partner_hub.status.FAILED` | Failed | Başarısız |
| `partner_hub.status.SKIPPED` | Skipped | Atlandı |
| `partner_hub.filter.all` | All providers | Tüm sağlayıcılar |
| `partner_hub.filter.utility` | Utilities | Hizmetler |
| `partner_hub.filter.government` | Government | Devlet |
| `partner_hub.empty.no_results` | No providers match your filters. | Filtrelere uyan sağlayıcı yok. |

### Address Change Wizard

| Key | EN | TR |
|---|---|---|
| `address_change.wizard.title` | Start a move | Taşınma başlat |
| `address_change.wizard.scope.USER` | I'm moving — update my services | Ben taşınıyorum — hizmetlerimi güncelle |
| `address_change.wizard.scope.ADDRESS` | An address is changing — update services at that address | Bir adres değişiyor — o adresteki hizmetleri güncelle |
| `address_change.wizard.scope.CUSTOM` | Custom — I'll pick services manually | Özel — hizmetleri ben seçeceğim |
| `address_change.wizard.target_count` | `{n, plural, one {1 service to update} other {# services to update}}` | `{n, plural, other {Güncellenecek # hizmet}}` |
| `address_change.wizard.step_up_required` | Confirm your identity to start the move | Taşınmayı başlatmak için kimliğini doğrula |
| `address_change.event.completed_summary` | Done — {done} updated, {skipped} skipped, {failed} failed. | Bitti — {done} güncellendi, {skipped} atlandı, {failed} başarısız. |

### Banners — entitlement, owner expired, seat overflow

| Key | EN | TR |
|---|---|---|
| `banner.upgrade_prompt.title` | {feature} is a {plan} feature | {feature}, {plan} planına özel |
| `banner.upgrade_prompt.cta_upgrade` | Upgrade | Yükselt |
| `banner.upgrade_prompt.cta_learn_more` | Learn more | Daha fazla |
| `banner.locked_feature.title` | {feature} requires {plan} | {feature} için {plan} gerekli |
| `banner.locked_feature.cta_see_plans` | See {plan} plan → | {plan} planını gör → |
| `banner.owner_sub_expired.title` | Workspace owner's subscription expired | Çalışma alanı sahibinin aboneliği sona erdi |
| `banner.owner_sub_expired.body` | Read-only access until {graceEndsAt}. {ownerName} can resubscribe to restore full access. | {graceEndsAt} tarihine kadar sadece görüntüleme. {ownerName} aboneliği yenileyebilir. |
| `banner.seat_overflow.title` | Member count exceeds plan limit | Üye sayısı plan limitini aşıyor |
| `banner.seat_overflow.body` | You have {active} active members but {plan} supports {allowed}. {overflow} member(s) keep access; no new invites until you upgrade or remove members. | {active} aktif üyen var ama {plan} {allowed} destekliyor. {overflow} üye erişimini koruyor; yükseltene veya üye kaldırana kadar yeni davet yok. |
| `banner.trial_ending.title` | `{days, plural, one {Trial ends tomorrow} other {Trial ends in # days}}` | `{days, plural, one {Deneme yarın bitiyor} other {Deneme # gün sonra bitiyor}}` |
| `banner.dismiss_label` | Dismiss | Kapat |

### Email subjects (referans — body cross-ref 66 template)

| Key | EN | TR |
|---|---|---|
| `email.workspace_invitation.subject` | You're invited to join {workspaceName} on LocateFlow | LocateFlow'da {workspaceName} çalışma alanına davetlisin |
| `email.workspace_invitation_reminder.subject` | Reminder: {inviterFirstName} is waiting for you on LocateFlow | Hatırlatma: {inviterFirstName} LocateFlow'da seni bekliyor |
| `email.workspace_owner_sub_expired.subject` | Action required: {ownerFirstName}'s subscription expired | İşlem gerekli: {ownerFirstName}'in aboneliği sona erdi |
| `email.partner_sync_followup.subject` | Did you finish updating your address with {providerName}? | {providerName} ile adres güncellemen tamamlandı mı? |
| `email.plan_upgraded_receipt.subject` | Welcome to {planDisplayName} — here's what's new | {planDisplayName}'a hoş geldin — yenilikler |

### Admin (intentionally NOT translated)

Admin paneli (`apps/admin/`) **sadece internal English**. Türkçe veya İspanyolca admin localization yok — operations team English okur. Bu kurallı bir kısıtlama; admin code'da hardcoded English string kabul edilir.

## Plural forms

ICU MessageFormat (next-intl + react-i18next destekler):

```
{n, plural, =0 {No members} one {1 member} other {# members}}
```

TR plural rules:
- TR'de plural genelde tek form ("üye") — sayı önde olduğunda `-ler/-lar` eki düşer
- Intl.PluralRules `tr` locale `one` ve `other` kategorileri verir, ama UI'da çoğunlukla `other` kullanılır

EN plural rules:
- `=0`, `one`, `other` (3 kategori yeterli)

Test: her plural key için 0, 1, 2, 11, 100 değerleriyle render snapshot.

## Date / currency formatting

`Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })` — TR locale'inde de USD prefix `US$` veya suffix; karar: **TR locale'de de "$9.99" göster** (ürün US-only, fiyat USD, kullanıcı zihinsel kara uğraşmasın).

Tarih formatı:
- EN: `Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })` → "May 23, 2026"
- TR: `Intl.DateTimeFormat("tr-TR", { month: "short", day: "numeric", year: "numeric" })` → "23 May 2026"

Util `apps/web/src/lib/format.ts` (yoksa yaratılır) `formatCurrency()`, `formatDate()` exports.

## Translation workflow

1. Developer feature için yeni key ihtiyacı belirler
2. PR'da `apps/web/src/i18n/messages/en.json` ve `tr.json` (+ `es.json`) eşzamanlı update
3. CI lint: tüm key dilde mevcut mu (`scripts/i18n-diff.ts`); değilse fail
4. Reviewer TR/EN doğal mı kontrol (ideal: native speaker review)
5. Plural ve placeholder syntax doğru mu (ICU validator)
6. Mobile karşılığı paralel update — script veya manuel
7. Merge

**Translation memory yok** (Faz 2'de Lokalise/Phrase entegre). MVP'de manuel JSON.

## Hardcoded string lint

ESLint rule önerisi: `react/jsx-no-literals` ile JSX içinde literal string warning. Mevcutta varsa devam; yoksa eklenmesi önerilir. Exception list (`error`, technical strings) inline `eslint-disable-next-line` kabul.

Custom rule (Faz 2): `lf/no-untranslated-jsx-text` — sadece `{t("...")}` kabul, raw text reject.

## Web

### Yeni sayfa/route

`apps/web/src/i18n/messages/tr.json` (yeni dosya, Opsiyon A/C ise) — Family/Pro string'leri + mevcut EN key'lerinin TR karşılığı.

### Mevcut sayfalara etki

- `apps/web/src/i18n/config.ts` — `locales: ["en", "es"]` → `["en", "es", "tr"]` (Opsiyon A/C)
- `apps/web/src/components/marketing/marketing-header.tsx` (varsa language switcher) — TR option ekle
- Tüm yeni feature component'leri `useTranslations()` / `t()` ile çevrilmiş string kullanır

### Componentler (file paths)

```
apps/web/src/i18n/messages/en.json       // mevcut, genişler
apps/web/src/i18n/messages/es.json       // mevcut, genişler
apps/web/src/i18n/messages/tr.json       // YENİ (Opsiyon A/C)
apps/web/src/i18n/config.ts              // locale listesine TR ekle
packages/shared/src/i18n-keys.ts         // YENİ — shared key constants
scripts/i18n-diff.ts                     // YENİ — CI lint
```

### Butonlar / actionlar

Tüm CTA'lar `t("billing.cta.upgrade_to_plan", { planName: "Family" })` pattern'i ile çevirilir.

## Mobile

### Yeni ekran

N/A.

### Mevcut ekranlara etki

Aynı i18n key inventory mobile JSON'larına da uygulanır:

```
apps/mobile/src/i18n/messages/en.json     // mevcut, genişler
apps/mobile/src/i18n/messages/es.json     // mevcut, genişler
apps/mobile/src/i18n/messages/tr.json     // YENİ (Opsiyon A/C)
apps/mobile/src/i18n/config.ts            // locale list update
```

Mobile language switcher (`apps/mobile/app/settings/profile.tsx` veya `language.tsx`) TR option.

## Admin

Admin **intentionally not translated**. `apps/admin/` koduna i18n eklenmez.

## Güvenlik

- [x] **Step-up auth?** — N/A.
- [x] **PII redaction?** — String'lerde PII yok (tüm dynamic value `{var}` runtime'da gelir, source dosyada yok).
- [x] **Audit log?** — N/A.
- [x] **Rate limit?** — N/A.
- [x] **Permission matris?** — N/A.
- [x] **Encryption at rest?** — N/A.
- [x] **GDPR DSAR?** — User locale preference DSAR export'una dahil (single field, trivial).
- [x] **XSS hardening**: Çevirilerde HTML allowed değil; `{var}` raw render değil escaped (next-intl default). Email body sanitization cross-ref 66.

## Migration / backward compat

- Mevcut EN + ES key'leri korunur; yeni key'ler additive
- TR locale dosyası eklenmesi (Opsiyon A/C) breaking değil; locale list expand, fallback EN
- Mobile `i18next` default behavior: missing key fallback EN — TR henüz tam değilse partial OK

## Etkilenen mevcut özellikler

- Tüm yeni feature component'leri (cross-ref 02–46 docs) `t()` çağırır
- Mevcut `language-switcher` component TR option (varsa)
- Mevcut `format.ts` util yoksa yaratılır
- CI pipeline `i18n-diff.ts` script eklenir
- Storybook (varsa) — her component her dilde snapshot

## Test plan

**Unit**
- `scripts/i18n-diff.ts` — tüm dillerde aynı key set'i (CI test)
- Format util: `formatCurrency(9.99)` → "$9.99" her locale
- Plural: `{n, plural, ...}` 0, 1, 2, 11, 100 değerlerinde doğru
- Shared keys constants TS'de string literal type — typo runtime'da değil compile'da yakalanır

**Integration**
- `apps/web/src/components/marketing/pricing-section.tsx` 3 dilde render — text content snapshot
- `<UpgradePromptBanner>` her dilde doğru placeholder doldurur

**E2E**
- User language preference değiştirir → reload → UI dil değişimi tüm yeni feature sayfalarında

**Manual**
- TR native speaker review (PR template'inde checkbox: "TR reviewed by native speaker")
- ES native speaker review (mevcut süreç korunur)
- Visual: TR kelimeler EN'den uzun → button overflow check (örn. "Yükselt" kısa, "Çalışma Alanını Değiştir" uzun)
- a11y: `lang="tr"` HTML attribute doğru set

## Açık sorular

1. **Lansman scope kararı (kritik)**: TR locale Faz 1'de mi (Opsiyon C) yoksa Faz 2'ye mi (Opsiyon B) bırakılır? **Önerim**: Opsiyon B (EN + ES) MVP, TR Faz 2. Sebep: TR market henüz hedef değil, çeviri kalite yüksek tutulmalı, native speaker reviewer bandwidth limitli. Bu doc Opsiyon C için spec verir, kararı user'a bırakır.
2. **Mevcut `es` çevirileri quality**: ES çeviriler profesyonel mi yoksa Google Translate baseline mi? Yeni Family/Pro string'leri eklerken kalite seviyesi tutarlı olmalı.
3. **Workspace label TR**: "Hanem" yerine "Ailem" daha doğal mı? "Çalışma Alanı" Pro için doğru mu yoksa "Portföy" daha mı uygun (D1 also: Pro için future "Portfolio" denenebilir)?
4. **Plural form `_` separator**: ICU `=0`, `one`, `other` doğru ama bazı dev'ler i18next `member_one`, `member_other` syntax'ına alışkın. Standardize et.
5. **Email subject çevirisi**: 66'daki template'lerde subject EN+ES var; TR eklenirse + ES tutarlı kalmalı (üç dil paralel). Email infra hangi locale göndereceğine `User.preferredLocale`'a göre karar verir.
6. **Currency display TR**: "$9.99" mı "9,99 $" mu? US-only product için "$9.99" doğru (kullanıcı USD ile düşünür). Karar locked.
7. **`scripts/i18n-diff.ts`** mevcut mu? Yoksa Sprint 1'de yaratılır; CI gating gerekli.
8. **ESLint `react/jsx-no-literals`** rule aktif mi? Değilse aktive edilince mevcut 100+ violation çıkar; gradual adoption stratejisi gerekli.
9. **Mobile/web JSON mirror**: paralel dosyalar — drift riski. Shared package'a tüm string'leri alıp re-export etmek bundler'da çalışır mı? Expo + Next.js test gerekli, MVP'de paralel kopya + lint script.
