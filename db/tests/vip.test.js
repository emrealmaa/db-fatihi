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
