// Kat yerleşimleri, masa yuvaları, yürünebilir ızgara ve yol bulma (A*).
// Koordinatlar karo cinsinden: gx sağa-aşağı, gy sola-aşağı (izometrik). (0,0) arka köşe.

export const GENISLIK = 14;   // gx
export const DERINLIK = 12;   // gy

// Merdiven her katta aynı yerde: katlar arası geçiş bu karodan yapılır
export const MERDIVEN = { gx: 11, gy: 2 };
export const KAPI = { gx: 0, gy: 9 };   // Kat 1, sol duvar

// Nesne: { tur, gx, gy, gw, gd, h, ... }  (gw/gd karo cinsinden taban, h piksel yükseklik)
// Masa yuvası: { gx, gy, gw, gd, sekil }  — veritabanındaki o kattaki masalar sırayla yuvalara yerleşir
export const KATLAR = {
    1: {
        ad: 'Giriş & Espresso Bar',
        zemin: 'ahsap',
        nesneler: [
            { tur: 'bar', gx: 1, gy: 1, gw: 5, gd: 1, h: 12 },
            { tur: 'espresso', gx: 2, gy: 1, gw: 1, gd: 1, h: 12 },
            { tur: 'kasa', gx: 2, gy: 7, gw: 1, gd: 2, h: 11 },
            { tur: 'koltuk', gx: 5, gy: 11, gw: 4, gd: 1, h: 6 },
            { tur: 'merdiven', gx: 11, gy: 0, gw: 2, gd: 2, h: 0 },
            { tur: 'bitki', gx: 13, gy: 11, gw: 1, gd: 1, h: 10 },
            { tur: 'bitki', gx: 1, gy: 11, gw: 1, gd: 1, h: 10 },
        ],
        masalar: [
            { gx: 5, gy: 4, gw: 1, gd: 1 }, { gx: 9, gy: 4, gw: 1, gd: 1 },
            { gx: 5, gy: 7, gw: 1, gd: 1 }, { gx: 9, gy: 7, gw: 1, gd: 1 },
            { gx: 12, gy: 6, gw: 1, gd: 1 },
        ],
        bar: { gx: 3, gy: 2 },          // garsonun siparişi aldığı nokta
        kasa: { gx: 3, gy: 8 },         // müşterinin ödeme yaptığı nokta
        kasiyer: { gx: 1, gy: 8 },
        bekleme: [                       // masa bekleyen müşterilerin durduğu yerler
            { gx: 5, gy: 10 }, { gx: 6, gy: 10 }, { gx: 7, gy: 10 }, { gx: 8, gy: 10 },
            { gx: 4, gy: 10 }, { gx: 9, gy: 10 }, { gx: 5, gy: 9 }, { gx: 6, gy: 9 },
            { gx: 7, gy: 9 }, { gx: 8, gy: 9 }, { gx: 4, gy: 9 }, { gx: 9, gy: 9 },
        ],
        halilar: [{ gx: 4, gy: 9, gw: 6, gd: 3, renk: 'bekleme' }],
    },
    2: {
        ad: 'Strateji Salonu',
        zemin: 'koyu',
        nesneler: [
            { tur: 'raf', gx: 1, gy: 0, gw: 7, gd: 1, h: 30 },
            { tur: 'raf', gx: 0, gy: 3, gw: 1, gd: 6, h: 30 },
            { tur: 'bar', gx: 10, gy: 9, gw: 3, gd: 1, h: 12 },
            { tur: 'merdiven', gx: 11, gy: 0, gw: 2, gd: 2, h: 0 },
            { tur: 'lamba', gx: 13, gy: 5, gw: 1, gd: 1, h: 22 },
            { tur: 'bitki', gx: 13, gy: 11, gw: 1, gd: 1, h: 10 },
        ],
        masalar: [
            { gx: 3, gy: 3, gw: 2, gd: 1 }, { gx: 7, gy: 3, gw: 2, gd: 1 },
            { gx: 3, gy: 7, gw: 2, gd: 1 }, { gx: 7, gy: 7, gw: 2, gd: 1 },
            { gx: 3, gy: 10, gw: 2, gd: 1 },
        ],
        bar: { gx: 11, gy: 8 },
        halilar: [{ gx: 2, gy: 2, gw: 8, gd: 7, renk: 'salon' }],
    },
    3: {
        ad: 'VIP & FRP Bölgesi',
        zemin: 'hali',
        nesneler: [
            { tur: 'merdiven', gx: 11, gy: 0, gw: 2, gd: 2, h: 0 },
            { tur: 'bar', gx: 10, gy: 9, gw: 3, gd: 1, h: 12 },
            { tur: 'heykel', gx: 1, gy: 1, gw: 1, gd: 1, h: 26 },
            { tur: 'sandik', gx: 13, gy: 5, gw: 1, gd: 2, h: 10 },
            { tur: 'bitki', gx: 1, gy: 11, gw: 1, gd: 1, h: 10 },
        ],
        masalar: [
            { gx: 3, gy: 4, gw: 2, gd: 2, sekil: 'yuvarlak' }, { gx: 7, gy: 4, gw: 2, gd: 2, sekil: 'yuvarlak' },
            { gx: 5, gy: 8, gw: 2, gd: 2, sekil: 'yuvarlak' },
        ],
        bar: { gx: 11, gy: 8 },
        halilar: [{ gx: 2, gy: 3, gw: 8, gd: 8, renk: 'vip' }],
    },
};

// Masanın çevresindeki oturma karoları (kapasite kadarı kullanılır); karşılıklı dengeli sıralanır
export function oturmaYerleri(m) {
    const kuzey = [], guney = [], bati = [], dogu = [];
    for (let x = m.gx; x < m.gx + m.gw; x++) { kuzey.push({ gx: x, gy: m.gy - 1 }); guney.push({ gx: x, gy: m.gy + m.gd }); }
    for (let y = m.gy; y < m.gy + m.gd; y++) { bati.push({ gx: m.gx - 1, gy: y }); dogu.push({ gx: m.gx + m.gw, gy: y }); }
    const sira = [];
    const n = Math.max(kuzey.length, bati.length);
    for (let i = 0; i < n; i++) {
        for (const kenar of [guney, kuzey, dogu, bati]) if (kenar[i]) sira.push(kenar[i]);
    }
    // Büyük masalarda köşeler de kullanılır
    sira.push({ gx: m.gx - 1, gy: m.gy - 1 }, { gx: m.gx + m.gw, gy: m.gy + m.gd },
        { gx: m.gx + m.gw, gy: m.gy - 1 }, { gx: m.gx - 1, gy: m.gy + m.gd });
    return sira;
}

// Kat için engel ızgarası (true = yürünemez)
export function engelIzgarasi(kat) {
    const t = KATLAR[kat];
    const izgara = Array.from({ length: GENISLIK }, () => Array(DERINLIK).fill(false));
    const kapat = (o) => {
        for (let x = o.gx; x < o.gx + o.gw; x++) for (let y = o.gy; y < o.gy + o.gd; y++) {
            if (x >= 0 && y >= 0 && x < GENISLIK && y < DERINLIK) izgara[x][y] = true;
        }
    };
    for (const o of t.nesneler) if (o.tur !== 'merdiven') kapat(o);
    for (const m of t.masalar) kapat(m);
    // Merdiven gövdesi kapalı, giriş karosu (MERDIVEN) açık
    kapat({ gx: 11, gy: 0, gw: 2, gd: 2 });
    return izgara;
}

const IZGARALAR = { 1: engelIzgarasi(1), 2: engelIzgarasi(2), 3: engelIzgarasi(3) };

export function yurunebilir(kat, gx, gy) {
    return gx >= 0 && gy >= 0 && gx < GENISLIK && gy < DERINLIK && !IZGARALAR[kat][gx][gy];
}

// A* (8 yön, köşe kesmeden). Başlangıç veya hedef engelliyse bile (ör. sandalye karosu) yol bulunur.
export function yolBul(kat, bas, hedef) {
    const anahtar = (x, y) => x * 100 + y;
    const bx = Math.round(bas.gx), by = Math.round(bas.gy);
    if (bx === hedef.gx && by === hedef.gy) return [];
    const acik = [{ x: bx, y: by, g: 0, f: 0 }];
    const gelen = new Map();
    const gSkor = new Map([[anahtar(bx, by), 0]]);
    const kapali = new Set();
    const h = (x, y) => Math.max(Math.abs(x - hedef.gx), Math.abs(y - hedef.gy));
    const gecilir = (x, y) => (x === hedef.gx && y === hedef.gy) || yurunebilir(kat, x, y);

    while (acik.length) {
        let ei = 0;
        for (let i = 1; i < acik.length; i++) if (acik[i].f < acik[ei].f) ei = i;
        const c = acik.splice(ei, 1)[0];
        const ck = anahtar(c.x, c.y);
        if (c.x === hedef.gx && c.y === hedef.gy) {
            const yol = [];
            let k = ck;
            while (gelen.has(k)) { yol.unshift({ gx: Math.floor(k / 100), gy: k % 100 }); k = gelen.get(k); }
            return yol;
        }
        if (kapali.has(ck)) continue;
        kapali.add(ck);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy) continue;
            const nx = c.x + dx, ny = c.y + dy;
            if (!gecilir(nx, ny)) continue;
            if (dx && dy && (!gecilir(c.x + dx, c.y) || !gecilir(c.x, c.y + dy))) continue;   // köşe kesme
            const nk = anahtar(nx, ny);
            const g = c.g + (dx && dy ? 1.414 : 1);
            if (g < (gSkor.get(nk) ?? Infinity)) {
                gSkor.set(nk, g);
                gelen.set(nk, ck);
                acik.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
            }
        }
    }
    return [{ gx: hedef.gx, gy: hedef.gy }];   // yol yoksa doğrudan git (sıkışmayı önler)
}
