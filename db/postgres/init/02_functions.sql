-- Kullanıcı tanımlı fonksiyonlar ve kısıt tetikleyicileri

-- Bir oyunun şu an müsait kopya sayısı
CREATE FUNCTION fn_musait_adet(p_oyun_id int) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT o.toplam_adet - (SELECT count(*) FROM oturum_oyun oo
                            WHERE oo.oyun_id = o.id AND oo.bitis IS NULL)::int
    FROM oyun o WHERE o.id = p_oyun_id;
$$;

-- Hesap dökümü: masa ücreti + oyun ücreti + sipariş. Süre 15 dk'lık dilimlere yukarı yuvarlanır.
CREATE FUNCTION fn_hesap_detay(p_oturum_id bigint)
RETURNS TABLE (masa_ucreti numeric, oyun_ucreti numeric, siparis_toplam numeric, toplam numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_oturum oturum%ROWTYPE;
    v_bitis  timestamptz;
    v_masa   numeric(8,2);
BEGIN
    SELECT * INTO v_oturum FROM oturum WHERE id = p_oturum_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Oturum bulunamadı: %', p_oturum_id;
    END IF;
    v_bitis := COALESCE(v_oturum.kapanis, clock_timestamp());
    SELECT kisi_basi_ucret INTO v_masa FROM masa WHERE id = v_oturum.masa_id;

    masa_ucreti := round(v_masa * v_oturum.kisi_sayisi
                         * ceil(extract(epoch FROM v_bitis - v_oturum.acilis) / 900) / 4, 2);

    SELECT COALESCE(round(sum(o.saatlik_ucret
                              * ceil(extract(epoch FROM COALESCE(oo.bitis, v_bitis) - oo.baslangic) / 900) / 4), 2), 0)
      INTO oyun_ucreti
      FROM oturum_oyun oo JOIN oyun o ON o.id = oo.oyun_id
     WHERE oo.oturum_id = p_oturum_id;

    SELECT COALESCE(sum(adet * birim_fiyat), 0) INTO siparis_toplam
      FROM siparis WHERE oturum_id = p_oturum_id;

    toplam := masa_ucreti + oyun_ucreti + siparis_toplam;
    RETURN NEXT;
END $$;

-- Masanın hesabı
CREATE FUNCTION fn_hesap_hesapla(p_oturum_id bigint) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT toplam FROM fn_hesap_detay(p_oturum_id);
$$;

-- Maskeleme: 05321234567 -> 0532*****67
CREATE FUNCTION fn_telefon_maskele(p_telefon text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT left(p_telefon, 4) || repeat('*', greatest(length(p_telefon) - 6, 0)) || right(p_telefon, 2);
$$;

-- ali@mail.com -> a**@mail.com
CREATE FUNCTION fn_email_maskele(p_email text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT left(p_email, 1) || repeat('*', greatest(position('@' in p_email) - 2, 0))
           || substr(p_email, position('@' in p_email));
$$;

-- Ayşe -> A***
CREATE FUNCTION fn_ad_maskele(p_ad text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT left(p_ad, 1) || repeat('*', greatest(length(p_ad) - 1, 0));
$$;

-- ------------------------------------------------------------ tetikleyiciler
-- Kişi sayısı masa kapasitesini aşamaz
CREATE FUNCTION trg_oturum_kontrol() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_kap smallint;
BEGIN
    SELECT kapasite INTO v_kap FROM masa WHERE id = NEW.masa_id;
    IF NEW.kisi_sayisi > v_kap THEN
        RAISE EXCEPTION 'Kişi sayısı (%) masa kapasitesini (%) aşıyor', NEW.kisi_sayisi, v_kap
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_oturum_kontrol BEFORE INSERT OR UPDATE OF masa_id, kisi_sayisi ON oturum
    FOR EACH ROW EXECUTE FUNCTION trg_oturum_kontrol();

-- Oyun başlarken: aktif oyun, müsait adet ve oyuncu sayısı kontrolü (adet aşımı = yarış koşulu, satır kilidiyle)
CREATE FUNCTION trg_oturum_oyun_kontrol() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_oyun  oyun%ROWTYPE;
    v_kisi  smallint;
BEGIN
    SELECT * INTO v_oyun FROM oyun WHERE id = NEW.oyun_id FOR UPDATE;
    IF NOT v_oyun.aktif THEN
        RAISE EXCEPTION '% oyunu aktif değil', v_oyun.ad USING ERRCODE = 'check_violation';
    END IF;
    IF fn_musait_adet(NEW.oyun_id) < 1 THEN
        RAISE EXCEPTION '% için müsait kopya yok', v_oyun.ad USING ERRCODE = 'check_violation';
    END IF;
    SELECT kisi_sayisi INTO v_kisi FROM oturum WHERE id = NEW.oturum_id;
    IF v_kisi NOT BETWEEN v_oyun.min_oyuncu AND v_oyun.max_oyuncu THEN
        RAISE EXCEPTION '% % - % oyuncu için uygun (masada % kişi var)',
            v_oyun.ad, v_oyun.min_oyuncu, v_oyun.max_oyuncu, v_kisi USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_oturum_oyun_kontrol BEFORE INSERT ON oturum_oyun
    FOR EACH ROW EXECUTE FUNCTION trg_oturum_oyun_kontrol();
