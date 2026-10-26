// API sunucusu. Ayarlar kök dizindeki .env dosyasından okunur.
//   npm run dev -w app/api          (PostgreSQL, .env)
//   DB_SURUCU=pglite npm run dev -w app/api   (kurulumsuz; veriler PGLITE_DIZINI'nde kalır)
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ayarlar, baglan } from '../../../db/lib/veritabani.js';
import { uygulamaOlustur } from './uygulama.js';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
dotenv.config({ path: path.join(kok, '.env') });

const a = ayarlar();
if (a.pgliteDizini && !path.isAbsolute(a.pgliteDizini)) a.pgliteDizini = path.join(kok, a.pgliteDizini);
const port = Number(process.env.API_PORT || 3001);
const gizliAnahtar = process.env.JWT_GIZLI || 'karavana-gelistirme-anahtari';
if (!process.env.JWT_GIZLI) console.warn('Uyarı: JWT_GIZLI tanımlı değil, geliştirme anahtarı kullanılıyor.');

const vt = await baglan(a, { log: (m) => console.log(`PGlite kuruluyor:${m}`) });
const app = uygulamaOlustur({ vt, gizliAnahtar, webDizini: path.join(kok, 'app', 'web', 'dist') });

// Seçim süresi dolan masaları sıranın sonuna atan zamanlayıcı
const ZAMANLAYICI_MS = Number(process.env.SECIM_KONTROL_MS || 15000);
const zamanlayici = setInterval(() => {
    vt.islem('garson', null, (q) => q('CALL sp_secim_suresi_doldur(NULL)'))
        .catch((e) => console.error('Seçim süresi kontrolü başarısız:', e.message));
}, ZAMANLAYICI_MS);

const sunucu = app.listen(port, () => {
    console.log(`Karavana API http://localhost:${port} (${vt.surucu === 'pglite' ? `PGlite: ${a.pgliteDizini || 'bellek'}` : `${a.host}:${a.port}/${a.database}`})`);
});

async function kapat() {
    clearInterval(zamanlayici);
    sunucu.close();
    await vt.kapat();
    process.exit(0);
}
process.on('SIGINT', kapat);
process.on('SIGTERM', kapat);
