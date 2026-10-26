-- View'lar. Uygulama rolleri tablolara değil bunlara erişir.

-- 1) Oyun kataloğu ve müsait adetler. musait_adet: masada olmayan kopya;
--    alinabilir_adet: sıradaki masalara ayrılmamış olanlar (yeni bir masanın alabileceği)
CREATE VIEW v_musait_oyunlar AS
SELECT o.id AS oyun_id, o.ad, k.ad AS kategori, o.min_oyuncu, o.max_oyuncu, o.sure_dk,
       o.toplam_adet, fn_musait_adet(o.id) AS musait_adet,
       fn_musait_adet(o.id) - fn_ayrilan_adet(o.id) AS alinabilir_adet,
       (SELECT count(*) FROM bekleme b WHERE b.oyun_id = o.id AND b.durum IN ('BEKLIYOR','SECIM_HAKKI')) AS bekleyen_masa
FROM oyun o JOIN kategori k ON k.id = o.kategori_id
WHERE o.aktif;

-- 2) Masa durumu: hangi masada kaç kişi, hangi oyun oynanıyor, sırada mı
CREATE VIEW v_masa_durumu AS
SELECT m.id AS masa_id, m.masa_no, m.kapasite, m.kat,
       CASE WHEN t.id IS NULL THEN 'BOS' ELSE 'DOLU' END AS durum,
       t.id AS oturum_id, t.kisi_sayisi, t.acilis,
       og.oturum_oyun_id, og.oyun_id, og.ad AS oynanan_oyun, og.baslangic AS oyun_baslangic,
       b.id AS bekleme_id, b.durum AS bekleme_durumu, b.oyun_id AS beklenen_oyun_id,
       (SELECT ad FROM oyun WHERE id = b.oyun_id) AS beklenen_oyun, b.secim_hakki_zamani,
       b.secim_hakki_zamani + make_interval(mins => (SELECT secim_suresi_dk FROM ayar)) AS secim_bitis
FROM masa m
LEFT JOIN oturum t ON t.masa_id = m.id AND t.kapanis IS NULL
LEFT JOIN LATERAL (SELECT oo.id AS oturum_oyun_id, o.id AS oyun_id, o.ad, oo.baslangic
                   FROM oturum_oyun oo JOIN oyun o ON o.id = oo.oyun_id
                   WHERE oo.oturum_id = t.id AND oo.bitis IS NULL) og ON true
LEFT JOIN bekleme b ON b.oturum_id = t.id AND b.durum IN ('BEKLIYOR','SECIM_HAKKI');

-- 3) Bekleme sırası: her oyunun kendi sırası (oyun_sira 1 = o oyunda sıradaki).
--    Seçim hakkının bitiş zamanı ayardan hesaplanır.
CREATE VIEW v_bekleme_sirasi AS
SELECT row_number() OVER (ORDER BY (b.durum = 'SECIM_HAKKI') DESC, b.id) AS sira,
       row_number() OVER (PARTITION BY b.oyun_id ORDER BY (b.durum = 'SECIM_HAKKI') DESC, b.id) AS oyun_sira,
       b.id AS bekleme_id, t.id AS oturum_id, m.masa_no, t.kisi_sayisi, b.oyun_id, o.ad AS oyun, b.durum, b.olusturma,
       b.secim_hakki_zamani,
       b.secim_hakki_zamani + make_interval(mins => (SELECT secim_suresi_dk FROM ayar)) AS secim_bitis
FROM bekleme b
JOIN oturum t ON t.id = b.oturum_id
JOIN masa m   ON m.id = t.masa_id
JOIN oyun o   ON o.id = b.oyun_id
WHERE b.durum IN ('BEKLIYOR','SECIM_HAKKI');

-- 4) Maskelenmiş müşteri listesi (garson/kasiyer bunu görür)
CREATE VIEW v_musteri_maskeli AS
SELECT id, fn_ad_maskele(ad) AS ad, fn_ad_maskele(soyad) AS soyad,
       fn_email_maskele(email) AS email, fn_telefon_maskele(telefon) AS telefon, ogrenci, uyelik_tarihi
FROM kullanici;

-- 5) Menü (garson sipariş ekranı)
CREATE VIEW v_menu AS
SELECT u.id AS urun_id, u.ad, k.id AS kategori_id, k.ad AS kategori, k.sira AS kategori_sira,
       u.fiyat, u.stok, (u.stok <= u.kritik_stok) AS stok_az
FROM urun u JOIN urun_kategori k ON k.id = u.kategori_id
WHERE u.aktif;

-- 6) Oturumun siparişleri (hesap dökümü satırları)
CREATE VIEW v_oturum_siparisleri AS
SELECT s.id AS siparis_id, s.oturum_id, u.ad AS urun, s.adet, s.birim_fiyat,
       s.adet * s.birim_fiyat AS tutar, s.zaman, p.ad AS personel
FROM siparis s
JOIN urun u     ON u.id = s.urun_id
JOIN personel p ON p.id = s.personel_id;

-- 7) Açık hesaplar (anlık tutarlarla)
CREATE VIEW v_acik_hesaplar AS
SELECT m.masa_no, t.id AS oturum_id,
       COALESCE(fn_ad_maskele(k.ad) || ' ' || fn_ad_maskele(k.soyad), 'Kayıtsız müşteri') AS musteri,
       t.kisi_sayisi, t.giris_ucreti, t.acilis, d.giris_toplam, d.siparis_toplam, d.indirim, d.toplam
FROM oturum t
JOIN masa m ON m.id = t.masa_id
LEFT JOIN kullanici k ON k.id = t.kullanici_id
CROSS JOIN LATERAL fn_hesap_detay(t.id) d
WHERE t.kapanis IS NULL;

-- 8) Günlük ciro, ödeme türüne göre
CREATE VIEW v_gunluk_ciro AS
SELECT o.zaman::date AS gun, count(*) AS hesap_sayisi,
       sum(o.tutar) FILTER (WHERE o.tur = 'NAKIT') AS nakit,
       sum(o.tutar) FILTER (WHERE o.tur = 'KART')  AS kart,
       sum(o.tutar) AS ciro
FROM odeme o
GROUP BY o.zaman::date;

-- 9) Oyun popülerliği
CREATE VIEW v_oyun_populerlik AS
SELECT o.id AS oyun_id, o.ad, count(oo.id) AS oynanma_sayisi,
       COALESCE(round(sum(extract(epoch FROM COALESCE(oo.bitis, clock_timestamp()) - oo.baslangic)) / 3600, 2), 0) AS toplam_saat
FROM oyun o LEFT JOIN oturum_oyun oo ON oo.oyun_id = o.id
GROUP BY o.id, o.ad;

-- 10) Maskelenmiş personel listesi (personel birbirinin iletişim bilgisini açık göremez)
CREATE VIEW v_personel_maskeli AS
SELECT id, ad, fn_ad_maskele(soyad) AS soyad, rol,
       fn_telefon_maskele(telefon) AS telefon, fn_email_maskele(email) AS email, aktif
FROM personel;

-- 11) Personel performansı: açtığı masa, aldığı sipariş ve ödeme
CREATE VIEW v_personel_performans AS
SELECT p.id AS personel_id, p.ad || ' ' || p.soyad AS personel, p.rol,
       (SELECT count(*) FROM oturum t WHERE t.personel_id = p.id)       AS acilan_masa,
       (SELECT count(*) FROM siparis s WHERE s.personel_id = p.id)      AS siparis_sayisi,
       (SELECT COALESCE(sum(s.adet * s.birim_fiyat), 0) FROM siparis s WHERE s.personel_id = p.id) AS siparis_tutari,
       (SELECT count(*) FROM odeme o WHERE o.personel_id = p.id)        AS alinan_odeme,
       (SELECT COALESCE(sum(o.tutar), 0) FROM odeme o WHERE o.personel_id = p.id) AS tahsilat
FROM personel p;

-- 12) Kritik stok uyarısı
CREATE VIEW v_kritik_stok AS
SELECT u.id AS urun_id, u.ad, k.ad AS kategori, u.stok, u.kritik_stok
FROM urun u JOIN urun_kategori k ON k.id = u.kategori_id
WHERE u.aktif AND u.stok <= u.kritik_stok;

-- 13) Ürün satış raporu
CREATE VIEW v_urun_satis AS
SELECT u.id AS urun_id, u.ad, k.ad AS kategori,
       COALESCE(sum(s.adet), 0) AS satilan_adet,
       COALESCE(sum(s.adet * s.birim_fiyat), 0) AS gelir
FROM urun u
JOIN urun_kategori k ON k.id = u.kategori_id
LEFT JOIN siparis s ON s.urun_id = u.id
GROUP BY u.id, u.ad, k.ad;
