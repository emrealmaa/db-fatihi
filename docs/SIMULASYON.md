# Simülasyon

Yönetici menüsündeki **Simülasyon** sekmesi, Karavana'yı 3 katlı, izometrik, piksel-art bir kafe olarak
canlandırır. Müşteri grupları ve garsonlar kendi kendine hareket eder; **her işlem gerçek API ve veritabanı
üzerinden yapılır**, bu yüzden simülasyon çalıştıkça masa panosu, kasa, raporlar ve personel performansı gerçek
veriyle dolar. Kurallar (kapasite, oyun sırası, stok, ödeme) veritabanında uygulanır; motor yalnızca sonuca göre davranır.

## Katlar
| Kat | Konsept | Masa | İçerik |
|---|---|---|---|
| 1 | Giriş & Espresso Bar | 10: bar önü ve duvar kenarlarında 6 × 2 kişilik, iç salonda 4 × 4 kişilik; mutfağın önü boş | Kapı ve paspas, kasa ve kasiyer, vitrinli espresso barı, menü tabelası, bekleme alanı (koltuk) |
| 1 | (ek) | – | **Mutfak**: ocak, fırın, buzdolabı, evye, hazırlık tezgahı, ısıtıcı lambalı servis tezgahı; şef ve yardımcı şef |
| 2 | Strateji & Kütüphane Salonu | 10 (4–6 kişilik) | Kuzey duvarında tek, şık kitaplık; batı duvarında neon halı üstünde 4 **retro atari kabini** (yanıp sönen ekran), doğu duvarında 2 **tilt (pinball)** makinesi, yeni oyunlar standı, okuma köşesi, oyun barı, loş ışık |
| 3 | VIP & FRP Özel Bölgesi | 4 ferah (6–8 kişilik) | Batı duvarından ayrık, zeminden **iki kademeyle yükselen yarım daire VIP sahnesi** (arkasında kırmızı kadife perdeli kulis, kenarında yanıp sönen ışıklar, önünde loş pembe ışık havuzu; masalar etrafında yay çizer): şarkıcı, gitarist, piyanist, amfiler ve renkli spot ışıkları; boyalı nadir FRP figür kaideleri (ejderha, şövalye, büyücü), koleksiyon vitrinleri, tablolar; FRP harita masaları, deri koltuklar, VIP ışığı |

Kat 1 ve 2 **organik** yerleşimlidir: masalar elle düzensiz konumlara yerleştirildi, her masanın sandalye halkası ile komşusununki
arasında en az bir karo yürüme boşluğu vardır (yerleşim denetimi betikle doğrulandı). 1x1 masalar 2 veya 4, 2x1 masalar 6 kişiliktir;
veritabanındaki masalar kapasitelerine uyan en küçük yuvaya yerleşir. Masalar, sandalyeler ve karakterler (%25 büyütülmüş sprite) daha
büyük çizilir.

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

## Saatlik yoğunluk eğrisi
`motor.js: saatProfili` geliş hızını ve müşteri karışımını saate göre değiştirir:

| Saat | Dilim (HUD rozeti) | Geliş | Karakter |
|---|---|---|---|
| 10–13 | Sabah · kahve & kahvaltı | ×0,45 | Çok tek kişi ve izleyici; grupların ~%45'i oyunsuz kahvaltı/kahve grubu; yemek siparişi ağırlığı yüksek |
| 13–14 | Öğle | ×0,6 | Kahvaltı/öğle yemeği devam eder |
| 14–17 | Öğleden sonra · oyun grupları | ×0,9 | Oyun grupları gelir; **en az 3 masa boş kalacak** şekilde geliş kısılır |
| 17–19 | Pik saatler | ×2,6 | Büyük gruplar; masalar dolar, kapıda uzun kuyruk, sabırsızlık zirvede |
| 19–20 | Akşam | ×1,2 | Yoğun ama azalıyor |
| 20–22 | Kapanışa doğru | ×0,4 | Gelen azalır, içeridekiler ödeyip çıkar |

Kat 1'de masalar konuma göre boyutlanır: bar ve mutfağa yakın sıradakiler hızlı sirkülasyon için 2 kişilik, iç kısımdakiler
uzun oyun ve yemek için 4 kişilik (yuvaların `tercih` kapasitesi; veritabanı masaları önce tercihi uyan yuvaya yerleşir).

## Çalışma saatleri ve gün sonu
- Kafe her gün **10:00**'da açılır (açılışta yönetici adına **sabah tedariki**: stoğu azalan ürünler `sp_stok_ekle` ile tamamlanır).
- **22:00**'da kapanış süreci başlar: yeni müşteri alınmaz, kaldırımda ve bekleme alanında bekleyenler "Kapanıyormuş, yarın geliriz"
  deyip döner, masadakilerin oyunu birkaç dakikada biter, yeni sipariş ve ikinci oyun olmaz, hesaplar kapanır.
  22:15'te hâlâ içeride olan uğurlanır; HUD'da durum rozeti: **Açık · 10–22 / Kapanıyor / Kapalı**.
- Son müşteri çıkınca (≈22:15–22:40) **gün sonu fişi** yazar kasadan çıkar gibi yukarıdan süzülür (satır satır açılan, alt kenarı
  yırtık, barkodlu fiş). Tutarlar veritabanından: `GET /raporlar/donem?bas=<günün başı>` → `fn_donem_ozeti`:
  normal ve öğrenci giriş geliri, yiyecek-içecek, ek indirim, toplam ciro (nakit/kart), kapanan hesap. Müşteri akışı simülasyonun
  gün sayaçlarından: gelen kişi/grup, masaya oturan, sıkılıp terk eden (grup/kişi), kuyruk dolu diye giden, kapanışta dönen, garson
  başına servis sayısı. **Kapat · Yeni güne başla** ertesi günü 10:00'dan başlatır.
- HUD kasası da aynı kaynaktan (simülasyon gününün dönem özeti) gelir; terk sayacı günlüktür. 10× hızda bir gün ≈ 72 saniye.

## Öğrenci tarifesi
Grupların yaklaşık üçte biri öğrenci grubudur (üyelerin çoğu öğrenci), diğerlerinde ara sıra bir öğrenci bulunur. Masa açılırken
öğrenci sayısı veritabanına yazılır (`sp_oturum_ac(..., p_ogrenci)`); öğrenciler giriş ücretinin **yarısını** öder
(`ayar.ogrenci_indirim_orani`, Yönetim > Ayarlar'dan değiştirilebilir). Öğrenciler başlarında **mezuniyet kepiyle** çizilir;
masa kartında ve fişte "🎓 öğrenci" satırı görünür.

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
Kapı ön cephededir (güney duvarı); kafenin tuğla-cam ön cephesi ve tabelası kamera ön cepheye dönükken çizilir. Önde
kuyruk sırası (park bankları) ve yürüme sırası olan kaldırım, ardından ana cadde vardır. Müşteriler sokağın sağından yürüyerek gelir:
1. Kuyruk boşsa ve boş masa varsa doğrudan masaya, yoksa içerideki bekleme alanına (12 kişi) geçer.
2. İçerisi doluysa kaldırımda **tek sıra** kuyruğa girer (15 kişilik, kapıya en yakın yer önce). Kuyruk sırayla ilerler:
   yalnızca baştaki grup içeri girebilir; masa boşalınca masaya, bekleme alanında yer açılınca içeri yürür.
3. Kuyruk da doluysa "Çok kalabalık…" deyip gider.

### Şehir: 3x3 sokak bloğu (yalnızca görsel)
Sokak ambiyansı tamamen görsel katmandır: veritabanına yazmaz, sipariş/kasa/müşteri hesaplarını etkilemez, yeni tablo yoktur.
Simülasyondan yalnızca **okur**: saat, popülerlik, dışarıdaki kuyruk ve kafeden çıkan müşteriler. Bütün rastgelelik tohumludur
(`sehir/rastgele.js`); sayfa yenilense de şehir aynı kurulur.

| | Batı (x −26…−10) | Orta (−8…28) | Doğu (30…46) |
|---|---|---|---|
| **Kuzey** (y −17…−3) | Lale Apt. (kuaför), taş ev | Arka sokağa servis yüzü veren apartmanlar, Eski Han | Park & meydan: çeşmeli havuz, oyun alanı, çay bahçesi, WC, banklar, ağaçlar, güvercinler |
| **Orta** (−1…19) | Dükkân sırası: Şehir Bankası (ATM), Bakkal, Berber, Nöbetçi Eczane; Gül Apt., cumbalı ev | **KARAVANA** ve iki yanında cep parkları | Maraş Dondurmacısı, Kasap, Lokumcu, Züccaciye, Çay Ocağı · Kahvehane, apartman |
| **Güney** (22…37) | Lokanta (apartman), Ayakkabıcı | Çiçekçi, Kırtasiye, Pizza Dükkânı, Oyuncakçı, Papatya Apt., cumbalı ev | Otobüs durağı, Büfe (tost & ayran), Çamaşırhane, apartman |

- **Yollar** (`sehir/yerlesim.js`): **ana cadde** çift şerit, ağaçlı ve çiçekli orta refüj, yaya geçitleri, iki trafik ışıklı kavşak;
  **ara sokak** tek şerit parke taşı ve park cebinde duran araçlar; **arka sokak** dar, tek yön, çöp konteynerleri ve servis
  kapıları; doğu caddesi çift şerit. Kaldırımlar, bordürler (kavşak köşeleri yuvarlak), rögar kapakları, sokak lambaları,
  çöp kutuları, banklar, bisiklet park yeri.
- **Binalar tanımdan üretilir** (`sehir/binalar.js` → `sehir/binaCizim.js`). Her binanın dört yüzü ayrı tasarlanır:
  ön yüz **vitrin** (cam, kapı, çizgili tente, tabela, kapanışta inen kepenk) veya **konut** (pencere sıraları, perdeler, kapı);
  arka yüz **servis** (servis kapısı, kepenkli depo kapısı, yangın merdiveni, yağmur borusu); yan yüzler **yan** (küçük pencereler,
  yağmur borusu, elektrik panosu, afiş/grafiti, klima). Bitişik binaların birbirine bakan yüzleri otomatik **sağır duvar** olur.
  Malzeme: tuğla, sıva, taş, ahşap (cumbalı ev), cam (banka). Apartmanlarda balkon, çamaşır ipi, saksı, klima dış ünitesi.
  Çatılar: **düz** (korkuluk, ayaklı su deposu, çanak antenler, güneş paneli + termosifon, baca, havalandırma), **kiremit**
  (kat kat kırma çatı, mahya, çatı penceresi, tüten baca), **teras** (saksılar, pergola, masa).
  Özel ayrıntılar: dönen berber direği, nöbetçi eczanenin kırmızı "E"si, dondurmacının dev külahı, bankanın ATM'si.
  Dükkân adları her açıdan okunan, binanın üstünde duran ekran-sabit panolarla yazılır.
- **Görünürlük**: kameranın önünde kalıp kafeyi ekranda örten binalar **zemin katına kadar kesilir** (içi, rafları görünür);
  her döndürmede yeniden hesaplanır, fare binanın üstüne gelince bina tam görünür. Kafenin arka duvarlarının gerisinde kalan
  binalar, araçlar, eşyalar ve kişiler duvar katmanından önce çizilir.

### Maket kenarı ve yeşil
- **Maket plakası** (`DUNYA`, `PLAKA_PAYI` = 2 karo): şehir, koyu arka planın üstünde duran dikdörtgen bir dioramadır; dışında
  hiçbir şey çizilmez. Kameraya bakan iki kenarda üç katmanlı kesit (üstte zemin malzemesi, ortada iki tonlu taşlı toprak,
  altta koyu temel; sol yüz açık, sağ yüz koyu) ve altında yumuşak gölge (`MAKET_KALINLIK` = 22 px). Plaka kenarına ulaşan
  yollar kırmızı-beyaz bariyerle biter (gece reflektörler yanıp söner), şerit çizgileri kenardan bir karo önce durur. Kenar
  boyunca aralıklı çit, çalı ve ağaçlar; köşelerde ağaç kümeleri. Araçlar kenara yaklaşınca söner, kenardan belirerek girer;
  yayalar plaka içinde dolaşır, kenarda geri döner, ömrü dolunca sönerek kaybolur. En uzak yakınlaştırmada maketin tamamı görünür.
- **Cep parkları** (`BAHCELER`): kafenin iki yanında, eski Sahaf ve Simit Fırını parsellerinde. Kenarları koyu, dama desenli çim;
  iki ucu kaldırıma bağlanan kıvrımlı stabilize yol ve ince bordür taşları; büyük çınar, orta boy ve meyve ağaçları;
  kaldırıma bakan budanmış çitler (yol ağzında açık); çiçek tarhları; banklar, gece yanan bahçe lambaları, çöp kutuları;
  batıda içme çeşmesi ve sarmaşıklı çardak, doğuda kuş yemliği. Bankta oturanlar, köpeğini tasmayla gezdiren, çimde yatan
  kedi, güvercinler. Kafenin bu yanlara bakan cepheleri (ve arka cephesi) o duvar kameraya göre öndeyken ön cepheyle uyumlu
  tuğla denizlik, cam vitrin, tuğla ayaklar ve alınlıkla çizilir; yer yer sarmaşık ve duvar lambaları.
- **Yeşil sokak**: ana cadde, ara sokak ve doğu caddesi kaldırımlarında düzenli aralıklı, ızgaralı çukurlu ağaçlar (boy ve ton
  hafif farklı); refüjde ağaçların arasında çalılar ve çiçekler (yaya geçidinde kesilir); arka sokak ve doğu caddesi kaldırım
  kenarında çim şeridi; dükkân önlerinde büyük saksılar, cadde kenarında beton çiçeklikler; Eski Han, taş ev ve cumbalı evin
  cephelerinde sarmaşık; parkta ek çiçek tarhları. Kafeyi örten ağaçlar yarı saydam çizilir (`AGAC_SAYDAMLIK`), her kamera
  yönünde yeniden hesaplanır.

### Görsel gürültü
- Gece yanık pencere oranı saate göre değişir (`pencereOrani`: 18:30 ~%48, 21:00 ~%45, 22:00 ~%30, gece yarısı ~%10); her
  pencerenin sabit eşiği vardır, saat ilerledikçe birer birer söner. Renkler çoğunlukla sıcak sarı/turuncu, bir kısmı TV
  mavisi, azı loş. Kepenk inen dükkânın vitrin ve tabela ışığı söner.
- Konuşma balonları çakışınca yukarı/yana kayar ve kuyrukla sahibine bağlı kalır; aynı anda en fazla `BALON_SINIR` = 6 (süresi
  en önce dolacaklar); %70'in altındaki yakınlaştırmada yalnızca küçük ikon ("…", sabırsızlıkta "!"). Metin ve süre değişmez.
- Bina etiketleri önceliklidir: Karavana her zaman; dondurmacı, eczane, kahvehane, çay bahçesi ve büyük binalar %60 ve üstünde;
  diğerleri %95 ve üstünde; farenin üstündeki binanınki her zaman. Etiketler ekran içine sıkıştırılır, çakışan düşük öncelikli
  etiket gizlenir. Kenarlara doğru çok hafif vinyet.

### Sokağa hayat (`sehir/ortam.js`)
- **Araçlar** (en fazla 26): otomobil, sarı taksi, dolmuş, otobüs, motor kurye. Şeritte kalır, öndeki araca mesafe bırakır,
  kırmızı (ve uzaktayken sarı) ışıkta dur çizgisinde durur, yaya geçidinde yaya varsa bekler; otobüs duraktan yolcu alır
  (durakta bekleyenler biner). Akşam farlar ve stop lambaları yanar.
- **Yayalar** (en fazla 60, kafe müşterilerinden ayrı havuz): kaldırımlarda yürür, ışıklı kavşakta yaya ışığını bekler,
  kafe kapısının önündeki geçitten karşıya geçer, vitrine bakar. Kafe önündeki yaya yoğunluğu **popülerlik** ve **dışarıda
  sırada** değerleriyle artar; kafeden çıkan müşteriler (terk edenler dahil) sokakta yürüyerek uzaklaşır.
- **Mahalle sakinleri**: tavla oynayan amcalar, çay taşıyan çırak, dondurmayı kepçeyle havaya kaldıran Maraş ustası ve
  sırası, ATM sırası, durakta bekleyenler, simitçi ve mısırcı (dumanı tüten araba), parkta bankta oturanlar ve çay
  bahçesindekiler, oyun alanında koşan çocuklar.
- **Hayvanlar**: konteynerlerin üstünde ve kaldırımda yatan/oturan/yürüyen kediler (kuyruk sallar, göz kırpar), parkta
  gagalayan ve yaklaşan yayadan ürküp havalanan güvercinler, kaldırımda dolaşan köpek.

### Gün saati ve ışık (`sehir/isik.js`)
Oyun saatinden sürekli bir ton üretilir (sabah hafif sıcak → öğlen nötr → akşamüstü turuncu → gün batımı mor → gece lacivert);
anahtar kareler arasında doğrusal geçiş olduğu için ani renk sıçraması olmaz. Ton kafenin içi hariç bütün sahneye uygulanır.
Gece ışıkları (yanık pencereler, vitrinler, tabelalar, sokak lambaları, trafik ışıkları, farlar) aynı oranla yumuşakça yanar.
Dükkânlar kapanış saatinden önceki yarım saatte kepenk indirir (nöbetçi eczane, büfe, kahvehane, çay bahçesi açık kalır);
gece yaya ve araç yoğunluğu azalır.

### Performans
- Her karede yalnızca ekranda görünen bölge çizilir (doğal koordinatta, tam sayı kaydırmayla).
- Zemin (şehrin tamamı) ve duvar katmanları kamera yönü başına bir kez çizilip önbelleğe alınır; binalar, durağan sokak
  eşyaları ve kafe cephesi parçaları ayrı sprite'larda tutulur (bina ışıkları ayrı bir ışık sprite'ında), her karede yalnızca kopyalanır.
- Karakter kareleri 512 px'lik atlas sayfalarındadır; etiketler ve ışık parıltıları hazır görüntülerden çizilir.
- Uzak yakınlaştırmada küçük eşyalar, kediler, güvercinler ve yaya animasyonu sadeleşir; araç ve yaya sayısı sınırlıdır.
- Ölçüm (kat 1, aynı makine): değişiklik öncesi ~10 FPS (1x) / ~8 FPS (10x). Sonrası gündüz ~60 FPS, kalabalık gece ~14 FPS.

## Diyaloglar
`simulasyon/diyalog.js` havuzu: genel masa sohbetleri ("Sıra kimde?", "Zar atıyorum!", "Kural kitabına baksana",
"Enkaz kartı bende kaldı!", "Sıramı pas geçiyorum", "Bu hamle oyunu bitirir!"...), **oyuna özel** cümleler (Catan'da saman/odun
takası, Carcassonne'da meeple, Ticket to Ride rotaları, Codenames ipuçları, Pandemic salgını, Uno...), **siparişe göre**
cümleler ("Bir filtre kahve daha söylesek mi?", "Zihnim açılsın diye Türk kahvesi alayım", "Masada içecek alanını
daraltmayalım"), servis sonrası teşekkürler ve bekleme türüne göre sabırsızlık cümleleri.

## 3D hacim ve derinlik
- **Oda kutusu:** her kat, altında katmanlı kesiti görünen kalın bir **zemin plakası** üzerinde durur; arka duvarlar kalın
  kutulardır (üst kesit ve açık uçlarda duvar kesiti görünür), iç köşede ve süpürgelik hizasında ortam gölgesi vardır.
- **Zemin dokuları:** kat 1 açık, kat 2 koyu **ahşap parke** (karo başına üç tahta, şaşırtmalı ek yerleri, parlama çizgileri);
  kat 3 **derin mor desenli halı** (baklava motifleri, altın noktalar, çift bordür).
- **Gölgeler:** masa, sandalye, bar, mutfak ekipmanı, atari ve pinball, kitaplık, asansör ve sahnenin altında iki katmanlı
  yumuşak zemin gölgesi.
- **Hacimli mobilya:** masalarda kalın ayaklar, etek tahtası ve kalın tabla; sandalyelerde dört ayak, ince oturak ve iki
  dikmeli, latalı sırtlık (arası boş); barda pirinç ayak barı ve süpürgelik.
- **Kat 2:** kaideli, girintili kitaplık (dikmeler, raf tahtaları); atari kabinlerinde ekrandan öne **çıkıntı yapan kontrol
  paneli** (joystick, düğmeler), ekran ve başlık ışıması ile zeminde renkli yansıma; pinball arka kutusu ışıması.
- **Asansör:** çelik dikmeler arasında cam paneller; camdan ışıklı kabin, halatlar ve yansımalar görünür, kabin hafifçe hareket
  eder. **Kat geçişinde** kamera geri çekilir, eski kat kayarak çıkar, yenisi karşı yönden gelir ve kuyudaki döşeme kirişleri
  hareket yönünün tersine akar.

## Mobilya ve atmosfer
- **Masalar:** dört ayak + köşeleri yumuşatılmış ahşap tabla (damarlı) + oyun matı: kat 1 krem örtü, kat 2 yeşil keçe,
  kat 3 kırmızı örtü veya FRP harita masası.
- **Masadaki oyun:** oynanan oyuna özel minyatürler — Catan altıgen karolar, ahşap yollar ve yerleşimler; Carcassonne karoları,
  kale ve meeple'lar; Ticket to Ride haritası, tren hatları ve kart destesi; Codenames kart ızgarası; Dixit resim kartları ve
  tavşan piyon; Uno desteleri; Pandemic salgın haritası ve küpler; Azul fabrika diskleri; Splendor mücevher fişleri; 7 Wonders
  harika tahtaları; diğer oyunlarda tahta, zar kulesi ve zarlar.
- **Sandalyeler:** oturak + masaya ters yönde sırtlık; VIP'de kollu deri koltuk. Sırtlık kameraya dönükse oturanın
  önünde çizilir (ayrı derinlik öğesi).
- **Bar:** fincan ısıtıcılı espresso makinesi (grup başlığı, portafiltre, buhar çubuğu, damlama tepsisi, buhar), arkada şişe ve
  kavanoz rafı, fanuslu pasta standı, vitrin, kasa cihazı.
- **Posterler:** Catan (altıgen ada), Carcassonne (kale ve yollar), Ticket to Ride (tren hatları), Dixit (ay ve yıldızlar),
  Pandemic (salgın haritası) ve FRP haritaları; kat 2'de kütüphane raflarının üstünde.

## Garsonlar
Garsonlar veritabanındaki **aktif GARSON** personeldir (örnek veride 6 garson). Katlara eşit dağıtılır — 6 garsonla **her katta 2** —
ve her garson yalnızca kendi katının sipariş/temizlik işlerine bakar (bir katın hiç garsonu yoksa diğerleri yardım eder). Hız, sipariş alma hızı ve servis yeteneği personel kimliğinden türetilir
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

Açılışta ve **Sıfırla**'da kamera kafeye ve önündeki caddeye odaklanır; kat 1'de kaydırma şehir sınırının dışına taşmaz.
Sahnenin yalnızca ekranda görünen bölgesi ara bir tuvale çizilir; kamera bu tuvali ekrana aktarırken `ekran = ofset + doğal × (sığdırma × yakınlık)`
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

## Asansör
Eski merdivenin yerinde fırçalanmış çelik, geniş bir **asansör** var (kapı, çağırma düğmesi, kat göstergesi "▲▼ n").
Karakterler katlar arasında asansörle geçer: kapı açılır, biner (görünmez olur), kısa bir yolculuktan sonra hedef katta kapı
açılıp iner. Asansöre tıklanınca **kat seçim paneli** açılır (bulunulan kat işaretli); kat değişimi kararma + dikey kayma
geçişiyle yapılır, alttaki kat düğmeleri de aynı geçişi kullanır.

## Mutfak
Yiyecek veya tatlı içeren sipariş, garson tarafından veritabanına yazıldıktan sonra **mutfağa fiş** olarak düşer
(yalnız içecekler barda hazırlanmaya devam eder). Şef ve yardımcı şef sıradaki fişi alır, ocak başında pişirir
(süre kalem sayısına ve hıza bağlı; şef daha hızlı), tabağı servis tezgahına koyar ("Servis!"). Garson kat 1'deki tezgahın
önünde bekler, tabağı alıp masaya götürür. Ocak pişerken yanar, hazır tabaklar tezgahta görünür. Garson paneli mutfak
durumunu (şefler, bekleyen fiş, tezgahta hazır tabak) gösterir. Şefler veritabanı personeli değil, simülasyon karakterleridir.

## Yalnız izleyenler
Tek başına gelenlerin bir kısmı (ve kişi sayısına uygun oyun bulamayanlar) oyun oynamaz: bir masaya oturup bir şeyler içer,
oyun oynanan en yakın masaya dönüp izler ("İzlemesi bile keyifli", "Bu hamle iyiydi!"), 30–70 dakika sonra kalkar.

## Oyun seçimi
Veritabanında 50 oyun var (`oyun.talep` 1–10, `oyun.zorluk` 1–5). Gruplar oyunu **talep ağırlıklı** seçer; katın konseptine
uyan kategoriler (kat 1 kart/aile/parti/geleneksel, kat 2 strateji/kooperatif/soyut, kat 3 parti/kooperatif/strateji/zar)
iki kat ağırlık alır. Popüler oyunlar 8 kopya olduğundan daha sık masaya gelir; tek kopyalı ağır oyunlar için sıra oluşur.

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
| `simulasyon/sehir/yerlesim.js` | Şehir yerleşimi: yollar, bloklar, kavşaklar, yaya geçitleri ve güzergâhları, sokak eşyaları, park |
| `simulasyon/sehir/binalar.js` | Bina tanımları (dört cephe türü, malzeme, çatı, özel ayrıntı, kapanış saati), sağır duvar tespiti, dükkân önü saksıları |
| `simulasyon/sehir/binaCizim.js` | Tanımdan dört cephe + çatı üretimi, sprite önbelleği, ışık sprite'ı, kepenk, kesik (cutaway) görünüm |
| `simulasyon/sehir/sokakCizim.js` | Şehir zemini, sokak eşyaları, araçlar, kedi ve güvercin çizimi |
| `simulasyon/sehir/ortam.js` | Araçlar, trafik ışıkları, yayalar, mahalle sakinleri, hayvanlar (görsel, salt okur) |
| `simulasyon/sehir/isik.js` | Gün saati tonu ve gece ışığı gücü; saatlik yaya/araç yoğunluğu |
| `simulasyon/diyalog.js` | Genel, oyuna özel (Okey, Tavla, Vampir Köylü, Monopoly...), siparişe özel, sabırsızlık, izleyici, şef ve müzik cümleleri |
| `sayfalar/Simulasyon.jsx` | Kamera (yakınlaştırma, döndürme, kaydırma), kat geçişi, HUD, paneller, merdiven penceresi, masa detayı, oyun kütüphanesi |

## Sunumda
Temiz veriyle başlatın (`npm run db:kur`), Simülasyon'u 2× hızda birkaç dakika çalıştırın, ardından Raporlar → personel
performansı ve ürün satışlarını, Kasa → günlük ciroyu gösterin: hepsi simülasyonun veritabanına yazdığı gerçek kayıtlardır.
