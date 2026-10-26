-- Örnek veri — GEÇİCİ. Karavana'nın gerçek masa/oyun/menü/personel verileri gelince bu dosya değişecek.
-- Personel parolaları yalnızca geliştirme içindir.

INSERT INTO ayar (giris_ucreti, secim_suresi_dk, kayit_zorunlu, ogrenci_indirim_orani) VALUES (100, 5, true, 0.50);

CALL sp_personel_ekle('Deniz', 'Aydın', '05301110001', 'YONETICI', 'yonetici', 'karavana123', 'deniz@karavana.cafe');
CALL sp_personel_ekle('Ali',   'Koç',   '05301110002', 'KASIYER',  'kasiyer',  'karavana123');
CALL sp_personel_ekle('Selin', 'Er',    '05301110003', 'GARSON',   'garson',   'karavana123');
CALL sp_personel_ekle('Mert',  'Tan',   '05301110004', 'GARSON',   'garson2',  'karavana123');
CALL sp_personel_ekle('Ece',   'Yurt',  '05301110005', 'GARSON',   'garson3',  'karavana123');
CALL sp_personel_ekle('Baran', 'Ok',    '05301110006', 'GARSON',   'garson4',  'karavana123');
CALL sp_personel_ekle('Defne', 'Su',    '05301110007', 'GARSON',   'garson5',  'karavana123');
CALL sp_personel_ekle('Kaan',  'Ateş',  '05301110008', 'GARSON',   'garson6',  'karavana123');

INSERT INTO kullanici (ad, soyad, email, telefon, dogum_tarihi, ogrenci) VALUES
 ('Ayşe','Yılmaz','ayse.yilmaz@mail.com','05321234567','1999-04-12', false),
 ('Mehmet','Demir','mehmet.demir@mail.com','05339876543','1995-11-03', false),
 ('Zeynep','Kaya','zeynep.kaya@mail.com','05417654321','2004-07-21', true),
 ('Can','Öztürk',NULL,'05551112233','1998-01-30', false),
 ('Elif','Arslan','elif.arslan@mail.com','05064445566','2003-09-09', true),
 ('Burak','Çelik','burak.celik@mail.com','05378889900','1997-06-17', false);

INSERT INTO kategori (ad) VALUES ('Strateji'),('Parti'),('Kooperatif'),('Kart'),('Aile'),('Geleneksel'),('Soyut'),('Zar');

-- 50 oyun: Türkiye'de kafelerde en çok oynananlar + BGG'de en çok oynanan/istenenler.
-- Popüler devler (talep 8–10) 8 kopya; orta seviye 2–4; ağır/niş strateji 1–2 kopya.
-- id 1 (Root, 2 kopya) örnek senaryodaki bekleme sırası için; testler 1, 6, 8, 9, 10 id'lerine dayanır.
INSERT INTO oyun (ad, kategori_id, min_oyuncu, max_oyuncu, sure_dk, toplam_adet, zorluk, talep) VALUES
 ('Root',1,2,4,90,2,4,4),
 ('Carcassonne',5,2,5,45,8,2,9),
 ('Ticket to Ride',5,2,5,60,8,2,10),
 ('Codenames',2,4,8,20,8,1,9),
 ('Dixit',2,3,6,30,8,1,9),
 ('Pandemic',3,2,4,45,4,3,7),
 ('7 Wonders',4,3,7,35,4,3,7),
 ('Azul',7,2,4,40,4,2,7),
 ('Splendor',4,2,4,30,8,2,8),
 ('Uno',4,2,10,20,8,1,9),
 ('Catan',1,3,4,75,8,3,10),
 ('Monopoly',5,2,8,120,8,1,8),
 ('Okey',6,4,4,45,6,2,9),
 ('Tavla',6,2,2,30,6,2,8),
 ('Rummikub',6,2,4,45,4,2,7),
 ('Mangala',6,2,2,20,3,1,5),
 ('Satranç',7,2,2,45,4,4,5),
 ('Tabu',2,4,10,30,4,1,8),
 ('Jenga',2,2,8,15,4,1,7),
 ('Risk',1,2,6,120,3,3,6),
 ('Scrabble',5,2,4,60,3,2,6),
 ('Exploding Kittens',4,2,5,15,4,1,8),
 ('Kingdomino',5,2,4,20,3,1,6),
 ('King of Tokyo',8,2,6,30,3,2,7),
 ('Sushi Go!',4,2,5,15,3,1,6),
 ('Love Letter',4,2,6,20,3,1,6),
 ('The Mind',3,2,4,20,3,1,6),
 ('Coup',2,2,6,15,3,2,6),
 ('Avalon',2,5,10,30,3,2,7),
 ('Vampir Köylü',2,6,18,30,3,1,8),
 ('Bang!',4,4,7,40,2,2,5),
 ('Hanabi',3,2,5,25,2,2,5),
 ('Patchwork',7,2,2,30,2,2,5),
 ('Jaipur',4,2,2,30,2,2,5),
 ('Terraforming Mars',1,1,5,120,3,4,7),
 ('Scythe',1,1,5,115,2,4,6),
 ('Wingspan',1,1,5,70,3,3,7),
 ('Gloomhaven',3,1,4,120,1,5,4),
 ('Brass: Birmingham',1,2,4,120,1,5,4),
 ('Everdell',1,1,4,80,2,3,5),
 ('Cascadia',5,1,4,45,2,2,6),
 ('Concordia',1,2,5,100,1,3,4),
 ('Agricola',1,1,4,120,1,4,4),
 ('Puerto Rico',1,3,5,90,1,4,4),
 ('Dominion',4,2,4,30,2,2,5),
 ('Small World',1,2,5,80,2,2,6),
 ('Takenoko',5,2,4,45,2,2,5),
 ('İstanbul',1,2,5,60,2,3,6),
 ('Quacks of Quedlinburg',5,2,4,45,2,2,5),
 ('Dune: Imperium',1,1,4,120,1,4,5);

-- Kat 1: giriş & espresso bar (10 masa: bar/mutfak yakını 2'lik, iç kısım 4'lük) · Kat 2: strateji salonu (10 masa) · Kat 3: VIP / FRP (4 büyük masa)
INSERT INTO masa (masa_no, kapasite, kat) VALUES
 (1,4,1),(2,4,1),(3,6,2),(4,6,2),(5,6,3),(6,2,1),(7,2,1),(8,4,2),(9,4,2),(10,8,3),
 (11,2,1),(12,2,1),(13,4,1),(14,4,1),(15,2,1),(16,4,1),
 (17,4,2),(18,6,2),(19,4,2),(20,6,2),(21,4,2),(22,6,2),
 (23,8,3),(24,6,3);

INSERT INTO urun_kategori (ad, sira) VALUES
 ('Sıcak İçecekler',1),('Soğuk İçecekler',2),('Yiyecekler',3),('Tatlılar',4);

INSERT INTO urun (kategori_id, ad, fiyat, stok, kritik_stok) VALUES
 (1,'Türk Kahvesi',60,100,10),(1,'Filtre Kahve',70,100,10),(1,'Çay',25,200,20),
 (2,'Limonata',80,60,10),(2,'Ayran',35,40,10),(2,'Su',15,4,10),
 (3,'Tost',120,40,5),(3,'Patates Kızartması',110,30,5),
 (4,'Cheesecake',140,20,5),(4,'Brownie',120,3,5);

-- Demo senaryo: masa 1 ve 2 Root'un iki kopyasını oynuyor, masa 3 de Root istiyor -> Root sırasına girer.
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
    CALL sp_bekleme_ekle(o3, 1, b);   -- Root sırası
    CALL sp_siparis_ver(o1, 1, 2, s);
    CALL sp_siparis_ver(o1, 7, 1, s);
    CALL sp_siparis_ver(o2, 3, 3, s);
END $$;
