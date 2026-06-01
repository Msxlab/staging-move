# WEB-09 Providers/Recommendations/Custom Providers

## Kapsam

Provider catalog, recommendations, coverage confidence, custom providers, local/manual tracking siniri.

## Olumlu Gozlemler

- Product logic provider verisini resmi entegrasyon gibi sunmamaya odaklanmis.
- Shared provider/recommendation mantigi merkezi hale getirilmis.
- Custom provider akisi kullanici ihtiyacini resmi provider coverage disinda karsilayabiliyor.

## Riskler ve Sorular

- Recommendation API'nin shared `getRecommendedProviders` filtrelerini bypass edip daha dusuk seviye cluster fonksiyonunu kullanmasi CORE-01'de risk olarak not edildi.
- UI copy veya admin content provider iliskisini "official/verified/address-level exact" gibi fazla iddiali gostermemeli.
- Custom provider ownership ve workspace visibility testleri gerekli.
- Provider coverage duplicate veya seed drift durumlari admin/core tarafiyla birlikte izlenmeli.

## Test/Task Listesi

- Recommendation confidence/caveat gosterimi.
- Unsupported state/zip fallback.
- Custom provider CRUD ownership.
- Provider disabled/deprecated ise recommendation disinda kalir.
- Admin provider update public cache'e yansir.

## Oncelik

P2/P3: Recommendation filtre yollari ve provider claim copy regression.
