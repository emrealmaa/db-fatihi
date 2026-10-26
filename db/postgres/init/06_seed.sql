-- Örnek veri — GEÇİCİ. Karavana'nın gerçek masa/oyun/menü/personel verileri gelince bu dosya değişecek.
-- Personel parolaları yalnızca geliştirme içindir.

INSERT INTO ayar (giris_ucreti, secim_suresi_dk, kayit_zorunlu) VALUES (100, 5, true);

CALL sp_personel_ekle('Deniz', 'Aydın', '05301110001', 'YONETICI', 'yonetici', 'karavana123', 'deniz@karavana.cafe');
CALL sp_personel_ekle('Ali',   'Koç',   '05301110002', 'KASIYER',  'kasiyer',  'karavana123');
CALL sp_personel_ekle('Selin', 'Er',    '05301110003', 'GARSON',   'garson',   'karavana123');
CALL sp_personel_ekle('Mert',  'Tan',   '05301110004', 'GARSON',   'garson2',  'karavana123');

INSERT INTO kullanici (ad, soyad, email, telefon, dogum_tarihi, ogrenci) VALUES
 ('Ayşe','Yılmaz','ayse.yilmaz@mail.com','05321234567','1999-04-12', false),
 ('Mehmet','Demir','mehmet.demir@mail.com','05339876543','1995-11-03', false),
 ('Zeynep','Kaya','zeynep.kaya@mail.com','05417654321','2004-07-21', true),
 ('Can','Öztürk',NULL,'05551112233','1998-01-30', false),
 ('Elif','Arslan','elif.arslan@mail.com','05064445566','2003-09-09', true),
 ('Burak','Çelik','burak.celik@mail.com','05378889900','1997-06-17', false);

INSERT INTO kategori (ad) VALUES ('Strateji'),('Parti'),('Kooperatif'),('Kart'),('Aile');

INSERT INTO oyun (ad, kategori_id, min_oyuncu, max_oyuncu, sure_dk, toplam_adet) VALUES
 ('Catan',1,3,4,90,2),
 ('Carcassonne',1,2,5,45,1),
 ('Ticket to Ride',5,2,5,60,2),
 ('Codenames',2,4,8,30,2),
 ('Dixit',2,3,6,30,1),
 ('Pandemic',3,2,4,60,1),
 ('7 Wonders',4,3,7,40,1),
 ('Azul',5,2,4,40,2),
 ('Splendor',4,2,4,30,1),
 ('Uno',4,2,10,20,3);

-- Kat 1: giriş & espresso bar (küçük masalar) · Kat 2: strateji salonu · Kat 3: VIP / FRP
INSERT INTO masa (masa_no, kapasite, kat) VALUES
 (1,4,1),(2,4,1),(3,6,2),(4,6,2),(5,8,3),(6,2,1),(7,2,1),(8,4,2),(9,4,2),(10,10,3);

INSERT INTO urun_kategori (ad, sira) VALUES
 ('Sıcak İçecekler',1),('Soğuk İçecekler',2),('Yiyecekler',3),('Tatlılar',4);

INSERT INTO urun (kategori_id, ad, fiyat, stok, kritik_stok) VALUES
 (1,'Türk Kahvesi',60,100,10),(1,'Filtre Kahve',70,100,10),(1,'Çay',25,200,20),
 (2,'Limonata',80,60,10),(2,'Ayran',35,40,10),(2,'Su',15,4,10),
 (3,'Tost',120,40,5),(3,'Patates Kızartması',110,30,5),
 (4,'Cheesecake',140,20,5),(4,'Brownie',120,3,5);

-- Demo senaryo: masa 1 ve 2 Catan'ın iki kopyasını oynuyor, masa 3 de Catan istiyor -> Catan sırasına girer.
-- Masa 3 açılırken müşteri yeni kaydediliyor (masada hızlı kayıt akışı).
DO $$
DECLARE o1 bigint; o2 bigint; o3 bigint; yeni bigint; oo bigint; b bigint; s bigint;
BEGIN
    PERFORM set_config('app.personel_id', (SELECT id FROM personel WHERE kullanici_adi = 'garson')::text, true);
    CALL sp_oturum_ac(1, 4, 1, o1);
    CALL sp_oturum_ac(2, 3, 2, o2);
    CALL sp_musteri_kaydet('Kerem', 'Şahin', '05442223344', NULL, true, yeni);
    CALL sp_oturum_ac(3, 4, yeni, o3);
    CALL sp_oyun_baslat(o1, 1, oo);
    CALL sp_oyun_baslat(o2, 1, oo);
    CALL sp_bekleme_ekle(o3, 1, b);   -- Catan sırası
    CALL sp_siparis_ver(o1, 1, 2, s);
    CALL sp_siparis_ver(o1, 7, 1, s);
    CALL sp_siparis_ver(o2, 3, 3, s);
END $$;
