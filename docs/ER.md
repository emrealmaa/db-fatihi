# ER diyagramı

GitHub bu diyagramı otomatik çizer (Mermaid). Sunum için görsel: GitHub'da dosyayı açıp diyagramı
dışa aktarın veya <https://mermaid.live> üzerine yapıştırın.

```mermaid
erDiagram
    AYAR {
        boolean id PK "tek satır (CHECK id)"
        numeric giris_ucreti "kişi başı"
        smallint secim_suresi_dk
        boolean kayit_zorunlu
    }
    KULLANICI {
        bigint id PK
        varchar ad
        varchar soyad
        varchar telefon UK "05XXXXXXXXX"
        varchar email UK "isteğe bağlı"
        date dogum_tarihi
        boolean ogrenci
        timestamptz uyelik_tarihi
    }
    PERSONEL {
        int id PK
        varchar ad
        varchar soyad
        varchar telefon UK
        varchar email
        varchar rol "GARSON|KASIYER|YONETICI"
        varchar kullanici_adi UK
        text parola_hash "bcrypt"
        date ise_baslama
        boolean aktif
    }
    KATEGORI {
        smallint id PK
        varchar ad UK
    }
    OYUN {
        int id PK
        varchar ad UK
        smallint kategori_id FK
        smallint min_oyuncu
        smallint max_oyuncu
        smallint sure_dk
        int toplam_adet "fiziksel kopya"
        boolean aktif
    }
    MASA {
        smallint id PK
        smallint masa_no UK
        smallint kapasite
    }
    OTURUM {
        bigint id PK
        smallint masa_id FK
        bigint kullanici_id FK "NULL: kayıtsız"
        int personel_id FK "açan"
        smallint kisi_sayisi
        numeric giris_ucreti "açılıştaki ücret"
        numeric indirim_tutari
        timestamptz acilis
        timestamptz kapanis "NULL: açık"
    }
    OTURUM_OYUN {
        bigint id PK
        bigint oturum_id FK
        int oyun_id FK
        timestamptz baslangic
        timestamptz bitis "NULL: oynanıyor"
    }
    BEKLEME {
        bigint id PK
        bigint oturum_id FK
        varchar durum "BEKLIYOR|SECIM_HAKKI|..."
        timestamptz olusturma
        timestamptz secim_hakki_zamani
    }
    URUN_KATEGORI {
        smallint id PK
        varchar ad UK
        smallint sira
    }
    URUN {
        int id PK
        smallint kategori_id FK
        varchar ad UK
        numeric fiyat
        int stok
        int kritik_stok
        boolean aktif
    }
    SIPARIS {
        bigint id PK
        bigint oturum_id FK
        int urun_id FK
        int personel_id FK "alan"
        int adet
        numeric birim_fiyat "sipariş anındaki"
        timestamptz zaman
    }
    ODEME {
        bigint id PK
        bigint oturum_id FK,UK "hesap bölünmez"
        int personel_id FK "kasiyer"
        varchar tur "NAKIT|KART"
        numeric tutar
        timestamptz zaman
    }

    KATEGORI      ||--o{ OYUN          : "sınıflar"
    MASA          ||--o{ OTURUM        : "ağırlar"
    KULLANICI     |o--o{ OTURUM        : "açtırır"
    PERSONEL      ||--o{ OTURUM        : "açar"
    OTURUM        ||--o{ OTURUM_OYUN   : "oynar"
    OYUN          ||--o{ OTURUM_OYUN   : "oynanır"
    OTURUM        ||--o{ BEKLEME       : "sıraya girer"
    URUN_KATEGORI ||--o{ URUN          : "sınıflar"
    OTURUM        ||--o{ SIPARIS       : "içerir"
    URUN          ||--o{ SIPARIS       : "sipariş edilir"
    PERSONEL      ||--o{ SIPARIS       : "alır"
    OTURUM        ||--o| ODEME         : "ödenir"
    PERSONEL      ||--o{ ODEME         : "tahsil eder"
```

## İlişkiler
| İlişki | Kardinalite | Not |
|---|---|---|
| masa – oturum | 1 : N | Aynı anda en fazla 1 açık oturum (kısmi UNIQUE `uq_oturum_masa_acik`) |
| kullanici – oturum | 0..1 : N | Kayıt zorunluysa prosedür boş geçmeye izin vermez (`ayar.kayit_zorunlu`) |
| oturum – oyun | N : M (`oturum_oyun`) | Bir oturumda aynı anda tek aktif oyun (`uq_oturum_oyun_aktif`) |
| oturum – urun | N : M (`siparis`) | Fiyat sipariş anında kopyalanır (tarihsel doğruluk) |
| oturum – bekleme | 1 : N | Kuyrukta aynı anda tek aktif kayıt; tüm sistemde tek seçim hakkı |
| oturum – odeme | 1 : 0..1 | `uq_odeme_oturum`; hesap bölünmez |
| personel – oturum/siparis/odeme | 1 : N | İşlemi yapan personel `fn_aktif_personel()` ile yazılır |
