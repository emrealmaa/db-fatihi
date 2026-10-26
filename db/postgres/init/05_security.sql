-- Yetkilendirme ve maskeleme
-- Grup rolleri (login yok) + uygulama login rolleri. Parolalar yalnızca geliştirme içindir.
-- Roller sunucu genelinde olduğundan betik tekrar çalıştırılabilir yazıldı.

DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['rol_giris','rol_garson','rol_kasiyer','rol_yonetici'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I', r);
        END IF;
    END LOOP;
END $$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO rol_giris, rol_garson, rol_kasiyer, rol_yonetici;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA public FROM PUBLIC;

-- Giriş: yalnızca parola doğrulama fonksiyonu. Personel tablosunu göremez.
GRANT EXECUTE ON FUNCTION fn_personel_giris(text, text) TO rol_giris;

-- Garson: maskeli görünümler + masa/oyun/sipariş işlemleri. Ham kullanici/personel tablosu yasak.
-- (View'daki fonksiyonların çalıştırma izni çağıran role göre kontrol edilir, bu yüzden açıkça verilir.)
GRANT SELECT ON v_musait_oyunlar, v_masa_durumu, v_bekleme_sirasi, v_musteri_maskeli,
                v_menu, v_oturum_siparisleri TO rol_garson;
GRANT EXECUTE ON FUNCTION fn_musait_adet(int), fn_ayrilan_adet(int), fn_ad_maskele(text), fn_email_maskele(text),
                          fn_telefon_maskele(text), fn_musteri_bul(text), fn_aktif_personel()
                          TO rol_garson;
GRANT EXECUTE ON PROCEDURE sp_musteri_kaydet, sp_oturum_ac, sp_bekleme_ekle, sp_bekleme_iptal,
                           sp_oyun_baslat, sp_oyun_sec, sp_oyun_bitir, sp_siparis_ver,
                           sp_siparis_iptal, sp_secim_suresi_doldur TO rol_garson;

-- Kasiyer: garson yetkileri + hesaplar, kapanış ve ödeme
GRANT rol_garson TO rol_kasiyer;
GRANT SELECT ON v_acik_hesaplar, v_gunluk_ciro TO rol_kasiyer;
GRANT EXECUTE ON PROCEDURE sp_oturum_kapat TO rol_kasiyer;
GRANT EXECUTE ON FUNCTION fn_hesap_hesapla(bigint), fn_hesap_detay(bigint) TO rol_kasiyer;  -- DEFINER: tablolara kasiyer doğrudan erişmez

-- Yönetici: her şey (maskesiz ham veri dahil)
GRANT rol_kasiyer TO rol_yonetici;
GRANT ALL ON ALL TABLES IN SCHEMA public TO rol_yonetici;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO rol_yonetici;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO rol_yonetici;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO rol_yonetici;

-- Login rolleri (API bunlarla bağlanır)
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT * FROM (VALUES ('giris_app','giris_dev_pw','rol_giris'),
                                   ('garson_app','garson_dev_pw','rol_garson'),
                                   ('kasiyer_app','kasiyer_dev_pw','rol_kasiyer'),
                                   ('yonetici_app','yonetici_dev_pw','rol_yonetici')) v(ad, parola, grup)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.ad) THEN
            EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', r.ad, r.parola);
        END IF;
        EXECUTE format('GRANT %I TO %I', r.grup, r.ad);
    END LOOP;
END $$;
