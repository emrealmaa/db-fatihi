// Piksel-art izometrik çizim. Sahne ara bir tuvale (DOGAL_G x DOGAL_Y) çizilir; kamera (yakınlaştırma,
// kaydırma) bu tuvali ekrana aktarırken uygulanır. Döndürme dünya koordinatlarında yapılır (harita.js):
// oda 90° döner, kameraya göre arkada kalan iki duvar çizilir ve derinlik sıralaması döndürülmüş
// koordinatlarla yeniden hesaplanır. Tüm şekiller fillRect ile satır/sütun çizildiğinden kenarlar keskin kalır.
import {
    arkaDuvarlar, boyut, DERINLIK, dikdortgenDondur, dondur, duvarNoktasi, GENISLIK, KATLAR, MERDIVEN_GOVDE,
} from './harita.js';

const KX = 24, KY = 12;                  // yarım karo genişliği / yüksekliği
const DUVAR = 84;                        // duvar yüksekliği
const PAD = 24;
const OY = DUVAR + 24;
export const DOGAL_G = (GENISLIK + DERINLIK) * KX + PAD * 2;
export const DOGAL_Y = OY + (GENISLIK + DERINLIK) * KY + 36;

// Döndürülmüş uzayda izdüşüm; d: kamera açısı (0..3)
export function izdusum(d) {
    const { RH } = boyut(d);
    const ox = RH * KX + PAD;
    const R = (rx, ry) => ({ x: ox + (rx - ry) * KX, y: OY + (rx + ry) * KY });
    const W = (x, y) => { const p = dondur(d, x, y); return R(p.x, p.y); };
    return { R, W };
}

// ------------------------------------------------------------------ renk yardımcıları
const ZEMIN = {
    ahsap: ['#c18a55', '#b47e4b', '#cc955f'],
    koyu: ['#5b4636', '#523f31', '#64503f'],
    hali: ['#6e2a3a', '#652434', '#783142'],
};
const HALI = {
    bekleme: ['#d9a65b', '#cf9a4f'], paspas: ['#6b8f5a', '#5f8250'],
    salon: ['#3f5a4a', '#385142'], vip: ['#3d2552', '#36204a'],
};
const DUVAR_RENK = {
    1: { ust: '#f1dfbf', serit: '#e6cfa6', alt: '#9b6a3f' },
    2: { ust: '#6d7f66', serit: '#62735c', alt: '#4a3626' },
    3: { ust: '#5d3b6e', serit: '#53335f', alt: '#2f1b29' },
};
export const OYUN_RENK = ['#d94f3d', '#3d7fd9', '#e3b23c', '#4caf6a', '#9b59b6', '#e07b39', '#2bb0a8', '#c2185b', '#7cb342', '#5c6bc0'];

const onAltilik = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const ton = (hex, k) => {
    const [r, g, b] = onAltilik(hex);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
const renkler = (hex, desen) => ({ ust: hex, sol: ton(hex, 0.8), sag: ton(hex, 0.64), kenar: ton(hex, 1.15), desen });

// ------------------------------------------------------------------ temel şekiller (döndürülmüş uzayda)
function elmasR(c, P, rx, ry, renk) {
    const { x, y } = P.R(rx, ry);
    c.fillStyle = renk;
    for (let r = 0; r < KY * 2; r++) {
        const w = (r < KY ? r + 1 : KY * 2 - r) * (KX / KY);
        c.fillRect(x - w, y + r, w * 2, 1);
    }
}

const dogruY = (a, b, x) => a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);

// İzometrik kutu (döndürülmüş taban): üst yüz + iki yan yüz, sütun sütun.
// renk.desen(c, x, ustY, h, solYuzMu, sutun) verilirse yan yüzlere desen çizilir (raf, sandık...)
function kutuR(c, P, r, h, renk, z = 0) {
    const T = P.R(r.gx, r.gy), Rr = P.R(r.gx + r.gw, r.gy), B = P.R(r.gx + r.gw, r.gy + r.gd), L = P.R(r.gx, r.gy + r.gd);
    const x0 = Math.round(L.x), x1 = Math.round(Rr.x);
    for (let x = x0; x < x1; x++) {
        const px = x + 0.5;
        const ust = Math.round(px < T.x ? dogruY(L, T, px) : dogruY(T, Rr, px));
        const alt = Math.round(px < B.x ? dogruY(L, B, px) : dogruY(B, Rr, px));
        c.fillStyle = renk.ust;
        c.fillRect(x, ust - h - z, 1, alt - ust);
        if (h > 0) {
            const sol = px < B.x;
            c.fillStyle = sol ? renk.sol : renk.sag;
            c.fillRect(x, alt - h - z, 1, h);
            if (renk.desen) renk.desen(c, x, alt - h - z, h, sol, x - x0);
        }
        if (renk.kenar) { c.fillStyle = renk.kenar; c.fillRect(x, ust - h - z, 1, 1); }
    }
}
// Dünya tabanlı kutu
const kutu = (c, P, d, gx, gy, gw, gd, h, renk, z) => kutuR(c, P, dikdortgenDondur(d, gx, gy, gw, gd), h, renk, z);

// Raf deseni: yan yüzlerde rafa dizilmiş kutu oyunları
const rafDeseni = (c, x, ustY, h, sol, sutun) => {
    const katSayisi = Math.floor((h - 4) / 11);
    for (let k = 0; k < katSayisi; k++) {
        const y = ustY + 3 + k * 11;
        const kutuNo = Math.floor(sutun / 3) + k * 5;
        if (sutun % 3 === 2) continue;                     // kutular arası boşluk
        const renk = OYUN_RENK[(kutuNo * 7 + k) % OYUN_RENK.length];
        c.fillStyle = sol ? renk : ton(renk, 0.8);
        c.fillRect(x, y + (kutuNo % 3), 1, 9 - (kutuNo % 3));
    }
};

// ------------------------------------------------------------------ zemin ve duvarlar (önbellekli)
const katmanOnbellek = new Map();

function zeminVeDuvarlar(kat, d) {
    const anahtar = `${kat}-${d}`;
    if (katmanOnbellek.has(anahtar)) return katmanOnbellek.get(anahtar);
    const tuval = document.createElement('canvas');
    tuval.width = DOGAL_G; tuval.height = DOGAL_Y;
    const c = pikselBaglami(tuval);
    const P = izdusum(d);
    const t = KATLAR[kat];

    c.fillStyle = '#1d1712';
    c.fillRect(0, 0, DOGAL_G, DOGAL_Y);
    const z = ZEMIN[t.zemin];
    for (let gx = 0; gx < GENISLIK; gx++) for (let gy = 0; gy < DERINLIK; gy++) {
        const r = dikdortgenDondur(d, gx, gy, 1, 1);
        elmasR(c, P, r.gx, r.gy, z[(gx + gy) % 2 === 0 ? 0 : ((gx * 7 + gy * 3) % 5 === 0 ? 2 : 1)]);
    }
    for (const h of t.halilar || []) {
        const renk = HALI[h.renk];
        for (let gx = h.gx; gx < h.gx + h.gw; gx++) for (let gy = h.gy; gy < h.gy + h.gd; gy++) {
            const r = dikdortgenDondur(d, gx, gy, 1, 1);
            const kenar = gx === h.gx || gy === h.gy || gx === h.gx + h.gw - 1 || gy === h.gy + h.gd - 1;
            elmasR(c, P, r.gx, r.gy, kenar && h.renk === 'vip' ? '#b8892f' : renk[(gx + gy) % 2]);
        }
    }
    duvarlariCiz(c, P, kat, d);
    katmanOnbellek.set(anahtar, tuval);
    return tuval;
}

function duvarlariCiz(c, P, kat, d) {
    const renk = DUVAR_RENK[kat];
    const { RW, RH } = boyut(d);
    const sol0 = P.R(0, RH), kose = P.R(0, 0), sag0 = P.R(RW, 0);
    for (let x = Math.round(sol0.x); x < Math.round(sag0.x); x++) {
        const sol = x < kose.x;
        const k = sol ? 1 : 0.86;
        const taban = Math.round(sol ? dogruY(sol0, kose, x) : dogruY(kose, sag0, x));
        c.fillStyle = ton(renk.ust, k); c.fillRect(x, taban - DUVAR, 1, DUVAR);
        if (Math.floor(x / 8) % 2) { c.fillStyle = ton(renk.serit, k); c.fillRect(x, taban - DUVAR + 6, 1, DUVAR - 30); }
        c.fillStyle = ton(renk.alt, k); c.fillRect(x, taban - 22, 1, 22);
        c.fillStyle = ton(renk.alt, k * 1.3); c.fillRect(x, taban - 23, 1, 1);
        c.fillStyle = ton(renk.ust, 0.55); c.fillRect(x, taban - DUVAR, 1, 3);
    }
    // Duvar dekorları: yalnızca kameraya göre arkada kalan duvarlardakiler görünür
    const [solDuvar, sagDuvar] = arkaDuvarlar(d);
    for (const f of KATLAR[kat].duvar || []) {
        if (f.duvar !== solDuvar && f.duvar !== sagDuvar) continue;
        const a = duvarNoktasi(f.duvar, f.bas), b = duvarNoktasi(f.duvar, f.son);
        const pa = P.W(a.x, a.y), pb = P.W(b.x, b.y);
        const [p0, p1] = pa.x < pb.x ? [pa, pb] : [pb, pa];
        const k = f.duvar === solDuvar ? 1 : 0.86;
        const n = Math.round(p1.x) - Math.round(p0.x);
        for (let x = Math.round(p0.x); x < Math.round(p1.x); x++) {
            const y = Math.round(dogruY(p0, p1, x + 0.5));
            const i = x - Math.round(p0.x);
            const kenar = i === 0 || i === n - 1;
            switch (f.tur) {
                case 'pencere':
                    c.fillStyle = ton('#f7f0dd', k); c.fillRect(x, y - 70, 1, 36);
                    if (!kenar) {
                        c.fillStyle = ton(kat === 1 ? '#9fd3e6' : '#22324a', k); c.fillRect(x, y - 67, 1, 30);
                        if (i === Math.floor(n / 2)) { c.fillStyle = ton('#f7f0dd', k); c.fillRect(x, y - 67, 1, 30); }
                        if ((i + 3) % 9 < 2) { c.fillStyle = ton(kat === 1 ? '#c9ecf6' : '#34507a', k); c.fillRect(x, y - 64, 1, 10); }
                    }
                    c.fillStyle = ton('#8a5d36', k); c.fillRect(x, y - 34, 1, 3);
                    break;
                case 'kapi':
                    c.fillStyle = ton('#4a2e1a', k); c.fillRect(x, y - 58, 1, 58);
                    if (!kenar) { c.fillStyle = ton('#7a5232', k); c.fillRect(x, y - 55, 1, 55); }
                    if (i === n - 4) { c.fillStyle = '#e3b23c'; c.fillRect(x, y - 30, 1, 3); }
                    break;
                case 'pano':
                    c.fillStyle = ton('#3b2a1e', k); c.fillRect(x, y - 66, 1, 28);
                    if (!kenar) {
                        c.fillStyle = ton('#2f4f3a', k); c.fillRect(x, y - 64, 1, 24);
                        c.fillStyle = '#f4efe6';
                        if (i % 4 === 1) c.fillRect(x, y - 60, 1, 1);
                        if (i % 5 === 2) c.fillRect(x, y - 54, 1, 1);
                        if (i % 3 === 0) c.fillRect(x, y - 48, 1, 1);
                    }
                    break;
                case 'afis':
                    c.fillStyle = ton('#e3b23c', k); c.fillRect(x, y - 68, 1, 30);
                    c.fillStyle = ton('#c0392b', k); c.fillRect(x, y - 58, 1, 8);
                    break;
                case 'sanc':
                    c.fillStyle = ton(f.renk, k); c.fillRect(x, y - 76, 1, 40 + (i === Math.floor(n / 2) ? 4 : 0));
                    c.fillStyle = '#e3b23c'; c.fillRect(x, y - 77, 1, 2);
                    if (i === Math.floor(n / 2)) c.fillRect(x, y - 60, 1, 6);
                    break;
                default:
            }
        }
    }
}

// ------------------------------------------------------------------ nesneler
function nesneCiz(c, P, d, o) {
    const K = (gx, gy, gw, gd, h, renk, zz) => kutu(c, P, d, gx, gy, gw, gd, h, renk, zz);
    const W = (x, y) => P.W(x, y);
    switch (o.tur) {
        case 'bar':
            K(o.gx, o.gy, o.gw, o.gd, o.h - 3, renkler('#7a4b2a', (cc, x, y, h, sol, s) => {
                if (s % 10 === 0) { cc.fillStyle = 'rgba(0,0,0,.18)'; cc.fillRect(x, y + 2, 1, h - 4); }
            }));
            K(o.gx - 0.05, o.gy - 0.05, o.gw + 0.1, o.gd + 0.1, 3, renkler('#e8d6b3'), o.h - 3);
            for (let i = 0; i < o.gw; i += 1) {
                const p = W(o.gx + i + 0.5, o.gy + 0.5);
                c.fillStyle = '#f4efe6'; c.fillRect(p.x - 2, p.y - o.h - 5, 4, 4);
                c.fillStyle = '#6b4423'; c.fillRect(p.x - 1, p.y - o.h - 5, 2, 1);
            }
            break;
        case 'espresso': {
            K(o.gx + 0.15, o.gy + 0.15, 0.7, 0.6, 16, renkler('#9aa3ad'), o.h);
            K(o.gx + 0.2, o.gy + 0.2, 0.6, 0.5, 3, renkler('#2b2b2b'), o.h + 16);
            const p = W(o.gx + 0.5, o.gy + 0.5);
            c.fillStyle = '#d94f3d'; c.fillRect(p.x - 3, p.y - o.h - 11, 2, 2);
            c.fillStyle = '#e9ecef'; c.fillRect(p.x + 2, p.y - o.h - 24, 1, 4); c.fillRect(p.x + 4, p.y - o.h - 27, 1, 5);
            break;
        }
        case 'vitrin':
            K(o.gx + 0.05, o.gy + 0.1, o.gw - 0.1, o.gd - 0.2, 12, { ust: 'rgba(200,235,245,.55)', sol: 'rgba(170,215,230,.55)', sag: 'rgba(150,195,215,.55)' }, o.h);
            for (let i = 0; i < 4; i++) {
                const p = W(o.gx + 0.35 + i * 0.4, o.gy + 0.5);
                c.fillStyle = ['#f3c27a', '#8d5524', '#f06292', '#fff3d6'][i]; c.fillRect(p.x - 2, p.y - o.h - 8, 4, 3);
            }
            break;
        case 'kasa':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#6b4423'));
            K(o.gx + 0.15, o.gy + 0.3, 0.7, 0.6, 8, renkler('#3b3b3b'), o.h);
            K(o.gx + 0.2, o.gy + 0.35, 0.4, 0.4, 6, renkler('#5b6b78'), o.h + 8);
            break;
        case 'koltuk':
        case 'deri': {
            const ana = o.tur === 'deri' ? '#5a2e1c' : '#b5523b';
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, o.h, renkler(ana));
            // sırtlık: duvara yakın uzun kenar boyunca
            const yatay = o.gw >= o.gd;
            if (yatay) K(o.gx + 0.05, o.gy + (o.gy === 0 ? 0.05 : 0.65), o.gw - 0.1, 0.3, 12, renkler(ton(ana, 0.85)), o.h);
            else K(o.gx + (o.gx === 0 ? 0.05 : 0.65), o.gy + 0.05, 0.3, o.gd - 0.1, 12, renkler(ton(ana, 0.85)), o.h);
            if (o.tur === 'deri') for (let i = 0; i < Math.max(o.gw, o.gd); i++) {
                const p = yatay ? W(o.gx + i + 0.5, o.gy + 0.5) : W(o.gx + 0.5, o.gy + i + 0.5);
                c.fillStyle = '#e3b23c'; c.fillRect(p.x, p.y - o.h - 2, 1, 1);
            }
            break;
        }
        case 'raf':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#5e3b1f', rafDeseni));
            break;
        case 'tabela': {
            const p = W(o.gx + 1, o.gy + 0.5);
            c.fillStyle = '#3b2a1e'; c.fillRect(p.x - 1, p.y - o.h, 2, o.h);
            c.fillStyle = '#2f4f3a'; c.fillRect(p.x - 14, p.y - o.h - 14, 28, 16);
            c.fillStyle = '#f4efe6';
            for (let i = 0; i < 4; i++) c.fillRect(p.x - 11, p.y - o.h - 11 + i * 3, 10 + (i * 5) % 12, 1);
            c.fillStyle = '#e3b23c'; c.fillRect(p.x + 6, p.y - o.h - 11, 5, 4);
            break;
        }
        case 'bitki': {
            K(o.gx + 0.3, o.gy + 0.3, 0.4, 0.4, 8, renkler('#a0522d'));
            const p = W(o.gx + 0.5, o.gy + 0.5);
            const yaprak = ['#2f7a3f', '#3f8f4f', '#5fb36d'];
            for (let i = 0; i < 9; i++) {
                c.fillStyle = yaprak[i % 3];
                c.fillRect(p.x - 7 + (i * 5) % 14, p.y - 14 - ((i * 7) % 10), 3, 7);
            }
            c.fillStyle = '#7cc68a'; c.fillRect(p.x - 2, p.y - 25, 4, 4);
            break;
        }
        case 'lamba': {
            const p = W(o.gx + 0.5, o.gy + 0.5);
            K(o.gx + 0.35, o.gy + 0.35, 0.3, 0.3, 2, renkler('#2b2b2b'));
            c.fillStyle = '#2b2b2b'; c.fillRect(p.x, p.y - o.h, 1, o.h);
            c.fillStyle = '#c9963b'; c.fillRect(p.x - 6, p.y - o.h - 6, 13, 6);
            c.fillStyle = '#ffe3a0'; c.fillRect(p.x - 5, p.y - o.h, 11, 1);
            break;
        }
        case 'heykel': {
            K(o.gx + 0.1, o.gy + 0.1, 0.8, 0.8, 10, renkler('#7f8c8d'));
            const p = W(o.gx + 0.5, o.gy + 0.5);
            c.fillStyle = '#2e8b57';
            c.fillRect(p.x - 4, p.y - 34, 8, 22); c.fillRect(p.x - 7, p.y - 40, 6, 8); c.fillRect(p.x + 3, p.y - 26, 8, 4);
            c.fillStyle = '#1f6b42'; c.fillRect(p.x + 2, p.y - 34, 2, 22); c.fillRect(p.x - 10, p.y - 30, 6, 3);
            c.fillStyle = '#e3b23c'; c.fillRect(p.x - 6, p.y - 38, 1, 1);
            c.fillStyle = '#d94f3d'; c.fillRect(p.x - 9, p.y - 36, 2, 1);
            break;
        }
        case 'sandik':
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, o.h, renkler('#8b5a2b', (cc, x, y, h, sol, s) => {
                if (s % 7 === 0) { cc.fillStyle = '#e3b23c'; cc.fillRect(x, y, 1, h); }
            }));
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, 2, renkler('#e3b23c'), o.h - 5);
            break;
        default:
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#888888'));
    }
}

function merdivenCiz(c, P, d, kat) {
    const m = MERDIVEN_GOVDE;
    // Arkadan öne alçalan dört basamak (dünya x'i boyunca)
    for (let i = 0; i < 4; i++) {
        kutu(c, P, d, m.gx + i * 0.5, m.gy, 0.5, m.gd, (4 - i) * 12, renkler(i % 2 ? '#9b6a3f' : '#8a5d36'));
    }
    const p = P.W(m.gx + 1, m.gy + 1);
    c.fillStyle = '#ffe27a';
    if (kat < 3) { c.fillRect(p.x - 3, p.y - 60, 7, 2); c.fillRect(p.x - 1, p.y - 64, 3, 4); }   // yukarı oku
    if (kat > 1) { c.fillRect(p.x - 3, p.y - 54, 7, 2); c.fillRect(p.x - 1, p.y - 52, 3, 4); }   // aşağı oku
}

function masaCiz(c, P, d, m, kat, secili) {
    const y = m.yuva;
    for (const s of m.sandalyeler) {
        if (kat === 3) {
            kutu(c, P, d, s.gx + 0.18, s.gy + 0.18, 0.64, 0.64, 9, renkler('#5a2e1c'));
            kutu(c, P, d, s.gx + 0.24, s.gy + 0.24, 0.52, 0.52, 1, renkler('#7a3e26'), 9);
        } else {
            kutu(c, P, d, s.gx + 0.28, s.gy + 0.28, 0.44, 0.44, 8, renkler(kat === 2 ? '#4a2e1a' : '#6b4423'));
        }
    }
    const ahsap = kat === 3 ? '#6b3f22' : kat === 2 ? '#7a5533' : '#c29061';
    const pay = y.sekil ? 0.12 : 0.1;
    kutu(c, P, d, y.gx + pay, y.gy + pay, y.gw - pay * 2, y.gd - pay * 2, 16, renkler(ahsap));
    if (y.sekil === 'yuvarlak') kutu(c, P, d, y.gx + 0.3, y.gy + 0.3, y.gw - 0.6, y.gd - 0.6, 1, renkler('#a8282f'), 16);
    if (y.sekil === 'harita') {
        // FRP harita masası: üst yüzde arazi deseni
        const n = 3;
        for (let i = 0; i < y.gw * n; i++) for (let j = 0; j < y.gd * n; j++) {
            const renk = ['#5f9e5a', '#4b8a4a', '#3d7fd9', '#c9b27c'][((i * 5 + j * 3) ^ (i * j)) % 4];
            const w = (y.gw - 0.6) / (y.gw * n), h = (y.gd - 0.6) / (y.gd * n);
            kutu(c, P, d, y.gx + 0.3 + i * w, y.gy + 0.3 + j * h, w, h, 0, { ust: renk }, 16);
        }
    }
    if (secili) kutu(c, P, d, y.gx + pay, y.gy + pay, y.gw - pay * 2, y.gd - pay * 2, 0, { ust: 'rgba(255,226,122,.45)' }, 17);
    const orta = P.W(y.gx + y.gw / 2, y.gy + y.gd / 2);
    if (m.oyunRenk) {
        kutu(c, P, d, y.gx + y.gw / 2 - 0.25, y.gy + y.gd / 2 - 0.2, 0.5, 0.4, 3, renkler(m.oyunRenk), 16);
        c.fillStyle = '#f4efe6';
        for (let i = 0; i < 3; i++) c.fillRect(orta.x - 8 + i * 6, orta.y - 22 + (i % 2) * 2, 2, 2);   // piyonlar
    }
    if (m.kirli) {
        c.fillStyle = '#e9ecef'; c.fillRect(orta.x - 6, orta.y - 20, 4, 3); c.fillRect(orta.x + 3, orta.y - 19, 3, 3);
        c.fillStyle = '#8d6e63'; c.fillRect(orta.x - 5, orta.y - 20, 2, 1);
    }
}

// ------------------------------------------------------------------ karakterler
const SPRITE_G = 24, SPRITE_Y = 36, SX = 4, SY = 3;    // sprite tuvali ve çizim başlangıcı
const spriteOnbellek = new Map();

export function karakterPaleti(tohum, tur = 'musteri') {
    const r = (n) => Math.abs(Math.sin(tohum * 9301 + n * 49297)) % 1;
    const sec = (dizi, n) => dizi[Math.floor(r(n) * dizi.length)];
    const sac = sec(['#2b1d14', '#5a3a22', '#8c5a2b', '#d9b26b', '#1c1c1c', '#a33b20', '#6b4a8a', '#c9c2b8'], 1);
    const ten = sec(['#f2d0b1', '#e8bb93', '#c68b5e', '#9c6644', '#f7dcc5'], 2);
    const gomlek = sec(['#d94f3d', '#3d7fd9', '#e3b23c', '#4caf6a', '#9b59b6', '#e07b39', '#2bb0a8', '#f06292', '#5c6bc0', '#7cb342'], 3);
    const pantolon = sec(['#2e3b55', '#3b3b3b', '#5b4a3a', '#25476b', '#6b5b4b'], 4);
    const p = {
        tur, sac, sacA: ton(sac, 1.45), ten, tenG: ton(ten, 0.82), gomlek, gomlekG: ton(gomlek, 0.75), gomlekA: ton(gomlek, 1.25),
        pantolon, pantolonG: ton(pantolon, 0.75), ayakkabi: '#2a1d16', goz: '#1b1b1b', agiz: ton(ten, 0.65),
        stil: Math.floor(r(5) * 4), gozluk: r(6) < 0.2, etek: r(7) < 0.25,
    };
    if (tur === 'garson') Object.assign(p, { gomlek: '#f4efe6', gomlekG: '#d9d2c5', gomlekA: '#ffffff', pantolon: '#1f1f1f', pantolonG: '#141414', etek: false });
    if (tur === 'kasiyer') Object.assign(p, { gomlek: '#e9d3a6', gomlekG: '#cdb586', gomlekA: '#f7e6c2', etek: false });
    p.anahtar = `${tohum}-${tur}`;
    return p;
}

// Tek kare sprite (16 x 30 alan, SX/SY kaydırmalı). poz: ayakta | yuruyor | oturuyor
function spriteUret(p, { poz, arka, kare, tepsi, elKalkik }) {
    const t = document.createElement('canvas');
    t.width = SPRITE_G; t.height = SPRITE_Y;
    const c = t.getContext('2d');
    const r = (x, y, w, h, renk) => { c.fillStyle = renk; c.fillRect(SX + x, SY + y, w, h); };
    const adim = poz === 'yuruyor' ? kare % 4 : 0;
    const kol = adim === 1 ? -1 : adim === 3 ? 1 : 0;

    // bacaklar
    if (poz === 'oturuyor') {
        // uyluklar öne, baldırlar sandalyeden aşağı sarkar
        r(4, 22, 8, 2, p.pantolon); r(10, 22, 2, 2, p.pantolonG);
        if (!arka) {
            r(4, 24, 3, 3, p.pantolonG); r(9, 24, 3, 3, p.pantolonG);
            r(3, 27, 4, 1, p.ayakkabi); r(9, 27, 4, 1, p.ayakkabi);
        }
    } else if (p.etek) {
        r(4, 21, 8, 4, p.pantolon); r(10, 21, 2, 4, p.pantolonG);
        r(5, 25, 2, 2, p.tenG); r(9, 25, 2, 2, p.tenG);
        r(4, 27 - (adim === 1 ? 1 : 0), 4, 2, p.ayakkabi); r(8, 27 - (adim === 3 ? 1 : 0), 4, 2, p.ayakkabi);
    } else {
        const solK = adim === 1 ? 1 : 0, sagK = adim === 3 ? 1 : 0;
        r(5, 22, 3, 5 - solK, p.pantolon); r(8, 22, 3, 5 - sagK, p.pantolonG);
        r(4, 27 - solK, 4, 2, p.ayakkabi); r(8, 27 - sagK, 4, 2, p.ayakkabi);
        r(4, 27 - solK, 1, 1, '#4a3a30'); r(11, 27 - sagK, 1, 1, '#4a3a30');
    }
    // gövde
    r(4, 14, 8, 8, p.gomlek); r(10, 14, 2, 8, p.gomlekG); r(4, 14, 1, 8, p.gomlekA);
    if (!arka) r(6, 14, 4, 1, p.gomlekA);
    r(4, 21, 8, 1, '#3b2a1e');
    if (p.tur === 'garson') {
        r(4, 14, 2, 7, '#262626'); r(10, 14, 2, 7, '#1c1c1c');                                    // yelek
        if (!arka) { r(7, 14, 2, 1, '#c0392b'); r(5, 18, 6, 9, '#ffffff'); r(10, 18, 1, 9, '#e3ddd2'); }   // papyon, önlük
        else r(7, 19, 2, 1, '#ffffff');                                                            // önlük bağı
    }
    if (p.tur === 'kasiyer') { r(4, 14, 2, 8, '#7a4b2a'); r(10, 14, 2, 8, '#5f3a20'); }
    // kollar
    if (tepsi) {
        r(1, 12, 3, 4, p.gomlek); r(1, 11, 2, 1, p.ten);                       // tepsi tutan kol
        r(-3, 10, 10, 1, '#b0b7bf'); r(-3, 11, 10, 1, '#7f8a94');              // tepsi
        r(-2, 7, 2, 3, '#f4efe6'); r(1, 8, 2, 2, '#d94f3d'); r(4, 7, 1, 3, '#e3b23c');
    } else {
        r(2, 15 + kol, 2, 6, p.gomlek); r(2, 21 + kol, 2, 1, p.ten);
    }
    if (elKalkik) { r(12, 8, 2, 7, p.gomlekG); r(12, 6, 2, 2, p.ten); }
    else { r(12, 15 - kol, 2, 6, p.gomlekG); r(12, 21 - kol, 2, 1, p.tenG); }
    // boyun ve baş
    r(7, 12, 2, 2, p.tenG);
    if (arka) {
        r(3, 1, 10, 11, p.sac); r(4, 1, 4, 1, p.sacA); r(11, 3, 1, 8, ton(p.sac, 0.8));
        r(3, 7, 1, 2, p.ten); r(12, 7, 1, 2, p.tenG);
        if (p.stil === 1) r(4, 11, 8, 3, p.sac);
        if (p.stil === 2) { r(6, -1, 4, 3, p.sac); r(7, -1, 2, 1, p.sacA); }
    } else {
        r(4, 4, 8, 8, p.ten); r(11, 5, 1, 7, p.tenG); r(5, 11, 6, 1, p.tenG);
        if (p.stil === 3) {
            r(2, 1, 12, 5, p.sac); r(2, 5, 2, 3, p.sac); r(12, 5, 2, 3, p.sac);
            for (let i = 0; i < 6; i++) r(2 + i * 2, 0, 1, 1, p.sac);
        } else {
            r(3, 1, 10, 4, p.sac); r(3, 4, 1, 4, p.sac); r(12, 4, 1, 3, p.sac); r(4, 4, 3, 1, p.sac);
        }
        if (p.stil === 1) { r(3, 5, 1, 9, p.sac); r(12, 5, 1, 9, p.sac); }
        if (p.stil === 2) r(6, -1, 4, 2, p.sac);
        r(5, 1, 4, 1, p.sacA);
        // yüz
        r(6, 7, 1, 2, p.goz); r(9, 7, 1, 2, p.goz);
        r(5, 6, 2, 1, ton(p.sac, 0.9)); r(9, 6, 2, 1, ton(p.sac, 0.9));
        r(7, 10, 2, 1, p.agiz);
        r(5, 9, 1, 1, 'rgba(230,120,110,.55)'); r(10, 9, 1, 1, 'rgba(230,120,110,.55)');
        if (p.gozluk) {
            r(5, 7, 2, 1, '#2b2b2b'); r(9, 7, 2, 1, '#2b2b2b'); r(7, 7, 2, 1, '#2b2b2b');
            r(5, 8, 2, 1, 'rgba(190,225,235,.7)'); r(9, 8, 2, 1, 'rgba(190,225,235,.7)');
        }
    }
    if (p.tur === 'kasiyer') { r(3, 0, 10, 2, '#7a4b2a'); if (!arka) r(2, 2, 12, 1, '#5f3a20'); }

    // dış hat: saydam olup opak komşusu olan pikseller koyu renk
    const veri = c.getImageData(0, 0, SPRITE_G, SPRITE_Y);
    const px = veri.data;
    const opak = (x, y) => x >= 0 && y >= 0 && x < SPRITE_G && y < SPRITE_Y && px[(y * SPRITE_G + x) * 4 + 3] > 40;
    const hat = [];
    for (let y = 0; y < SPRITE_Y; y++) for (let x = 0; x < SPRITE_G; x++) {
        if (!opak(x, y) && (opak(x - 1, y) || opak(x + 1, y) || opak(x, y - 1) || opak(x, y + 1))) hat.push((y * SPRITE_G + x) * 4);
    }
    for (const i of hat) { px[i] = 38; px[i + 1] = 24; px[i + 2] = 16; px[i + 3] = 255; }
    c.putImageData(veri, 0, 0);
    return t;
}

function sprite(p, o) {
    const a = `${p.anahtar}|${o.poz}|${o.arka ? 1 : 0}|${o.kare % 4}|${o.tepsi ? 1 : 0}|${o.elKalkik ? 1 : 0}`;
    let s = spriteOnbellek.get(a);
    if (!s) { s = spriteUret(p, o); spriteOnbellek.set(a, s); }
    return s;
}

// Dünya yön vektörünü kamera açısına göre ekran yönüne çevir: arkası mı dönük, ayna mı
function ekranYonu(d, vx, vy) {
    if (!vx && !vy) return null;
    const a = dondur(d, 0, 0), b = dondur(d, vx, vy);
    const rx = b.x - a.x, ry = b.y - a.y;
    return { arka: rx + ry < -0.01, ayna: rx - ry < 0 };
}

function karakterCiz(c, P, d, b) {
    const p = P.W(b.gx + 0.5, b.gy + 0.5);
    const yon = ekranYonu(d, b.vx, b.vy) || { arka: false, ayna: false };
    const poz = b.oturuyor ? 'oturuyor' : b.hareketli ? 'yuruyor' : 'ayakta';
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.fillRect(p.x - 6, p.y - 1, 12, 2); c.fillRect(p.x - 4, p.y - 2, 8, 4);
    const s = sprite(b.palet, { poz, arka: yon.arka, kare: b.kare, tepsi: b.tepsi, elKalkik: b.elKalkik });
    // oturan karakter sandalyenin oturma yüksekliğine çıkar
    const x = Math.round(p.x) - SX - 8, y = Math.round(p.y) - SY - 29 - (b.oturuyor ? 6 : 0);
    if (yon.ayna) {
        c.save(); c.translate(Math.round(p.x) * 2, 0); c.scale(-1, 1);
        c.drawImage(s, x, y); c.restore();
    } else c.drawImage(s, x, y);
}

// ------------------------------------------------------------------ sahne
export function sahneCiz(c, sahne) {
    const { kat, d } = sahne;
    const P = izdusum(d);
    c.drawImage(zeminVeDuvarlar(kat, d), 0, 0);

    const derinlik = (gx, gy, gw = 1, gd = 1) => {
        const r = dikdortgenDondur(d, gx, gy, gw, gd);
        return r.gx + r.gy + (r.gw + r.gd) / 2;
    };
    const ciz = [];
    for (const o of KATLAR[kat].nesneler) ciz.push({ k: derinlik(o.gx, o.gy, o.gw, o.gd) - 0.5, f: () => nesneCiz(c, P, d, o) });
    const m = MERDIVEN_GOVDE;
    ciz.push({ k: derinlik(m.gx, m.gy, m.gw, m.gd) - 0.5, f: () => merdivenCiz(c, P, d, kat) });
    for (const ms of sahne.masalar) {
        const y = ms.yuva;
        ciz.push({ k: derinlik(y.gx, y.gy, y.gw, y.gd) - 0.35, f: () => masaCiz(c, P, d, ms, kat, ms.masaId === sahne.seciliMasaId) });
    }
    for (const b of sahne.bireyler) {
        const r = dondur(d, b.gx + 0.5, b.gy + 0.5);
        ciz.push({ k: r.x + r.y + 0.1, f: () => karakterCiz(c, P, d, b) });
    }
    ciz.sort((a, b) => a.k - b.k);
    for (const x of ciz) x.f();

    // Loş katlar: karartma + lamba ışık havuzları
    const isik = KATLAR[kat].isik;
    if (isik) {
        c.fillStyle = `rgba(12,6,24,${isik})`;
        c.fillRect(0, 0, DOGAL_G, DOGAL_Y);
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (const o of KATLAR[kat].nesneler.filter((x) => x.tur === 'lamba')) {
            const p = P.W(o.gx + 0.5, o.gy + 0.5);
            const g = c.createRadialGradient(p.x, p.y - 10, 4, p.x, p.y - 10, 110);
            g.addColorStop(0, 'rgba(255,200,110,.22)'); g.addColorStop(1, 'rgba(255,200,110,0)');
            c.fillStyle = g;
            c.fillRect(p.x - 110, p.y - 120, 220, 220);
        }
        c.restore();
    }
}

// Ekran katmanı: masa etiketleri, oyun ikonları, baloncuklar. donus(p): doğal → ekran koordinatı
export function ustKatmanCiz(c, olcek, donus, sahne) {
    const P = izdusum(sahne.d);
    const yazi = (t, x, y, { renk = '#2a1d16', zemin = '#fff8e7', kenar = '#5a3a22', boyut = 12 } = {}) => {
        c.font = `bold ${boyut}px ui-monospace, Consolas, monospace`;
        const w = Math.ceil(c.measureText(t).width) + 10, h = boyut + 8;
        const bx = Math.round(x - w / 2), by = Math.round(y - h);
        c.fillStyle = kenar; c.fillRect(bx - 2, by, w + 4, h); c.fillRect(bx, by - 2, w, h + 4);
        c.fillStyle = zemin; c.fillRect(bx, by, w, h);
        c.fillStyle = renk; c.fillText(t, bx + 5, by + boyut + 2);
        return { bx, by, w, h };
    };
    const etiketBoyut = Math.max(9, Math.min(13, Math.round(5 * olcek)));
    for (const m of sahne.masalar) {
        const y = m.yuva;
        const p = donus(P.W(y.gx + y.gw / 2, y.gy + y.gd / 2));
        yazi(`M${m.masaNo}`, p.x, p.y + 10 * olcek + 8, { zemin: m.durumRenk || '#5a3a22', renk: '#fff8e7', kenar: '#2a1d16', boyut: etiketBoyut });
    }
    for (const b of sahne.bireyler) {
        const p = donus(P.W(b.gx + 0.5, b.gy + 0.5));
        const ust = p.y - (b.oturuyor ? 30 : 34) * olcek;
        let ikonUst = ust;
        if (b.ikon) {
            const s = Math.max(10, 7 * olcek);
            c.fillStyle = '#2a1d16'; c.fillRect(p.x - s / 2 - 2, ust - s - 2, s + 4, s + 4);
            c.fillStyle = b.ikon.renk; c.fillRect(p.x - s / 2, ust - s, s, s);
            c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(p.x - s / 2, ust - s, s, Math.max(2, s / 5));
            c.fillStyle = '#fff8e7';
            c.font = `bold ${Math.round(s * 0.62)}px ui-monospace, Consolas, monospace`;
            c.fillText(b.ikon.harf, p.x - s * 0.2, ust - s * 0.24);
            ikonUst = ust - s - 6;
        }
        if (b.baloncuk) {
            const r = yazi(b.baloncuk, p.x, ikonUst - 4, { boyut: Math.max(11, Math.min(14, Math.round(5.5 * olcek))) });
            c.fillStyle = '#fff8e7'; c.fillRect(Math.round(p.x) - 3, r.by + r.h, 6, 4);
        }
    }
}

// ------------------------------------------------------------------ seçim (tıklama)
function tabanKutusu(P, d, gx, gy, gw, gd, h) {
    const r = dikdortgenDondur(d, gx, gy, gw, gd);
    const T = P.R(r.gx, r.gy), B = P.R(r.gx + r.gw, r.gy + r.gd), L = P.R(r.gx, r.gy + r.gd), R = P.R(r.gx + r.gw, r.gy);
    return { x0: L.x, x1: R.x, y0: T.y - h, y1: B.y };
}
const icinde = (k, x, y) => x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1;

// Doğal koordinattaki (x, y) noktada masa veya merdiven
export function nesneBul(sahne, x, y) {
    const P = izdusum(sahne.d);
    const m = MERDIVEN_GOVDE;
    if (icinde(tabanKutusu(P, sahne.d, m.gx, m.gy, m.gw, m.gd, 50), x, y)) return { tur: 'merdiven' };
    const sirali = [...sahne.masalar].sort((a, b) => {
        const ra = dondur(sahne.d, a.yuva.gx, a.yuva.gy), rb = dondur(sahne.d, b.yuva.gx, b.yuva.gy);
        return (rb.x + rb.y) - (ra.x + ra.y);
    });
    for (const ms of sirali) {
        const y0 = ms.yuva;
        if (icinde(tabanKutusu(P, sahne.d, y0.gx - 0.6, y0.gy - 0.6, y0.gw + 1.2, y0.gd + 1.2, 20), x, y)) return { tur: 'masa', masa: ms };
    }
    return null;
}

// Ara tuval: tüm fillRect çağrıları tam piksele yuvarlanır (bulanık kenar olmaz)
export function pikselBaglami(tuval) {
    const c = tuval.getContext('2d');
    const asil = c.fillRect.bind(c);
    c.fillRect = (x, y, w, h) => asil(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    c.imageSmoothingEnabled = false;
    return c;
}

// Oyun kapağı: ada göre üretilen küçük kapak resmi (detay kartı için)
export function kapakCiz(tuval, ad, renkNo) {
    const c = tuval.getContext('2d');
    const W = tuval.width, H = tuval.height;
    const ana = OYUN_RENK[renkNo % OYUN_RENK.length];
    let tohum = 0;
    for (const ch of ad) tohum = (tohum * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { tohum = (tohum * 1103515245 + 12345) >>> 0; return (tohum >>> 8) / 16777216; };
    c.fillStyle = ana; c.fillRect(0, 0, W, H);
    c.fillStyle = ton(ana, 0.7); c.fillRect(0, H * 0.62, W, H * 0.38);
    for (let i = 0; i < 7; i++) {
        c.fillStyle = [ton(ana, 1.3), ton(ana, 0.55), '#fff3d6', '#2a1d16'][i % 4];
        const s = 6 + rnd() * 16;
        c.fillRect(Math.round(rnd() * (W - s)), Math.round(H * 0.3 + rnd() * H * 0.5), Math.round(s), Math.round(s * 0.6));
    }
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, W, 26);
    c.fillStyle = '#fff8e7';
    c.font = 'bold 13px ui-monospace, Consolas, monospace';
    c.fillText(ad.length > 12 ? `${ad.slice(0, 11)}…` : ad, 6, 17);
    c.strokeStyle = '#2a1d16'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, W - 3, H - 3);
}
