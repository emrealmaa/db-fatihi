-- Mevcut müşteri havuzundan küçük bir kısmını (~%14) VIP yapan, GERİ ALINABİLİR veri migration'ı.
-- Yalnızca aşağıdaki telefonlara dokunur ve yalnızca hâlâ VIP olmayanları değiştirir (tekrar çalıştırılabilir).
-- Geri almak için: db/postgres/geri_al/08_vip_musteri_geri_al.sql
-- Simülasyonun ürettiği yeni müşterilerin VIP oranı motor.js'teki VIP_GRUP_ORANI sabitindedir.
UPDATE kullanici SET vip_mi = true, vip_baslangic = current_date
 WHERE telefon IN ('05339876543')          -- Mehmet Demir (örnek veri, 7 müşteriden 1'i)
   AND NOT vip_mi;
