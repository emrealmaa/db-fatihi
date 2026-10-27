-- VIP Kulüp (kat 3), VIP oyunlar ve kat 2 bistro — EKLEMELİ migration.
-- Var olan hiçbir kolon/tablo silinmez ya da yeniden adlandırılmaz; yeni kolonlar varsayılan değerlidir,
-- eski kayıtlar bu varsayılanla gelir. Dosya tekrar çalıştırılabilir (IF NOT EXISTS / OR REPLACE / ON CONFLICT):
--   sıfırdan kurulum: npm run db:kur (01..08 sırayla)   ·   mevcut veritabanı: npm run db:goc (07 ve sonrası)

-- ---------------------------------------------------------------- yeni kolonlar
ALTER TABLE oyun          ADD COLUMN IF NOT EXISTS vip_ozel      boolean  NOT NULL DEFAULT false;  -- yalnızca VIP üyeler oynayabilir
ALTER TABLE kullanici     ADD COLUMN IF NOT EXISTS vip_mi        boolean  NOT NULL DEFAULT false;  -- VIP Kulüp üyesi
ALTER TABLE kullanici     ADD COLUMN IF NOT EXISTS vip_baslangic date;                             -- üyeliğin başladığı gün
ALTER TABLE urun_kategori ADD COLUMN IF NOT EXISTS mutfak        boolean  NOT NULL DEFAULT false;  -- kat 1 mutfağında hazırlanır (yemek)
ALTER TABLE ayar          ADD COLUMN IF NOT EXISTS vip_kat       smallint NOT NULL DEFAULT 3;      -- yalnızca VIP'lerin oturabildiği kat

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_kullanici_vip') THEN
        ALTER TABLE kullanici ADD CONSTRAINT ck_kullanici_vip CHECK (vip_mi OR vip_baslangic IS NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_ayar_vip_kat') THEN
        ALTER TABLE ayar ADD CONSTRAINT ck_ayar_vip_kat CHECK (vip_kat BETWEEN 1 AND 3);
    END IF;
END $$;

-- ---------------------------------------------------------------- fonksiyonlar
-- Oturumun (masanın) sahibi VIP mi? Kayıtsız oturum VIP sayılmaz.
CREATE OR REPLACE FUNCTION fn_oturum_vip_mi(p_oturum_id bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE((SELECT k.vip_mi FROM oturum t JOIN kullanici k ON k.id = t.kullanici_id
                     WHERE t.id = p_oturum_id), false);
$$;

-- ------------------------------------------------------------ tetikleyiciler
-- VIP oyun kuralı: vip_ozel oyun, sahibi VIP olmayan bir oturuma verilemez (oyun başlatma ve sıra).
-- Uygulama da bu oyunları normal müşterilere göstermez; tetikleyici son güvencedir.
CREATE OR REPLACE FUNCTION trg_vip_oyun_kontrol() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_ad text;
BEGIN
    SELECT ad INTO v_ad FROM oyun WHERE id = NEW.oyun_id AND vip_ozel;
    IF FOUND AND NOT fn_oturum_vip_mi(NEW.oturum_id) THEN
        RAISE EXCEPTION 'VIP_OYUN_YETKISIZ: % yalnızca VIP üyeler içindir', v_ad
            USING ERRCODE = 'check_violation', HINT = 'Müşteriyi VIP yapın (sp_musteri_vip) veya standart bir oyun seçin';
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_vip_oyun_kontrol BEFORE INSERT OR UPDATE OF oyun_id, oturum_id ON oturum_oyun
    FOR EACH ROW EXECUTE FUNCTION trg_vip_oyun_kontrol();
CREATE OR REPLACE TRIGGER trg_vip_bekleme_kontrol BEFORE INSERT OR UPDATE OF oyun_id, oturum_id ON bekleme
    FOR EACH ROW EXECUTE FUNCTION trg_vip_oyun_kontrol();

-- VIP kat kuralı: ayar.vip_kat'taki masalara yalnızca VIP müşteri (grup sahibi) oturabilir
CREATE OR REPLACE FUNCTION trg_vip_kat_kontrol() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_masa masa%ROWTYPE;
BEGIN
    SELECT * INTO v_masa FROM masa WHERE id = NEW.masa_id;
    IF v_masa.kat = COALESCE((SELECT vip_kat FROM ayar), 3)
       AND NOT COALESCE((SELECT vip_mi FROM kullanici WHERE id = NEW.kullanici_id), false) THEN
        RAISE EXCEPTION 'VIP_KAT_YETKISIZ: Masa % VIP Kulüp katında; yalnızca VIP üyeler oturabilir', v_masa.masa_no
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_vip_kat_kontrol BEFORE INSERT OR UPDATE OF masa_id, kullanici_id ON oturum
    FOR EACH ROW EXECUTE FUNCTION trg_vip_kat_kontrol();

-- ------------------------------------------------------------ prosedür
-- VIP üyelik ver / geri al (yalnızca yönetici). Başlangıç günü ilk verilişte yazılır, geri alınınca silinir.
CREATE OR REPLACE PROCEDURE sp_musteri_vip(p_kullanici_id bigint, p_vip boolean DEFAULT true)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE kullanici
       SET vip_mi = COALESCE(p_vip, true),
           vip_baslangic = CASE WHEN COALESCE(p_vip, true) THEN COALESCE(vip_baslangic, current_date) END
     WHERE id = p_kullanici_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Müşteri bulunamadı: %', p_kullanici_id USING ERRCODE = 'no_data_found';
    END IF;
END $$;

-- ------------------------------------------------------------ view'lar
-- Var olan view'lara yalnızca SONA kolon eklenir (CREATE OR REPLACE VIEW kuralı; eski kolonlar aynen kalır)
CREATE OR REPLACE VIEW v_musait_oyunlar AS
SELECT o.id AS oyun_id, o.ad, k.ad AS kategori, o.min_oyuncu, o.max_oyuncu, o.sure_dk, o.zorluk, o.talep,
       o.toplam_adet, fn_musait_adet(o.id) AS musait_adet,
       fn_musait_adet(o.id) - fn_ayrilan_adet(o.id) AS alinabilir_adet,
       (SELECT count(*) FROM bekleme b WHERE b.oyun_id = o.id AND b.durum IN ('BEKLIYOR','SECIM_HAKKI')) AS bekleyen_masa,
       o.vip_ozel
FROM oyun o JOIN kategori k ON k.id = o.kategori_id
WHERE o.aktif;

CREATE OR REPLACE VIEW v_masa_durumu AS
SELECT m.id AS masa_id, m.masa_no, m.kapasite, m.kat,
       CASE WHEN t.id IS NULL THEN 'BOS' ELSE 'DOLU' END AS durum,
       t.id AS oturum_id, t.kisi_sayisi, t.acilis,
       og.oturum_oyun_id, og.oyun_id, og.ad AS oynanan_oyun, og.baslangic AS oyun_baslangic,
       b.id AS bekleme_id, b.durum AS bekleme_durumu, b.oyun_id AS beklenen_oyun_id,
       (SELECT ad FROM oyun WHERE id = b.oyun_id) AS beklenen_oyun, b.secim_hakki_zamani,
       b.secim_hakki_zamani + make_interval(mins => (SELECT secim_suresi_dk FROM ayar)) AS secim_bitis,
       (m.kat = COALESCE((SELECT vip_kat FROM ayar), 3)) AS vip_masa,
       COALESCE(mk.vip_mi, false) AS musteri_vip
FROM masa m
LEFT JOIN oturum t ON t.masa_id = m.id AND t.kapanis IS NULL
LEFT JOIN kullanici mk ON mk.id = t.kullanici_id
LEFT JOIN LATERAL (SELECT oo.id AS oturum_oyun_id, o.id AS oyun_id, o.ad, oo.baslangic
                   FROM oturum_oyun oo JOIN oyun o ON o.id = oo.oyun_id
                   WHERE oo.oturum_id = t.id AND oo.bitis IS NULL) og ON true
LEFT JOIN bekleme b ON b.oturum_id = t.id AND b.durum IN ('BEKLIYOR','SECIM_HAKKI');

CREATE OR REPLACE VIEW v_musteri_maskeli AS
SELECT id, fn_ad_maskele(ad) AS ad, fn_ad_maskele(soyad) AS soyad,
       fn_email_maskele(email) AS email, fn_telefon_maskele(telefon) AS telefon, ogrenci, uyelik_tarihi,
       vip_mi
FROM kullanici;

CREATE OR REPLACE VIEW v_menu AS
SELECT u.id AS urun_id, u.ad, k.id AS kategori_id, k.ad AS kategori, k.sira AS kategori_sira,
       u.fiyat, u.stok, (u.stok <= u.kritik_stok) AS stok_az,
       k.mutfak
FROM urun u JOIN urun_kategori k ON k.id = u.kategori_id
WHERE u.aktif;

-- VIP oyun kullanımı: oyun başına oturum sayısı, toplam/ortalama süre (dk), oynayan VIP (grup sahibi) sayısı
CREATE OR REPLACE VIEW v_vip_oyun_kullanimi AS
SELECT o.id AS oyun_id, o.ad,
       count(oo.id) AS oturum_sayisi,
       COALESCE(round(sum(extract(epoch FROM COALESCE(oo.bitis, clock_timestamp()) - oo.baslangic)) / 60), 0) AS toplam_dk,
       COALESCE(round(avg(extract(epoch FROM COALESCE(oo.bitis, clock_timestamp()) - oo.baslangic)) / 60, 1), 0) AS ortalama_dk,
       count(DISTINCT t.kullanici_id) AS oynayan_vip,
       fn_musait_adet(o.id) < o.toplam_adet AS su_an_masada
FROM oyun o
LEFT JOIN oturum_oyun oo ON oo.oyun_id = o.id
LEFT JOIN oturum t ON t.id = oo.oturum_id
WHERE o.vip_ozel
GROUP BY o.id, o.ad, o.toplam_adet;

-- Kat bazında günlük gelir (ödeme günü). Giriş net (öğrenci indirimi düşülmüş); yemek = mutfak kategorileri,
-- içecek = diğer siparişler; vip_ciro sahibi VIP olan hesapların ödemesi. Ciro = ödenen tutar (ek indirim dahil).
CREATE OR REPLACE VIEW v_kat_gelir AS
SELECT o.zaman::date AS gun, m.kat,
       count(*) AS hesap_sayisi,
       sum(t.kisi_sayisi) AS kisi,
       count(*) FILTER (WHERE k.vip_mi) AS vip_hesap,
       sum(t.kisi_sayisi * t.giris_ucreti - round(t.ogrenci_sayisi * t.giris_ucreti * t.ogrenci_orani, 2)) AS giris_geliri,
       COALESCE(sum(s.yemek), 0) AS yemek_geliri,
       COALESCE(sum(s.icecek), 0) AS icecek_geliri,
       sum(o.tutar) AS ciro,
       COALESCE(sum(o.tutar) FILTER (WHERE k.vip_mi), 0) AS vip_ciro
FROM odeme o
JOIN oturum t ON t.id = o.oturum_id
JOIN masa m   ON m.id = t.masa_id
LEFT JOIN kullanici k ON k.id = t.kullanici_id
LEFT JOIN LATERAL (
    SELECT sum(s.adet * s.birim_fiyat) FILTER (WHERE uk.mutfak)     AS yemek,
           sum(s.adet * s.birim_fiyat) FILTER (WHERE NOT uk.mutfak) AS icecek
    FROM siparis s JOIN urun u ON u.id = s.urun_id JOIN urun_kategori uk ON uk.id = u.kategori_id
    WHERE s.oturum_id = t.id) s ON true
GROUP BY o.zaman::date, m.kat;

-- ------------------------------------------------------------ yetkiler
-- 05_security'deki "PUBLIC'ten geri al" yalnızca o anki nesneleri kapsar; yeni nesneler burada ayarlanır
REVOKE EXECUTE ON FUNCTION fn_oturum_vip_mi(bigint), trg_vip_oyun_kontrol(), trg_vip_kat_kontrol() FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE sp_musteri_vip(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_oturum_vip_mi(bigint) TO rol_garson;
GRANT EXECUTE ON PROCEDURE sp_musteri_vip(bigint, boolean) TO rol_yonetici;
GRANT SELECT ON v_vip_oyun_kullanimi, v_kat_gelir TO rol_yonetici;

-- ------------------------------------------------------------ veri
-- Mutfakta hazırlanan kategoriler (kat 2/3 siparişleri yemek asansörüyle çıkar)
UPDATE urun_kategori SET mutfak = true
 WHERE ad IN ('Ana Yemek & Atıştırmalık', 'Kahvaltı', 'Tatlılar') AND NOT mutfak;
-- Bistro menüsünde eksik kalan yemek
INSERT INTO urun (kategori_id, ad, fiyat, stok, kritik_stok)
SELECT id, 'Salata', 190, 40, 6 FROM urun_kategori WHERE ad = 'Ana Yemek & Atıştırmalık'
ON CONFLICT (ad) DO NOTHING;

-- VIP Kulüp: 2 kişilik oyunlar (Twilight Struggle) için ikili masa
INSERT INTO masa (masa_no, kapasite, kat) VALUES (25, 2, 3) ON CONFLICT (masa_no) DO NOTHING;

-- 10 VIP oyun (zorluk sütunu 1–5 tamsayı: hepsi 5; süre aralığın ortası; tek kopya).
-- Gloomhaven ve Brass: Birmingham kafede standart oyun olarak zaten var; VIP koleksiyonu ayrı baskılarıdır.
INSERT INTO kategori (ad) VALUES ('Ağır strateji') ON CONFLICT (ad) DO NOTHING;
INSERT INTO oyun (ad, kategori_id, min_oyuncu, max_oyuncu, sure_dk, toplam_adet, zorluk, talep, vip_ozel)
SELECT v.ad, (SELECT id FROM kategori WHERE ad = 'Ağır strateji'), v.mn, v.mx, v.sure, 1, 5, v.talep, true
FROM (VALUES
    ('Twilight Imperium (4. baskı)', 3, 6, 360, 6),
    ('Gloomhaven (2. baskı)', 1, 4, 90, 7),
    ('Brass: Birmingham (Deluxe)', 2, 4, 90, 7),
    ('Spirit Island', 1, 4, 105, 7),
    ('Mage Knight', 1, 4, 150, 5),
    ('Through the Ages: A New Story of Civilization', 2, 4, 180, 5),
    ('Gaia Project', 1, 4, 105, 6),
    ('Food Chain Magnate', 2, 5, 180, 5),
    ('War of the Ring (2. baskı)', 2, 4, 165, 6),
    ('Twilight Struggle', 2, 2, 150, 6)
) AS v(ad, mn, mx, sure, talep)
ON CONFLICT (ad) DO NOTHING;
