# Mimari

## Genel
```
Ön yüz (henüz seçilmedi) -> API (henüz yok) -> PostgreSQL 15
                                   garson_app / kasiyer_app / yonetici_app
```
İş mantığı veritabanındadır: prosedürler, tetikleyiciler, kısıtlar. API ince kalır.

## Tablolar (9)
| Tablo | Amaç |
|---|---|
| kullanici | Müşteri (ad, e-posta, telefon) |
| kategori, oyun | Oyun kataloğu; `oyun.toplam_adet` fiziksel kopya sayısı |
| masa | Kapasite ve kişi başı saatlik ücret |
| oturum | Masanın açılıp kapanana kadarki hesap birimi |
| oturum_oyun | Hangi oturum hangi oyunu oynuyor/oynadı |
| bekleme | Oyun bekleyen masa kuyruğu |
| urun, siparis | Cafe menüsü ve masa siparişleri (fiyat sipariş anında kopyalanır) |

Müsait adet saklanmaz, `fn_musait_adet` ile hesaplanır (tutarsızlık riski yok).

## Seçim hakkı akışı
1. Masa istediği oyun doluysa `sp_bekleme_ekle` ile kuyruğa girer (`BEKLIYOR`).
2. Bir masa oyunu iade edince (`sp_oyun_bitir`) veya hesabı kapatınca, `sp_sirayi_ilerlet` sıradaki masaya `SECIM_HAKKI` verir. Aynı anda tek masa hakka sahiptir.
3. Masa müsait oyunlar arasından `sp_oyun_sec` ile seçer; kayıt `TAMAMLANDI` olur.
4. `sp_secim_suresi_doldur(dk)` süreyi aşanı `ATLANDI` yapıp sıranın sonuna ekler.

## Kısıtlar
- PK/FK: tüm tablolar. UNIQUE: e-posta, telefon, masa_no, oyun adı.
- CHECK: telefon/e-posta formatı, adet>=0, oyuncu aralığı, kapanış>=açılış, stok>=0, bekleme durumu.
- Kısmi UNIQUE index: masada tek açık oturum, oturumda tek aktif oyun, kuyrukta tek aktif kayıt.
- Tetikleyici: kişi<=masa kapasitesi; oyun aktif, müsait kopya var ve oyuncu sayısı uygun (satır kilidiyle yarış koşulu önlenir).

## Fonksiyonlar, prosedürler, view'lar
- Fonksiyon: `fn_musait_adet`, `fn_hesap_detay`, `fn_hesap_hesapla` (masa+oyun+sipariş, 15 dk dilimi), `fn_telefon_maskele`, `fn_email_maskele`, `fn_ad_maskele`
- Prosedür: `sp_oturum_ac`, `sp_bekleme_ekle`, `sp_sirayi_ilerlet`, `sp_oyun_baslat`, `sp_oyun_sec`, `sp_oyun_bitir`, `sp_secim_suresi_doldur`, `sp_siparis_ver`, `sp_oturum_kapat`
- View: `v_musait_oyunlar`, `v_masa_durumu`, `v_bekleme_sirasi`, `v_musteri_maskeli`, `v_acik_hesaplar`, `v_gunluk_ciro`, `v_oyun_populerlik`

## Yetki ve maskeleme
| Rol | Yapabildiği |
|---|---|
| rol_garson | Maskeli view'lar, oturum/oyun/sipariş prosedürleri. Ham `kullanici` tablosu yasak |
| rol_kasiyer | Garson + açık hesaplar, ciro, `sp_oturum_kapat`, hesap fonksiyonları |
| rol_yonetici | Tüm tablolar (maskesiz) |

Login rolleri: `garson_app`, `kasiyer_app`, `yonetici_app`. Prosedürler ve hesap fonksiyonları `SECURITY DEFINER` + sabit `search_path`. Not: PostgreSQL fonksiyon çalıştırma iznini çağıran role göre kontrol eder, bu yüzden view'daki maskeleme fonksiyonları ayrıca garsona açılmıştır.

## Sorgu performansı
Kısmi indexler: aktif oturum_oyun (müsait adet sayımı), açık oturum, bekleyen kuyruk. Ek: `siparis(oturum_id)`, `oturum(kullanici_id)`. Faz 3'te `EXPLAIN ANALYZE` çıktıları dokümante edilecek.
