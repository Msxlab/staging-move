# SHADOW Pilot Runbook — connector'ı canlıda güvenle ilk kez açma

> Amaç: USPS'i **SHADOW** modda koşup tek bir QA consent'i üzerinden dry-run kanıtı almak,
> dry-run güvenliğini (gerçek COA gitmiyor) kanıtlamak, sonra kapatmak. **Gerçek USPS agreement GEREKMEZ** —
> SHADOW dry-run gerçek push yapmaz. Mevcut kodda `FEATURE_API_CONNECTORS` global runtime/env switch'tir;
> per-user `USER_LIST` hedefleme yapmaz. Bu yüzden canlı pilotu staging'de veya kısa, izlenen bir production penceresinde koş.

---

## 0) Ön koşullar
- Foundation canlı (3 migration uygulanmış — ✅ deploy'da yapıldı).
- Bir **test hesabı** (örn. `mobile.qa@locateflow.com` veya ayrı bir QA kullanıcısı). Gerçek kullanıcıda yapma.
- Admin erişimi (ConnectorConfig + FeatureFlag + PartnerConsent yönetimi).

## 1) Master switch'i bilinçli aç
- `FEATURE_API_CONNECTORS=true` / `1` Runtime Config veya env olarak **global** açılır.
- Bu switch per-user değildir; eligible kullanıcıların Connections yüzeyini etkileyebilir.
- Production pilot için öneri: kısa izlenen pencere, önceden rollback hazır, `ConnectorConfig.stage=SHADOW`, `rolloutPercent=0`, sadece QA kullanıcısında `PartnerConsent`.
- Eğer gerçekten tek kullanıcıya master flag açmak istiyorsan önce kodda user-targeted gating eklenmeli.

## 2) USPS control-plane satırı (SHADOW)
- `ConnectorConfig` (usps): `enabled=true`, `stage=SHADOW`, `circuitState=CLOSED`, `rolloutPercent=0`.
- `agreementStatus=PRODUCTION` gerekmez; SHADOW runtime dry-run sadece push-capable adapter'ı çalıştırır ve partner `push()` çağrısını yapmaz.
- User Connections UI bu durumda `API_SYNC` değil `COMING_SOON`/guided davranabilir; bu normaldir.

## 3) Test hesabı için GRANTED consent
İki yol:
- **A (staging/özel QA):** USPS sandbox OAuth creds konfigüre et → test hesabı consent verir.
- **B (production SHADOW için daha kontrollü):** Admin/script ile sadece QA kullanıcısı için `PartnerConsent` satırı ekle: `userId=<test>`, `connectorKey="usps"`, `status="GRANTED"`, `scopesJson="[]"`, `consentSnapshotJson="{}"`, `grantedAt=now`. Token dry-run'da kullanılmaz; yine de satırı pilot bitince temizle.

## 4) Tetikle: adres değişimi
- Test hesabıyla **primary adresi değiştir** (eski + yeni dolu olsun; USPS `requiresOrigin`).
- Bu `enqueueAddressChange`'i çağırır → 1 `AddressChangeEvent` + 1 `ConnectorDispatch` (`isShadow=true`, `status=QUEUED`).

## 5) İşlet
- Connector dispatch cron'unu bekle ya da `/api/cron/connector-dispatch`'i **CRON_SECRET ile** tetikle.
- `runDispatchRow` → `stage=SHADOW` → `dryRun=true` → executor `push()`'u **atlar**.

## 6) DOĞRULA (beklenenler)
- [ ] `ConnectorDispatch`: `isShadow=true`, `status=CONFIRMED`, `resultMetadataJson.shadow=true`
- [ ] **USPS'te gerçek COA YOK** (USPS hesabında/sandbox'ta hiçbir filing görünmez)
- [ ] Kullanıcıya **bildirim gitmedi** (in-app/email yok)
- [ ] `AddressChangeEvent.dispatchCount` real push'ları sayıyor → shadow olduğu için **0** (veya real olmayan)
- [ ] `GET /api/connectors/changes` (test hesabı auth) → event görünür ama **shadow dispatch listede YOK** (`isShadow:false` filtresi)
- [ ] Şifreli alanlar (payload/confirmation) response'ta YOK

## 7) Kapat (pilot sonrası)
- `ConnectorConfig.usps.enabled=false` (veya satırı sil).
- `FEATURE_API_CONNECTORS` → pilot için açıldıysa kapat veya önceki değerine döndür.
- Test consent'ini revoke et / sil.

## 8) Ne ZAMAN gerçek push (stage=GA)?
**Sadece** gerçek USPS authorized-agent agreement + PRODUCTION credentials + `agreementStatus=PRODUCTION` olduğunda. O zaman `stage=GA` → gerçek COA dosyalanır. Bu **gerçek bir adres değişikliği** → sadece gerçek taşınan bir test hesabıyla.

---

## Güvenlik notları
- SHADOW prod'da düşük risk (gerçek push yok) ama master switch globaldir; başka kullanıcı yüzeyi etkilenmesin diye pilotu staging'de veya kısa, izlenen production penceresinde yap.
- Kill-switch her an: `ConnectorConfig.enabled=false` → tüm dispatch fallback'e drenaj.
- Çıkışta flag + config + consent'i temizlemeyi unutma.
