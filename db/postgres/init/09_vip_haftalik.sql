-- VIP Kulüp haftalık üyelik ücreti — EKLEMELİ migration (07, 08'den sonra).
-- Kural: VIP üye haftalık ücreti (varsayılan 10.000 TL) öder; ödemesi geçerli olduğu sürece VIP kata ve VIP oyunlara
-- girer, masa (giriş) ücreti ÖDEMEZ (zaten önceden ödenmiştir). Ücret herkes için aynıdır: öğrenci indirimi uygulanmaz.
-- Var olan kolon/tablo silinmez; dosya tekrar çalıştırılabilir.
--   sıfırdan kurulum: npm run db:kur   ·   mevcut veritabanı: npm run db:goc

-- ---------------------------------------------------------------- yeni kolonlar / tablo
ALTER TABLE ayar   ADD COLUMN IF NOT EXISTS vip_haftalik_ucret numeric(10,2) NOT NULL DEFAULT 10000;  -- haftalık VIP üyelik ücreti
ALTER TABLE oturum ADD COLUMN IF NOT EXISTS vip_uyelik boolean NOT NULL DEFAULT false;                -- açılışta geçerli VIP üyelik vardı (giriş ücretsiz)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_ayar_vip_ucret') THEN
        ALTER TABLE ayar ADD CONSTRAINT ck_ayar_vip_ucret CHECK (vip_haftalik_ucret >= 0);
    END IF;
END $$;

-- Haftalık üyelik ödemeleri: her satır 7 günlük (başlangıç ve bitiş dahil) bir dönemdir.
-- GECIS: 09 öncesinden gelen VIP üyelere tanınan ilk hafta (ücretsiz, ciroya girmez).
CREATE TABLE IF NOT EXISTS vip_odeme (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kullanici_id bigint        NOT NULL REFERENCES kullanici(id) ON DELETE RESTRICT,
    personel_id  int           NOT NULL REFERENCES personel(id)  ON DELETE RESTRICT,  -- ödemeyi alan
    baslangic    date          NOT NULL,
    bitis        date          NOT NULL,
    tutar        numeric(10,2) NOT NULL,
    tur          varchar(5)    NOT NULL,
    zaman        timestamptz   NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_vip_odeme_hafta CHECK (bitis = baslangic + 6),
    CONSTRAINT ck_vip_odeme_tutar CHECK (tutar >= 0),
    CONSTRAINT ck_vip_odeme_tur   CHECK (tur IN ('NAKIT','KART','GECIS')),
    CONSTRAINT uq_vip_odeme_donem UNIQUE (kullanici_id, baslangic)
);
CREATE INDEX IF NOT EXISTS ix_vip_odeme_kullanici ON vip_odeme (kullanici_id, bitis);
CREATE INDEX IF NOT EXISTS ix_vip_odeme_zaman     ON vip_odeme (zaman);

-- ---------------------------------------------------------------- fonksiyonlar
-- Müşterinin o gün geçerli (ödenmiş) VIP üyeliği var mı? vip_mi tek başına yetmez; ödenmiş hafta da gerekir.
CREATE OR REPLACE FUNCTION fn_vip_aktif(p_kullanici_id bigint, p_gun date DEFAULT current_date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE((SELECT k.vip_mi FROM kullanici k WHERE k.id = p_kullanici_id), false)
       AND EXISTS (SELECT 1 FROM vip_odeme v
                   WHERE v.kullanici_id = p_kullanici_id AND p_gun BETWEEN v.baslangic AND v.bitis);
$$;

-- Oturumun sahibinin VIP üyeliği geçerli mi? (07'deki tanımın yerine: artık ödeme de aranır)
CREATE OR REPLACE FUNCTION fn_oturum_vip_mi(p_oturum_id bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE((SELECT fn_vip_aktif(t.kullanici_id) FROM oturum t WHERE t.id = p_oturum_id), false);
$$;

-- ------------------------------------------------------------ tetikleyiciler
-- VIP kat kuralı (07'deki tanımın yerine): VIP katına yalnızca geçerli üyeliği olan müşteri oturabilir
CREATE OR REPLACE FUNCTION trg_vip_kat_kontrol() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_masa masa%ROWTYPE;
BEGIN
    SELECT * INTO v_masa FROM masa WHERE id = NEW.masa_id;
    IF v_masa.kat = COALESCE((SELECT vip_kat FROM ayar), 3)
       AND NOT COALESCE(fn_vip_aktif(NEW.kullanici_id), false) THEN
        RAISE EXCEPTION 'VIP_KAT_YETKISIZ: Masa % VIP Kulüp katında; yalnızca ücreti ödenmiş VIP üyeler oturabilir', v_masa.masa_no
            USING ERRCODE = 'check_violation', HINT = 'Haftalık üyelik ücretini alın (sp_vip_uyelik_ode)';
    END IF;
    RETURN NEW;
END $$;

-- Masa ücreti kuralı: geçerli VIP üyenin oturumunda giriş ücreti alınmaz, öğrenci indirimi de uygulanmaz
-- (ücretsiz girişten indirilecek bir şey yoktur; üyelik ücreti öğrenciye de tam yansır).
CREATE OR REPLACE FUNCTION trg_vip_ucretsiz() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF COALESCE(fn_vip_aktif(NEW.kullanici_id), false) THEN
        NEW.giris_ucreti   := 0;
        NEW.ogrenci_sayisi := 0;
        NEW.ogrenci_orani  := 0;
        NEW.vip_uyelik     := true;
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_vip_ucretsiz BEFORE INSERT ON oturum
    FOR EACH ROW EXECUTE FUNCTION trg_vip_ucretsiz();

-- ------------------------------------------------------------ prosedür
-- Haftalık VIP üyelik ücretini tahsil et (kasiyer/yönetici). Ücret ayar.vip_haftalik_ucret; öğrenci olsa da indirimsiz.
-- Geçerli üyelik varsa yeni hafta onun bitişinden sonraki günden başlar (erken yenileme gün kaybettirmez),
-- yoksa bugünden başlar. İlk ödemede müşteri VIP üye olarak işaretlenir.
-- Dönen değerler (INOUT): ödeme id'si, alınan tutar ve üyeliğin geçerli olduğu son gün (kasiyerin tabloya erişimi yoktur).
DROP PROCEDURE IF EXISTS sp_vip_uyelik_ode(bigint, text, bigint, numeric, date);
CREATE OR REPLACE PROCEDURE sp_vip_uyelik_ode(p_kullanici_id bigint, p_odeme_turu text,
                                              INOUT p_odeme_id bigint DEFAULT NULL,
                                              INOUT p_tutar numeric DEFAULT NULL,
                                              INOUT p_bitis date DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bas date;
BEGIN
    IF upper(p_odeme_turu) NOT IN ('NAKIT','KART') THEN
        RAISE EXCEPTION 'Ödeme türü NAKIT veya KART olmalı' USING ERRCODE = 'check_violation';
    END IF;
    PERFORM 1 FROM kullanici WHERE id = p_kullanici_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Müşteri bulunamadı: %', p_kullanici_id USING ERRCODE = 'no_data_found';
    END IF;

    SELECT GREATEST(current_date, COALESCE(max(bitis) + 1, current_date)) INTO v_bas
      FROM vip_odeme WHERE kullanici_id = p_kullanici_id;

    INSERT INTO vip_odeme (kullanici_id, personel_id, baslangic, bitis, tutar, tur)
    VALUES (p_kullanici_id, fn_aktif_personel(), v_bas, v_bas + 6, (SELECT vip_haftalik_ucret FROM ayar), upper(p_odeme_turu))
    RETURNING id, tutar, bitis INTO p_odeme_id, p_tutar, p_bitis;

    UPDATE kullanici SET vip_mi = true, vip_baslangic = COALESCE(vip_baslangic, current_date)
     WHERE id = p_kullanici_id;
END $$;

-- ------------------------------------------------------------ view'lar
-- Müşteri segmentleri (maskeli): VIP / OGRENCI / NORMAL. VIP üye aynı zamanda öğrenciyse VIP sayılır.
-- vip_aktif: ödenmiş hafta şu an geçerli mi; vip_bitis: son ödenen haftanın son günü.
CREATE OR REPLACE VIEW v_musteri_segment AS
SELECT k.id, fn_ad_maskele(k.ad) AS ad, fn_ad_maskele(k.soyad) AS soyad, fn_telefon_maskele(k.telefon) AS telefon,
       CASE WHEN k.vip_mi THEN 'VIP' WHEN k.ogrenci THEN 'OGRENCI' ELSE 'NORMAL' END AS segment,
       k.ogrenci, k.vip_mi, fn_vip_aktif(k.id) AS vip_aktif,
       (SELECT max(v.bitis) FROM vip_odeme v WHERE v.kullanici_id = k.id) AS vip_bitis,
       (SELECT count(*) FROM vip_odeme v WHERE v.kullanici_id = k.id AND v.tur <> 'GECIS') AS vip_odeme_sayisi,
       k.uyelik_tarihi,
       (SELECT count(*) FROM oturum t WHERE t.kullanici_id = k.id AND t.kapanis IS NOT NULL) AS ziyaret_sayisi,
       COALESCE((SELECT sum(o.tutar) FROM odeme o JOIN oturum t ON t.id = o.oturum_id WHERE t.kullanici_id = k.id), 0) AS harcama
FROM kullanici k;

-- Üyelik gelirleri günlük (GECIS satırları ciroya girmez)
CREATE OR REPLACE VIEW v_vip_uyelik_gelir AS
SELECT v.zaman::date AS gun, count(*) AS odeme_sayisi, sum(v.tutar) AS gelir,
       COALESCE(sum(v.tutar) FILTER (WHERE v.tur = 'NAKIT'), 0) AS nakit,
       COALESCE(sum(v.tutar) FILTER (WHERE v.tur = 'KART'), 0)  AS kart
FROM vip_odeme v
WHERE v.tur <> 'GECIS'
GROUP BY v.zaman::date;

-- ------------------------------------------------------------ yetkiler
REVOKE EXECUTE ON FUNCTION fn_vip_aktif(bigint, date), trg_vip_ucretsiz() FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE sp_vip_uyelik_ode(bigint, text, bigint, numeric, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_vip_aktif(bigint, date) TO rol_garson;      -- tetikleyiciler çağıran rolle çalışır
GRANT EXECUTE ON PROCEDURE sp_vip_uyelik_ode(bigint, text, bigint, numeric, date) TO rol_kasiyer;
GRANT ALL ON vip_odeme TO rol_yonetici;
GRANT SELECT ON v_musteri_segment, v_vip_uyelik_gelir TO rol_yonetici;

-- ------------------------------------------------------------ veri
-- 09 öncesinden VIP olan üyelere ilk hafta ücretsiz tanınır (üyelikleri bir anda geçersiz kalmasın)
INSERT INTO vip_odeme (kullanici_id, personel_id, baslangic, bitis, tutar, tur)
SELECT k.id, (SELECT min(id) FROM personel WHERE rol = 'YONETICI'), current_date, current_date + 6, 0, 'GECIS'
FROM kullanici k
WHERE k.vip_mi AND NOT EXISTS (SELECT 1 FROM vip_odeme v WHERE v.kullanici_id = k.id)
  AND EXISTS (SELECT 1 FROM personel WHERE rol = 'YONETICI');
