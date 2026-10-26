# Yol Haritası

Geliştiriciler: Enes Öztürk, Emre Alma. Teslim: 27 Aralık 2026 23:59 (sunum son hafta).

## Faz 1 – Veritabanı çekirdeği (TAMAM)
- [x] PostgreSQL 15+ (Docker, yerel kurulum veya kurulumsuz PGlite)
- [x] Karavana iş modeli: kişi başı giriş ücreti + sipariş, nakit/kart ödeme, personel kaydı
- [x] 13 tablo, kısıtlar, 3 tetikleyici, kısmi indexler
- [x] 10 fonksiyon, 15 prosedür, 13 view
- [x] Roller (giriş/garson/kasiyer/yönetici), yetkiler, maskeleme
- [x] 44 otomatik test (kısıt, kuyruk, hesap/ödeme, yetki) — `npm run db:test`

## Faz 2 – Uygulama ve ön yüz (TAMAM, gerçek veriyle deneme bekliyor)
- [x] Node.js + Express API, personel girişi (JWT), rol bazlı DB bağlantısı, 9 API testi
- [x] React + Vite ön yüz: masa panosu, oyun kataloğu, bekleme sırası ve seçim, sipariş, kasa, raporlar, yönetim
- [x] Seçim süresi zamanlayıcısı (API içinde)
- [ ] Karavana'nın gerçek verisi (masalar, oyunlar, menü, giriş ücreti, personel) → `06_seed.sql`
- [ ] Ekip olarak elle deneme ve geri bildirim

## Faz 3 – Kanıt ve teslim
- [x] `EXPLAIN ANALYZE` index kanıtları betiği → `docs/PERFORMANS.md` (gerçek PostgreSQL'de yeniden çalıştırılacak)
- [x] Yetki/maskeleme kanıtı betiği → `docs/YETKI.md`
- [x] ER diyagramı (`docs/ER.md`), normalizasyon ve anahtar stratejisi (`docs/NORMALIZASYON.md`)
- [x] Sunum içeriği ve demo akışı (`docs/SUNUM.md`)
- [ ] Gerçek PostgreSQL'de `npm run db:performans` ve `npm run db:yetki` ile raporları yenile
- [ ] Sunum şablonunu (`docs/Proje_Sunum_Şablonu.pptx`) doldur, ekran görüntüleri ekle
- [ ] Repo herkese açık mı kontrol et, linki sunuma ekle
- [ ] Öğrenci indirimi kuralı (alanlar hazır: `kullanici.ogrenci`, `oturum.indirim_tutari`)

## Puan kriteri eşlemesi (RDBMS)
| Kriter | İstenen | Karşılığı | Nerede |
|---|---|---|---|
| Varlık sayısı | ≥ 6 | 13 tablo | `01_schema.sql`, `docs/ER.md` |
| Normalizasyon, anahtar stratejisi | – | 3NF, identity PK, doğal anahtarlara UNIQUE, bilinçli anlık görüntü sütunları | `docs/NORMALIZASYON.md` |
| Constraint | ≥ 5, ≥ 3 tür | PK, FK, UNIQUE, CHECK (28), NOT NULL, kısmi UNIQUE index, tetikleyici kuralları | `01_schema.sql`, `02_functions.sql` |
| Sorgu performansı | – | 11 index (7'si kısmi); 6 sorguda index'li/index'siz ölçüm | `docs/PERFORMANS.md` |
| Stored procedure | ≥ 2 | 15 | `04_procedures.sql` |
| View | ≥ 5 | 13 | `03_views.sql` |
| Kullanıcı tanımlı fonksiyon | ≥ 2 | 10 | `02_functions.sql` |
| Yetkilendirme ve maskeleme | – | 4 grup rol + 4 login rolü, SECURITY DEFINER, maskeli view'lar, bcrypt | `05_security.sql`, `docs/YETKI.md` |
| Ön yüz | – | React uygulaması, rol bazlı ekranlar | `app/web` |
| Test | – | 44 DB + 9 API testi | `db/tests`, `app/api/test` |
