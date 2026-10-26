-- Örnek veri

INSERT INTO kullanici (ad, soyad, email, telefon, dogum_tarihi) VALUES
 ('Ayşe','Yılmaz','ayse.yilmaz@mail.com','05321234567','1999-04-12'),
 ('Mehmet','Demir','mehmet.demir@mail.com','05339876543','1995-11-03'),
 ('Zeynep','Kaya','zeynep.kaya@mail.com','05417654321','2001-07-21'),
 ('Can','Öztürk','can.ozturk@mail.com','05551112233','1998-01-30'),
 ('Elif','Arslan','elif.arslan@mail.com','05064445566','2000-09-09'),
 ('Burak','Çelik','burak.celik@mail.com','05378889900','1997-06-17');

INSERT INTO kategori (ad) VALUES ('Strateji'),('Parti'),('Kooperatif'),('Kart'),('Aile');

INSERT INTO oyun (ad, kategori_id, min_oyuncu, max_oyuncu, sure_dk, toplam_adet, saatlik_ucret) VALUES
 ('Catan',1,3,4,90,2,20),
 ('Carcassonne',1,2,5,45,1,15),
 ('Ticket to Ride',5,2,5,60,2,15),
 ('Codenames',2,4,8,30,2,10),
 ('Dixit',2,3,6,30,1,10),
 ('Pandemic',3,2,4,60,1,20),
 ('7 Wonders',4,3,7,40,1,15),
 ('Azul',5,2,4,40,2,10),
 ('Splendor',4,2,4,30,1,10),
 ('Uno',4,2,10,20,3,0);

INSERT INTO masa (masa_no, kapasite, kisi_basi_ucret) VALUES (1,4,30),(2,4,30),(3,6,30),(4,6,30),(5,8,30);

INSERT INTO urun (ad, fiyat, stok) VALUES
 ('Türk Kahvesi',60,100),('Filtre Kahve',70,100),('Çay',25,200),('Limonata',80,60),
 ('Tost',120,40),('Cheesecake',140,20);

-- Demo senaryo: masa 1 Catan (2 kopyadan biri), masa 2 Catan (diğeri), masa 3 de Catan istiyor -> kuyruğa girer
DO $$
DECLARE o1 bigint; o2 bigint; o3 bigint;
BEGIN
    CALL sp_oturum_ac(1::smallint, 1, 4::smallint, o1);
    CALL sp_oturum_ac(2::smallint, 2, 3::smallint, o2);
    CALL sp_oturum_ac(3::smallint, 3, 4::smallint, o3);
    CALL sp_oyun_baslat(o1, 1);
    CALL sp_oyun_baslat(o2, 1);
    CALL sp_bekleme_ekle(o3);
    CALL sp_siparis_ver(o1, 1, 2);
    CALL sp_siparis_ver(o2, 3, 3);
END $$;
