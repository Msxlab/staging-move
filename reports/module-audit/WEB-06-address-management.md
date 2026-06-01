# WEB-06 Address Management

## Kapsam

Address CRUD, ownership, autocomplete/normalization, soft-delete, workspace/user isolation, moving/service baglantilari.

## Olumlu Gozlemler

- Address kavrami service ve moving plan icin merkezi baglanti olarak modellenmis.
- Soft-delete ve userId odakli erisim modeli mevcut.
- Address verisinin hassas PII oldugu threat modelde dogru siniflandirilmis.

## Riskler ve Sorular

- DB semasinda bazi cross-owner invariant'lar sadece route koduna guveniyor: service/moving plan address'in ayni user/workspace'e ait oldugu DB tarafinda tek basina garanti edilmiyor.
- Address hard-delete ile MovingPlan `Restrict` iliskisi silme/purge akislarinda sorun cikartabilir.
- Autocomplete/provider/address kaynaklari PII ve maliyet/rate-limit acisindan ayrica izlenmeli.
- Soft-deleted address'in listelerde, exports'ta, provider recommendation'da veya admin aramalarinda gorunmemesi test edilmeli.

## Test/Task Listesi

- User A address ID'si user B tarafindan okunamaz/yazilamaz/silinemez.
- Address silinince service/move etkisi dogru olur.
- MovingPlan address hard-delete restriction purge akisinda yakalanir.
- Autocomplete rate-limit ve validation.
- Export/deletion soft-delete filtreleri.

## Oncelik

P2: Cross-user address ownership DB-backed E2E.
