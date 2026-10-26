# Simülasyon

Yönetici menüsündeki **Simülasyon** sekmesi, Karavana'yı 3 katlı, izometrik, piksel-art bir kafe olarak
canlandırır. Müşteri grupları ve garsonlar kendi kendine hareket eder; **her işlem gerçek API ve veritabanı
üzerinden yapılır**, bu yüzden simülasyon çalıştıkça masa panosu, kasa, raporlar ve personel performansı gerçek
veriyle dolar. Kurallar (kapasite, oyun sırası, stok, ödeme) veritabanında uygulanır; motor yalnızca sonuca göre davranır.

## Katlar
| Kat | Konsept | Masa | İçerik |
|---|---|---|---|
| 1 | Giriş & Espresso Bar | 10 (2–4 kişilik) | Kapı ve paspas, kasa ve kasiyer, vitrinli espresso barı, menü tabelası, bekleme alanı (koltuk) |
| 2 | Strateji & Kütüphane Salonu | 10 (4–6 kişilik) | Üç duvarı kaplayan kutu oyunu kütüphanesi, oyun barı, loş ışık ve lamba ışık havuzları |
| 3 | VIP & FRP Özel Bölgesi | 4 büyük (8–12 kişilik) | FRP harita masaları ve örtülü yuvarlak masalar, deri koltuklar, sancaklar, ejderha heykeli, lüks halı, VIP ışığı |

VIP (kat 3) grupları daha uzun oynar (×1.4), daha sık ve bol sipariş verir (en fazla 6 sipariş, kalem başına 1–3 adet)
ve ikinci/üçüncü oyuna kalma olasılıkları daha yüksektir.

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

## Sabır ve öfke
Her grubun 0–100 arası **sabrı** vardır. Bekleme türüne göre dakikada azalır, oynarken toparlanır, servis gelince +15 artar:

| Bekleme | Azalma (oyun dk başına) |
|---|---|
| Masa (kaldırımda veya bekleme alanında) | 2,2 |
| Servis (sipariş 4 dakikadan uzun bekliyorsa) | 1,8 |
| Oyun sırası | 0,7 |

VIP gruplar (kat 3) 1,3 kat daha sabırsızdır. Liderin başında durum ikonu: 😊 (≥70) → 😐 (≥40) → 😠 ve kırmızılaşan
öfke barı (≥20) → 😡 ve yanıp sönen kırmızı ünlem. 40 ve 20 eşiklerinde sabırsızlık cümlesi çıkar ("Garson nerede?").

Sabır sıfırlanınca grup **"Çok bekledik, gidiyoruz!"** diyerek terk eder:
- Masa bulamadan gidenler kuyruktan çıkıp sokaktan ayrılır.
- Masadakilerin **servis edilmemiş siparişleri veritabanında iptal edilir** (`DELETE /siparisler/:id` → `sp_siparis_iptal`,
  stok geri döner); tüketilen kadar hesap kasada kapatılır.
- Popülerlik 3 puan düşer ve memnuniyet 0 olarak ortalamaya girer; HUD'da "Terk eden grup" sayacı artar.

## Dış mekân ve kapı önü kuyruğu
Kapı ön cephededir (güney duvarı). Kamera ön cepheye dönükken kat 1'in önünde **kaldırım, sokak, bordür, şerit çizgileri**,
alçak cephe duvarı, kapı direkleri, çizgili **tente**, "KARAVANA" tabelası, tebeşir menü tahtası, saksılar, bank ve sokak lambası
görünür (cephe kesit olarak alçak çizilir ki içerisi görünsün). Müşteriler sokağın sağından yürüyerek gelir:
1. Kuyruk boşsa ve boş masa varsa doğrudan masaya, yoksa içerideki bekleme alanına (12 kişi) geçer.
2. İçerisi doluysa kaldırımda **tek sıra** kuyruğa girer (15 kişilik, kapıya en yakın yer önce). Kuyruk sırayla ilerler:
   yalnızca baştaki grup içeri girebilir; masa boşalınca masaya, bekleme alanında yer açılınca içeri yürür.
3. Kuyruk da doluysa "Çok kalabalık…" deyip gider.

## Diyaloglar
`simulasyon/diyalog.js` havuzu: genel masa sohbetleri ("Sıra kimde?", "Zar atıyorum!", "Kural kitabına baksana",
"Enkaz kartı bende kaldı!", "Sıramı pas geçiyorum", "Bu hamle oyunu bitirir!"...), **oyuna özel** cümleler (Catan'da saman/odun
takası, Carcassonne'da meeple, Ticket to Ride rotaları, Codenames ipuçları, Pandemic salgını, Uno...), **siparişe göre**
cümleler ("Bir filtre kahve daha söylesek mi?", "Zihnim açılsın diye Türk kahvesi alayım", "Masada içecek alanını
daraltmayalım"), servis sonrası teşekkürler ve bekleme türüne göre sabırsızlık cümleleri.

## Mobilya ve atmosfer
- **Masalar:** dört ayak + köşeleri yumuşatılmış ahşap tabla (damarlı) + oyun matı: kat 1 krem örtü, kat 2 yeşil keçe,
  kat 3 kırmızı örtü veya FRP harita masası. Oynanan oyunun kutusu, piyonlar ve zar masada görünür.
- **Sandalyeler:** oturak + masaya ters yönde sırtlık; VIP'de kollu deri koltuk. Sırtlık kameraya dönükse oturanın
  önünde çizilir (ayrı derinlik öğesi).
- **Bar:** fincan ısıtıcılı espresso makinesi (grup başlığı, portafiltre, buhar çubuğu, damlama tepsisi, buhar), arkada şişe ve
  kavanoz rafı, fanuslu pasta standı, vitrin, kasa cihazı.
- **Posterler:** Catan (altıgen ada), Carcassonne (kale ve yollar), Ticket to Ride (tren hatları), Dixit (ay ve yıldızlar),
  Pandemic (salgın haritası) ve FRP haritaları; kat 2'de kütüphane raflarının üstünde.

## Garsonlar
Garsonlar veritabanındaki **aktif GARSON** personeldir. Hız, sipariş alma hızı ve servis yeteneği personel kimliğinden türetilir
(her açılışta aynı). Görev sırası: kendi katındaki en eski istek önce. Yan panel her garsonun anlık görevini, bu oturumdaki servis
sayısını ve veritabanındaki toplam sipariş sayısını (`v_personel_performans`) gösterir. Yönetici, `X-Personel` başlığıyla
garson adına işlem yaptığı için siparişler gerçekten o garsona yazılır.

## Kamera
| Eylem | Fare / dokunma | Klavye / düğme |
|---|---|---|
| Yakınlaş / uzaklaş (imleç etrafında) | Tekerlek | `+` / `-`, ekrandaki **+ / −** |
| 90° döndür | – | `Q` / `E`, **⟲ / ⟳** |
| Kaydır | Sağ veya orta tuşla sürükle, `Space` + sol tuşla sürükle | – |
| Sıfırla | – | `0`, **Sıfırla** |

Sahne ara bir tuvale çizilir; kamera bu tuvali ekrana aktarırken `ekran = ofset + doğal × (sığdırma × yakınlık)`
dönüşümünü uygular (tıklama bunun tersiyle doğal koordinata çevrilir). **Döndürme dünya koordinatlarında** yapılır
(`harita.js: dondur`): oda 90° döner, kameraya göre arkada kalan iki duvar ve onların dekorları çizilir (kesit görünüm),
her nesnenin ve karakterin derinliği döndürülmüş koordinatların toplamıyla (rx + ry) yeniden sıralanır. Karakterlerin
yüzü de hareket yönünün ekrandaki karşılığına göre seçilir (ön/arka + ayna).

## Karakterler
16×30 piksellik sprite'lar kodla çizilir ve her poz/kare bir kez üretilip önbelleğe alınır: ön ve arka görünüm,
aynalama ile dört yön, 4 kare yürüme, oturma (uyluklar öne, bacaklar sarkık), sipariş verirken el kaldırma.
Saç stilleri, gözlük, etek, ten/saç/kıyafet renkleri kimliğe göre sabittir. Garsonlar beyaz gömlek, siyah yelek,
kırmızı papyon ve önlükle; servis sırasında elinde içecekli tepsiyle çizilir. Tüm sprite'lar otomatik dış hat alır.
Zemin ve duvarlar her kat ve açı için bir kez çizilip önbelleğe alınır.

## Merdiven
Merdivene tıklanınca **Kat değiştir** penceresi açılır (Yukarı çık / Aşağı in, hedef kattaki kişi sayısıyla).
Kat değişimi kararma + dikey kayma geçişiyle yapılır; alttaki kat düğmeleri de aynı geçişi kullanır.

## Ekran
- **Üst panel:** oyun takvimi ve saati (1× hızda 1 sn = 1 oyun dakikası), bugünkü kasa (veritabanı cirosu), açık hesaplar,
  içerideki müşteri ve masa bekleyen sayısı, popülerlik, hız (duraklat / 1× / 2× / 4×).
- **Alt panel:** Kat 1 / 2 / 3 geçişi (kattaki kişi sayısıyla), Garsonlar, Olay günlüğü, Oyun kütüphanesi.
- **Masaya tıklama:** oyunun adı ve kapak resmi (oyun adından üretilir), durum (Boş / Dolu / Hizmet bekliyor /
  Oyun sırasında / Temizleniyor), eğlence skoru, siparişler (veritabanından) ve bekleyen istek, sorumlu garson ve son servis
  zamanı, kalış süresi (oyun saati), biriken hesap (`fn_hesap_detay`: giriş + sipariş).

Personelin normal arayüzden yaptığı işlemler de simülasyona yansır: arayüzden açılan masa simülasyon tarafından devralınır,
dışarıdan kapatılan hesabın müşterileri kalkar.

## Kod
| Dosya | Görev |
|---|---|
| `simulasyon/harita.js` | Kat yerleşimleri (20×16 karo), masa yuvaları, duvar dekorları, döndürme dönüşümleri, A* yol bulma |
| `simulasyon/cizim.js` | Piksel-art izometrik çizim: döndürülebilir izdüşüm, önbellekli zemin/duvar, desenli kutular, sprite üretimi ve önbelleği, ışık, seçim (tıklama) — harici görsel yok |
| `simulasyon/motor.js` | Durum makineleri, sabır zamanlayıcıları, kapı önü kuyruğu, görev kuyruğu, veritabanı eşitlemesi, API çağrıları |
| `simulasyon/diyalog.js` | Genel, oyuna özel, siparişe özel ve sabırsızlık cümle havuzu |
| `sayfalar/Simulasyon.jsx` | Kamera (yakınlaştırma, döndürme, kaydırma), kat geçişi, HUD, paneller, merdiven penceresi, masa detayı, oyun kütüphanesi |

## Sunumda
Temiz veriyle başlatın (`npm run db:kur`), Simülasyon'u 2× hızda birkaç dakika çalıştırın, ardından Raporlar → personel
performansı ve ürün satışlarını, Kasa → günlük ciroyu gösterin: hepsi simülasyonun veritabanına yazdığı gerçek kayıtlardır.
