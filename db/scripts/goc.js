// Mevcut veritabanını silmeden eklemeli migration'ları (07 ve sonrası) uygular.
// Kullanım: npm run db:goc
import 'dotenv/config';
import { ayarlar, goc, GOC_BASLANGIC } from '../lib/veritabani.js';

const a = ayarlar();
console.log(`Göç (${String(GOC_BASLANGIC).padStart(2, '0')}_* ve sonrası): ${a.surucu === 'pglite' ? `PGlite (${a.pgliteDizini})` : `${a.adminKullanici}@${a.host}:${a.port}/${a.database}`}`);
try {
    await goc(a, { log: console.log });
    console.log('Tamam.');
} catch (e) {
    console.error(`HATA: ${e.message}`);
    process.exit(1);
}
