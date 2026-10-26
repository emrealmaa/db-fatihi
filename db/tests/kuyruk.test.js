// Bekleme sırası ve seçim hakkı akışı (her oyunun kendi sırası)
// Seed durumu: masa 1 ve 2 Catan oynuyor (iki kopya da dolu), masa 3 Catan sırasında BEKLIYOR.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { yeniVt, hataBekle } from './yardimci.js';

let vt;
beforeEach(async () => { vt = await yeniVt(); });
afterEach(async () => { await vt.kapat(); });

const CATAN = 1, AZUL = 8;
const masa = async (no) => (await vt.garson('SELECT * FROM v_masa_durumu WHERE masa_no = $1', [no]))[0];
const sira = () => vt.garson('SELECT * FROM v_bekleme_sirasi ORDER BY sira');
const ozet = async () => (await sira()).map((r) => [r.masa_no, r.durum]);
const masaAc = (no, kisi, kullanici = 4) =>
    vt.garson('CALL sp_oturum_ac($1, $2, $3, NULL)', [no, kisi, kullanici]).then((r) => r[0].p_oturum_id);
const siraya = (oturum, oyun) => vt.garson('CALL sp_bekleme_ekle($1, $2, NULL)', [oturum, oyun]);
const iade = async (no) => vt.garson('CALL sp_oyun_bitir($1)', [(await masa(no)).oturum_oyun_id]);

test('beklenen oyunun kopyası boşalınca o oyunun sırasındaki ilk masaya hak geçer', async () => {
    await iade(1);
    const [ilk] = await sira();
    assert.equal(ilk.masa_no, 3);
    assert.equal(ilk.oyun, 'Catan');
    assert.equal(ilk.durum, 'SECIM_HAKKI');
    assert.ok(ilk.secim_bitis > ilk.secim_hakki_zamani);
});

test('başka oyunlar boşken sıradaki masaya hak verilmez (kafe kilitlenmez)', async () => {
    await vt.garson('CALL sp_secim_suresi_doldur(NULL)');   // zamanlayıcı çalışsa bile
    assert.deepEqual(await ozet(), [[3, 'BEKLIYOR']]);
    const m4 = await masaAc(4, 4);
    await vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [m4, AZUL]);
    assert.equal((await masa(4)).oynanan_oyun, 'Azul');
});

test('ayrılan kopya başka masaya verilmez, ama diğer oyunlar serbesttir', async () => {
    await iade(1);
    const m4 = await masaAc(4, 4);
    await hataBekle(vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [m4, CATAN]), { mesaj: /sıradaki masa 3 için ayrıldı/ });
    await vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [m4, AZUL]);
    assert.equal((await masa(4)).oynanan_oyun, 'Azul');

    const [hak] = await sira();
    await vt.garson('CALL sp_oyun_sec($1, NULL)', [hak.bekleme_id]);
    assert.equal((await masa(3)).oynanan_oyun, 'Catan');
    assert.equal((await sira()).length, 0);
});

test('seçim hakkı olmayan kayıtla oyun alınamaz', async () => {
    const [b] = await sira();   // masa 3, BEKLIYOR
    await hataBekle(vt.garson('CALL sp_oyun_sec($1, NULL)', [b.bekleme_id]), { mesaj: /seçim hakkı yok/ });
});

test('iki kopya boşalınca o oyunun sırasındaki iki masa da hak alır', async () => {
    const m4 = await masaAc(4, 4);
    await siraya(m4, CATAN);
    await iade(1);
    await iade(2);
    assert.deepEqual(await ozet(), [[3, 'SECIM_HAKKI'], [4, 'SECIM_HAKKI']]);
    const [c] = await vt.garson('SELECT musait_adet, alinabilir_adet, bekleyen_masa FROM v_musait_oyunlar WHERE oyun_id = $1', [CATAN]);
    assert.deepEqual({ ...c }, { musait_adet: 2, alinabilir_adet: 0, bekleyen_masa: 2 });
});

test('süresi dolan masa o oyunun sırasının sonuna atılır, hak sıradakine geçer', async () => {
    const m4 = await masaAc(4, 4);
    await siraya(m4, CATAN);
    await iade(1);
    await vt.admin("UPDATE bekleme SET secim_hakki_zamani = clock_timestamp() - interval '6 minutes' WHERE durum = 'SECIM_HAKKI'");

    await vt.garson('CALL sp_secim_suresi_doldur(NULL)');
    assert.deepEqual(await ozet(), [[4, 'SECIM_HAKKI'], [3, 'BEKLIYOR']]);
    const [atlanan] = await vt.admin("SELECT count(*)::int AS n FROM bekleme WHERE durum = 'ATLANDI'");
    assert.equal(atlanan.n, 1);
});

test('süresi dolmayan seçim hakkına dokunulmaz', async () => {
    await iade(1);
    await vt.garson('CALL sp_secim_suresi_doldur(NULL)');
    assert.equal((await sira())[0].durum, 'SECIM_HAKKI');
});

test('sıradaki masa başka bir oyun başlatırsa kaydı iptal olur, ayrılan kopya sıradakine geçer', async () => {
    const m4 = await masaAc(4, 4);
    await siraya(m4, CATAN);
    await iade(1);                                   // hak masa 3'te
    await vt.garson('CALL sp_oyun_baslat($1, $2, NULL)', [(await masa(3)).oturum_id, AZUL]);
    assert.deepEqual(await ozet(), [[4, 'SECIM_HAKKI']]);
    const [iptal] = await vt.admin("SELECT count(*)::int AS n FROM bekleme WHERE durum = 'IPTAL'");
    assert.equal(iptal.n, 1);
});

test('müsait oyun için sıraya girilemez, kişi sayısı uymayan oyunun sırasına girilemez', async () => {
    const m4 = await masaAc(4, 4);
    await hataBekle(siraya(m4, AZUL), { mesaj: /şu an müsait/ });
    const m6 = await masaAc(6, 1);
    await hataBekle(siraya(m6, CATAN), { mesaj: /oyuncu için uygun/ });
});

test('oyun oynayan masa sıraya giremez, bir masa sırada iki kez bulunamaz', async () => {
    await hataBekle(siraya((await masa(1)).oturum_id, CATAN), { mesaj: /zaten oyun oynuyor/ });
    await hataBekle(siraya((await masa(3)).oturum_id, CATAN), { kod: '23505' });
});

test('sıradan çıkan veya hesabı kapanan masanın kaydı iptal olur', async () => {
    const m4 = await masaAc(4, 4);
    const [b4] = await siraya(m4, CATAN);
    await vt.garson('CALL sp_bekleme_iptal($1)', [b4.p_bekleme_id]);
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'KART', NULL)", [(await masa(3)).oturum_id]);
    assert.equal((await sira()).length, 0);
    const iptal = await vt.admin("SELECT count(*)::int AS n FROM bekleme WHERE durum = 'IPTAL'");
    assert.equal(iptal[0].n, 2);
});

test('hesabı kapanan masanın oyunu iade edilir ve hak o oyunu bekleyene geçer', async () => {
    await vt.kasiyer("CALL sp_oturum_kapat($1, 'NAKIT', NULL)", [(await masa(1)).oturum_id]);
    const [ilk] = await sira();
    assert.equal(ilk.masa_no, 3);
    assert.equal(ilk.durum, 'SECIM_HAKKI');
    const [catan] = await vt.garson('SELECT musait_adet, alinabilir_adet FROM v_musait_oyunlar WHERE oyun_id = $1', [CATAN]);
    assert.deepEqual({ ...catan }, { musait_adet: 1, alinabilir_adet: 0 });
});
