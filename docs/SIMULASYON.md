# Simülasyon

Yönetici menüsündeki **Simülasyon** sekmesi, Karavana'yı 3 katlı, izometrik, piksel-art bir kafe olarak
canlandırır. Müşteri grupları ve garsonlar kendi kendine hareket eder; **her işlem gerçek API ve veritabanı
üzerinden yapılır**, bu yüzden simülasyon çalıştıkça masa panosu, kasa, raporlar ve personel performansı gerçek
veriyle dolar. Kurallar (kapasite, oyun sırası, stok, ödeme) veritabanında uygulanır; motor yalnızca sonuca göre davranır.

## Katlar
| Kat | Konsept | İçerik |
|---|---|---|
| 1 | Giriş & Espresso Bar | Kapı, kasa ve kasiyer, espresso barı, küçük masalar, masa bekleyenler için bekleme alanı (koltuk) |
| 2 | Strateji Salonu | Raf dolusu kutu oyunu, geniş masalar, oyun barı, loş atmosfer |
| 3 | VIP & FRP | Büyük yuvarlak masalar, ejderha heykeli, sancaklar, VIP bar |

Masalar `masa.kat` sütununa göre yerleşir (her katta `masa_no` sırasıyla yuvalara). Yerleşim `app/web/src/simulasyon/harita.js` içinde.

## Müşteri döngüsü (durum makinesi)
```
GELIYOR ─► MASAYA_GIDIYOR ─► MASA_ACILIYOR ─► OYUN_SECIYOR ─┬─► OYNUYOR ──► (bir oyun daha?) ─► HESAP ─► ODUYOR ─► CIKIYOR
   │              ▲                            (POST /masalar/:id/ac)    │      ▲  (POST oyun)
   └► MASA_BEKLIYOR┘ (bekleme alanı, sabır 30 dk)                        └► SIRADA ┘ (POST bekleme → hak gelince POST sec)
```
- **Geliş:** popülerliğe bağlı aralıklarla 1–10 kişilik gruplar kapıdan girer. Boş ve sığan masa yoksa bekleme alanına geçer;
  masa boşalınca geliş sırasıyla oturur. Sabrı tükenen grup ayrılır (popülerlik düşer).
- **Masa açma:** grup masaya varınca karşılayan garson adına `POST /masalar/:id/ac` (müşteri aynı adımda kaydedilir).
- **Oyun:** kata göre tercih edilen kategoriden oyun seçilir. Kopya varsa başlatılır; yoksa grup ya o oyunun sırasına girer
  ya da müsait başka bir oyun seçer. Hak gelince ayrılan kopyayı alır (`POST /bekleme/:id/sec`).
- **Sipariş:** oynarken baloncukla sipariş ister ("Kahve lazım!"); boştaki garson gelip alır (`POST siparisler`, o garson adına),
  bara gidip hazırlar, masaya getirir. Stok yetmezse veritabanı reddeder ve grup "Tükenmiş mi?!" der.
- **Ödeme:** oyun bitince grup kasaya yürür, kasiyer adına `POST /oturumlar/:id/kapat` (nakit/kart). Masa kirli kalır; garson temizler.

## Garsonlar
Garsonlar veritabanındaki **aktif GARSON** personeldir. Hız, sipariş alma hızı ve servis yeteneği personel kimliğinden türetilir
(her açılışta aynı). Görev sırası: kendi katındaki en eski istek önce. Yan panel her garsonun anlık görevini, bu oturumdaki servis
sayısını ve veritabanındaki toplam sipariş sayısını (`v_personel_performans`) gösterir. Yönetici, `X-Personel` başlığıyla
garson adına işlem yaptığı için siparişler gerçekten o garsona yazılır.

## Ekran
- **Üst panel:** oyun takvimi ve saati (1× hızda 1 sn = 1 oyun dakikası), bugünkü kasa (veritabanı cirosu), açık hesaplar,
  içerideki müşteri ve masa bekleyen sayısı, popülerlik, hız (duraklat / 1× / 2× / 4×).
- **Alt panel:** Kat 1 / 2 / 3 geçişi (kattaki kişi sayısıyla), Garsonlar, Olay günlüğü, Oyun kütüphanesi.
- **Masaya tıklama:** durum (Boş / Dolu / Hizmet bekliyor / Oyun sırasında / Temizleniyor), oynanan oyun ve eğlence skoru,
  aktif siparişler (veritabanından), kalış süresi, biriken hesap (`fn_hesap_detay`), atanan garson.

Personelin normal arayüzden yaptığı işlemler de simülasyona yansır: arayüzden açılan masa simülasyon tarafından devralınır,
dışarıdan kapatılan hesabın müşterileri kalkar.

## Kod
| Dosya | Görev |
|---|---|
| `simulasyon/harita.js` | Kat yerleşimleri, masa yuvaları, oturma yerleri, A* yol bulma |
| `simulasyon/cizim.js` | Piksel-art izometrik çizim (karolar, kutular, karakter sprite'ları, baloncuklar) — harici görsel yok |
| `simulasyon/motor.js` | Durum makineleri, görev kuyruğu, veritabanı eşitlemesi, API çağrıları |
| `sayfalar/Simulasyon.jsx` | HUD, kat/panel düğmeleri, masa detayı, oyun kütüphanesi |

## Sunumda
Temiz veriyle başlatın (`npm run db:kur`), Simülasyon'u 2× hızda birkaç dakika çalıştırın, ardından Raporlar → personel
performansı ve ürün satışlarını, Kasa → günlük ciroyu gösterin: hepsi simülasyonun veritabanına yazdığı gerçek kayıtlardır.
