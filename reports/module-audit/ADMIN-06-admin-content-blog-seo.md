# ADMIN-06 Admin Content/Blog/SEO

## Kapsam

Admin blog/help/CMS, SEO metadata, public publish, image uploads, sanitizer, IndexNow/cache.

## Olumlu Gozlemler

- Public SEO yuzeyi ve admin CMS ayrimi modul bazinda ele alinmis.
- Content/HTML boundary threat modelde kritik sinir olarak tanimli.

## Riskler ve Sorular

- Stored XSS riski public blog/help ve admin preview/render arasinda en onemli konu.
- Image upload/auto-fetch SSRF, magic-byte ve active content kontrolleriyle bagli kalmali.
- Draft/published/noindex/canonical davranislari E2E test edilmeli.

## Test/Task Listesi

- Create draft/publish/unpublish.
- Sanitizer XSS payload.
- SEO metadata/canonical.
- JSON-LD validity.
- Image upload invalid mime/magic bytes.
- Cache/indexing invalidation.

## Oncelik

P2: CMS stored XSS ve publish SEO E2E.
