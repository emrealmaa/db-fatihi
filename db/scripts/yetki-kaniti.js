// Yetki ve maskeleme kanıtı: her rolle gerçek sorgular çalıştırır, sonucu docs/YETKI.md'ye yazar.
// Temiz bir veritabanı (<POSTGRES_DB>_yetki) kurar; geliştirme veritabanına dokunmaz.
//   npm run db:yetki   |   npm run db:yetki:lite
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ayarlar, baglan, kur } from '../lib/veritabani.js';

const a = { ...ayarlar(), database: `${ayarlar().database}_yetki`, pgliteDizini: '' };
const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
if (a.surucu === 'pg') await kur(a);
const vt = await baglan(a);

// 06_seed.sql personel id'leri
const PERSONEL = { giris: null, garson: 3, kasiyer: 2, yonetici: 1 };
const ROL_ADI = { giris: 'giris_app', garson: 'garson_app', kasiyer: 'kasiyer_app', yonetici: 'yonetici_app' };

// Her deneme: [açıklama, sql]. Yazma denemeleri geri alınır, veritabanı değişmez.
const DENEMELER = [
    ['Ham müşteri tablosunu okuma', 'SELECT ad, telefon, email FROM kullanici LIMIT 1'],
    ['Maskeli müşteri view\'ı', 'SELECT ad, soyad, telefon, email FROM v_musteri_maskeli LIMIT 1'],
    ['Telefonla müşteri arama', "SELECT ad, soyad, telefon FROM fn_musteri_bul('05321234567')"],
    ['Personel tablosu (parola hash\'i)', 'SELECT kullanici_adi, parola_hash FROM personel LIMIT 1'],
    ['Masa durumu', 'SELECT masa_no, durum FROM v_masa_durumu LIMIT 1'],
    ['Siparişe doğrudan INSERT', 'INSERT INTO siparis (oturum_id, urun_id, personel_id, adet, birim_fiyat) VALUES (1, 1, 3, 1, 0)'],
    ['Ürün fiyatını UPDATE', 'UPDATE urun SET fiyat = 0 WHERE id = 1'],
    ['Prosedürle sipariş (sp_siparis_ver)', 'CALL sp_siparis_ver(1, 3, 1, NULL)'],
    ['Açık hesaplar', 'SELECT masa_no, toplam FROM v_acik_hesaplar LIMIT 1'],
    ['Hesap kapatma (sp_oturum_kapat)', "CALL sp_oturum_kapat(2, 'NAKIT', NULL)"],
    ['Günlük ciro', 'SELECT * FROM v_gunluk_ciro'],
    ['Personel performans raporu', 'SELECT personel, siparis_sayisi FROM v_personel_performans LIMIT 1'],
    ['Personel ekleme (sp_personel_ekle)', "CALL sp_personel_ekle('A','B','05301119999','GARSON','kanit','parola12',NULL,NULL)"],
    ['Parola doğrulama (fn_personel_giris)', "SELECT personel_id, rol FROM fn_personel_giris('garson','karavana123')"],
    // VIP Kulüp: üyelik yalnızca yönetici verir; VIP kuralları rolden bağımsız tetikleyicilerle zorlanır
    ['VIP üyelik verme (sp_musteri_vip)', 'CALL sp_musteri_vip(4, true)'],
    ['VIP oyun raporu', 'SELECT ad, oturum_sayisi FROM v_vip_oyun_kullanimi LIMIT 1'],
    ['Kat bazında gelir raporu', 'SELECT kat, ciro FROM v_kat_gelir LIMIT 1'],
    ['VIP olmayan müşteriye VIP oyun (tetikleyici)',
        "DO $$ DECLARE v int; BEGIN SELECT id INTO v FROM oyun WHERE ad = 'Spirit Island'; CALL sp_oyun_baslat(3, v, NULL); END $$"],
    ['VIP olmayan müşteriyi VIP kata oturtma (tetikleyici)', 'CALL sp_oturum_ac(5, 2, 4, NULL)'],
];

class GeriAl extends Error {
    constructor(satirlar) { super('geri al'); this.satirlar = satirlar; }
}

async function dene(rol, sql) {
    try {
        await vt.islem(rol, PERSONEL[rol], async (q) => { throw new GeriAl(await q(sql)); });
    } catch (e) {
        if (e instanceof GeriAl) return { ok: true, satirlar: e.satirlar };
        return { ok: false, hata: e.message };
    }
    return { ok: true, satirlar: [] };
}

const roller = Object.keys(ROL_ADI);
const sonuc = {};
for (const [aciklama, sql] of DENEMELER) {
    sonuc[aciklama] = { sql };
    for (const rol of roller) sonuc[aciklama][rol] = await dene(rol, sql);
}
await vt.kapat();

const hucre = (r) => (r.ok ? '✅' : '⛔');
const ornek = (r) => (r.ok
    ? (r.satirlar.length ? `\`${JSON.stringify(r.satirlar[0])}\`` : 'çalıştı')
    : `⛔ ${r.hata}`);

const rapor = `# Yetkilendirme ve maskeleme kanıtı

> Bu dosya \`npm run db:yetki\` ile otomatik üretilir: her satır, ilgili rolle veritabanına bağlanıp
> gerçekten çalıştırılan bir sorgunun sonucudur. Yazma denemeleri geri alınır.
> Son çalıştırma: ${new Date().toLocaleString('tr-TR')} · ${a.surucu === 'pglite' ? 'PGlite' : 'PostgreSQL'}

## Özet matris
✅ izin verildi · ⛔ veritabanı reddetti

| İşlem | ${roller.map((r) => ROL_ADI[r]).join(' | ')} |
|---|${roller.map(() => ':---:').join('|')}|
${DENEMELER.map(([ac]) => `| ${ac} | ${roller.map((r) => hucre(sonuc[ac][r])).join(' | ')} |`).join('\n')}

## Maskeleme: aynı müşteri, farklı roller
| Rol | Sonuç |
|---|---|
${roller.map((r) => `| ${ROL_ADI[r]} (ham tablo) | ${ornek(sonuc['Ham müşteri tablosunu okuma'][r])} |`).join('\n')}
${roller.map((r) => `| ${ROL_ADI[r]} (maskeli view) | ${ornek(sonuc['Maskeli müşteri view\'ı'][r])} |`).join('\n')}

## Ayrıntı
${DENEMELER.map(([ac]) => `### ${ac}
\`\`\`sql
${sonuc[ac].sql}
\`\`\`
${roller.map((r) => `- **${ROL_ADI[r]}:** ${ornek(sonuc[ac][r])}`).join('\n')}
`).join('\n')}`;
fs.writeFileSync(path.join(kok, 'docs', 'YETKI.md'), rapor);
console.log('docs/YETKI.md yazıldı.');
