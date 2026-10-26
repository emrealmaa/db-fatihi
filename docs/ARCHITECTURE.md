# Mimari

## Genel
```
Ön yüz (React/Vite) -> API (Node/Express) -> PostgreSQL 15+
                         giris_app / garson_app / kasiyer_app / yonetici_app
```
İş mantığı veritabanındadır: prosedürler, tetikleyiciler, kısıtlar. API ince kalır.
Personel uygulamaya kendi kullanıcı adı/parolasıyla girer (`fn_personel_giris`); API o personelin
rolüne karşılık gelen veritabanı rolüyle bağlanır ve her transaction başında
`set_config('app.personel_id', ...)` ile işlemi yapan personeli bildirir.

## İş modeli (Karavana)
- Kişi başı sabit **giriş ücreti** (tüm masalarda aynı, `ayar` tablosunda). Masa açılırken oturuma kopyalanır.
- Hesap = kişi sayısı × giriş ücreti + siparişler − indirim. Oyun ve süre ücreti yoktur.
- Öğrenci indirimi ileride: `kullanici.ogrenci` ve `oturum.indirim_tutari` alanları hazır.
- Masa açılırken müşteri telefonla aranır; kayıtlı değilse aynı adımda kaydedilir (`ayar.kayit_zorunlu`).
- Her masa aynı anda tek oyun oynar. Ödeme nakit veya kart; hesap bölünmez.

## Tablolar (13)
| Tablo | Amaç |
|---|---|
| ayar | Tek satır: giriş ücreti, seçim süresi, kayıt zorunluluğu |
| kullanici | Müşteri (ad, telefon, isteğe bağlı e-posta, öğrenci mi) |
| personel | Garson/kasiyer/yönetici; bcrypt parola hash'i |
| kategori, oyun | Oyun kataloğu; `oyun.toplam_adet` fiziksel kopya sayısı |
| masa | Masa numarası ve kapasite |
| oturum | Masanın açılıp kapanana kadarki hesap birimi; giriş ücreti, indirim, açan personel |
| oturum_oyun | Hangi oturum hangi oyunu oynuyor/oynadı |
| bekleme | Oyun bekleyen masa kuyruğu |
| urun_kategori, urun | Menü; stok ve kritik stok seviyesi |
| siparis | Masa siparişleri (fiyat sipariş anında kopyalanır, siparişi alan personel) |
| odeme | Kapanan her oturumun tek ödemesi (nakit/kart, tutar, kasiyer) |

Müsait adet saklanmaz, `fn_musait_adet` ile hesaplanır (tutarsızlık riski yok).

## Seçim hakkı akışı (her oyunun kendi sırası)
1. Masa istediği oyunun alınabilir kopyası yoksa `sp_bekleme_ekle(oturum, oyun)` ile **o oyunun** sırasına girer (`BEKLIYOR`).
   Müsait oyun için ve kişi sayısına uymayan oyun için sıraya girilemez.
2. Bir kopya boşalınca (`sp_oyun_bitir`, `sp_oturum_kapat`, sıradan çıkma) `sp_sirayi_ilerlet` çalışır: her oyun için,
   ayrılmamış boş kopya kaldıkça o oyunun sırasındaki ilk masaya `SECIM_HAKKI` verilir — kopya o masaya **ayrılır**.
3. Ayrılmış kopyayı başka masa alamaz (tetikleyici: müsait − ayrılan ≥ 1) — sıra atlanamaz. Diğer oyunlar serbesttir;
   bu sayede bir masanın beklemesi kafeyi kilitlemez.
4. Hak sahibi masa `sp_oyun_sec` ile ayrılan oyunu alır (`TAMAMLANDI`); başka bir oyun başlatırsa kaydı `IPTAL` olur ve kopya sıradakine geçer.
5. `sp_secim_suresi_doldur` (API zamanlayıcısı çağırır) süreyi (`ayar.secim_suresi_dk`, 5 dk) aşanı
   `ATLANDI` yapıp o oyunun sırasının sonuna ekler.

## Kısıtlar
- PK/FK: tüm tablolar. UNIQUE: müşteri e-posta/telefon, personel kullanıcı adı/telefon, masa_no, oyun/ürün/kategori adı, ödeme başına tek oturum.
- CHECK: telefon/e-posta/kullanıcı adı formatı, personel rolü, ödeme türü, adet/stok/fiyat ≥ 0, oyuncu aralığı, kapanış ≥ açılış, bekleme durumu, ayar tek satır.
- Kısmi UNIQUE index: masada tek açık oturum, oturumda tek aktif oyun, kuyrukta tek aktif kayıt.
- Tetikleyici: kişi ≤ masa kapasitesi; oyun başlarken oturum açık, oyun aktif, müsait kopya var, kopya sıradaki masaya ayrılmamış ve oyuncu sayısı uygun (satır kilidiyle yarış koşulu önlenir); kapanmış oturuma sipariş eklenemez.

## Fonksiyonlar, prosedürler, view'lar
- Fonksiyon (10): `fn_aktif_personel`, `fn_musait_adet`, `fn_ayrilan_adet`, `fn_hesap_detay`, `fn_hesap_hesapla`, `fn_musteri_bul`, `fn_personel_giris`, `fn_telefon_maskele`, `fn_email_maskele`, `fn_ad_maskele`
- Prosedür (15): `sp_musteri_kaydet`, `sp_oturum_ac`, `sp_sirayi_ilerlet`, `sp_bekleme_ekle`, `sp_bekleme_iptal`, `sp_oyun_baslat`, `sp_oyun_sec`, `sp_oyun_bitir`, `sp_secim_suresi_doldur`, `sp_siparis_ver`, `sp_siparis_iptal`, `sp_oturum_kapat`, `sp_personel_ekle`, `sp_personel_parola`, `sp_stok_ekle`
- View (13): `v_musait_oyunlar`, `v_masa_durumu`, `v_bekleme_sirasi`, `v_musteri_maskeli`, `v_menu`, `v_oturum_siparisleri`, `v_acik_hesaplar`, `v_gunluk_ciro`, `v_oyun_populerlik`, `v_personel_maskeli`, `v_personel_performans`, `v_kritik_stok`, `v_urun_satis`

## Yetki ve maskeleme
| Rol | Yapabildiği |
|---|---|
| rol_giris | Yalnızca `fn_personel_giris` (hiçbir tablo/view okuyamaz) |
| rol_garson | Maskeli view'lar, menü, müşteri arama/kayıt, oturum/oyun/kuyruk/sipariş prosedürleri. Ham `kullanici`/`personel` yasak |
| rol_kasiyer | Garson + açık hesaplar, ciro, `sp_oturum_kapat` (ödeme), hesap fonksiyonları |
| rol_yonetici | Kasiyer + tüm tablolar (maskesiz), raporlar, personel/stok yönetimi |

Login rolleri: `giris_app`, `garson_app`, `kasiyer_app`, `yonetici_app`. Prosedürler ve hesap fonksiyonları `SECURITY DEFINER` + sabit `search_path`. Not: PostgreSQL fonksiyon çalıştırma iznini çağıran role göre kontrol eder, bu yüzden view'daki maskeleme fonksiyonları ayrıca garsona açılmıştır.

## Sorgu performansı
Kısmi indexler: aktif oturum_oyun (müsait adet sayımı), açık oturum, bekleyen kuyruk, kapanmış oturum. Ek: `siparis(oturum_id)`, `siparis(personel_id)`, `oturum(kullanici_id)`, `odeme(zaman)`. `EXPLAIN ANALYZE` kanıtları: `docs/PERFORMANS.md`.

## Testler
`db/tests/*.test.js` (node:test): kısıtlar, kuyruk akışı, hesap/ödeme, rol yetkileri. Her test temiz veritabanıyla başlar.
- `npm run db:test` — gerçek PostgreSQL (.env)
- `npm run db:test:lite` — kurulumsuz PGlite
