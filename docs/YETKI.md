# Yetkilendirme ve maskeleme kanıtı

> Bu dosya `npm run db:yetki` ile otomatik üretilir: her satır, ilgili rolle veritabanına bağlanıp
> gerçekten çalıştırılan bir sorgunun sonucudur. Yazma denemeleri geri alınır.
> Son çalıştırma: 26.10.2026 21:48:43 · PGlite

## Özet matris
✅ izin verildi · ⛔ veritabanı reddetti

| İşlem | giris_app | garson_app | kasiyer_app | yonetici_app |
|---|:---:|:---:|:---:|:---:|
| Ham müşteri tablosunu okuma | ⛔ | ⛔ | ⛔ | ✅ |
| Maskeli müşteri view'ı | ⛔ | ✅ | ✅ | ✅ |
| Telefonla müşteri arama | ⛔ | ✅ | ✅ | ✅ |
| Personel tablosu (parola hash'i) | ⛔ | ⛔ | ⛔ | ✅ |
| Masa durumu | ⛔ | ✅ | ✅ | ✅ |
| Siparişe doğrudan INSERT | ⛔ | ⛔ | ⛔ | ✅ |
| Ürün fiyatını UPDATE | ⛔ | ⛔ | ⛔ | ✅ |
| Prosedürle sipariş (sp_siparis_ver) | ⛔ | ✅ | ✅ | ✅ |
| Açık hesaplar | ⛔ | ⛔ | ✅ | ✅ |
| Hesap kapatma (sp_oturum_kapat) | ⛔ | ⛔ | ✅ | ✅ |
| Günlük ciro | ⛔ | ⛔ | ✅ | ✅ |
| Personel performans raporu | ⛔ | ⛔ | ⛔ | ✅ |
| Personel ekleme (sp_personel_ekle) | ⛔ | ⛔ | ⛔ | ✅ |
| Parola doğrulama (fn_personel_giris) | ✅ | ⛔ | ⛔ | ✅ |

## Maskeleme: aynı müşteri, farklı roller
| Rol | Sonuç |
|---|---|
| giris_app (ham tablo) | ⛔ permission denied for table kullanici |
| garson_app (ham tablo) | ⛔ permission denied for table kullanici |
| kasiyer_app (ham tablo) | ⛔ permission denied for table kullanici |
| yonetici_app (ham tablo) | `{"ad":"Ayşe","telefon":"05321234567","email":"ayse.yilmaz@mail.com"}` |
| giris_app (maskeli view) | ⛔ permission denied for view v_musteri_maskeli |
| garson_app (maskeli view) | `{"ad":"A***","soyad":"Y*****","telefon":"0532*****67","email":"a**********@mail.com"}` |
| kasiyer_app (maskeli view) | `{"ad":"A***","soyad":"Y*****","telefon":"0532*****67","email":"a**********@mail.com"}` |
| yonetici_app (maskeli view) | `{"ad":"A***","soyad":"Y*****","telefon":"0532*****67","email":"a**********@mail.com"}` |

## Ayrıntı
### Ham müşteri tablosunu okuma
```sql
SELECT ad, telefon, email FROM kullanici LIMIT 1
```
- **giris_app:** ⛔ permission denied for table kullanici
- **garson_app:** ⛔ permission denied for table kullanici
- **kasiyer_app:** ⛔ permission denied for table kullanici
- **yonetici_app:** `{"ad":"Ayşe","telefon":"05321234567","email":"ayse.yilmaz@mail.com"}`

### Maskeli müşteri view'ı
```sql
SELECT ad, soyad, telefon, email FROM v_musteri_maskeli LIMIT 1
```
- **giris_app:** ⛔ permission denied for view v_musteri_maskeli
- **garson_app:** `{"ad":"A***","soyad":"Y*****","telefon":"0532*****67","email":"a**********@mail.com"}`
- **kasiyer_app:** `{"ad":"A***","soyad":"Y*****","telefon":"0532*****67","email":"a**********@mail.com"}`
- **yonetici_app:** `{"ad":"A***","soyad":"Y*****","telefon":"0532*****67","email":"a**********@mail.com"}`

### Telefonla müşteri arama
```sql
SELECT ad, soyad, telefon FROM fn_musteri_bul('05321234567')
```
- **giris_app:** ⛔ permission denied for function fn_musteri_bul
- **garson_app:** `{"ad":"A***","soyad":"Y*****","telefon":"0532*****67"}`
- **kasiyer_app:** `{"ad":"A***","soyad":"Y*****","telefon":"0532*****67"}`
- **yonetici_app:** `{"ad":"A***","soyad":"Y*****","telefon":"0532*****67"}`

### Personel tablosu (parola hash'i)
```sql
SELECT kullanici_adi, parola_hash FROM personel LIMIT 1
```
- **giris_app:** ⛔ permission denied for table personel
- **garson_app:** ⛔ permission denied for table personel
- **kasiyer_app:** ⛔ permission denied for table personel
- **yonetici_app:** `{"kullanici_adi":"yonetici","parola_hash":"$2a$06$hGC4VEjTsWSHy2jUxli.o.gpB7qwPSoA52DAG06TitVH6acsfoMLW"}`

### Masa durumu
```sql
SELECT masa_no, durum FROM v_masa_durumu LIMIT 1
```
- **giris_app:** ⛔ permission denied for view v_masa_durumu
- **garson_app:** `{"masa_no":1,"durum":"DOLU"}`
- **kasiyer_app:** `{"masa_no":1,"durum":"DOLU"}`
- **yonetici_app:** `{"masa_no":1,"durum":"DOLU"}`

### Siparişe doğrudan INSERT
```sql
INSERT INTO siparis (oturum_id, urun_id, personel_id, adet, birim_fiyat) VALUES (1, 1, 3, 1, 0)
```
- **giris_app:** ⛔ permission denied for table siparis
- **garson_app:** ⛔ permission denied for table siparis
- **kasiyer_app:** ⛔ permission denied for table siparis
- **yonetici_app:** çalıştı

### Ürün fiyatını UPDATE
```sql
UPDATE urun SET fiyat = 0 WHERE id = 1
```
- **giris_app:** ⛔ permission denied for table urun
- **garson_app:** ⛔ permission denied for table urun
- **kasiyer_app:** ⛔ permission denied for table urun
- **yonetici_app:** çalıştı

### Prosedürle sipariş (sp_siparis_ver)
```sql
CALL sp_siparis_ver(1, 3, 1, NULL)
```
- **giris_app:** ⛔ permission denied for procedure sp_siparis_ver
- **garson_app:** `{"p_siparis_id":5}`
- **kasiyer_app:** `{"p_siparis_id":6}`
- **yonetici_app:** `{"p_siparis_id":7}`

### Açık hesaplar
```sql
SELECT masa_no, toplam FROM v_acik_hesaplar LIMIT 1
```
- **giris_app:** ⛔ permission denied for view v_acik_hesaplar
- **garson_app:** ⛔ permission denied for view v_acik_hesaplar
- **kasiyer_app:** `{"masa_no":1,"toplam":640}`
- **yonetici_app:** `{"masa_no":1,"toplam":640}`

### Hesap kapatma (sp_oturum_kapat)
```sql
CALL sp_oturum_kapat(2, 'NAKIT', NULL)
```
- **giris_app:** ⛔ permission denied for procedure sp_oturum_kapat
- **garson_app:** ⛔ permission denied for procedure sp_oturum_kapat
- **kasiyer_app:** `{"p_toplam":375}`
- **yonetici_app:** `{"p_toplam":375}`

### Günlük ciro
```sql
SELECT * FROM v_gunluk_ciro
```
- **giris_app:** ⛔ permission denied for view v_gunluk_ciro
- **garson_app:** ⛔ permission denied for view v_gunluk_ciro
- **kasiyer_app:** çalıştı
- **yonetici_app:** çalıştı

### Personel performans raporu
```sql
SELECT personel, siparis_sayisi FROM v_personel_performans LIMIT 1
```
- **giris_app:** ⛔ permission denied for view v_personel_performans
- **garson_app:** ⛔ permission denied for view v_personel_performans
- **kasiyer_app:** ⛔ permission denied for view v_personel_performans
- **yonetici_app:** `{"personel":"Deniz Aydın","siparis_sayisi":0}`

### Personel ekleme (sp_personel_ekle)
```sql
CALL sp_personel_ekle('A','B','05301119999','GARSON','kanit','parola12',NULL,NULL)
```
- **giris_app:** ⛔ permission denied for procedure sp_personel_ekle
- **garson_app:** ⛔ permission denied for procedure sp_personel_ekle
- **kasiyer_app:** ⛔ permission denied for procedure sp_personel_ekle
- **yonetici_app:** `{"p_personel_id":5}`

### Parola doğrulama (fn_personel_giris)
```sql
SELECT personel_id, rol FROM fn_personel_giris('garson','karavana123')
```
- **giris_app:** `{"personel_id":3,"rol":"GARSON"}`
- **garson_app:** ⛔ permission denied for function fn_personel_giris
- **kasiyer_app:** ⛔ permission denied for function fn_personel_giris
- **yonetici_app:** `{"personel_id":3,"rol":"GARSON"}`
