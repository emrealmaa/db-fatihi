-- Stored procedure'ler. SECURITY DEFINER: uygulama rolleri tablolara doğrudan erişmeden bunları çağırır.

CREATE PROCEDURE sp_oturum_ac(p_masa_id smallint, p_kullanici_id bigint, p_kisi smallint, INOUT p_oturum_id bigint DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO oturum (masa_id, kullanici_id, kisi_sayisi)
    VALUES (p_masa_id, p_kullanici_id, p_kisi)
    RETURNING id INTO p_oturum_id;
END $$;

-- Oyun müsait değilse masa kuyruğa alınır
CREATE PROCEDURE sp_bekleme_ekle(p_oturum_id bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO bekleme (oturum_id) VALUES (p_oturum_id);
END $$;

-- Sıradaki masaya seçim hakkı ver (aynı anda tek masa seçim hakkına sahiptir)
CREATE PROCEDURE sp_sirayi_ilerlet()
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
    IF EXISTS (SELECT 1 FROM bekleme WHERE durum = 'SECIM_HAKKI') THEN
        RETURN;
    END IF;
    SELECT id INTO v_id FROM bekleme WHERE durum = 'BEKLIYOR' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF v_id IS NOT NULL THEN
        UPDATE bekleme SET durum = 'SECIM_HAKKI', secim_hakki_zamani = clock_timestamp() WHERE id = v_id;
    END IF;
END $$;

-- Doğrudan oyun başlat (müsaitse). Kuyruktaki kaydı tamamlar.
CREATE PROCEDURE sp_oyun_baslat(p_oturum_id bigint, p_oyun_id int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO oturum_oyun (oturum_id, oyun_id) VALUES (p_oturum_id, p_oyun_id);
    UPDATE bekleme SET durum = 'TAMAMLANDI'
     WHERE oturum_id = p_oturum_id AND durum IN ('BEKLIYOR','SECIM_HAKKI');
    CALL sp_sirayi_ilerlet();   -- yeni seçim hakkı gerekebilir (başka müsait oyun varsa)
END $$;

-- Seçim hakkı olan masa müsait oyunlar arasından seçer
CREATE PROCEDURE sp_oyun_sec(p_bekleme_id bigint, p_oyun_id int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_oturum bigint;
BEGIN
    SELECT oturum_id INTO v_oturum FROM bekleme WHERE id = p_bekleme_id AND durum = 'SECIM_HAKKI' FOR UPDATE;
    IF v_oturum IS NULL THEN
        RAISE EXCEPTION 'Bu kayıt için seçim hakkı yok (bekleme: %)', p_bekleme_id;
    END IF;
    CALL sp_oyun_baslat(v_oturum, p_oyun_id);
END $$;

-- Oyunu iade et; sıradaki masaya seçim hakkı gider
CREATE PROCEDURE sp_oyun_bitir(p_oturum_oyun_id bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE oturum_oyun SET bitis = clock_timestamp() WHERE id = p_oturum_oyun_id AND bitis IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aktif oyun kaydı bulunamadı: %', p_oturum_oyun_id;
    END IF;
    CALL sp_sirayi_ilerlet();
END $$;

-- Seçim süresini aşan masa sıranın sonuna atılır
CREATE PROCEDURE sp_secim_suresi_doldur(p_dakika int DEFAULT 5)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
    FOR r IN SELECT id, oturum_id FROM bekleme
              WHERE durum = 'SECIM_HAKKI' AND secim_hakki_zamani < clock_timestamp() - make_interval(mins => p_dakika)
    LOOP
        UPDATE bekleme SET durum = 'ATLANDI', secim_hakki_zamani = NULL WHERE id = r.id;
        INSERT INTO bekleme (oturum_id) VALUES (r.oturum_id);
    END LOOP;
    CALL sp_sirayi_ilerlet();
END $$;

CREATE PROCEDURE sp_siparis_ver(p_oturum_id bigint, p_urun_id int, p_adet int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fiyat numeric(8,2);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM oturum WHERE id = p_oturum_id AND kapanis IS NULL) THEN
        RAISE EXCEPTION 'Açık oturum bulunamadı: %', p_oturum_id;
    END IF;
    UPDATE urun SET stok = stok - p_adet WHERE id = p_urun_id AND aktif RETURNING fiyat INTO v_fiyat;  -- stok CHECK'i yetersizlikte hata verir
    IF v_fiyat IS NULL THEN
        RAISE EXCEPTION 'Ürün bulunamadı veya aktif değil: %', p_urun_id;
    END IF;
    INSERT INTO siparis (oturum_id, urun_id, adet, birim_fiyat) VALUES (p_oturum_id, p_urun_id, p_adet, v_fiyat);
END $$;

-- Hesabı kapat: aktif oyunu iade eder, masayı serbest bırakır, tutarı döner
CREATE PROCEDURE sp_oturum_kapat(p_oturum_id bigint, INOUT p_toplam numeric DEFAULT NULL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
    FOR r IN SELECT id FROM oturum_oyun WHERE oturum_id = p_oturum_id AND bitis IS NULL LOOP
        UPDATE oturum_oyun SET bitis = clock_timestamp() WHERE id = r.id;
    END LOOP;
    UPDATE bekleme SET durum = 'IPTAL', secim_hakki_zamani = NULL
     WHERE oturum_id = p_oturum_id AND durum IN ('BEKLIYOR','SECIM_HAKKI');
    UPDATE oturum SET kapanis = clock_timestamp() WHERE id = p_oturum_id AND kapanis IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Açık oturum bulunamadı: %', p_oturum_id;
    END IF;
    p_toplam := fn_hesap_hesapla(p_oturum_id);
    CALL sp_sirayi_ilerlet();
END $$;
