# Home / Public Analysis

Durum: 2026-06-08 ilk full-pass public yuzey incelemesi.

## Anasayfa

Kaynak: `apps/web/src/app/page.tsx`.

Anasayfa server component olarak calisiyor ve:

- Mevcut user session'i okuyup CTA hedefini dashboard veya sign-up olarak belirliyor.
- Public subscription/campaign tekliflerini cekiyor.
- `WORKSPACE_MODEL_ENABLED` ve `FEATURE_API_CONNECTORS` flaglerine gore aile/workspace ve connector bolumlerini kosullu gosteriyor.
- SEO metadata, OpenGraph/Twitter metadata ve JSON-LD uretir.
- Blog, pricing, FAQ, app store CTA, early access capture gibi public bolumleri birlestirir.

## Public Landing Baglantilari

- CTA/auth: `/sign-up`, `/sign-in`, `/dashboard`.
- Public information: `/how-it-works`, `/pricing`, `/blog`, legal pages.
- Waitlist/early access: `/api/waitlist`.
- Blog list/detail: public web pages ve `/api/blog/posts`.
- Address autocomplete landing feature: middleware tarafindan public API prefix olarak acik.
- Provider public yuzeyi: `/providers`, `/api/providers`, `/api/providers/[id]`, `/api/providers/popular`.

## SEO / Content

- Public SEO metadata ve structured data anasayfa tarafinda uretiliyor.
- Blog feed route handler'lari `blog/feed.xml`, `blog/atom.xml`, `llms.txt`, `llms-full.txt` public route handler yuzeyine dahil.
- Admin blog publish/revalidate akisi public web revalidate endpointine internal secret/HMAC ile baglaniyor.

## Notlar

- Anasayfa feature flag copy'si dikkatli: provider hesaplarini otomatik guncelleme iddiasini sinirli tutuyor.
- Public provider popularitesi anasayfadan dogrudan cagrilmiyor; ama public providers API yuzeyi altinda F-002 mahremiyet riski var.
- Public tracking endpoints consent/sanitization akislariyla ayrilmis; detayli privacy review ayri pass olarak yapilmali.
