// Kat yerleşimleri, masa yuvaları, yürünebilir ızgara, yol bulma (A*) ve kamera döndürme dönüşümleri.
// Dünya koordinatları karo cinsinden: x (gx) ve y (gy); (0,0) kuzey-batı köşe. Dünya 20x20: iç mekân
// y = 0..IC_DERINLIK, önünde (yalnızca kat 1'de) cephe şeridi, kaldırım ve sokak. Odanın dört duvarı:
// K (y = 0), B (x = 0), G (y = IC_DERINLIK, ön cephe), D (x = GENISLIK). Kamera döndükçe arkada kalan iki duvar çizilir.

export const GENISLIK = 20;      // x
export const DERINLIK = 20;      // y (dünya)
export const IC_DERINLIK = 16;   // iç mekân derinliği

// Merdiven her katta aynı yerde; katlar arası geçiş giriş karosundan yapılır
export const MERDIVEN = { gx: 17, gy: 2 };
export const MERDIVEN_GOVDE = { gx: 17, gy: 0, gw: 2, gd: 2 };
// Kat 1 girişi: ön cephedeki kapı (x = 2..3). KAPI kaldırımdaki kapı önü, KAPI_IC içerideki ilk karo.
export const KAPI = { gx: 2, gy: 17 };
export const KAPI_IC = { gx: 2, gy: 15 };
export const KAPI_ARALIK = { bas: 2, son: 4 };
export const KALDIRIM_Y = 17;
export const SOKAK_Y = 18;
export const SOKAK_GIRIS = { gx: 19, gy: SOKAK_Y };   // müşteriler sağdan gelir,
export const SOKAK_CIKIS = { gx: 0, gy: SOKAK_Y };    // soldan gider
// Kaldırımdaki tek sıra kuyruk: kapıya en yakın yer önce
export const DIS_SIRA = Array.from({ length: 15 }, (_, i) => ({ gx: 4 + i, gy: KALDIRIM_Y }));

// Nesne: { tur, gx, gy, gw, gd, h }  (taban karo cinsinden, h piksel yükseklik)
// Masa yuvası: { gx, gy, gw, gd, sekil } — veritabanındaki o kattaki masalar masa_no sırasıyla yuvalara yerleşir
// Duvar dekoru: { tur, duvar: 'K'|'B'|'G'|'D', bas, son } — duvar boyunca karo aralığı
// Organik yerleşim: masalar elle, düzensiz konumlara yerleştirildi; her masanın sandalye halkası ile
// komşusununki arasında en az bir karo yürüme boşluğu var. 1x1 masa 2 veya 4 kişilik, 2x1 masa 6 kişiliktir;
// veritabanındaki masalar kapasitelerine uyan yuvaya yerleşir (motor.js).
const kat1Masalar = [
    { gx: 4, gy: 4, gw: 1, gd: 1 }, { gx: 8, gy: 3, gw: 2, gd: 1 }, { gx: 13, gy: 4, gw: 1, gd: 1 },
    { gx: 17, gy: 5, gw: 1, gd: 1 }, { gx: 2, gy: 9, gw: 1, gd: 1 }, { gx: 6, gy: 9, gw: 2, gd: 1 },
    { gx: 11, gy: 8, gw: 1, gd: 1 }, { gx: 16, gy: 9, gw: 1, gd: 1 }, { gx: 13, gy: 13, gw: 1, gd: 1 },
    { gx: 17, gy: 13, gw: 1, gd: 1 },
];

const kat2Masalar = [
    { gx: 3, gy: 3, gw: 2, gd: 1 }, { gx: 8, gy: 4, gw: 1, gd: 1 }, { gx: 12, gy: 3, gw: 2, gd: 1 },
    { gx: 4, gy: 8, gw: 1, gd: 1 }, { gx: 8, gy: 8, gw: 2, gd: 1 }, { gx: 13, gy: 7, gw: 1, gd: 1 },
    { gx: 17, gy: 7, gw: 1, gd: 1 }, { gx: 3, gy: 12, gw: 2, gd: 1 }, { gx: 8, gy: 12, gw: 1, gd: 1 },
    { gx: 13, gy: 12, gw: 2, gd: 1 },
];

export const KATLAR = {
    1: {
        ad: 'Giriş & Espresso Bar',
        zemin: 'ahsap',
        isik: 0,
        nesneler: [
            { tur: 'arkaraf', gx: 1, gy: 0, gw: 7, gd: 1, h: 44 },
            { tur: 'bar', gx: 1, gy: 1, gw: 7, gd: 1, h: 22 },
            { tur: 'pasta', gx: 7, gy: 1, gw: 1, gd: 1, h: 22 },
            { tur: 'espresso', gx: 2, gy: 1, gw: 1, gd: 1, h: 22 },
            { tur: 'vitrin', gx: 5, gy: 1, gw: 2, gd: 1, h: 22 },
            { tur: 'kasa', gx: 1, gy: 12, gw: 1, gd: 2, h: 20 },
            { tur: 'koltuk', gx: 6, gy: 15, gw: 4, gd: 1, h: 10 },
            { tur: 'bitki', gx: 19, gy: 15, gw: 1, gd: 1, h: 18 },
            { tur: 'bitki', gx: 1, gy: 15, gw: 1, gd: 1, h: 18 },
            { tur: 'bitki', gx: 19, gy: 8, gw: 1, gd: 1, h: 18 },
            { tur: 'tabela', gx: 10, gy: 1, gw: 2, gd: 1, h: 30 },
        ],
        masalar: kat1Masalar,
        bar: { gx: 4, gy: 2 },
        kasa: { gx: 2, gy: 12 },
        kasiyer: { gx: 0, gy: 12 },
        bekleme: [
            { gx: 5, gy: 14 }, { gx: 6, gy: 14 }, { gx: 7, gy: 14 }, { gx: 8, gy: 14 }, { gx: 9, gy: 14 }, { gx: 10, gy: 14 },
            { gx: 5, gy: 13 }, { gx: 6, gy: 13 }, { gx: 7, gy: 13 }, { gx: 8, gy: 13 }, { gx: 9, gy: 13 }, { gx: 10, gy: 13 },
        ],
        halilar: [{ gx: 5, gy: 13, gw: 6, gd: 3, renk: 'bekleme' }, { gx: 2, gy: 15, gw: 2, gd: 1, renk: 'paspas' }],
        duvar: [
            { tur: 'pencere', duvar: 'K', bas: 9, son: 11.5 }, { tur: 'poster', duvar: 'K', bas: 12.3, son: 13.8, oyun: 'catan' },
            { tur: 'poster', duvar: 'K', bas: 14.4, son: 15.9, oyun: 'tren' },
            { tur: 'pencere', duvar: 'B', bas: 2.5, son: 5 }, { tur: 'poster', duvar: 'B', bas: 6, son: 7.5, oyun: 'carcassonne' },
            { tur: 'pano', duvar: 'B', bas: 8.5, son: 10.5 },
            { tur: 'kapi', duvar: 'G', bas: 2, son: 4 }, { tur: 'pencere', duvar: 'G', bas: 6, son: 9 },
            { tur: 'pencere', duvar: 'G', bas: 11, son: 14 }, { tur: 'pencere', duvar: 'D', bas: 5, son: 8 },
            { tur: 'poster', duvar: 'D', bas: 10, son: 11.5, oyun: 'dixit' },
        ],
        // Dış mekân (yalnızca ön cephe kameraya dönükken görünür): cephe şeridindeki süs nesneleri
        dis: [
            { tur: 'saksi', gx: 5, gy: 16.35, gw: 0.6, gd: 0.5, h: 8 }, { tur: 'bank', gx: 8, gy: 16.35, gw: 2, gd: 0.5, h: 7 },
            { tur: 'saksi', gx: 12, gy: 16.35, gw: 0.6, gd: 0.5, h: 8 }, { tur: 'menutahta', gx: 4.2, gy: 16.4, gw: 0.5, gd: 0.4, h: 18 },
            { tur: 'lamba', gx: 16, gy: 16.4, gw: 1, gd: 0.5, h: 44 },
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
            // raf üstündeki duvara asılı posterler (ust: rafın üstünde kalacak yükseklik)
            { tur: 'poster', duvar: 'K', bas: 3, son: 4.5, oyun: 'dixit', ust: true },
            { tur: 'poster', duvar: 'K', bas: 7.5, son: 9, oyun: 'pandemic', ust: true },
            { tur: 'poster', duvar: 'K', bas: 12, son: 13.5, oyun: 'catan', ust: true },
            { tur: 'poster', duvar: 'B', bas: 5, son: 6.5, oyun: 'tren', ust: true },
            { tur: 'poster', duvar: 'B', bas: 10, son: 11.5, oyun: 'carcassonne', ust: true },
            { tur: 'pencere', duvar: 'G', bas: 3, son: 6 }, { tur: 'pencere', duvar: 'G', bas: 9, son: 12 },
            { tur: 'afis', duvar: 'D', bas: 2, son: 3.5 }, { tur: 'poster', duvar: 'D', bas: 14, son: 15.5, oyun: 'pandemic', ust: true },
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
            { tur: 'poster', duvar: 'K', bas: 9, son: 11.5, oyun: 'harita', ust: true },
            { tur: 'poster', duvar: 'B', bas: 12, son: 14.5, oyun: 'harita' },
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
    return { K: { x: t, y: 0 }, B: { x: 0, y: t }, G: { x: t, y: IC_DERINLIK }, D: { x: GENISLIK, y: t } }[duvar];
}
// Ön cephe (G) kameraya dönükse (önde kalıyorsa) dış mekân çizilir
export function disGorunur(d) {
    return !arkaDuvarlar(d).includes('G');
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
    // İç mekân dışı: üst katlarda tamamen kapalı; kat 1'de cephe şeridi yalnızca kapıdan geçilir,
    // kaldırım ve yakın şerit yürünebilir, uzak şerit kapalı
    for (let x = 0; x < GENISLIK; x++) for (let y = IC_DERINLIK; y < DERINLIK; y++) {
        const acik = kat === 1 && ((y === IC_DERINLIK && x >= KAPI_ARALIK.bas && x < KAPI_ARALIK.son) || y === KALDIRIM_Y || y === SOKAK_Y);
        if (!acik) izgara[x][y] = true;
    }
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
