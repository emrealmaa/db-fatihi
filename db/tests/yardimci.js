// Test yardımcıları. Her test temiz bir veritabanıyla (06_seed verisiyle) başlar.
// DB_SURUCU=pglite ise bellekte PGlite, değilse .env içindeki PostgreSQL kullanılır.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { ayarlar, baglan, kur } from '../lib/veritabani.js';

// 06_seed.sql'deki personel id'leri
export const P = { yonetici: 1, kasiyer: 2, garson: 3, garson2: 4 };

export async function yeniVt() {
    const a = { ...ayarlar(), pgliteDizini: '' };
    if (a.surucu === 'pg') await kur(a);
    const vt = await baglan(a);
    // Kısa yollar: rol adıyla tek sorgu
    for (const rol of ['giris', 'garson', 'kasiyer', 'yonetici', 'admin']) {
        vt[rol] = (sql, params, personelId = P[rol] ?? null) =>
            vt.islem(rol, personelId, (q) => q(sql, params));
    }
    return vt;
}

// Promise'in belirtilen SQLSTATE koduyla ve (verilirse) mesajı içeren bir hatayla düşmesini bekler
export async function hataBekle(promise, { kod, mesaj } = {}) {
    await assert.rejects(promise, (e) => {
        if (kod) assert.equal(e.code, kod, `beklenen kod ${kod}, gelen ${e.code}: ${e.message}`);
        if (mesaj) assert.match(e.message, mesaj);
        return true;
    });
}

export const YETKI_YOK = '42501';
export const CHECK_IHLALI = '23514';
export const UNIQUE_IHLALI = '23505';
