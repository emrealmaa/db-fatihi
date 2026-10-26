-- Yetkilendirme ve maskeleme
-- Grup rolleri (login yok) + uygulama login rolleri. Parolalar yalnızca geliştirme içindir.

CREATE ROLE rol_garson;
CREATE ROLE rol_kasiyer;
CREATE ROLE rol_yonetici;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO rol_garson, rol_kasiyer, rol_yonetici;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA public FROM PUBLIC;

-- Garson: maskeli görünümler + masa/oyun işlemleri. Ham kullanici tablosuna erişemez.
GRANT SELECT ON v_musait_oyunlar, v_masa_durumu, v_bekleme_sirasi, v_musteri_maskeli TO rol_garson;
GRANT EXECUTE ON PROCEDURE sp_oturum_ac, sp_bekleme_ekle, sp_oyun_baslat, sp_oyun_sec,
                           sp_oyun_bitir, sp_siparis_ver TO rol_garson;
GRANT EXECUTE ON FUNCTION fn_musait_adet, fn_ad_maskele, fn_email_maskele, fn_telefon_maskele TO rol_garson;

-- Kasiyer: garson yetkileri + hesaplar ve kapanış
GRANT rol_garson TO rol_kasiyer;
GRANT SELECT ON v_acik_hesaplar, v_gunluk_ciro TO rol_kasiyer;
GRANT EXECUTE ON PROCEDURE sp_oturum_kapat TO rol_kasiyer;
GRANT EXECUTE ON FUNCTION fn_hesap_hesapla, fn_hesap_detay TO rol_kasiyer;  -- DEFINER: tablolara kasiyer doğrudan erişmez

-- Yönetici: her şey (maskesiz ham veri dahil)
GRANT ALL ON ALL TABLES IN SCHEMA public TO rol_yonetici;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO rol_yonetici;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO rol_yonetici;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO rol_yonetici;

CREATE ROLE garson_app  LOGIN PASSWORD 'garson_dev_pw'  IN ROLE rol_garson;
CREATE ROLE kasiyer_app LOGIN PASSWORD 'kasiyer_dev_pw' IN ROLE rol_kasiyer;
CREATE ROLE yonetici_app LOGIN PASSWORD 'yonetici_dev_pw' IN ROLE rol_yonetici;
