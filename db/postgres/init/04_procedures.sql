-- Stored procedure'ler. SECURITY DEFINER: uygulama rolleri tablolara doğrudan erişmeden bunları çağırır.
-- İşlemi yapan personel fn_aktif_personel() ile okunur (API transaction başında ayarlar).

-- ------------------------------------------------------------ müşteri ve oturum
-- Yeni müşteri kaydı (telefon zaten kayıtlıysa o müşterinin id'si döner)
CREATE PROCEDURE sp_musteri_kaydet(p_ad text, p_soyad text, p_telefon text,
                                   p_email text DEFAULT NULL, p_ogrenci boolean DEFAULT false,
                                   INOUT p_kullanici_id bigint DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM fn_aktif_personel();
    SELECT id INTO p_kullanici_id FROM kullanici WHERE telefon = p_telefon;
    IF p_kullanici_id IS NULL THEN
        INSERT INTO kullanici (ad, soyad, telefon, email, ogrenci)
        VALUES (trim(p_ad), trim(p_soyad), p_telefon, nullif(trim(p_email), ''), COALESCE(p_ogrenci, false))
        RETURNING id INTO p_kullanici_id;
    END IF;
END $$;

-- Masa aç. Giriş ücreti ayardan oturuma kopyalanır.
CREATE PROCEDURE sp_oturum_ac(p_masa_id int, p_kisi int, p_kullanici_id bigint DEFAULT NULL,
                              INOUT p_oturum_id bigint DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ayar ayar%ROWTYPE;
BEGIN
    SELECT * INTO v_ayar FROM ayar;
    IF p_kullanici_id IS NULL AND v_ayar.kayit_zorunlu THEN
        RAISE EXCEPTION 'Masa açmak için müşteri kaydı gerekli' USING ERRCODE = 'not_null_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM oturum WHERE masa_id = p_masa_id AND kapanis IS NULL) THEN
        RAISE EXCEPTION 'Masa zaten dolu' USING ERRCODE = 'unique_violation';
    END IF;
    INSERT INTO oturum (masa_id, kullanici_id, personel_id, kisi_sayisi, giris_ucreti)
    VALUES (p_masa_id, p_kullanici_id, fn_aktif_personel(), p_kisi, v_ayar.giris_ucreti)
    RETURNING id INTO p_oturum_id;
END $$;

-- ------------------------------------------------------------ bekleme sırası
-- Sıradaki uygun masaya seçim hakkı ver. Aynı anda tek masa hakka sahiptir; hak yalnızca
-- masanın kişi sayısına uygun müsait bir oyun varsa verilir (yoksa sıradaki uygun masaya geçilir).
CREATE PROCEDURE sp_sirayi_ilerlet()
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
    IF EXISTS (SELECT 1 FROM bekleme WHERE durum = 'SECIM_HAKKI') THEN
        RETURN;
    END IF;
    SELECT b.id INTO v_id
      FROM bekleme b JOIN oturum t ON t.id = b.oturum_id
     WHERE b.durum = 'BEKLIYOR' AND fn_uygun_oyun_var(t.kisi_sayisi)
     ORDER BY b.id LIMIT 1
       FOR UPDATE OF b SKIP LOCKED;
    IF v_id IS NOT NULL THEN
        UPDATE bekleme SET durum = 'SECIM_HAKKI', secim_hakki_zamani = clock_timestamp() WHERE id = v_id;
    END IF;
END $$;

-- İstediği oyun dolu olan masa sıraya girer
CREATE PROCEDURE sp_bekleme_ekle(p_oturum_id bigint, INOUT p_bekleme_id bigint DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM fn_aktif_personel();
    IF NOT EXISTS (SELECT 1 FROM oturum WHERE id = p_oturum_id AND kapanis IS NULL) THEN
        RAISE EXCEPTION 'Açık oturum bulunamadı: %', p_oturum_id USING ERRCODE = 'no_data_found';
    END IF;
    IF EXISTS (SELECT 1 FROM oturum_oyun WHERE oturum_id = p_oturum_id AND bitis IS NULL) THEN
        RAISE EXCEPTION 'Masa zaten oyun oynuyor; önce oyunu iade edin' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO bekleme (oturum_id) VALUES (p_oturum_id) RETURNING id INTO p_bekleme_id;
END $$;

-- Masa sıradan çıkar
CREATE PROCEDURE sp_bekleme_iptal(p_bekleme_id bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM fn_aktif_personel();
    UPDATE bekleme SET durum = 'IPTAL', secim_hakki_zamani = NULL
     WHERE id = p_bekleme_id AND durum IN ('BEKLIYOR','SECIM_HAKKI');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aktif bekleme kaydı bulunamadı: %', p_bekleme_id USING ERRCODE = 'no_data_found';
    END IF;
    CALL sp_sirayi_ilerlet();
END $$;

-- ------------------------------------------------------------ oyun
-- Oyun başlat (müsaitse ve sıra atlanmıyorsa; kontrol tetikleyicide). Kuyruktaki kaydı tamamlar.
CREATE PROCEDURE sp_oyun_baslat(p_oturum_id bigint, p_oyun_id int, INOUT p_oturum_oyun_id bigint DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM fn_aktif_personel();
    INSERT INTO oturum_oyun (oturum_id, oyun_id) VALUES (p_oturum_id, p_oyun_id)
    RETURNING id INTO p_oturum_oyun_id;
    UPDATE bekleme SET durum = 'TAMAMLANDI'
     WHERE oturum_id = p_oturum_id AND durum IN ('BEKLIYOR','SECIM_HAKKI');
    CALL sp_sirayi_ilerlet();   -- başka uygun oyun varsa sıradaki masaya hak geçer
END $$;

-- Seçim hakkı olan masa müsait oyunlar arasından seçer
CREATE PROCEDURE sp_oyun_sec(p_bekleme_id bigint, p_oyun_id int, INOUT p_oturum_oyun_id bigint DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_oturum bigint;
BEGIN
    SELECT oturum_id INTO v_oturum FROM bekleme WHERE id = p_bekleme_id AND durum = 'SECIM_HAKKI' FOR UPDATE;
    IF v_oturum IS NULL THEN
        RAISE EXCEPTION 'Bu kayıt için seçim hakkı yok (bekleme: %)', p_bekleme_id USING ERRCODE = 'check_violation';
    END IF;
    CALL sp_oyun_baslat(v_oturum, p_oyun_id, p_oturum_oyun_id);
END $$;

-- Oyunu iade et; sıradaki uygun masaya seçim hakkı gider
CREATE PROCEDURE sp_oyun_bitir(p_oturum_oyun_id bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM fn_aktif_personel();
    UPDATE oturum_oyun SET bitis = clock_timestamp() WHERE id = p_oturum_oyun_id AND bitis IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aktif oyun kaydı bulunamadı: %', p_oturum_oyun_id USING ERRCODE = 'no_data_found';
    END IF;
    CALL sp_sirayi_ilerlet();
END $$;

-- Seçim süresini aşan masa sıranın sonuna atılır (zamanlayıcı düzenli çağırır).
-- p_dakika verilmezse ayar.secim_suresi_dk kullanılır.
CREATE PROCEDURE sp_secim_suresi_doldur(p_dakika int DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
    p_dakika := COALESCE(p_dakika, (SELECT secim_suresi_dk FROM ayar));
    FOR r IN SELECT id, oturum_id FROM bekleme
              WHERE durum = 'SECIM_HAKKI' AND secim_hakki_zamani < clock_timestamp() - make_interval(mins => p_dakika)
              FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE bekleme SET durum = 'ATLANDI', secim_hakki_zamani = NULL WHERE id = r.id;
        INSERT INTO bekleme (oturum_id) VALUES (r.oturum_id);
    END LOOP;
    CALL sp_sirayi_ilerlet();
END $$;

-- ------------------------------------------------------------ sipariş ve hesap
CREATE PROCEDURE sp_siparis_ver(p_oturum_id bigint, p_urun_id int, p_adet int, INOUT p_siparis_id bigint DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_urun urun%ROWTYPE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM oturum WHERE id = p_oturum_id AND kapanis IS NULL) THEN
        RAISE EXCEPTION 'Açık oturum bulunamadı: %', p_oturum_id USING ERRCODE = 'no_data_found';
    END IF;
    SELECT * INTO v_urun FROM urun WHERE id = p_urun_id FOR UPDATE;
    IF NOT FOUND OR NOT v_urun.aktif THEN
        RAISE EXCEPTION 'Ürün bulunamadı veya menüde değil: %', p_urun_id USING ERRCODE = 'no_data_found';
    END IF;
    IF p_adet IS NULL OR p_adet < 1 THEN
        RAISE EXCEPTION 'Adet en az 1 olmalı' USING ERRCODE = 'check_violation';
    END IF;
    IF v_urun.stok < p_adet THEN
        RAISE EXCEPTION '% için yeterli stok yok (stok: %, istenen: %)', v_urun.ad, v_urun.stok, p_adet
            USING ERRCODE = 'check_violation';
    END IF;
    UPDATE urun SET stok = stok - p_adet WHERE id = p_urun_id;
    INSERT INTO siparis (oturum_id, urun_id, personel_id, adet, birim_fiyat)
    VALUES (p_oturum_id, p_urun_id, fn_aktif_personel(), p_adet, v_urun.fiyat)
    RETURNING id INTO p_siparis_id;
END $$;

-- Yanlış girilen siparişi geri al (stok iade edilir). Yalnızca açık oturumda.
CREATE PROCEDURE sp_siparis_iptal(p_siparis_id bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sip siparis%ROWTYPE;
BEGIN
    PERFORM fn_aktif_personel();
    SELECT s.* INTO v_sip FROM siparis s JOIN oturum t ON t.id = s.oturum_id
     WHERE s.id = p_siparis_id AND t.kapanis IS NULL FOR UPDATE OF s;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Açık hesapta sipariş bulunamadı: %', p_siparis_id USING ERRCODE = 'no_data_found';
    END IF;
    UPDATE urun SET stok = stok + v_sip.adet WHERE id = v_sip.urun_id;
    DELETE FROM siparis WHERE id = p_siparis_id;
END $$;

-- Hesabı kapat ve ödemeyi al: aktif oyunu iade eder, sıradan çıkarır, masayı serbest bırakır.
CREATE PROCEDURE sp_oturum_kapat(p_oturum_id bigint, p_odeme_turu text, INOUT p_toplam numeric DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF upper(p_odeme_turu) NOT IN ('NAKIT','KART') THEN
        RAISE EXCEPTION 'Ödeme türü NAKIT veya KART olmalı' USING ERRCODE = 'check_violation';
    END IF;
    PERFORM 1 FROM oturum WHERE id = p_oturum_id AND kapanis IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Açık oturum bulunamadı: %', p_oturum_id USING ERRCODE = 'no_data_found';
    END IF;

    UPDATE oturum_oyun SET bitis = clock_timestamp() WHERE oturum_id = p_oturum_id AND bitis IS NULL;
    UPDATE bekleme SET durum = 'IPTAL', secim_hakki_zamani = NULL
     WHERE oturum_id = p_oturum_id AND durum IN ('BEKLIYOR','SECIM_HAKKI');

    p_toplam := fn_hesap_hesapla(p_oturum_id);
    UPDATE oturum SET kapanis = clock_timestamp() WHERE id = p_oturum_id;
    INSERT INTO odeme (oturum_id, personel_id, tur, tutar)
    VALUES (p_oturum_id, fn_aktif_personel(), upper(p_odeme_turu), p_toplam);
    CALL sp_sirayi_ilerlet();
END $$;

-- ------------------------------------------------------------ yönetici
-- Personel ekle; parola hash'lenerek saklanır
CREATE PROCEDURE sp_personel_ekle(p_ad text, p_soyad text, p_telefon text, p_rol text,
                                  p_kullanici_adi text, p_parola text, p_email text DEFAULT NULL,
                                  INOUT p_personel_id int DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF length(p_parola) < 6 THEN
        RAISE EXCEPTION 'Parola en az 6 karakter olmalı' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO personel (ad, soyad, telefon, email, rol, kullanici_adi, parola_hash)
    VALUES (trim(p_ad), trim(p_soyad), p_telefon, nullif(trim(p_email), ''), upper(p_rol),
            lower(p_kullanici_adi), crypt(p_parola, gen_salt('bf')))
    RETURNING id INTO p_personel_id;
END $$;

CREATE PROCEDURE sp_personel_parola(p_personel_id int, p_parola text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF length(p_parola) < 6 THEN
        RAISE EXCEPTION 'Parola en az 6 karakter olmalı' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE personel SET parola_hash = crypt(p_parola, gen_salt('bf')) WHERE id = p_personel_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personel bulunamadı: %', p_personel_id USING ERRCODE = 'no_data_found';
    END IF;
END $$;

-- Stok girişi (tedarik)
CREATE PROCEDURE sp_stok_ekle(p_urun_id int, p_adet int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_adet IS NULL OR p_adet < 1 THEN
        RAISE EXCEPTION 'Eklenecek adet en az 1 olmalı' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE urun SET stok = stok + p_adet WHERE id = p_urun_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ürün bulunamadı: %', p_urun_id USING ERRCODE = 'no_data_found';
    END IF;
END $$;
