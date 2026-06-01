# WEB-08 Moving Plans/Move Tasks

## Kapsam

Moving plan create/update/delete, from/to address, move tasks, task lifecycle, reminders, completion/dismissal.

## Olumlu Gozlemler

- MovingPlan adres iliskileri hard-delete riskine karsi `Restrict` mantigi ile dusunulmus.
- Move-task lifecycle shared pakette merkezi fonksiyonlarla modellenmis.
- Reminders/cron entegrasyonu ayri modul olarak ele alinmis.

## Riskler ve Sorular

- Moving olustururken hata alinirsa UI resume/retry browser E2E ile kanitlanmiyor.
- Address ownership ve workspace isolation moving plan icin DB tarafinda tek basina garanti edilmiyor.
- Task reopen durumunda completed/dismissed timestamp'lerin stale kalma riski CORE-01'de not edildi.
- Move reminders timezone, deleted user, deleted plan ve notification preferences ile beraber test edilmeli.

## Test/Task Listesi

- Moving plan create with valid from/to addresses.
- Cross-user address kullanimi engellenir.
- Moving create hata -> retry/resume.
- Task complete/dismiss/reopen timestamps.
- Reminder cron only eligible tasks.
- Plan deletion task cleanup.

## Oncelik

P2: Moving create/resume ve cross-address isolation E2E.
