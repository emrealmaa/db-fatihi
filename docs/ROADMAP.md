# Yol Haritası

Geliştiriciler: Enes Öztürk, Emre Alma. Teslim: 27 Aralık 2026 23:59 (sunum son hafta).

## Faz 1 – Veritabanı çekirdeği (TAMAM)
- [x] PostgreSQL 18 (Docker, yerel kurulum veya kurulumsuz PGlite)
- [x] Karavana iş modeli: kişi başı giriş ücreti + sipariş, nakit/kart ödeme, personel kaydı
- [x] 13 tablo, kısıtlar, 6 tetikleyici, kısmi indexler
- [x] 12 fonksiyon, 16 prosedür, 15 view
- [x] Roller (giriş/garson/kasiyer/yönetici), yetkiler, maskeleme
- [x] 62 otomatik test (kısıt, kuyruk, hesap/ödeme, yetki, VIP) — `npm run db:test` (ayrı `karavana_test` veritabanında)
- [x] VIP Kulüp: yalnızca VIP üyelerin kata ve 10 ağır oyuna erişimi, veritabanı tetikleyicisiyle (`07_vip_kulup.sql`, `08_vip_musteri.sql`)

## Faz 2 – Uygulama ve ön yüz (TAMAM, gerçek veriyle deneme bekliyor)
- [x] Node.js + Express API, personel girişi (JWT), rol bazlı DB bağlantısı, 12 API testi
- [x] React + Vite ön yüz: masa panosu, oyun kataloğu, bekleme sırası ve seçim, sipariş, kasa, raporlar, yönetim
- [x] Seçim süresi zamanlayıcısı (API içinde)
- [ ] Karavana'nın gerçek verisi (masalar, oyunlar, menü, giriş ücreti, personel) → `06_seed.sql`
- [ ] Ekip olarak elle deneme ve geri bildirim

## Faz 3 – Kanıt ve teslim
- [x] `EXPLAIN ANALYZE` index kanıtları betiği → `docs/PERFORMANS.md` (gerçek PostgreSQL'de yeniden çalıştırılacak)
- [x] Yetki/maskeleme kanıtı betiği → `docs/YETKI.md`
- [x] ER diyagramı (`docs/ER.md`), normalizasyon ve anahtar stratejisi (`docs/NORMALIZASYON.md`)
- [x] Sunum içeriği ve demo akışı (`docs/SUNUM.md`)
- [x] Gerçek PostgreSQL 18'de `npm run db:performans` ve `npm run db:yetki` ile raporlar yenilendi (yetki kanıtına VIP denemeleri eklendi)
- [x] Ekran görüntüleri alındı (`docs/ekran/`)
- [x] Sunum şablonu dolduruldu: `docs/Karavana_Sunum.pptx` (16 slayt, konuşma notlarıyla)
- [ ] Repo herkese açık mı kontrol et, linki sunuma ekle
- [x] Öğrenci indirimi: öğrenci başına giriş ücretinin `ayar.ogrenci_indirim_orani` kadarı (varsayılan %50), oturuma kopyalanır

## Puan kriteri eşlemesi (RDBMS)
| Kriter | İstenen | Karşılığı | Nerede |
|---|---|---|---|
| Varlık sayısı | ≥ 6 | 13 tablo | `01_schema.sql`, `docs/ER.md` |
| Normalizasyon, anahtar stratejisi | – | 3NF, identity PK, doğal anahtarlara UNIQUE, bilinçli anlık görüntü sütunları | `docs/NORMALIZASYON.md` |
| Constraint | ≥ 5, ≥ 3 tür | PK, FK, UNIQUE, CHECK (36), NOT NULL, kısmi UNIQUE index, tetikleyici kuralları (6 tetikleyici) | `01_schema.sql`, `02_functions.sql` |
| Sorgu performansı | – | 11 index (7'si kısmi); 6 sorguda index'li/index'siz ölçüm | `docs/PERFORMANS.md` |
| Stored procedure | ≥ 2 | 16 | `04_procedures.sql`, `07_vip_kulup.sql` |
| View | ≥ 5 | 15 | `03_views.sql`, `07_vip_kulup.sql` |
| Kullanıcı tanımlı fonksiyon | ≥ 2 | 12 | `02_functions.sql`, `07_vip_kulup.sql` |
| Yetkilendirme ve maskeleme | – | 4 grup rol + 4 login rolü, SECURITY DEFINER, maskeli view'lar, bcrypt | `05_security.sql`, `docs/YETKI.md` |
| Ön yüz | – | React uygulaması, rol bazlı ekranlar | `app/web` |
| Test | – | 62 DB + 12 API testi | `db/tests`, `app/api/test` |
