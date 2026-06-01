# WEB-01 Public/Marketing/Legal/SEO

## Kapsam

Public landing, pricing, FAQ/help/blog/legal sayfalari; robots/sitemap/JSON-LD; noindex ve public/private route ayrimi.

## Olumlu Gozlemler

- Public smoke testleri home, sign-in, sign-up, pricing, robots, sitemap ve FAQ JSON-LD yuzeylerini kontrol ediyor.
- Middleware tarafinda private/app/API yuzeyleri icin noindex ve security header davranisi ayrilmis.
- Public route sozlesmesi diger modullerden bagimsiz tutulmaya calisilmis.

## Riskler ve Sorular

- Public Playwright kapsami iyi bir smoke katmani ama sadece anonim yuzeyleri kanitliyor.
- SEO/public icerik tarafinda admin CMS ile public render arasindaki XSS/sanitizer kontrati uctan uca test edilmeli.
- Legal sayfalar ile onboarding/legal consent kaydi arasinda versiyon uyumu izlenmeli.
- Blog/help/FAQ JSON-LD icerigi admin tarafindan degistiginde schema ve canonical/noindex davranisi regresyona acik.

## Test/Task Listesi

- Public pages: `/`, `/pricing`, `/faq`, `/help`, blog, legal pages 200 ve dogru metadata.
- Private pages anonymous redirect ve noindex.
- `robots.txt`, `sitemap.xml`, JSON-LD validasyon.
- CMS kaynakli public HTML icin XSS payload regression.
- Legal versiyon degistiginde onboarding consent yeniden isteniyor mu kontrolu.

## Oncelik

P2: CMS/public render XSS ve legal-version baglantisi icin E2E eklenmeli.
