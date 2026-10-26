# Yol Haritası

Geliştiriciler: Enes Öztürk, Emre Alma. Teslim: 27 Aralık 2026 23:59 (sunum son hafta).

## Faz 1 – Veritabanı çekirdeği (TAMAM)
- [x] Docker ortamı (PostgreSQL 15, port 5433)
- [x] 9 tablo, kısıtlar, tetikleyiciler, kısmi indexler
- [x] 6 fonksiyon, 9 prosedür, 7 view
- [x] Roller, yetkiler, maskeleme; seed veri
- [x] Elle test: kuyruk akışı, kısıt ihlalleri, rol izinleri

## Faz 2 – Uygulama ve ön yüz
- [ ] Stack kararı (öneri: Node.js + Express + `pg`, ön yüz React/Vite veya sade HTML)
- [ ] Rol bazlı giriş (garson/kasiyer/yönetici -> ilgili DB rolü)
- [ ] Ekranlar: masa durumu, oyun kataloğu ve müsait adet, bekleme sırası ve seçim ekranı, sipariş, hesap/kapanış, yönetici ciro raporu

## Faz 3 – Cila ve teslim
- [ ] `EXPLAIN ANALYZE` ile index kanıtları (index var/yok karşılaştırması)
- [ ] Otomatik testler (kısıt, kuyruk, yetki) betiği
- [ ] ER diyagramı, normalizasyon (3NF) açıklaması
- [ ] Sunum şablonu (`docs/Proje_Sunum_Şablonu.pptx`) doldurulur, herkese açık GitHub/Trello linki eklenir
- [ ] Not: `secim_suresi_doldur` için zamanlayıcı (cron/uygulama)

## Puan kriteri eşlemesi (RDBMS)
| Kriter | Karşılığı |
|---|---|
| ≥6 varlık | 9 tablo |
| Normalizasyon, anahtar stratejisi | `docs/ARCHITECTURE.md`, identity PK + FK |
| ≥5 constraint, ≥3 tür | PK, FK, UNIQUE, CHECK, kısmi UNIQUE, NOT NULL |
| Sorgu performansı | kısmi indexler (Faz 3'te kanıt) |
| ≥2 SP / ≥5 view / ≥2 UDF | 9 / 7 / 6 |
| Yetkilendirme ve maskeleme | 3 grup rol, maskeli view'lar |
| Ön yüz | Faz 2 |
