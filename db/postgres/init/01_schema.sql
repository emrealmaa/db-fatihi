-- Karavana kutu oyunu cafe - şema
-- Çalıştırma sırası: 01 şema, 02 fonksiyonlar, 03 view, 04 prosedürler, 05 güvenlik, 06 seed

-- Personel parolaları crypt()/gen_salt('bf') ile hash'lenir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- ayar
-- Tek satırlık işletme ayarları. Giriş ücreti oturum açılırken oturuma kopyalanır,
-- böylece ücret değişse de geçmiş hesaplar bozulmaz.
CREATE TABLE ayar (
    id               boolean      PRIMARY KEY DEFAULT true,
    giris_ucreti     numeric(8,2) NOT NULL DEFAULT 0,   -- kişi başı
    secim_suresi_dk  smallint     NOT NULL DEFAULT 5,
    kayit_zorunlu    boolean      NOT NULL DEFAULT true, -- masa açarken müşteri kaydı şart mı
    ogrenci_indirim_orani numeric(3,2) NOT NULL DEFAULT 0.50, -- öğrenciler giriş ücretinin bu oranı kadar indirim alır
    CONSTRAINT ck_ayar_tek_satir CHECK (id),
    CONSTRAINT ck_ayar_ucret     CHECK (giris_ucreti >= 0),
    CONSTRAINT ck_ayar_ogrenci   CHECK (ogrenci_indirim_orani BETWEEN 0 AND 1),
    CONSTRAINT ck_ayar_secim     CHECK (secim_suresi_dk BETWEEN 1 AND 60)
);

-- ---------------------------------------------------------------- kullanici
-- Müşteri. E-posta isteğe bağlı (masada hızlı kayıt için ad + telefon yeterli).
CREATE TABLE kullanici (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad             varchar(50)  NOT NULL,
    soyad          varchar(50)  NOT NULL,
    email          varchar(120),
    telefon        varchar(11)  NOT NULL,
    dogum_tarihi   date,
    ogrenci        boolean      NOT NULL DEFAULT false,  -- öğrenci indirimi için (kural sonra)
    uyelik_tarihi  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_kullanici_email   UNIQUE (email),
    CONSTRAINT uq_kullanici_telefon UNIQUE (telefon),
    CONSTRAINT ck_kullanici_telefon CHECK (telefon ~ '^05[0-9]{9}$'),
    CONSTRAINT ck_kullanici_email   CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT ck_kullanici_dogum   CHECK (dogum_tarihi IS NULL OR dogum_tarihi >= DATE '1900-01-01')
);

-- ---------------------------------------------------------------- personel
-- Garson, kasiyer, yönetici. Uygulamaya kendi kullanıcı adı/parolasıyla girer;
-- API, personelin rolüne karşılık gelen veritabanı rolüyle bağlanır.
CREATE TABLE personel (
    id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad            varchar(50)  NOT NULL,
    soyad         varchar(50)  NOT NULL,
    telefon       varchar(11)  NOT NULL,
    email         varchar(120),
    rol           varchar(10)  NOT NULL,
    kullanici_adi varchar(30)  NOT NULL,
    parola_hash   text         NOT NULL,
    ise_baslama   date         NOT NULL DEFAULT current_date,
    aktif         boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_personel_kullanici_adi UNIQUE (kullanici_adi),
    CONSTRAINT uq_personel_telefon       UNIQUE (telefon),
    CONSTRAINT ck_personel_rol     CHECK (rol IN ('GARSON','KASIYER','YONETICI')),
    CONSTRAINT ck_personel_telefon CHECK (telefon ~ '^05[0-9]{9}$'),
    CONSTRAINT ck_personel_email   CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT ck_personel_kadi    CHECK (kullanici_adi ~ '^[a-z0-9_.]{3,30}$')
);

-- ---------------------------------------------------------------- kategori
CREATE TABLE kategori (
    id  smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad  varchar(40) NOT NULL,
    CONSTRAINT uq_kategori_ad UNIQUE (ad)
);

-- ---------------------------------------------------------------- oyun
-- toplam_adet: kafedeki fiziksel kopya sayısı; müsait adet fn_musait_adet ile hesaplanır
CREATE TABLE oyun (
    id             int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad             varchar(80)  NOT NULL,
    kategori_id    smallint     NOT NULL REFERENCES kategori(id) ON DELETE RESTRICT,
    min_oyuncu     smallint     NOT NULL,
    max_oyuncu     smallint     NOT NULL,
    sure_dk        smallint     NOT NULL,
    toplam_adet    int          NOT NULL DEFAULT 1,
    aktif          boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_oyun_ad       UNIQUE (ad),
    CONSTRAINT ck_oyun_oyuncu   CHECK (min_oyuncu > 0 AND max_oyuncu >= min_oyuncu),
    CONSTRAINT ck_oyun_sure     CHECK (sure_dk > 0),
    CONSTRAINT ck_oyun_adet     CHECK (toplam_adet >= 0)
);

-- ---------------------------------------------------------------- masa
CREATE TABLE masa (
    id              smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    masa_no         smallint     NOT NULL,
    kapasite        smallint     NOT NULL,
    kat             smallint     NOT NULL DEFAULT 1,   -- 1 giriş & espresso bar, 2 strateji salonu, 3 VIP/FRP
    CONSTRAINT uq_masa_no       UNIQUE (masa_no),
    CONSTRAINT ck_masa_kapasite CHECK (kapasite BETWEEN 1 AND 20),
    CONSTRAINT ck_masa_kat      CHECK (kat BETWEEN 1 AND 3)
);

-- ---------------------------------------------------------------- oturum
-- Bir masanın açılıp kapanana kadarki oturumu (hesap birimi).
-- kullanici_id yalnızca ayar.kayit_zorunlu = false iken boş olabilir (sp_oturum_ac denetler).
CREATE TABLE oturum (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    masa_id          smallint     NOT NULL REFERENCES masa(id)      ON DELETE RESTRICT,
    kullanici_id     bigint                REFERENCES kullanici(id) ON DELETE RESTRICT,
    personel_id      int          NOT NULL REFERENCES personel(id)  ON DELETE RESTRICT,  -- masayı açan
    kisi_sayisi      smallint     NOT NULL,
    giris_ucreti     numeric(8,2) NOT NULL,             -- açılış anındaki kişi başı ücret
    ogrenci_sayisi   smallint     NOT NULL DEFAULT 0,   -- gruptaki öğrenci sayısı
    ogrenci_orani    numeric(3,2) NOT NULL DEFAULT 0,   -- açılış anındaki öğrenci indirim oranı
    indirim_tutari   numeric(8,2) NOT NULL DEFAULT 0,   -- öğrenci dışı ek indirim (kampanya vb.)
    acilis           timestamptz  NOT NULL DEFAULT clock_timestamp(),
    kapanis          timestamptz,
    CONSTRAINT ck_oturum_kisi    CHECK (kisi_sayisi > 0),
    CONSTRAINT ck_oturum_ucret   CHECK (giris_ucreti >= 0),
    CONSTRAINT ck_oturum_indirim CHECK (indirim_tutari >= 0),
    CONSTRAINT ck_oturum_ogrenci CHECK (ogrenci_sayisi BETWEEN 0 AND kisi_sayisi),
    CONSTRAINT ck_oturum_oran    CHECK (ogrenci_orani BETWEEN 0 AND 1),
    CONSTRAINT ck_oturum_zaman   CHECK (kapanis IS NULL OR kapanis >= acilis)
);
-- Bir masada aynı anda yalnızca bir açık oturum olabilir
CREATE UNIQUE INDEX uq_oturum_masa_acik ON oturum (masa_id) WHERE kapanis IS NULL;
CREATE INDEX ix_oturum_kullanici ON oturum (kullanici_id);
CREATE INDEX ix_oturum_kapanis   ON oturum (kapanis) WHERE kapanis IS NOT NULL;

-- ---------------------------------------------------------------- oturum_oyun
-- Hangi masa hangi oyunu oynuyor / oynadı
CREATE TABLE oturum_oyun (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    oturum_id bigint      NOT NULL REFERENCES oturum(id) ON DELETE CASCADE,
    oyun_id   int         NOT NULL REFERENCES oyun(id)   ON DELETE RESTRICT,
    baslangic timestamptz NOT NULL DEFAULT clock_timestamp(),
    bitis     timestamptz,
    CONSTRAINT ck_oturum_oyun_zaman CHECK (bitis IS NULL OR bitis >= baslangic)
);
-- Bir oturum aynı anda tek oyun oynar
CREATE UNIQUE INDEX uq_oturum_oyun_aktif ON oturum_oyun (oturum_id) WHERE bitis IS NULL;
-- Müsait adet hesabı için: aktif oyunları oyuna göre say
CREATE INDEX ix_oturum_oyun_aktif_oyun ON oturum_oyun (oyun_id) WHERE bitis IS NULL;

-- ---------------------------------------------------------------- bekleme
-- Dolu bir oyunu bekleyen masalar; her oyunun kendi sırası vardır (sıra = id sırası).
-- O oyunun bir kopyası boşalınca sıradaki masaya SECIM_HAKKI verilir: kopya o masa için
-- ayrılır, başka masa alamaz; hak sahibi oyunu alır (sp_oyun_sec) veya süresi dolar.
CREATE TABLE bekleme (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    oturum_id          bigint      NOT NULL REFERENCES oturum(id) ON DELETE CASCADE,
    oyun_id            int         NOT NULL REFERENCES oyun(id)   ON DELETE RESTRICT,  -- beklenen oyun
    durum              varchar(12) NOT NULL DEFAULT 'BEKLIYOR',
    olusturma          timestamptz NOT NULL DEFAULT clock_timestamp(),
    secim_hakki_zamani timestamptz,
    CONSTRAINT ck_bekleme_durum CHECK (durum IN ('BEKLIYOR','SECIM_HAKKI','TAMAMLANDI','ATLANDI','IPTAL')),
    CONSTRAINT ck_bekleme_hak   CHECK (durum <> 'SECIM_HAKKI' OR secim_hakki_zamani IS NOT NULL)
);
-- Bir oturum kuyrukta tek kez bulunabilir
CREATE UNIQUE INDEX uq_bekleme_oturum_aktif ON bekleme (oturum_id) WHERE durum IN ('BEKLIYOR','SECIM_HAKKI');
-- Bir oyunun sırasındaki ilk masa (sp_sirayi_ilerlet) ve ayrılmış kopyalar (fn_ayrilan_adet)
CREATE INDEX ix_bekleme_sira ON bekleme (oyun_id, id) WHERE durum = 'BEKLIYOR';
CREATE INDEX ix_bekleme_hak  ON bekleme (oyun_id) WHERE durum = 'SECIM_HAKKI';

-- ---------------------------------------------------------------- urun_kategori / urun / siparis
CREATE TABLE urun_kategori (
    id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad   varchar(40) NOT NULL,
    sira smallint    NOT NULL DEFAULT 0,   -- menüde gösterim sırası
    CONSTRAINT uq_urun_kategori_ad UNIQUE (ad)
);

CREATE TABLE urun (
    id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kategori_id  smallint     NOT NULL REFERENCES urun_kategori(id) ON DELETE RESTRICT,
    ad           varchar(60)  NOT NULL,
    fiyat        numeric(8,2) NOT NULL,
    stok         int          NOT NULL DEFAULT 0,
    kritik_stok  int          NOT NULL DEFAULT 5,   -- bu seviyenin altı uyarı verir
    aktif        boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_urun_ad      UNIQUE (ad),
    CONSTRAINT ck_urun_fiyat   CHECK (fiyat >= 0),
    CONSTRAINT ck_urun_stok    CHECK (stok >= 0),
    CONSTRAINT ck_urun_kritik  CHECK (kritik_stok >= 0)
);

CREATE TABLE siparis (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    oturum_id   bigint       NOT NULL REFERENCES oturum(id)   ON DELETE CASCADE,
    urun_id     int          NOT NULL REFERENCES urun(id)     ON DELETE RESTRICT,
    personel_id int          NOT NULL REFERENCES personel(id) ON DELETE RESTRICT,  -- siparişi alan
    adet        int          NOT NULL,
    birim_fiyat numeric(8,2) NOT NULL,          -- sipariş anındaki fiyat
    zaman       timestamptz  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_siparis_adet  CHECK (adet > 0),
    CONSTRAINT ck_siparis_fiyat CHECK (birim_fiyat >= 0)
);
CREATE INDEX ix_siparis_oturum   ON siparis (oturum_id);
CREATE INDEX ix_siparis_personel ON siparis (personel_id);

-- ---------------------------------------------------------------- odeme
-- Hesap bölünmez: her kapanan oturumun tek ödemesi vardır.
CREATE TABLE odeme (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    oturum_id   bigint       NOT NULL REFERENCES oturum(id)   ON DELETE RESTRICT,
    personel_id int          NOT NULL REFERENCES personel(id) ON DELETE RESTRICT,  -- ödemeyi alan
    tur         varchar(5)   NOT NULL,
    tutar       numeric(10,2) NOT NULL,
    zaman       timestamptz  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_odeme_oturum UNIQUE (oturum_id),
    CONSTRAINT ck_odeme_tur    CHECK (tur IN ('NAKIT','KART')),
    CONSTRAINT ck_odeme_tutar  CHECK (tutar >= 0)
);
CREATE INDEX ix_odeme_zaman ON odeme (zaman);
