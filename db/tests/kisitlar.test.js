// Kısıtlar ve tetikleyiciler
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { yeniVt, hataBekle, CHECK_IHLALI, UNIQUE_IHLALI } from './yardimci.js';

let vt;
beforeEach(async () => { vt = await yeniVt(); });
afterEach(async () => { await vt.kapat(); });

const masaAc = (masa, kisi, kullanici = 4) =>
    vt.garson('CALL sp_oturum_ac($1, $2, $3, NULL)', [masa, kisi, kullanici]).then((r) => r[0].p_oturum_id);

test('telefon formatı CHECK ile denetlenir', async () => {
    await hataBekle(vt.garson("CALL sp_musteri_kaydet('Ali', 'Veli', '5321234567', NULL, false, NULL)"),
        { kod: CHECK_IHLALI });
});

test('aynı telefonla ikinci kayıt yeni müşteri oluşturmaz, mevcut id döner', async () => {
    const [r] = await vt.garson("CALL sp_musteri_kaydet('Başka', 'Biri', '05321234567', NULL, false, NULL)");
    assert.equal(Number(r.p_kullanici_id), 1);
});

test('e-posta UNIQUE', async () => {
    await hataBekle(vt.admin("INSERT INTO kullanici (ad, soyad, telefon, email) VALUES ('X','Y','05990000000','ayse.yilmaz@mail.com')"),
        { kod: UNIQUE_IHLALI });
});

test('kişi sayısı masa kapasitesini aşamaz', async () => {
    await hataBekle(masaAc(6, 3), { kod: CHECK_IHLALI, mesaj: /kapasitesini/ });
});

test('dolu masaya ikinci oturum açılamaz', async () => {
    await hataBekle(masaAc(1, 2), { mesaj: /zaten dolu/ });
});

test('kayıt zorunluyken müşterisiz masa açılmaz; ayar kapatılınca açılır', async () => {
    await hataBekle(vt.garson('CALL sp_oturum_ac(4, 2, NULL, NULL)'), { mesaj: /müşteri kaydı gerekli/ });
    await vt.admin('UPDATE ayar SET kayit_zorunlu = false');
    const [r] = await vt.garson('CALL sp_oturum_ac(4, 2, NULL, NULL)');
    assert.ok(r.p_oturum_id);
});

test('giriş ücreti açılışta oturuma kopyalanır; sonradan değişse de hesap değişmez', async () => {
    const id = await masaAc(4, 2);
    await vt.admin('UPDATE ayar SET giris_ucreti = 999');
    const [d] = await vt.kasiyer('SELECT * FROM fn_hesap_detay($1)', [id]);
    assert.equal(Number(d.giris_toplam), 200);
});

test('ayar tablosu tek satırdır', async () => {
    await hataBekle(vt.admin('INSERT INTO ayar (id) VALUES (false)'), { kod: CHECK_IHLALI });
});

test('oyuncu sayısı oyuna uygun olmalı', async () => {
    const id = await masaAc(4, 6);
    await hataBekle(vt.garson('CALL sp_oyun_baslat($1, 6, NULL)', [id]), { kod: CHECK_IHLALI, mesaj: /oyuncu için uygun/ });
});

test('müsait kopyası kalmayan oyun başlatılamaz', async () => {
    const id = await masaAc(4, 4);
    // Root'un iki kopyası seed'de masa 1 ve 2'de
    await hataBekle(vt.garson('CALL sp_oyun_baslat($1, 1, NULL)', [id]), { kod: CHECK_IHLALI, mesaj: /müsait kopya yok/ });
});

test('pasif oyun başlatılamaz', async () => {
    await vt.admin('UPDATE oyun SET aktif = false WHERE id = 10');
    const id = await masaAc(4, 4);
    await hataBekle(vt.garson('CALL sp_oyun_baslat($1, 10, NULL)', [id]), { mesaj: /aktif değil/ });
});

test('bir masa aynı anda tek oyun oynar', async () => {
    const [m] = await vt.garson('SELECT oturum_id FROM v_masa_durumu WHERE masa_no = 1');
    await hataBekle(vt.admin('INSERT INTO oturum_oyun (oturum_id, oyun_id) VALUES ($1, 10)', [m.oturum_id]),
        { kod: UNIQUE_IHLALI });
});

test('stok yetmezse sipariş reddedilir, yeterse stoktan düşer', async () => {
    const [m] = await vt.garson('SELECT oturum_id FROM v_masa_durumu WHERE masa_no = 1');
    // Su: stok 4
    await hataBekle(vt.garson('CALL sp_siparis_ver($1, 6, 5, NULL)', [m.oturum_id]), { mesaj: /yeterli stok yok/ });
    await vt.garson('CALL sp_siparis_ver($1, 6, 4, NULL)', [m.oturum_id]);
    const [u] = await vt.garson('SELECT stok FROM v_menu WHERE urun_id = 6');
    assert.equal(u.stok, 0);
});

test('sipariş iptali stoğu geri verir', async () => {
    const [m] = await vt.garson('SELECT oturum_id FROM v_masa_durumu WHERE masa_no = 1');
    const [s] = await vt.garson('CALL sp_siparis_ver($1, 3, 10, NULL)', [m.oturum_id]);
    await vt.garson('CALL sp_siparis_iptal($1)', [s.p_siparis_id]);
    const [u] = await vt.garson('SELECT stok FROM v_menu WHERE urun_id = 3');
    assert.equal(u.stok, 197);   // seed: 200 - 3
});

test('kapanmış oturuma sipariş verilemez (prosedür ve tetikleyici)', async () => {
    const [m] = await vt.garson('SELECT oturum_id FROM v_masa_durumu WHERE masa_no = 2');
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'NAKIT', NULL)", [m.oturum_id]);
    await hataBekle(vt.garson('CALL sp_siparis_ver($1, 3, 1, NULL)', [m.oturum_id]), { mesaj: /Açık oturum bulunamadı/ });
    await hataBekle(vt.admin('INSERT INTO siparis (oturum_id, urun_id, personel_id, adet, birim_fiyat) VALUES ($1, 3, 3, 1, 25)', [m.oturum_id]),
        { kod: CHECK_IHLALI, mesaj: /kapanmış/ });
});

test('personel rolü ve kullanıcı adı CHECK ile denetlenir', async () => {
    await hataBekle(vt.yonetici("CALL sp_personel_ekle('A', 'B', '05301119999', 'BARMEN', 'barmen', 'parola12', NULL, NULL)"),
        { kod: CHECK_IHLALI });
    await hataBekle(vt.yonetici("CALL sp_personel_ekle('A', 'B', '05301119999', 'GARSON', 'A B', 'parola12', NULL, NULL)"),
        { kod: CHECK_IHLALI });
});

test('örnek veri: 50 standart oyun; popüler devler 8 kopya ve en yüksek talepte; zorluk/talep sınırları', async () => {
    const [say] = await vt.admin('SELECT count(*)::int AS n, sum(toplam_adet)::int AS kopya FROM oyun WHERE NOT vip_ozel');
    assert.equal(say.n, 50);
    const devler = await vt.admin(`SELECT ad, toplam_adet, talep FROM oyun WHERE ad IN
        ('Catan','Ticket to Ride','Carcassonne','Dixit','Uno','Codenames','Monopoly','Splendor')`);
    assert.equal(devler.length, 8);
    assert.ok(devler.every((o) => o.toplam_adet === 8 && o.talep >= 8));
    await hataBekle(vt.admin('UPDATE oyun SET zorluk = 6 WHERE id = 2'), { kod: CHECK_IHLALI });
    await hataBekle(vt.admin('UPDATE oyun SET talep = 0 WHERE id = 2'), { kod: CHECK_IHLALI });
});

test('örnek menü: kahvaltı ilk kategori; kahvaltı, ana yemek, tatlı ve içecekler menüde', async () => {
    const menu = await vt.garson('SELECT ad, kategori FROM v_menu ORDER BY kategori_sira, ad');
    assert.equal(menu[0].kategori, 'Kahvaltı');
    const adlar = new Set(menu.map((u) => u.ad));
    for (const ad of ['Serpme Kahvaltı', 'Menemen', 'Simit', 'Kumru', 'Hamburger', 'Makarna', 'Pizza Dilimi', 'Nachos',
        'Sufle', 'Tiramisu', 'Waffle', 'Latte', 'Sıcak Çikolata', 'Ice Latte', 'Smoothie']) assert.ok(adlar.has(ad), ad);
});
