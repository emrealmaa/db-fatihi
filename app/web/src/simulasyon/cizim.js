// Piksel-art izometrik çizim. Sahne, doğal koordinatlarda (DOGAL_G x DOGAL_Y) tanımlıdır; her karede yalnızca ekranda
// görünen bölge ara bir tuvale çizilir, kamera (yakınlaştırma, kaydırma) bu tuvali ekrana aktarırken uygulanır. Döndürme dünya koordinatlarında yapılır (harita.js):
// oda 90° döner, kameraya göre arkada kalan iki duvar çizilir ve derinlik sıralaması döndürülmüş
// koordinatlarla yeniden hesaplanır. Tüm şekiller fillRect ile satır/sütun çizildiğinden kenarlar keskin kalır.
import {
    arkaDuvarlar, dikdortgenDondur, disGorunur, dondur, duvarNoktasi, GENISLIK, IC_DERINLIK,
    ASANSOR_GOVDE, KALDIRIM_Y, KAPI_ARALIK, KATLAR, arkadaMi,
} from './harita.js';
import { BINA_ONU, BINALAR, kepenkOrani } from './sehir/binalar.js';
import { binaAltigeni, binaCiz } from './sehir/binaCizim.js';
import { gunIsigi, pencereOrani } from './sehir/isik.js';
import { karma } from './sehir/rastgele.js';
import { aracCiz, ARAC_BOY, esyaCiz, guvercinCiz, kediCiz, sehirZemini } from './sehir/sokakCizim.js';
import { DUNYA, SINIR, SOKAK_ESYALARI } from './sehir/yerlesim.js';

const KX = 24, KY = 12;                  // yarım karo genişliği / yüksekliği
const DUVAR = 84;                        // duvar yüksekliği
const PAD = 40;
const PLAKA = 14;                        // zemin plakası kalınlığı
const MAKET_KALINLIK = 22;               // şehir maketinin kesit kalınlığı
const AGAC_SAYDAMLIK = 0.42;             // kafeyi örten ağaçların opaklığı
const BALON_SINIR = 6;                   // kat başına aynı anda görünen en fazla konuşma balonu
const DUVAR_KAL = 0.35;                  // duvar kalınlığı (karo)
const UST_PAY = 330, ALT_PAY = 60;       // üstte yüksek binalar ve çatılar, altta plaka için pay
// Şehir maketi her kamera yönünde aynı doğal tuvale sığar
const IZ = [0, 1, 2, 3].map((d) => {
    const ks = [[SINIR.x0, SINIR.y0], [SINIR.x1, SINIR.y0], [SINIR.x0, SINIR.y1], [SINIR.x1, SINIR.y1]].map(([x, y]) => dondur(d, x, y));
    const f = ks.map((p) => p.x - p.y), t = ks.map((p) => p.x + p.y);
    return { fmin: Math.min(...f), fmax: Math.max(...f), tmin: Math.min(...t), tmax: Math.max(...t) };
});
export const DOGAL_G = Math.max(...IZ.map((z) => z.fmax - z.fmin)) * KX + PAD * 2;
export const DOGAL_Y = Math.max(...IZ.map((z) => z.tmax - z.tmin)) * KY + UST_PAY + ALT_PAY;

// Döndürülmüş uzayda izdüşüm; d: kamera açısı (0..3)
export function izdusum(d) {
    const z = IZ[d];
    const ox = -z.fmin * KX + PAD, oy = -z.tmin * KY + UST_PAY;
    const R = (rx, ry) => ({ x: ox + (rx - ry) * KX, y: oy + (rx + ry) * KY });
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
    hali: ['#3a1f4f', '#341b47', '#40235a'],
    koyuahsap: ['#4a2f1f', '#42291b', '#533423'],
};
const BOHEM = ['#a33b20', '#7b2d26', '#2b6cb0', '#c9772a'];
const HALI = {
    mutfak: ['#e9eef2', '#a9bccb'],
    arcade: ['#2a1f3d', '#33264a'],
    bekleme: ['#d9a65b', '#cf9a4f'], paspas: ['#6b8f5a', '#5f8250'],
    salon: ['#3f5a4a', '#385142'], vip: ['#6e1e2b', '#641b27'],
    dama: ['#1f1f1f', '#f1ece2'],
};
const DUVAR_RENK = {
    1: { ust: '#f1dfbf', serit: '#e6cfa6', alt: '#9b6a3f' },
    2: { ust: '#6d7f66', serit: '#62735c', alt: '#4a3626' },
    3: { ust: '#6e1f2c', serit: '#5e1a26', alt: '#3a2216' },
};
// Duvarın alt kısmındaki ahşap lambri yüksekliği (piksel); kat 3'te üstünde altın şerit
const LAMBRI = { 1: 22, 2: 30, 3: 30 };
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
    const x0 = Math.round(L.x), x1 = Math.round(Rr.x), bx = Math.round(B.x);
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
            if (renk.desen) renk.desen(c, x, alt - h - z, h, sol, x - x0, sol ? x - x0 : x - bx, sol ? bx - x0 : x1 - bx);
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

const hexA = (hex, a) => { const [r, g, b] = onAltilik(hex); return `rgba(${r},${g},${b},${a})`; };

// Yumuşak zemin gölgesi: taban izinin biraz dışına taşan iki katmanlı yarı saydam leke (önce çizilir)
function golge(c, P, d, gx, gy, gw, gd, guc = 1) {
    kutu(c, P, d, gx - 0.04, gy - 0.04, gw + 0.2, gd + 0.2, 0, { ust: `rgba(0,0,0,${0.12 * guc})` });
    kutu(c, P, d, gx + 0.03, gy + 0.03, gw + 0.08, gd + 0.08, 0, { ust: `rgba(0,0,0,${0.16 * guc})` });
}
// Gölge çizilmeyenler: duvara/tavana asılı, ince direkli veya kendi ışığı olan nesneler
const GOLGESIZ = new Set(['lamba', 'sokaklambasi', 'cephe', 'direk', 'tente', 'agac', 'menutahta', 'turnuva', 'kadifebariyer', 'bartaburesi']);

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

// Tuğla deseni: harç çizgileri (yatay her 4 px, dikey şaşırtmalı)
const tuglaDeseni = (c, x, ustY, h, sol, sutun) => {
    c.fillStyle = sol ? '#c9b49a' : '#a8957e';
    for (let r = 0; r < h; r++) {
        const sira = Math.floor(r / 4);
        if (r % 4 === 3 || (sutun + (sira % 2) * 4) % 8 === 0) c.fillRect(x, ustY + r, 1, 1);
    }
    if ((sutun * 7) % 13 === 0) { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x, ustY, 1, h); }
};

// Şişe rafı deseni: üç rafta şişe ve kavanozlar
const siseDeseni = (cc, x, y, h, sol, sutun) => {
    for (let k = 0; k < 3; k++) {
        if (sutun % 4 === 3) continue;
        const renk = ['#3f8f4f', '#a33b20', '#e3b23c', '#2b6cb0', '#f4efe6', '#7a4b2a'][(Math.floor(sutun / 4) + k * 2) % 6];
        const boy = 6 + ((Math.floor(sutun / 4) + k) % 3);
        cc.fillStyle = sol ? renk : ton(renk, 0.8);
        cc.fillRect(x, y + 4 + k * 13 + (9 - boy), 1, boy);
        if (sutun % 4 === 1) { cc.fillStyle = '#2a1d16'; cc.fillRect(x, y + 4 + k * 13 + (9 - boy) - 2, 1, 2); }
    }
};

// Kapitone (chesterfield) deri: düğme çukurları
const capitone = (cc, x, y, h, sol, st) => {
    if (st % 4 === 2) { cc.fillStyle = 'rgba(0,0,0,.28)'; for (let r = 2; r < h - 1; r += 4) cc.fillRect(x, y + r, 1, 1); }
};

// Kanepe / koltuk: oturak, o.sirt yönünde (dünya K/B/G/D) yüksek sırt, iki ucunda kol
function kanepe(K, o, ana) {
    const sirt = renkler(ton(ana, 0.85), capitone), kol = renkler(ton(ana, 0.9), capitone);
    K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, o.h, renkler(ana, capitone));
    const boyuna = o.sirt === 'D' || o.sirt === 'B';                // sırt y ekseni boyunca
    if (boyuna) {
        for (const v of [0.05, o.gd - 0.27]) K(o.gx + 0.05, o.gy + v, o.gw - 0.1, 0.22, 6, kol, o.h);
        K(o.sirt === 'D' ? o.gx + o.gw - 0.32 : o.gx + 0.05, o.gy + 0.05, 0.27, o.gd - 0.1, 13, sirt, o.h);
    } else {
        for (const u of [0.05, o.gw - 0.27]) K(o.gx + u, o.gy + 0.05, 0.22, o.gd - 0.1, 6, kol, o.h);
        K(o.gx + 0.05, o.sirt === 'G' ? o.gy + o.gd - 0.32 : o.gy + 0.05, o.gw - 0.1, 0.27, 13, sirt, o.h);
    }
}

// Kitaplık deseni: girintili koyu arka panel, dikmeler, raf tahtaları ve kutular (derinlik hissi)
const kitaplikDeseni = (c, x, ustY, h, sol, sutun) => {
    if (sutun % 24 < 2) { c.fillStyle = sol ? '#6b3f22' : '#57331c'; c.fillRect(x, ustY, 1, h); if (sutun % 24 === 1) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, ustY, 1, h); } return; }
    c.fillStyle = sol ? '#24140b' : '#1c0f08'; c.fillRect(x, ustY + 2, 1, h - 6);
    rafDeseni(c, x, ustY, h, sol, sutun);
    for (let k = 0; ustY + 12 + k * 11 < ustY + h - 6; k++) {
        c.fillStyle = sol ? '#8a5a34' : '#6f4628'; c.fillRect(x, ustY + 12 + k * 11, 1, 1);
        c.fillStyle = sol ? '#5a3520' : '#472915'; c.fillRect(x, ustY + 13 + k * 11, 1, 1);
    }
    c.fillStyle = '#2e1a0e'; c.fillRect(x, ustY + h - 4, 1, 4);
};

// Dünyanın dışı düz koyu renk (sayfa kenarıyla aynı)
export const ARKA_RENK = { gun: '#1c2029', aksam: '#15131f', gece: '#0a0b13' };

// ------------------------------------------------------------------ zemin ve duvarlar (önbellekli)
const katmanOnbellek = new Map();

// parca: 'zemin' (plaka, döşeme, halılar, dış mekân zemini) veya 'duvar' (arka duvarlar ve dekorları)
// Katman, içeriğinin ekran kutusuna kırpılmış ayrı bir tuvaldir ({ tuval, x0, y0 }); en son kullanılanlar tutulur.
// Kat 1 zemini bütün şehri içerdiği için büyüktür: yalnızca son kamera yönü saklanır.
function zeminVeDuvarlar(kat, d, evre, parca = 'zemin') {
    const anahtar = `${kat}-${d}-${parca}-${parca === 'duvar' ? evre : ''}`;
    const var0 = katmanOnbellek.get(anahtar);
    if (var0) { katmanOnbellek.delete(anahtar); katmanOnbellek.set(anahtar, var0); return var0; }
    const P = izdusum(d);
    const sehir = kat === 1 && parca === 'zemin';
    const alan = sehir ? dikdortgenDondur(d, SINIR.x0, SINIR.y0, SINIR.x1 - SINIR.x0, SINIR.y1 - SINIR.y0)
        : dikdortgenDondur(d, -0.5, -0.5, GENISLIK + 1, IC_DERINLIK + 1);
    const ks = [P.R(alan.gx, alan.gy), P.R(alan.gx + alan.gw, alan.gy), P.R(alan.gx + alan.gw, alan.gy + alan.gd), P.R(alan.gx, alan.gy + alan.gd)];
    const x0 = Math.floor(Math.min(...ks.map((p) => p.x))) - 4, x1 = Math.ceil(Math.max(...ks.map((p) => p.x))) + 4;
    const y0 = Math.floor(Math.min(...ks.map((p) => p.y))) - (parca === 'duvar' ? DUVAR + 10 : 4), y1 = Math.ceil(Math.max(...ks.map((p) => p.y))) + MAKET_KALINLIK + 24;
    const tuval = document.createElement('canvas');
    tuval.width = x1 - x0; tuval.height = y1 - y0;
    const c = pikselBaglami(tuval);
    c.translate(-x0, -y0);
    const t = KATLAR[kat];
    const sonuc = { tuval, x0, y0 };
    const sakla = () => {
        katmanOnbellek.set(anahtar, sonuc);
        const buyuk = [...katmanOnbellek.keys()].filter((k) => k.startsWith('1-') && k.includes('-zemin-'));
        while (buyuk.length > 1) katmanOnbellek.delete(buyuk.shift());
        while (katmanOnbellek.size > 10) katmanOnbellek.delete(katmanOnbellek.keys().next().value);
        return sonuc;
    };
    if (parca === 'duvar') { duvarlariCiz(c, P, kat, d, evre); return sakla(); }

    // Zemin plakası: katın altında kalın, katmanlı döşeme kesiti. Kat 1'de plaka bütün şehri taşıyan bir dioramadır.
    const plaka = sehir ? alan : dikdortgenDondur(d, 0, 0, GENISLIK, IC_DERINLIK);
    if (sehir) {
        // Maket: altına düşen yumuşak gölge + üç katmanlı kesit (üstte zemin malzemesi, ortada taşlı toprak, altta temel).
        // Kesit yalnızca kameraya bakan iki kenarda görünür (kutunun ön yüzleri); sol yüz açık, sağ yüz koyu.
        kutuR(c, P, plaka, 0, { ust: 'rgba(0,0,0,.28)' }, -(MAKET_KALINLIK + 16));
        kutuR(c, P, plaka, 0, { ust: 'rgba(0,0,0,.18)' }, -(MAKET_KALINLIK + 8));
        kutuR(c, P, plaka, MAKET_KALINLIK, {
            ust: '#3c4433', sol: '#6b4a2f', sag: '#553a24',
            desen: (cc, x, y, h, sol, st) => {
                for (let r = 0; r < h; r++) {
                    let renk;
                    if (r < 3) renk = sol ? '#a9a296' : '#8f897e';                                      // zemin malzemesi
                    else if (r >= h - 6) renk = sol ? (r === h - 6 ? '#4a423b' : '#3a3530') : (r === h - 6 ? '#3d3631' : '#2f2b27');   // temel taşı
                    else {
                        renk = ((r >> 2) & 1) ? (sol ? '#6b4a2f' : '#553a24') : (sol ? '#76533a' : '#5e412a');                     // iki tonlu toprak
                        if (karma(st, r) < 0.05) renk = sol ? '#a89880' : '#8c7d68';                                                // taş noktacıkları
                    }
                    cc.fillStyle = renk; cc.fillRect(x, y + r, 1, 1);
                }
            },
        }, -MAKET_KALINLIK);
    } else kutuR(c, P, plaka, PLAKA, {
        ust: '#3c4433', sol: '#5b4332', sag: '#47342a',
        desen: (cc, x, y, h, sol) => {
            cc.fillStyle = sol ? '#7a5a41' : '#5f4634'; cc.fillRect(x, y, 1, 2);             // döşeme üst kenarı
            cc.fillStyle = sol ? '#3e2c22' : '#33241c'; cc.fillRect(x, y + 7, 1, 1); cc.fillRect(x, y + h - 2, 1, 2);
        },
    }, -PLAKA);
    const z = ZEMIN[t.zemin];
    for (let gx = 0; gx < GENISLIK; gx++) for (let gy = 0; gy < IC_DERINLIK; gy++) {
        const r = dikdortgenDondur(d, gx, gy, 1, 1);
        elmasR(c, P, r.gx, r.gy, z[(gx + gy) % 2 === 0 ? 0 : ((gx * 7 + gy * 3) % 5 === 0 ? 2 : 1)]);
        if (t.zemin === 'hali') continue;
        // parke: her karoda üç tahta; tahta tonları ve ek yerleri şaşırtmalı
        for (let j = 0; j < 3; j++) {
            kutu(c, P, d, gx, gy + j / 3, 1, 1 / 3, 0, { ust: z[(gx * 3 + gy * 5 + j * 7) % 3] });
            kutu(c, P, d, gx, gy + j / 3, 1, 0.06, 0, { ust: ton(z[1], 0.78) });
            kutu(c, P, d, gx + ((gx + gy * 2 + j) % 3) / 3, gy + j / 3, 0.06, 1 / 3, 0, { ust: ton(z[1], 0.74) });
            if ((gx + j) % 4 === 0) kutu(c, P, d, gx + 0.2, gy + j / 3 + 0.1, 0.5, 0.06, 0, { ust: ton(z[0], 1.08) });   // parlama
        }
    }
    if (sehir) sehirZemini(c, P, d);
    for (const h of t.halilar || []) {
        const renk = HALI[h.renk];
        for (let gx = h.gx; gx < h.gx + h.gw; gx++) for (let gy = h.gy; gy < h.gy + h.gd; gy++) {
            const r = dikdortgenDondur(d, gx, gy, 1, 1);
            const kenar = gx === h.gx || gy === h.gy || gx === h.gx + h.gw - 1 || gy === h.gy + h.gd - 1;
            let renk0 = renk ? renk[(gx + gy) % 2] : null;
            if (h.renk === 'vip' && kenar) renk0 = '#b8892f';
            const icKenar = !kenar && (gx === h.gx + 1 || gy === h.gy + 1 || gx === h.gx + h.gw - 2 || gy === h.gy + h.gd - 2);
            if (h.renk === 'vip' && icKenar) renk0 = '#4a0f1a';
            if (h.renk === 'arcade' && kenar) renk0 = '#5ec8ff';
            if (h.renk === 'bohem') renk0 = kenar ? '#e3b23c' : BOHEM[(gx * 3 + gy * 5) % 4];
            elmasR(c, P, r.gx, r.gy, renk0);
            if (h.renk === 'dama') {
                // bistro: karo başına 2x2 siyah-beyaz dama
                for (const [a, b] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) kutu(c, P, d, gx + a, gy + b, 0.5, 0.5, 0, { ust: renk[(gx * 2 + gy * 2 + a * 2 + b * 2) % 2] });
            }
            if (h.renk === 'vip' && kenar) kutu(c, P, d, gx + 0.15, gy + 0.15, 0.7, 0.7, 0, { ust: '#c9a14a' });
            if (h.renk === 'vip' && !kenar && !icKenar) {
                // altın kenarlı bordo halı: baklava motifleri ve altın noktalar
                if ((gx + gy) % 2 === 0) kutu(c, P, d, gx + 0.3, gy + 0.3, 0.4, 0.4, 0, { ust: '#7d2533' });
                else kutu(c, P, d, gx + 0.42, gy + 0.42, 0.16, 0.16, 0, { ust: '#3d0c14' });
                if (gx % 3 === 0 && gy % 3 === 0) kutu(c, P, d, gx + 0.44, gy + 0.44, 0.12, 0.12, 0, { ust: '#c9a14a' });
            }
        }
    }
    return sakla();
}

function duvarlariCiz(c, P, kat, d, evre = 'gun') {
    const renk = DUVAR_RENK[kat];
    // Duvarlar iç mekânın (20 x IC_DERINLIK) döndürülmüş dikdörtgeninin arka kenarları boyunca
    const ic = dikdortgenDondur(d, 0, 0, GENISLIK, IC_DERINLIK);
    const sol0 = P.R(ic.gx, ic.gy + ic.gd), kose = P.R(ic.gx, ic.gy), sag0 = P.R(ic.gx + ic.gw, ic.gy);
    // Duvar gövdeleri kalın kutular: üstte kesit, açık uçlarda tuğla/sıva kesiti görünür; iç yüz aşağıda boyanır
    const kesit = {
        ust: ton(renk.alt, 0.8), sol: ton(renk.ust, 0.62), sag: ton(renk.ust, 0.52), kenar: ton(renk.ust, 1.1),
        desen: (cc, x, y, h) => { cc.fillStyle = 'rgba(0,0,0,.18)'; for (let r = 8; r < h; r += 9) cc.fillRect(x, y + r, 1, 1); },
    };
    kutuR(c, P, { gx: ic.gx - DUVAR_KAL, gy: ic.gy - DUVAR_KAL, gw: DUVAR_KAL, gd: ic.gd + DUVAR_KAL }, DUVAR, kesit, -PLAKA * 0);
    kutuR(c, P, { gx: ic.gx - DUVAR_KAL, gy: ic.gy - DUVAR_KAL, gw: ic.gw + DUVAR_KAL, gd: DUVAR_KAL }, DUVAR, kesit);
    for (let x = Math.round(sol0.x); x < Math.round(sag0.x); x++) {
        const sol = x < kose.x;
        const k = sol ? 1 : 0.86;
        const taban = Math.round(sol ? dogruY(sol0, kose, x) : dogruY(kose, sag0, x));
        const L = LAMBRI[kat];
        c.fillStyle = ton(renk.ust, k); c.fillRect(x, taban - DUVAR, 1, DUVAR);
        if (kat === 3) {
            // bordo duvar kâğıdı: baklava (damask) deseni
            c.fillStyle = ton(renk.serit, k);
            for (let r = 8; r < DUVAR - L - 4; r++) if ((x + r) % 12 === 0 || (x - r + 600) % 12 === 0) c.fillRect(x, taban - DUVAR + r, 1, 1);
            if ((x + 3) % 12 < 2) { c.fillStyle = ton('#8a3a3a', k); c.fillRect(x, taban - DUVAR + 14 + ((x >> 2) % 3) * 18, 1, 2); }
        } else if (Math.floor(x / 8) % 2) { c.fillStyle = ton(renk.serit, k); c.fillRect(x, taban - DUVAR + 6, 1, DUVAR - 8 - L); }
        c.fillStyle = ton(renk.alt, k); c.fillRect(x, taban - L, 1, L);
        c.fillStyle = ton(renk.alt, k * 1.3); c.fillRect(x, taban - L - 1, 1, 1);
        if (kat > 1) {
            // ahşap lambri panelleri; kat 3'te üstünde altın şerit
            if (x % 14 === 0) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, taban - L + 3, 1, L - 6); }
            if (x % 14 === 1) { c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, taban - L + 3, 1, L - 6); }
            c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, taban - L + 3, 1, 1); c.fillRect(x, taban - 5, 1, 1);
            if (kat === 3) { c.fillStyle = '#c9a14a'; c.fillRect(x, taban - L - 4, 1, 2); c.fillRect(x, taban - DUVAR + 4, 1, 1); }
        }
        c.fillStyle = ton(renk.ust, 0.55); c.fillRect(x, taban - DUVAR, 1, 3);
        // iç köşe ve tavan kenarında ortam gölgesi (derinlik)
        c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(x, taban - 3, 1, 3);
        if (Math.abs(x - kose.x) < 6) { c.fillStyle = `rgba(0,0,0,${0.16 - Math.abs(x - kose.x) * 0.025})`; c.fillRect(x, taban - DUVAR, 1, DUVAR); }
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
                case 'karatahta': {
                    // bistro menüsü: ahşap çerçeveli kara tahtada tebeşirle yemek adları ve fiyatlar
                    if (kenar) { c.fillStyle = '#6b3f22'; c.fillRect(x, y - 74, 1, 36); break; }
                    c.fillStyle = '#6b3f22'; c.fillRect(x, y - 74, 1, 2); c.fillRect(x, y - 40, 1, 2);
                    c.fillStyle = ton('#26302a', k); c.fillRect(x, y - 72, 1, 32);
                    if (i > 4 && i < n - 5 && i % 3) { c.fillStyle = '#ffd166'; c.fillRect(x, y - 69, 1, 2); }
                    for (let r = 0; r < 5; r++) {
                        const fiyat = i > n * 0.72 && i < n - 3;
                        if (i > 2 && i < n * 0.62 && (i * 3 + r * 7) % 5 < 3) { c.fillStyle = '#f4efe6'; c.fillRect(x, y - 63 + r * 4, 1, 1); }
                        if (fiyat && (i + r) % 3) { c.fillStyle = '#f7c59f'; c.fillRect(x, y - 63 + r * 4, 1, 1); }
                    }
                    break;
                }
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
                case 'perde': {
                    // kırmızı kadife: dikey kıvrımlar, altın korniş ve saçak
                    const kivrim = Math.sin(i * 0.9);
                    c.fillStyle = ton(kivrim > 0.3 ? '#a01f34' : kivrim < -0.3 ? '#5e0f1d' : '#7d1628', k); c.fillRect(x, y - 80, 1, 80);
                    c.fillStyle = '#c9a14a'; c.fillRect(x, y - 82, 1, 3);
                    if (i % 3 === 0) { c.fillStyle = '#e3c06b'; c.fillRect(x, y - 79, 1, 4); }
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
    if (o.duvar && !arkaDuvarlar(d).includes(o.duvar)) return;          // duvara asılı: duvar öndeyken görünmez
    if (!z0 && !GOLGESIZ.has(o.tur)) golge(c, P, d, o.gx, o.gy, o.gw, o.gd);
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
        // -------------------------------------------------------- sokak lambası, ağaç, kitaplık, oyun standı
        case 'sokaklambasi': {
            const q = W(o.gx + 0.15, o.gy + 0.15);
            c.fillStyle = '#2b2f36'; c.fillRect(q.x - 1, q.y - o.h, 2, o.h); c.fillRect(q.x - 3, q.y - 2, 6, 2);
            c.fillRect(q.x, q.y - o.h, 7, 2);
            const yanik = sahne.lambalar;
            c.fillStyle = yanik ? '#fff1b8' : '#8a8f96'; c.fillRect(q.x + 5, q.y - o.h + 1, 4, 3);
            if (yanik && sahne.isiklar) sahne.isiklar.push((g) => {
                parilti(c, q.x + 6, q.y - o.h * 0.45, 12, o.h * 0.55, '255,210,122', 0.2 * g);       // ışık konisi
                parilti(c, q.x + 3, q.y, 40, 20, '255,196,110', 0.34 * g);                           // yer havuzu
                parilti(c, q.x + 7, q.y - o.h + 2, 7, 7, '255,241,184', 0.9 * g);                     // ampul
            });
            break;
        }
        case 'agac': {
            // ağaç: zemin gölgesi, (kaldırımda) ızgaralı çukur, gövde ve taç. Boy: küçük / orta / büyük (çınar: geniş, çok
            // gövdeli taç, alacalı kabuk); çam: kat kat koni; meyve: küçük, meyveli. Çeşidi verilmemişse konumdan seçilir.
            // Yaprak tonu konumdan (üç ton); sonbaharda yaprak döken ağaçların bir kısmı sarı-turuncu.
            const q = W(o.gx + o.gw / 2, o.gy + o.gd / 2);
            const t0 = karma(o.gx, o.gy, 7), t1 = karma(o.gy, o.gx, 3);
            const cesit = o.cesit === 'yaprak' || !o.cesit ? (t1 < 0.4 ? 'kucuk' : t1 < 0.85 ? 'orta' : 'buyuk') : o.cesit;
            const boy = ({ buyuk: 1.45, orta: 1, kucuk: 0.72, meyve: 0.78, cam: 1.1 }[cesit] || 1) * (0.9 + t0 * 0.2);
            c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(q.x - 12 * boy, q.y - 2, 24 * boy, 4); c.fillRect(q.x - 8 * boy, q.y - 3, 16 * boy, 6);
            if (o.cukur) { kutu(c, P, d, o.gx - 0.05, o.gy - 0.05, o.gw + 0.1, o.gd + 0.1, 0, { ust: '#5a3d26' }); kutu(c, P, d, o.gx - 0.05, o.gy - 0.05, o.gw + 0.1, 0.05, 1, renkler('#6b737d')); kutu(c, P, d, o.gx - 0.05, o.gy + o.gd, o.gw + 0.1, 0.05, 1, renkler('#6b737d')); }
            const gece = sahne.evre === 'gece';
            const sonbahar = sahne.mevsim === 'sonbahar' && cesit !== 'cam' && karma(o.gx, o.gy, 11) < 0.55;
            const TONLAR = [['#2f7a3f', '#3f8f4f', '#5fb36d', '#276b35', '#86c97a'], ['#3a7f3a', '#4c944a', '#6aae5a', '#2e6d30', '#9ad48a'],
                ['#5d8a2e', '#6f9e38', '#8fbf4a', '#4e7626', '#b5dc72']];
            const yap = gece ? ['#1f3d2c', '#24472f', '#2c5638', '#1a3324', '#36603f']
                : sonbahar ? (t1 < 0.5 ? ['#d98a1e', '#e3a83a', '#f2c75c', '#b8661a', '#ffd98a'] : ['#c0571f', '#d9752e', '#e8a03c', '#9a3f17', '#f2c75c'])
                : cesit === 'cam' ? ['#1f5a3a', '#2a6b45', '#3a7f52', '#184a2f', '#5a9a6a'] : TONLAR[Math.floor(t0 * 3)];
            const gov = Math.round((cesit === 'cam' ? 8 : 14) * boy), kalin = cesit === 'buyuk' ? 4 : cesit === 'kucuk' ? 2 : 3;
            c.fillStyle = cesit === 'buyuk' ? '#8a7a5a' : '#5a3a22'; c.fillRect(q.x - 1, q.y - gov, kalin, gov);
            c.fillStyle = cesit === 'buyuk' ? '#c9bb92' : '#3f2817'; c.fillRect(q.x + kalin - 2, q.y - gov, 1, gov);
            if (cesit === 'buyuk') for (let i = 2; i < gov; i += 4) { c.fillStyle = '#d9cfb0'; c.fillRect(q.x + (i % 3) - 1, q.y - i, 2, 2); }   // çınarın alacalı kabuğu
            if (cesit === 'cam') {
                // kat kat koni
                for (let k = 0; k < 4; k++) {
                    const gen = Math.round((12 - k * 2.6) * boy), y0 = q.y - gov - k * 7 * boy;
                    for (let r = 0; r < 8 * boy; r++) {
                        const w = Math.round(gen * (r / (8 * boy)));
                        c.fillStyle = yap[(k + (r > 4 ? 1 : 0)) % 3]; c.fillRect(q.x - w + 1, y0 - 8 * boy + r, w * 2, 1);
                    }
                }
                c.fillStyle = yap[4]; c.fillRect(q.x, q.y - gov - 34 * boy, 2, 3);
                break;
            }
            const r = Math.round(11 * boy), ust = q.y - gov - r + 4;
            const loblar = cesit === 'buyuk' ? [[-0.55, 0.2], [0.5, 0.15], [0, -0.35]] : [[0, 0]];       // çınar: üç loblu geniş taç
            for (const [lx, ly] of loblar) {
                const cx = q.x + lx * r, cy = ust + ly * r;
                const rr0 = cesit === 'buyuk' ? r * 0.72 : r;
                for (let k = 0; k < 3; k++) for (let i = 0; i < 9; i++) {                                // alttan üste üç katman
                    const a = (i / 9) * Math.PI * 2 + k, rr = rr0 * (1 - k * 0.28);
                    c.fillStyle = yap[(i + k) % 3];
                    c.fillRect(Math.round(cx - 4 + Math.cos(a) * rr * (cesit === 'kucuk' ? 0.6 : 0.75)), Math.round(cy + 4 - k * 5 + Math.sin(a) * rr * 0.45), Math.round(8 * Math.max(0.8, boy * 0.8)), Math.round(7 * Math.max(0.8, boy * 0.8)));
                }
            }
            c.fillStyle = yap[3]; c.fillRect(q.x - r + 2, ust + 6, r * 2 - 4, 3);                       // alt gölgeli kenar
            c.fillStyle = yap[4]; c.fillRect(q.x - 3, ust - 8, 6, 2);                                    // tepe ışığı
            if (cesit === 'meyve' && !gece) for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#d94f3d' : '#f4a03c'; c.fillRect(q.x - 6 + i * 3, ust + (i % 3) * 3, 2, 2); }
            if (sonbahar && !gece) for (let i = 0; i < 3; i++) { c.fillStyle = yap[i]; c.fillRect(q.x - 8 + karma(o.gx, i) * 16, q.y - 1 + (i % 2), 2, 1); }   // dökülen yapraklar
            break;
        }
        case 'duvarlambasi': {
            const q = W(o.gx + o.gw / 2, o.gy + o.gd / 2);
            c.fillStyle = '#2b2f36'; c.fillRect(q.x - 2, q.y - o.h, 4, 2); c.fillRect(q.x - 1, q.y - o.h + 2, 2, 4);
            c.fillStyle = sahne.lambalar ? '#fff1b8' : '#c9c2b8'; c.fillRect(q.x - 2, q.y - o.h + 6, 4, 3);
            if (sahne.lambalar && sahne.isiklar) sahne.isiklar.push((g) => parilti(c, q.x, q.y - o.h + 8, 18, 16, '255,214,140', 0.4 * g));
            break;
        }
        case 'kitaplik':
            K(o.gx, o.gy, o.gw, o.gd, 5, renkler('#2e1a0e'));                                              // kaide
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#4a2c1a', kitaplikDeseni));
            K(o.gx - 0.06, o.gy - 0.03, o.gw + 0.12, o.gd + 0.06, 4, renkler('#6b3f22'), o.h);           // korniş
            for (let i = 0; i < o.gw; i += 2) {                                                            // raf lambaları
                const q = W(o.gx + i + 1, o.gy + o.gd);
                c.fillStyle = 'rgba(255,214,140,.5)'; c.fillRect(q.x - 6, q.y - o.h - 1, 12, 2);
            }
            break;
        case 'oyunstandi': {
            K(o.gx + 0.15, o.gy + 0.15, 0.7, 0.7, 8, renkler('#3b2418'));
            ['#d94f3d', '#3d7fd9', '#e3b23c', '#4caf6a'].forEach((r, i) => K(o.gx + 0.2 + (i % 2) * 0.3, o.gy + 0.22 + Math.floor(i / 2) * 0.3, 0.26, 0.26, 7 + (i % 2) * 3, renkler(r), 8));
            const q = W(o.gx + 0.5, o.gy + 0.5);
            c.fillStyle = '#ffd166'; c.fillRect(q.x - 9, q.y - o.h - 4, 18, 5);
            c.fillStyle = '#2a1d16'; c.fillRect(q.x - 7, q.y - o.h - 3, 14, 1);
            break;
        }
        // -------------------------------------------------------- bistro (kat 2) ve VIP Kulüp (kat 3) servisi
        case 'yemekasansoru': {
            // kat 1 mutfağından tabak çıkaran yemek asansörü: çelik gövde, ön yüzde açıklık ve içinde tepsi
            const yz = gorunenYuzler(d);
            const dolu = (sahne.mutfak?.hazir || 0) > 0, geliyor = sahne.mutfak?.asansorde;
            K(o.gx + 0.08, o.gy + 0.08, o.gw - 0.16, o.gd - 0.16, o.h, renkler('#9aa3ad', (cc, x, y, h, sol, st, yst, yn) => {
                if (st % 6 === 0) { cc.fillStyle = 'rgba(255,255,255,.16)'; cc.fillRect(x, y, 1, h); }
                if ((sol ? yz.sol : yz.sag) !== o.on || yst < 2 || yst > yn - 3) return;
                cc.fillStyle = '#5b6470'; cc.fillRect(x, y + 11, 1, 2); cc.fillRect(x, y + 31, 1, 2);
                cc.fillStyle = '#1c2126'; cc.fillRect(x, y + 13, 1, 18);                                   // açıklık
                cc.fillStyle = 'rgba(255,214,140,.18)'; cc.fillRect(x, y + 13, 1, 3);                       // iç lamba
                cc.fillStyle = '#c4ccd4'; cc.fillRect(x, y + 28, 1, 2);                                     // tepsi
                if (dolu && yst > 3 && yst < yn - 4) { cc.fillStyle = yst % 5 < 3 ? '#f4efe6' : '#c0703a'; cc.fillRect(x, y + 25, 1, 3); }
            }));
            K(o.gx + 0.04, o.gy + 0.04, o.gw - 0.08, o.gd - 0.08, 3, renkler('#6b737d'), o.h);
            const q = W(o.gx + 0.5, o.gy + 0.5);
            c.fillStyle = geliyor ? (Math.floor(performance.now() / 250) % 2 ? '#ffd166' : '#8a6a2a') : dolu ? '#5fb36d' : '#3b4048';
            c.fillRect(q.x - 2, q.y - o.h - 6, 4, 3);                                                         // çağrı lambası
            break;
        }
        case 'bistrotezgah': {
            // servis tezgâhı: çelik gövde, ahşap üst, gelen tabaklar; üstünde sarkan turuncu ısıtıcı lambalar
            K(o.gx + 0.1, o.gy, o.gw - 0.2, o.gd, o.h, renkler('#7f8a94', celik));
            K(o.gx + 0.05, o.gy - 0.03, o.gw - 0.1, o.gd + 0.06, 2, renkler('#8a5d36'), o.h);
            K(o.gx + 0.3, o.gy + o.gd - 0.55, 0.32, 0.32, 5, renkler('#e9ecef'), o.h + 2);                     // temiz tabak yığını
            for (let i = 0; i < Math.min(3, sahne.mutfak?.hazir || 0); i++) {
                K(o.gx + 0.3, o.gy + 0.25 + i * 0.75, 0.38, 0.38, 1, renkler('#f4efe6'), o.h + 2);
                K(o.gx + 0.38, o.gy + 0.33 + i * 0.75, 0.22, 0.22, 2, renkler(['#c0703a', '#e3b23c', '#5fb36d'][i]), o.h + 3);
            }
            for (const v of [0.45, 1.5, 2.55]) {
                const q = W(o.gx + 0.5, o.gy + v);
                c.fillStyle = '#2b2b2b'; c.fillRect(q.x, q.y - o.h - 52, 1, 22);
                c.fillStyle = '#b5523b'; c.fillRect(q.x - 3, q.y - o.h - 31, 7, 3); c.fillRect(q.x - 2, q.y - o.h - 33, 5, 2);
                c.fillStyle = '#ffb35c'; c.fillRect(q.x - 2, q.y - o.h - 28, 5, 1);
                c.fillStyle = 'rgba(255,150,60,.28)'; c.fillRect(q.x - 4, q.y - o.h - 27, 9, 24);
            }
            break;
        }
        case 'turnuva': {
            // turnuva panosu: bugün en çok oynanan oyunlar, oyun renginde skor çubukları (yalnızca duvar arkadayken)
            const yz = gorunenYuzler(d);
            const liste = sahne.turnuva || [];
            const enCok = Math.max(1, ...liste.map((x) => x.n));
            K(o.gx, o.gy, o.gw, o.gd, 30, renkler('#5a3a22', (cc, x, y, h, sol, st, yst, yn) => {
                if ((sol ? yz.sol : yz.sag) !== 'B' || yst < 1 || yst > yn - 2) return;
                cc.fillStyle = '#24382c'; cc.fillRect(x, y + 2, 1, h - 4);
                cc.fillStyle = '#e3b23c'; cc.fillRect(x, y + 3, 1, 3);                                       // başlık bandı
                if (yst % 4 === 2 && yst > 4 && yst < yn - 5) { cc.fillStyle = '#2a1d16'; cc.fillRect(x, y + 4, 1, 1); }
                liste.forEach((t, i) => {
                    cc.fillStyle = '#f4efe6'; if (yst === 3) cc.fillRect(x, y + 9 + i * 5, 1, 2);            // sıra numarası
                    if (yst > 4 && yst - 5 < (yn - 8) * t.n / enCok) { cc.fillStyle = t.renk; cc.fillRect(x, y + 9 + i * 5, 1, 3); }
                });
            }), 34);
            const q = W(o.gx, o.gy + o.gd / 2);
            c.fillStyle = '#e3b23c'; c.fillRect(q.x - 3, q.y - 72, 6, 4); c.fillRect(q.x - 1, q.y - 68, 2, 2); c.fillRect(q.x - 2, q.y - 66, 4, 1);   // kupa
            break;
        }
        case 'sehpa': {
            K(o.gx + 0.08, o.gy + 0.08, o.gw - 0.16, o.gd - 0.16, o.h - 2, renkler('#3b2418'));
            K(o.gx, o.gy, o.gw, o.gd, 2, renkler('#6b3f22'), o.h - 2);
            K(o.gx + 0.12, o.gy + 0.15, 0.32, 0.24, 2, renkler('#2b6cb0'), o.h); K(o.gx + 0.14, o.gy + 0.17, 0.28, 0.2, 1, renkler('#a33b20'), o.h + 2);
            const q = W(o.gx + o.gw * 0.7, o.gy + o.gd * 0.65);
            c.fillStyle = '#f4efe6'; c.fillRect(q.x - 1, q.y - o.h - 4, 3, 3); c.fillStyle = '#6b4423'; c.fillRect(q.x - 1, q.y - o.h - 4, 3, 1);   // fincan
            break;
        }
        case 'vipvitrin': {
            // camlı, altın çerçeveli VIP oyun vitrini: veritabanındaki VIP oyunların kutuları; masadaki oyunun yeri boş
            const oy = sahne.vipOyunlar || [];
            const sutun = Math.max(5, Math.ceil(oy.length / 2)), gen = (o.gw - 0.2) / sutun;
            K(o.gx, o.gy, o.gw, o.gd, 6, renkler('#2a160d'));
            K(o.gx, o.gy, o.gw, 0.18, o.h, renkler('#3b2418'));
            for (let r = 0; r < 2; r++) {
                const z = 8 + r * 20;
                K(o.gx + 0.06, o.gy + 0.18, o.gw - 0.12, o.gd - 0.28, 2, renkler('#b8892f'), z - 2);
                for (let i = 0; i < sutun; i++) {
                    const og = oy[r * sutun + i];
                    if (!og?.rafta) continue;
                    K(o.gx + 0.1 + i * gen + gen * 0.14, o.gy + 0.3, gen * 0.72, 0.42, 14, renkler(og.renk, (cc, x, y) => { cc.fillStyle = 'rgba(255,255,255,.4)'; cc.fillRect(x, y + 2, 1, 2); }), z);
                }
            }
            K(o.gx + 0.02, o.gy + 0.02, o.gw - 0.04, o.gd - 0.04, o.h - 6, {
                ust: 'rgba(200,235,245,.14)', sol: 'rgba(170,215,230,.2)', sag: 'rgba(150,195,215,.2)',
                desen: (cc, x, y, h, sol, st, yst, yn) => {
                    cc.fillStyle = '#c9a14a'; cc.fillRect(x, y, 1, 2); cc.fillRect(x, y + h - 2, 1, 2);
                    if (yst < 2 || yst > yn - 3) cc.fillRect(x, y, 1, h);
                    if (yst % 9 === 4) { cc.fillStyle = 'rgba(255,255,255,.3)'; cc.fillRect(x, y + 6 + (yst % 5) * 2, 1, 10); }
                },
            }, 6);
            K(o.gx - 0.03, o.gy - 0.03, o.gw + 0.06, o.gd + 0.06, 3, renkler('#c9a14a'), o.h);
            break;
        }
        case 'vipraf':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#2a160d', siseDeseni));
            K(o.gx - 0.03, o.gy - 0.03, o.gw + 0.06, o.gd + 0.06, 3, renkler('#c9a14a'), o.h);
            break;
        case 'vipbar': {
            // koyu ahşap VIP bar: altın kenarlı koyu üst, pirinç ayak barı, kadehler
            K(o.gx, o.gy, o.gw, o.gd, o.h - 3, renkler('#3b2014', (cc, x, y, h, sol, st) => {
                if (st % 8 === 0) { cc.fillStyle = 'rgba(0,0,0,.3)'; cc.fillRect(x, y + 2, 1, h - 4); }
                cc.fillStyle = '#c9a14a'; cc.fillRect(x, y + 3, 1, 1); cc.fillRect(x, y + h - 7, 1, 1);
                cc.fillStyle = '#1c0f08'; cc.fillRect(x, y + h - 3, 1, 3);
            }));
            K(o.gx - 0.05, o.gy - 0.05, o.gw + 0.1, o.gd + 0.1, 3, { ...renkler('#2a160d'), kenar: '#e3c06b' }, o.h - 3);
            for (let i = 0; i < o.gw; i++) {
                const p = W(o.gx + i + 0.5, o.gy + 0.45);
                c.fillStyle = '#e9ecef'; c.fillRect(p.x - 1, p.y - o.h - 6, 1, 4); c.fillRect(p.x - 2, p.y - o.h - 2, 3, 1);
                c.fillStyle = i % 2 ? '#7d1628' : '#e3c06b'; c.fillRect(p.x - 2, p.y - o.h - 9, 3, 3);
            }
            break;
        }
        case 'bartaburesi': {
            const q = W(o.gx + o.gw / 2, o.gy + o.gd / 2);
            c.fillStyle = '#c9a14a'; c.fillRect(q.x - 1, q.y - o.h, 2, o.h); c.fillRect(q.x - 3, q.y - 1, 6, 1);
            K(o.gx, o.gy, o.gw, o.gd, 3, renkler('#4a1c1c'), o.h - 3);
            break;
        }
        case 'kadifebariyer': {
            // altın direkler arasında sarkan kırmızı kadife ip
            const yatay = o.gw > o.gd, L = yatay ? o.gw : o.gd;
            const n = Math.max(2, Math.round(L / 1.2) + 1);
            const nok = Array.from({ length: n }, (_, i) => (yatay ? W(o.gx + (i / (n - 1)) * L, o.gy + o.gd / 2) : W(o.gx + o.gw / 2, o.gy + (i / (n - 1)) * L)));
            for (let i = 0; i < n - 1; i++) {
                const a = nok[i], b = nok[i + 1];
                for (let k = 0; k <= 12; k++) {
                    const t = k / 12;
                    c.fillStyle = k % 4 === 0 ? '#c9404a' : '#a01f34';
                    c.fillRect(a.x + (b.x - a.x) * t - 1, a.y + (b.y - a.y) * t - o.h + 3 + Math.sin(t * Math.PI) * 4, 2, 2);
                }
            }
            for (const q of nok) {
                c.fillStyle = '#8a6a2a'; c.fillRect(q.x - 3, q.y - 1, 7, 2);
                c.fillStyle = '#c9a14a'; c.fillRect(q.x - 1, q.y - o.h, 2, o.h);
                c.fillStyle = '#e3c06b'; c.fillRect(q.x - 2, q.y - o.h - 3, 4, 3);
            }
            break;
        }
        case 'hostkursu': {
            K(o.gx + 0.1, o.gy + 0.1, o.gw - 0.2, o.gd - 0.2, o.h, renkler('#2a160d', (cc, x, y, h) => { cc.fillStyle = '#c9a14a'; cc.fillRect(x, y + 2, 1, 1); cc.fillRect(x, y + h - 4, 1, 1); }));
            K(o.gx, o.gy, o.gw, o.gd, 3, renkler('#3b2418'), o.h);
            const q = W(o.gx + o.gw / 2, o.gy + o.gd / 2);
            c.fillStyle = '#f4efe6'; c.fillRect(q.x - 4, q.y - o.h - 5, 7, 2);                                  // rezervasyon defteri
            c.fillStyle = '#c9a14a'; c.fillRect(q.x + 4, q.y - o.h - 10, 1, 7);
            c.fillStyle = '#ffe3a0'; c.fillRect(q.x + 3, q.y - o.h - 12, 3, 2);                                 // masa lambası
            break;
        }
        case 'somine': {
            // mermer çerçeveli şömine: ön yüzde (doğu) titreşen piksel ateş, üstte ahşap raf, mumlar ve saat
            const yz = gorunenYuzler(d);
            const t = performance.now();
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#cfc4b2', (cc, x, y, h, sol, st, yst, yn) => {
                if ((sol ? yz.sol : yz.sag) !== 'D') { if (st % 5 === 0) { cc.fillStyle = 'rgba(0,0,0,.08)'; cc.fillRect(x, y, 1, h); } return; }
                if (yst < 5 || yst > yn - 6) { if (yst % 3 === 1) { cc.fillStyle = 'rgba(0,0,0,.08)'; cc.fillRect(x, y, 1, h); } return; }
                const ust = y + 12, alt = y + h - 3;
                cc.fillStyle = '#8a8f96'; cc.fillRect(x, ust - 2, 1, 2);
                cc.fillStyle = '#1a0f0a'; cc.fillRect(x, ust, 1, alt - ust);
                const f = Math.sin(yst * 0.9 + t / 120) * 3 + Math.sin(yst * 0.37 - t / 200) * 2;
                const boy = Math.max(2, Math.round(11 + f - Math.abs(yst - yn / 2) * 0.25));
                cc.fillStyle = '#d94f3d'; cc.fillRect(x, alt - 3 - boy, 1, boy);
                cc.fillStyle = '#ff8a3d'; cc.fillRect(x, alt - 3 - boy * 0.7, 1, boy * 0.7);
                cc.fillStyle = '#ffd166'; cc.fillRect(x, alt - 3 - boy * 0.35, 1, boy * 0.35);
                cc.fillStyle = yst % 4 < 2 ? '#5a3a22' : '#3f2817'; cc.fillRect(x, alt - 3, 1, 3);           // odunlar
            }));
            K(o.gx - 0.02, o.gy - 0.12, o.gw + 0.14, o.gd + 0.24, 3, { ...renkler('#3b2418'), kenar: '#c9a14a' }, o.h);
            for (const v of [0.25, o.gd - 0.25]) {
                const q = W(o.gx + 0.5, o.gy + v);
                c.fillStyle = '#f4efe6'; c.fillRect(q.x, q.y - o.h - 9, 2, 6);
                c.fillStyle = Math.floor(t / 160 + v) % 2 ? '#ffd166' : '#ff8a3d'; c.fillRect(q.x, q.y - o.h - 11, 2, 2);
            }
            { const q = W(o.gx + 0.5, o.gy + o.gd / 2); c.fillStyle = '#c9a14a'; c.fillRect(q.x - 3, q.y - o.h - 10, 6, 7); c.fillStyle = '#f4efe6'; c.fillRect(q.x - 2, q.y - o.h - 9, 4, 4); }
            break;
        }
        case 'chesterfield':
            kanepe(K, o, '#5a2416');
            break;
        case 'derikoltuk':
            kanepe(K, o, '#6b3a1c');
            break;
        case 'loca': {
            // perdeli özel loca: U biçimli yüksek sırtlı kanepe, ortada mumlu masa, açık kenarda toplanmış kadife perdeler
            const ana = '#4a1c1c', sirt = renkler('#3b1414', capitone);
            K(o.gx, o.gy, 0.95, o.gd, 10, renkler(ana));
            for (const y0 of [o.gy, o.gy + o.gd - 0.9]) K(o.gx, y0, 2.3, 0.9, 10, renkler(ana));
            K(o.gx, o.gy, 0.35, o.gd, o.h, sirt);
            for (const y0 of [o.gy, o.gy + o.gd - 0.35]) K(o.gx, y0, 2.3, 0.35, o.h - 6, sirt);
            K(o.gx + 1.2, o.gy + 1.3, 0.9, o.gd - 2.6, 12, renkler('#2a160d'));
            K(o.gx + 1.15, o.gy + 1.25, 1, o.gd - 2.5, 2, renkler('#6b3f22'), 12);
            { const q = W(o.gx + 1.65, o.gy + o.gd / 2); c.fillStyle = '#f4efe6'; c.fillRect(q.x, q.y - 22, 2, 6); c.fillStyle = Math.floor(performance.now() / 180) % 2 ? '#ffd166' : '#ff8a3d'; c.fillRect(q.x, q.y - 24, 2, 2); }
            for (const y0 of [o.gy + 0.02, o.gy + o.gd - 0.3]) K(o.gx + 2.4, y0, 0.28, 0.28, 58, renkler('#7d1628', (cc, x, y, h, sol, st) => { if (st % 2) { cc.fillStyle = '#5e0f1d'; cc.fillRect(x, y, 1, h); } cc.fillStyle = '#c9a14a'; cc.fillRect(x, y + 22, 1, 2); }));
            K(o.gx + 2.45, o.gy, 0.08, o.gd, 3, renkler('#c9a14a'), 58);
            break;
        }
        case 'piyanotaburesi':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#1c1c1c'));
            K(o.gx + 0.04, o.gy + 0.04, o.gw - 0.08, o.gd - 0.08, 2, renkler('#5a2416'), o.h);
            break;
        // -------------------------------------------------------- kat 2 okuma köşesi
        case 'okumakoltugu':
            K(o.gx + 0.1, o.gy + 0.1, 0.8, 0.8, 9, renkler('#3f6f5a'));
            K(o.gx + 0.7, o.gy + 0.1, 0.2, 0.8, 18, renkler('#355e4c'), 0);
            K(o.gx + 0.1, o.gy + 0.1, 0.6, 0.15, 13, renkler('#355e4c'), 0);
            K(o.gx + 0.1, o.gy + 0.75, 0.6, 0.15, 13, renkler('#355e4c'), 0);
            K(o.gx + 0.25, o.gy + 0.3, 0.4, 0.4, 2, renkler('#e3b23c'), 9);                   // yastık
            break;
        case 'piyano': {
            // kuyruklu piyano: klavye o.klavye yüzünde (piyanist o taraftan çalar)
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#1c1c1c'));
            if (o.klavye === 'B') K(o.gx + 0.04, o.gy + 0.08, 0.18, o.gd - 0.16, 2, { ust: '#f4efe6', sol: '#d9d2c5', sag: '#c9c2b5' }, o.h - 6);
            else K(o.gx + 0.05, o.gy + o.gd - 0.22, o.gw - 0.1, 0.18, 2, { ust: '#f4efe6', sol: '#d9d2c5', sag: '#c9c2b5' }, o.h - 6);
            K(o.gx + 0.3, o.gy, o.gw - 0.3, 0.12, 14, renkler('#1c1c1c'), o.h);                // açık kapak
            break;
        }
        case 'bar':
            K(o.gx, o.gy, o.gw, o.gd, o.h - 3, renkler('#7a4b2a', (cc, x, y, h, sol, s) => {
                if (s % 10 === 0) { cc.fillStyle = 'rgba(0,0,0,.18)'; cc.fillRect(x, y + 2, 1, h - 4); }
                if (s % 10 === 1) { cc.fillStyle = 'rgba(255,255,255,.08)'; cc.fillRect(x, y + 2, 1, h - 4); }
                cc.fillStyle = 'rgba(0,0,0,.22)'; cc.fillRect(x, y, 1, 2);                                  // tezgâh altı gölgesi
                cc.fillStyle = '#c9a14a'; cc.fillRect(x, y + h - 7, 1, 1);                                 // pirinç ayak barı
                cc.fillStyle = '#2e1a0e'; cc.fillRect(x, y + h - 3, 1, 3);                                 // süpürgelik
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
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#5e3b1f', siseDeseni));
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
            // ön cephe: tuğla denizlik duvarı + krem pencere eşiği
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#9b5a3c', (cc, x, y, h, sol, st) => {
                tuglaDeseni(cc, x, y, h, sol, st);
                if (o.sarmasik) for (let r = 0; r < h; r++) if (karma(o.gx + o.gy, st, r) < 0.18 + r / h * 0.3) { cc.fillStyle = karma(st, r, 2) < 0.5 ? '#3f7a3a' : '#2f6b2f'; cc.fillRect(x, y + r, 1, 1); }
            }));
            K(o.gx - 0.02, o.gy - 0.04, o.gw + 0.04, o.gd + 0.1, 2, renkler('#e8d6b3'), o.h);
            break;
        case 'direk':
            // tuğla cephe ayağı
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#8a4f34', tuglaDeseni));
            K(o.gx - 0.03, o.gy - 0.03, o.gw + 0.06, o.gd + 0.06, 3, renkler('#e8d6b3'), o.h);
            break;
        case 'camcephe': {
            // vitrin camı: ahşap kayıt, saate göre yansıma/sıcak ışık; içerisi camdan görünür
            const gece = sahne.evre && sahne.evre !== 'gun';
            K(o.gx, o.gy, o.gw, o.gd, o.h, {
                ust: '#4a2e1a', sol: gece ? 'rgba(255,196,120,.16)' : 'rgba(190,225,240,.2)', sag: gece ? 'rgba(255,186,110,.13)' : 'rgba(160,200,220,.2)',
                desen: (cc, x, y, hh, sol, st) => {
                    cc.fillStyle = '#4a2e1a';
                    cc.fillRect(x, y, 1, 2); cc.fillRect(x, y + hh - 2, 1, 2); cc.fillRect(x, y + Math.round(hh * 0.62), 1, 1);
                    if (st < 1) cc.fillRect(x, y, 1, hh);
                    if (!gece && st % 24 > 8 && st % 24 < 12) { cc.fillStyle = 'rgba(255,255,255,.28)'; cc.fillRect(x, y + 6 + (st % 24 - 8) * 4, 1, 12); }
                },
            });
            break;
        }
        case 'cepheust':
            // cephe alınlığı: tuğla kuşak ve krem korniş
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#9b5a3c', tuglaDeseni));
            K(o.gx - 0.02, o.gy - 0.06, o.gw + 0.04, o.gd + 0.12, 3, renkler('#e8d6b3'), o.h);
            K(o.gx, o.gy - 0.02, o.gw, o.gd + 0.06, 2, renkler('#e8d6b3'), -1);
            break;
        case 'karavanatabela': {
            // kapının üstünde ahşap tabela: altın çerçeve, kenarında ampuller; akşam/gece ampuller ışık saçar
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#2f4a3a', (cc, x, y, hh, sol, st) => {
                if (st % 6 === 2) { cc.fillStyle = sahne.evre === 'gun' ? '#e8d6b3' : '#fff1b8'; cc.fillRect(x, y + 1, 1, 1); cc.fillRect(x, y + hh - 2, 1, 1); }
            }));
            K(o.gx - 0.05, o.gy - 0.03, o.gw + 0.1, o.gd + 0.06, 2, renkler('#c9a14a'), o.h);
            K(o.gx - 0.05, o.gy - 0.03, o.gw + 0.1, o.gd + 0.06, 2, renkler('#c9a14a'), -2);
            for (const u of [0.4, o.gw - 0.4]) { const q = W(o.gx + u, o.gy); c.fillStyle = '#3b2a1e'; c.fillRect(q.x, q.y - 4, 1, 4); }   // askı
            if (sahne.evre && sahne.evre !== 'gun') {
                const q = W(o.gx + o.gw / 2, o.gy + o.gd);
                c.save(); c.globalCompositeOperation = 'lighter';
                const g = c.createRadialGradient(q.x, q.y - o.h / 2, 2, q.x, q.y - o.h / 2, 60);
                g.addColorStop(0, 'rgba(255,214,140,.32)'); g.addColorStop(1, 'rgba(255,214,140,0)');
                c.fillStyle = g; c.fillRect(q.x - 60, q.y - o.h / 2 - 40, 120, 80);
                c.restore();
            }
            break;
        }
        case 'parkbanki': {
            // park bankı: dökme demir ayaklar, ahşap oturak latası, arkalık (cephe tarafında) ve kolçaklar
            const demir = renkler('#2b2f36');
            for (const u of [0.1, o.gw - 0.18]) {
                K(o.gx + u, o.gy + 0.1, 0.08, 0.35, 7, demir);
                K(o.gx + u, o.gy + 0.04, 0.08, 0.08, o.h, demir);
                K(o.gx + u, o.gy + 0.04, 0.08, 0.42, 2, demir, 11);                                 // kolçak
            }
            for (let i = 0; i < 3; i++) K(o.gx + 0.05, o.gy + 0.12 + i * 0.13, o.gw - 0.1, 0.1, 2, renkler('#a8743f'), 7);
            for (let i = 0; i < 2; i++) K(o.gx + 0.05, o.gy + 0.04, o.gw - 0.1, 0.06, 3, renkler('#9b6a3a'), 10 + i * 4);
            break;
        }
        case 'cop':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#3f6f4f', (cc, x, y, hh, sol, st) => { if (st % 3 === 0) { cc.fillStyle = 'rgba(0,0,0,.18)'; cc.fillRect(x, y + 2, 1, hh - 3); } }));
            K(o.gx - 0.03, o.gy - 0.03, o.gw + 0.06, o.gd + 0.06, 2, renkler('#2b2f36'), o.h);
            break;
        case 'cicek': {
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#7a4b2a', (cc, x, y, hh, sol, st) => { if (st % 5 === 0) { cc.fillStyle = 'rgba(0,0,0,.2)'; cc.fillRect(x, y, 1, hh); } }));
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, 0, { ust: '#4a3020' }, o.h);
            for (let i = 0; i < 7; i++) {
                const q = W(o.gx + 0.12 + i * 0.13, o.gy + 0.12 + (i % 2) * 0.12);
                c.fillStyle = '#3f8f4f'; c.fillRect(q.x, q.y - o.h - 4, 2, 4);
                c.fillStyle = ['#d94f3d', '#ffd166', '#f06292', '#ffffff'][i % 4]; c.fillRect(q.x - 1, q.y - o.h - 6, 3, 2);
            }
            break;
        }
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
        default:
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#888888'));
    }
}

// Asansör: fırçalanmış çelik kuyu, güney yüzünde (dünya) kapı. Kapı yüzü kameraya dönükse çizilir;
// biri binerken/inerken kapı açık (içerisi ışıklı).
function asansorCiz(c, P, d, kat, acik) {
    const m = ASANSOR_GOVDE;
    const YUK = 80;
    // Kuyu: çelik dikmeler arasında cam paneller; camdan ışıklı kabin, halatlar ve karşı ağırlık görünür
    const kabinY = 18 + Math.round(6 * Math.sin(performance.now() / 1400));
    golge(c, P, d, m.gx, m.gy, m.gw, m.gd, 1.3);
    kutu(c, P, d, m.gx, m.gy, m.gw, m.gd, YUK, renkler('#8f98a3', (cc, x, y, h, sol, st) => {
        if (st % 16 < 2) { cc.fillStyle = sol ? '#aab3bd' : '#7d8692'; cc.fillRect(x, y, 1, h); if (st % 16 === 1) { cc.fillStyle = 'rgba(0,0,0,.25)'; cc.fillRect(x, y, 1, h); } return; }
        cc.fillStyle = sol ? '#1d2a33' : '#16222a'; cc.fillRect(x, y + 6, 1, h - 14);              // camın ardındaki karanlık kuyu
        cc.fillStyle = '#3a3f46'; if (st % 7 === 3) cc.fillRect(x, y + 6, 1, kabinY - 6);          // halatlar
        cc.fillStyle = sol ? '#e8cf8f' : '#d1b877'; cc.fillRect(x, y + kabinY, 1, 30);             // ışıklı kabin
        cc.fillStyle = '#6b737d'; cc.fillRect(x, y + kabinY, 1, 2); cc.fillRect(x, y + kabinY + 28, 1, 2);
        cc.fillStyle = 'rgba(190,230,245,.22)'; cc.fillRect(x, y + 6, 1, h - 14);                // cam
        if ((st + 6) % 16 < 2) { cc.fillStyle = 'rgba(255,255,255,.35)'; cc.fillRect(x, y + 10 + (st % 16) * 3, 1, 14); }   // yansıma
        cc.fillStyle = sol ? '#9aa3ad' : '#7d8692'; cc.fillRect(x, y, 1, 6); cc.fillRect(x, y + h - 8, 1, 8);   // üst/alt kasa
    }));
    kutu(c, P, d, m.gx - 0.04, m.gy - 0.04, m.gw + 0.08, m.gd + 0.08, 4, renkler('#5b6470'), YUK);
    kutu(c, P, d, m.gx + 0.2, m.gy + 0.2, m.gw - 0.4, m.gd - 0.4, 3, renkler('#3b4048'), YUK + 4);      // makine dairesi
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
    const AYAK = minder ? 3 : 11, KALINLIK = minder ? 3 : 5, UST = AYAK + KALINLIK;
    const p = 0.03, k = 0.15;                            // kenar payı, köşe yumuşatma
    golge(c, P, d, y.gx + 0.05, y.gy + 0.05, y.gw - 0.1, y.gd - 0.1, 1.2);
    for (const [ax, ay] of [[0.16, 0.16], [y.gw - 0.31, 0.16], [0.16, y.gd - 0.31], [y.gw - 0.31, y.gd - 0.31]]) {
        kutu(c, P, d, y.gx + ax, y.gy + ay, 0.15, 0.15, AYAK, renkler(ton(ahsap, 0.62)));
    }
    if (!minder) kutu(c, P, d, y.gx + 0.14, y.gy + 0.14, y.gw - 0.28, y.gd - 0.28, 3, renkler(ton(ahsap, 0.55)), AYAK - 3);   // etek tahtası
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
        const matRenk = minder ? '#c9772a' : kat === 1 ? '#efe3c8' : kat === 2 ? '#2f6b45' : '#1f4a35';
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
    if (y.lamba === 'sarkit') {
        // yeşil abajurlu sarkıt lamba (ışık halkası loş kat geçişinde)
        c.fillStyle = '#2b2b2b'; c.fillRect(orta.x, orta.y - DUVAR - 6, 1, DUVAR - 46);
        c.fillStyle = '#2f6b45'; c.fillRect(orta.x - 4, orta.y - 54, 9, 2); c.fillRect(orta.x - 6, orta.y - 52, 13, 4);
        c.fillStyle = '#c9a14a'; c.fillRect(orta.x - 6, orta.y - 48, 13, 1);
        c.fillStyle = '#fff1b8'; c.fillRect(orta.x - 3, orta.y - 47, 7, 1);
    } else if (y.lamba === 'avize') {
        // altın avize: halka üstünde mumlar ve kristal damlalar
        const t = performance.now();
        c.fillStyle = '#c9a14a'; c.fillRect(orta.x, orta.y - DUVAR - 8, 1, DUVAR - 50); c.fillRect(orta.x - 2, orta.y - 62, 5, 6);
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2, x = Math.round(orta.x + Math.cos(a) * 14), yy = Math.round(orta.y - 55 + Math.sin(a) * 5);
            c.fillStyle = '#8a6a2a'; c.fillRect(Math.min(x, orta.x), yy, Math.abs(x - orta.x) || 1, 1);
            c.fillStyle = '#e3c06b'; c.fillRect(x - 1, yy, 3, 1);
            c.fillStyle = '#f4efe6'; c.fillRect(x, yy - 4, 1, 4);
            c.fillStyle = Math.floor(t / 150 + i) % 3 ? '#ffd166' : '#fff1b8'; c.fillRect(x, yy - 6, 1, 2);
            if (i % 2) { c.fillStyle = 'rgba(210,235,245,.8)'; c.fillRect(x, yy + 2, 1, 3); }
        }
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
            golge(c, P, d, s.gx + pay, s.gy + pay, gen, gen, 0.8);
            if (vip) {
                kutu(c, P, d, s.gx + pay, s.gy + pay, gen, gen, OTURAK, renkler(ana));
                kutu(c, P, d, s.gx + pay + 0.04, s.gy + pay + 0.04, gen - 0.08, gen - 0.08, 1, renkler('#7a3e26'), OTURAK);
                return;
            }
            const ayak = renkler(ton(ana, 0.62));
            for (const [u, v] of [[0, 0], [gen - 0.09, 0], [0, gen - 0.09], [gen - 0.09, gen - 0.09]]) kutu(c, P, d, s.gx + pay + u, s.gy + pay + v, 0.09, 0.09, OTURAK - 3, ayak);
            kutu(c, P, d, s.gx + pay, s.gy + pay, gen, gen, 3, renkler(ana), OTURAK - 3);
        },
    }, {
        k: temel + (onde ? 0.25 : -0.08),
        f: () => {
            if (vip) kutu(c, P, d, sirt.gx, sirt.gy, sirt.gw, sirt.gd, 16, renkler(ton(ana, 0.9)), OTURAK);
            else {
                // iki dikme + üst lata + orta çıta: arası boş, arkası görünür
                const dikme = yatay
                    ? [[sirt.gx, sirt.gy, sirt.gw, 0.1], [sirt.gx, sirt.gy + sirt.gd - 0.1, sirt.gw, 0.1]]
                    : [[sirt.gx, sirt.gy, 0.1, sirt.gd], [sirt.gx + sirt.gw - 0.1, sirt.gy, 0.1, sirt.gd]];
                for (const [x, yy, w, h] of dikme) kutu(c, P, d, x, yy, w, h, 13, renkler(ton(ana, 0.8)), OTURAK);
                kutu(c, P, d, sirt.gx, sirt.gy, sirt.gw, sirt.gd, 5, renkler(ton(ana, 0.95)), OTURAK + 8);
                kutu(c, P, d, sirt.gx, sirt.gy, sirt.gw, sirt.gd, 2, renkler(ton(ana, 0.9)), OTURAK + 3);
            }
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
    if (tur === 'host') Object.assign(p, { gomlek: '#1f1f1f', gomlekG: '#151515', gomlekA: '#2e2e2e', pantolon: '#1c1c1c', pantolonG: '#141414', etek: false, gozluk: false });
    if (ek.rol === 'sarkici') Object.assign(p, { etek: true, stil: 1, gomlek: '#a8282f', gomlekG: '#7f1d22', gomlekA: '#c9404a', pantolon: '#a8282f', pantolonG: '#7f1d22', gozluk: false });
    if (ek.rol === 'gitarist') Object.assign(p, { gomlek: '#2b2b2b', gomlekG: '#1c1c1c', gomlekA: '#444444', etek: false });
    if (ek.rol === 'piyanist') Object.assign(p, { gomlek: '#f4efe6', gomlekG: '#d9d2c5', gomlekA: '#ffffff', pantolon: '#1c1c1c', pantolonG: '#141414', etek: false });
    Object.assign(p, ek);
    p.ogrenci = ogrenci && tur === 'musteri';
    p.anahtar = `${tohum}-${tur}-${p.ogrenci ? 1 : 0}-${ek.rol || ''}-${ek.yardimci ? 1 : 0}-${ek.vip ? 1 : 0}`;
    return p;
}

// Tek kare sprite (16 x 30 alan, SX/SY kaydırmalı). poz: ayakta | yuruyor | oturuyor
function spriteUret(p, { poz, arka, kare, tepsi, elKalkik }) {
    const t = document.createElement('canvas');
    t.width = SPRITE_G; t.height = SPRITE_Y;
    // dış hat için getImageData yapılır: CPU tuvali GPU'dan geri okuma beklemesini önler (sonuç atlasa kopyalanır)
    const c = t.getContext('2d', { willReadFrequently: true });
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
    if (p.tur === 'garson' && p.vip) {
        // VIP Kulüp garsonu: siyah yelek, altın papyon ve düğmeler, önlüksüz
        if (arka) r(4, 14, 8, 7, '#1c1c1c');
        else { r(4, 14, 3, 7, '#1c1c1c'); r(9, 14, 3, 7, '#141414'); r(7, 14, 2, 1, '#e3b23c'); r(6, 17, 1, 1, '#c9a14a'); r(6, 19, 1, 1, '#c9a14a'); }
    } else if (p.tur === 'garson') {
        r(4, 14, 2, 7, '#262626'); r(10, 14, 2, 7, '#1c1c1c');                                    // yelek
        if (!arka) { r(7, 14, 2, 1, '#c0392b'); r(5, 18, 6, 9, '#ffffff'); r(10, 18, 1, 9, '#e3ddd2'); }   // papyon, önlük
        else r(7, 19, 2, 1, '#ffffff');                                                            // önlük bağı
    }
    if (p.tur === 'host' && !arka) { r(6, 14, 4, 2, '#f4efe6'); r(7, 14, 2, 1, '#1c1c1c'); r(5, 17, 1, 2, '#e3b23c'); }   // gömlek yakası, kravat, rozet
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
    if (!s) {
        s = atlasYeri();
        atlasC.drawImage(spriteUret(p, o), s.x, s.y);
        spriteOnbellek.set(a, s);
    }
    return s;
}

// Karakter atlası: kareler 512 px'lik sayfalarda toplanır (binlerce küçük tuval yerine; GPU belleğini azaltır).
// Yeni kare yalnızca son sayfaya eklenir, böylece her eklemede yalnızca o küçük sayfa yeniden yüklenir.
// Sayfa sınırı aşılınca hepsi temizlenip kareler yeniden üretilir.
const ATLAS = 512, ATLAS_SAYFA = 40;
const sayfalar = [];
let atlasC = null, atlasX = 0, atlasY = 0;
function yeniSayfa() {
    const t = document.createElement('canvas');
    t.width = ATLAS; t.height = ATLAS;
    sayfalar.push(t); atlasC = t.getContext('2d'); atlasX = 0; atlasY = 0;
}
function atlasYeri() {
    if (!atlasC) yeniSayfa();
    if (atlasX + SPRITE_G > ATLAS) { atlasX = 0; atlasY += SPRITE_Y; }
    if (atlasY + SPRITE_Y > ATLAS) {
        if (sayfalar.length >= ATLAS_SAYFA) { sayfalar.length = 0; spriteOnbellek.clear(); }
        yeniSayfa();
    }
    const yer = { x: atlasX, y: atlasY, t: sayfalar[sayfalar.length - 1] };
    atlasX += SPRITE_G;
    return yer;
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
        c.drawImage(s.t, s.x, s.y, SPRITE_G, SPRITE_Y, x, y, SPRITE_G, SPRITE_Y); c.restore();
    } else c.drawImage(s.t, s.x, s.y, SPRITE_G, SPRITE_Y, x, y, SPRITE_G, SPRITE_Y);
}

// ------------------------------------------------------------------ sahne
// Görünen bölgedeki sahne. bolge: doğal koordinatta ekranda görünen dikdörtgen (dışı çizilmez).
// Sıra: zemin katmanı → kafenin arka duvarlarının gerisindeki sokak öğeleri → duvar katmanı → öndeki her şey
// (iç mekân + sokak, derinliğe göre) → gün ışığı tonu (kafe içi hariç) → gece ışıkları.
export function sahneCiz(c, sahne, bolge) {
    const { kat, d } = sahne;
    const P = izdusum(d);
    const evre = sahne.evre || 'gun';
    const b0 = bolge || { x0: 0, y0: 0, x1: DOGAL_G, y1: DOGAL_Y };
    const BW = b0.x1 - b0.x0, BH = b0.y1 - b0.y0;
    c.fillStyle = ARKA_RENK[evre]; c.fillRect(b0.x0, b0.y0, BW, BH);
    const dis = kat === 1 && disGorunur(d);
    const sehir = kat === 1;
    const isik = sehir ? gunIsigi(sahne.dakika ?? 720) : null;
    sahne.isiklar = []; sahne.emisler = [];
    sahne.isikGucu = isik ? isik.guc : 0;
    sahne.lambalar = sahne.isikGucu > 0.15;
    const zl = zeminVeDuvarlar(kat, d, evre, 'zemin');
    c.drawImage(zl.tuval, zl.x0, zl.y0);
    const derinlik = (gx, gy, gw = 1, gd = 1) => {
        const r = dikdortgenDondur(d, gx, gy, gw, gd);
        return r.gx + r.gy + (r.gw + r.gd) / 2;
    };
    const kutuDon = (gx, gy, gw, gd) => { const r = dikdortgenDondur(d, gx, gy, gw, gd); return { rx0: r.gx, ry0: r.gy, rx1: r.gx + r.gw, ry1: r.gy + r.gd }; };
    const gorunur = (x, y) => x > b0.x0 - 160 && x < b0.x1 + 160 && y > b0.y0 - 80 && y < b0.y1 + 260;
    const dusuk = (sahne.olcek || 1) < 0.5;                                                     // uzak yakınlaştırmada sadeleştir
    const disari = [];
    const ekleDis = (gx, gy, gw, gd, f, ek = 0) => {
        const q = P.W(gx + gw / 2, gy + gd / 2);
        if (!gorunur(q.x, q.y)) return;
        disari.push({ k: derinlik(gx, gy, gw, gd) - 0.5 + ek, kutu: kutuDon(gx, gy, gw, gd), arka: arkadaMi(d, gx, gy, gw, gd), f });
    };
    sahne.binaDurum = {};
    if (sehir) {
        const kafe = kafeAltigeni(P, d);
        const po = pencereOrani(sahne.dakika ?? 720);
        for (const b of BINALAR) {
            const alt = binaAltigeni(b, d);
            const xs = alt.map((p) => p.x), ys = alt.map((p) => p.y);
            if (Math.max(...xs) < b0.x0 - 20 || Math.min(...xs) > b0.x1 + 20 || Math.max(...ys) < b0.y0 - 20 || Math.min(...ys) > b0.y1 + 20) continue;
            const arka = arkadaMi(d, b.x, b.y, b.w, b.d);
            const ustunde = sahne.fare && icindeMi(alt, sahne.fare);
            // Kafeyi ekranda örten öndeki binalar zemin katına kadar kesilir (fare üstündeyse tam görünür)
            const kesik = !arka && !ustunde && cokgenKesisir(alt, kafe);
            const durum = { kepenk: kepenkOrani(b, sahne.dakika ?? 720), kesik, pencereOrani: po };
            sahne.binaDurum[b.id] = durum;
            disari.push({ k: derinlik(b.x, b.y, b.w, b.d) - 0.5, kutu: kutuDon(b.x, b.y, b.w, b.d), arka, f: () => binaCiz(c, P, d, b, durum, sahne) });
        }
        const kucuk = new Set(['cop', 'cicek', 'saksi', 'kasalar', 'tabure', 'meyvekasasi', 'gazetestandi', 'bisikletpark']);
        for (const o of [...SOKAK_ESYALARI, ...BINA_ONU, ...(KATLAR[1].dis || [])]) {
            if (dusuk && kucuk.has(o.tur)) continue;
            const ciz = (cc, sh) => { if (!esyaCiz(cc, P, d, o, sh)) nesneCiz(cc, P, d, o, sh); };
            let f = DURAGAN.has(o.tur) ? () => esyaSpriteCiz(c, P, d, o, sahne, ciz) : () => ciz(c, sahne);
            if ((o.tur === 'agac' || o.tur === 'cardak') && !arkadaMi(d, o.gx, o.gy, o.gw, o.gd)) {
                // kamera ile kafe arasında kalıp kafeyi örten ağaç yarı saydam (her kamera yönünde yeniden hesaplanır)
                const q = P.W(o.gx + o.gw / 2, o.gy + o.gd / 2);
                const tepe = [{ x: q.x - 16, y: q.y - 52 }, { x: q.x + 16, y: q.y - 52 }, { x: q.x + 16, y: q.y - 6 }, { x: q.x - 16, y: q.y - 6 }];
                if (cokgenKesisir(tepe, kafe)) { const f0 = f; f = () => { c.globalAlpha = AGAC_SAYDAMLIK; f0(); c.globalAlpha = 1; }; }
            }
            ekleDis(o.gx, o.gy, o.gw, o.gd, f);
        }
        // kafenin kameraya göre öndeki cepheleri (ön cephe kapı ve tabelalı; yan/arka cepheler cam vitrinli)
        for (const F of ['B', 'D', 'K'].filter((y) => !arkaDuvarlar(d).includes(y))) {
            for (const o of yanCephe(F)) {
                const ciz = (cc, sh) => { if (!esyaCiz(cc, P, d, o, sh)) nesneCiz(cc, P, d, o, sh); };
                ekleDis(o.gx, o.gy, o.gw, o.gd, DURAGAN.has(o.tur) ? () => esyaSpriteCiz(c, P, d, o, sahne, ciz) : () => ciz(c, sahne));
            }
        }
        if (dis) {
            for (const o of cepheNesneleri()) ekleDis(o.gx, o.gy, o.gw, o.gd, () => esyaSpriteCiz(c, P, d, o, sahne, (cc, sh) => nesneCiz(cc, P, d, o, sh)), o.tur === 'tente' ? 0.6 : o.tur === 'karavanatabela' ? 3 : 0);
            // akşam/gece kafe camlarından kaldırıma süzülen amber ışık
            sahne.isiklar.push((g) => {
                for (const [x0, x1] of [[1.5, 4.5], [5.5, 9.5], [10.5, 14.5]]) for (let i = 0; i < 9; i++) {
                    const u = i / 8, yy = IC_DERINLIK + u * 2.6, gen = (x1 - x0) * (1 + u * 0.5), orta = (x0 + x1) / 2;
                    kutu(c, P, d, orta - gen / 2, yy, gen, 0.32, 0, { ust: `rgba(255,184,96,${0.3 * g * (1 - u) * 0.55})` });
                }
            });
        }
        const s = sahne.sehir;
        if (s) {
            for (const a of s.araclar) {
                const L = ARAC_BOY[a.tip] / 2, W = 0.4;
                const [gw, gd] = a.eksen === 'x' ? [2 * L, 2 * W] : [2 * W, 2 * L];
                ekleDis(a.x - gw / 2, a.y - gd / 2, gw, gd, () => aracCiz(c, P, d, a, sahne));
            }
            for (const y of s.yayalar) {
                if ((y.alfa ?? 1) <= 0.02) continue;
                ekleDis(y.gx + 0.3, y.gy + 0.3, 0.4, 0.4, () => { c.globalAlpha = y.alfa ?? 1; karakterCiz(c, P, d, dusuk ? { ...y, kare: 0 } : y); c.globalAlpha = 1; }, 0.1);
            }
            if (!dusuk) {
                for (const k of s.kediler) ekleDis(k.x - 0.2, k.y - 0.2, 0.4, 0.4, () => kediCiz(c, P, d, k), 0.1);
                for (const g of s.guvercinler) ekleDis(g.x - 0.1, g.y - 0.1, 0.2, 0.2, () => guvercinCiz(c, P, d, g), 0.1);
            }
            for (const k of s.kopekler) ekleDis(k.x - 0.3, k.y - 0.3, 0.6, 0.6, () => {
                if (k.tasma) {                                                                  // tasma: sahibinin elinden köpeğe
                    const a = P.W(k.tasma.x, k.tasma.y), b = P.W(k.x, k.y);
                    c.strokeStyle = '#8b3a2e'; c.lineWidth = 1; c.beginPath(); c.moveTo(a.x + 3, a.y - 18); c.lineTo(b.x + 4, b.y - 9); c.stroke();
                }
                kopekCiz(c, P, d, k);
            }, 0.1);
        }
    }
    // motor bireyleri: odanın dışındakiler (kuyruk, gelen ve giden müşteriler) sokak öğesi olarak sıralanır
    const icerde = [];
    for (const b of sahne.bireyler) {
        const disarda = kat === 1 && (b.gy + 0.5 >= IC_DERINLIK || b.gx + 0.5 < 0 || b.gx + 0.5 > GENISLIK || b.gy + 0.5 < 0);
        if (disarda) ekleDis(b.gx + 0.3, b.gy + 0.3, 0.4, 0.4, () => karakterCiz(c, P, d, b), 0.1);
        else icerde.push(b);
    }
    disari.filter((x) => x.arka).sort(siralama).forEach((x) => x.f());
    const dl = zeminVeDuvarlar(kat, d, evre, 'duvar');
    c.drawImage(dl.tuval, dl.x0, dl.y0);
    const ciz = disari.filter((x) => !x.arka);
    for (const o of KATLAR[kat].nesneler) ciz.push({ k: derinlik(o.gx, o.gy, o.gw, o.gd) - 0.5 + (o.z ? 0.3 : 0), f: () => nesneCiz(c, P, d, o, sahne) });
    const m = ASANSOR_GOVDE;
    ciz.push({ k: derinlik(m.gx, m.gy, m.gw, m.gd) - 0.5, f: () => asansorCiz(c, P, d, kat, sahne.asansorAcik) });
    for (const ms of sahne.masalar) {
        const y = ms.yuva;
        ciz.push({ k: derinlik(y.gx, y.gy, y.gw, y.gd) - 0.35, f: () => masaCiz(c, P, d, ms, kat, ms.masaId === sahne.seciliMasaId) });
        for (const st of ms.sandalyeler) ciz.push(...sandalyeOgeleri(c, P, d, st, y, kat));
    }
    for (const b of icerde) {
        const r = dondur(d, b.gx + 0.5, b.gy + 0.5);
        ciz.push({ k: r.x + r.y + 0.1, f: () => karakterCiz(c, P, d, b) });
    }
    ciz.sort(siralama);
    for (const x of ciz) x.f();

    // Gün saati tonu: kafenin içi hariç bütün sahneye; ardından gece ışıkları (pencereler, vitrinler, lambalar, farlar)
    if (isik && isik.alfa > 0.004) {
        const k = kafeAltigeni(P, d);
        c.save();
        c.beginPath(); c.rect(b0.x0, b0.y0, BW, BH);
        c.moveTo(k[0].x, k[0].y); for (const p of k.slice(1)) c.lineTo(p.x, p.y); c.closePath();
        c.clip('evenodd');
        c.fillStyle = `rgba(${isik.r},${isik.g},${isik.b},${isik.alfa})`;
        c.fillRect(b0.x0, b0.y0, BW, BH);
        c.restore();
    }
    if (sahne.isikGucu > 0.02) {
        for (const f of sahne.emisler) f();
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const f of sahne.isiklar) f(sahne.isikGucu);
        c.restore();
    }

    // Loş katlar: karartma + lamba ışık havuzları
    const los = KATLAR[kat].isik;
    if (los) {
        c.fillStyle = `rgba(12,6,24,${los})`;
        c.fillRect(b0.x0, b0.y0, BW, BH);
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (const o of KATLAR[kat].nesneler.filter((x) => x.tur === 'lamba')) {
            const p = P.W(o.gx + 0.5, o.gy + 0.5);
            const g = c.createRadialGradient(p.x, p.y - 10, 4, p.x, p.y - 10, 110);
            g.addColorStop(0, 'rgba(255,200,110,.22)'); g.addColorStop(1, 'rgba(255,200,110,0)');
            c.fillStyle = g;
            c.fillRect(p.x - 110, p.y - 120, 220, 220);
        }
        // kendi ışığı olan nesneler (ısıtıcı lambalar, şömine ateşi, bar) ve masa lambaları (sarkıt lamba halkası, avize)
        const t = performance.now();
        for (const o of KATLAR[kat].nesneler.filter((x) => x.isik)) {
            const p = P.W(o.gx + o.gw / 2 + (o.tur === 'somine' ? 0.9 : 0), o.gy + o.gd / 2);
            const tit = o.isik.titrek ? 0.85 + 0.15 * Math.sin(t / 90) * Math.sin(t / 37) : 1;
            parilti(c, p.x, p.y - 8, o.isik.r, o.isik.r * 0.6, o.isik.rgb, o.isik.a * tit);
        }
        for (const ms of sahne.masalar) {
            const y = ms.yuva;
            if (!y.lamba) continue;
            const p = P.W(y.gx + y.gw / 2, y.gy + y.gd / 2);
            if (y.lamba === 'avize') { parilti(c, p.x, p.y - 50, 46, 26, '255,214,140', 0.3); parilti(c, p.x, p.y - 14, 80, 42, '255,196,110', 0.22); }
            else parilti(c, p.x, p.y - 16, 22 + y.gw * 10, 14 + y.gd * 5, '255,206,120', 0.34);
        }
        c.restore();
    }
}

// Derinlik sıralaması: iki öğenin de taban kutusu varsa ve bir eksende biri tamamen diğerinin gerisindeyse o önce
// çizilir (büyük binalar ile kaldırımdaki yayalar doğru sıralansın); yoksa derinlik anahtarına bakılır.
function siralama(a, b) {
    if (a.kutu && b.kutu) {
        const A = a.kutu, B = b.kutu, e = 0.01;
        const aGeride = A.rx1 <= B.rx0 + e || A.ry1 <= B.ry0 + e, bGeride = B.rx1 <= A.rx0 + e || B.ry1 <= A.ry0 + e;
        if (aGeride && !bGeride) return -1;
        if (bGeride && !aGeride) return 1;
    }
    return a.k - b.k;
}

// Kafenin ekrandaki altıgeni (zemin + arka duvar yüksekliği)
function kafeAltigeni(P, d) {
    const r = dikdortgenDondur(d, 0, 0, GENISLIK, IC_DERINLIK);
    const T = P.R(r.gx, r.gy), Rr = P.R(r.gx + r.gw, r.gy), B = P.R(r.gx + r.gw, r.gy + r.gd), L = P.R(r.gx, r.gy + r.gd);
    const H = DUVAR + 6;
    return [L, B, Rr, { x: Rr.x, y: Rr.y - H }, { x: T.x, y: T.y - H }, { x: L.x, y: L.y - H }];
}
// İki dışbükey çokgen kesişiyor mu (ayırıcı eksen testi)
function cokgenKesisir(A, B) {
    for (const C of [A, B]) for (let i = 0; i < C.length; i++) {
        const p = C[i], q = C[(i + 1) % C.length], nx = q.y - p.y, ny = p.x - q.x;
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const v of A) { const t = v.x * nx + v.y * ny; a0 = Math.min(a0, t); a1 = Math.max(a1, t); }
        for (const v of B) { const t = v.x * nx + v.y * ny; b0 = Math.min(b0, t); b1 = Math.max(b1, t); }
        if (a1 < b0 || b1 < a0) return false;
    }
    return true;
}
function icindeMi(C, n) {
    let isaret = 0;
    for (let i = 0; i < C.length; i++) {
        const p = C[i], q = C[(i + 1) % C.length];
        const x = (q.x - p.x) * (n.y - p.y) - (q.y - p.y) * (n.x - p.x);
        if (x !== 0) { if (isaret && Math.sign(x) !== isaret) return false; isaret = Math.sign(x); }
    }
    return true;
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

// Ön cephe: tuğla denizlik + cam vitrinler + tuğla ayaklar + alınlık; kapı üstünde cam vasistas, tente ve tabela.
// Parçalar karo karo üretilir ki izometrik derinlik sıralaması içerideki ve dışarıdaki karakterlerle doğru çalışsın.
function cepheNesneleri() {
    const y = IC_DERINLIK, { bas, son } = KAPI_ARALIK;
    const parca = [];
    for (let x = 0; x < GENISLIK; x++) {
        if (x < bas || x >= son) {
            parca.push({ tur: 'cephe', gx: x, gy: y, gw: 1, gd: 0.25, h: 18 });
            parca.push({ tur: 'camcephe', gx: x, gy: y + 0.08, gw: 1, gd: 0.1, h: 48, z: 18 });
        } else parca.push({ tur: 'camcephe', gx: x, gy: y + 0.08, gw: 1, gd: 0.1, h: 8, z: 58 });         // kapı vasistası
        parca.push({ tur: 'cepheust', gx: x, gy: y, gw: 1, gd: 0.3, h: 18, z: 66 });
    }
    for (const x of [0, bas - 0.25, son, 8, 12, 16, GENISLIK - 0.25]) parca.push({ tur: 'direk', gx: x, gy: y, gw: 0.25, gd: 0.32, h: 84 });
    parca.push({ tur: 'tente', gx: bas - 0.3, gy: y + 0.1, gw: son - bas + 0.6, gd: 0.7, z: 50 });
    parca.push({ tur: 'karavanatabela', gx: bas - 0.9, gy: y + 0.32, gw: son - bas + 1.8, gd: 0.12, h: 16, z: 64 });
    return parca;
}

// Kafenin yan (B, D) ve arka (K) cepheleri: o duvar kameraya göre öndeyken çizilir (arkadayken iç yüzü görünür).
// Ön cepheyle uyumlu tuğla denizlik, cam vitrin, tuğla ayaklar, alınlık; yer yer sarmaşık ve duvar lambaları.
function yanCephe(F) {
    const uz = F === 'K' ? GENISLIK : IC_DERINLIK;
    const yer = (t, w, kal, ac) => (F === 'K' ? { gx: t, gy: -ac - kal, gw: w, gd: kal } : F === 'B' ? { gx: -ac - kal, gy: t, gw: kal, gd: w } : { gx: GENISLIK + ac, gy: t, gw: kal, gd: w });
    const p = [];
    for (let t = 0; t < uz; t++) {
        p.push({ tur: 'cephe', ...yer(t, 1, 0.25, 0.05), h: 18, sarmasik: karma(t, uz, F.charCodeAt(0)) < 0.35 });
        p.push({ tur: 'camcephe', ...yer(t, 1, 0.1, 0.12), h: 48, z: 18 });
        p.push({ tur: 'cepheust', ...yer(t, 1, 0.3, 0.02), h: 18, z: 66 });
    }
    for (let t = 0; t <= uz; t += 4) p.push({ tur: 'direk', ...yer(Math.min(t, uz - 0.25), 0.25, 0.32, 0.02), h: 84 });
    for (const t of [2.4, uz / 2 + 0.4, uz - 2.4]) p.push({ tur: 'duvarlambasi', ...yer(t, 0.2, 0.15, 0.34), h: 56 });
    return p;
}

// Kameranın sığdıracağı alan (doğal koordinat): iç mekân + duvar yüksekliği; kat 1'de görünürse dış mekân da
export function gorunurAlan(kat, d) {
    const P = izdusum(d);
    const r = kat === 1 ? dikdortgenDondur(d, -2, -1, GENISLIK + 4, 24) : dikdortgenDondur(d, 0, 0, GENISLIK, IC_DERINLIK);
    const T = P.R(r.gx, r.gy), B = P.R(r.gx + r.gw, r.gy + r.gd), L = P.R(r.gx, r.gy + r.gd), R = P.R(r.gx + r.gw, r.gy);
    return { x0: L.x - 8, x1: R.x + 8, y0: T.y - DUVAR - 12, y1: B.y + 16 + PLAKA };
}

// Dünyanın ekran kutusu (kat 1'de kaydırma bu kutunun dışına taşmaz)
export function dunyaKutusu(d) {
    const P = izdusum(d);
    const r = dikdortgenDondur(d, DUNYA.x0, DUNYA.y0, DUNYA.x1 - DUNYA.x0, DUNYA.y1 - DUNYA.y0);
    const ks = [P.R(r.gx, r.gy), P.R(r.gx + r.gw, r.gy), P.R(r.gx + r.gw, r.gy + r.gd), P.R(r.gx, r.gy + r.gd)];
    return { x0: Math.min(...ks.map((p) => p.x)), x1: Math.max(...ks.map((p) => p.x)), y0: Math.min(...ks.map((p) => p.y)) - 120, y1: Math.max(...ks.map((p) => p.y)) };
}

// Ruh hali: sabır 0–100 → ikon ve renk
export function ruhHali(sabir) {
    if (sabir >= 70) return { ikon: '😊', renk: '#4caf6a' };
    if (sabir >= 40) return { ikon: '😐', renk: '#e3b23c' };
    if (sabir >= 20) return { ikon: '😠', renk: '#e07b39' };
    return { ikon: '😡', renk: '#d94f3d' };
}

const yaziOnbellek = new Map();
function yaziTuvali(t, renk, zemin, kenar, boyut, olc) {
    const anahtar = `${t}|${renk}|${zemin}|${kenar}|${boyut}|${olc}`;
    const var0 = yaziOnbellek.get(anahtar);
    if (var0) return var0;
    const g = document.createElement('canvas');
    let gc = g.getContext('2d');
    const font = `bold ${boyut}px ui-monospace, Consolas, monospace`;
    gc.font = font;
    const w = Math.ceil(gc.measureText(t).width) + 10, h = boyut + 8;
    g.width = Math.ceil((w + 4) * olc); g.height = Math.ceil((h + 4) * olc);
    gc = g.getContext('2d');
    gc.scale(olc, olc); gc.font = font;
    gc.fillStyle = kenar; gc.fillRect(0, 2, w + 4, h); gc.fillRect(2, 0, w, h + 4);
    gc.fillStyle = zemin; gc.fillRect(2, 2, w, h);
    gc.fillStyle = renk; gc.fillText(t, 7, boyut + 4);
    const v = { g, w, h };
    yaziOnbellek.set(anahtar, v);
    if (yaziOnbellek.size > 800) yaziOnbellek.delete(yaziOnbellek.keys().next().value);
    return v;
}

// Ekran katmanı: masa etiketleri, oyun ikonları, baloncuklar. donus(p): doğal → ekran koordinatı
export function ustKatmanCiz(c, olcek, donus, sahne) {
    const P = izdusum(sahne.d);
    // Etiketler önceden çizilmiş küçük tuvallerden kopyalanır (her karede metin ölçüp yazmak pahalı)
    const olc = c.getTransform().a || 1;
    const yazi = (t, x, y, { renk = '#2a1d16', zemin = '#fff8e7', kenar = '#5a3a22', boyut = 12 } = {}) => {
        const v = yaziTuvali(t, renk, zemin, kenar, boyut, olc);
        const bx = Math.round(x - v.w / 2), by = Math.round(y - v.h);
        c.drawImage(v.g, bx - 2, by - 2, v.w + 4, v.h + 4);
        return { bx, by, w: v.w, h: v.h };
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
    const W0 = c.canvas.width / olc, H0 = c.canvas.height / olc;
    const yerlesen = [];
    const cakisir = (k) => yerlesen.some((q) => k.x0 < q.x1 && k.x1 > q.x0 && k.y0 < q.y1 && k.y1 > q.y0);
    // ekran içine sıkıştırılmış etiket; çakışırsa (zorunlu değilse) çizilmez
    const etiket = (t, x, y, stil, zorunlu = false, golgeli = false) => {
        const v = yaziTuvali(t, stil.renk, stil.zemin, stil.kenar, stil.boyut, olc);
        const bx = Math.round(Math.max(6, Math.min(W0 - v.w - 6, x - v.w / 2))), by = Math.round(Math.max(6, Math.min(H0 - v.h - 6, y - v.h)));
        const k = { x0: bx - 3, y0: by - 3, x1: bx + v.w + 3, y1: by + v.h + 3 };
        if (!zorunlu && cakisir(k)) return null;
        yerlesen.push(k);
        if (golgeli) { const g = yaziTuvali(t, 'rgba(0,0,0,0)', 'rgba(0,0,0,.5)', 'rgba(0,0,0,0)', stil.boyut, olc); c.drawImage(g.g, bx, by, v.w + 4, v.h + 4); }
        c.drawImage(v.g, bx - 2, by - 2, v.w + 4, v.h + 4);
        return k;
    };
    if (sahne.kat === 1) {
        // Karavana her zaman görünür: ön cephe öndeyse tabelanın üstünde, değilse kafenin ortasında
        const p = dis ? donus(P.W((KAPI_ARALIK.bas + KAPI_ARALIK.son) / 2, IC_DERINLIK + 0.44)) : donus(P.W(GENISLIK / 2, IC_DERINLIK / 2));
        etiket('KARAVANA · Kutu Oyunu Kafe', p.x, p.y - (dis ? 76 : DUVAR + 40) * olcek, { zemin: '#2f4a3a', renk: '#ffe7a8', kenar: '#c9a14a', boyut: Math.max(10, Math.round(5 * olcek)) }, true);
    }
    if (sahne.kat === 1) {
        // bina etiketleri: öncelik (1: dondurmacı, park, büyük dükkânlar · 2: diğerleri) ve yakınlaştırmaya göre; fare üstündeki her zaman
        const yz = Math.max(9, Math.min(13, Math.round(4.6 * olcek)));
        const yk = sahne.yakinlik ?? 1;
        const adaylar = [];
        for (const b of BINALAR) {
            if (!b.ad) continue;
            const durum = sahne.binaDurum?.[b.id];
            if (!durum) continue;                                                                   // ekranda değil
            const oncelik = b.ozel === 'dondurma' || b.ozel === 'eczane' || b.ozel === 'kahvehane' || b.id === 'caybahcesi' || b.w * b.d >= 40 ? 1 : 2;
            const ustunde = sahne.fare && icindeMi(binaAltigeni(b, sahne.d, durum.kesik), sahne.fare);
            if (!ustunde && ((oncelik === 1 && yk < 0.6) || (oncelik === 2 && yk < 0.95))) continue;
            const H = durum.kesik ? 34 : 34 + (b.kat - 1) * 30;
            const q = donus(P.W(b.x + b.w / 2, b.y + b.d / 2));
            adaylar.push({ b, q, yy: q.y - (H + 26) * olcek, oncelik: ustunde ? 0 : oncelik });
        }
        adaylar.sort((a, b) => a.oncelik - b.oncelik);
        for (const { b, q, yy, oncelik } of adaylar) {
            etiket(b.ad, q.x, yy, { zemin: '#1c130d', renk: '#fff3d6', kenar: b.tente && b.tente !== '#f4efe6' ? b.tente : (b.tabela || '#c9a14a'), boyut: yz }, oncelik === 0, true);
        }
    }
    const balonlar = [];
    for (const b of sahne.bireyler) {
        if (b.gy >= IC_DERINLIK - 0.5 && !dis) continue;
        const p = donus(P.W(b.gx + 0.5, b.gy + 0.5));
        const ust = p.y - (b.oturuyor ? 40 : 45) * olcek;
        let ikonUst = ust;
        if (b.vip) {
            // VIP üye: başın hemen üstünde küçük altın yıldız
            const s = Math.max(9, Math.round(4.2 * olcek));
            c.font = `bold ${s}px "Segoe UI Symbol", sans-serif`;
            c.fillStyle = '#2a1d16'; c.fillText('★', p.x - s * 0.42 + 1, ust + s * 0.55 + 1);
            c.fillStyle = '#ffd166'; c.fillText('★', p.x - s * 0.42, ust + s * 0.55);
        }
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
        if (b.baloncuk) balonlar.push({ t: b.baloncuk, x: p.x, y: ikonUst - 4, bitis: b.balonBitis || 0, kizgin: b.ruh && b.ruh.sabir < 20 });
    }
    // Konuşma balonları: çakışan balon yukarı/yana kayar ve kuyrukla sahibine bağlı kalır; aynı anda en fazla
    // BALON_SINIR tane (süresi en önce dolacaklar). Uzak yakınlaştırmada yalnızca küçük ikon. Metin ve süre değişmez.
    const uzak = (sahne.yakinlik ?? 1) < 0.7;
    const bb = Math.max(11, Math.min(14, Math.round(5.5 * olcek)));
    balonlar.sort((a, b) => a.bitis - b.bitis);
    for (const bl of balonlar.slice(0, BALON_SINIR)) {
        const v = yaziTuvali(uzak ? (bl.kizgin ? '!' : '…') : bl.t, '#2a1d16', '#fff8e7', '#5a3a22', uzak ? 9 : bb, olc);
        let yer = null;
        for (const [ax, ay] of [[0, 0], [0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1], [0, -2], [0, -3]]) {
            const bx = Math.round(bl.x - v.w / 2 + ax * (v.w / 2 + 8)), by = Math.round(bl.y - v.h + ay * (v.h + 5));
            const k = { x0: bx - 2, y0: by - 2, x1: bx + v.w + 2, y1: by + v.h + 2 };
            if (!cakisir(k)) { yer = { bx, by, k }; break; }
        }
        if (!yer) continue;
        yerlesen.push(yer.k);
        c.drawImage(v.g, yer.bx - 2, yer.by - 2, v.w + 4, v.h + 4);
        const ax = Math.round(Math.max(yer.bx + 4, Math.min(yer.bx + v.w - 4, bl.x))), ay = yer.by + v.h;
        c.fillStyle = '#fff8e7'; c.fillRect(ax - 3, ay, 6, 3);
        if (bl.y - ay > 6 || Math.abs(ax - bl.x) > 8) {                                          // kayan balonun kuyruğu
            c.strokeStyle = '#fff8e7'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, ay + 2); c.lineTo(bl.x, bl.y); c.stroke();
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

// Parıltı: renge göre bir kez üretilen yumuşak radyal ışık görüntüsü; (x, y) merkezli rx × ry elipse ölçeklenir.
// Her karede gradyan oluşturmak yerine drawImage (gece ışık geçişini ucuzlatır).
const parlamaOnbellek = new Map();
export function parilti(c, x, y, rx, ry, rgb, alfa) {
    if (alfa <= 0.003) return;
    let t = parlamaOnbellek.get(rgb);
    if (!t) {
        t = document.createElement('canvas'); t.width = t.height = 64;
        const g = t.getContext('2d'), r = g.createRadialGradient(32, 32, 1, 32, 32, 32);
        r.addColorStop(0, `rgba(${rgb},1)`); r.addColorStop(0.45, `rgba(${rgb},.45)`); r.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = r; g.fillRect(0, 0, 64, 64);
        parlamaOnbellek.set(rgb, t);
    }
    const a = c.globalAlpha;
    c.globalAlpha = Math.min(1, alfa);
    c.drawImage(t, x - rx, y - ry, rx * 2, ry * 2);
    c.globalAlpha = a;
}

// Durağan sokak eşyaları ve cephe parçaları bir kez küçük tuvallere çizilir (her karede kutu kutu çizmek yerine)
const esyaOnbellek = new Map();
const DURAGAN = new Set(['agac', 'parkbanki', 'cop', 'cicek', 'saksi', 'menutahta', 'konteyner', 'kasalar', 'meyvekasasi', 'gazetestandi',
    'dondurmadolabi', 'dondurmatezgahi', 'semsiyelimasa', 'tabure', 'tavlamasasi', 'simitci', 'durak', 'bisikletpark',
    'cephe', 'direk', 'camcephe', 'cepheust', 'tente', 'karavanatabela', 'cit', 'cali', 'tarh', 'cardak', 'kusyemligi']);
function esyaSpriteCiz(c, P, d, o, sahne, ciz) {
    const evreli = o.tur === 'agac' || o.tur === 'camcephe' || o.tur === 'karavanatabela';
    const anahtar = `${o.tur}|${o.gx}|${o.gy}|${d}|${evreli ? sahne.evre : ''}|${o.tur === 'agac' ? sahne.mevsim || '' : ''}`;
    let e = esyaOnbellek.get(anahtar);
    if (!e) {
        const r = dikdortgenDondur(d, o.gx - 0.6, o.gy - 0.6, o.gw + 1.2, o.gd + 1.2);
        const ks = [P.R(r.gx, r.gy), P.R(r.gx + r.gw, r.gy), P.R(r.gx + r.gw, r.gy + r.gd), P.R(r.gx, r.gy + r.gd)];
        const x0 = Math.floor(Math.min(...ks.map((p) => p.x))) - 14, x1 = Math.ceil(Math.max(...ks.map((p) => p.x))) + 14;
        const y0 = Math.floor(Math.min(...ks.map((p) => p.y))) - (o.h || 20) - (o.z || 0) - 50, y1 = Math.ceil(Math.max(...ks.map((p) => p.y))) + 8;
        const t = document.createElement('canvas'); t.width = x1 - x0; t.height = y1 - y0;
        const tc = pikselBaglami(t); tc.translate(-x0, -y0);
        ciz(tc, { evre: sahne.evre, mevsim: sahne.mevsim });
        e = { t, x0, y0 };
        esyaOnbellek.set(anahtar, e);
        if (esyaOnbellek.size > 1200) esyaOnbellek.delete(esyaOnbellek.keys().next().value);
    }
    c.drawImage(e.t, e.x0, e.y0);
}

// Şehir modüllerinin (sehir/*.js) kullandığı çizim araçları
export { elmasR, golge, gorunenYuzler, hexA, karakterCiz, kopekCiz, kutu, kutuR, nesneCiz, renkler, tuglaDeseni };
