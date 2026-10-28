// VIP Kulüp kuralları (07_vip_kulup.sql, 08_vip_musteri.sql)
// Seed: müşteri 2 (Mehmet Demir) 08 ile VIP; diğerleri standart. Kat 3 masaları: 5, 10, 23, 24, 25 (5 boş).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { yeniVt, hataBekle, CHECK_IHLALI, YETKI_YOK } from './yardimci.js';

let vt;
beforeEach(async () => { vt = await yeniVt(); });
afterEach(async () => { await vt.kapat(); });

const VIP = 2, STANDART = 4;
const masaId = async (no) => (await vt.admin('SELECT id FROM masa WHERE masa_no = $1', [no]))[0].id;
const masaAc = async (no, kisi, kullanici) =>
    (await vt.garson('CALL sp_oturum_ac($1, $2, $3, NULL)', [await masaId(no), kisi, kullanici]))[0].p_oturum_id;
const vipOyun = async (ad = 'Spirit Island') => (await vt.admin('SELECT id FROM oyun WHERE ad = $1', [ad]))[0].id;

test('10 VIP oyun eklendi, eski oyunların hepsi standart kaldı', async () => {
    const [s] = await vt.admin(`SELECT count(*) FILTER (WHERE vip_ozel)::int AS vip,
                                       count(*) FILTER (WHERE NOT vip_ozel)::int AS standart,
                                       count(*) FILTER (WHERE vip_ozel AND (zorluk <> 5 OR toplam_adet <> 1))::int AS hatali
                                FROM oyun`);
    assert.deepEqual({ ...s }, { vip: 10, standart: 50, hatali: 0 });
    const kat = await vt.admin(`SELECT DISTINCT k.ad FROM oyun o JOIN kategori k ON k.id = o.kategori_id WHERE o.vip_ozel`);
    assert.deepEqual(kat.map((x) => x.ad), ['Ağır strateji']);
});

test('VIP müşteri verisi: yalnızca 08 migration\'ının seçtiği müşteri VIP', async () => {
    const vipler = await vt.admin('SELECT id, vip_baslangic FROM kullanici WHERE vip_mi ORDER BY id');
    assert.deepEqual(vipler.map((x) => Number(x.id)), [VIP]);
    assert.ok(vipler[0].vip_baslangic);
    await hataBekle(vt.admin('UPDATE kullanici SET vip_mi = false WHERE id = $1', [VIP]), { kod: CHECK_IHLALI });
});

test('VIP oyun: standart müşterinin masasına verilemez (VIP_OYUN_YETKISIZ), VIP müşteriye verilir', async () => {
    const oyun = await vipOyun();
    const standart = await masaAc(8, 4, STANDART);
    await hataBekle(vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [standart, oyun]), { kod: CHECK_IHLALI, mesaj: /VIP_OYUN_YETKISIZ/ });
    // tetikleyici prosedürü atlayan doğrudan INSERT'i de durdurur
    await hataBekle(vt.admin('INSERT INTO oturum_oyun (oturum_id, oyun_id) VALUES ($1, $2)', [standart, oyun]), { mesaj: /VIP_OYUN_YETKISIZ/ });

    const vip = await masaAc(5, 4, VIP);
    const [r] = await vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [vip, oyun]);
    assert.ok(r.p_oturum_oyun_id);
});

test('VIP oyun sırası: standart müşteri VIP oyunun sırasına da giremez', async () => {
    const oyun = await vipOyun('Twilight Struggle');
    const vip = await masaAc(25, 2, VIP);
    await vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [vip, oyun]);   // tek kopya masada
    const standart = await masaAc(8, 2, STANDART);
    await hataBekle(vt.garson('CALL sp_bekleme_ekle($1, $2, NULL)', [standart, oyun]), { mesaj: /VIP_OYUN_YETKISIZ/ });
});

test('kayıtsız (müşterisiz) oturum VIP sayılmaz', async () => {
    await vt.admin('UPDATE ayar SET kayit_zorunlu = false');
    const [r] = await vt.garson('CALL sp_oturum_ac($1, 2, NULL, NULL)', [await masaId(8)]);
    await hataBekle(vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [r.p_oturum_id, await vipOyun()]), { mesaj: /VIP_OYUN_YETKISIZ/ });
});

test('VIP kat: kat 3 masasına standart müşteri oturamaz, VIP oturur', async () => {
    await hataBekle(masaAc(5, 4, STANDART), { kod: CHECK_IHLALI, mesaj: /VIP_KAT_YETKISIZ/ });
    await vt.admin('UPDATE ayar SET kayit_zorunlu = false');
    await hataBekle(vt.garson('CALL sp_oturum_ac($1, 2, NULL, NULL)', [await masaId(5)]), { mesaj: /VIP_KAT_YETKISIZ/ });
    assert.ok(await masaAc(5, 4, VIP));
});

test('VIP kat: açık oturum UPDATE ile kat 3 masasına taşınamaz', async () => {
    const id = await masaAc(8, 2, STANDART);
    await hataBekle(vt.admin('UPDATE oturum SET masa_id = $1 WHERE id = $2', [await masaId(5), id]), { mesaj: /VIP_KAT_YETKISIZ/ });
});

test('standart oyunlar ve alt katlar VIP müşteriye de açık', async () => {
    const id = await masaAc(8, 4, VIP);
    const [r] = await vt.garson('CALL sp_oyun_baslat($1, 6, NULL)', [id]);
    assert.ok(r.p_oturum_oyun_id);
});

test('sp_musteri_vip: yalnızca yönetici; üyelik verilir ve geri alınır', async () => {
    await hataBekle(vt.garson('CALL sp_musteri_vip($1, true)', [STANDART]), { kod: YETKI_YOK });
    await vt.yonetici('CALL sp_musteri_vip($1, true)', [STANDART]);
    let [k] = await vt.admin('SELECT vip_mi, vip_baslangic FROM kullanici WHERE id = $1', [STANDART]);
    assert.equal(k.vip_mi, true);
    assert.ok(k.vip_baslangic);
    // üyelik işaretlendi ama haftalık ücret ödenmedi: kata hâlâ giremez (09_vip_haftalik.sql)
    await hataBekle(masaAc(5, 4, STANDART), { mesaj: /VIP_KAT_YETKISIZ/ });
    await vt.kasiyer("CALL sp_vip_uyelik_ode($1, 'nakit', NULL, NULL, NULL)", [STANDART]);
    assert.ok(await masaAc(5, 4, STANDART));
    await vt.yonetici('CALL sp_musteri_vip($1, false)', [STANDART]);
    [k] = await vt.admin('SELECT vip_mi, vip_baslangic FROM kullanici WHERE id = $1', [STANDART]);
    assert.deepEqual({ ...k }, { vip_mi: false, vip_baslangic: null });
    await hataBekle(vt.yonetici('CALL sp_musteri_vip(999999, true)'), { mesaj: /bulunamadı/ });
});

test('view\'lar: masa durumu VIP masayı, oyun listesi VIP oyunu, maskeli müşteri VIP bilgisini gösterir', async () => {
    const masalar = await vt.garson('SELECT masa_no, kat, vip_masa FROM v_masa_durumu');
    assert.ok(masalar.every((m) => m.vip_masa === (m.kat === 3)));
    const [o] = await vt.garson("SELECT vip_ozel FROM v_musait_oyunlar WHERE ad = 'Twilight Imperium (4. baskı)'");
    assert.equal(o.vip_ozel, true);
    const [m] = await vt.garson('SELECT vip_mi FROM v_musteri_maskeli WHERE id = $1', [VIP]);
    assert.equal(m.vip_mi, true);
});

test('v_vip_oyun_kullanimi ve v_kat_gelir raporları', async () => {
    const oyun = await vipOyun();
    const id = await masaAc(5, 4, VIP);
    const [oo] = await vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [id, oyun]);
    const hamburger = (await vt.admin("SELECT id FROM urun WHERE ad = 'Hamburger'"))[0].id;
    await vt.garson('CALL sp_siparis_ver($1, $2, 2, NULL)', [id, hamburger]);
    await vt.garson('CALL sp_oyun_bitir($1)', [oo.p_oturum_oyun_id]);
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'kart', NULL)", [id]);

    const kullanim = await vt.yonetici('SELECT * FROM v_vip_oyun_kullanimi');
    assert.equal(kullanim.length, 10);
    const s = kullanim.find((x) => x.oyun_id === oyun);
    assert.equal(Number(s.oturum_sayisi), 1);
    assert.equal(Number(s.oynayan_vip), 1);

    const [kat3] = await vt.yonetici('SELECT * FROM v_kat_gelir WHERE kat = 3');
    const [u] = await vt.admin("SELECT fiyat FROM urun WHERE ad = 'Hamburger'");
    assert.equal(Number(kat3.vip_hesap), 1);
    assert.equal(Number(kat3.yemek_geliri), 2 * Number(u.fiyat));
    assert.equal(Number(kat3.ciro), Number(kat3.vip_ciro));
    await hataBekle(vt.garson('SELECT * FROM v_kat_gelir'), { kod: YETKI_YOK });
});

// ---------------------------------------------------------------- haftalık üyelik ücreti (09_vip_haftalik.sql)
const ode = (id, tur = 'kart') => vt.kasiyer('CALL sp_vip_uyelik_ode($1, $2, NULL, NULL, NULL)', [id, tur]);

test('haftalık VIP ücreti 10.000 TL: ödeme 7 günlük dönem açar, müşteriyi VIP yapar', async () => {
    const [a] = await vt.admin('SELECT vip_haftalik_ucret FROM ayar');
    assert.equal(Number(a.vip_haftalik_ucret), 10000);
    await ode(STANDART, 'nakit');
    const [o] = await vt.admin(`SELECT tutar, tur, bitis - baslangic AS gun, baslangic = current_date AS bugun
                                FROM vip_odeme WHERE kullanici_id = $1`, [STANDART]);
    assert.deepEqual({ tutar: Number(o.tutar), tur: o.tur, gun: Number(o.gun), bugun: o.bugun },
                     { tutar: 10000, tur: 'NAKIT', gun: 6, bugun: true });
    const [k] = await vt.admin('SELECT vip_mi, fn_vip_aktif(id) AS aktif FROM kullanici WHERE id = $1', [STANDART]);
    assert.deepEqual({ ...k }, { vip_mi: true, aktif: true });
});

test('öğrenci de aynı ücreti öder: üyelik ücretinde öğrenci indirimi yok', async () => {
    const [ogr] = await vt.admin('SELECT id FROM kullanici WHERE ogrenci AND NOT vip_mi ORDER BY id LIMIT 1');
    await ode(ogr.id);
    const [o] = await vt.admin('SELECT tutar FROM vip_odeme WHERE kullanici_id = $1', [ogr.id]);
    assert.equal(Number(o.tutar), 10000);
});

test('ücret ayardan okunur; yönetici değiştirirse yeni ödemeler yeni ücretten alınır', async () => {
    await vt.admin('UPDATE ayar SET vip_haftalik_ucret = 12500');
    await ode(STANDART);
    const [o] = await vt.admin('SELECT tutar FROM vip_odeme WHERE kullanici_id = $1', [STANDART]);
    assert.equal(Number(o.tutar), 12500);
});

test('ödenmiş üyelik: masa (giriş) ücreti alınmaz, öğrenci indirimi uygulanmaz', async () => {
    await vt.admin('UPDATE ayar SET giris_ucreti = 100');
    await ode(STANDART);
    const id = (await vt.garson('CALL sp_oturum_ac($1, 4, $2, NULL, 2)', [await masaId(5), STANDART]))[0].p_oturum_id;
    const [t] = await vt.admin('SELECT giris_ucreti, ogrenci_sayisi, vip_uyelik FROM oturum WHERE id = $1', [id]);
    assert.deepEqual({ ucret: Number(t.giris_ucreti), ogr: t.ogrenci_sayisi, vip: t.vip_uyelik }, { ucret: 0, ogr: 0, vip: true });
    const [h] = await vt.kasiyer('SELECT * FROM fn_hesap_detay($1)', [id]);
    assert.equal(Number(h.giris_toplam), 0);
    assert.equal(Number(h.ogrenci_indirimi), 0);
    assert.equal(Number(h.toplam), 0);
    // yemek yine ödenir
    const hamburger = (await vt.admin("SELECT id, fiyat FROM urun WHERE ad = 'Hamburger'"))[0];
    await vt.garson('CALL sp_siparis_ver($1, $2, 1, NULL)', [id, hamburger.id]);
    assert.equal(Number((await vt.kasiyer('SELECT fn_hesap_hesapla($1) AS t', [id]))[0].t), Number(hamburger.fiyat));
});

test('standart müşteri giriş ücretini öder, öğrenci indirimi normal çalışır', async () => {
    await vt.admin('UPDATE ayar SET giris_ucreti = 100');
    const id = (await vt.garson('CALL sp_oturum_ac($1, 4, $2, NULL, 2)', [await masaId(8), STANDART]))[0].p_oturum_id;
    const [h] = await vt.kasiyer('SELECT * FROM fn_hesap_detay($1)', [id]);
    assert.equal(Number(h.giris_toplam), 400);
    assert.equal(Number(h.ogrenci_indirimi), 100);   // 2 öğrenci × 100 × %50
});

test('süresi dolan üyelik: VIP kat ve VIP oyun kapanır, masa ücreti yeniden alınır', async () => {
    await vt.admin('UPDATE ayar SET giris_ucreti = 100');
    await ode(STANDART);
    await vt.admin(`UPDATE vip_odeme SET baslangic = current_date - 14, bitis = current_date - 8 WHERE kullanici_id = $1`, [STANDART]);
    const [k] = await vt.admin('SELECT fn_vip_aktif(id) AS aktif FROM kullanici WHERE id = $1', [STANDART]);
    assert.equal(k.aktif, false);
    await hataBekle(masaAc(5, 2, STANDART), { mesaj: /VIP_KAT_YETKISIZ/ });
    const id = await masaAc(8, 2, STANDART);
    const [t] = await vt.admin('SELECT giris_ucreti, vip_uyelik FROM oturum WHERE id = $1', [id]);
    assert.deepEqual({ ucret: Number(t.giris_ucreti), vip: t.vip_uyelik }, { ucret: 100, vip: false });
    await hataBekle(vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [id, await vipOyun()]), { mesaj: /VIP_OYUN_YETKISIZ/ });
});

test('erken yenileme gün kaybettirmez: yeni hafta mevcut bitişten sonra başlar', async () => {
    await ode(STANDART);
    await ode(STANDART);
    const d = await vt.admin(`SELECT baslangic - lag(bitis) OVER (ORDER BY baslangic) AS bosluk
                              FROM vip_odeme WHERE kullanici_id = $1 ORDER BY baslangic`, [STANDART]);
    assert.equal(d.length, 2);
    assert.equal(Number(d[1].bosluk), 1);
    await hataBekle(vt.admin(`INSERT INTO vip_odeme (kullanici_id, personel_id, baslangic, bitis, tutar, tur)
                              VALUES ($1, 1, current_date, current_date + 3, 10000, 'KART')`, [STANDART]), { kod: CHECK_IHLALI });
});

test('sp_vip_uyelik_ode: garson yapamaz, geçersiz tür ve olmayan müşteri reddedilir', async () => {
    await hataBekle(vt.garson("CALL sp_vip_uyelik_ode($1, 'kart', NULL, NULL, NULL)", [STANDART]), { kod: YETKI_YOK });
    await hataBekle(ode(STANDART, 'cek'), { kod: CHECK_IHLALI });
    await hataBekle(vt.kasiyer("CALL sp_vip_uyelik_ode(999999, 'kart', NULL, NULL, NULL)"), { mesaj: /bulunamadı/ });
});

test('müşteri segmentleri: VIP / OGRENCI / NORMAL ve üyelik geliri (yalnızca yönetici)', async () => {
    await ode(STANDART);
    const liste = await vt.yonetici('SELECT * FROM v_musteri_segment ORDER BY id');
    const seg = (id) => liste.find((m) => Number(m.id) === id);
    assert.equal(seg(VIP).segment, 'VIP');
    assert.equal(seg(VIP).vip_aktif, true);
    assert.equal(seg(STANDART).segment, 'VIP');
    assert.equal(Number(seg(STANDART).vip_odeme_sayisi), 1);
    assert.ok(liste.some((m) => m.segment === 'OGRENCI'));
    assert.ok(liste.some((m) => m.segment === 'NORMAL'));
    assert.match(seg(STANDART).telefon, /\*/);   // maskeli
    const [g] = await vt.yonetici('SELECT sum(gelir) AS gelir FROM v_vip_uyelik_gelir');
    assert.equal(Number(g.gelir), 10000);          // Mehmet'in GECIS haftası ciroya girmez
    await hataBekle(vt.garson('SELECT * FROM v_musteri_segment'), { kod: YETKI_YOK });
    await hataBekle(vt.kasiyer('SELECT * FROM v_vip_uyelik_gelir'), { kod: YETKI_YOK });
});
