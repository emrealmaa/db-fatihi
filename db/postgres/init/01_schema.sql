-- Karavana kutu oyunu cafe - şema
-- Çalıştırma sırası: 01 şema, 02 fonksiyonlar, 03 view, 04 prosedürler, 05 güvenlik, 06 seed

-- ---------------------------------------------------------------- kullanici
CREATE TABLE kullanici (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad             varchar(50)  NOT NULL,
    soyad          varchar(50)  NOT NULL,
    email          varchar(120) NOT NULL,
    telefon        varchar(11)  NOT NULL,
    dogum_tarihi   date,
    uyelik_tarihi  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_kullanici_email   UNIQUE (email),
    CONSTRAINT uq_kullanici_telefon UNIQUE (telefon),
    CONSTRAINT ck_kullanici_telefon CHECK (telefon ~ '^05[0-9]{9}$'),
    CONSTRAINT ck_kullanici_email   CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT ck_kullanici_dogum   CHECK (dogum_tarihi IS NULL OR dogum_tarihi >= DATE '1900-01-01')
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
    saatlik_ucret  numeric(8,2) NOT NULL DEFAULT 0,
    aktif          boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_oyun_ad       UNIQUE (ad),
    CONSTRAINT ck_oyun_oyuncu   CHECK (min_oyuncu > 0 AND max_oyuncu >= min_oyuncu),
    CONSTRAINT ck_oyun_sure     CHECK (sure_dk > 0),
    CONSTRAINT ck_oyun_adet     CHECK (toplam_adet >= 0),
    CONSTRAINT ck_oyun_ucret    CHECK (saatlik_ucret >= 0)
);

-- ---------------------------------------------------------------- masa
CREATE TABLE masa (
    id              smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    masa_no         smallint     NOT NULL,
    kapasite        smallint     NOT NULL,
    kisi_basi_ucret numeric(8,2) NOT NULL DEFAULT 30,   -- saatlik, kişi başı
    CONSTRAINT uq_masa_no       UNIQUE (masa_no),
    CONSTRAINT ck_masa_kapasite CHECK (kapasite BETWEEN 1 AND 12),
    CONSTRAINT ck_masa_ucret    CHECK (kisi_basi_ucret >= 0)
);

-- ---------------------------------------------------------------- oturum
-- Bir masanın açılıp kapanana kadarki oturumu (hesap birimi)
CREATE TABLE oturum (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    masa_id      smallint    NOT NULL REFERENCES masa(id)      ON DELETE RESTRICT,
    kullanici_id bigint      NOT NULL REFERENCES kullanici(id) ON DELETE RESTRICT,
    kisi_sayisi  smallint    NOT NULL,
    acilis       timestamptz NOT NULL DEFAULT clock_timestamp(),
    kapanis      timestamptz,
    CONSTRAINT ck_oturum_kisi   CHECK (kisi_sayisi > 0),
    CONSTRAINT ck_oturum_zaman  CHECK (kapanis IS NULL OR kapanis >= acilis)
);
-- Bir masada aynı anda yalnızca bir açık oturum olabilir
CREATE UNIQUE INDEX uq_oturum_masa_acik ON oturum (masa_id) WHERE kapanis IS NULL;
CREATE INDEX ix_oturum_kullanici ON oturum (kullanici_id);

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
-- Oyun bekleyen masalar. Sıra = id sırası. Oyun iade edilince sıradaki
-- masaya SECIM_HAKKI verilir, o masa müsait oyunlar arasından seçer.
CREATE TABLE bekleme (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    oturum_id          bigint      NOT NULL REFERENCES oturum(id) ON DELETE CASCADE,
    durum              varchar(12) NOT NULL DEFAULT 'BEKLIYOR',
    olusturma          timestamptz NOT NULL DEFAULT clock_timestamp(),
    secim_hakki_zamani timestamptz,
    CONSTRAINT ck_bekleme_durum CHECK (durum IN ('BEKLIYOR','SECIM_HAKKI','TAMAMLANDI','ATLANDI','IPTAL')),
    CONSTRAINT ck_bekleme_hak   CHECK (durum <> 'SECIM_HAKKI' OR secim_hakki_zamani IS NOT NULL)
);
-- Bir oturum kuyrukta tek kez bulunabilir
CREATE UNIQUE INDEX uq_bekleme_oturum_aktif ON bekleme (oturum_id) WHERE durum IN ('BEKLIYOR','SECIM_HAKKI');
CREATE INDEX ix_bekleme_sira ON bekleme (id) WHERE durum = 'BEKLIYOR';

-- ---------------------------------------------------------------- urun / siparis
CREATE TABLE urun (
    id    int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad    varchar(60)  NOT NULL,
    fiyat numeric(8,2) NOT NULL,
    stok  int          NOT NULL DEFAULT 0,
    aktif boolean      NOT NULL DEFAULT true,
    CONSTRAINT uq_urun_ad    UNIQUE (ad),
    CONSTRAINT ck_urun_fiyat CHECK (fiyat >= 0),
    CONSTRAINT ck_urun_stok  CHECK (stok >= 0)
);

CREATE TABLE siparis (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    oturum_id   bigint       NOT NULL REFERENCES oturum(id) ON DELETE CASCADE,
    urun_id     int          NOT NULL REFERENCES urun(id)   ON DELETE RESTRICT,
    adet        int          NOT NULL,
    birim_fiyat numeric(8,2) NOT NULL,          -- sipariş anındaki fiyat
    zaman       timestamptz  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_siparis_adet  CHECK (adet > 0),
    CONSTRAINT ck_siparis_fiyat CHECK (birim_fiyat >= 0)
);
CREATE INDEX ix_siparis_oturum ON siparis (oturum_id);
