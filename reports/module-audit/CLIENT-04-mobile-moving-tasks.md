# CLIENT-04 Mobile Moving/Tasks

## Kapsam

Mobile moving plan, task list, completion/dismissal, reminders, sync with web.

## Olumlu Gozlemler

- Moving/task logic shared/core tarafta tutuldugu icin mobile-web parity icin uygun zemin var.
- Mobile API testleri temel client davranislarini kapsiyor.

## Riskler ve Sorular

- Task offline complete/dismiss yapilirsa conflict resolution nasil olacak net E2E edilmeli.
- Web'de task reopen timestamp riski mobile UI'da da gorunebilir.
- Reminder/push state ile local task state drift yapabilir.

## Test/Task Listesi

- Moving plan list/detail.
- Task complete/dismiss/reopen.
- Offline action queue and retry.
- Web update -> mobile refresh.
- Deleted plan/task sync.

## Oncelik

P2/P3: Mobile moving offline/sync regression.
