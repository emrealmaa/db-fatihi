// Hesap, ödeme ve raporlar
// Seed: masa 1 = 4 kişi, giriş 100 TL; siparişler 2 Türk Kahvesi (60) + 1 Tost (120) = 240 TL
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { yeniVt, hataBekle, P } from './yardimci.js';

let vt;
beforeEach(async () => { vt = await yeniVt(); });
afterEach(async () => { await vt.kapat(); });

const oturum = async (no) => (await vt.garson('SELECT oturum_id FROM v_masa_durumu WHERE masa_no = $1', [no]))[0].oturum_id;

test('hesap = kişi sayısı × giriş ücreti + siparişler', async () => {
    const [d] = await vt.kasiyer('SELECT * FROM fn_hesap_detay($1)', [await oturum(1)]);
    assert.equal(Number(d.giris_toplam), 400);
    assert.equal(Number(d.siparis_toplam), 240);
    assert.equal(Number(d.toplam), 640);
});

test('indirim toplamdan düşülür, toplamı aşamaz', async () => {
    const id = await oturum(1);
    await vt.admin('UPDATE oturum SET indirim_tutari = 50 WHERE id = $1', [id]);
    assert.equal(Number((await vt.kasiyer('SELECT fn_hesap_hesapla($1) AS t', [id]))[0].t), 590);
    await vt.admin('UPDATE oturum SET indirim_tutari = 5000 WHERE id = $1', [id]);
    assert.equal(Number((await vt.kasiyer('SELECT fn_hesap_hesapla($1) AS t', [id]))[0].t), 0);
});

test('hesap kapatılınca ödeme kaydı oluşur, masa boşalır, ciroya yansır', async () => {
    const id = await oturum(1);
    const [r] = await vt.kasiyer("CALL sp_oturum_kapat($1, 'kart', NULL)", [id]);
    assert.equal(Number(r.p_toplam), 640);

    const [o] = await vt.admin('SELECT * FROM odeme WHERE oturum_id = $1', [id]);
    assert.equal(o.tur, 'KART');
    assert.equal(Number(o.tutar), 640);
    assert.equal(o.personel_id, P.kasiyer);

    assert.equal((await vt.garson('SELECT durum FROM v_masa_durumu WHERE masa_no = 1'))[0].durum, 'BOS');
    const [c] = await vt.kasiyer('SELECT * FROM v_gunluk_ciro');
    assert.equal(Number(c.kart), 640);
    assert.equal(c.nakit, null);
});

test('aynı hesap iki kez kapatılamaz', async () => {
    const id = await oturum(1);
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'NAKIT', NULL)", [id]);
    await hataBekle(vt.kasiyer("CALL sp_oturum_kapat($1, 'NAKIT', NULL)", [id]), { mesaj: /Açık oturum bulunamadı/ });
});

test('ödeme türü yalnızca NAKIT veya KART', async () => {
    await hataBekle(vt.kasiyer("CALL sp_oturum_kapat($1, 'CEK', NULL)", [await oturum(1)]), { mesaj: /NAKIT veya KART/ });
});

test('açık hesaplar listesi anlık tutarları gösterir', async () => {
    const h = await vt.kasiyer('SELECT * FROM v_acik_hesaplar ORDER BY masa_no');
    assert.deepEqual(h.map((r) => [r.masa_no, Number(r.toplam)]), [[1, 640], [2, 375], [3, 400]]);
});

test('personel performansı sipariş ve tahsilatı kişiye yazar', async () => {
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'NAKIT', NULL)", [await oturum(2)]);
    const rapor = await vt.yonetici('SELECT * FROM v_personel_performans ORDER BY personel_id');
    const garson = rapor.find((r) => r.personel_id === P.garson);
    const kasiyer = rapor.find((r) => r.personel_id === P.kasiyer);
    assert.equal(Number(garson.acilan_masa), 3);
    assert.equal(Number(garson.siparis_sayisi), 3);
    assert.equal(Number(kasiyer.tahsilat), 375);
});

test('kritik stok ve ürün satış raporları', async () => {
    const kritik = await vt.yonetici('SELECT ad FROM v_kritik_stok ORDER BY ad');
    assert.deepEqual(kritik.map((r) => r.ad), ['Brownie', 'Su']);
    await vt.yonetici('CALL sp_stok_ekle(6, 20)');
    assert.equal((await vt.yonetici('SELECT count(*)::int AS n FROM v_kritik_stok'))[0].n, 1);

    const [kahve] = await vt.yonetici("SELECT * FROM v_urun_satis WHERE ad = 'Türk Kahvesi'");
    assert.equal(Number(kahve.satilan_adet), 2);
    assert.equal(Number(kahve.gelir), 120);
});

test('öğrenci indirimi: öğrenci başına giriş ücretinin ayardaki oranı (%50) düşülür', async () => {
    const [r] = await vt.garson('CALL sp_oturum_ac($1, $2, $3, NULL, $4)', [4, 4, 4, 2]);
    const [d] = await vt.kasiyer('SELECT * FROM fn_hesap_detay($1)', [r.p_oturum_id]);
    assert.equal(Number(d.giris_toplam), 400);
    assert.equal(Number(d.ogrenci_indirimi), 100);
    assert.equal(Number(d.toplam), 300);
    const [h] = await vt.kasiyer('SELECT ogrenci_sayisi, ogrenci_indirimi FROM v_acik_hesaplar WHERE oturum_id = $1', [r.p_oturum_id]);
    assert.equal(h.ogrenci_sayisi, 2);
});

test('öğrenci oranı açılışta oturuma kopyalanır; öğrenci sayısı kişi sayısını aşamaz', async () => {
    const [r] = await vt.garson('CALL sp_oturum_ac($1, $2, $3, NULL, $4)', [4, 2, 4, 2]);
    await vt.admin('UPDATE ayar SET ogrenci_indirim_orani = 0');
    assert.equal(Number((await vt.kasiyer('SELECT fn_hesap_hesapla($1) AS t', [r.p_oturum_id]))[0].t), 100);
    await hataBekle(vt.garson('CALL sp_oturum_ac($1, $2, $3, NULL, $4)', [5, 2, 4, 3]), { kod: '23514' });
    await hataBekle(vt.admin('UPDATE ayar SET ogrenci_indirim_orani = 1.5'), { kod: '23514' });
});

test('dönem özeti: normal/öğrenci giriş, sipariş, ciro ve ödeme türü kırılımı', async () => {
    const bas = (await vt.admin('SELECT clock_timestamp() AS t'))[0].t;
    const [r] = await vt.garson('CALL sp_oturum_ac($1, $2, $3, NULL, $4)', [4, 3, 4, 1]);
    await vt.garson('CALL sp_siparis_ver($1, 3, 2, NULL)', [r.p_oturum_id]);           // 2 × çay = 50
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'KART', NULL)", [r.p_oturum_id]);       // 200 + 50 + 50 = 300
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'NAKIT', NULL)", [await oturum(1)]);     // 640
    const [o] = await vt.kasiyer("SELECT * FROM fn_donem_ozeti($1, clock_timestamp() + interval '1 minute')", [bas]);
    assert.deepEqual(
        { ...o, normal_giris: Number(o.normal_giris), ogrenci_giris: Number(o.ogrenci_giris), siparis: Number(o.siparis),
            ciro: Number(o.ciro), nakit: Number(o.nakit), kart: Number(o.kart), diger_indirim: Number(o.diger_indirim) },
        { hesap_sayisi: 2, kisi: 7, ogrenci: 1, normal_giris: 600, ogrenci_giris: 50, siparis: 290, diger_indirim: 0,
            ciro: 940, nakit: 640, kart: 300 });
    await hataBekle(vt.garson('SELECT * FROM fn_donem_ozeti(now(), now())'), { kod: '42501' });
});
