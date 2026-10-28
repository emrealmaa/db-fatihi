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

    // Haftalık VIP üyelik ücretini tahsil et (ücret ayardan gelir, öğrenciye de indirimsizdir): { odemeTuru }
    r.post('/musteriler/:id/vip-odeme', async (req, res) => {
        const [o] = await req.vt((q) => q('CALL sp_vip_uyelik_ode($1, $2, NULL, NULL, NULL)', [
            tamsayi(req.params.id, 'Müşteri'), metin(req.body.odemeTuru, 'Ödeme türü')]));
        res.status(201).json({ odemeId: o.p_odeme_id, tutar: o.p_tutar, bitis: o.p_bitis });
    });

    // Dönem özeti (gün sonu fişi): ?bas=ISO&bit=ISO, bit verilmezse şimdi. "Şimdi" veritabanı saatidir: ödeme zamanı
    // da onunla yazılır; API saati birkaç ms geride kalırsa az önce alınan ödeme özetin dışında kalırdı.
    r.get('/raporlar/donem', async (req, res) => {
        const bas = new Date(req.query.bas), bit = req.query.bit ? new Date(req.query.bit) : null;
        if (Number.isNaN(bas.getTime()) || (bit && Number.isNaN(bit.getTime()))) throw new HttpHata(400, 'bas ve bit geçerli bir zaman olmalı');
        const [o] = await req.vt((q) => q('SELECT * FROM fn_donem_ozeti($1, COALESCE($2::timestamptz, clock_timestamp()))',
            [bas.toISOString(), bit?.toISOString() ?? null]));
        res.json(o);
    });

    r.get('/raporlar/ciro', async (req, res) => {
        res.json(await req.vt((q) => q('SELECT gun::text AS gun, hesap_sayisi, nakit, kart, ciro FROM v_gunluk_ciro ORDER BY gun DESC LIMIT 60')));
    });

    return r;
}
