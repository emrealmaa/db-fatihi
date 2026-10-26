// Express uygulaması. Testler bunu doğrudan, sunucu (sunucu.js) gerçek bağlantıyla kullanır.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { kimlikModulu } from './kimlik.js';
import { hataIsleyici, HttpHata } from './hatalar.js';
import { salonRotalari } from './rotalar/salon.js';
import { kasaRotalari } from './rotalar/kasa.js';
import { yonetimRotalari } from './rotalar/yonetim.js';

export function uygulamaOlustur({ vt, gizliAnahtar, webDizini, log = console.error }) {
    const app = express();
    const { girisYap, kimlikGerekli, enAz } = kimlikModulu({ vt, gizliAnahtar });

    app.use(express.json({ limit: '100kb' }));

    app.get('/api/saglik', (req, res) => res.json({ durum: 'ok', surucu: vt.surucu }));

    app.post('/api/giris', async (req, res) => {
        res.json(await girisYap(req.body?.kullaniciAdi, req.body?.parola));
    });

    app.use('/api', kimlikGerekli);
    app.get('/api/ben', (req, res) => res.json(req.personel));
    app.use('/api', salonRotalari());
    app.use('/api', enAz('KASIYER'), kasaRotalari());
    app.use('/api', enAz('YONETICI'), yonetimRotalari());
    app.use('/api', (req, res, next) => next(new HttpHata(404, 'Böyle bir uç yok')));

    // Derlenmiş ön yüz (npm run build sonrası) aynı sunucudan verilir
    if (webDizini && fs.existsSync(path.join(webDizini, 'index.html'))) {
        app.use(express.static(webDizini));
        app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(webDizini, 'index.html')));
    }

    app.use(hataIsleyici(log));
    return app;
}
