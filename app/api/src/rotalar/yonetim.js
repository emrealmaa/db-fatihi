// Yönetici işlemleri: raporlar, katalog/menü/masa/personel yönetimi, ayarlar.
// Yönetici rolü tablolara doğrudan yazabilir; parola gibi hassas işlemler yine prosedürle yapılır.
// Gövde alan adları tablo sütun adlarıyla aynıdır (snake_case).
import { Router } from 'express';
import { HttpHata } from '../hatalar.js';
import { tamsayi, metin, telefon } from '../dogrulama.js';

const PERSONEL_SUTUNLARI = 'id, ad, soyad, telefon, email, rol, kullanici_adi, ise_baslama, aktif';

// Basit tablo yönetimi: listele / ekle / güncelle / (isteğe bağlı) sil.
// Yalnızca beyaz listedeki sütunlar yazılabilir.
function tabloRotalari(r, yol, { tablo, sutunlar, siralama, silinebilir = false, eklenebilir = true, liste }) {
    r.get(yol, async (req, res) => {
        res.json(await req.vt((q) => q(liste || `SELECT * FROM ${tablo} ORDER BY ${siralama}`)));
    });

    if (eklenebilir) r.post(yol, async (req, res) => {
        const alanlar = sutunlar.filter((s) => req.body[s] !== undefined);
        if (!alanlar.length) throw new HttpHata(400, 'Kaydedilecek alan yok');
        const [satir] = await req.vt((q) => q(
            `INSERT INTO ${tablo} (${alanlar.join(', ')}) VALUES (${alanlar.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
            alanlar.map((s) => req.body[s])));
        res.status(201).json(satir);
    });

    r.patch(`${yol}/:id`, async (req, res) => {
        const id = tamsayi(req.params.id, 'Kayıt');
        const alanlar = sutunlar.filter((s) => req.body[s] !== undefined);
        if (!alanlar.length) throw new HttpHata(400, 'Güncellenecek alan yok');
        const [satir] = await req.vt((q) => q(
            `UPDATE ${tablo} SET ${alanlar.map((s, i) => `${s} = $${i + 1}`).join(', ')} WHERE id = $${alanlar.length + 1} RETURNING *`,
            [...alanlar.map((s) => req.body[s]), id]));
        if (!satir) throw new HttpHata(404, 'Kayıt bulunamadı');
        res.json(satir);
    });

    if (silinebilir) {
        r.delete(`${yol}/:id`, async (req, res) => {
            const id = tamsayi(req.params.id, 'Kayıt');
            const satirlar = await req.vt((q) => q(`DELETE FROM ${tablo} WHERE id = $1 RETURNING id`, [id]));
            if (!satirlar.length) throw new HttpHata(404, 'Kayıt bulunamadı');
            res.status(204).end();
        });
    }
}

export function yonetimRotalari() {
    const r = Router();

    // ---------------------------------------------------------------- raporlar
    const raporlar = {
        'oyun-populerlik': 'SELECT * FROM v_oyun_populerlik ORDER BY oynanma_sayisi DESC, ad',
        'personel-performans': 'SELECT * FROM v_personel_performans ORDER BY personel',
        'kritik-stok': 'SELECT * FROM v_kritik_stok ORDER BY stok, ad',
        'urun-satis': 'SELECT * FROM v_urun_satis ORDER BY gelir DESC, ad',
        'vip-oyun-kullanimi': 'SELECT * FROM v_vip_oyun_kullanimi ORDER BY oturum_sayisi DESC, ad',
        'kat-gelir': 'SELECT * FROM v_kat_gelir ORDER BY gun DESC, kat',
        'musteri-segment': 'SELECT * FROM v_musteri_segment ORDER BY segment DESC, ziyaret_sayisi DESC, id',
        'vip-uyelik-gelir': 'SELECT gun::text AS gun, odeme_sayisi, gelir, nakit, kart FROM v_vip_uyelik_gelir ORDER BY gun DESC',
    };
    for (const [ad, sql] of Object.entries(raporlar)) {
        r.get(`/raporlar/${ad}`, async (req, res) => res.json(await req.vt((q) => q(sql))));
    }

    // ---------------------------------------------------------------- katalog, menü, masalar
    tabloRotalari(r, '/yonetim/kategoriler', {
        tablo: 'kategori', sutunlar: ['ad'], siralama: 'ad', silinebilir: true });
    tabloRotalari(r, '/yonetim/oyunlar', {
        tablo: 'oyun', siralama: 'ad',
        sutunlar: ['ad', 'kategori_id', 'min_oyuncu', 'max_oyuncu', 'sure_dk', 'toplam_adet', 'zorluk', 'talep', 'aktif', 'vip_ozel'] });
    tabloRotalari(r, '/yonetim/urun-kategorileri', {
        tablo: 'urun_kategori', sutunlar: ['ad', 'sira'], siralama: 'sira, ad', silinebilir: true });
    tabloRotalari(r, '/yonetim/urunler', {
        tablo: 'urun', siralama: 'ad',
        sutunlar: ['ad', 'kategori_id', 'fiyat', 'stok', 'kritik_stok', 'aktif'] });
    tabloRotalari(r, '/yonetim/masalar', {
        tablo: 'masa', sutunlar: ['masa_no', 'kapasite', 'kat'], siralama: 'kat, masa_no', silinebilir: true });

    r.post('/yonetim/urunler/:id/stok', async (req, res) => {
        await req.vt((q) => q('CALL sp_stok_ekle($1, $2)', [tamsayi(req.params.id, 'Ürün'), tamsayi(req.body.adet, 'Adet')]));
        res.status(204).end();
    });

    // ---------------------------------------------------------------- VIP Kulüp üyeliği
    // Üyelik yalnızca yönetici prosedürüyle verilir/geri alınır: { vip: true|false }
    r.post('/yonetim/musteriler/:id/vip', async (req, res) => {
        await req.vt((q) => q('CALL sp_musteri_vip($1, $2)', [tamsayi(req.params.id, 'Müşteri'), req.body.vip !== false]));
        res.status(204).end();
    });

    // ---------------------------------------------------------------- personel
    // Hash hiçbir zaman dönmez; ekleme ve parola değişimi prosedürle (bcrypt) yapılır.
    tabloRotalari(r, '/yonetim/personel', {
        tablo: 'personel', sutunlar: ['ad', 'soyad', 'telefon', 'email', 'rol', 'aktif'],
        eklenebilir: false, liste: `SELECT ${PERSONEL_SUTUNLARI} FROM personel ORDER BY aktif DESC, ad` });
    r.post('/yonetim/personel', async (req, res) => {
        const b = req.body;
        const [p] = await req.vt((q) => q('CALL sp_personel_ekle($1, $2, $3, $4, $5, $6, $7, NULL)', [
            metin(b.ad, 'Ad'), metin(b.soyad, 'Soyad'), telefon(b.telefon), metin(b.rol, 'Rol'),
            metin(b.kullanici_adi, 'Kullanıcı adı'), metin(b.parola, 'Parola'), metin(b.email, 'E-posta', { zorunlu: false })]));
        const [satir] = await req.vt((q) => q(`SELECT ${PERSONEL_SUTUNLARI} FROM personel WHERE id = $1`, [p.p_personel_id]));
        res.status(201).json(satir);
    });

    r.post('/yonetim/personel/:id/parola', async (req, res) => {
        await req.vt((q) => q('CALL sp_personel_parola($1, $2)', [tamsayi(req.params.id, 'Personel'), metin(req.body.parola, 'Parola')]));
        res.status(204).end();
    });

    // ---------------------------------------------------------------- ayarlar
    r.get('/yonetim/ayar', async (req, res) => {
        const [a] = await req.vt((q) => q('SELECT giris_ucreti, secim_suresi_dk, kayit_zorunlu, ogrenci_indirim_orani, vip_haftalik_ucret FROM ayar'));
        res.json(a);
    });

    r.patch('/yonetim/ayar', async (req, res) => {
        const alanlar = ['giris_ucreti', 'secim_suresi_dk', 'kayit_zorunlu', 'ogrenci_indirim_orani', 'vip_haftalik_ucret'].filter((s) => req.body[s] !== undefined);
        if (!alanlar.length) throw new HttpHata(400, 'Güncellenecek alan yok');
        const [a] = await req.vt((q) => q(
            `UPDATE ayar SET ${alanlar.map((s, i) => `${s} = $${i + 1}`).join(', ')} RETURNING giris_ucreti, secim_suresi_dk, kayit_zorunlu, ogrenci_indirim_orani, vip_haftalik_ucret`,
            alanlar.map((s) => req.body[s])));
        res.json(a);
    });

    return r;
}
