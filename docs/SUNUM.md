# Sunum içeriği ve demo akışı

`Proje_Sunum_Şablonu.pptx` doldurulurken kullanılacak metinler. Hedef: ~10 dk anlatım + ~5 dk canlı demo. Hazır ekran görüntüleri: `docs/ekran/` (açıklamalı liste orada).

## Slayt akışı
1. **Karavana** — Kutu oyunu cafe işletme sistemi. Enes Öztürk, Emre Alma. GitHub linki.
2. **Problem** — Kafede oyun kopyaları sınırlı; popüler oyun için masalar bekliyor, kimin sırası olduğu
   kâğıtla/akılla takip ediliyor. Hesap = kişi başı giriş + yenilen içilen; stok ve personel takibi dağınık.
3. **Çözüm ve kapsam** — Masa panosu, oyun kataloğu ve müsait adet, adil bekleme sırası (seçim hakkı),
   sipariş ve stok, hesap/ödeme (nakit/kart), personel ve rol bazlı yetki, raporlar.
4. **Mimari** — React → Express API → PostgreSQL. "İş kuralları veritabanında": API her isteği personelin
   rolüne karşılık gelen DB rolüyle çalıştırır; yetkiyi uygulama değil veritabanı uygular. (ARCHITECTURE.md diyagramı)
5. **ER diyagramı** — 13 tablo (docs/ER.md); VIP Kulüp yeni tablo değil, varsayılanlı sütunlar (`vip_mi`, `vip_ozel`, `vip_kat`). Öne çıkanlar: oturum = hesap birimi; oturum_oyun ve siparis N:M köprüleri;
   ödeme 1:1; ayar tek satır.
6. **Normalizasyon ve anahtarlar** — 3NF; identity PK + doğal anahtarlara UNIQUE; türetilmiş değer saklanmaz
   (müsait adet, hesap toplamı); bilinçli anlık görüntüler (birim fiyat, giriş ücreti).
7. **Kısıtlar** — CHECK (telefon formatı, rol, ödeme türü, stok ≥ 0...), kısmi UNIQUE index'ler
   ("masada tek açık oturum", "sistemde tek seçim hakkı"), tetikleyiciler (kapasite, sıra atlama, müsait kopya — satır kilidiyle).
8. **Bekleme sırası algoritması** — Her oyunun kendi sırası. Kopya iade → `sp_sirayi_ilerlet` → o oyunu bekleyen ilk masaya
   kopya ayrılır (SECIM_HAKKI); ayrılan kopyayı başkası alamaz ama diğer oyunlar serbest; 5 dk dolunca o oyunun sırasının sonuna. (Akış şeması)
9. **Prosedür / fonksiyon / view** — 16 / 12 / 15. Örnek: `sp_oturum_kapat` tek transaction'da oyunu iade eder,
   sırayı iptal eder, toplamı hesaplar, ödemeyi kaydeder, sırayı ilerletir.
10. **Yetki ve maskeleme** — docs/YETKI.md matrisi. Aynı müşteri: yönetici `05321234567`, garson `0532*****67`.
    Parolalar bcrypt; giriş rolü yalnızca doğrulama fonksiyonunu çalıştırabilir.
11. **Performans** — docs/PERFORMANS.md tablosu: 100k oturum / 400k sipariş; index'li vs index'siz (Seq Scan → Index Scan).
12. **Test** — 62 veritabanı + 12 API testi; her test temiz veritabanıyla (ayrı `karavana_test`; geliştirme verisi korunur); kurulumsuz PGlite ile de çalışır.
13. **Demo** (aşağıdaki akış)
14. **Kapanış** — Öğrenilenler, geliştirme fikirleri (öğrenci indirimi, rezervasyon, çoklu şube).

## Canlı demo akışı (~5 dk)
Hazırlık: `npm run db:kur` (temiz seed), `npm run api`, iki tarayıcı penceresi (garson + kasiyer). Yedek: ekran kaydı.

1. **Garson girişi** → Masa panosu: masa 1 ve 2 Catan oynuyor, masa 3 sırada.
2. **Yeni müşteri, yeni masa:** Masa 4 → telefon ara → bulunamadı → ad/soyad gir → masa açılır (müşteri aynı adımda kaydedildi).
3. **Sıra atlama engeli:** Masa 1'in Catan'ını iade et → masa 3 nabız gibi atan "Seçim hakkı" kartına döner, geri sayım başlar.
   Masa 4'ten Catan başlatmayı dene → "Catan kopyası sıradaki masa 3 için ayrıldı" (tetikleyici). Masa 4 Azul'u başlatabilir.
4. **Seçim:** Bekleme sırası ekranından masa 3'e "Oyunu ver" → Catan masa 3'te.
5. **Sipariş ve stok:** Masa 4'e 2 kahve + 1 brownie → brownie "Son 2" uyarısı; stoktan fazlasını sipariş etmeye çalış → hata.
6. **Kasiyer:** Kasa → masa 4 hesabı (giriş × kişi + siparişler) → Kart ile al → masa boşalır, günlük ciroya yansır.
7. **Yetki kanıtı (psql):** `psql -U garson_app karavana -c "SELECT * FROM kullanici"` → *permission denied*;
   `SELECT * FROM v_musteri_maskeli` → maskeli.
8. **Yönetici:** Raporlar → oyun popülerliği, personel performansı (siparişi kim aldı), kritik stok.
9. **VIP Kulüp (kuralın veritabanında olduğunu göster):** Masa 8'i standart bir müşteriyle aç → Oyun başlat → listede altın VIP rozetli
   "Spirit Island" → denenince "Bu oyun sadece VIP üyeler içindir". Aynı denemeyi psql ile yap:
   `CALL sp_oyun_baslat(<oturum>, <vip oyun id>, NULL)` → `VIP_OYUN_YETKISIZ`; yönetici olarak `CALL sp_musteri_vip(<müşteri id>, true)`
   → aynı çağrı çalışır. Kat 3 masasını standart müşteriyle açmayı dene → `VIP_KAT_YETKISIZ`.
10. **Simülasyon sekmesi:** Kat 2 bistro + yemek asansörü, Kat 3 VIP Kulüp (yıldız rozetli üyeler, VIP vitrin); Raporlar → "VIP oyunlar" ve "Kat geliri".

## Olası sorular
- *VIP kuralı neden uygulamada değil de tetikleyicide?* Uygulama, başka bir istemci veya elle yazılmış bir `INSERT` atlayabilir; tetikleyici hiçbirine izin vermez (yönetici dahil). `docs/YETKI.md` matrisinde son iki satır.
- *Neden müsait adet sütunu yok?* Türetilmiş değer; saklasaydık her iade/başlatmada senkron tutmak gerekirdi (güncelleme anomalisi).
- *Aynı anda iki garson son kopyayı başlatırsa?* Tetikleyici oyun satırını `FOR UPDATE` ile kilitler; ikinci işlem sırayı bekler ve "müsait kopya yok" alır.
- *Neden her işlem prosedürle?* Uygulama rolleri tablolara yazamaz; kural tek yerde (DB) olur, API veya başka bir istemci atlayamaz.
- *İşlemi kimin yaptığı nasıl biliniyor?* API transaction başında `app.personel_id` ayarlar; `fn_aktif_personel()` okur ve personelin aktif olduğunu doğrular.
