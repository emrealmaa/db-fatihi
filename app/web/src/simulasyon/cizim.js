// Piksel-art izometrik çizim. Sahne düşük çözünürlüklü bir tuvale (DOGAL_G x DOGAL_Y) çizilir ve
// tam sayı katsayıyla büyütülür; yazılar/baloncuklar büyütülmüş tuvalde keskin çizilir.
// Tüm şekiller fillRect ile satır/sütun çizildiğinden kenarlar bulanıklaşmaz.
import { DERINLIK, GENISLIK, KATLAR, KAPI, MERDIVEN } from './harita.js';

const KX = 16, KY = 8;                  // yarım karo genişliği / yüksekliği
const DUVAR = 56;                        // duvar yüksekliği (piksel)
const OX = DERINLIK * KX + 8;
const OY = DUVAR + 12;
export const DOGAL_G = (GENISLIK + DERINLIK) * KX + 16;
export const DOGAL_Y = OY + (GENISLIK + DERINLIK) * KY + 20;

export const izo = (gx, gy) => ({ x: OX + (gx - gy) * KX, y: OY + (gx + gy) * KY });

// ------------------------------------------------------------------ renkler
const ZEMIN = {
    ahsap: ['#b9824f', '#ad7746', '#c48c58'],
    koyu: ['#5b4636', '#523f31', '#64503f'],
    hali: ['#7a2f3f', '#70293a', '#843646'],
};
const HALI = { bekleme: ['#d9a65b', '#cf9a4f'], salon: ['#3f5a4a', '#385142'], vip: ['#4b2c5e', '#432656'] };
const DUVAR_RENK = {
    1: { ust: '#f1dfbf', alt: '#9b6a3f', serit: '#e6cfa6' },
    2: { ust: '#6d7f66', alt: '#4a3626', serit: '#62735c' },
    3: { ust: '#5d3b6e', alt: '#3a2232', serit: '#53335f' },
};
export const OYUN_RENK = ['#d94f3d', '#3d7fd9', '#e3b23c', '#4caf6a', '#9b59b6', '#e07b39', '#2bb0a8', '#c2185b', '#7cb342', '#5c6bc0'];

// ------------------------------------------------------------------ temel şekiller
// Izgara karosu (elmas), satır satır
function elmas(c, gx, gy, renk) {
    const { x, y } = izo(gx, gy);
    c.fillStyle = renk;
    for (let r = 0; r < KY * 2; r++) {
        const w = (r < KY ? r + 1 : KY * 2 - r) * 2;
        c.fillRect(x - w, y + r, w * 2, 1);
    }
}

const dogruY = (a, b, x) => a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);

// İzometrik kutu: üst yüz + iki yan yüz, sütun sütun. z: yerden yükseklik
export function kutu(c, gx, gy, gw, gd, h, renk, z = 0) {
    const T = izo(gx, gy), R = izo(gx + gw, gy), B = izo(gx + gw, gy + gd), L = izo(gx, gy + gd);
    for (let x = Math.round(L.x); x < Math.round(R.x); x++) {
        const px = x + 0.5;
        const ust = Math.round(px < T.x ? dogruY(L, T, px) : dogruY(T, R, px));
        const alt = Math.round(px < B.x ? dogruY(L, B, px) : dogruY(B, R, px));
        c.fillStyle = renk.ust;
        c.fillRect(x, ust - h - z, 1, alt - ust);
        if (h > 0) {
            c.fillStyle = px < B.x ? renk.sol : renk.sag;
            c.fillRect(x, alt - h - z, 1, h);
        }
        if (renk.kenar) { c.fillStyle = renk.kenar; c.fillRect(x, ust - h - z, 1, 1); }
    }
}

const ton = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const renkler = (hex) => ({ ust: hex, sol: ton(hex, 0.78), sag: ton(hex, 0.62), kenar: ton(hex, 1.15) });

// ------------------------------------------------------------------ karakterler
// 8x14 sprite; harfler paletten renk alır
const GOVDE = [
    '..hhhh..', '.hhhhhh.', '.hsssss.', '.sesess.', '.ssssss.', '..ssss..',
    '.cccccc.', 'cccccccc', 'sccaaccs', 'scccccss', '.cccccc.',
];
const BACAK = [['.pp..pp.', '.pp..pp.', '.kk..kk.'], ['..pppp..', '.pp..pp.', 'kk....kk']];

export function karakterPaleti(tohum, tur = 'musteri') {
    const r = (n) => Math.abs(Math.sin(tohum * 9301 + n * 49297)) % 1;
    const sec = (dizi, n) => dizi[Math.floor(r(n) * dizi.length)];
    const p = {
        h: sec(['#2b1d14', '#5a3a22', '#8c5a2b', '#d9b26b', '#1c1c1c', '#a33b20', '#6b4a8a'], 1),
        s: sec(['#f2d0b1', '#e0b08a', '#c68b5e', '#9c6644', '#f7dcc5'], 2),
        e: '#1b1b1b',
        c: sec(['#d94f3d', '#3d7fd9', '#e3b23c', '#4caf6a', '#9b59b6', '#e07b39', '#2bb0a8', '#f06292'], 3),
        p: sec(['#2e3b55', '#3b3b3b', '#5b4a3a', '#25476b'], 4),
        k: '#2a1d16',
    };
    p.a = p.c;
    if (tur === 'garson') { p.c = '#2b2b2b'; p.a = '#f4efe6'; p.p = '#1f1f1f'; }
    if (tur === 'kasiyer') { p.c = '#7a4b2a'; p.a = '#e9d3a6'; }
    return p;
}

export function karakter(c, x, y, palet, { kare = 0, oturuyor = false } = {}) {
    // x,y: ayakların ortası (doğal çözünürlük)
    const satirlar = oturuyor ? GOVDE : [...GOVDE, ...BACAK[kare % 2]];
    const ox = Math.round(x - 4), oy = Math.round(y - satirlar.length - (oturuyor ? 4 : 0));
    // gölge
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.fillRect(ox + 1, Math.round(y) - 1, 6, 2);
    satirlar.forEach((satir, i) => {
        for (let j = 0; j < 8; j++) {
            const ch = satir[j];
            if (ch === '.') continue;
            c.fillStyle = palet[ch];
            c.fillRect(ox + j, oy + i, 1, 1);
        }
    });
}

// ------------------------------------------------------------------ sahne
function zemin(c, kat) {
    const t = KATLAR[kat];
    const z = ZEMIN[t.zemin];
    for (let gx = 0; gx < GENISLIK; gx++) for (let gy = 0; gy < DERINLIK; gy++) {
        elmas(c, gx, gy, z[(gx + gy) % 2 === 0 ? 0 : ((gx * 7 + gy * 3) % 5 === 0 ? 2 : 1)]);
    }
    for (const h of t.halilar || []) {
        const r = HALI[h.renk];
        for (let gx = h.gx; gx < h.gx + h.gw; gx++) for (let gy = h.gy; gy < h.gy + h.gd; gy++) {
            elmas(c, gx, gy, r[(gx + gy) % 2]);
        }
    }
}

function duvarlar(c, kat) {
    const d = DUVAR_RENK[kat];
    const sol0 = izo(0, DERINLIK), kose = izo(0, 0), sag0 = izo(GENISLIK, 0);
    // Sol duvar (gx = 0 çizgisi), sağ duvar (gy = 0 çizgisi)
    for (let x = sol0.x; x < sag0.x; x++) {
        const solTaraf = x < kose.x;
        const tabanY = Math.round(solTaraf ? dogruY(sol0, kose, x) : dogruY(kose, sag0, x));
        c.fillStyle = solTaraf ? d.ust : ton(d.ust, 0.9);
        c.fillRect(x, tabanY - DUVAR, 1, DUVAR);
        c.fillStyle = (Math.floor(x / 6) % 2) ? d.serit : (solTaraf ? d.ust : ton(d.ust, 0.9));
        c.fillRect(x, tabanY - DUVAR + 4, 1, DUVAR - 22);
        c.fillStyle = solTaraf ? d.alt : ton(d.alt, 0.85);
        c.fillRect(x, tabanY - 14, 1, 14);
        c.fillStyle = ton(d.alt, 1.25);
        c.fillRect(x, tabanY - 15, 1, 1);
        c.fillStyle = ton(d.ust, 0.6);
        c.fillRect(x, tabanY - DUVAR, 1, 2);
    }
    // Pencereler
    const pencere = (gx, gy, solMu) => {
        const a = izo(gx, gy), b = solMu ? izo(gx, gy + 1.6) : izo(gx + 1.6, gy);
        for (let x = Math.round(Math.min(a.x, b.x)); x < Math.round(Math.max(a.x, b.x)); x++) {
            const yy = Math.round(dogruY(a, b, x));
            c.fillStyle = kat === 1 ? '#9fd3e6' : '#2b3c52';
            c.fillRect(x, yy - 44, 1, 20);
            c.fillStyle = '#f7f0dd';
            c.fillRect(x, yy - 45, 1, 1); c.fillRect(x, yy - 24, 1, 1);
        }
    };
    pencere(0, 2, true); pencere(0, 5.5, true); pencere(4, 0, false); pencere(8, 0, false);
    // Kapı (kat 1)
    if (kat === 1) {
        const a = izo(KAPI.gx, KAPI.gy), b = izo(KAPI.gx, KAPI.gy + 1);
        for (let x = b.x; x < a.x; x++) {
            const yy = Math.round(dogruY(b, a, x));
            c.fillStyle = '#5a3a22'; c.fillRect(x, yy - 34, 1, 34);
            c.fillStyle = '#7a5232'; c.fillRect(x, yy - 32, 1, 30);
        }
    }
    // Tabela / dekor
    if (kat === 2) afis(c, 6, 0, '#e3b23c');
    if (kat === 3) { afis(c, 0, 8, '#c0392b', true); afis(c, 7, 0, '#e3b23c'); }
}

function afis(c, gx, gy, renk, solMu = false) {
    const a = izo(gx, gy), b = solMu ? izo(gx, gy + 1) : izo(gx + 1, gy);
    for (let x = Math.round(Math.min(a.x, b.x)); x < Math.round(Math.max(a.x, b.x)); x++) {
        const yy = Math.round(dogruY(a, b, x));
        c.fillStyle = renk; c.fillRect(x, yy - 50, 1, 22);
        c.fillStyle = ton(renk, 0.7); c.fillRect(x, yy - 30, 1, 2);
    }
}

// Nesne çizimleri; her biri derinlik sıralamasına girer
function nesneCiz(c, o, kat) {
    switch (o.tur) {
        case 'bar':
            kutu(c, o.gx, o.gy, o.gw, o.gd, o.h, renkler(kat === 1 ? '#8a5a35' : '#6b4a3a'));
            kutu(c, o.gx, o.gy, o.gw, o.gd, 2, renkler('#d8c3a0'), o.h - 2);
            // bardaklar
            for (let i = 0; i < o.gw; i++) {
                const p = izo(o.gx + i + 0.5, o.gy + 0.4);
                c.fillStyle = '#f4efe6'; c.fillRect(Math.round(p.x) - 1, Math.round(p.y) - o.h - 4, 3, 3);
            }
            break;
        case 'espresso': {
            kutu(c, o.gx + 0.15, o.gy + 0.1, 0.7, 0.6, 10, renkler('#9aa3ad'), o.h);
            const p = izo(o.gx + 0.5, o.gy + 0.4);
            c.fillStyle = '#d94f3d'; c.fillRect(p.x - 2, p.y - o.h - 8, 2, 2);
            c.fillStyle = '#e9ecef'; c.fillRect(p.x + 1, p.y - o.h - 14, 1, 3);
            break;
        }
        case 'kasa':
            kutu(c, o.gx, o.gy, o.gw, o.gd, o.h, renkler('#7a4b2a'));
            kutu(c, o.gx + 0.2, o.gy + 0.3, 0.6, 0.6, 5, renkler('#3b3b3b'), o.h);
            break;
        case 'koltuk':
            kutu(c, o.gx, o.gy, o.gw, o.gd, o.h, renkler('#b5523b'));
            kutu(c, o.gx, o.gy + 0.7, o.gw, 0.3, 8, renkler('#9c4330'), o.h);
            break;
        case 'raf': {
            kutu(c, o.gx, o.gy, o.gw, o.gd, o.h, renkler('#6b4423'));
            // raftaki kutu oyunları (ön yüzde renkli dikdörtgenler)
            const yatay = o.gw >= o.gd;
            const n = yatay ? o.gw : o.gd;
            for (let i = 0; i < n * 3; i++) {
                const t = (i + 0.5) / 3;
                const p = yatay ? izo(o.gx + t, o.gy + o.gd) : izo(o.gx + o.gw, o.gy + t);
                for (let raf = 0; raf < 3; raf++) {
                    c.fillStyle = OYUN_RENK[(i * 3 + raf * 7) % OYUN_RENK.length];
                    c.fillRect(p.x - 2, p.y - 8 - raf * 9 - (i % 2), 4, 6 + (i % 2));
                }
            }
            break;
        }
        case 'merdiven':
            // arkadan öne alçalan basamaklar
            for (let i = 0; i < 4; i++) kutu(c, o.gx + i * 0.5, o.gy, 0.5, o.gd, (4 - i) * 7, renkler(i % 2 ? '#9b6a3f' : '#8a5d36'));
            break;
        case 'bitki': {
            kutu(c, o.gx + 0.25, o.gy + 0.25, 0.5, 0.5, 5, renkler('#a0522d'));
            const p = izo(o.gx + 0.5, o.gy + 0.5);
            c.fillStyle = '#3f8f4f';
            for (let i = 0; i < 6; i++) c.fillRect(p.x - 4 + i * 1.5, p.y - 12 - (i % 3) * 2, 2, 6);
            c.fillStyle = '#5fb36d'; c.fillRect(p.x - 2, p.y - 16, 4, 4);
            break;
        }
        case 'lamba': {
            const p = izo(o.gx + 0.5, o.gy + 0.5);
            c.fillStyle = '#2b2b2b'; c.fillRect(p.x, p.y - o.h, 1, o.h);
            c.fillStyle = '#f3c969'; c.fillRect(p.x - 3, p.y - o.h - 4, 7, 4);
            break;
        }
        case 'heykel': {
            kutu(c, o.gx + 0.1, o.gy + 0.1, 0.8, 0.8, 6, renkler('#7f8c8d'));
            const p = izo(o.gx + 0.5, o.gy + 0.5);
            c.fillStyle = '#2e8b57';                     // ejderha
            c.fillRect(p.x - 3, p.y - 22, 6, 10); c.fillRect(p.x - 5, p.y - 26, 4, 5); c.fillRect(p.x + 2, p.y - 18, 5, 3);
            c.fillStyle = '#e3b23c'; c.fillRect(p.x - 4, p.y - 25, 1, 1);
            break;
        }
        case 'sandik':
            kutu(c, o.gx, o.gy, o.gw, o.gd, o.h, renkler('#8b5a2b'));
            kutu(c, o.gx, o.gy, o.gw, o.gd, 1, renkler('#e3b23c'), o.h - 3);
            break;
        default:
            kutu(c, o.gx, o.gy, o.gw, o.gd, o.h, renkler('#888888'));
    }
}

function masaCiz(c, m, kat, secili) {
    const renk = kat === 3 ? '#8b5a2b' : kat === 2 ? '#7a5533' : '#c29061';
    // sandalyeler
    for (const s of m.sandalyeler) kutu(c, s.gx + 0.3, s.gy + 0.3, 0.4, 0.4, 5, renkler('#6b4423'));
    if (m.yuva.sekil === 'yuvarlak') {
        kutu(c, m.yuva.gx + 0.15, m.yuva.gy + 0.15, m.yuva.gw - 0.3, m.yuva.gd - 0.3, 10, renkler(renk));
        kutu(c, m.yuva.gx + 0.35, m.yuva.gy + 0.35, m.yuva.gw - 0.7, m.yuva.gd - 0.7, 1, renkler('#c0392b'), 10);
    } else {
        kutu(c, m.yuva.gx + 0.08, m.yuva.gy + 0.08, m.yuva.gw - 0.16, m.yuva.gd - 0.16, 10, renkler(renk));
    }
    if (secili) kutu(c, m.yuva.gx + 0.08, m.yuva.gy + 0.08, m.yuva.gw - 0.16, m.yuva.gd - 0.16, 1, { ust: '#ffe27a', sol: '#ffe27a', sag: '#ffe27a' }, 10);
    // masadaki oyun kutusu
    if (m.oyunRenk) {
        const p = izo(m.yuva.gx + m.yuva.gw / 2, m.yuva.gy + m.yuva.gd / 2);
        c.fillStyle = m.oyunRenk; c.fillRect(p.x - 4, p.y - 14, 8, 4);
        c.fillStyle = '#f4efe6'; c.fillRect(p.x - 3, p.y - 14, 2, 1);
    }
    if (m.kirli) {
        const p = izo(m.yuva.gx + 0.5, m.yuva.gy + 0.5);
        c.fillStyle = '#e9ecef'; c.fillRect(p.x - 3, p.y - 13, 3, 2); c.fillRect(p.x + 2, p.y - 12, 2, 2);
        c.fillStyle = '#8d6e63'; c.fillRect(p.x, p.y - 12, 2, 1);
    }
}

// Sahneyi çiz. sahne: { kat, masalar:[...], bireyler:[...] , seciliMasaId }
export function sahneCiz(c, sahne) {
    c.clearRect(0, 0, DOGAL_G, DOGAL_Y);
    c.fillStyle = '#1d1712';
    c.fillRect(0, 0, DOGAL_G, DOGAL_Y);
    zemin(c, sahne.kat);
    duvarlar(c, sahne.kat);

    const ciz = [];
    for (const o of KATLAR[sahne.kat].nesneler) {
        ciz.push({ d: o.gx + o.gy + (o.gw + o.gd) / 2 - 0.5, f: () => nesneCiz(c, o, sahne.kat) });
    }
    for (const m of sahne.masalar) {
        ciz.push({ d: m.yuva.gx + m.yuva.gy + (m.yuva.gw + m.yuva.gd) / 2 - 0.4, f: () => masaCiz(c, m, sahne.kat, m.masaId === sahne.seciliMasaId) });
    }
    for (const b of sahne.bireyler) {
        const p = izo(b.gx + 0.5, b.gy + 0.5);
        ciz.push({ d: b.gx + b.gy + 0.6, f: () => karakter(c, p.x, p.y, b.palet, { kare: b.kare, oturuyor: b.oturuyor }) });
    }
    ciz.sort((a, b) => a.d - b.d);
    for (const x of ciz) x.f();

    // Merdiven yönü işareti
    const m = izo(MERDIVEN.gx + 0.5, MERDIVEN.gy + 0.5);
    c.fillStyle = 'rgba(255,226,122,.55)';
    c.fillRect(m.x - 1, m.y - 2, 3, 3);
}

// Büyütülmüş tuvale yazılar: masa numaraları, baloncuklar, oyun ikonları
export function ustKatmanCiz(c, olcek, sahne) {
    const yazi = (t, x, y, { renk = '#2a1d16', zemin = '#fff8e7', kenar = '#5a3a22', boyut = 11 } = {}) => {
        c.font = `bold ${boyut}px ui-monospace, Consolas, monospace`;
        const w = Math.ceil(c.measureText(t).width) + 10, h = boyut + 8;
        const bx = Math.round(x - w / 2), by = Math.round(y - h);
        c.fillStyle = kenar; c.fillRect(bx - 2, by, w + 4, h); c.fillRect(bx, by - 2, w, h + 4);
        c.fillStyle = zemin; c.fillRect(bx, by, w, h);
        c.fillStyle = renk; c.fillText(t, bx + 5, by + boyut + 2);
        return { bx, by, w, h };
    };
    for (const m of sahne.masalar) {
        const p = izo(m.yuva.gx + m.yuva.gw / 2, m.yuva.gy + m.yuva.gd / 2);
        const renk = m.durumRenk || '#5a3a22';
        yazi(`M${m.masaNo}`, p.x * olcek, (p.y + 6) * olcek + 18, { zemin: renk, renk: '#fff8e7', kenar: '#2a1d16', boyut: 9 });
    }
    for (const b of sahne.bireyler) {
        const p = izo(b.gx + 0.5, b.gy + 0.5);
        const ust = (p.y - (b.oturuyor ? 20 : 17)) * olcek;
        if (b.ikon) {
            const s = 4 * olcek;
            c.fillStyle = '#2a1d16'; c.fillRect(p.x * olcek - s / 2 - 2, ust - s - 2, s + 4, s + 4);
            c.fillStyle = b.ikon.renk; c.fillRect(p.x * olcek - s / 2, ust - s, s, s);
            c.fillStyle = '#fff8e7';
            c.font = `bold ${Math.round(s * 0.7)}px ui-monospace, Consolas, monospace`;
            c.fillText(b.ikon.harf, p.x * olcek - s * 0.22, ust - s * 0.22);
        }
        if (b.baloncuk) {
            const r = yazi(b.baloncuk, p.x * olcek, ust - (b.ikon ? 4 * olcek + 6 : 4), { boyut: 11 });
            c.fillStyle = '#fff8e7';
            c.fillRect(Math.round(p.x * olcek) - 3, r.by + r.h, 6, 4);
        }
    }
}

// Tıklanan noktadaki masa (doğal çözünürlük koordinatı)
export function masaBul(masalar, x, y) {
    for (const m of [...masalar].reverse()) {
        const y0 = m.yuva;
        const T = izo(y0.gx - 1, y0.gy - 1), B = izo(y0.gx + y0.gw + 1, y0.gy + y0.gd + 1);
        const L = izo(y0.gx - 1, y0.gy + y0.gd + 1), R = izo(y0.gx + y0.gw + 1, y0.gy - 1);
        if (x >= L.x && x <= R.x && y >= T.y - 14 && y <= B.y) return m;
    }
    return null;
}

// Düşük çözünürlüklü tuval: tüm fillRect çağrıları tam piksele yuvarlanır (bulanık kenar olmaz)
export function pikselBaglami(tuval) {
    const c = tuval.getContext('2d');
    const asil = c.fillRect.bind(c);
    c.fillRect = (x, y, w, h) => asil(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    c.imageSmoothingEnabled = false;
    return c;
}
