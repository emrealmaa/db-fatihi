// Kasiyer işlemleri: açık hesaplar, hesap dökümü, kapanış/ödeme, ciro
import { Router } from 'express';
import { HttpHata } from '../hatalar.js';
import { tamsayi, metin } from '../dogrulama.js';

export function kasaRotalari() {
    const r = Router();

    r.get('/hesaplar', async (req, res) => {
        res.json(await req.vt((q) => q('SELECT * FROM v_acik_hesaplar ORDER BY masa_no')));
    });

    r.get('/oturumlar/:oturumId/hesap', async (req, res) => {
        const id = tamsayi(req.params.oturumId, 'Oturum');
        const sonuc = await req.vt(async (q) => {
            const [ozet] = await q('SELECT * FROM v_acik_hesaplar WHERE oturum_id = $1', [id]);
            if (!ozet) return null;
            const kalemler = await q('SELECT * FROM v_oturum_siparisleri WHERE oturum_id = $1 ORDER BY zaman', [id]);
            return { ...ozet, kalemler };
        });
        if (!sonuc) throw new HttpHata(404, 'Açık hesap bulunamadı');
        res.json(sonuc);
    });

    r.post('/oturumlar/:oturumId/kapat', async (req, res) => {
        const [o] = await req.vt((q) => q('CALL sp_oturum_kapat($1, $2, NULL)', [
            tamsayi(req.params.oturumId, 'Oturum'), metin(req.body.odemeTuru, 'Ödeme türü')]));
        res.json({ toplam: o.p_toplam });
    });

    r.get('/raporlar/ciro', async (req, res) => {
        res.json(await req.vt((q) => q('SELECT * FROM v_gunluk_ciro ORDER BY gun DESC LIMIT 60')));
    });

    return r;
}
