// Ortak veritabanı katmanı: gerçek PostgreSQL (pg) veya kurulum gerektirmeyen PGlite.
// Kurulum betiği, testler ve API aynı arayüzü kullanır:
//   const vt = await baglan();
//   await vt.islem('garson', personelId, async (q) => q('SELECT * FROM v_masa_durumu'));
// Rol, uygulamanın bağlandığı veritabanı rolüdür ('giris' | 'garson' | 'kasiyer' | 'yonetici' | 'admin').
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const INIT_DIZINI = path.join(kok, 'db', 'postgres', 'init');

// 05_security.sql içindeki geliştirme parolaları
const ROL_PAROLALARI = {
    giris: 'giris_dev_pw',
    garson: 'garson_dev_pw',
    kasiyer: 'kasiyer_dev_pw',
    yonetici: 'yonetici_dev_pw',
};
export const ROLLER = Object.keys(ROL_PAROLALARI);

export function ayarlar(env = process.env) {
    return {
        surucu: env.DB_SURUCU || 'pg',
        host: env.POSTGRES_HOST || 'localhost',
        port: Number(env.POSTGRES_PORT || 5432),
        database: env.POSTGRES_DB || 'karavana',
        adminKullanici: env.PG_ADMIN_USER || env.POSTGRES_USER || 'postgres',
        adminParola: env.PG_ADMIN_PASSWORD || env.POSTGRES_PASSWORD || '',
        pgliteDizini: env.PGLITE_DIZINI || '',   // boşsa bellekte
    };
}

export function initDosyalari() {
    return fs.readdirSync(INIT_DIZINI)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()
        .map((f) => ({ ad: f, sql: fs.readFileSync(path.join(INIT_DIZINI, f), 'utf8') }));
}

// ------------------------------------------------------------------ PostgreSQL
async function pgKur(a, { log = () => {} } = {}) {
    const { default: pg } = await import('pg');
    const admin = new pg.Client({ host: a.host, port: a.port, user: a.adminKullanici,
        password: a.adminParola, database: 'postgres' });
    await admin.connect();
    try {
        await admin.query(`DROP DATABASE IF EXISTS ${pgIsim(a.database)} WITH (FORCE)`);
        await admin.query(`CREATE DATABASE ${pgIsim(a.database)}`);
    } finally {
        await admin.end();
    }
    const db = new pg.Client({ host: a.host, port: a.port, user: a.adminKullanici,
        password: a.adminParola, database: a.database });
    await db.connect();
    try {
        for (const f of initDosyalari()) {
            log(`  ${f.ad}`);
            await db.query(f.sql);
        }
    } finally {
        await db.end();
    }
}

async function pgBaglan(a) {
    const { default: pg } = await import('pg');
    const havuzlar = {};
    const havuz = (rol) => {
        if (!havuzlar[rol]) {
            havuzlar[rol] = rol === 'admin'
                ? new pg.Pool({ host: a.host, port: a.port, database: a.database,
                    user: a.adminKullanici, password: a.adminParola, max: 2 })
                : new pg.Pool({ host: a.host, port: a.port, database: a.database,
                    user: `${rol}_app`, password: ROL_PAROLALARI[rol], max: 10 });
        }
        return havuzlar[rol];
    };
    return {
        surucu: 'pg',
        async islem(rol, personelId, fn) {
            rolKontrol(rol);
            const istemci = await havuz(rol).connect();
            try {
                await istemci.query('BEGIN');
                if (personelId != null) {
                    await istemci.query("SELECT set_config('app.personel_id', $1, true)", [String(personelId)]);
                }
                const q = async (sql, params) => (await istemci.query(sql, params)).rows;
                const sonuc = await fn(q);
                await istemci.query('COMMIT');
                return sonuc;
            } catch (e) {
                await istemci.query('ROLLBACK').catch(() => {});
                throw e;
            } finally {
                istemci.release();
            }
        },
        async kapat() {
            await Promise.all(Object.values(havuzlar).map((h) => h.end()));
        },
    };
}

// ------------------------------------------------------------------ PGlite
async function pgliteAc(a, { kur = false, log = () => {} } = {}) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
    const yeni = !a.pgliteDizini || !fs.existsSync(path.join(a.pgliteDizini, 'PG_VERSION'));
    if (kur && a.pgliteDizini && !yeni) {
        fs.rmSync(a.pgliteDizini, { recursive: true, force: true });
    }
    const db = await PGlite.create({ dataDir: a.pgliteDizini || undefined, extensions: { pgcrypto } });
    if (kur || yeni) {
        for (const f of initDosyalari()) {
            log(`  ${f.ad}`);
            await db.exec(f.sql);
        }
    }
    return {
        surucu: 'pglite',
        async islem(rol, personelId, fn) {
            rolKontrol(rol);
            return db.transaction(async (tx) => {
                if (rol !== 'admin') await tx.exec(`SET LOCAL ROLE ${rol}_app`);
                if (personelId != null) {
                    await tx.query("SELECT set_config('app.personel_id', $1, true)", [String(personelId)]);
                }
                const q = async (sql, params) => (await tx.query(sql, params)).rows;
                return fn(q);
            });
        },
        async kapat() {
            await db.close();
        },
    };
}

// ------------------------------------------------------------------ dışa açık
// Veritabanını sıfırdan kurar (siler, init betiklerini sırayla çalıştırır)
export async function kur(a = ayarlar(), secenek = {}) {
    if (a.surucu === 'pglite') {
        const vt = await pgliteAc(a, { ...secenek, kur: true });
        await vt.kapat();
        return;
    }
    await pgKur(a, secenek);
}

// Var olan veritabanına bağlanır. PGlite bellekteyse (veya dizin boşsa) önce kurar.
export async function baglan(a = ayarlar(), secenek = {}) {
    return a.surucu === 'pglite' ? pgliteAc(a, secenek) : pgBaglan(a);
}

function rolKontrol(rol) {
    if (rol !== 'admin' && !ROL_PAROLALARI[rol]) throw new Error(`Bilinmeyen rol: ${rol}`);
}

function pgIsim(ad) {
    if (!/^[a-z_][a-z0-9_]*$/.test(ad)) throw new Error(`Geçersiz veritabanı adı: ${ad}`);
    return ad;
}
