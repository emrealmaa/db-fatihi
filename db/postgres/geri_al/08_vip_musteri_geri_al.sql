-- 08_vip_musteri.sql'in geri alınışı: yalnızca o dosyanın VIP yaptığı müşterilerin üyeliği kaldırılır.
-- Bu müşterilerin açık oturumu VIP katındaysa önce o hesap kapatılmalıdır (VIP kat tetikleyicisi yeni oturum açılışını denetler).
UPDATE kullanici SET vip_mi = false, vip_baslangic = NULL
 WHERE telefon IN ('05339876543')
   AND vip_mi;
