// Kat yerleşimleri, masa yuvaları, yürünebilir ızgara, yol bulma (A*) ve kamera döndürme dönüşümleri.
// Dünya koordinatları karo cinsinden: x (gx) ve y (gy); (0,0) kuzey-batı köşe. Odanın dört duvarı:
// K (y = 0), B (x = 0), G (y = DERINLIK), D (x = GENISLIK). Kamera döndükçe arkada kalan iki duvar çizilir.

export const GENISLIK = 20;   // x
export const DERINLIK = 16;   // y

// Merdiven her katta aynı yerde; katlar arası geçiş giriş karosundan yapılır
export const MERDIVEN = { gx: 17, gy: 2 };
export const MERDIVEN_GOVDE = { gx: 17, gy: 0, gw: 2, gd: 2 };
export const KAPI = { gx: 0, gy: 12 };   // Kat 1, batı duvarı

// Nesne: { tur, gx, gy, gw, gd, h }  (taban karo cinsinden, h piksel yükseklik)
// Masa yuvası: { gx, gy, gw, gd, sekil } — veritabanındaki o kattaki masalar masa_no sırasıyla yuvalara yerleşir
// Duvar dekoru: { tur, duvar: 'K'|'B'|'G'|'D', bas, son } — duvar boyunca karo aralığı
const kat1Masalar = [];
for (const gy of [4, 7]) for (const gx of [5, 8, 11, 14]) kat1Masalar.push({ gx, gy, gw: 1, gd: 1 });
kat1Masalar.push({ gx: 11, gy: 10, gw: 1, gd: 1 }, { gx: 14, gy: 10, gw: 1, gd: 1 });

const kat2Masalar = [];
for (const gx of [3, 7]) for (const gy of [4, 7, 10, 13]) kat2Masalar.push({ gx, gy, gw: 2, gd: 1 });
kat2Masalar.push({ gx: 11, gy: 4, gw: 2, gd: 1 }, { gx: 11, gy: 7, gw: 2, gd: 1 });

export const KATLAR = {
    1: {
        ad: 'Giriş & Espresso Bar',
        zemin: 'ahsap',
        isik: 0,
        nesneler: [
            { tur: 'bar', gx: 1, gy: 1, gw: 7, gd: 1, h: 22 },
            { tur: 'espresso', gx: 2, gy: 1, gw: 1, gd: 1, h: 22 },
            { tur: 'vitrin', gx: 5, gy: 1, gw: 2, gd: 1, h: 22 },
            { tur: 'kasa', gx: 2, gy: 10, gw: 1, gd: 2, h: 20 },
            { tur: 'koltuk', gx: 5, gy: 15, gw: 4, gd: 1, h: 10 },
            { tur: 'bitki', gx: 19, gy: 15, gw: 1, gd: 1, h: 18 },
            { tur: 'bitki', gx: 1, gy: 15, gw: 1, gd: 1, h: 18 },
            { tur: 'bitki', gx: 19, gy: 8, gw: 1, gd: 1, h: 18 },
            { tur: 'tabela', gx: 10, gy: 1, gw: 2, gd: 1, h: 30 },
        ],
        masalar: kat1Masalar,
        bar: { gx: 4, gy: 2 },
        kasa: { gx: 3, gy: 11 },
        kasiyer: { gx: 1, gy: 10 },
        bekleme: [
            { gx: 4, gy: 14 }, { gx: 5, gy: 14 }, { gx: 6, gy: 14 }, { gx: 7, gy: 14 }, { gx: 8, gy: 14 }, { gx: 9, gy: 14 },
            { gx: 4, gy: 13 }, { gx: 5, gy: 13 }, { gx: 6, gy: 13 }, { gx: 7, gy: 13 }, { gx: 8, gy: 13 }, { gx: 9, gy: 13 },
        ],
        halilar: [{ gx: 4, gy: 13, gw: 6, gd: 3, renk: 'bekleme' }, { gx: 0, gy: 12, gw: 2, gd: 1, renk: 'paspas' }],
        duvar: [
            { tur: 'pencere', duvar: 'K', bas: 9, son: 11.5 }, { tur: 'pencere', duvar: 'K', bas: 13, son: 15.5 },
            { tur: 'pencere', duvar: 'B', bas: 3, son: 5.5 }, { tur: 'pencere', duvar: 'B', bas: 6.5, son: 9 },
            { tur: 'kapi', duvar: 'B', bas: 12, son: 13.4 },
            { tur: 'pencere', duvar: 'G', bas: 11, son: 14 }, { tur: 'pencere', duvar: 'D', bas: 5, son: 8 },
            { tur: 'pano', duvar: 'D', bas: 10, son: 12 },
        ],
    },
    2: {
        ad: 'Strateji & Kütüphane Salonu',
        zemin: 'koyu',
        isik: 0.18,
        nesneler: [
            { tur: 'raf', gx: 1, gy: 0, gw: 15, gd: 1, h: 46 },
            { tur: 'raf', gx: 0, gy: 2, gw: 1, gd: 13, h: 46 },
            { tur: 'raf', gx: 19, gy: 5, gw: 1, gd: 8, h: 46 },
            { tur: 'bar', gx: 15, gy: 15, gw: 4, gd: 1, h: 22 },
            { tur: 'lamba', gx: 16, gy: 4, gw: 1, gd: 1, h: 40 },
            { tur: 'lamba', gx: 16, gy: 10, gw: 1, gd: 1, h: 40 },
            { tur: 'bitki', gx: 18, gy: 13, gw: 1, gd: 1, h: 18 },
        ],
        masalar: kat2Masalar,
        bar: { gx: 16, gy: 14 },
        halilar: [{ gx: 2, gy: 3, gw: 12, gd: 12, renk: 'salon' }],
        duvar: [
            { tur: 'pencere', duvar: 'G', bas: 3, son: 6 }, { tur: 'pencere', duvar: 'G', bas: 9, son: 12 },
            { tur: 'afis', duvar: 'D', bas: 2, son: 3.5 }, { tur: 'afis', duvar: 'D', bas: 13.5, son: 15 },
        ],
    },
    3: {
        ad: 'VIP & FRP Özel Bölgesi',
        zemin: 'hali',
        isik: 0.32,
        nesneler: [
            { tur: 'heykel', gx: 1, gy: 1, gw: 1, gd: 1, h: 40 },
            { tur: 'sandik', gx: 18, gy: 6, gw: 1, gd: 2, h: 16 },
            { tur: 'deri', gx: 8, gy: 0, gw: 5, gd: 1, h: 16 },
            { tur: 'deri', gx: 0, gy: 7, gw: 1, gd: 4, h: 16 },
            { tur: 'deri', gx: 19, gy: 10, gw: 1, gd: 3, h: 16 },
            { tur: 'bar', gx: 15, gy: 15, gw: 4, gd: 1, h: 22 },
            { tur: 'lamba', gx: 7, gy: 8, gw: 1, gd: 1, h: 40 },
            { tur: 'lamba', gx: 14, gy: 8, gw: 1, gd: 1, h: 40 },
            { tur: 'bitki', gx: 1, gy: 15, gw: 1, gd: 1, h: 18 },
        ],
        masalar: [
            { gx: 3, gy: 4, gw: 3, gd: 2, sekil: 'harita' }, { gx: 10, gy: 4, gw: 3, gd: 2, sekil: 'yuvarlak' },
            { gx: 3, gy: 11, gw: 3, gd: 2, sekil: 'yuvarlak' }, { gx: 10, gy: 11, gw: 3, gd: 2, sekil: 'harita' },
        ],
        bar: { gx: 16, gy: 14 },
        halilar: [{ gx: 2, gy: 3, gw: 13, gd: 11, renk: 'vip' }],
        duvar: [
            { tur: 'sanc', duvar: 'B', bas: 3, son: 4.2, renk: '#b0302b' }, { tur: 'sanc', duvar: 'K', bas: 4, son: 5.2, renk: '#e3b23c' },
            { tur: 'sanc', duvar: 'K', bas: 14, son: 15.2, renk: '#2e6b4a' }, { tur: 'sanc', duvar: 'G', bas: 7, son: 8.2, renk: '#b0302b' },
            { tur: 'pencere', duvar: 'D', bas: 2, son: 4 }, { tur: 'pano', duvar: 'G', bas: 11, son: 13 },
        ],
    },
};

// ------------------------------------------------------------------ döndürme
// d: 0..3 (90° adımlar). Nokta dönüşümü (sürekli koordinat); döndürülmüş oda boyutları (RW, RH).
export function boyut(d) {
    return d % 2 ? { RW: DERINLIK, RH: GENISLIK } : { RW: GENISLIK, RH: DERINLIK };
}
export function dondur(d, x, y) {
    switch (d) {
        case 1: return { x: DERINLIK - y, y: x };
        case 2: return { x: GENISLIK - x, y: DERINLIK - y };
        case 3: return { x: y, y: GENISLIK - x };
        default: return { x, y };
    }
}
// Dikdörtgen taban (karo aralığı) dönüşümü
export function dikdortgenDondur(d, gx, gy, gw, gd) {
    const a = dondur(d, gx, gy), b = dondur(d, gx + gw, gy + gd);
    return { gx: Math.min(a.x, b.x), gy: Math.min(a.y, b.y), gw: Math.abs(b.x - a.x), gd: Math.abs(b.y - a.y) };
}
// Kamera açısına göre arkada kalan duvarlar: [sol-arka, sağ-arka]
export function arkaDuvarlar(d) {
    return [['B', 'K'], ['G', 'B'], ['D', 'G'], ['K', 'D']][d];
}
// Duvar boyunca t konumundaki noktanın dünya koordinatı
export function duvarNoktasi(duvar, t) {
    return { K: { x: t, y: 0 }, B: { x: 0, y: t }, G: { x: t, y: DERINLIK }, D: { x: GENISLIK, y: t } }[duvar];
}

// ------------------------------------------------------------------ oturma yerleri ve engeller
// Masanın çevresindeki oturma karoları; karşılıklı dengeli sıralanır, sonra köşeler
export function oturmaYerleri(m) {
    const kuzey = [], guney = [], bati = [], dogu = [];
    for (let x = m.gx; x < m.gx + m.gw; x++) { kuzey.push({ gx: x, gy: m.gy - 1 }); guney.push({ gx: x, gy: m.gy + m.gd }); }
    for (let y = m.gy; y < m.gy + m.gd; y++) { bati.push({ gx: m.gx - 1, gy: y }); dogu.push({ gx: m.gx + m.gw, gy: y }); }
    const sira = [];
    const n = Math.max(kuzey.length, bati.length);
    for (let i = 0; i < n; i++) for (const kenar of [guney, kuzey, dogu, bati]) if (kenar[i]) sira.push(kenar[i]);
    sira.push({ gx: m.gx - 1, gy: m.gy - 1 }, { gx: m.gx + m.gw, gy: m.gy + m.gd },
        { gx: m.gx + m.gw, gy: m.gy - 1 }, { gx: m.gx - 1, gy: m.gy + m.gd });
    return sira;
}

function engelIzgarasi(kat) {
    const t = KATLAR[kat];
    const izgara = Array.from({ length: GENISLIK }, () => Array(DERINLIK).fill(false));
    const kapat = (o) => {
        for (let x = o.gx; x < o.gx + o.gw; x++) for (let y = o.gy; y < o.gy + o.gd; y++) {
            if (x >= 0 && y >= 0 && x < GENISLIK && y < DERINLIK) izgara[x][y] = true;
        }
    };
    for (const o of t.nesneler) kapat(o);
    for (const m of t.masalar) kapat(m);
    kapat(MERDIVEN_GOVDE);
    return izgara;
}

const IZGARALAR = { 1: engelIzgarasi(1), 2: engelIzgarasi(2), 3: engelIzgarasi(3) };

export function yurunebilir(kat, gx, gy) {
    return gx >= 0 && gy >= 0 && gx < GENISLIK && gy < DERINLIK && !IZGARALAR[kat][gx][gy];
}

// A* (8 yön, köşe kesmeden). Hedef engelliyse (ör. sandalye) bile hedefe kadar yol bulunur.
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
            if (dx && dy && (!gecilir(c.x + dx, c.y) || !gecilir(c.x, c.y + dy))) continue;
            const nk = anahtar(nx, ny);
            const g = c.g + (dx && dy ? 1.414 : 1);
            if (g < (gSkor.get(nk) ?? Infinity)) {
                gSkor.set(nk, g);
                gelen.set(nk, ck);
                acik.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
            }
        }
    }
    return [{ gx: hedef.gx, gy: hedef.gy }];
}
