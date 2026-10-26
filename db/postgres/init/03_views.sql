-- View'lar

-- 1) Oyun kataloğu ve müsait adetler
CREATE VIEW v_musait_oyunlar AS
SELECT o.id AS oyun_id, o.ad, k.ad AS kategori, o.min_oyuncu, o.max_oyuncu, o.sure_dk,
       o.saatlik_ucret, o.toplam_adet, fn_musait_adet(o.id) AS musait_adet
FROM oyun o JOIN kategori k ON k.id = o.kategori_id
WHERE o.aktif;

-- 2) Masa durumu: hangi masada kim, hangi oyun oynanıyor
CREATE VIEW v_masa_durumu AS
SELECT m.masa_no, m.kapasite,
       CASE WHEN t.id IS NULL THEN 'BOS' ELSE 'DOLU' END AS durum,
       t.id AS oturum_id, t.kisi_sayisi, t.acilis,
       og.ad AS oynanan_oyun,
       b.durum AS bekleme_durumu
FROM masa m
LEFT JOIN oturum t ON t.masa_id = m.id AND t.kapanis IS NULL
LEFT JOIN LATERAL (SELECT o.ad FROM oturum_oyun oo JOIN oyun o ON o.id = oo.oyun_id
                   WHERE oo.oturum_id = t.id AND oo.bitis IS NULL) og ON true
LEFT JOIN bekleme b ON b.oturum_id = t.id AND b.durum IN ('BEKLIYOR','SECIM_HAKKI');

-- 3) Bekleme sırası (1 = sıradaki)
CREATE VIEW v_bekleme_sirasi AS
SELECT row_number() OVER (ORDER BY b.id) AS sira, b.id AS bekleme_id, m.masa_no,
       t.kisi_sayisi, b.durum, b.olusturma, b.secim_hakki_zamani
FROM bekleme b
JOIN oturum t ON t.id = b.oturum_id
JOIN masa m   ON m.id = t.masa_id
WHERE b.durum IN ('BEKLIYOR','SECIM_HAKKI');

-- 4) Maskelenmiş müşteri listesi (garson/kasiyer bunu görür)
CREATE VIEW v_musteri_maskeli AS
SELECT id, fn_ad_maskele(ad) AS ad, fn_ad_maskele(soyad) AS soyad,
       fn_email_maskele(email) AS email, fn_telefon_maskele(telefon) AS telefon, uyelik_tarihi
FROM kullanici;

-- 5) Açık hesaplar (anlık tutarlarla)
CREATE VIEW v_acik_hesaplar AS
SELECT m.masa_no, t.id AS oturum_id, fn_ad_maskele(k.ad) || ' ' || fn_ad_maskele(k.soyad) AS musteri,
       t.kisi_sayisi, t.acilis, d.masa_ucreti, d.oyun_ucreti, d.siparis_toplam, d.toplam
FROM oturum t
JOIN masa m ON m.id = t.masa_id
JOIN kullanici k ON k.id = t.kullanici_id
CROSS JOIN LATERAL fn_hesap_detay(t.id) d
WHERE t.kapanis IS NULL;

-- 6) Günlük ciro
CREATE VIEW v_gunluk_ciro AS
SELECT t.kapanis::date AS gun, count(*) AS oturum_sayisi, sum(fn_hesap_hesapla(t.id)) AS ciro
FROM oturum t
WHERE t.kapanis IS NOT NULL
GROUP BY t.kapanis::date;

-- 7) Oyun popülerliği
CREATE VIEW v_oyun_populerlik AS
SELECT o.ad, count(oo.id) AS oynanma_sayisi,
       COALESCE(round(sum(extract(epoch FROM COALESCE(oo.bitis, clock_timestamp()) - oo.baslangic)) / 3600, 2), 0) AS toplam_saat
FROM oyun o LEFT JOIN oturum_oyun oo ON oo.oyun_id = o.id
GROUP BY o.id, o.ad
ORDER BY oynanma_sayisi DESC;
