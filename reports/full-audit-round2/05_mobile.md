# SCOPE 5 — MOBİL (Expo) TAM DENETİM · Tur 2
Tarih: 2026-06-11 · Denetçi: otomatik tam-yığın denetim ajanı
Kaynak: yalnızca kod/şema/config dosyaları okundu (rapor/memory dosyaları girdi olarak KULLANILMADI).

## Yürünen Modül Haritası
- **Kök layout & guard'lar**: `app/_layout.tsx` (AuthGuard, deep link, bildirim tap yönlendirme, splash/i18n/font kapıları)
- **Auth**: `app/(auth)/sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `app/setup-password.tsx`, `app/oauth.tsx` + `src/components/OAuthCallbackScreen.tsx`, `app/reset-password/[token].tsx`
- **Auth kütüphaneleri**: `src/lib/auth.ts` (SecureStore token), `auth-store.ts`, `api.ts`, `pkce.ts`, `mobile-oauth.ts`, `mobile-oauth-handoff.ts`, `apple-auth.ts`, `post-auth-route.ts`, `password-management.ts`, `password-policy.ts`, `oauth-provider-status.ts`
- **App-lock**: `src/lib/app-lock-store.ts`, `src/components/AppLockGate.tsx`
- **Sekmeler**: `app/(tabs)/_layout.tsx`, `index.tsx` (dashboard: hero skeleton + last-plan-hint + offline snapshot), `addresses.tsx`, `services.tsx`, `moving.tsx`, `more.tsx`
- **Derin ekranlar**: `services/[id]`, `budget/*`, `providers/*`, `notifications/`, `settings/*` (profile, subscription, privacy, two-factor, workspace, connections, notifications, export, delete-account, address-changes), `addresses/[id]`, `workspace/accept-invite`, `invitations/[token]`, `blog/*`, `help/*`, `reminders/`, `custom-providers/*`, `search`
- **Onboarding**: `app/onboarding.tsx` (legal consent, teaser, push soft-prompt)
- **IAP**: `src/lib/iap.ts`, `iap-offers.ts`, `billing-flags.ts`, `subscription-app-review.ts`, `subscription-visible-plans.ts`, `plan-comparison.ts`, `app/settings/subscription.tsx`, `eas.json`
- **Push & widget**: `src/lib/push.ts`, `widget-data.ts`, `src/widgets/MoveWidget.tsx`, `targets/widget/*` (iOS WidgetKit), `app.json` (android-widget plugin)
- **Offline**: `src/lib/query-client.ts`, `dashboard-snapshot.ts`, `last-plan-cache.ts`, `src/components/ui/OfflineChip.tsx`
- **i18n/tema/a11y**: `src/i18n/messages/en.json` + `es.json` (anahtar paritesi script ile doğrulandı), `src/lib/theme.ts`, ham hex taraması, `packages/shared/src/intl-helpers.ts` (Hermes muhafızı)
- **İzinler/Store**: `app.json` (Android permissions/intent-filters, iOS privacy manifest, entitlements), `package.json` bağımlılıkları

Varsayımlar: (1) Sunucu API davranışları yalnızca mobilin beklediği kontratlar açısından spot-check edildi (`apps/web/src/app/api/moving/route.ts` GET'in free kullanıcıya 200 döndüğü doğrulandı). (2) Native build (EAS) çıktısı bu ortamda doğrulanamaz; Swift widget yalnızca kaynak düzeyinde incelendi.

---

## BULGULAR TABLOSU (Kritik+Yüksek önce)

| Katman | Önem | Bulgu | Neden sorun | Önerilen çözüm | dosya:satır |
|---|---|---|---|---|---|
| IAP | **Yüksek** | Uygulama açılışında bekleyen (yarım kalmış) StoreKit/Play transaction'larını işleyen global `purchaseUpdatedListener` yok; listener yalnızca aktif `purchaseSubscription` çağrısı sırasında kayıtlı. Verify ağ hatasıyla düşer ya da 120 sn timeout dolarsa (listener sökülür) kullanıcı ÜCRETLENDİRİLMİŞ ama entitlement'sız kalır; tek kurtarma yolu ayarlardaki manuel "Restore purchases". | Para alınmış-hizmet verilmemiş durumu; kullanıcı Restore butonunu bilmiyorsa destek bileti/iade/1-yıldız riski. `finishTransaction` çağrılmadığı için store yeniden teslim eder ama dinleyen kimse yok. | App cold-start'ta (oturum varsa) bir kez `getAvailablePurchases()`/global listener ile bekleyen transaction'ları `/api/mobile/iap/verify`'a sürüp `finishTransaction` çağıran bir "pending purchase reconciler" ekleyin. | `src/lib/iap.ts:197-325` (timeout: 202-204; listener: 274), `app/settings/subscription.tsx:782-796` |
| Widget (iOS) | **Yüksek** | iOS WidgetKit hedefi gemide (`targets/widget/MoveWidget.swift` App Group UserDefaults okuyor) ama JS köprüsü `writeSnapshotToAppGroup` KALICI no-op (`return false`). iOS widget'ı hiçbir zaman veri alamaz; kullanıcı ekleyince sonsuza dek boş/“no move” durumunda kalır. | Store'a giden binary'de işlevsiz bir widget — ölü özellik + App Review'da "broken feature" reddi riski. Config dosyası bile "UNVERIFIED" itiraf ediyor. | Native App Group yazıcı modülü (ufak Expo modülü ya da `expo-shared-group-preferences`) ekleyip `WIDGET_SNAPSHOT_KEY` JSON'unu yazın + `WidgetCenter.reloadAllTimelines()`; o gelene dek widget target'ı build'den çıkarın. | `src/lib/widget-data.ts:204-211`, `targets/widget/MoveWidget.swift:29,51-56`, `targets/widget/expo-target.config.js:1-3` |
| Güvenlik/PII | **Yüksek** | 401 kaynaklı zorunlu logout (`api.ts onUnauthorized` ve `auth-store.refreshUser` 401 dalı) yalnızca `clearSession()` çağırıyor; `clearSensitiveLocalState` ÇAĞRILMIYOR. Dashboard snapshot'ı (ad, şehir/eyalet, sağlayıcı adı+telefon, bütçe), widget snapshot, plan hint ve onboarding cache AsyncStorage'da kalıyor. | Oturum süresi dolduğunda (30 günlük JWT — en olağan logout yolu!) cihazda PII kalıntısı; aynı cihazda yeni hesap girerse cold-start'ta önceki kullanıcının verisi ekrana hydrate edilir (`hydrateFromSnapshot` canlı fetch'ten ÖNCE boyar). | `onUnauthorized` ve `refreshUser`'ın 401 dalında da `clearSensitiveLocalState(queryClient)` çağırın (ya da `clearSession` içine taşıyın). | `src/lib/api.ts:138-141`, `src/lib/auth-store.ts:189-192`, `src/lib/local-cleanup.ts:6-37`, `app/(tabs)/index.tsx:700-741` |
| Widget (Android) | Orta | Snapshot `daysToGo`'yu SAYI olarak saklıyor, `moveDate` yok; Android widget 30 dk'da bir yeniden çizilse de uygulama açılmadıkça aynı bayat sayıyı gösterir ("3 days to go" taşınma gününde bile kalabilir). | Widget'ın tek işi olan geri sayım güvenilmez; kullanıcı yanlış güne göre plan yapabilir. | Snapshot'a `moveDate`+`state` ekleyip widget render'ında `getMoveCountdown`'ı yeniden hesaplayın. | `src/lib/widget-data.ts:50-66,185-193`, `app.json:178` |
| Widget/Görev | Orta | `OPEN_TASK_STATUSES` REOPENED'ı içermiyor; UpNext ve dashboard snapshot'ı içeriyor. Yorum "mirrors UpNext's definition" diyor — yanlış. | Yeniden açılan görev uygulamada "sıradaki" görünürken widget'ta kaybolur; tutarsız veri. | Sete `"REOPENED"` ekleyin. | `src/lib/widget-data.ts:68` vs `src/components/ui/UpNext.tsx:53`, `app/(tabs)/index.tsx:643` |
| App-lock | Orta | Arka plana geçişte içerik gizlenmiyor (blur/privacy ekranı yok) ve kilit 15 sn grace + yalnızca 'active'e dönüşte devreye giriyor. | App switcher anlık görüntüsünde adresler/bütçe görünür; "kilitli" uygulamanın son ekranı multitasking'de okunabilir. | `AppState` inactive/background'da tam-ekran örtü (logo) basın; kilit zaten örtüyü sahiplenebilir. | `src/components/AppLockGate.tsx:22,78-99` |
| App-lock | Düşük | Kilit bayrağı AsyncStorage'da (`locateflow.appLock.enabled`), SecureStore değil; ayrıca capability "unknown"a düşerse kilit ekranında "Disable app lock & continue" kaçışı görünür. | Kilit bir güvenlik sınırından çok gizlilik perdesi; cihaz içi kurcalama/geçici capability hatası bypass'a izin verir (oturum jetonu zaten kilitten bağımsız). | Bayrağı SecureStore'a taşıyın; recovery'yi yalnızca `not_enrolled`/`no_hardware` nedenlerinde gösterin. | `src/lib/app-lock-store.ts:6,117-124`, `src/components/AppLockGate.tsx:140` |
| Dashboard (offline) | Orta | Kısmî kesinti karışımı: canlı fetch'te `recoRes` başarılı ama profile/addresses başarısız olursa snapshot stats'ı korunur fakat `criticalReadiness` canlı reco değerleriyle ezilir → hero ring snapshot %'siyle çelişen bir karışım gösterebilir. | Offline chip "son bilinen" derken ring başka kaynaktan beslenir; sayı tutarsızlığı. | Hata dalında reco/`criticalReadiness` güncellemesini de snapshot moduna kilitleyin. | `app/(tabs)/index.tsx:385-446,727-740` |
| Offline genel | Orta | Sorgu persist'i YOK (tasarım gereği); dashboard dışındaki TÜM ekranlar offline'da hata duvarı/boş duruma düşer: addresses/services/moving/budget/providers/notifications/reminders → `ErrorState`+retry; `search` ise hatayı HİÇ göstermez, sessizce "sonuç yok" der; blog listesi de offline'da boş kalır. | Taşınma günü çekmeyen şebekede uygulamanın %90'ı kullanılamaz; search'ün sessiz boş hali yanıltıcı. | En azından search'e ErrorState ekleyin; addresses/services listeleri için dashboard-snapshot desenini genelleştirin (RQ persister bilinçli reddedildiyse ekran-başı mini-snapshot). | `app/search.tsx:85-98`, `app/(tabs)/addresses.tsx:378`, `app/(tabs)/services.tsx:565`, `app/(tabs)/moving.tsx:162-163` |
| IAP/i18n | Orta | Satın alma yüzeyinde hardcoded İngilizce: `computeAnnualSavingsText` ("Save … vs monthly · % off"), `computeAnnualMonthlyEquivalentText` ("/month"), "First N days free" rozetleri, `getAnnualActionLabels` ("Start annual"/"Switch to annual"). | es kullanıcı ödeme ekranında karışık dil görür; güven kaybı + App Review yerelleştirme uyumsuzluğu. | Bu üreticileri `t()`'ye taşıyın (en/es anahtar paritesi zaten 1277/1277 — altyapı hazır). | `app/settings/subscription.tsx:217,223,652-655`, `src/lib/subscription-app-review.ts:19-21` |
| i18n | Düşük | Hardcoded EN rol etiketleri: invitations `ROLE_LABEL`, dashboard workspace rozeti `{OWNER:"Owner",…}`; Hermes'te `formatRelativeTime` fallback'i İngilizce (es'te "5 minutes ago"). | es ekranlarında İngilizce parçalar. | Rol etiketlerini `t()`'ye alın; fallback'e basit es tablosu ekleyin. | `app/invitations/[token].tsx:21-27`, `app/(tabs)/index.tsx:1635`, `packages/shared/src/intl-helpers.ts:148-155` |
| Tema | Orta | Token saflığı ihlalleri: services sekmesi kategori renkleri ham hex (light modda dark-palet hex'leri kalır → kontrast bozulur), dashboard plan rozeti hex'leri, tab bar rgba literalleri. (RaccoonMascot/LogoBrand/BrandLogos SVG'leri makul istisna; sign-in'deki Google #fff / Apple #000 marka kuralı gereği doğru.) | Light temada ve Family/Pro plan paletlerinde bu yüzeyler tema dışı kalır. | `CATEGORY_COLORS`'ı `theme.colors.*` tone objelerine bağlayın; planBadge renklerini `applyPlanPalette` accent'lerinden türetin. | `app/(tabs)/services.tsx:63-65`, `app/(tabs)/index.tsx:1022-1025`, `app/(tabs)/_layout.tsx:26,143` |
| A11y | Orta | İkon-only dokunulabilirler etiketsiz: dashboard zil butonu (`notifButton`) accessibilityLabel/Role'süz; stat kartları ve quick-action satırları label'sız (metin çocukları var, kısmen okunur). Genel: 307 TouchableOpacity / 173 label. | Ekran okuyucu zile "button" bile demez; görme engelli kullanıcı bildirimlere ulaşamaz. | Zile `accessibilityRole="button"` + `accessibilityLabel={t("notifications.title")}`; ikon-only tüm butonları tarayın. | `app/(tabs)/index.tsx:1079-1081,1583-1603` |
| Auth/UX | Orta | `getPostAuthMobileRoute` HER ZAMAN `/onboarding` döner; dönen (onboarded) kullanıcı her girişte önce onboarding'e basılır, ekranın kendi `/api/profile` kontrolü veya AuthGuard geri çevirir → flash; ağ yavaşsa onboarding step-0 görünür. | Geri dönen kullanıcıya her girişte yanlış ekran; flaky ağda kafa karışıklığı. | Login yanıtındaki kullanıcı durumuna (veya onboarding cache'ine) bakıp doğrudan `/(tabs)`'a yönlendirin; onboarding kontrolünü guard'a bırakın. | `src/lib/post-auth-route.ts:1-10`, `app/onboarding.tsx:391`, `app/_layout.tsx:273-296` |
| Şifre | Orta | `reset-password/[token]` ekranında şifre POLİTİKA kontrolü yok (sign-up'taki kural listesi yok); başarısızlıkta jenerik "resetPasswordFailed" — token mı süresi doldu, şifre mi zayıf ayırt edilemez. | Kullanıcı neyi düzelteceğini bilmez; sunucu reddi sonrası dead-end hissi. | `getPasswordRuleResults` çek-listesini bu ekrana da koyun; sunucu hata kodunu mesaja yansıtın. | `app/reset-password/[token].tsx:29-57` |
| Deep link | Orta | Android intent-filter yalnızca `/blog`, `/mobile/oauth`, `/reset-password`, `/invitations` path'lerini kapsıyor. E-posta doğrulama veya başka web linkleri uygulamaya açılmaz (tarayıcıya gider). iOS'ta `applinks:locateflow.com` tüm path'leri AASA'ya bırakıyor → platform davranış farkı. | Aynı e-posta linki iOS'ta uygulamayı, Android'de tarayıcıyı açabilir; tutarsız UX. | Mobilde karşılanan her e-posta linki path'ini iki platformda da eşitleyin (AASA paths ↔ intent-filters). | `app.json:62-64,78-109` |
| Bildirim | Düşük | Bildirim feed'i tek sayfa (`/api/notifications/feed`, parametresiz) — sayfalama/sonsuz kaydırma yok. | Uzun geçmişte eski bildirimlere erişilemez / payload büyür. | `limit`+cursor parametresi ekleyin. | `app/notifications/index.tsx:119` |
| TZ tutarlılık | Düşük | Moving sekmesi `daysUntil`'i cihaz saatiyle (`Date.now()` + `Math.ceil`) hesaplıyor; dashboard/widget `getMoveCountdown` (eyalet TZ-duyarlı) kullanıyor → aynı plan iki ekranda ±1 gün farklı görünebilir. | "4d" vs "3 days to go" çelişkisi. | Moving sekmesinde de `getMoveCountdown` kullanın. | `app/(tabs)/moving.tsx:196` |
| Temizlik | Düşük | Logout temizliği push soft-prompt kararını ve dashboard kart-dismiss bayraklarını silmiyor; `FirstRunHero.tsx` hiçbir yerde kullanılmıyor (ölü kod). | Yeni hesap önceki kullanıcının "declined" kararını miras alır → push promptu hiç görmeyebilir; ölü kod bundle şişirir. | `locateflow.pushSoftPromptDecision` + kart bayraklarını cleanup listesine ekleyin; FirstRunHero'yu silin. | `src/lib/local-cleanup.ts:6-27`, `src/lib/push.ts:19`, `src/components/ui/FirstRunHero.tsx` |
| Store uyumu | Düşük | iOS privacy manifest `NSPrivacyCollectedDataTypes: []` boş — uygulama e-posta/ad/adres/telefon işliyor (sunucuya gidiyor; manifest yalnızca "required reason API" için doldurulmuş). App Store Connect beyanıyla çelişirse Review sorusu doğurur. | Apple, manifest ile Connect beyanı arasındaki tutarsızlıkları işaretlemeye başladı. | Connect'teki Data Collection beyanını esas alıp manifest'i senkronlayın. | `app.json:31-61` |
| Hermes | Bilgi (✓) | Lookbehind regex YOK; `Intl.NumberFormat/DateTimeFormat` kullanımı Hermes destekli; `Intl.RelativeTimeFormat` çağrısı feature-detect + fallback ile korunmuş; `format.ts` try/catch'li. Tehlike bulunamadı. | — | — | `packages/shared/src/intl-helpers.ts:141-179`, `src/lib/format.ts:33-55` |
| İzinler | Bilgi (✓) | Bildirilen tüm Android izinleri gerçekten kullanılıyor (VIBRATE→haptics, USE_BIOMETRIC/USE_FINGERPRINT→expo-local-authentication, POST_NOTIFICATIONS→push); CAMERA/STORAGE bloklanmış; konum izni yok ve harita stilize (gerçek basemap yok) olduğundan gerekmiyor. Kullanılan-ama-bildirilmeyen izin bulunamadı. | — | — | `app.json:110-121`, `src/components/addresses/AddressesMap.tsx:9-16`, `package.json` |
| i18n | Bilgi (✓) | en.json/es.json anahtar paritesi tam: 1277/1277, iki yönde de eksik yok (script ile doğrulandı). | — | — | `src/i18n/messages/*` |

---

## 5-SORU KARNESİ (alt alan bazında)

### 1) Auth ekranları + SecureStore + PKCE/OAuth/Apple + setup-password
1. **Uçtan uca çalışıyor mu?** Evet. E-posta+şifre (MFA/backup-code dahil, 403 `MFA_REQUIRED` kodu doğru yakalanıyor — `sign-in.tsx:113`), Google/Apple web-OAuth (PKCE S256, SecureStore'da TTL'li verifier, state→verifier eşlemesi — `pkce.ts`), iOS native Apple sheet (+ web fallback), kayıt (legal consent zorunlu, parola politikası canlı çek-listesi). Token SecureStore'da `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (`auth.ts:3-6`). OAuth code exchange'i çift-yol yarışına karşı inflight-coalescing + cross-restart dedup ile sağlamlaştırılmış (`mobile-oauth-handoff.ts:22-147`) — iyi mühendislik.
2. **Mantıksızlık?** `getPostAuthMobileRoute` koşulsuz `/onboarding` (yukarıda Orta). setup-password ekranı `hasPasswordLogin:false`'u sabitliyor (kullanıcı state'ine bakmıyor) ama ekrana yalnızca OAuth-only kullanıcı geleceği için pratikte zararsız.
3. **Eksik?** Sign-up/sign-in'de istemci tarafı e-posta biçim doğrulaması yok (yalnızca boşluk trim); reset ekranında parola kural listesi yok.
4. **Bug/güvenlik açığı?** Kritik açık bulunamadı. PKCE + state + tek-kullanımlık kod + SecureStore zinciri doğru kurgulanmış. `handledOAuthCodes`'un AsyncStorage'da olması düşük risk (kodlar sunucuda zaten tüketiliyor).
5. **İyileştirme:** Post-auth rotayı kullanıcı durumuna göre seçin; MFA girişinde backup-code için ayrı input/etiket.

### 2) Kök layout guard'ları + deep link'ler
1. **Çalışıyor mu?** Evet. Token yokken sign-in'e zorlama; `(auth)/oauth/reset-password/blog` public; invite token'ı oturumsuz kullanıcı için stash edilip ilk auth'ta tüketiliyor; onboarding kapısı "şüphede onboarding'e tut" yönünde başarısız oluyor (doğru yön) ve AsyncStorage cache'iyle dönen kullanıcıyı bloklamıyor (`_layout.tsx:199-243`).
2. **Mantıksızlık?** Bildirim tap rotası `taskId` için plan detayına değil moving sekmesine gider (yorumda gerekçeli — kabul edilebilir).
3. **Eksik?** Oturumsuz yakalanan derin linkin (örn. `/services/<id>`) auth sonrası hedefe devam ettirilmemesi (yalnızca invite için stash var).
4. **Bug?** Hayır; bildirim tap'leri çift-işlenmeye karşı `handledIds` ile korunuyor, cold-start replay'i auth çözülünce çalışıyor (`_layout.tsx:314-353`).
5. **İyileştirme:** Genel "pendingDeepLink" stash'ı; Android intent-filter path listesini iOS'la eşitleme.

### 3) Sekmeler + dashboard (skeleton/last-plan-hint) + derin ekranlar
1. **Çalışıyor mu?** Evet. Yeni hero akışı doğru kurgulanmış: canlı entitlement çözülmeden tier'a özel kart ASLA boyanmıyor (nötr skeleton), cache hint yalnızca yönlendirici, `entitlementResolvedRef` ile geç-gelen-hint'in canlı veriyi ezmesi engellenmiş (`index.tsx:761-785`). FREE kullanıcı için GET `/api/moving`'in 200 teaser kontratı sunucuda doğrulandı → hata duvarı tetiklenmez.
2. **Mantıksızlık?** Dashboard hızlı aksiyonlarında "New plan" FREE kullanıcıya da görünür (hero'da gizlenirken) — ama `/moving/new` gate-kodlarını (`MOVING_PLAN_UPGRADE_REQUIRED`) Upgrade affordance'a çeviriyor, dead-end yok; yine de hero'nun "free asla CTA görmez" iddiasıyla çelişiyor.
3. **Eksik?** Bildirim feed sayfalaması; moving sekmesinde TZ-duyarlı geri sayım.
4. **Bug?** Kısmî kesintide ring kaynak karışımı (tabloda); `.map` çağrıları sistematik olarak `|| []` korumalı — taranan ekranlarda unguarded `.data.x.map` BULUNAMADI.
5. **İyileştirme:** `fetchDashboard` içindeki seri `await api.get("/api/workspaces")`'i ana `Promise.all`'a alın (görünür gecikme).

### 4) Onboarding + plan teaser'ları
1. **Çalışıyor mu?** Evet; legal consent sunucu onayı alınmadan local'den silinmiyor, free path hiç `/api/moving` POST'lamıyor (`completeWithoutPlan`), teaser tamamen client-side engine'den üretiliyor (fabrikasyon yok), push soft-prompt Apple HIG'e uygun tek-seferlik ön-açıklamayla geliyor (`onboarding.tsx:878-996`).
2. **Mantıksızlık?** Yok denecek düzeyde.
3. **Eksik?** Soft-prompt yalnızca tamamlanışta; ama dashboard re-prompt kartı bu boşluğu kapatıyor (✓).
4. **Bug?** Bulunamadı.
5. **İyileştirme:** `COMPLETED` progress POST'u + `/api/profile` doğrulaması iki yuvarlak-tur; tek RPC'de birleştirilebilir.

### 5) IAP + plan karşılaştırma + App-Review gating
1. **Çalışıyor mu?** Mutlu yol evet: SKU'lar sunucudan, disclosure alert'i native sheet'ten önce, verify sunucu-otoriter, `finishTransaction` yalnızca verify sonrası; Stripe/diğer-platform yönetimli abonelikler satın almayı doğru blokluyor; eas.json prod'da IAP flag'leri açık, kapalıyken fiyat/CTA gizleme (`billing-flags.ts`) Apple 3.1.1 uyumlu.
2. **Mantıksızlık?** Disclosure metni üreticileri kısmen İngilizce-sabit (tabloda).
3. **Eksik?** **Açılışta bekleyen-transaction kurtarıcısı yok (YÜKSEK, tabloda).**
4. **Bug?** 120 sn timeout sonrası geç gelen transaction'ın kaybolması aynı kök nedene bağlanıyor.
5. **İyileştirme:** Cold-start reconciler + verify başarısızlığında otomatik arka plan retry.

### 6) Push + reminders + widget veri hattı
1. **Çalışıyor mu?** Push: soft-prompt kapılı kayıt, Android kanalları, logout'ta token unregister (✓). Reminders ekranı services+feed'den türetiyor. Widget: Android tarafı JS render + AsyncStorage zinciri çalışır; **iOS tarafı çalışmaz** (Yüksek, tabloda).
2. **Mantıksızlık?** Widget "mirrors UpNext" yorumu yanlış (REOPENED).
3. **Eksik?** Widget snapshot'ında `moveDate` (bayat geri sayım).
4. **Bug?** iOS köprüsü no-op.
5. **İyileştirme:** Arka plan fetch (BGTaskScheduler/WorkManager) olmadan widget verisi yalnızca uygulama açılışlarında tazelenir — beklenti yönetimi için widget'a "updated X ago" zaten var (✓), yine de native modül şart.

### 7) OFFLINE davranışı (ekran haritası)
- **Dashboard**: snapshot hydrate + OfflineChip → çalışır (tek dayanıklı ekran). Kısmî kesinti karışımı riski (tabloda).
- **Addresses / Services / Moving / Budget / Providers / Notifications / Reminders / Custom-providers / Help**: ErrorState + Retry → veri YOK ama dead-end değil.
- **Search**: sessiz boş — hata gösterimi YOK (tabloda).
- **Blog**: listede hata kopyası var ama offline'da içerik yok.
- **Settings/workspace & connections**: kendi içinde yüklenme/boş durumlarına düşer, ErrorState bileşeni kullanılmıyor.
- **Mutasyonlar**: RQ `networkMode:"online"`, retry 0 → offline'da kuyruklanmaz, anında hata (bilinçli; veri bütünlüğü için doğru taraf).
- **Sorgu persist'i YOK** — `query-client.ts` yorumu gerekçeli (PII), dashboard-snapshot istisnası kontrollü.

### 8) İzinler vs app.json (store uyumu)
Tam eşleşme; ne fazla-deklarasyon ne eksik var (tabloda ✓ satırı). iOS privacy manifest veri-tipi beyanı boş (Düşük not). `expo-iap` Android'de BILLING iznini plugin'i kendisi ekler (config'de görünmemesi normal).

### 9) Hermes / i18n / tema / a11y
- Hermes: temiz (✓ satırı). Ekipte Hermes farkındalığı yüksek (kod içi HERMES NOTE'ları).
- i18n: anahtar paritesi mükemmel; sorun hardcoded üretici fonksiyonlarda (tabloda).
- Tema: token disiplinli mimari var (`theme.ts` shared token'lardan); ihlaller lokalize (tabloda).
- A11y: Button/Input/PressableScale bileşenleri rol+label+state taşıyor (✓); ekran-içi ikon-only butonlarda boşluklar var (tabloda).

---

## MODÜL SAĞLIK ÖZETİ

| Modül | Sağlık | Not |
|---|---|---|
| Auth + OAuth/PKCE/Apple | 🟢 90/100 | Güvenlik zinciri sağlam; post-auth rota UX'i ve reset ekranı politika eksikleri |
| Kök guard + deep link | 🟢 85/100 | Tri-state onboarding kapısı örnek nitelikte; Android/iOS link kapsamı eşitsiz |
| App-lock | 🟡 75/100 | Akış sağlam; arka plan privacy ekranı yok, bayrak AsyncStorage'da |
| Dashboard (skeleton/hint/offline) | 🟢 85/100 | Flash-guard ve snapshot tasarımı çok iyi; kısmî kesinti karışımı + 401-temizlik açığı |
| Sekmeler + derin ekranlar | 🟢 82/100 | Tutarlı ErrorState/Empty desenleri; search sessiz, feed sayfasız |
| Onboarding | 🟢 88/100 | Consent paper-trail'i ve free-teaser disiplinli |
| IAP | 🟡 70/100 | Verify-önce-finish doğru; **pending-transaction kurtarıcısı yok** |
| Push | 🟢 85/100 | HIG-uyumlu; karar bayrağı logout'ta kalıyor |
| Widget | 🔴 40/100 | iOS hattı ölü, Android geri sayımı bayatlıyor |
| Offline | 🟡 65/100 | Yalnız dashboard dayanıklı; kalan ekranlar hata duvarı |
| i18n | 🟢 88/100 | Parite tam; satın alma yüzeyinde EN sabitleri |
| Tema | 🟢 85/100 | Token altyapısı güçlü; lokal hex ihlalleri |
| A11y | 🟡 70/100 | Bileşen tabanı iyi; ikon-only butonlar etiketsiz |
| Store uyumu | 🟢 85/100 | İzinler temiz; privacy manifest beyanı + boş iOS widget riski |

**Genel:** Mobil uygulama 2. turda olgun bir durumda — auth/OAuth/IAP-verify/consent zincirlerinde ciddi mühendislik özeni var, kritik (veri kaybettiren/oturum kıran) hata bulunamadı. Üç Yüksek bulgu (IAP pending-transaction kurtarıcısı, iOS widget'ın ölü veri köprüsü, 401-logout'ta PII kalıntısı) yayın öncesi kapatılmalı.
