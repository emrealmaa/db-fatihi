// Piksel-art izometrik çizim. Sahne ara bir tuvale (DOGAL_G x DOGAL_Y) çizilir; kamera (yakınlaştırma,
// kaydırma) bu tuvali ekrana aktarırken uygulanır. Döndürme dünya koordinatlarında yapılır (harita.js):
// oda 90° döner, kameraya göre arkada kalan iki duvar çizilir ve derinlik sıralaması döndürülmüş
// koordinatlarla yeniden hesaplanır. Tüm şekiller fillRect ile satır/sütun çizildiğinden kenarlar keskin kalır.
import {
    arkaDuvarlar, DERINLIK, dikdortgenDondur, disGorunur, dondur, duvarNoktasi, GENISLIK, IC_DERINLIK,
    ASANSOR_GOVDE, KALDIRIM_Y, KAPI_ARALIK, KATLAR, SAHNE, boyut, YOL_SERITLERI,
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

// Gün evresi (oyun saatinden): gündüz, gün batımı, gece
export const gunEvresi = (saat) => (saat < 17 * 60 ? 'gun' : saat < 19 * 60 ? 'aksam' : 'gece');
const PENCERE = { gun: ['#9fd3e6', '#c9ecf6'], aksam: ['#f3b37a', '#f7cd9d'], gece: ['#1c2a4a', '#2c3f66'] };

// ------------------------------------------------------------------ renk yardımcıları
const ZEMIN = {
    ahsap: ['#c18a55', '#b47e4b', '#cc955f'],
    koyu: ['#5b4636', '#523f31', '#64503f'],
    hali: ['#6e2a3a', '#652434', '#783142'],
};
const BOHEM = ['#a33b20', '#7b2d26', '#2b6cb0', '#c9772a'];
const HALI = {
    mutfak: ['#e9eef2', '#a9bccb'],
    arcade: ['#2a1f3d', '#33264a'],
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
// Kutunun ekranda solda ve sağda görünen yan yüzlerinin dünya yönü (K/B/G/D): bir yüze bakan
// ekran, kapı gibi ayrıntıları yalnızca o yüz görünüyorsa çizmek için
function gorunenYuzler(d) {
    const a = dondur(d, 0, 0);
    const yuz = {};
    for (const [ad, [nx, ny]] of Object.entries({ G: [0, 1], D: [1, 0], K: [0, -1], B: [-1, 0] })) {
        const b = dondur(d, nx, ny);
        const rx = b.x - a.x, ry = b.y - a.y;
        if (Math.abs(rx) < 0.01 && ry > 0.5) yuz.sol = ad;
        if (rx > 0.5 && Math.abs(ry) < 0.01) yuz.sag = ad;
    }
    return yuz;
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

// ------------------------------------------------------------------ arka plan: gökyüzü ve şehir silueti (evreye göre önbellekli)
const arkaPlanOnbellek = new Map();
export const GOK_UST = { gun: '#7fbff0', aksam: '#3a2d6b', gece: '#070b22' };
export function arkaPlan(evre) {
    if (arkaPlanOnbellek.has(evre)) return arkaPlanOnbellek.get(evre);
    const t = document.createElement('canvas');
    t.width = DOGAL_G; t.height = DOGAL_Y;
    const c = pikselBaglami(t);
    const gok = { gun: ['#7fbff0', '#cfe9fb'], aksam: ['#3a2d6b', '#f08a4b'], gece: ['#070b22', '#22204a'] }[evre];
    const g = c.createLinearGradient(0, 0, 0, DOGAL_Y * 0.6);
    g.addColorStop(0, gok[0]); g.addColorStop(1, gok[1]);
    c.fillStyle = g; c.fillRect(0, 0, DOGAL_G, DOGAL_Y);
    let tohum = 7;
    const rnd = () => { tohum = (tohum * 1103515245 + 12345) >>> 0; return (tohum >>> 8) / 16777216; };
    if (evre === 'gece') {
        for (let i = 0; i < 140; i++) { c.fillStyle = rnd() < 0.2 ? '#ffe7a8' : '#ffffff'; c.fillRect(rnd() * DOGAL_G, rnd() * DOGAL_Y * 0.45, 1, 1); }
        c.fillStyle = '#f4efd8'; c.fillRect(DOGAL_G * 0.83, 26, 12, 12); c.fillStyle = gok[0]; c.fillRect(DOGAL_G * 0.83 + 5, 24, 10, 10);   // hilal
    }
    if (evre === 'aksam') { c.fillStyle = '#ffcf6b'; c.fillRect(DOGAL_G * 0.12, 70, 18, 18); }   // batan güneş
    // şehir silueti: binalar ve pencereler
    const taban = DOGAL_Y * 0.42;
    for (let x = -10; x < DOGAL_G; ) {
        const w = 26 + Math.floor(rnd() * 46), hgt = 50 + Math.floor(rnd() * 110);
        c.fillStyle = { gun: '#8fa3b8', aksam: '#3b2f55', gece: '#141631' }[evre];
        c.fillRect(x, taban - hgt, w, hgt + DOGAL_Y);
        for (let py = taban - hgt + 6; py < taban + 40; py += 9) for (let px = x + 4; px < x + w - 4; px += 7) {
            const yanik = evre === 'gece' ? rnd() < 0.45 : evre === 'aksam' ? rnd() < 0.3 : false;
            c.fillStyle = yanik ? (rnd() < 0.8 ? '#ffd27a' : '#bfe3ff') : ({ gun: '#a9bccc', aksam: '#4a3d68', gece: '#1d2142' }[evre]);
            c.fillRect(px, py, 3, 4);
        }
        x += w + 2 + Math.floor(rnd() * 8);
    }
    // ufuktan aşağısı: şehrin karanlık zemini
    const z = c.createLinearGradient(0, taban + 40, 0, DOGAL_Y);
    z.addColorStop(0, { gun: '#6b7c8c', aksam: '#2a2238', gece: '#0d0e1c' }[evre]); z.addColorStop(1, '#0b0b12');
    c.fillStyle = z; c.fillRect(0, taban + 40, DOGAL_G, DOGAL_Y);
    arkaPlanOnbellek.set(evre, t);
    return t;
}

// ------------------------------------------------------------------ zemin ve duvarlar (önbellekli)
const katmanOnbellek = new Map();

function zeminVeDuvarlar(kat, d, evre) {
    const anahtar = `${kat}-${d}-${evre}`;
    if (katmanOnbellek.has(anahtar)) return katmanOnbellek.get(anahtar);
    const tuval = document.createElement('canvas');
    tuval.width = DOGAL_G; tuval.height = DOGAL_Y;
    const c = pikselBaglami(tuval);
    const P = izdusum(d);
    const t = KATLAR[kat];

    const z = ZEMIN[t.zemin];
    for (let gx = 0; gx < GENISLIK; gx++) for (let gy = 0; gy < IC_DERINLIK; gy++) {
        const r = dikdortgenDondur(d, gx, gy, 1, 1);
        elmasR(c, P, r.gx, r.gy, z[(gx + gy) % 2 === 0 ? 0 : ((gx * 7 + gy * 3) % 5 === 0 ? 2 : 1)]);
    }
    if (kat === 1 && disGorunur(d)) disZemin(c, P, d);
    for (const h of t.halilar || []) {
        const renk = HALI[h.renk];
        for (let gx = h.gx; gx < h.gx + h.gw; gx++) for (let gy = h.gy; gy < h.gy + h.gd; gy++) {
            const r = dikdortgenDondur(d, gx, gy, 1, 1);
            const kenar = gx === h.gx || gy === h.gy || gx === h.gx + h.gw - 1 || gy === h.gy + h.gd - 1;
            let renk0 = renk ? renk[(gx + gy) % 2] : null;
            if (h.renk === 'vip' && kenar) renk0 = '#b8892f';
            if (h.renk === 'arcade' && kenar) renk0 = '#5ec8ff';
            if (h.renk === 'bohem') renk0 = kenar ? '#e3b23c' : BOHEM[(gx * 3 + gy * 5) % 4];
            elmasR(c, P, r.gx, r.gy, renk0);
        }
    }
    duvarlariCiz(c, P, kat, d, evre);
    katmanOnbellek.set(anahtar, tuval);
    return tuval;
}

// Kaldırım, bordür ve sokak (yalnızca kat 1, ön cephe kameraya dönükken)
function disZemin(c, P, d) {
    for (let gx = 0; gx < GENISLIK; gx++) {
        const karo = (gy, renk) => { const r = dikdortgenDondur(d, gx, gy, 1, 1); elmasR(c, P, r.gx, r.gy, renk); };
        karo(IC_DERINLIK, (gx % 2) ? '#9c8f7e' : '#a89a88');                 // cephe şeridi (taş)
        karo(KALDIRIM_Y, (gx % 2) ? '#c4bfb5' : '#b9b4aa');                   // kaldırım (kuyruk sırası)
        karo(KALDIRIM_Y + 1, (gx % 2) ? '#b9b4aa' : '#c4bfb5');               // kaldırım (yürüme yolu)
        karo(KALDIRIM_Y + 2, (gx % 2) ? '#4d4d52' : '#47474c');               // yol, doğu şeridi
        karo(KALDIRIM_Y + 3, (gx % 2) ? '#45454a' : '#404045');               // yol, batı şeridi
        karo(KALDIRIM_Y + 4, (gx % 2) ? '#a89f92' : '#b3aa9c');               // karşı kaldırım
        kutu(c, P, d, gx, KALDIRIM_Y + 1.9, 1, 0.1, 2, renkler('#8f8a80'));    // bordür
        kutu(c, P, d, gx, KALDIRIM_Y + 4, 1, 0.1, 2, renkler('#8f8a80'));      // karşı bordür
        if (gx % 3 === 1) kutu(c, P, d, gx + 0.1, KALDIRIM_Y + 2.95, 0.7, 0.1, 0, { ust: '#e3d26b' });   // şerit çizgisi
    }
}

function duvarlariCiz(c, P, kat, d, evre = 'gun') {
    const renk = DUVAR_RENK[kat];
    // Duvarlar iç mekânın (20 x IC_DERINLIK) döndürülmüş dikdörtgeninin arka kenarları boyunca
    const ic = dikdortgenDondur(d, 0, 0, GENISLIK, IC_DERINLIK);
    const sol0 = P.R(ic.gx, ic.gy + ic.gd), kose = P.R(ic.gx, ic.gy), sag0 = P.R(ic.gx + ic.gw, ic.gy);
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
                        // pencereden görünen gökyüzü saate göre
                        c.fillStyle = ton(PENCERE[evre][0], k); c.fillRect(x, y - 67, 1, 30);
                        if (i === Math.floor(n / 2)) { c.fillStyle = ton('#f7f0dd', k); c.fillRect(x, y - 67, 1, 30); }
                        if ((i + 3) % 9 < 2) { c.fillStyle = ton(PENCERE[evre][1], k); c.fillRect(x, y - 64, 1, 10); }
                        if (evre === 'gece' && (i * 7) % 11 === 3) { c.fillStyle = '#f7e6a1'; c.fillRect(x, y - 60, 1, 1); }
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
                case 'poster': {
                    const ust = f.ust ? 82 : 74, boy = 30;
                    const yy = y - ust;
                    if (kenar) { c.fillStyle = '#2a1d16'; c.fillRect(x, yy, 1, boy + 2); break; }
                    c.fillStyle = '#2a1d16'; c.fillRect(x, yy, 1, 1); c.fillRect(x, yy + boy + 1, 1, 1);
                    for (let r = 0; r < boy; r++) {
                        c.fillStyle = ton(posterPikseli(f.oyun, i, r, n, boy), k);
                        c.fillRect(x, yy + 1 + r, 1, 1);
                    }
                    break;
                }
                case 'fayans':
                    // mutfak arka duvarı: beyaz-mavi fayans
                    for (let r = 0; r < 34; r++) {
                        c.fillStyle = ton(((Math.floor(i / 4) + Math.floor(r / 4)) % 2) ? '#e9eef2' : '#c7d6e2', k);
                        if (r % 4 === 3 || i % 4 === 3) c.fillStyle = ton('#9fb0bd', k);
                        c.fillRect(x, y - 58 + r, 1, 1);
                    }
                    break;
                case 'tablo': {
                    // altın çerçeveli koleksiyon tablosu (soyut desen)
                    if (kenar) { c.fillStyle = '#b8892f'; c.fillRect(x, y - 74, 1, 30); break; }
                    c.fillStyle = '#b8892f'; c.fillRect(x, y - 74, 1, 2); c.fillRect(x, y - 46, 1, 2);
                    for (let r = 0; r < 26; r++) {
                        const renk = (Math.sin(i * 0.6 + r * 0.3) + Math.cos(r * 0.4 - i * 0.2) > 0.4) ? '#c0392b'
                            : (i + r) % 9 === 0 ? '#f3e6c4' : r < 12 ? '#2b3a5a' : '#3f6f5a';
                        c.fillStyle = ton(renk, k); c.fillRect(x, y - 72 + r, 1, 1);
                    }
                    break;
                }
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
function nesneCiz(c, P, d, o, sahne = {}) {
    const z0 = o.z || 0;                                   // sahne üstündeki nesneler
    const K = (gx, gy, gw, gd, h, renk, zz = 0) => kutu(c, P, d, gx, gy, gw, gd, h, renk, zz + z0);
    const W = (x, y) => { const q = P.W(x, y); return { x: q.x, y: q.y - z0 }; };
    const celik = (cc, x, y, h, sol, st) => { if (st % 6 === 0) { cc.fillStyle = 'rgba(255,255,255,.18)'; cc.fillRect(x, y, 1, h); } };
    switch (o.tur) {
        // -------------------------------------------------------- mutfak
        case 'ocak': {
            K(o.gx, o.gy + 0.05, o.gw, o.gd - 0.1, o.h, renkler('#9aa3ad', celik));
            const pis = sahne.mutfak?.pisiyor;
            for (const [u, v] of [[0.28, 0.3], [0.72, 0.3], [0.28, 0.72], [0.72, 0.72]]) {
                const q = W(o.gx + u, o.gy + v);
                c.fillStyle = '#2b2b2b'; c.fillRect(q.x - 3, q.y - o.h - 1, 6, 2);
                if (pis) { c.fillStyle = (Math.floor(performance.now() / 120) + u * 10) % 2 < 1 ? '#ff8a3d' : '#ffd166'; c.fillRect(q.x - 2, q.y - o.h - 2, 4, 1); }
            }
            K(o.gx + 0.15, o.gy + 0.2, 0.3, 0.3, 6, renkler('#5b6470'), o.h);                // tencere
            K(o.gx + 0.55, o.gy + 0.55, 0.32, 0.2, 2, renkler('#2b2b2b'), o.h);              // tava
            if (pis) { const q = W(o.gx + 0.3, o.gy + 0.35); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(q.x, q.y - o.h - 14, 1, 5); c.fillRect(q.x + 2, q.y - o.h - 18, 1, 5); }
            break;
        }
        case 'firin': {
            K(o.gx, o.gy + 0.05, o.gw, o.gd - 0.1, o.h, renkler('#3b3f45', celik));
            const q = W(o.gx + 0.5, o.gy + o.gd);
            c.fillStyle = sahne.mutfak?.pisiyor ? '#ff9b4a' : '#5a3a22'; c.fillRect(q.x - 6, q.y - o.h + 8, 12, 7);
            c.fillStyle = '#c9ced4'; c.fillRect(q.x - 6, q.y - o.h + 5, 12, 1);
            break;
        }
        case 'buzdolabi': {
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, o.h, renkler('#d9dee3', celik));
            const q = W(o.gx + 0.5, o.gy + o.gd);
            c.fillStyle = '#7f8a94'; c.fillRect(q.x + 4, q.y - o.h + 8, 1, 14); c.fillRect(q.x + 4, q.y - o.h + 28, 1, 10);
            c.fillStyle = '#b8c0c8'; c.fillRect(q.x - 8, q.y - o.h + 24, 16, 1);
            break;
        }
        case 'evye':
            K(o.gx, o.gy + 0.05, o.gw, o.gd - 0.1, o.h, renkler('#9aa3ad', celik));
            K(o.gx + 0.2, o.gy + 0.25, 0.6, 0.5, 0, { ust: '#5b6470' }, o.h);
            { const q = W(o.gx + 0.5, o.gy + 0.2); c.fillStyle = '#c9ced4'; c.fillRect(q.x, q.y - o.h - 8, 1, 8); c.fillRect(q.x, q.y - o.h - 8, 4, 1); }
            break;
        case 'hazirlik': {
            K(o.gx, o.gy + 0.05, o.gw, o.gd - 0.1, o.h, renkler('#9aa3ad', celik));
            K(o.gx + 0.15, o.gy + 0.25, 0.6, 0.45, 2, renkler('#c9a46b'), o.h);               // kesme tahtası
            const q = W(o.gx + 0.45, o.gy + 0.45);
            c.fillStyle = '#d94f3d'; c.fillRect(q.x - 4, q.y - o.h - 4, 3, 2);
            c.fillStyle = '#5fb36d'; c.fillRect(q.x, q.y - o.h - 4, 3, 2);
            c.fillStyle = '#e3b23c'; c.fillRect(q.x + 3, q.y - o.h - 3, 2, 2);
            break;
        }
        case 'servistezgahi': {
            // pas tezgahı: üstte ısıtıcı lamba çubuğu, hazır tabaklar
            K(o.gx, o.gy + 0.1, o.gw, o.gd - 0.2, o.h, renkler('#7f8a94', celik));
            K(o.gx - 0.03, o.gy + 0.07, o.gw + 0.06, o.gd - 0.14, 2, renkler('#d9dee3'), o.h);
            for (let i = 0; i < Math.min(4, sahne.mutfak?.hazir || 0); i++) {
                K(o.gx + 0.3 + i * 0.9, o.gy + 0.35, 0.36, 0.3, 1, renkler('#f4efe6'), o.h + 2);
                K(o.gx + 0.38 + i * 0.9, o.gy + 0.42, 0.2, 0.16, 2, renkler(['#c0703a', '#e3b23c', '#f06292', '#5fb36d'][i]), o.h + 3);
            }
            K(o.gx + 0.1, o.gy + 0.45, o.gw - 0.2, 0.1, 2, renkler('#3b3b3b'), o.h + 34);    // lamba çubuğu
            for (let i = 0; i < o.gw; i++) { const q = W(o.gx + i + 0.5, o.gy + 0.5); c.fillStyle = 'rgba(255,170,70,.35)'; c.fillRect(q.x - 5, q.y - o.h - 32, 10, 30); }
            break;
        }
        // -------------------------------------------------------- kat 2 eğlence: kitaplık, atari, tilt, stand
        case 'sokaklambasi': {
            const q = W(o.gx + 0.15, o.gy + 0.15);
            c.fillStyle = '#2b2f36'; c.fillRect(q.x - 1, q.y - o.h, 2, o.h); c.fillRect(q.x - 3, q.y - 2, 6, 2);
            c.fillRect(q.x, q.y - o.h, 7, 2);
            const yanik = sahne.lambalar;
            c.fillStyle = yanik ? '#fff1b8' : '#8a8f96'; c.fillRect(q.x + 5, q.y - o.h + 1, 4, 3);
            if (yanik) {
                c.save(); c.globalAlpha = 0.18;
                c.fillStyle = '#ffd27a';
                for (let i = 0; i < o.h - 6; i++) c.fillRect(q.x + 7 - i * 0.45, q.y - o.h + 4 + i, 2 + i * 0.9, 1);
                c.restore();
            }
            break;
        }
        case 'agac': {
            const q = W(o.gx + 0.3, o.gy + 0.3);
            c.fillStyle = '#5a3a22'; c.fillRect(q.x - 1, q.y - 14, 3, 14);
            const yap = sahne.evre === 'gece' ? ['#1f3d2c', '#24472f', '#2c5638'] : ['#2f7a3f', '#3f8f4f', '#5fb36d'];
            for (let i = 0; i < 14; i++) { c.fillStyle = yap[i % 3]; c.fillRect(q.x - 10 + (i * 7) % 20, q.y - 34 + ((i * 5) % 16), 7, 7); }
            break;
        }
        case 'kitaplik':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#4a2c1a', rafDeseni));
            K(o.gx - 0.06, o.gy - 0.03, o.gw + 0.12, o.gd + 0.06, 4, renkler('#6b3f22'), o.h);           // korniş
            for (let i = 0; i < o.gw; i += 2) {                                                            // raf lambaları
                const q = W(o.gx + i + 1, o.gy + o.gd);
                c.fillStyle = 'rgba(255,214,140,.5)'; c.fillRect(q.x - 6, q.y - o.h - 1, 12, 2);
            }
            break;
        case 'atari': {
            // retro arcade kabini: üstte ışıklı başlık, ortada yanıp sönen ekran, altta kontrol paneli
            const yz = gorunenYuzler(d);
            const t = Math.floor(performance.now() / 180);
            K(o.gx + 0.1, o.gy + 0.1, 0.8, 0.8, o.h, renkler(o.renk, (cc, x, y, h, sol, st) => {
                if ((sol ? yz.sol : yz.sag) !== o.on) return;
                cc.fillStyle = '#ffd166'; cc.fillRect(x, y + 3, 1, 5);
                cc.fillStyle = '#111'; cc.fillRect(x, y + 10, 1, 16);
                if (st > 1 && st < 16) { cc.fillStyle = ['#5ec8ff', '#ff5ea8', '#7cf29a', '#ffd166'][(Math.floor(st / 3) + t) % 4]; cc.fillRect(x, y + 12 + ((st + t) % 3), 1, 9); }
                cc.fillStyle = '#2b2b2b'; cc.fillRect(x, y + 28, 1, 5);
                if (st % 6 === 2) { cc.fillStyle = '#d94f3d'; cc.fillRect(x, y + 27, 1, 2); }
            }));
            K(o.gx + 0.06, o.gy + 0.06, 0.88, 0.88, 3, renkler('#1c1c1c'), o.h);
            break;
        }
        case 'pinball': {
            // tilt: ayaklar, eğik oyun alanı (lambalar, tamponlar), duvar tarafında ışıklı arka kutu
            for (const v of [0.15, o.gd - 0.3]) K(o.gx + 0.15, o.gy + v, 0.1, 0.12, 10, renkler('#2b2b2b'));
            K(o.gx + 0.1, o.gy + 0.08, 0.8, o.gd - 0.16, 6, renkler(o.renk), 10);
            K(o.gx + 0.16, o.gy + 0.14, 0.68, o.gd - 0.28, 0, { ust: '#1f3f66' }, 16);
            const t = Math.floor(performance.now() / 250);
            [[0.3, 0.35], [0.6, 0.6], [0.35, 0.95], [0.62, 1.25]].forEach(([u, v], i) => {
                K(o.gx + u, o.gy + v, 0.1, 0.1, 2, renkler(['#ffd166', '#ff5ea8', '#7cf29a', '#5ec8ff'][(i + t) % 4]), 16);
            });
            K(o.gx + 0.7, o.gy + 0.1, 0.2, o.gd - 0.2, 26, renkler('#1c1c1c', (cc, x, y, h, sol, st) => {
                if (st % 4 < 2) { cc.fillStyle = ['#ff5ea8', '#ffd166'][(st + t) % 2]; cc.fillRect(x, y + 4, 1, 10); }
            }), 16);
            break;
        }
        case 'oyunstandi': {
            K(o.gx + 0.15, o.gy + 0.15, 0.7, 0.7, 8, renkler('#3b2418'));
            ['#d94f3d', '#3d7fd9', '#e3b23c', '#4caf6a'].forEach((r, i) => K(o.gx + 0.2 + (i % 2) * 0.3, o.gy + 0.22 + Math.floor(i / 2) * 0.3, 0.26, 0.26, 7 + (i % 2) * 3, renkler(r), 8));
            const q = W(o.gx + 0.5, o.gy + 0.5);
            c.fillStyle = '#ffd166'; c.fillRect(q.x - 9, q.y - o.h - 4, 18, 5);
            c.fillStyle = '#2a1d16'; c.fillRect(q.x - 7, q.y - o.h - 3, 14, 1);
            break;
        }
        // -------------------------------------------------------- kat 3 sahne ışıkları ve figür kaideleri
        case 'spot': {
            const q = W(o.gx + 0.1, o.gy + 0.1);
            c.fillStyle = '#2b2b2b'; c.fillRect(q.x, q.y - o.h, 2, o.h);
            c.fillStyle = o.renk; c.fillRect(q.x - 2, q.y - o.h - 4, 6, 4);
            c.save(); c.globalAlpha = 0.16 + 0.06 * Math.sin(performance.now() / 300);
            c.fillStyle = o.renk;
            for (let i = 0; i < 30; i++) c.fillRect(q.x - 2 - i * 1.3, q.y - o.h + i * 1.4, 4 + i * 1.6, 2);
            c.restore();
            break;
        }
        case 'figurstandi': {
            // boyalı nadir FRP figürü: beyaz kaide, cam fanus, figür
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#efe6d8'));
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, 2, renkler('#b8892f'), o.h);
            const q = W(o.gx + o.gw / 2, o.gy + o.gd / 2);
            const y0 = q.y - o.h - 2;
            if (o.figur === 'ejderha') {
                c.fillStyle = '#2e8b57'; c.fillRect(q.x - 4, y0 - 9, 8, 7); c.fillRect(q.x + 2, y0 - 13, 4, 5);
                c.fillStyle = '#1f6b42'; c.fillRect(q.x - 7, y0 - 11, 4, 3); c.fillRect(q.x + 4, y0 - 9, 4, 2);
                c.fillStyle = '#e3b23c'; c.fillRect(q.x + 4, y0 - 12, 1, 1);
            } else if (o.figur === 'sovalye') {
                c.fillStyle = '#9aa3ad'; c.fillRect(q.x - 2, y0 - 12, 4, 10);
                c.fillStyle = '#c0392b'; c.fillRect(q.x - 3, y0 - 8, 6, 3);
                c.fillStyle = '#e9ecef'; c.fillRect(q.x + 3, y0 - 15, 1, 12);
            } else {
                c.fillStyle = '#6b4a8a'; c.fillRect(q.x - 3, y0 - 10, 6, 8); c.fillRect(q.x - 1, y0 - 14, 3, 4);
                c.fillStyle = '#5ec8ff'; c.fillRect(q.x + 4, y0 - 13, 2, 2);
                c.fillStyle = '#7a5232'; c.fillRect(q.x + 4, y0 - 11, 1, 9);
            }
            c.fillStyle = 'rgba(210,235,245,.28)'; c.fillRect(q.x - 8, y0 - 17, 16, 16);
            c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(q.x - 6, y0 - 15, 1, 8);
            break;
        }
        // -------------------------------------------------------- kat 2 okuma köşesi
        case 'okumakoltugu':
            K(o.gx + 0.1, o.gy + 0.1, 0.8, 0.8, 9, renkler('#3f6f5a'));
            K(o.gx + 0.7, o.gy + 0.1, 0.2, 0.8, 18, renkler('#355e4c'), 0);
            K(o.gx + 0.1, o.gy + 0.1, 0.6, 0.15, 13, renkler('#355e4c'), 0);
            K(o.gx + 0.1, o.gy + 0.75, 0.6, 0.15, 13, renkler('#355e4c'), 0);
            K(o.gx + 0.25, o.gy + 0.3, 0.4, 0.4, 2, renkler('#e3b23c'), 9);                   // yastık
            break;
        case 'kitapyigini': {
            K(o.gx + 0.25, o.gy + 0.25, 0.5, 0.5, 8, renkler('#7a5232'));
            ['#a33b20', '#2b6cb0', '#e3b23c', '#3f8f4f'].forEach((r, i) => K(o.gx + 0.3 + (i % 2) * 0.05, o.gy + 0.32, 0.38, 0.32, 2, renkler(r), 8 + i * 2));
            break;
        }
        // -------------------------------------------------------- kat 3 sahne, müzik, koleksiyon
        case 'yarimsahne': {
            // ince şeritlerden oluşan yarım daire; şeritler kameraya göre arkadan öne çizilir
            const { cx, cy, r } = SAHNE;
            const ad = 0.16;
            const seritler = [];
            for (let dx = 0; dx < r; dx += ad) {
                const yari = Math.sqrt(Math.max(0, r * r - (dx + ad / 2) ** 2));
                const q = dondur(d, cx + dx + ad / 2, cy);
                seritler.push({ dx, yari, k: q.x + q.y });
            }
            seritler.sort((a, b) => a.k - b.k);
            const isik = (cc, x, y, hh, sol, st) => {
                if (st % 6 === 0) { cc.fillStyle = (Math.floor(performance.now() / 400) + st / 6) % 2 < 1 ? '#ffd166' : '#ff8a3d'; cc.fillRect(x, y + 2, 1, 2); }
            };
            for (const sr of seritler) {
                K(cx + sr.dx, cy - sr.yari, ad, sr.yari * 2, o.h, renkler('#3b2418', isik));
                if (sr.yari > 0.25) K(cx + sr.dx, cy - sr.yari + 0.12, ad, sr.yari * 2 - 0.24, 0, { ust: (Math.floor((sr.dx + 0.2) / 0.8) % 2) ? '#5a3424' : '#4e2d1f' }, o.h);
            }
            break;
        }
        case 'sahne':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#3b2418', (cc, x, y, h, sol, st) => {
                if (st % 8 === 0) { cc.fillStyle = (Math.floor(performance.now() / 400) + st / 8) % 2 < 1 ? '#ffd166' : '#ff8a3d'; cc.fillRect(x, y + 2, 1, 2); }
            }));
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, 0, { ust: '#5a3424' }, o.h);
            break;
        case 'piyano': {
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#1c1c1c'));
            K(o.gx + 0.05, o.gy + o.gd - 0.22, o.gw - 0.1, 0.18, 2, { ust: '#f4efe6', sol: '#d9d2c5', sag: '#c9c2b5' }, o.h - 6);
            K(o.gx, o.gy, o.gw, 0.12, 12, renkler('#1c1c1c'), o.h);                            // kapak
            break;
        }
        case 'mikrofon': {
            const q = W(o.gx + 0.15, o.gy + 0.15);
            c.fillStyle = '#2b2b2b'; c.fillRect(q.x - 3, q.y - 1, 6, 1); c.fillRect(q.x, q.y - o.h, 1, o.h);
            c.fillStyle = '#9aa3ad'; c.fillRect(q.x - 1, q.y - o.h - 3, 3, 3);
            break;
        }
        case 'amfi':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#2b2b2b', (cc, x, y, h, sol, st) => { if (st % 3 === 1) { cc.fillStyle = '#444'; cc.fillRect(x, y + 3, 1, h - 6); } }));
            break;
        case 'koleksiyon': {
            // cam vitrin: raflarda koleksiyonluk figürler ve özel kutular
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, 4, renkler('#3b2418'));
            K(o.gx + 0.08, o.gy + 0.08, o.gw - 0.16, o.gd - 0.16, o.h - 8, {
                ust: 'rgba(200,235,245,.25)', sol: 'rgba(170,215,230,.3)', sag: 'rgba(150,195,215,.3)',
                desen: (cc, x, y, h, sol, st) => {
                    for (let r = 0; r < 3; r++) {
                        const yy = y + 4 + r * Math.floor((h - 6) / 3);
                        cc.fillStyle = '#b8892f'; cc.fillRect(x, yy + 7, 1, 1);
                        if (st % 5 < 2) { cc.fillStyle = ['#2e8b57', '#c0392b', '#e3b23c', '#9b59b6', '#3d7fd9'][(st + r * 2) % 5]; cc.fillRect(x, yy + 2 + (st % 2), 1, 5 - (st % 2)); }
                    }
                },
            }, 4);
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, 2, renkler('#3b2418'), o.h - 4);
            break;
        }
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
            // gövde, üstte fincan ısıtıcı, grup başlığı + portafiltre, buhar çubuğu, damlama tepsisi
            K(o.gx + 0.1, o.gy + 0.12, 0.8, 0.62, 18, renkler('#b8c0c8'), o.h);
            K(o.gx + 0.12, o.gy + 0.14, 0.76, 0.58, 2, renkler('#7f8a94'), o.h + 18);
            for (let i = 0; i < 3; i++) K(o.gx + 0.2 + i * 0.2, o.gy + 0.25, 0.14, 0.14, 3, renkler('#f4efe6'), o.h + 20);
            K(o.gx + 0.15, o.gy + 0.7, 0.7, 0.18, 2, renkler('#3b3b3b'), o.h);
            const p = W(o.gx + 0.5, o.gy + 0.75);
            c.fillStyle = '#2b2b2b'; c.fillRect(p.x - 5, p.y - o.h - 13, 4, 3); c.fillRect(p.x + 3, p.y - o.h - 13, 4, 3);
            c.fillStyle = '#5a3a22'; c.fillRect(p.x - 8, p.y - o.h - 12, 4, 2);      // portafiltre sapı
            c.fillStyle = '#e9ecef'; c.fillRect(p.x + 8, p.y - o.h - 16, 1, 9);      // buhar çubuğu
            c.fillStyle = '#f4efe6'; c.fillRect(p.x - 4, p.y - o.h - 6, 3, 3);       // fincan
            c.fillStyle = '#d94f3d'; c.fillRect(p.x + 1, p.y - o.h - 19, 2, 2);      // ışık
            c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(p.x - 3, p.y - o.h - 27, 1, 4); c.fillRect(p.x - 1, p.y - o.h - 30, 1, 4);
            break;
        }
        case 'arkaraf':
            // bar arkasında şişe ve kavanoz rafı
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#5e3b1f', (cc, x, y, h, sol, sutun) => {
                for (let k = 0; k < 3; k++) {
                    if (sutun % 4 === 3) continue;
                    const renk = ['#3f8f4f', '#a33b20', '#e3b23c', '#2b6cb0', '#f4efe6', '#7a4b2a'][(Math.floor(sutun / 4) + k * 2) % 6];
                    const boy = 6 + ((Math.floor(sutun / 4) + k) % 3);
                    cc.fillStyle = sol ? renk : ton(renk, 0.8);
                    cc.fillRect(x, y + 4 + k * 13 + (9 - boy), 1, boy);
                    if (sutun % 4 === 1) { cc.fillStyle = '#2a1d16'; cc.fillRect(x, y + 4 + k * 13 + (9 - boy) - 2, 1, 2); }
                }
            }));
            break;
        case 'pasta': {
            // cam fanuslu pasta standı
            const p = W(o.gx + 0.5, o.gy + 0.5);
            c.fillStyle = '#e9ecef'; c.fillRect(p.x - 1, p.y - o.h - 6, 2, 6); c.fillRect(p.x - 7, p.y - o.h - 7, 14, 1);
            c.fillStyle = '#f3c27a'; c.fillRect(p.x - 6, p.y - o.h - 12, 12, 5);
            c.fillStyle = '#f06292'; c.fillRect(p.x - 6, p.y - o.h - 13, 12, 1); c.fillRect(p.x - 1, p.y - o.h - 15, 2, 2);
            c.fillStyle = '#fff3d6'; c.fillRect(p.x - 6, p.y - o.h - 10, 12, 1);
            c.fillStyle = 'rgba(210,235,245,.45)'; c.fillRect(p.x - 8, p.y - o.h - 20, 16, 13);
            c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(p.x - 6, p.y - o.h - 18, 1, 6);
            break;
        }
        case 'saksi': {
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#8a5d36'));
            const p = W(o.gx + o.gw / 2, o.gy + o.gd / 2);
            for (let i = 0; i < 7; i++) { c.fillStyle = ['#2f7a3f', '#3f8f4f', '#5fb36d'][i % 3]; c.fillRect(p.x - 6 + (i * 5) % 12, p.y - o.h - 6 - (i * 3) % 7, 3, 6); }
            c.fillStyle = '#f06292'; c.fillRect(p.x - 2, p.y - o.h - 12, 2, 2); c.fillRect(p.x + 3, p.y - o.h - 9, 2, 2);
            break;
        }
        case 'bank':
            K(o.gx, o.gy, o.gw, o.gd, 2, renkler('#7a5232'), o.h - 2);
            K(o.gx + 0.1, o.gy + 0.1, 0.1, o.gd - 0.2, o.h - 2, renkler('#2b2b2b'));
            K(o.gx + o.gw - 0.2, o.gy + 0.1, 0.1, o.gd - 0.2, o.h - 2, renkler('#2b2b2b'));
            K(o.gx, o.gy, o.gw, 0.1, 8, renkler('#7a5232'), o.h);
            break;
        case 'menutahta': {
            // kaldırımdaki A tipi tebeşir tahtası
            const p = W(o.gx + 0.25, o.gy + 0.2);
            c.fillStyle = '#5a3a22'; c.fillRect(p.x - 7, p.y - o.h, 14, o.h);
            c.fillStyle = '#2f3b33'; c.fillRect(p.x - 6, p.y - o.h + 1, 12, o.h - 4);
            c.fillStyle = '#f4efe6';
            for (let i = 0; i < 4; i++) c.fillRect(p.x - 4, p.y - o.h + 4 + i * 3, 4 + (i * 3) % 5, 1);
            c.fillStyle = '#e3b23c'; c.fillRect(p.x + 2, p.y - o.h + 4, 2, 2);
            break;
        }
        case 'cephe':
            // ön cephe: alçak duvar (kesit) + üst kapak; içerisi görünsün diye yarım yükseklik
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#9b6a3f', (cc, x, y, h, sol, sutun) => {
                if (sutun % 12 === 0) { cc.fillStyle = 'rgba(0,0,0,.18)'; cc.fillRect(x, y, 1, h); }
            }));
            K(o.gx - 0.02, o.gy - 0.04, o.gw + 0.04, o.gd + 0.08, 2, renkler('#e8d6b3'), o.h);
            break;
        case 'direk':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#7a4b2a'));
            break;
        case 'tente':
            // kırmızı-krem çizgili tente
            K(o.gx, o.gy, o.gw, o.gd, 8, renkler('#c0392b', (cc, x, y, h, sol, sutun) => {
                if (Math.floor(sutun / 4) % 2) { cc.fillStyle = sol ? '#f4efe6' : '#d9d2c5'; cc.fillRect(x, y, 1, h); }
            }), o.z);
            break;
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

// Asansör: fırçalanmış çelik kuyu, güney yüzünde (dünya) kapı. Kapı yüzü kameraya dönükse çizilir;
// biri binerken/inerken kapı açık (içerisi ışıklı).
function asansorCiz(c, P, d, kat, acik) {
    const m = ASANSOR_GOVDE;
    const YUK = 80;
    kutu(c, P, d, m.gx, m.gy, m.gw, m.gd, YUK, renkler('#8f98a3', (cc, x, y, h, sol, st) => {
        if (st % 5 === 0) { cc.fillStyle = 'rgba(255,255,255,.14)'; cc.fillRect(x, y, 1, h); }
        if (st % 23 === 0) { cc.fillStyle = 'rgba(0,0,0,.18)'; cc.fillRect(x, y, 1, h); }
    }));
    kutu(c, P, d, m.gx - 0.04, m.gy - 0.04, m.gw + 0.08, m.gd + 0.08, 4, renkler('#5b6470'), YUK);
    const a = dondur(d, 0, 0), b = dondur(d, 0, 1);
    if ((b.x - a.x) + (b.y - a.y) <= 0) return;           // kapı yüzü arkada
    const yuz = m.gy + m.gd - 0.03;
    kutu(c, P, d, m.gx + 0.18, yuz, m.gw - 0.36, 0.05, 60, renkler('#3b4048'));              // kasa
    if (acik) {
        kutu(c, P, d, m.gx + 0.26, yuz - 0.01, m.gw - 0.52, 0.06, 54, { ust: '#ffe7a8', sol: '#f3d88a', sag: '#e9cd7c' });
        kutu(c, P, d, m.gx + 0.22, yuz - 0.02, 0.1, 0.07, 54, renkler('#c4ccd4'));
        kutu(c, P, d, m.gx + m.gw - 0.32, yuz - 0.02, 0.1, 0.07, 54, renkler('#c4ccd4'));
    } else {
        kutu(c, P, d, m.gx + 0.26, yuz - 0.01, (m.gw - 0.52) / 2 - 0.01, 0.06, 54, renkler('#c4ccd4'));
        kutu(c, P, d, m.gx + m.gw / 2 + 0.01, yuz - 0.01, (m.gw - 0.52) / 2 - 0.01, 0.06, 54, renkler('#b5bec7'));
    }
    const dugme = P.W(m.gx + m.gw - 0.1, yuz + 0.05);
    c.fillStyle = '#2b2b2b'; c.fillRect(dugme.x - 2, dugme.y - 34, 4, 8);
    c.fillStyle = '#ffd166'; c.fillRect(dugme.x - 1, dugme.y - 33, 2, 2); c.fillRect(dugme.x - 1, dugme.y - 30, 2, 2);
}

// Masa: ayaklar + köşeleri yumuşatılmış ahşap tabla + oyun matı (yeşil keçe / kırmızı örtü / FRP haritası)
function masaCiz(c, P, d, m, kat, secili) {
    const y = m.yuva;
    const ahsap = kat === 3 ? '#6b3f22' : kat === 2 ? '#7a5533' : '#c29061';
    const tahta = renkler(ahsap, (cc, x, yy, h, sol, sutun) => { if (sutun % 9 === 4) { cc.fillStyle = 'rgba(0,0,0,.12)'; cc.fillRect(x, yy, 1, h); } });
    const minder = y.tip === 'minder';                       // yer minderli alçak sehpa
    const AYAK = minder ? 3 : 12, KALINLIK = minder ? 3 : 4, UST = AYAK + KALINLIK;
    const p = 0.03, k = 0.15;                            // kenar payı, köşe yumuşatma
    for (const [ax, ay] of [[0.18, 0.18], [y.gw - 0.3, 0.18], [0.18, y.gd - 0.3], [y.gw - 0.3, y.gd - 0.3]]) {
        kutu(c, P, d, y.gx + ax, y.gy + ay, 0.12, 0.12, AYAK, renkler(ton(ahsap, 0.7)));
    }
    // köşesiz iki dikdörtgenin birleşimi: yuvarlatılmış tabla
    kutu(c, P, d, y.gx + p + k, y.gy + p, y.gw - 2 * (p + k), y.gd - 2 * p, KALINLIK, tahta, AYAK);
    kutu(c, P, d, y.gx + p, y.gy + p + k, y.gw - 2 * p, y.gd - 2 * (p + k), KALINLIK, tahta, AYAK);
    kutu(c, P, d, y.gx + p + k, y.gy + p, y.gw - 2 * (p + k), y.gd - 2 * p, KALINLIK, tahta, AYAK);
    // mat
    const mat = { gx: y.gx + 0.18, gy: y.gy + 0.18, gw: y.gw - 0.36, gd: y.gd - 0.36 };
    if (y.sekil === 'harita') {
        const n = 3;
        for (let i = 0; i < y.gw * n; i++) for (let j = 0; j < y.gd * n; j++) {
            const renk = ['#5f9e5a', '#4b8a4a', '#3d7fd9', '#c9b27c'][((i * 5 + j * 3) ^ (i * j)) % 4];
            const w = mat.gw / (y.gw * n), h = mat.gd / (y.gd * n);
            kutu(c, P, d, mat.gx + i * w, mat.gy + j * h, w, h, 0, { ust: renk }, UST);
        }
    } else {
        const matRenk = minder ? '#c9772a' : kat === 1 ? '#efe3c8' : kat === 2 ? '#2f6b45' : '#a8282f';
        kutu(c, P, d, mat.gx, mat.gy, mat.gw, mat.gd, 0, { ust: matRenk }, UST);
        kutu(c, P, d, mat.gx + 0.05, mat.gy + 0.05, mat.gw - 0.1, 0.04, 0, { ust: ton(matRenk, 1.15) }, UST);
    }
    if (secili) kutu(c, P, d, y.gx + p, y.gy + p, y.gw - 2 * p, y.gd - 2 * p, 0, { ust: 'rgba(255,226,122,.45)' }, UST + 1);
    const orta = P.W(y.gx + y.gw / 2, y.gy + y.gd / 2);
    if (m.oyunAd) masaOyunu(c, P, d, mat, UST, m.oyunAd, m.oyunRenk);
    if (m.kirli) {
        c.fillStyle = '#e9ecef'; c.fillRect(orta.x - 6, orta.y - UST - 4, 4, 3); c.fillRect(orta.x + 3, orta.y - UST - 3, 3, 3);
        c.fillStyle = '#8d6e63'; c.fillRect(orta.x - 5, orta.y - UST - 4, 2, 1);
    }
}

// Masanın üstündeki oyun: oyuna özel minyatürler. Konumlar mat içinde oransal (u, v ∈ 0..1) verilir,
// böylece masa boyutu ve kamera açısı değişse de doğru yerde kalır.
function masaOyunu(c, P, d, mat, z, ad, renk) {
    const K = (u, v, w, h, yuk, r, ek = 0) => kutu(c, P, d, mat.gx + u * mat.gw, mat.gy + v * mat.gd, w * mat.gw, h * mat.gd, yuk, typeof r === 'string' ? renkler(r) : r, z + ek);
    const N = (u, v) => P.W(mat.gx + u * mat.gw, mat.gy + v * mat.gd);
    const piyon = (u, v, r) => { const q = N(u, v); c.fillStyle = r; c.fillRect(q.x - 1, q.y - z - 5, 3, 4); c.fillRect(q.x, q.y - z - 7, 1, 2); };
    const zar = (u, v) => K(u, v, 0.1, 0.1, 2, '#f4efe6');
    const a = ad.toLocaleLowerCase('tr');
    if (/catan/.test(a)) {
        // altıgen arazi karoları + ahşap yollar + yerleşimler
        const arazi = ['#e3b23c', '#4caf6a', '#c0703a', '#9aa3ad', '#7cb342', '#d9c39a', '#3f8f4f'];
        [[0.42, 0.4], [0.24, 0.3], [0.6, 0.3], [0.24, 0.55], [0.6, 0.55], [0.42, 0.65], [0.42, 0.15]].forEach(([u, v], i) => K(u - 0.1, v - 0.1, 0.2, 0.2, 1, arazi[i]));
        K(0.33, 0.48, 0.18, 0.04, 1, '#8b5a2b', 1); K(0.52, 0.27, 0.04, 0.16, 1, '#8b5a2b', 1);
        K(0.3, 0.42, 0.06, 0.06, 3, '#d94f3d', 1); K(0.58, 0.44, 0.06, 0.06, 3, '#3d7fd9', 1);
    } else if (/carcassonne/.test(a)) {
        [[0.2, 0.25], [0.42, 0.25], [0.42, 0.47], [0.64, 0.47], [0.2, 0.47]].forEach(([u, v]) => {
            K(u, v, 0.2, 0.2, 1, '#5fa35a'); K(u + 0.08, v, 0.04, 0.2, 0, { ust: '#c9a46b' }, 1);
        });
        K(0.44, 0.27, 0.16, 0.1, 3, '#9aa3ad', 1);                 // kale
        piyon(0.3, 0.35, '#d94f3d'); piyon(0.55, 0.57, '#3d7fd9'); piyon(0.75, 0.55, '#e3b23c');
    } else if (/ticket|tren/.test(a)) {
        K(0.1, 0.12, 0.8, 0.6, 0, { ust: '#e9dcb8' });
        K(0.15, 0.3, 0.6, 0.03, 0, { ust: '#d94f3d' }, 1); K(0.3, 0.15, 0.03, 0.5, 0, { ust: '#3d7fd9' }, 1);
        K(0.5, 0.45, 0.35, 0.03, 0, { ust: '#4caf6a' }, 1);
        K(0.7, 0.78, 0.16, 0.12, 3, '#f4efe6'); K(0.72, 0.8, 0.12, 0.08, 1, '#e3b23c', 3);   // kart destesi
    } else if (/codenames/.test(a)) {
        for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
            const r = (i * 3 + j * 7) % 9 === 0 ? '#d94f3d' : (i * 5 + j) % 7 === 0 ? '#3d7fd9' : '#efe3c8';
            K(0.12 + i * 0.16, 0.15 + j * 0.18, 0.13, 0.14, 1, r);
        }
    } else if (/dixit/.test(a)) {
        ['#9b59b6', '#e07b39', '#2bb0a8', '#f06292', '#e3b23c'].forEach((r, i) => K(0.18 + i * 0.13, 0.3 + (i % 2) * 0.06, 0.12, 0.2, 1, r, i * 0.3));
        piyon(0.5, 0.75, '#ffffff'); piyon(0.65, 0.72, '#7cb342');
    } else if (/uno/.test(a)) {
        K(0.2, 0.35, 0.18, 0.26, 4, '#1c1c1c'); K(0.22, 0.37, 0.14, 0.22, 0, { ust: '#d94f3d' }, 4);   // çekme destesi
        ['#d94f3d', '#e3b23c', '#4caf6a', '#3d7fd9'].forEach((r, i) => K(0.48 + i * 0.03, 0.33 + i * 0.03, 0.18, 0.26, 1, r, i * 0.5));
    } else if (/pandemic/.test(a)) {
        K(0.1, 0.12, 0.8, 0.6, 0, { ust: '#1f3f66' });
        [[0.25, 0.3], [0.5, 0.25], [0.65, 0.5], [0.35, 0.55]].forEach(([u, v]) => K(u, v, 0.06, 0.06, 2, '#d94f3d', 0));
        piyon(0.45, 0.42, '#f4efe6'); piyon(0.6, 0.35, '#7cb342');
    } else if (/azul/.test(a)) {
        [[0.2, 0.2], [0.5, 0.15], [0.75, 0.3], [0.3, 0.55], [0.65, 0.6]].forEach(([u, v], i) => {
            K(u - 0.08, v - 0.08, 0.16, 0.16, 1, '#f4efe6');
            K(u - 0.04, v - 0.04, 0.05, 0.05, 1, ['#3d7fd9', '#e3b23c', '#d94f3d', '#1c1c1c', '#2bb0a8'][i], 1);
        });
    } else if (/splendor/.test(a)) {
        ['#d94f3d', '#3d7fd9', '#4caf6a', '#f4efe6', '#1c1c1c', '#e3b23c'].forEach((r, i) => K(0.15 + i * 0.12, 0.2, 0.09, 0.09, 2 + (i % 3) * 2, r));
        for (let i = 0; i < 4; i++) K(0.15 + i * 0.18, 0.5, 0.14, 0.2, 1, ['#c9a46b', '#8bb5c9', '#b5c98b', '#c98bb5'][i]);
    } else if (/7 wonders/.test(a)) {
        [[0.12, 0.15], [0.5, 0.15], [0.3, 0.55]].forEach(([u, v], i) => K(u, v, 0.34, 0.16, 1, ['#c9a46b', '#9aa3ad', '#b5523b'][i]));
        K(0.72, 0.6, 0.14, 0.2, 4, '#5c6bc0');
    } else {
        // genel: oyun tahtası + zar kulesi + zarlar
        K(0.15, 0.15, 0.55, 0.5, 1, renk || '#c9a46b');
        K(0.75, 0.2, 0.14, 0.14, 12, '#3b2a1e');
        zar(0.74, 0.62); zar(0.6, 0.72);
        piyon(0.3, 0.35, '#d94f3d'); piyon(0.5, 0.45, '#3d7fd9');
    }
}

// Sandalye: oturak + masaya ters yöndeki sırtlık. Sırtlık kameraya dönükse oturanın önünde çizilmeli,
// bu yüzden oturak ve sırtlık ayrı derinlik öğeleri olarak döner.
function sandalyeOgeleri(c, P, d, s, masa, kat) {
    const dx = s.gx + 0.5 - (masa.gx + masa.gw / 2), dy = s.gy + 0.5 - (masa.gy + masa.gd / 2);
    const yatay = Math.abs(dx) >= Math.abs(dy);
    const vip = kat === 3;
    if (masa.tip === 'minder') {
        // yer minderi: renkli, kalın, sırtlıksız
        const rm0 = dondur(d, s.gx + 0.5, s.gy + 0.5);
        const renk = BOHEM[(Math.round(s.gx) * 7 + Math.round(s.gy) * 3) % 4];
        return [{ k: rm0.x + rm0.y - 0.05, f: () => {
            kutu(c, P, d, s.gx + 0.14, s.gy + 0.14, 0.72, 0.72, 4, renkler(renk));
            kutu(c, P, d, s.gx + 0.3, s.gy + 0.3, 0.4, 0.4, 0, { ust: '#e3b23c' }, 4);
        } }];
    }
    const ana = vip ? '#5a2e1c' : kat === 2 ? '#4a2e1a' : '#7a4b2a';
    const pay = vip ? 0.12 : 0.18, gen = 1 - 2 * pay;
    const OTURAK = vip ? 9 : 8;
    let sirt;
    if (yatay) sirt = { gx: s.gx + (dx > 0 ? 1 - pay - 0.12 : pay), gy: s.gy + pay, gw: 0.12, gd: gen };
    else sirt = { gx: s.gx + pay, gy: s.gy + (dy > 0 ? 1 - pay - 0.12 : pay), gw: gen, gd: 0.12 };
    const ru = dondur(d, sirt.gx + sirt.gw / 2, sirt.gy + sirt.gd / 2), rm = dondur(d, s.gx + 0.5, s.gy + 0.5);
    const onde = (ru.x + ru.y) > (rm.x + rm.y);
    const temel = rm.x + rm.y;
    const ogeler = [{
        k: temel - 0.05,
        f: () => {
            kutu(c, P, d, s.gx + pay, s.gy + pay, gen, gen, OTURAK, renkler(ana));
            if (vip) kutu(c, P, d, s.gx + pay + 0.04, s.gy + pay + 0.04, gen - 0.08, gen - 0.08, 1, renkler('#7a3e26'), OTURAK);
        },
    }, {
        k: temel + (onde ? 0.25 : -0.08),
        f: () => {
            kutu(c, P, d, sirt.gx, sirt.gy, sirt.gw, sirt.gd, vip ? 16 : 13, renkler(ton(ana, 0.9)), OTURAK);
            if (vip) {   // koltuk kolları
                const kol = yatay
                    ? [[s.gx + pay, s.gy + pay, gen, 0.1], [s.gx + pay, s.gy + 1 - pay - 0.1, gen, 0.1]]
                    : [[s.gx + pay, s.gy + pay, 0.1, gen], [s.gx + 1 - pay - 0.1, s.gy + pay, 0.1, gen]];
                for (const [x, yy, w, h] of kol) kutu(c, P, d, x, yy, w, h, 6, renkler('#4a2416'), OTURAK);
            }
        },
    }];
    return ogeler;
}

// Poster desenleri: duvar dekorundaki her poster için (sütun i, satır r) pikselinin rengi
function posterPikseli(oyun, i, r, n, boy) {
    if (r >= boy - 6) return r === boy - 6 ? '#2a1d16' : (i % 3 === 1 && r === boy - 3 ? '#5a3a22' : '#f3e6c4');   // başlık bandı
    switch (oyun) {
        case 'catan': {
            const hx = Math.floor((i + (Math.floor(r / 5) % 2) * 3) / 6), hy = Math.floor(r / 5);
            if (r < 2 || i < 2 || i > n - 3) return '#2b6cb0';
            if ((i + 1) % 6 === 0 || r % 5 === 0) return '#e9d9a6';
            return ['#e3b23c', '#4caf6a', '#c0703a', '#9aa3ad', '#7cb342'][(hx * 3 + hy * 2) % 5];
        }
        case 'carcassonne':
            if (r < 9 && i > n / 2 - 4 && i < n / 2 + 4) return r < 3 && i % 2 ? '#e8d6b3' : '#9aa3ad';   // kale
            if (Math.abs(r - 16) < 1 || Math.abs(i - n / 2) < 1) return '#c9a46b';                         // yollar
            return (i + r) % 7 === 0 ? '#3f8f4f' : '#5fa35a';
        case 'tren':
            if (r < 4) return '#c0392b';
            if ((i + r) % 9 === 0) return '#d94f3d';
            if ((i * 2 - r + 40) % 11 === 0) return '#2b6cb0';
            if ((i % 8 === 3 && r % 8 === 6)) return '#2a1d16';
            return '#e9dcb8';
        case 'dixit': {
            if ((i * 7 + r * 13) % 37 === 0) return '#fff3d6';                                             // yıldızlar
            const ay = (i - n * 0.65) ** 2 + (r - 8) ** 2;
            if (ay < 12) return '#f7e6a1';
            return r < 12 ? '#4b2c5e' : '#7b4f9e';
        }
        case 'pandemic':
            if ((i * 5 + r * 3) % 23 === 0 || (i * 3 + r * 7) % 29 === 0) return '#d94f3d';                 // salgın noktaları
            if (Math.sin(i * 0.7) + Math.cos(r * 0.5) > 0.6) return '#3f6f5a';                               // kıtalar
            return '#1f3f66';
        case 'harita':
            if (Math.abs(Math.sin(i * 0.5) * 6 + 12 - r) < 1) return '#7a4b2a';                              // kıyı
            if ((i === Math.floor(n * 0.7) || i === Math.floor(n * 0.7) + 1) && (r === 15 || r === 16)) return '#c0392b';
            if ((i + r) % 13 === 0) return '#b59a6a';
            return r > Math.sin(i * 0.5) * 6 + 12 ? '#e8d6a8' : '#9cc1c9';
        default:
            return '#d9c39a';
    }
}

// ------------------------------------------------------------------ karakterler
// Sprite tasarımı 16x30 ızgarada yapılır, ÖLÇEK ile büyütülerek üretilir (dış hat üretimden sonra
// eklendiği için 1 piksel ve keskin kalır)
const OLCEK = 1.25;
const SPRITE_G = 32, SPRITE_Y = 46, SX = 6, SY = 4;    // sprite tuvali ve çizim başlangıcı
const sk = (v) => Math.round(v * OLCEK);
const spriteOnbellek = new Map();

export function karakterPaleti(tohum, tur = 'musteri', ogrenci = false, ek = {}) {
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
    if (tur === 'sef') Object.assign(p, { gomlek: '#ffffff', gomlekG: '#dcd6cc', gomlekA: '#ffffff', pantolon: '#2b2b2b', pantolonG: '#1c1c1c', etek: false });
    if (ek.rol === 'sarkici') Object.assign(p, { etek: true, stil: 1, gomlek: '#a8282f', gomlekG: '#7f1d22', gomlekA: '#c9404a', pantolon: '#a8282f', pantolonG: '#7f1d22', gozluk: false });
    if (ek.rol === 'gitarist') Object.assign(p, { gomlek: '#2b2b2b', gomlekG: '#1c1c1c', gomlekA: '#444444', etek: false });
    if (ek.rol === 'piyanist') Object.assign(p, { gomlek: '#f4efe6', gomlekG: '#d9d2c5', gomlekA: '#ffffff', pantolon: '#1c1c1c', pantolonG: '#141414', etek: false });
    Object.assign(p, ek);
    p.ogrenci = ogrenci && tur === 'musteri';
    p.anahtar = `${tohum}-${tur}-${p.ogrenci ? 1 : 0}-${ek.rol || ''}-${ek.yardimci ? 1 : 0}`;
    return p;
}

// Tek kare sprite (16 x 30 alan, SX/SY kaydırmalı). poz: ayakta | yuruyor | oturuyor
function spriteUret(p, { poz, arka, kare, tepsi, elKalkik }) {
    const t = document.createElement('canvas');
    t.width = SPRITE_G; t.height = SPRITE_Y;
    const c = t.getContext('2d');
    const r = (x, y, w, h, renk) => {
        c.fillStyle = renk;
        c.fillRect(SX + sk(x), SY + sk(y), sk(x + w) - sk(x), sk(y + h) - sk(y));
    };
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
    if (p.tur === 'sef') {                                             // şef: aşçı ceketi, fular, kep
        r(6, 14, 4, 1, '#d94f3d');
        if (!arka) { r(6, 16, 1, 1, '#9aa3ad'); r(9, 16, 1, 1, '#9aa3ad'); r(6, 18, 1, 1, '#9aa3ad'); r(9, 18, 1, 1, '#9aa3ad'); }
        if (p.yardimci) { r(3, 0, 10, 2, '#2b6cb0'); r(12, 1, 2, 2, '#2b6cb0'); }
        else { r(4, -5, 8, 5, '#ffffff'); r(3, -1, 10, 2, '#e9e4da'); r(5, -5, 2, 4, '#f1ece2'); }
    }
    if (p.rol === 'gitarist') {                                        // gitar
        r(3, 17, 6, 5, '#a0522d'); r(4, 18, 4, 3, '#c0703a'); r(5, 19, 2, 1, '#3b2a1e');
        r(9, 16, 6, 1, '#5a3a22'); r(15, 15, 1, 2, '#3b2a1e');
    }
    if (p.rol === 'sarkici' && !arka) r(11, 9, 2, 2, '#9aa3ad');      // el mikrofonu
    if (p.ogrenci) {                                                   // öğrenci: mezuniyet kepi ve püskül
        r(2, -1, 12, 1, '#1c1c1c'); r(5, -2, 6, 1, '#2b2b2b'); r(6, 0, 4, 1, '#1c1c1c');
        r(arka ? 3 : 12, 0, 1, 4, '#e3b23c');
    }

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
    c.fillRect(p.x - 8, p.y - 1, 16, 2); c.fillRect(p.x - 5, p.y - 2, 10, 4);
    const s = sprite(b.palet, { poz, arka: yon.arka, kare: b.kare, tepsi: b.tepsi, elKalkik: b.elKalkik });
    // oturan karakter sandalyenin oturma yüksekliğine çıkar
    // oturan sandalyenin oturma yüksekliğine çıkar (minderde yere yakın); sahnedekiler sahne yüksekliğinde
    const otur = b.oturuyor ? (b.minder ? sk(1) : sk(6)) : 0;
    const x = Math.round(p.x) - SX - sk(8), y = Math.round(p.y) - SY - sk(29) - otur - (b.z || 0);
    if (yon.ayna) {
        c.save(); c.translate(Math.round(p.x) * 2, 0); c.scale(-1, 1);
        c.drawImage(s, x, y); c.restore();
    } else c.drawImage(s, x, y);
}

// ------------------------------------------------------------------ sahne
export function sahneCiz(c, sahne) {
    const { kat, d } = sahne;
    const P = izdusum(d);
    const evre = sahne.evre || 'gun';
    c.drawImage(arkaPlan(evre), 0, 0);
    c.drawImage(zeminVeDuvarlar(kat, d, evre), 0, 0);

    const derinlik = (gx, gy, gw = 1, gd = 1) => {
        const r = dikdortgenDondur(d, gx, gy, gw, gd);
        return r.gx + r.gy + (r.gw + r.gd) / 2;
    };
    const ciz = [];
    const dis = kat === 1 && disGorunur(d);
    for (const o of KATLAR[kat].nesneler) ciz.push({ k: derinlik(o.gx, o.gy, o.gw, o.gd) - 0.5 + (o.z ? 0.3 : 0), f: () => nesneCiz(c, P, d, o, sahne) });
    if (dis) {
        // akşam/gece pencerelerden ve kapıdan kaldırıma süzülen sıcak ışık
        if (evre !== 'gun') {
            c.save(); c.globalAlpha = evre === 'gece' ? 0.28 : 0.16; c.fillStyle = '#ffc070';
            for (const [x0, x1] of [[2, 4], [6, 9], [11, 14]]) for (let x = x0; x < x1; x++) for (const yy of [IC_DERINLIK, KALDIRIM_Y]) {
                const r = dikdortgenDondur(d, x, yy, 1, 1);
                elmasR(c, P, r.gx, r.gy, '#ffc070');
            }
            c.restore();
        }
        for (const o of [...(KATLAR[kat].dis || []), ...cepheNesneleri()]) {
            ciz.push({ k: derinlik(o.gx, o.gy, o.gw, o.gd) - 0.5 + (o.tur === 'tente' ? 0.6 : 0), f: () => nesneCiz(c, P, d, o, sahne) });
        }
        for (const a of sahne.arabalar || []) {
            const q = dondur(d, a.x, YOL_SERITLERI[a.serit]);
            ciz.push({ k: q.x + q.y, f: () => arabaCiz(c, P, d, a, evre) });
        }
        if (sahne.kopek) {
            const q = dondur(d, sahne.kopek.x, sahne.kopek.y);
            ciz.push({ k: q.x + q.y, f: () => kopekCiz(c, P, d, sahne.kopek) });
        }
    }
    const m = ASANSOR_GOVDE;
    ciz.push({ k: derinlik(m.gx, m.gy, m.gw, m.gd) - 0.5, f: () => asansorCiz(c, P, d, kat, sahne.asansorAcik) });
    for (const ms of sahne.masalar) {
        const y = ms.yuva;
        ciz.push({ k: derinlik(y.gx, y.gy, y.gw, y.gd) - 0.35, f: () => masaCiz(c, P, d, ms, kat, ms.masaId === sahne.seciliMasaId) });
        for (const st of ms.sandalyeler) ciz.push(...sandalyeOgeleri(c, P, d, st, y, kat));
    }
    for (const b of sahne.bireyler) {
        if (b.gy >= IC_DERINLIK - 0.5 && !dis) continue;     // dış mekân gizliyken dışarıdakiler görünmez
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

// Araba: gövde, kabin, tekerlekler; akşam/gece farlar yolu aydınlatır, stop lambaları kırmızı
function arabaCiz(c, P, d, a, evre) {
    const yon = a.serit === 0 ? 1 : -1;
    const x0 = a.x - 0.8, y0 = YOL_SERITLERI[a.serit] - 0.25;
    kutu(c, P, d, x0, y0, 1.6, 0.5, 6, renkler(a.renk), 2);
    kutu(c, P, d, x0 + 0.35, y0 + 0.05, 0.85, 0.4, 5, { ust: ton(a.renk, 0.9), sol: '#9fd3e6', sag: '#7fb6cc' }, 8);
    for (const u of [0.25, 1.25]) { const q = P.W(x0 + u, y0 + 0.5); c.fillStyle = '#111'; c.fillRect(q.x - 2, q.y - 3, 4, 3); }
    const on = P.W(a.x + 0.8 * yon, YOL_SERITLERI[a.serit]), arka = P.W(a.x - 0.8 * yon, YOL_SERITLERI[a.serit]);
    c.fillStyle = '#d94f3d'; c.fillRect(arka.x - 1, arka.y - 6, 2, 2);
    c.fillStyle = evre === 'gun' ? '#f4efe6' : '#fff6c9'; c.fillRect(on.x - 1, on.y - 6, 2, 2);
    if (evre !== 'gun') {
        c.save(); c.globalAlpha = 0.22; c.fillStyle = '#fff1b8';
        for (let i = 0; i < 26; i++) {
            const q = P.W(a.x + (0.8 + i * 0.09) * yon, YOL_SERITLERI[a.serit]);
            c.fillRect(q.x - 1 - i * 0.35, q.y - 4 + i * 0.12, 2 + i * 0.7, 2);
        }
        c.restore();
    }
}

// Sevimli köpek: gövde, baş, kulak, kuyruk (sallanır); otururken kısalır
function kopekCiz(c, P, d, k) {
    const q = P.W(k.x, k.y);
    const a = dondur(d, 0, 0), b = dondur(d, k.yon, 0);
    const ayna = ((b.x - a.x) - (b.y - a.y)) < 0;
    const x = Math.round(q.x), y = Math.round(q.y);
    const s = ayna ? -1 : 1;
    const R = (dx, dy, w, hh, renk) => { c.fillStyle = renk; c.fillRect(s > 0 ? x + dx : x - dx - w, y + dy, w, hh); };
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x - 6, y - 1, 12, 2);
    const yuk = k.oturuyor ? 1 : 0;
    R(-5, -8 + yuk, 9, 4, '#b5793f'); R(-5, -6 + yuk, 9, 2, '#9b6332');
    if (!k.oturuyor) { R(-5, -4, 2, 4, '#9b6332'); R(2, -4, 2, 4, '#9b6332'); R(-2 + (k.kare % 2), -4, 2, 4, '#b5793f'); }
    else { R(-5, -4, 3, 3, '#9b6332'); R(2, -4, 2, 4, '#9b6332'); }
    R(3, -12 + yuk, 5, 5, '#b5793f'); R(7, -10 + yuk, 2, 2, '#3b2a1e'); R(4, -13 + yuk, 2, 3, '#7a4b2a');
    R(5, -11 + yuk, 1, 1, '#111');
    R(-7, -10 + yuk + (Math.floor(performance.now() / 150) % 2), 2, 3, '#b5793f');   // kuyruk
}

// Ön cephe: kapı boşluğu dışında alçak duvar, kapı direkleri ve tente
function cepheNesneleri() {
    const y = IC_DERINLIK, { bas, son } = KAPI_ARALIK;
    const parca = [];
    for (let x = 0; x < GENISLIK; x++) if (x < bas || x >= son) parca.push({ tur: 'cephe', gx: x, gy: y, gw: 1, gd: 0.25, h: 16 });
    parca.push({ tur: 'direk', gx: bas - 0.12, gy: y, gw: 0.12, gd: 0.25, h: 58 }, { tur: 'direk', gx: son, gy: y, gw: 0.12, gd: 0.25, h: 58 });
    parca.push({ tur: 'tente', gx: bas - 0.3, gy: y + 0.05, gw: son - bas + 0.6, gd: 0.7, z: 52 });
    return parca;
}

// Kameranın sığdıracağı alan (doğal koordinat): iç mekân + duvar yüksekliği; kat 1'de görünürse dış mekân da
export function gorunurAlan(kat, d) {
    const P = izdusum(d);
    const derin = kat === 1 && disGorunur(d) ? DERINLIK : IC_DERINLIK;
    const r = dikdortgenDondur(d, 0, 0, GENISLIK, derin);
    const T = P.R(r.gx, r.gy), B = P.R(r.gx + r.gw, r.gy + r.gd), L = P.R(r.gx, r.gy + r.gd), R = P.R(r.gx + r.gw, r.gy);
    return { x0: L.x - 8, x1: R.x + 8, y0: T.y - DUVAR - 12, y1: B.y + 16 };
}

// Ruh hali: sabır 0–100 → ikon ve renk
export function ruhHali(sabir) {
    if (sabir >= 70) return { ikon: '😊', renk: '#4caf6a' };
    if (sabir >= 40) return { ikon: '😐', renk: '#e3b23c' };
    if (sabir >= 20) return { ikon: '😠', renk: '#e07b39' };
    return { ikon: '😡', renk: '#d94f3d' };
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
    // asansör kat göstergesi
    {
        const m = ASANSOR_GOVDE;
        const q = donus(P.W(m.gx + m.gw / 2, m.gy + m.gd));
        yazi(`▲▼ ${sahne.kat}`, q.x, q.y - 64 * olcek, { zemin: '#1c1c1c', renk: '#ffd166', kenar: '#5b6470', boyut: Math.max(9, Math.round(4.5 * olcek)) });
    }
    // canlı müzik: sahnenin üstünde süzülen notalar
    if (sahne.muzik) {
        const t = performance.now() / 1000;
        c.font = `bold ${Math.max(12, Math.round(6 * olcek))}px "Segoe UI Symbol", sans-serif`;
        for (const mz of sahne.muzik) {
            const q = donus(P.W(mz.gx + 0.5, mz.gy + 0.5));
            for (let i = 0; i < 3; i++) {
                const f = (t * 0.45 + i / 3 + mz.gx * 0.13) % 1;
                c.fillStyle = `rgba(255,214,102,${(1 - f).toFixed(2)})`;
                c.fillText(i % 2 ? '♫' : '♪', q.x + Math.sin(f * 6 + i) * 9 * olcek, q.y - (46 + f * 30) * olcek);
            }
        }
    }
    const dis = sahne.kat === 1 && disGorunur(sahne.d);
    if (dis) {
        const p = donus(P.W((KAPI_ARALIK.bas + KAPI_ARALIK.son) / 2, IC_DERINLIK + 0.4));
        yazi('KARAVANA · kutu oyunu cafe', p.x, p.y - 62 * olcek, { zemin: '#2f4a3a', renk: '#ffe7a8', kenar: '#1a2a20', boyut: Math.max(10, Math.round(5 * olcek)) });
    }
    for (const b of sahne.bireyler) {
        if (b.gy >= IC_DERINLIK - 0.5 && !dis) continue;
        const p = donus(P.W(b.gx + 0.5, b.gy + 0.5));
        const ust = p.y - (b.oturuyor ? 40 : 45) * olcek;
        let ikonUst = ust;
        if (b.ruh) {
            // sabır göstergesi: ikon, sabırsızlıkta öfke barı, çok sinirlide kırmızı ünlem
            const r = ruhHali(b.ruh.sabir);
            const boy = Math.max(12, Math.round(6 * olcek));
            const x0 = p.x + (b.ikon ? 7 * olcek : 0);
            c.font = `${boy}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
            c.fillText(r.ikon, x0 - boy / 2, ust);
            if (b.ruh.sabir < 70) {
                const w = Math.max(18, 10 * olcek), h = Math.max(3, Math.round(1.4 * olcek));
                c.fillStyle = '#2a1d16'; c.fillRect(x0 - w / 2 - 1, ust + 2, w + 2, h + 2);
                c.fillStyle = '#5a3a22'; c.fillRect(x0 - w / 2, ust + 3, w, h);
                c.fillStyle = r.renk; c.fillRect(x0 - w / 2, ust + 3, w * Math.max(0.05, b.ruh.sabir / 100), h);
            }
            if (b.ruh.sabir < 20 && Math.floor(performance.now() / 300) % 2) {
                c.fillStyle = '#d94f3d'; c.fillRect(x0 + boy * 0.55, ust - boy, Math.max(3, olcek * 1.2), boy * 0.6);
                c.fillRect(x0 + boy * 0.55, ust - boy * 0.3, Math.max(3, olcek * 1.2), Math.max(3, olcek * 1.2));
            }
            if (!b.ikon) ikonUst = ust - boy - 2;
        }
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
    const m = ASANSOR_GOVDE;
    if (icinde(tabanKutusu(P, sahne.d, m.gx, m.gy, m.gw, m.gd, 84), x, y)) return { tur: 'asansor' };
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
