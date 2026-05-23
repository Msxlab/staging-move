# Step-Up Auth Flow

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Infrastructure
- **Related decisions**: D10, D19
- **Related docs**: [15](./15-workspace-auth-challenge.md), [11](./11-address-change-event-model.md), [13](./13-address-change-wizard-web.md), [18](./18-security-checklist.md)

## Amaç

Kullanıcı tipine göre uygun fresh-auth challenge'ını sunan ve `WorkspaceAuthChallenge` (→ 15) lifecycle'ını UI/API tarafında yöneten end-to-end akış. Web modal, mobile screen; backend create + verify endpoint'leri; password user / MFA-enabled / OAuth-only kullanıcılar için farklı yöntem.

Akış D10 kapsamında: event-level tek challenge, 10 dakika pencere, sonraki action'lar ek challenge istemez (D19).

## Kapsam

**In scope**
- POST `/api/auth/challenge` (create)
- POST `/api/auth/challenge/:id/verify` (verify)
- Web `<StepUpChallenge>` modal component
- Mobile `StepUpChallengeScreen`
- Per user type method selection (password / TOTP / email OTP)
- Biometric integration (mobile)
- OAuth-only fallback + "set password" upsell
- Rate limiting

**Out of scope**
- Challenge tablosu (→ 15)
- Hangi mutation hangi purpose ile çağrılır (→ 11, 17 vd.)

## User stories

- **As a password user**: Submit'e basarım, modal açılır, parolamı yazarım, doğrularım, event yaratılır.
- **As an MFA user**: Submit'e basarım, modal "6 haneli kod" sorar, Authenticator'dan yazarım.
- **As an OAuth-only (Google) user**: Submit'e basarım, modal "Set a password to skip these prompts" mesajı + email OTP'den biriyle ilerle seçeneği.
- **As a mobile user with FaceID**: Submit'e basarım, FaceID prompt → secure enclave'den parolayı al → server-side verify.
- **As an attacker with stolen session**: Submit'e basarım, parolayı bilmediğim için 5 kez yanlış girer → challenge invalidate, rate limit hit.

## Veri modeli

15'teki `WorkspaceAuthChallenge` tablosu. Bu doc yeni schema eklemez.

**User type detection** (server `apps/web/src/lib/auth.ts` extend):

```ts
function detectChallengeMethods(user: User): AuthChallengeMethod[] {
  const methods: AuthChallengeMethod[] = [];
  if (user.mfaEnabled && user.mfaSecret) methods.push('TOTP');
  if (user.passwordHash) methods.push('PASSWORD');
  if (methods.length === 0) methods.push('EMAIL_OTP'); // OAuth-only fallback
  return methods;
}
```

İlk-tercih sırası: TOTP > PASSWORD > EMAIL_OTP. UI çoklu method tek sefer gösterir (örn. MFA user istisnaen TOTP yerine password seçebilsin diye "Use password instead" link).

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/auth/challenge` | Session | required (workspaceId body'de) | `{ workspaceId, purpose: 'ADDRESS_CHANGE' \| ..., preferredMethod?: 'PASSWORD' \| 'TOTP' \| 'EMAIL_OTP' }` | `201 { challengeId, method, expiresAt, availableMethods }` | 401, 403 (no workspace role), 429 (rate limit) |
| POST | `/api/auth/challenge/:id/verify` | Session | derived | `{ code?: string, password?: string }` | `200 { ok: true, consumeToken: string, expiresAt }` | 400 (invalid input), 401, 403 (not owner), 410 (expired/consumed), 429 (max attempts) |

Yanıtın `consumeToken` alanı: action POST'unda `authChallengeId` olarak kullanılmaz **doğrudan**; client zaten challengeId'yi bilir. `consumeToken` ek bir HMAC (challengeId + userId + verifiedAt secret-signed) — kötü niyetli client'a karşı extra layer. Action endpoint hem challengeId hem consumeToken doğrular.

**Implementation karar**: MVP'de `consumeToken` opsiyonel; sadece challengeId yeter (HMAC eklemek Faz 2 — basitlik vs. defence-in-depth tradeoff. Risk: client-side compromise senaryosunda saldırgan challengeId'yi de görür zaten, HMAC marjinal değer).

### EMAIL_OTP detay

Create endpoint EMAIL_OTP method seçilirse:
1. 6-haneli random kod üret
2. `challengeHash = bcrypt(code)` ile DB'ye yaz
3. Email gönder (transactional template `step-up-otp-email.tsx`): "Your verification code: 123456 — expires in 10 minutes"
4. Rate limit: 3 EMAIL_OTP challenge / saat per user (15'te belirtildi)

Verify EMAIL_OTP:
- Body'de `code` field; bcrypt compare hash ile
- 5 yanlış → invalidate

### PASSWORD verify

- Body'de `password` field
- `bcrypt.compare(password, user.passwordHash)`
- 5 yanlış → invalidate + audit `password_step_up_failed`

### TOTP verify

- Body'de `code` field (6-digit)
- TOTP library (otplib) `authenticator.verify({ token: code, secret: decrypt(user.mfaSecret) })`
- Window: ±1 (allow 30s drift)
- 5 yanlış → invalidate

### Mevcut endpoint'lere etki

- `/api/address-changes` POST — `authChallengeId` body'de zorunlu (→ 11)
- `/api/workspaces/:id/members/:userId` DELETE — `authChallengeId` body'de zorunlu (purpose=MEMBER_REMOVE)
- `/api/workspaces/:id` DELETE — `authChallengeId` zorunlu (purpose=WORKSPACE_DELETE)
- `/api/billing/checkout` POST — `authChallengeId` zorunlu (purpose=BILLING_CHANGE; Faz 2 toggleable)

## Web

### Yeni component

**`<StepUpChallenge>`** (`apps/web/src/components/auth/StepUpChallenge.tsx`)

Props:
```ts
type Props = {
  isOpen: boolean;
  purpose: AuthChallengePurpose;
  workspaceId: string;
  onSuccess: (challengeId: string) => void;  // returns consumed challenge id
  onCancel: () => void;
};
```

State machine:
```
IDLE → CREATING → AWAITING_INPUT → VERIFYING → SUCCESS | ERROR
                                              ↘ ERROR_MAX_ATTEMPTS (terminal)
```

UI:
- Modal title: purpose-specific copy ("Confirm this address change", "Confirm member removal")
- Method selector (if multiple available): radio
- For PASSWORD: password input, "Forgot? Reset" link → opens new tab `/forgot-password`
- For TOTP: 6-digit input (auto-advance), "Use backup code" link
- For EMAIL_OTP:
  - First render → "Send code to me@example.com" button
  - After send → 6-digit input + "Resend (in 60s)" timer
- Footer: "Cancel" button
- Error: inline red text under input

Edge case copies:
- 410 expired: "Your verification expired. We'll create a new one." → auto-reset to AWAITING_INPUT after re-CREATE
- 429: "Too many attempts. Please try again in N minutes." → onCancel'la kapat
- OAuth-only user: top banner "Set a password to skip these prompts" + link

### Mevcut sayfalara etki

- Wizard Step 4 (→ 13): `<StepUpChallenge>` mount.
- Member remove confirm: aynı modal purpose=MEMBER_REMOVE.
- Workspace settings → delete: aynı modal.
- Billing checkout button: opsiyonel (D10 BILLING_CHANGE — MVP'de açık).

## Mobile

### Yeni ekran

**`StepUpChallengeScreen`** (`apps/mobile/src/screens/StepUpChallengeScreen.tsx`) — modal-style screen.

Akış benzer; ek olarak biometric integration:

### Biometric flow (mobile)

`expo-local-authentication` zaten varsa:

1. Screen yüklendi, user PASSWORD method'a sahip
2. Cihazda biometric mevcut + user bir önceki oturumda "Enable biometric for security prompts" toggle'ı açtıysa:
   - `LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm address change' })`
   - Başarılı → secure storage'dan saklanan password fetch edilir (`expo-secure-store`)
   - Password backend'e POST /verify ile gönderilir
3. Başarısız veya biometric yok → standart password input fallback

**Önemli**: Biometric **LOCAL** unlocktur. Server-side verify hâlâ password/TOTP ile yapılır. Pure local biometric server için yeterli değil çünkü compromised device'da bypass edilebilir; server-side proof zorunlu. Bu pattern banking apps standardıdır.

Secure storage:
- `expo-secure-store` keychain/Keystore'a `auth_step_up_password_v1` key altında encrypted (OS-level). Kullanıcı opt-in.
- Logout'ta clear.
- Password change'de clear (re-prompt enable).

### Mevcut ekranlara etki

- Mobile wizard yok (Sprint 2 web-only); ama member remove ekranında step-up tetiklenebilir.

### Componentler

- **`<BiometricPrompt>`** wrapper — biometric-or-fallback orchestration.

## Admin

### Yeni sayfa

- 15'teki `/admin/auth-challenges` sayfası, bu doc admin yetkisi tarafı yok.

### Yetenekler

- Yok bu doc'ta.

## Güvenlik

- [x] **Step-up auth**: Bu **kendisi** step-up flow.
- [x] **PII redaction**: Email OTP email body'sinde kod plaintext (zorunlu UX); transit TLS, at rest hash. Password verify log'da plaintext yazılmaz (Zod parse sonrası middleware strip).
- [x] **Audit log**: 15'teki 4 action (create/verify_success/verify_fail/consume).
- [x] **Rate limit**:
  - Create: 10/saat per user (toplam tüm purpose'lar)
  - EMAIL_OTP create: 3/saat per user (ek sıkı limit)
  - Verify: 5 attempt per challenge (row-level)
  - Verify endpoint global: 30/dakika per IP — `apps/web/src/lib/rate-limit.ts` keyed `step-up-verify:ip:${ip}`
- [x] **Permission matris**: Kullanıcı kendi adına challenge yaratır; başkasının challenge'ını verify edemez (session.userId === challenge.userId).
- [x] **Encryption at rest**: `challengeHash` bcrypt. Mobile secure storage OS-level encrypted.
- [x] **GDPR DSAR**: 15 ile aynı.

### Failure handling matrix

| Hata | UI mesaj | Action |
|---|---|---|
| Network down | "Connection issue, try again" | retry buton |
| 401 session expired | Redirect /login + flash message | session cleanup |
| 403 not in workspace | "Access denied" + close modal | — |
| 410 challenge expired | "Verification expired, restarting…" + auto re-create | seamless retry |
| 410 challenge consumed (race) | "Already verified — proceeding" + onSuccess | tolerate |
| 429 max attempts | "Too many attempts, wait N minutes" + close | block |
| 429 rate limit global | "Too many security prompts, try again later" | block |
| 500 server | "Something went wrong" + report button | manual |

## Migration / backward compat

- Yeni endpoint'ler; mevcut akışlar etkilenmez (ta ki action endpoint'ler `authChallengeId` zorunlu yapana kadar).
- Feature flag `FEATURE_STEP_UP_AUTH` — off ise action endpoint'ler challenge bypass kabul eder (sadece dev/test için; production zorunlu).

## Etkilenen mevcut özellikler

- `apps/web/src/lib/auth.ts` — `detectChallengeMethods` helper eklenir.
- `apps/web/src/lib/audit.ts` — yeni action constants.
- Email transactional templates — yeni `step-up-otp-email.tsx`.
- Workspace settings → delete: confirm modal'a step-up entegre.
- Workspace members → remove: confirm modal'a step-up entegre.
- Billing checkout: optional step-up entegre.

## Test plan

**Unit**
- `detectChallengeMethods` her user type kombinasyonu
- TOTP verify with valid code / invalid / drifted
- Bcrypt password compare
- Email OTP generate uniqueness (entropy)

**Integration**
- Create challenge → verify with wrong password 5x → 410
- Create EMAIL_OTP → email queued (mock) → verify with code in DB hash → consume
- Action endpoint with invalid challengeId → 403
- Action endpoint with already-consumed challengeId → 409
- Concurrent verify race → only 1 success

**E2E (Playwright)**
- Password user wizard submit → modal opens → enter password → success → event yaratılır
- TOTP user wizard submit → modal asks for code → 123456 → success
- OAuth-only user → modal shows "set password" banner + email OTP fallback button → flow completes
- Wrong password 5x → modal locks → close button
- Mobile (Detox): biometric mock → success → bypass password input

**Manual**
- Real password user end-to-end
- Real MFA user (with Authenticator app)
- Real OAuth Google user (no password set)
- Email OTP arrival timing (<1 min)
- Mobile FaceID device

## Açık sorular

1. `consumeToken` HMAC MVP'de var mı yok mu? **Karar önerisi**: Yok MVP. Faz 2'de defence-in-depth review.
2. Biometric opt-in default açık mı kapalı mı? **Karar önerisi**: Kapalı; kullanıcı Settings → Security'den açar.
3. MFA backup code MVP'de step-up'ta kabul edilir mi? **Karar önerisi**: Evet, TOTP method altında "Use backup code" link, mevcut backup code verify reuse.
4. EMAIL_OTP'nin SMS alternatifi MVP'de var mı? **Karar önerisi**: Hayır; SMS provider entegrasyonu (Twilio vd.) ekstra cost + abuse vector. Faz 2.
5. Step-up sırasında session refresh/keep-alive yapılır mı? **Karar önerisi**: Evet, verify success session activity timestamp günceller (auto-lockout dakika sayacı sıfırlanır).
