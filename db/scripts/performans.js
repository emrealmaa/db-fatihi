// Index performans kanıtı: büyük sentetik veri üretir, kritik sorguları index'li ve index'siz
// EXPLAIN ANALYZE ile ölçer, sonucu docs/PERFORMANS.md'ye yazar.
// Geliştirme veritabanına dokunmaz: ayrı bir veritabanı (<POSTGRES_DB>_perf) kurar.
//   npm run db:performans            (PostgreSQL)
//   npm run db:performans:lite       (PGlite; süreler WASM'da ölçülür, yalnızca göstergedir)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ayarlar, baglan, kur } from '../lib/veritabani.js';

const OLCEK = Number(process.env.PERF_OTURUM || 100000);   // kapanmış oturum sayısı
const TEKRAR = 5;                                           // her ölçüm kaç kez (medyan alınır)

const a = { ...ayarlar(), database: `${ayarlar().database}_perf`, pgliteDizini: '' };
const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

console.log(`Kuruluyor: ${a.surucu === 'pglite' ? 'PGlite (bellek)' : `${a.host}:${a.port}/${a.database}`}`);
if (a.surucu === 'pg') await kur(a);
const vt = await baglan(a);
const admin = (sql, p) => vt.islem('admin', null, (q) => q(sql, p));

// ------------------------------------------------------------------ veri üretimi
console.log(`Veri üretiliyor (${OLCEK} oturum)…`);
const t0 = Date.now();
await vt.islem('admin', null, async (q) => {
    // Geçmiş kayıtlar iş kuralı tetikleyicilerinden geçmez (ör. "oturum açık olmalı")
    await q('ALTER TABLE oturum DISABLE TRIGGER USER');
    await q('ALTER TABLE oturum_oyun DISABLE TRIGGER USER');
    await q('ALTER TABLE siparis DISABLE TRIGGER USER');

    await q(`INSERT INTO masa (masa_no, kapasite)
             SELECT 100 + g, 2 + (g % 7) FROM generate_series(1, 40) g`);
    await q(`INSERT INTO kullanici (ad, soyad, telefon, email)
             SELECT 'Musteri' || g, 'Soyad' || g, '05' || lpad(g::text, 9, '0'), 'm' || g || '@ornek.com'
             FROM generate_series(1, ${Math.round(OLCEK / 10)}) g`);
    await q(`INSERT INTO oyun (ad, kategori_id, min_oyuncu, max_oyuncu, sure_dk, toplam_adet)
             SELECT 'Oyun ' || g, 1 + g % 5, 2, 6, 30 + g % 60, 1 + g % 3 FROM generate_series(1, 290) g`);

    // Son iki yıla yayılmış kapanmış oturumlar
    await q(`INSERT INTO oturum (masa_id, kullanici_id, personel_id, kisi_sayisi, giris_ucreti, acilis, kapanis)
             SELECT m.id, 1 + (g * 7919) % ${Math.round(OLCEK / 10)}, 3, least(m.kapasite, 2 + g % 4), 100, t, t + interval '150 minutes'
             FROM generate_series(1, ${OLCEK}) g
             CROSS JOIN LATERAL (SELECT now() - (g::double precision / ${OLCEK}) * interval '730 days' - interval '1 day' AS t) z
             JOIN masa m ON m.id = 1 + g % (SELECT count(*) FROM masa)`);
    await q(`INSERT INTO oturum_oyun (oturum_id, oyun_id, baslangic, bitis)
             SELECT t.id, 1 + (t.id * 31) % (SELECT count(*) FROM oyun), t.acilis + interval '10 minutes', t.kapanis - interval '10 minutes'
             FROM oturum t WHERE t.kapanis IS NOT NULL`);
    await q(`INSERT INTO siparis (oturum_id, urun_id, personel_id, adet, birim_fiyat, zaman)
             SELECT t.id, 1 + (t.id * k) % 10, 3 + k % 2, 1 + k % 3, 50, t.acilis + k * interval '20 minutes'
             FROM oturum t CROSS JOIN generate_series(1, 4) k WHERE t.kapanis IS NOT NULL`);
    await q(`INSERT INTO odeme (oturum_id, personel_id, tur, tutar, zaman)
             SELECT t.id, 2, CASE WHEN t.id % 3 = 0 THEN 'NAKIT' ELSE 'KART' END, 500, t.kapanis
             FROM oturum t WHERE t.kapanis IS NOT NULL`);
    // Gerçekte aktif sıra en yeni kayıtlardır: seed'deki aktif kaydı geçmişin arkasına taşı
    await q(`UPDATE bekleme SET durum = 'IPTAL', secim_hakki_zamani = NULL WHERE durum IN ('BEKLIYOR', 'SECIM_HAKKI')`);
    await q(`INSERT INTO bekleme (oturum_id, durum, olusturma)
             SELECT t.id, 'TAMAMLANDI', t.acilis FROM oturum t WHERE t.kapanis IS NOT NULL AND t.id % 4 = 0`);
    await q(`INSERT INTO bekleme (oturum_id) SELECT id FROM oturum WHERE kapanis IS NULL ORDER BY id LIMIT 1`);

    await q('ALTER TABLE oturum ENABLE TRIGGER USER');
    await q('ALTER TABLE oturum_oyun ENABLE TRIGGER USER');
    await q('ALTER TABLE siparis ENABLE TRIGGER USER');
});
await admin('ANALYZE');
const sayilar = (await admin(`SELECT (SELECT count(*) FROM oturum) AS oturum, (SELECT count(*) FROM oturum_oyun) AS oturum_oyun,
    (SELECT count(*) FROM siparis) AS siparis, (SELECT count(*) FROM odeme) AS odeme,
    (SELECT count(*) FROM bekleme) AS bekleme, (SELECT count(*) FROM kullanici) AS kullanici`))[0];
console.log(`Veri hazır (${((Date.now() - t0) / 1000).toFixed(1)} sn):`, sayilar);

// ------------------------------------------------------------------ ölçümler
const OLCUMLER = [
    {
        ad: 'Bir oyunun masadaki kopyaları (fn_musait_adet)',
        // Aynı koşulu kapsayan diğer kısmi index de düşürülür, yoksa planlayıcı ona geçer
        index: ['ix_oturum_oyun_aktif_oyun', 'uq_oturum_oyun_aktif'],
        sql: 'SELECT count(*) FROM oturum_oyun WHERE oyun_id = 1 AND bitis IS NULL',
        neden: 'Her oyun listesinde her oyun için çalışır; geçmiş kayıtlar büyüdükçe tam tarama pahalılaşır. Kısmi index yalnızca aktif (bitis IS NULL) satırları içerir.',
    },
    {
        ad: 'Masanın açık oturumu',
        index: 'uq_oturum_masa_acik',
        sql: 'SELECT id FROM oturum WHERE masa_id = 1 AND kapanis IS NULL',
        neden: 'Masa panosu ve masa açma kontrolü. Kısmi UNIQUE index hem kuralı (masada tek açık oturum) hem aramayı sağlar.',
    },
    {
        ad: 'Bir hesabın siparişleri',
        index: 'ix_siparis_oturum',
        sql: 'SELECT sum(adet * birim_fiyat) FROM siparis WHERE oturum_id = 4242',
        neden: 'Hesap dökümü ve açık hesaplar view\'ı her masa için çalıştırır.',
    },
    {
        ad: 'Son 7 günün cirosu',
        index: 'ix_odeme_zaman',
        sql: "SELECT zaman::date, sum(tutar) FROM odeme WHERE zaman >= now() - interval '7 days' GROUP BY 1",
        neden: 'Kasa ekranı ve ciro raporu; tarih aralığı index ile doğrudan bulunur.',
    },
    {
        ad: 'Bekleme sırasındaki ilk masa',
        index: ['ix_bekleme_sira', 'uq_bekleme_oturum_aktif', 'uq_bekleme_tek_hak'],
        sql: "SELECT id FROM bekleme WHERE durum = 'BEKLIYOR' ORDER BY id LIMIT 1",
        neden: 'Her oyun iadesinde çalışır (sp_sirayi_ilerlet). Geçmiş kayıtlar binlerce olsa da aktif sıra birkaç satırdır.',
    },
    {
        ad: 'Müşterinin geçmiş ziyaretleri',
        index: 'ix_oturum_kullanici',
        sql: 'SELECT count(*), max(acilis) FROM oturum WHERE kullanici_id = 77',
        neden: 'Müşteri geçmişi ve FK silme kontrolü.',
    },
];

async function olc(q, sql) {
    const sureler = [];
    let plan = '';
    for (let i = 0; i < TEKRAR; i++) {
        const [r] = await q(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`);
        const j = r['QUERY PLAN'];
        const kok = (typeof j === 'string' ? JSON.parse(j) : j)[0];
        sureler.push(kok['Execution Time']);
        plan = planOzeti(kok.Plan);
    }
    sureler.sort((x, y) => x - y);
    return { sure: sureler[Math.floor(TEKRAR / 2)], plan };
}

// Planın tarama düğümlerini kısaca yaz: "Index Only Scan (ix_...)"
function planOzeti(p) {
    const dugumler = [];
    (function gez(n) {
        if (/Scan/.test(n['Node Type'])) dugumler.push(n['Index Name'] ? `${n['Node Type']} (${n['Index Name']})` : `${n['Node Type']} (${n['Relation Name']})`);
        for (const c of n.Plans || []) gez(c);
    })(p);
    return dugumler.join(' + ');
}

// Index'siz ölçüm: index transaction içinde düşürülür, sonuç bir hatayla taşınıp transaction geri alınır
class GeriAl extends Error {
    constructor(sonuc) { super('geri al'); this.sonuc = sonuc; }
}

const sonuclar = [];
for (const o of OLCUMLER) {
    const ile = await vt.islem('admin', null, (q) => olc(q, o.sql));
    const siz = await vt.islem('admin', null, async (q) => {
        for (const ix of [o.index].flat()) await q(`DROP INDEX ${ix}`);
        throw new GeriAl(await olc(q, o.sql));
    }).catch((e) => { if (e instanceof GeriAl) return e.sonuc; throw e; });
    sonuclar.push({ ...o, ile, siz });
    console.log(`${o.ad}: ${ile.sure.toFixed(3)} ms (index'li) / ${siz.sure.toFixed(3)} ms (index'siz)`);
}
await vt.kapat();

// ------------------------------------------------------------------ rapor
const ortam = a.surucu === 'pglite'
    ? 'PGlite (WebAssembly, tek iş parçacığı). Süreler gerçek PostgreSQL\'den farklıdır; oranlar ve planlar göstergedir.'
    : `PostgreSQL (${a.host}:${a.port}).`;
const kat = (r) => (r.siz.sure / Math.max(r.ile.sure, 0.001));
const rapor = `# Sorgu performansı: index kanıtları

> Bu dosya \`npm run db:performans\` ile otomatik üretilir. Son çalıştırma: ${new Date().toLocaleString('tr-TR')}
> Ortam: ${ortam}

## Veri hacmi
| Tablo | Satır |
|---|---:|
${Object.entries(sayilar).map(([t, n]) => `| ${t} | ${Number(n).toLocaleString('tr-TR')} |`).join('\n')}

Veri son iki yıla yayılmış kapanmış oturumlardan oluşur (her oturumda 1 oyun, 4 sipariş, 1 ödeme).
Her sorgu ${TEKRAR} kez çalıştırılıp **medyan** süre alındı. Index'siz ölçümde index bir transaction içinde
düşürülüp ölçüm sonrası geri alındı (\`DROP INDEX\` + \`ROLLBACK\`).

## Özet
| Sorgu | Index | Index'li (ms) | Index'siz (ms) | Kat |
|---|---|---:|---:|---:|
${sonuclar.map((r) => `| ${r.ad} | ${[r.index].flat().map((x) => `\`${x}\``).join(', ')} | ${r.ile.sure.toFixed(3)} | ${r.siz.sure.toFixed(3)} | ${kat(r).toFixed(1)}× |`).join('\n')}

## Ayrıntı
${sonuclar.map((r) => `### ${r.ad}
\`\`\`sql
${r.sql}
\`\`\`
- **Neden önemli:** ${r.neden}
- **Index'li plan:** ${r.ile.plan}
- **Index'siz plan:** ${r.siz.plan}
`).join('\n')}`;
fs.writeFileSync(path.join(kok, 'docs', 'PERFORMANS.md'), rapor);
console.log('docs/PERFORMANS.md yazıldı.');
