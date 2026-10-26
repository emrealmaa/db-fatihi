// Rol yetkileri ve maskeleme
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { yeniVt, hataBekle, YETKI_YOK, P } from './yardimci.js';

let vt;
beforeEach(async () => { vt = await yeniVt(); });
afterEach(async () => { await vt.kapat(); });

test('giriş: doğru parola personeli döner, yanlış parola boş döner, hash dışarı verilmez', async () => {
    const [p] = await vt.giris('SELECT * FROM fn_personel_giris($1, $2)', ['Garson', 'karavana123']);
    assert.deepEqual({ ...p }, { personel_id: P.garson, ad: 'Selin', soyad: 'Er', rol: 'GARSON' });
    assert.equal((await vt.giris('SELECT * FROM fn_personel_giris($1, $2)', ['garson', 'yanlis'])).length, 0);
    const [h] = await vt.admin("SELECT parola_hash FROM personel WHERE kullanici_adi = 'garson'");
    assert.notEqual(h.parola_hash, 'karavana123');
    assert.match(h.parola_hash, /^\$2a\$/);   // bcrypt
});

test('pasif personel giriş yapamaz ve işlem yapamaz', async () => {
    await vt.admin('UPDATE personel SET aktif = false WHERE id = $1', [P.garson2]);
    assert.equal((await vt.giris('SELECT * FROM fn_personel_giris($1, $2)', ['garson2', 'karavana123'])).length, 0);
    await hataBekle(vt.garson('CALL sp_oturum_ac(4, 2, 1, NULL)', [], P.garson2), { kod: YETKI_YOK });
});

test('giriş rolü hiçbir tablo veya view okuyamaz', async () => {
    await hataBekle(vt.giris('SELECT * FROM personel'), { kod: YETKI_YOK });
    await hataBekle(vt.giris('SELECT * FROM v_masa_durumu'), { kod: YETKI_YOK });
});

test('garson ham müşteri ve personel tablolarını okuyamaz', async () => {
    await hataBekle(vt.garson('SELECT * FROM kullanici'), { kod: YETKI_YOK });
    await hataBekle(vt.garson('SELECT * FROM personel'), { kod: YETKI_YOK });
    await hataBekle(vt.garson('SELECT * FROM v_personel_maskeli'), { kod: YETKI_YOK });
});

test('garson müşterileri yalnızca maskeli görür', async () => {
    const [m] = await vt.garson('SELECT * FROM v_musteri_maskeli WHERE id = 1');
    assert.equal(m.ad, 'A***');
    assert.equal(m.telefon, '0532*****67');
    assert.equal(m.email, 'a**********@mail.com');
    const [b] = await vt.garson('SELECT * FROM fn_musteri_bul($1)', ['05321234567']);
    assert.equal(b.ad, 'A***');
    assert.equal(Number(b.id), 1);
});

test('garson tablolara doğrudan yazamaz, yalnızca prosedür çağırır', async () => {
    await hataBekle(vt.garson('INSERT INTO siparis (oturum_id, urun_id, personel_id, adet, birim_fiyat) VALUES (1, 1, 3, 1, 0)'),
        { kod: YETKI_YOK });
    await hataBekle(vt.garson('UPDATE urun SET fiyat = 0'), { kod: YETKI_YOK });
});

test('garson hesap kapatamaz, açık hesapları ve ciroyu göremez', async () => {
    await hataBekle(vt.garson("CALL sp_oturum_kapat(1, 'NAKIT', NULL)"), { kod: YETKI_YOK });
    await hataBekle(vt.garson('SELECT * FROM v_acik_hesaplar'), { kod: YETKI_YOK });
    await hataBekle(vt.garson('SELECT * FROM v_gunluk_ciro'), { kod: YETKI_YOK });
});

test('kasiyer hesapları görür ama ham müşteri tablosunu ve yönetici raporlarını göremez', async () => {
    assert.equal((await vt.kasiyer('SELECT * FROM v_acik_hesaplar')).length, 3);
    await hataBekle(vt.kasiyer('SELECT * FROM kullanici'), { kod: YETKI_YOK });
    await hataBekle(vt.kasiyer('SELECT * FROM v_personel_performans'), { kod: YETKI_YOK });
    await hataBekle(vt.kasiyer("CALL sp_personel_ekle('A','B','05301119999','GARSON','yeni','parola12',NULL,NULL)"),
        { kod: YETKI_YOK });
});

test('yönetici ham veriyi maskesiz görür ve personel ekler', async () => {
    const [m] = await vt.yonetici('SELECT telefon FROM kullanici WHERE id = 1');
    assert.equal(m.telefon, '05321234567');
    await vt.yonetici("CALL sp_personel_ekle('Yeni','Garson','05301119999','garson','yeni.garson','parola12',NULL,NULL)");
    const [p] = await vt.giris('SELECT * FROM fn_personel_giris($1, $2)', ['yeni.garson', 'parola12']);
    assert.equal(p.rol, 'GARSON');
});

test('işlemi yapan personel belirtilmeden prosedür çalışmaz', async () => {
    await hataBekle(vt.garson('CALL sp_oturum_ac(4, 2, 1, NULL)', [], null), { kod: YETKI_YOK, mesaj: /personel belirtilmedi/ });
});
