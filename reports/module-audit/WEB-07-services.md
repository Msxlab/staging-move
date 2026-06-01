# WEB-07 Services

## Kapsam

User services CRUD, provider/custom provider baglantisi, account fields, ownership, status transitions, workspace isolation.

## Olumlu Gozlemler

- Service modeli user, workspace, address, provider ve custom provider eksenlerini bir araya getiriyor.
- Provider/local manual tracking siniri urun mantiginda tanimlanmis.
- Account/service alanlari hassas veri olarak threat modelde ele alinmis.

## Riskler ve Sorular

- Service `addressId` baska kullaniciya ait bir address'e isaret ederse bunu DB tek basina engellemiyor; route ownership kontrolleri kritik.
- Account number/username gibi alanlar export, logs, admin view ve audit redaction icin dikkat gerektiriyor.
- Service status degisimleri provider task, budget, notification ve moving plan tarafina yan etki yapiyor mu kontrol edilmeli.
- Workspace migration sirasinda nullable `workspaceId` eski kayitlarla yeni izolasyon arasinda risk yaratabilir.

## Test/Task Listesi

- Service create/update/delete ownership.
- Cross-user addressId denemesi.
- Custom provider ile service create.
- Provider silinirse service fallback.
- Sensitive fields redaction/export.
- Workspace member service access.

## Oncelik

P2: Service-address-owner invariant'i icin route + DB-backed test.
