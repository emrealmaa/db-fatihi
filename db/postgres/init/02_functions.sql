-- Kullanıcı tanımlı fonksiyonlar ve kısıt tetikleyicileri

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

-- İşlemi yapan personel. API her işlemde transaction başında
-- set_config('app.personel_id', <id>, true) çağırır; prosedürler buradan okur.
CREATE FUNCTION fn_aktif_personel() RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id int;
BEGIN
    v_id := nullif(current_setting('app.personel_id', true), '')::int;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'İşlemi yapan personel belirtilmedi (app.personel_id)'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM personel WHERE id = v_id AND aktif) THEN
        RAISE EXCEPTION 'Personel bulunamadı veya aktif değil: %', v_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN v_id;
END $$;

-- Bir oyunun şu an müsait kopya sayısı
CREATE FUNCTION fn_musait_adet(p_oyun_id int) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT o.toplam_adet - (SELECT count(*) FROM oturum_oyun oo
                            WHERE oo.oyun_id = o.id AND oo.bitis IS NULL)::int
    FROM oyun o WHERE o.id = p_oyun_id;
$$;

-- Bu kişi sayısıyla oynanabilecek müsait bir oyun var mı (seçim hakkı vermeden önce bakılır)
CREATE FUNCTION fn_uygun_oyun_var(p_kisi int) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM oyun o
                   WHERE o.aktif AND p_kisi BETWEEN o.min_oyuncu AND o.max_oyuncu
                     AND fn_musait_adet(o.id) > 0);
$$;

-- Hesap dökümü: kişi başı giriş ücreti + siparişler - indirim
CREATE FUNCTION fn_hesap_detay(p_oturum_id bigint)
RETURNS TABLE (giris_toplam numeric, siparis_toplam numeric, indirim numeric, toplam numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_oturum oturum%ROWTYPE;
BEGIN
    SELECT * INTO v_oturum FROM oturum WHERE id = p_oturum_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Oturum bulunamadı: %', p_oturum_id USING ERRCODE = 'no_data_found';
    END IF;

    giris_toplam := v_oturum.kisi_sayisi * v_oturum.giris_ucreti;
    SELECT COALESCE(sum(adet * birim_fiyat), 0) INTO siparis_toplam
      FROM siparis WHERE oturum_id = p_oturum_id;
    indirim := least(v_oturum.indirim_tutari, giris_toplam + siparis_toplam);
    toplam  := giris_toplam + siparis_toplam - indirim;
    RETURN NEXT;
END $$;

-- Masanın ödenecek tutarı
CREATE FUNCTION fn_hesap_hesapla(p_oturum_id bigint) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT toplam FROM fn_hesap_detay(p_oturum_id);
$$;

-- Telefonla müşteri arama (garson ham tabloyu göremez; yalnızca id ve maskeli ad döner)
CREATE FUNCTION fn_musteri_bul(p_telefon text)
RETURNS TABLE (id bigint, ad text, soyad text, telefon text, ogrenci boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT k.id, fn_ad_maskele(k.ad), fn_ad_maskele(k.soyad), fn_telefon_maskele(k.telefon), k.ogrenci
    FROM kullanici k WHERE k.telefon = p_telefon;
$$;

-- Personel girişi: kullanıcı adı + parola doğruysa personel bilgisini döner, değilse boş.
-- Hash hiçbir zaman dışarı verilmez.
CREATE FUNCTION fn_personel_giris(p_kullanici_adi text, p_parola text)
RETURNS TABLE (personel_id int, ad text, soyad text, rol text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p.id, p.ad, p.soyad, p.rol FROM personel p
    WHERE p.kullanici_adi = lower(p_kullanici_adi) AND p.aktif
      AND p.parola_hash = crypt(p_parola, p.parola_hash);
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

-- Oyun başlarken:
--  * oturum açık olmalı
--  * başka bir masa seçim hakkını kullanıyorsa sıra atlanamaz
--  * oyun aktif, müsait kopya var, oyuncu sayısı uygun (adet aşımı = yarış koşulu, satır kilidiyle)
CREATE FUNCTION trg_oturum_oyun_kontrol() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_oyun  oyun%ROWTYPE;
    v_kisi  smallint;
    v_masa  smallint;
BEGIN
    SELECT kisi_sayisi INTO v_kisi FROM oturum WHERE id = NEW.oturum_id AND kapanis IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Açık oturum bulunamadı: %', NEW.oturum_id USING ERRCODE = 'check_violation';
    END IF;

    SELECT m.masa_no INTO v_masa
      FROM bekleme b JOIN oturum t ON t.id = b.oturum_id JOIN masa m ON m.id = t.masa_id
     WHERE b.durum = 'SECIM_HAKKI' AND b.oturum_id <> NEW.oturum_id;
    IF FOUND THEN
        RAISE EXCEPTION 'Sıra masa %''da: seçim hakkı onda. Bu masayı bekleme sırasına ekleyin', v_masa
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_oyun FROM oyun WHERE id = NEW.oyun_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Oyun bulunamadı: %', NEW.oyun_id USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF NOT v_oyun.aktif THEN
        RAISE EXCEPTION '% oyunu aktif değil', v_oyun.ad USING ERRCODE = 'check_violation';
    END IF;
    IF fn_musait_adet(NEW.oyun_id) < 1 THEN
        RAISE EXCEPTION '% için müsait kopya yok', v_oyun.ad USING ERRCODE = 'check_violation';
    END IF;
    IF v_kisi NOT BETWEEN v_oyun.min_oyuncu AND v_oyun.max_oyuncu THEN
        RAISE EXCEPTION '% % - % oyuncu için uygun (masada % kişi var)',
            v_oyun.ad, v_oyun.min_oyuncu, v_oyun.max_oyuncu, v_kisi USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_oturum_oyun_kontrol BEFORE INSERT ON oturum_oyun
    FOR EACH ROW EXECUTE FUNCTION trg_oturum_oyun_kontrol();

-- Kapanmış oturuma sipariş/oyun eklenemez, kapanmış hesap değiştirilemez
CREATE FUNCTION trg_kapali_oturum_kontrol() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM oturum WHERE id = NEW.oturum_id AND kapanis IS NOT NULL) THEN
        RAISE EXCEPTION 'Oturum % kapanmış, değişiklik yapılamaz', NEW.oturum_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_siparis_kapali_oturum BEFORE INSERT ON siparis
    FOR EACH ROW EXECUTE FUNCTION trg_kapali_oturum_kontrol();
