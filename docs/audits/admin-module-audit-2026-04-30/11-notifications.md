# Notifications Audit

## Baglanti Durumu

- Admin: `/api/notifications`
- Web page: `/api/notifications/feed`
- Mobile page: `/api/notifications/feed`
- Web header `NotificationCenter` admin-created notifications'i kullanmiyor;
  servis/billing turevi local notification turetiyor.

## Guvenlik

- Admin permission `settings` altinda, minimum ADMIN. Ayri notification
  permission yok.
- Broadcast cok genis etki alanina sahip ama ek step-up/confirmation yok.
- `href` allowlist yok. Web notification page link'i dogrudan kullanirsa unsafe
  navigation/open redirect riski dogabilir.

## Mantik ve Eksik

- Sadece `IN_APP` channel destekleniyor; email/push/schedule bilerek bloklu.
- Direkt notification create icin user existence precheck yok; FK error 500'e
  dusebilir.
- Title/body/type/href uzunluk ve format validasyonu eksik.
- Web header badge/dropdown admin notification'larini gostermiyor; mobile page
  gosteriyor.

## Oneriler

- Ayri `notifications` permission resource'u.
- Broadcast icin target preview, count confirmation ve password step-up.
- `href` sadece internal relative path olacak sekilde validate edilmeli.
- Web header feed ile senkronize edilmeli.
