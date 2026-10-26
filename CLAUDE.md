# Karavana – Kutu Oyunu Cafe İşletme Sistemi

Veritabanı dersi dönem projesi. Geliştiriciler: Enes Öztürk, Emre Alma. Teslim: 27 Aralık 2026 23:59.
Seçilen yol: **PostgreSQL (RDBMS)**. Puan kriterleri `docs/ROADMAP.md` içinde.

## Komutlar
- Bağımlılıklar: `npm install` (kök dizinde; workspaces: `app/api`, `app/web`)
- Veritabanını sıfırdan kur: `npm run db:kur` (`.env` içindeki PostgreSQL; yerel kurulum veya Docker)
- Testler: `npm run db:test` (PostgreSQL) / `npm run db:test:lite` (kurulumsuz PGlite)
- Docker ile: `make up DB=postgres` (port **5433**); sıfırlama `make reset && make up DB=postgres`
- Shell: `psql -U postgres karavana` (yerel) veya `docker compose exec postgres psql -U app karavana`
- Rol testi: `psql -U garson_app karavana` (parola `garson_dev_pw`)

## Kurallar
- Şema değişikliği `db/postgres/init/NN_*.sql` dosyalarında yapılır, ardından `npm run db:kur` ve testler.
- Yeni iş kuralına test eklenir (`db/tests/`). Seed (`06_seed.sql`) şu an GEÇİCİ örnek veri; testler seed id'lerine dayanır.
- Prosedürler işlemi yapan personeli `fn_aktif_personel()` ile okur; çağıran taraf `set_config('app.personel_id', id, true)` yapmalı.
- Uygulama rolleri tablolara doğrudan erişmez: view okur, `sp_*` prosedürlerini çağırır (bkz. `docs/ARCHITECTURE.md`).
- Kullanıcı verisi (ad, e-posta, telefon) garson/kasiyer için daima maskeli view'dan okunur.
- Yeni iş kuralı önce constraint/trigger olarak veritabanında yazılır, uygulama katmanı tekrar etmez.
- Postgres sürümü 15 (yerelde mevcut imaj). 17'ye geçilirse compose'ta değiştir.
- `.env` git'e girmez; parolalar yalnızca geliştirme içindir.
