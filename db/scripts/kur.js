// Veritabanını sıfırdan kurar: siler, db/postgres/init/*.sql betiklerini sırayla çalıştırır.
// Kullanım: npm run db:kur            (.env içindeki PostgreSQL'e)
//           DB_SURUCU=pglite PGLITE_DIZINI=db/.pglite npm run db:kur   (kurulumsuz, dosyada)
import 'dotenv/config';
import { ayarlar, kur } from '../lib/veritabani.js';

const a = ayarlar();
const hedef = a.surucu === 'pglite'
    ? `PGlite (${a.pgliteDizini || 'bellek'})`
    : `${a.adminKullanici}@${a.host}:${a.port}/${a.database}`;
console.log(`Kuruluyor: ${hedef}`);
try {
    await kur(a, { log: console.log });
    console.log('Tamam.');
} catch (e) {
    console.error(`HATA: ${e.message}`);
    if (e.code === 'ECONNREFUSED') console.error('PostgreSQL çalışıyor mu? .env içindeki POSTGRES_HOST/POSTGRES_PORT doğru mu?');
    if (e.code === '28P01') console.error('Parola hatalı: .env içindeki PG_ADMIN_USER / PG_ADMIN_PASSWORD değerlerini kontrol edin.');
    process.exit(1);
}
