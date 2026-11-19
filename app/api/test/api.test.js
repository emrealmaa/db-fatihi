// API uçtan uca testleri: giriş, rol kısıtları, hata çevirisi ve tam bir masa akışı.
// Veritabanı: DB_SURUCU=pglite ise bellekte PGlite, değilse .env'deki PostgreSQL'de test veritabanı
// (POSTGRES_TEST_DB, varsayılan karavana_test; sıfırdan kurulur, geliştirme veritabanına dokunulmaz).
// Testler sırayla çalışır ve aynı veritabanını paylaşır (akış adım adım ilerler).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { baglan, kur, testAyarlari } from '../../../db/lib/veritabani.js';
import { uygulamaOlustur } from '../src/uygulama.js';

// npm workspace testleri app/api klasöründe çalıştırır; .env kök dizinde (sunucu.js ile aynı)
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env') });

let vt, sunucu, adres;
const token = {};

before(async () => {
    const a = testAyarlari();
    if (a.surucu === 'pg') await kur(a);
    vt = await baglan(a);
    const app = uygulamaOlustur({ vt, gizliAnahtar: 'test', log: () => {} });
    await new Promise((ok) => { sunucu = app.listen(0, ok); });
    adres = `http://localhost:${sunucu.address().port}/api`;
    for (const k of ['garson', 'kasiyer', 'yonetici']) {
        token[k] = (await istek('POST', '/giris', { kullaniciAdi: k, parola: 'karavana123' })).govde.token;
    }
});

after(async () => {
    sunucu.close();
    await vt.kapat();
});

async function istek(yontem, yol, govde, kim, adina) {
    const res = await fetch(adres + yol, {
        method: yontem,
        headers: {
            'Content-Type': 'application/json',
            ...(kim ? { Authorization: `Bearer ${token[kim]}` } : {}),
            ...(adina ? { 'X-Personel': String(adina) } : {}),
        },
        body: govde ? JSON.stringify(govde) : undefined,
    });
    const metin = await res.text();
    return { durum: res.status, govde: metin ? JSON.parse(metin) : null };
}

test('giriş: doğru parola token verir, yanlış parola 401', async () => {
    assert.ok(token.garson);
    const yanlis = await istek('POST', '/giris', { kullaniciAdi: 'garson', parola: 'x' });
    assert.equal(yanlis.durum, 401);
    assert.equal((await istek('GET', '/ben', null, 'kasiyer')).govde.rol, 'KASIYER');
});

test('token olmadan veya bozuk token ile 401', async () => {
    assert.equal((await istek('GET', '/masalar')).durum, 401);
    token.bozuk = 'abc';
    assert.equal((await istek('GET', '/masalar', null, 'bozuk')).durum, 401);
});

test('garson kasa ve yönetim uçlarına erişemez (403)', async () => {
    assert.equal((await istek('GET', '/hesaplar', null, 'garson')).durum, 403);
    assert.equal((await istek('GET', '/raporlar/kritik-stok', null, 'garson')).durum, 403);
    assert.equal((await istek('GET', '/raporlar/kritik-stok', null, 'kasiyer')).durum, 403);
    assert.equal((await istek('GET', '/raporlar/kritik-stok', null, 'yonetici')).durum, 200);
});

test('masalar ve oyunlar listelenir, sayılar JSON sayısıdır', async () => {
    const { govde: masalar } = await istek('GET', '/masalar', null, 'garson');
    assert.equal(masalar.length, 25);
    assert.deepEqual([1, 2, 3].map((k) => masalar.filter((m) => m.kat === k).length), [10, 10, 5]);
    assert.deepEqual([...new Set(masalar.map((m) => m.kat))].sort(), [1, 2, 3]);
    assert.equal(typeof masalar[0].oturum_id, 'number');
    const { govde: oyunlar } = await istek('GET', '/oyunlar', null, 'garson');
    assert.equal(oyunlar.find((o) => o.ad === 'Root').musait_adet, 0);
});

test('müşteri telefonla aranır (maskeli), yoksa 404', async () => {
    const bulunan = await istek('GET', '/musteriler/ara?telefon=0532%20123%2045%2067', null, 'garson');
    assert.equal(bulunan.durum, 200);
    assert.equal(bulunan.govde.ad, 'A***');
    assert.equal((await istek('GET', '/musteriler/ara?telefon=05000000000', null, 'garson')).durum, 404);
});

test('masa açılırken yeni müşteri aynı adımda kaydedilir', async () => {
    const r = await istek('POST', '/masalar/4/ac', {
        kisiSayisi: 2, musteri: { ad: 'Yeni', soyad: 'Müşteri', telefon: '+90 555 000 11 22' } }, 'garson');
    assert.equal(r.durum, 201);
    assert.ok(r.govde.oturumId && r.govde.kullaniciId);
});

test('kısıt ihlalleri anlaşılır Türkçe mesaja çevrilir', async () => {
    const dolu = await istek('POST', '/masalar/4/ac', { kisiSayisi: 2, kullaniciId: 1 }, 'garson');
    assert.equal(dolu.durum, 409);
    assert.match(dolu.govde.hata, /dolu/);

    const kapasite = await istek('POST', '/masalar/6/ac', { kisiSayisi: 5, kullaniciId: 1 }, 'garson');
    assert.equal(kapasite.durum, 400);
    assert.match(kapasite.govde.hata, /kapasitesini/);

    const telefon = await istek('POST', '/musteriler', { ad: 'A', soyad: 'B', telefon: '123' }, 'garson');
    assert.equal(telefon.durum, 400);
    assert.match(telefon.govde.hata, /05XXXXXXXXX/);

    const eksik = await istek('POST', '/masalar/5/ac', {}, 'garson');
    assert.equal(eksik.durum, 400);
    assert.match(eksik.govde.hata, /Kişi sayısı gerekli/);
});

test('tam akış: oyun, sıra, seçim, sipariş, hesap ve ödeme', async () => {
    const masa = async (no) => (await istek('GET', '/masalar', null, 'garson')).govde.find((m) => m.masa_no === no);

    // Masa 1 Root'u iade eder -> Root sırasındaki masa 3'e seçim hakkı
    assert.equal((await istek('POST', `/oturum-oyunlar/${(await masa(1)).oturum_oyun_id}/bitir`, null, 'garson')).durum, 204);
    const [hak] = (await istek('GET', '/bekleme', null, 'garson')).govde;
    assert.equal(hak.masa_no, 3);
    assert.equal(hak.durum, 'SECIM_HAKKI');

    // Masa 4 ayrılan Root kopyasını alamaz, başka oyunu alabilir
    const atla = await istek('POST', `/oturumlar/${(await masa(4)).oturum_id}/oyun`, { oyunId: 1 }, 'garson');
    assert.equal(atla.durum, 400);
    assert.match(atla.govde.hata, /masa 3 için ayrıldı/);
    const musaitSira = await istek('POST', `/oturumlar/${(await masa(4)).oturum_id}/bekleme`, { oyunId: 9 }, 'garson');
    assert.match(musaitSira.govde.hata, /şu an müsait/);
    assert.equal((await istek('POST', `/oturumlar/${(await masa(4)).oturum_id}/oyun`, { oyunId: 9 }, 'garson')).durum, 201);
    assert.equal((await masa(4)).oynanan_oyun, 'Splendor');

    // Masa 3 kendisine ayrılan Root'u alır
    assert.equal((await istek('POST', `/bekleme/${hak.bekleme_id}/sec`, {}, 'garson')).durum, 201);
    assert.equal((await masa(3)).oynanan_oyun, 'Root');

    // Çok kalemli sipariş: biri stok yetersizse hiçbiri yazılmaz
    const m4 = (await masa(4)).oturum_id;
    const kotu = await istek('POST', `/oturumlar/${m4}/siparisler`, { kalemler: [{ urunId: 1, adet: 1 }, { urunId: 10, adet: 99 }] }, 'garson');
    assert.equal(kotu.durum, 400);
    assert.equal((await istek('GET', `/oturumlar/${m4}/siparisler`, null, 'garson')).govde.length, 0);
    await istek('POST', `/oturumlar/${m4}/siparisler`, { kalemler: [{ urunId: 1, adet: 2 }, { urunId: 9, adet: 1 }] }, 'garson');

    // Kasiyer hesabı görür ve kart ile kapatır: 2 × 100 + 2 × 60 + 140 = 460
    const hesap = await istek('GET', `/oturumlar/${m4}/hesap`, null, 'kasiyer');
    assert.equal(hesap.govde.toplam, 460);
    assert.equal(hesap.govde.kalemler.length, 2);
    const kapat = await istek('POST', `/oturumlar/${m4}/kapat`, { odemeTuru: 'KART' }, 'kasiyer');
    assert.equal(kapat.govde.toplam, 460);
    const [ciro] = (await istek('GET', '/raporlar/ciro', null, 'kasiyer')).govde;
    assert.equal(ciro.kart, 460);
    assert.equal((await masa(4)).durum, 'BOS');
});

test('yönetici: ürün, personel ve ayar yönetimi', async () => {
    const urun = await istek('POST', '/yonetim/urunler', { ad: 'Sahlep', kategori_id: 1, fiyat: 90, stok: 10 }, 'yonetici');
    assert.equal(urun.durum, 201);
    assert.equal((await istek('PATCH', `/yonetim/urunler/${urun.govde.id}`, { fiyat: 95 }, 'yonetici')).govde.fiyat, 95);
    assert.equal((await istek('POST', '/yonetim/urunler', { ad: 'Sahlep', kategori_id: 1, fiyat: 1 }, 'yonetici')).durum, 409);

    const p = await istek('POST', '/yonetim/personel', {
        ad: 'Ece', soyad: 'Kar', telefon: '05301112233', rol: 'GARSON', kullanici_adi: 'ece', parola: 'gizli123' }, 'yonetici');
    assert.equal(p.durum, 201);
    assert.equal(p.govde.parola_hash, undefined);
    assert.equal((await istek('POST', '/giris', { kullaniciAdi: 'ece', parola: 'gizli123' })).durum, 200);
    const liste = (await istek('GET', '/yonetim/personel', null, 'yonetici')).govde;
    assert.ok(liste.every((x) => x.parola_hash === undefined));

    const ayar = await istek('PATCH', '/yonetim/ayar', { giris_ucreti: 120 }, 'yonetici');
    assert.equal(ayar.govde.giris_ucreti, 120);
    const kotuAyar = await istek('PATCH', '/yonetim/ayar', { secim_suresi_dk: 0 }, 'yonetici');
    assert.equal(kotuAyar.durum, 400);
    assert.match(kotuAyar.govde.hata, /1-60/);
});

test('öğrenci indirimi ve dönem özeti (gün sonu fişi)', async () => {
    const bas = new Date(Date.now() - 1000).toISOString();
    const masa9 = (await istek('GET', '/masalar', null, 'garson')).govde.find((m) => m.masa_no === 9);
    const ac = await istek('POST', `/masalar/${masa9.masa_id}/ac`, { kisiSayisi: 4, ogrenciSayisi: 2, kullaniciId: 3 }, 'garson');
    assert.equal(ac.durum, 201);
    const hesap = await istek('GET', `/oturumlar/${ac.govde.oturumId}/hesap`, null, 'kasiyer');
    assert.equal(hesap.govde.ogrenci_indirimi, hesap.govde.giris_ucreti);       // 2 öğrenci × %50
    const masa11 = (await istek('GET', '/masalar', null, 'garson')).govde.find((m) => m.masa_no === 11);
    const fazla = await istek('POST', `/masalar/${masa11.masa_id}/ac`, { kisiSayisi: 2, ogrenciSayisi: 3, kullaniciId: 3 }, 'garson');
    assert.match(fazla.govde.hata, /Öğrenci sayısı/);
    await istek('POST', `/oturumlar/${ac.govde.oturumId}/kapat`, { odemeTuru: 'NAKIT' }, 'kasiyer');
    const o = (await istek('GET', `/raporlar/donem?bas=${encodeURIComponent(bas)}`, null, 'kasiyer')).govde;
    assert.equal(o.ogrenci, 2);
    assert.ok(o.ciro >= hesap.govde.toplam);
    assert.equal((await istek('GET', '/raporlar/donem?bas=x', null, 'kasiyer')).durum, 400);
});

test('yönetici personel adına işlem yapar; işlem o personelin rolü ve kimliğiyle kaydedilir', async () => {
    const masa5 = (await istek('GET', '/masalar', null, 'garson')).govde.find((m) => m.masa_no === 5);
    const ac = await istek('POST', `/masalar/${masa5.masa_id}/ac`, { kisiSayisi: 6, kullaniciId: 2 }, 'yonetici', 4);
    assert.equal(ac.durum, 201);
    await istek('POST', `/oturumlar/${ac.govde.oturumId}/siparisler`, { urunId: 3, adet: 2 }, 'yonetici', 4);
    const [s] = (await istek('GET', `/oturumlar/${ac.govde.oturumId}/siparisler`, null, 'garson')).govde;
    assert.equal(s.personel, 'Mert');

    // Garson rolüyle (personel 4) kasiyer işlemi yapılamaz; kasiyer (2) adına yapılabilir
    assert.equal((await istek('POST', `/oturumlar/${ac.govde.oturumId}/kapat`, { odemeTuru: 'NAKIT' }, 'yonetici', 4)).durum, 403);
    assert.equal((await istek('POST', `/oturumlar/${ac.govde.oturumId}/kapat`, { odemeTuru: 'NAKIT' }, 'yonetici', 2)).durum, 200);

    // Garson başkası adına işlem yapamaz
    assert.equal((await istek('GET', '/masalar', null, 'garson', 4)).durum, 403);
});

test('VIP Kulüp: kural hataları anlaşılır mesaja çevrilir; üyelik yöneticiyle verilir; raporlar', async () => {
    const masalar = (await istek('GET', '/masalar', null, 'garson')).govde;
    const vipMasa = masalar.find((m) => m.vip_masa && m.durum === 'BOS');
    const kat = await istek('POST', `/masalar/${vipMasa.masa_id}/ac`, { kisiSayisi: 2, kullaniciId: 4 }, 'garson');
    assert.equal(kat.durum, 400);
    assert.match(kat.govde.hata, /yalnızca ücreti ödenmiş VIP üyeler oturabilir/);

    const vipOyun = (await istek('GET', '/oyunlar', null, 'garson')).govde.find((o) => o.ad === 'Spirit Island');
    assert.equal(vipOyun.vip_ozel, true);
    const standart = masalar.find((m) => !m.vip_masa && m.durum === 'BOS' && m.kapasite >= 2);
    const ac = await istek('POST', `/masalar/${standart.masa_id}/ac`, { kisiSayisi: 2, kullaniciId: 4 }, 'garson');
    const oyun = await istek('POST', `/oturumlar/${ac.govde.oturumId}/oyun`, { oyunId: vipOyun.oyun_id }, 'garson');
    assert.equal(oyun.durum, 400);
    assert.equal(oyun.govde.hata, 'Bu oyun sadece VIP üyeler içindir (Spirit Island)');

    assert.equal((await istek('POST', '/yonetim/musteriler/4/vip', { vip: true }, 'garson')).durum, 403);
    assert.equal((await istek('POST', '/yonetim/musteriler/4/vip', { vip: true }, 'yonetici')).durum, 204);
    // üyelik işaretlendi ama haftalık ücret ödenmedi: VIP oyun hâlâ kapalı
    assert.equal((await istek('POST', `/oturumlar/${ac.govde.oturumId}/oyun`, { oyunId: vipOyun.oyun_id }, 'garson')).durum, 400);
    assert.equal((await istek('POST', '/musteriler/4/vip-odeme', { odemeTuru: 'KART' }, 'garson')).durum, 403);
    const ode = await istek('POST', '/musteriler/4/vip-odeme', { odemeTuru: 'KART' }, 'kasiyer');
    assert.equal(ode.durum, 201);
    assert.equal(Number(ode.govde.tutar), 10000);
    assert.equal((await istek('POST', `/oturumlar/${ac.govde.oturumId}/oyun`, { oyunId: vipOyun.oyun_id }, 'garson')).durum, 201);
    const seg = await istek('GET', '/raporlar/musteri-segment', null, 'yonetici');
    assert.equal(seg.govde.find((m) => m.id === 4).segment, 'VIP');
    assert.equal(Number((await istek('GET', '/raporlar/vip-uyelik-gelir', null, 'yonetici')).govde[0].gelir), 10000);

    const kullanim = await istek('GET', '/raporlar/vip-oyun-kullanimi', null, 'yonetici');
    assert.equal(kullanim.govde.length, 10);
    assert.equal((await istek('GET', '/raporlar/kat-gelir', null, 'yonetici')).durum, 200);
});
