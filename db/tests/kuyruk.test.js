// Bekleme sırası ve seçim hakkı akışı
// Seed durumu: masa 1 ve 2 Catan oynuyor (iki kopya da dolu), masa 3 sırada BEKLIYOR.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { yeniVt, hataBekle } from './yardimci.js';

let vt;
beforeEach(async () => { vt = await yeniVt(); });
afterEach(async () => { await vt.kapat(); });

const masa = async (no) => (await vt.garson('SELECT * FROM v_masa_durumu WHERE masa_no = $1', [no]))[0];
const sira = () => vt.garson('SELECT * FROM v_bekleme_sirasi ORDER BY sira');
const masaAc = (no, kisi, kullanici = 4) =>
    vt.garson('CALL sp_oturum_ac($1, $2, $3, NULL)', [no, kisi, kullanici]).then((r) => r[0].p_oturum_id);

test('oyun iade edilince sıradaki masaya seçim hakkı geçer', async () => {
    const m1 = await masa(1);
    await vt.garson('CALL sp_oyun_bitir($1)', [m1.oturum_oyun_id]);
    const [ilk] = await sira();
    assert.equal(ilk.masa_no, 3);
    assert.equal(ilk.durum, 'SECIM_HAKKI');
    assert.ok(ilk.secim_bitis > ilk.secim_hakki_zamani);
});

test('seçim hakkı başka masadayken sıra atlanamaz; seçim yapılınca serbest kalır', async () => {
    await vt.garson('CALL sp_oyun_bitir($1)', [(await masa(1)).oturum_oyun_id]);
    const m4 = await masaAc(4, 4);
    await hataBekle(vt.garson('CALL sp_oyun_baslat($1, 8, NULL)', [m4]), { mesaj: /Sıra masa 3/ });

    const [hak] = await sira();
    await vt.garson('CALL sp_oyun_sec($1, 1, NULL)', [hak.bekleme_id]);   // masa 3 boşalan Catan'ı alır
    assert.equal((await masa(3)).oynanan_oyun, 'Catan');
    assert.equal((await sira()).length, 0);

    await vt.garson('CALL sp_oyun_baslat($1, 8, NULL)', [m4]);           // artık serbest
    assert.equal((await masa(4)).oynanan_oyun, 'Azul');
});

test('seçim hakkı olmayan kayıtla oyun seçilemez', async () => {
    const [b] = await sira();   // masa 3, BEKLIYOR
    await hataBekle(vt.garson('CALL sp_oyun_sec($1, 2, NULL)', [b.bekleme_id]), { mesaj: /seçim hakkı yok/ });
});

test('aynı anda tek masa seçim hakkına sahiptir', async () => {
    const m4 = await masaAc(4, 4);
    await vt.garson('CALL sp_bekleme_ekle($1, NULL)', [m4]);
    await vt.garson('CALL sp_oyun_bitir($1)', [(await masa(1)).oturum_oyun_id]);
    await vt.garson('CALL sp_oyun_bitir($1)', [(await masa(2)).oturum_oyun_id]);
    const s = await sira();
    assert.deepEqual(s.map((r) => [r.masa_no, r.durum]), [[3, 'SECIM_HAKKI'], [4, 'BEKLIYOR']]);
});

test('süresi dolan masa sıranın sonuna atılır, hak sıradakine geçer', async () => {
    const m4 = await masaAc(4, 4);
    await vt.garson('CALL sp_bekleme_ekle($1, NULL)', [m4]);
    await vt.garson('CALL sp_oyun_bitir($1)', [(await masa(1)).oturum_oyun_id]);
    await vt.admin("UPDATE bekleme SET secim_hakki_zamani = clock_timestamp() - interval '6 minutes' WHERE durum = 'SECIM_HAKKI'");

    await vt.garson('CALL sp_secim_suresi_doldur(NULL)');
    const s = await sira();
    assert.deepEqual(s.map((r) => [r.masa_no, r.durum]), [[4, 'SECIM_HAKKI'], [3, 'BEKLIYOR']]);
    const [atlanan] = await vt.admin("SELECT count(*)::int AS n FROM bekleme WHERE durum = 'ATLANDI'");
    assert.equal(atlanan.n, 1);
});

test('süresi dolmayan seçim hakkına dokunulmaz', async () => {
    await vt.garson('CALL sp_oyun_bitir($1)', [(await masa(1)).oturum_oyun_id]);
    await vt.garson('CALL sp_secim_suresi_doldur(NULL)');
    assert.equal((await sira())[0].durum, 'SECIM_HAKKI');
});

test('kişi sayısına uygun müsait oyun yoksa hak sıradaki uygun masaya verilir', async () => {
    // masa 6'da tek kişi: hiçbir oyun 1 kişilik değil
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'NAKIT', NULL)", [(await masa(3)).oturum_id]);
    const m6 = await masaAc(6, 1);
    const m4 = await masaAc(4, 4);
    await vt.garson('CALL sp_bekleme_ekle($1, NULL)', [m6]);
    await vt.garson('CALL sp_bekleme_ekle($1, NULL)', [m4]);
    await vt.garson('CALL sp_oyun_bitir($1)', [(await masa(1)).oturum_oyun_id]);
    const s = await sira();
    assert.deepEqual(s.map((r) => [r.masa_no, r.durum]), [[4, 'SECIM_HAKKI'], [6, 'BEKLIYOR']]);
});

test('oyun oynayan masa sıraya giremez, bir masa sırada iki kez bulunamaz', async () => {
    await hataBekle(vt.garson('CALL sp_bekleme_ekle($1, NULL)', [(await masa(1)).oturum_id]), { mesaj: /zaten oyun oynuyor/ });
    await hataBekle(vt.garson('CALL sp_bekleme_ekle($1, NULL)', [(await masa(3)).oturum_id]), { kod: '23505' });
});

test('sıradan çıkan veya hesabı kapanan masanın kaydı iptal olur', async () => {
    const m4 = await masaAc(4, 4);
    const [b4] = await vt.garson('CALL sp_bekleme_ekle($1, NULL)', [m4]);
    await vt.garson('CALL sp_bekleme_iptal($1)', [b4.p_bekleme_id]);
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'KART', NULL)", [(await masa(3)).oturum_id]);
    assert.equal((await sira()).length, 0);
    const iptal = await vt.admin("SELECT count(*)::int AS n FROM bekleme WHERE durum = 'IPTAL'");
    assert.equal(iptal[0].n, 2);
});

test('hesabı kapanan masanın oyunu iade edilir ve hak sıradakine geçer', async () => {
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'NAKIT', NULL)", [(await masa(1)).oturum_id]);
    const [ilk] = await sira();
    assert.equal(ilk.masa_no, 3);
    assert.equal(ilk.durum, 'SECIM_HAKKI');
    const [catan] = await vt.garson('SELECT musait_adet FROM v_musait_oyunlar WHERE oyun_id = 1');
    assert.equal(catan.musait_adet, 1);
});
