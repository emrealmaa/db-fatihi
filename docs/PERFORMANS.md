# Sorgu performansı: index kanıtları

> Bu dosya `npm run db:performans` ile otomatik üretilir. Son çalıştırma: 26.10.2026 21:48:39
> Ortam: PGlite (WebAssembly, tek iş parçacığı). Süreler gerçek PostgreSQL'den farklıdır; oranlar ve planlar göstergedir.

## Veri hacmi
| Tablo | Satır |
|---|---:|
| oturum | 100.003 |
| oturum_oyun | 100.002 |
| siparis | 400.003 |
| odeme | 100.000 |
| bekleme | 25.002 |
| kullanici | 10.007 |

Veri son iki yıla yayılmış kapanmış oturumlardan oluşur (her oturumda 1 oyun, 4 sipariş, 1 ödeme).
Her sorgu 5 kez çalıştırılıp **medyan** süre alındı. Index'siz ölçümde index bir transaction içinde
düşürülüp ölçüm sonrası geri alındı (`DROP INDEX` + `ROLLBACK`).

## Özet
| Sorgu | Index | Index'li (ms) | Index'siz (ms) | Kat |
|---|---|---:|---:|---:|
| Bir oyunun masadaki kopyaları (fn_musait_adet) | `ix_oturum_oyun_aktif_oyun`, `uq_oturum_oyun_aktif` | 0.160 | 20.431 | 127.7× |
| Masanın açık oturumu | `uq_oturum_masa_acik` | 0.050 | 18.747 | 374.9× |
| Bir hesabın siparişleri | `ix_siparis_oturum` | 0.084 | 54.186 | 645.1× |
| Son 7 günün cirosu | `ix_odeme_zaman` | 4.031 | 43.596 | 10.8× |
| Bir oyunun sırasındaki ilk masa | `ix_bekleme_sira`, `uq_bekleme_oturum_aktif` | 0.037 | 6.617 | 178.8× |
| Müşterinin geçmiş ziyaretleri | `ix_oturum_kullanici` | 0.121 | 15.670 | 129.5× |

## Ayrıntı
### Bir oyunun masadaki kopyaları (fn_musait_adet)
```sql
SELECT count(*) FROM oturum_oyun WHERE oyun_id = 1 AND bitis IS NULL
```
- **Neden önemli:** Her oyun listesinde her oyun için çalışır; geçmiş kayıtlar büyüdükçe tam tarama pahalılaşır. Kısmi index yalnızca aktif (bitis IS NULL) satırları içerir.
- **Index'li plan:** Index Scan (uq_oturum_oyun_aktif)
- **Index'siz plan:** Seq Scan (oturum_oyun)

### Masanın açık oturumu
```sql
SELECT id FROM oturum WHERE masa_id = 1 AND kapanis IS NULL
```
- **Neden önemli:** Masa panosu ve masa açma kontrolü. Kısmi UNIQUE index hem kuralı (masada tek açık oturum) hem aramayı sağlar.
- **Index'li plan:** Index Scan (uq_oturum_masa_acik)
- **Index'siz plan:** Seq Scan (oturum)

### Bir hesabın siparişleri
```sql
SELECT sum(adet * birim_fiyat) FROM siparis WHERE oturum_id = 4242
```
- **Neden önemli:** Hesap dökümü ve açık hesaplar view'ı her masa için çalıştırır.
- **Index'li plan:** Index Scan (ix_siparis_oturum)
- **Index'siz plan:** Seq Scan (siparis)

### Son 7 günün cirosu
```sql
SELECT zaman::date, sum(tutar) FROM odeme WHERE zaman >= now() - interval '7 days' GROUP BY 1
```
- **Neden önemli:** Kasa ekranı ve ciro raporu; tarih aralığı index ile doğrudan bulunur.
- **Index'li plan:** Index Scan (ix_odeme_zaman)
- **Index'siz plan:** Seq Scan (odeme)

### Bir oyunun sırasındaki ilk masa
```sql
SELECT id FROM bekleme WHERE oyun_id = 1 AND durum = 'BEKLIYOR' ORDER BY id LIMIT 1
```
- **Neden önemli:** Her oyun iadesinde çalışır (sp_sirayi_ilerlet). Geçmiş kayıtlar binlerce olsa da aktif sıra birkaç satırdır.
- **Index'li plan:** Index Only Scan (ix_bekleme_sira)
- **Index'siz plan:** Index Scan (bekleme_pkey)

### Müşterinin geçmiş ziyaretleri
```sql
SELECT count(*), max(acilis) FROM oturum WHERE kullanici_id = 77
```
- **Neden önemli:** Müşteri geçmişi ve FK silme kontrolü.
- **Index'li plan:** Bitmap Heap Scan (oturum) + Bitmap Index Scan (ix_oturum_kullanici)
- **Index'siz plan:** Seq Scan (oturum)
