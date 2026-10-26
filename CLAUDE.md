# Karavana – Kutu Oyunu Cafe İşletme Sistemi

Veritabanı dersi dönem projesi. Geliştiriciler: Enes Öztürk, Emre Alma. Teslim: 27 Aralık 2026 23:59.
Seçilen yol: **PostgreSQL (RDBMS)**. Puan kriterleri `docs/ROADMAP.md` içinde.

## Komutlar
- Başlat: `make up DB=postgres` (port **5433**, 5432 başka konteynerde dolu)
- Sıfırla (init betiklerini yeniden çalıştırır): `make reset && make up DB=postgres`
- Shell: `docker compose exec postgres psql -U app karavana`
- Rol testi: `docker compose exec -e PGPASSWORD=garson_dev_pw postgres psql -U garson_app karavana`

## Kurallar
- Şema değişikliği `db/postgres/init/NN_*.sql` dosyalarında yapılır; init yalnızca boş volume'de çalışır.
- Uygulama rolleri tablolara doğrudan erişmez: view okur, `sp_*` prosedürlerini çağırır (bkz. `docs/ARCHITECTURE.md`).
- Kullanıcı verisi (ad, e-posta, telefon) garson/kasiyer için daima maskeli view'dan okunur.
- Yeni iş kuralı önce constraint/trigger olarak veritabanında yazılır, uygulama katmanı tekrar etmez.
- Postgres sürümü 15 (yerelde mevcut imaj). 17'ye geçilirse compose'ta değiştir.
- `.env` git'e girmez; parolalar yalnızca geliştirme içindir.
