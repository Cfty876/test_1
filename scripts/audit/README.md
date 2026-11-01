# Изолированные проверки

Не запускать нагрузки на рабочем порту и не подставлять рабочую базу. Все данные синтетические. Скрипты не печатают пароли/куки; отчёты содержат только метрики и контрольные суммы.

Функциональная проверка локального fallback: `npm run test:server`. Она создаёт временный каталог и не читает `.env.local`. SQL store-тест пропускается без явно заданной отдельной `AUDIT_RECORD_DATABASE_URL` с именем базы `pervik_audit_records_*`; база должна быть новой и пустой.

Для собственного повторного нагрузочного прогона нужна запущенная локальная база Docker (`npm run db:up`) и отсутствие старого окружения `.aistudio/production-audit/audit.env`. Предыдущее окружение сохранить отдельно вместе с ключом, если его данные ещё нужны.

```powershell
docker build -t pervik-app:audit-improved .
node scripts/audit/prepare.mjs
docker compose -f .aistudio/production-audit/compose.yaml up -d
docker compose -f .aistudio/production-audit/compose.yaml exec -T app node scripts/audit/seed.mjs
node scripts/audit/check-database.mjs
$env:AUDIT_CONCURRENCY='20'
$env:AUDIT_SECONDS='8'
node scripts/audit/load.mjs repeated-full-20
$env:AUDIT_CONDITIONAL='true'
$env:AUDIT_CONCURRENCY='100'
node scripts/audit/load.mjs repeated-conditional-100
$env:AUDIT_SECONDS='20'
node scripts/audit/mixed.mjs
docker compose -f .aistudio/production-audit/compose.yaml down
```

`check-database.mjs` и `mixed.mjs` используют локальный опубликованный порт PostgreSQL 54329. При другом порте исправить только тестовое окружение/скрипт после проверки назначения. Не выполнять функциональные проверки одновременно с замером скорости: они меняют тестовые записи и искажают результат.

`restore-check.mjs SOURCE TARGET` снимает копию и восстанавливает её только между отдельными базами `pervik_audit_*` / `pervik_audit_restore_*`. Имя целевой базы должно быть новым. `state-digest.mjs` запускается внутри audit-контейнера и выводит только счётчики и SHA256.

После прогона остановить audit-контейнеры. Тестовые базы можно удалить отдельно, предварительно проверив точные имена. Сохранять исходный ключ, если нужно снова открыть их дамп. Рабочая база называется `pervik`; эти скрипты отказываются использовать её.

Короткие стресс-прогоны не заменяют длительный тест на выбранном сервере и проверку интерфейса браузером. Исходный `baseline-20.json` получен на сохранённом старом образе; новый `prepare.mjs` создаёт окружение для актуальной версии.
