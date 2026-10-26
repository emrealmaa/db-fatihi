// Garson işlemleri: masalar, müşteriler, oyunlar, bekleme sırası, siparişler.
// Her uç bir view okur veya bir sp_* prosedürü çağırır.
import { Router } from 'express';
import { HttpHata } from '../hatalar.js';
import { tamsayi, metin, mantiksal, telefon } from '../dogrulama.js';

export function salonRotalari() {
    const r = Router();

    // ---------------------------------------------------------------- masalar
    r.get('/masalar', async (req, res) => {
        res.json(await req.vt((q) => q('SELECT * FROM v_masa_durumu ORDER BY masa_no')));
    });

    // Masa aç. Müşteri ya kullaniciId ile ya da yeni kayıt bilgileriyle (musteri) gelir;
    // ikisi de yoksa ayar.kayit_zorunlu'ya göre kayıtsız açılır veya reddedilir.
    r.post('/masalar/:masaId/ac', async (req, res) => {
        const masaId = tamsayi(req.params.masaId, 'Masa');
        const kisi = tamsayi(req.body.kisiSayisi, 'Kişi sayısı');
        let kullaniciId = tamsayi(req.body.kullaniciId, 'Müşteri', { zorunlu: false });
        const m = req.body.musteri;
        const oturumId = await req.vt(async (q) => {
            if (!kullaniciId && m) {
                const [k] = await q('CALL sp_musteri_kaydet($1, $2, $3, $4, $5, NULL)', [
                    metin(m.ad, 'Ad'), metin(m.soyad, 'Soyad'), telefon(m.telefon),
                    metin(m.email, 'E-posta', { zorunlu: false }), mantiksal(m.ogrenci, { varsayilan: false }),
                ]);
                kullaniciId = k.p_kullanici_id;
            }
            const [o] = await q('CALL sp_oturum_ac($1, $2, $3, NULL)', [masaId, kisi, kullaniciId]);
            return o.p_oturum_id;
        });
        res.status(201).json({ oturumId, kullaniciId });
    });

    // ---------------------------------------------------------------- müşteriler
    r.get('/musteriler/ara', async (req, res) => {
        const tel = telefon(req.query.telefon);
        const [m] = await req.vt((q) => q('SELECT * FROM fn_musteri_bul($1)', [tel]));
        if (!m) throw new HttpHata(404, 'Bu telefonla kayıtlı müşteri yok');
        res.json(m);
    });

    r.post('/musteriler', async (req, res) => {
        const b = req.body;
        const [k] = await req.vt((q) => q('CALL sp_musteri_kaydet($1, $2, $3, $4, $5, NULL)', [
            metin(b.ad, 'Ad'), metin(b.soyad, 'Soyad'), telefon(b.telefon),
            metin(b.email, 'E-posta', { zorunlu: false }), mantiksal(b.ogrenci, { varsayilan: false }),
        ]));
        res.status(201).json({ kullaniciId: k.p_kullanici_id });
    });

    // ---------------------------------------------------------------- oyunlar
    r.get('/oyunlar', async (req, res) => {
        res.json(await req.vt((q) => q('SELECT * FROM v_musait_oyunlar ORDER BY ad')));
    });

    r.post('/oturumlar/:oturumId/oyun', async (req, res) => {
        const [o] = await req.vt((q) => q('CALL sp_oyun_baslat($1, $2, NULL)', [
            tamsayi(req.params.oturumId, 'Oturum'), tamsayi(req.body.oyunId, 'Oyun')]));
        res.status(201).json({ oturumOyunId: o.p_oturum_oyun_id });
    });

    r.post('/oturum-oyunlar/:id/bitir', async (req, res) => {
        await req.vt((q) => q('CALL sp_oyun_bitir($1)', [tamsayi(req.params.id, 'Oyun kaydı')]));
        res.status(204).end();
    });

    // ---------------------------------------------------------------- bekleme sırası
    r.get('/bekleme', async (req, res) => {
        res.json(await req.vt((q) => q('SELECT * FROM v_bekleme_sirasi ORDER BY sira')));
    });

    r.post('/oturumlar/:oturumId/bekleme', async (req, res) => {
        const [b] = await req.vt((q) => q('CALL sp_bekleme_ekle($1, NULL)', [tamsayi(req.params.oturumId, 'Oturum')]));
        res.status(201).json({ beklemeId: b.p_bekleme_id });
    });

    r.post('/bekleme/:id/sec', async (req, res) => {
        const [o] = await req.vt((q) => q('CALL sp_oyun_sec($1, $2, NULL)', [
            tamsayi(req.params.id, 'Bekleme kaydı'), tamsayi(req.body.oyunId, 'Oyun')]));
        res.status(201).json({ oturumOyunId: o.p_oturum_oyun_id });
    });

    r.delete('/bekleme/:id', async (req, res) => {
        await req.vt((q) => q('CALL sp_bekleme_iptal($1)', [tamsayi(req.params.id, 'Bekleme kaydı')]));
        res.status(204).end();
    });

    // ---------------------------------------------------------------- menü ve sipariş
    r.get('/menu', async (req, res) => {
        res.json(await req.vt((q) => q('SELECT * FROM v_menu ORDER BY kategori_sira, ad')));
    });

    r.get('/oturumlar/:oturumId/siparisler', async (req, res) => {
        res.json(await req.vt((q) => q('SELECT * FROM v_oturum_siparisleri WHERE oturum_id = $1 ORDER BY zaman',
            [tamsayi(req.params.oturumId, 'Oturum')])));
    });

    // Tek seferde birden çok kalem: { kalemler: [{ urunId, adet }] } (hepsi ya da hiçbiri)
    r.post('/oturumlar/:oturumId/siparisler', async (req, res) => {
        const oturumId = tamsayi(req.params.oturumId, 'Oturum');
        const kalemler = Array.isArray(req.body.kalemler) ? req.body.kalemler : [req.body];
        if (!kalemler.length) throw new HttpHata(400, 'Sipariş boş');
        const idler = await req.vt(async (q) => {
            const sonuc = [];
            for (const k of kalemler) {
                const [s] = await q('CALL sp_siparis_ver($1, $2, $3, NULL)', [
                    oturumId, tamsayi(k.urunId, 'Ürün'), tamsayi(k.adet, 'Adet')]);
                sonuc.push(s.p_siparis_id);
            }
            return sonuc;
        });
        res.status(201).json({ siparisIdleri: idler });
    });

    r.delete('/siparisler/:id', async (req, res) => {
        await req.vt((q) => q('CALL sp_siparis_iptal($1)', [tamsayi(req.params.id, 'Sipariş')]));
        res.status(204).end();
    });

    return r;
}
