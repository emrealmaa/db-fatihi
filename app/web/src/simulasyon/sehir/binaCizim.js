// Bina çizimi: tanımdan (binalar.js) dört cephe + çatı üretir. Her bina, kamera yönü ve durumuna (kepenk, kesik)
// göre bir kez ayrı bir tuvale (sprite) çizilip önbelleğe alınır; her karede yalnızca drawImage yapılır. Gece ışıkları
// (yanık pencereler, vitrinler) ayrı bir "ışık" sprite'ındadır; gün ışığı karartmasından sonra yumuşak alfa ile eklenir.
import { dikdortgenDondur } from '../harita.js';
import { golge, gorunenYuzler, hexA, izdusum, kutu, parilti, pikselBaglami, renkler, ton, tuglaDeseni } from '../cizim.js';
import { karma } from './rastgele.js';

export const ZK = 34, KH = 30;                 // zemin kat ve üst kat yüksekliği (piksel)
const UST_PAY = 64, ALT_PAY = 8;
export const binaYuk = (b, kesik) => (kesik ? ZK : ZK + (b.kat - 1) * KH);
const YUZ_KOD = { G: 1, D: 2, K: 3, B: 4 };
const PERDE = ['#c9772a', '#b0302b', '#e3d6b0', '#5c6bc0', '#3f8f4f'];
const OYUN_RENKLERI = ['#d94f3d', '#3d7fd9', '#e3b23c', '#4caf6a', '#9b59b6'];

// Yüz geometrisi: başlangıç noktası, yüz boyunca birim yön, dışa bakan normal, uzunluk
function yuzGeo(b, F) {
    switch (F) {
        case 'G': return { ax: b.x, ay: b.y + b.d, ux: 1, uy: 0, nx: 0, ny: 1, len: b.w };
        case 'K': return { ax: b.x, ay: b.y, ux: 1, uy: 0, nx: 0, ny: -1, len: b.w };
        case 'D': return { ax: b.x + b.w, ay: b.y, ux: 0, uy: 1, nx: 1, ny: 0, len: b.d };
        default: return { ax: b.x, ay: b.y, ux: 0, uy: 1, nx: -1, ny: 0, len: b.d };
    }
}
// Yüze yapışık kutu: yüz boyunca [u0, u1], dışarı doğru [p0, p1]
function yuzKutu(g, u0, u1, p0, p1) {
    const xs = [g.ax + g.ux * u0 + g.nx * p0, g.ax + g.ux * u1 + g.nx * p1];
    const ys = [g.ay + g.uy * u0 + g.ny * p0, g.ay + g.uy * u1 + g.ny * p1];
    return [Math.min(...xs), Math.min(...ys), Math.max(0.02, Math.abs(xs[1] - xs[0])), Math.max(0.02, Math.abs(ys[1] - ys[0]))];
}

// Malzeme dokusu (yan yüz sütunu boyunca)
function malzemeDeseni(cc, x, y, hh, sol, yerel, b) {
    switch (b.malzeme) {
        case 'tugla': tuglaDeseni(cc, x, y, hh, sol, yerel); break;
        case 'tas':
            cc.fillStyle = sol ? 'rgba(0,0,0,.14)' : 'rgba(0,0,0,.18)';
            for (let r = 0; r < hh; r++) if (r % 7 === 6 || (yerel + Math.floor(r / 7) * 5) % 11 === 0) cc.fillRect(x, y + r, 1, 1);
            break;
        case 'ahsap':
            if (yerel % 4 === 0) { cc.fillStyle = 'rgba(0,0,0,.2)'; cc.fillRect(x, y, 1, hh); }
            else if (yerel % 4 === 2) { cc.fillStyle = 'rgba(255,255,255,.06)'; cc.fillRect(x, y, 1, hh); }
            break;
        case 'cam': break;
        default:
            cc.fillStyle = 'rgba(0,0,0,.05)';
            for (let r = (yerel * 7) % 9; r < hh; r += 9) cc.fillRect(x, y + r, 1, 2);
    }
}

// Cephe deseni: kutunun görünen iki yüzü sütun sütun boyanır. emis: yalnızca gece yanan ışıklar (ışık sprite'ı)
function cepheDeseni(b, d, durum, emis) {
    const yz = gorunenYuzler(d);
    const katSay = durum.kesik ? 1 : b.kat;
    const kep = durum.kepenk;
    return (cc, x, y, hh, sol, st, yerel, gen) => {
        const F = sol ? yz.sol : yz.sag;
        const tur = b.yuz[F], fk = YUZ_KOD[F];
        const zemY = y + hh - ZK;
        const R = (yy, h, renk) => { cc.fillStyle = renk; cc.fillRect(x, yy, 1, h); };
        const kenar = yerel < 3 || yerel > gen - 4;
        if (!emis) {
            malzemeDeseni(cc, x, y, hh, sol, yerel, b);
            // sarmaşık: eski binaların yan/konut yüzlerinde aşağıdan yukarı seyrelerek tırmanır
            if (b.sarmasik && (tur === 'yan' || tur === 'konut' || tur === 'servis') && karma(b.tohum, fk, 5) < 0.7) {
                for (let r = Math.floor(hh * 0.25); r < hh; r++) {
                    const p = 0.55 * (r - hh * 0.25) / (hh * 0.75);
                    if (karma(b.tohum, fk, yerel, r) < p) { cc.fillStyle = karma(yerel, r, 3) < 0.5 ? '#3f7a3a' : '#2f6b2f'; cc.fillRect(x, y + r, 1, 1); }
                }
            }
            if (yerel < 2 || yerel > gen - 3) R(y, hh, 'rgba(0,0,0,.14)');                   // köşe gölgesi
            R(y, 2, 'rgba(255,255,255,.1)');
            for (let k = 1; k < katSay; k++) { R(zemY - (k - 1) * KH - 1, 2, sol ? '#e8dcc4' : '#cbbfa6'); R(zemY - (k - 1) * KH + 1, 1, 'rgba(0,0,0,.2)'); }
        }
        // ---------------------------------------------------------------- üst katlar
        const po = durum.pencereOrani ?? 0.45;                                                         // saate göre yanık pencere oranı
        const pencere = (top, k, genis = 7, bolum = 14, ust = 8, boy = 14, oran = 0.5) => {
            const col = yerel - 4;
            if (col < 0 || yerel > gen - 5 || col % bolum >= genis) return;
            const c0 = col % bolum, wi = Math.floor(col / bolum);
            const yanik = karma(b.tohum, fk, wi, k) < oran * po / 0.45;                                  // pencere başına sabit eşik: saat ilerledikçe birer birer söner
            const perde = karma(b.tohum, fk, wi, k, 9) < 0.45;
            const camSutun = c0 > 0 && c0 < genis - 1;
            if (emis) {
                if (!yanik || !camSutun) return;
                const ton0 = karma(b.tohum, fk, wi, k, 21);                                             // çoğu sıcak sarı/turuncu, bir kısmı TV mavisi, azı loş
                const renk = ton0 < 0.16 ? '#cfe6ff' : ton0 < 0.24 ? '#b08a50' : ton0 < 0.62 ? '#ffd27a' : '#ffb866';
                R(top + ust, boy, perde && (c0 === 1 || c0 === genis - 2) ? ton(renk, 0.85) : renk);
                return;
            }
            if (!camSutun) { R(top + ust - 1, boy + 2, sol ? '#efe6d2' : '#d6ccb6'); return; }
            R(top + ust, boy, '#2f3d4f');
            if (c0 <= 2) R(top + ust, 3, '#4d6680');
            if (perde && (c0 === 1 || c0 === genis - 2)) R(top + ust, boy - 2, PERDE[(wi + k) % PERDE.length]);
            R(top + ust + boy, 2, sol ? '#e8d6b3' : '#c9b49a');                                   // denizlik
        };
        for (let k = 1; k < katSay; k++) {
            const top = zemY - k * KH;
            if (b.malzeme === 'cam') {                                                              // cam cephe: kesintisiz bant
                if (yerel % 10 === 0 || kenar) { if (!emis) R(top + 4, 22, '#2b3f52'); continue; }
                const yanik = karma(b.tohum, fk, Math.floor(yerel / 10), k) < 0.45;
                if (emis) { if (yanik) R(top + 5, 20, '#cfe8ff'); } else { R(top + 5, 20, (yerel + k * 3) % 13 < 3 ? '#7fb6cc' : '#4f7f9e'); }
                continue;
            }
            if (tur === 'servis') pencere(top, k, 5, 18, 9, 10, 0.35);
            else if (tur === 'yan') { if (gen > 24 && Math.abs(yerel - gen / 2) < 4) pencere(top, k, 7, 999, 8, 14, 0.4); else if (gen > 60 && Math.abs(yerel - gen * 0.22) < 4) pencere(top, k, 7, 999, 8, 14, 0.4); }
            else if (tur !== 'sagir') pencere(top, k);
        }
        // yangın merdiveni (servis yüzü)
        if (tur === 'servis' && !emis && katSay >= 3 && yerel >= gen - 16 && yerel <= gen - 4) {
            const u = yerel - (gen - 16);
            for (let k = 1; k < katSay; k++) {
                const taban = zemY - (k - 1) * KH;
                R(taban - 1, 1, '#2b2f36');
                if (u % 3 === 0) R(taban - 8, 8, '#3b4048'); else R(taban - 8, 1, '#3b4048');
                R(taban - Math.round(u / 12 * KH), 2, '#2b2f36');
            }
        }
        if (!emis && (tur === 'servis' || tur === 'yan') && (yerel === 3 || yerel === 4)) R(y + 2, hh - 2, yerel === 3 ? '#7d8692' : '#5b6470');   // yağmur borusu
        // ---------------------------------------------------------------- zemin kat
        const orta = gen / 2;
        if (tur === 'vitrin') {
            if (b.tip === 'kiosk') {
                if (b.ozel === 'wc') {
                    if (!emis && (Math.abs(yerel - gen * 0.3) < 3 || Math.abs(yerel - gen * 0.7) < 3)) R(zemY + 8, ZK - 9, '#3b5a7a');
                    return;
                }
                if (yerel > 2 && yerel < gen - 3) {
                    if (emis) { if (kep < 1) R(zemY + 8, 14, '#ffcf7a'); return; }
                    R(zemY + 8, 14, '#3a5163'); R(zemY + 22, 2, '#c9a14a');
                    if (kep > 0) { const h = Math.round(kep * 14); for (let r = 0; r < h; r++) R(zemY + 8 + r, 1, r % 2 ? '#6b737d' : '#8a9099'); }
                }
                return;
            }
            const kapi = Math.abs(yerel - orta) < 4;
            const kepH = Math.round(kep * (ZK - 8));
            if (emis) {
                if (kenar) return;
                const ust = zemY + 6 + kepH;
                if (ust < y + hh - 5) R(ust, y + hh - 5 - ust, kapi ? '#ffe2a0' : b.ozel === 'eczane' ? '#e8fff0' : '#ffcf7a');
                return;
            }
            R(y + hh - 4, 4, ton(b.renk, 0.5));                                                    // denizlik/kaide
            if (!kenar) {
                if (kapi) {
                    R(zemY + 4, ZK - 4, '#3b2a1e');
                    if (Math.abs(yerel - orta) < 3) R(zemY + 7, 12, '#4d6680');
                } else if (yerel % 12 === 0) R(zemY + 5, ZK - 9, '#3b2a1e');
                else {
                    R(zemY + 6, ZK - 11, b.ozel === 'eczane' ? '#cfe3d8' : b.malzeme === 'cam' ? '#4f7f9e' : '#3a5163');
                    if (yerel % 16 < 9) R(zemY + 6 + (yerel % 16), 3, '#6a8aa3');                  // yansıma
                    R(zemY + 15, 1, 'rgba(0,0,0,.3)');                                                // iç raf
                    if (b.ozel === 'eczane' && yerel % 8 === 3) R(zemY + 10, 2, '#d94f3d');
                    if (b.ozel === 'dondurma' && yerel % 6 < 2) R(zemY + 18, 3, ['#f5a3c7', '#fff6e8', '#7a4b2a'][yerel % 3]);
                }
                if (b.kapanis != null) {
                    R(zemY + 2, 3, '#5b6470');                                                        // kepenk kutusu
                    for (let r = 0; r < kepH; r++) R(zemY + 5 + r, 1, r % 2 ? '#6b737d' : '#8a9099');
                }
            }
        } else if (tur === 'konut' || (tur === 'servis' && b.tip === 'ev')) {
            if (emis) { if (Math.abs(yerel - orta) >= 4) pencere(zemY - 0, 0, 7, 14, 9, 14, 0.35); return; }
            if (Math.abs(yerel - orta) < 4) { R(zemY + 8, ZK - 9, '#6b4423'); if (Math.abs(yerel - orta) < 3) R(zemY + 11, 8, '#4d6680'); R(zemY + 6, 2, '#5a3a22'); }
            else pencere(zemY, 0, 7, 14, 9, 14, 0.35);
            R(y + hh - 3, 3, ton(b.renk, 0.55));
        } else if (tur === 'servis') {
            if (emis) return;
            const kapiU = gen * 0.28;
            if (Math.abs(yerel - kapiU) < 3) { R(zemY + 9, ZK - 9, '#6b737d'); if (Math.round(yerel - kapiU) === 2) R(zemY + 20, 2, '#e3b23c'); }
            else if (gen > 34 && Math.abs(yerel - gen * 0.62) < 6) { for (let r = zemY + 6; r < y + hh; r++) R(r, 1, (r - zemY) % 2 ? '#6b737d' : '#8a9099'); }
            R(y + hh - 3, 3, ton(b.renk, 0.5));
        } else if (tur === 'yan') {
            if (emis) return;
            if (yerel >= 6 && yerel <= 11) { R(y + hh - 21, 13, '#9aa3ad'); if (yerel === 6 || yerel === 11) R(y + hh - 21, 13, '#6b737d'); if (yerel === 8) R(y + hh - 17, 2, '#e3b23c'); }
            const afis = karma(b.tohum, fk, 77);
            const ax = Math.round(gen * 0.45);
            if (gen > 30 && afis < 0.55 && yerel >= ax && yerel < ax + 10) {
                const renk = ['#d94f3d', '#3d7fd9', '#e3b23c', '#7b2d8b'][Math.floor(afis * 8) % 4];
                R(y + hh - 28, 16, renk); R(y + hh - 26, 3, '#f4efe6'); if ((yerel - ax) % 3 === 1) R(y + hh - 20, 5, '#f4efe6');
            } else if (gen > 30 && afis >= 0.55 && afis < 0.8 && yerel >= ax && yerel < ax + 14) {
                R(y + hh - 16 + Math.round(Math.sin((yerel - ax) * 0.9) * 3), 2, ['#ff5ea8', '#5ec8ff', '#7cf29a'][Math.floor(afis * 10) % 3]);   // grafiti
            }
            R(y + hh - 3, 3, ton(b.renk, 0.5));
        } else if (tur === 'sagir') {
            if (!emis && yerel % 17 === 0) R(y + 6, hh - 12, 'rgba(0,0,0,.06)');
        }
    };
}

// Cepheye yapışık 3B ayrıntılar (yalnızca görünen yüzler): tente, tabela, balkon, klima, cumba, özel işaretler
function cepheEklentileri(c, P, d, b, durum, notlar) {
    const yz = gorunenYuzler(d);
    const K = (r, h, renk, z) => kutu(c, P, d, r[0], r[1], r[2], r[3], h, renk, z);
    for (const F of [yz.sol, yz.sag]) {
        const tur = b.yuz[F], g = yuzGeo(b, F), fk = YUZ_KOD[F];
        if (tur === 'vitrin') {
            if (b.tente) {
                K(yuzKutu(g, 0.25, g.len - 0.25, 0, 0.62), 5, renkler(b.tente, (cc, x, y, h, sol, st) => {
                    if (Math.floor(st / 4) % 2) { cc.fillStyle = sol ? '#f4efe6' : '#d9d2c5'; cc.fillRect(x, y, 1, h); }
                }), ZK - 6);
                K(yuzKutu(g, 0.25, g.len - 0.25, 0.58, 0.64), 3, renkler(ton(b.tente, 0.8)), ZK - 9);   // saçak
            }
            if (b.ad) {
                const zt = b.tip === 'kiosk' ? ZK : ZK;
                K(yuzKutu(g, 0.4, g.len - 0.4, 0, 0.1), 9, renkler(b.tabela || '#2a1d16', (cc, x, y, h, sol, st) => {
                    cc.fillStyle = '#c9a14a'; cc.fillRect(x, y, 1, 1); cc.fillRect(x, y + h - 1, 1, 1);
                    if (st % 3 && st > 4) { cc.fillStyle = '#fff3d6'; cc.fillRect(x, y + 3 + (st % 5 === 0 ? 1 : 0), 1, 3); }
                }), zt);
                notlar.tabelalar.push({ g, z: zt + 4 });
            }
            if (b.ozel === 'eczane') { K(yuzKutu(g, 0.12, 0.24, 0, 0.72), 12, renkler('#2e8b57'), ZK + 14); notlar.eczane = { ...pt(g, 0.18, 0.6), z: ZK + 20 }; }
            if (b.ozel === 'berber') {
                K(yuzKutu(g, g.len - 0.34, g.len - 0.2, 0.06, 0.2), 22, renkler('#f4efe6'), 4);
                K(yuzKutu(g, g.len - 0.36, g.len - 0.18, 0.04, 0.22), 3, renkler('#c9a14a'), 26);
                notlar.berber = { ...pt(g, g.len - 0.27, 0.13), z: 4 };
            }
            if (b.ozel === 'banka') {
                K(yuzKutu(g, g.len - 1.1, g.len - 0.55, 0, 0.14), 16, renkler('#6b737d', (cc, x, y, h, sol, st) => {
                    cc.fillStyle = '#5ec8ff'; cc.fillRect(x, y + 3, 1, 4); cc.fillStyle = '#2b2f36'; cc.fillRect(x, y + 9, 1, 3);
                }), 6);
            }
            if (b.ozel === 'dondurma') {
                // ön cephede dev külah: kat kat genişleyen gofret, üstünde üç top dondurma ve vişne
                const m = pt(g, 0.75, 0.55);
                for (let i = 0; i < 5; i++) { const s = 0.1 + i * 0.08; kutu(c, P, d, m.x - s / 2, m.y - s / 2, s, s, 5, renkler('#d9a35b', (cc, x, y, h, sol, st) => { if (st % 3 === 0) { cc.fillStyle = '#a8743f'; cc.fillRect(x, y, 1, h); } }), ZK + 4 + i * 5); }
                kutu(c, P, d, m.x - 0.32, m.y - 0.32, 0.64, 0.64, 7, renkler('#f5a3c7'), ZK + 29);
                kutu(c, P, d, m.x - 0.26, m.y - 0.26, 0.52, 0.52, 6, renkler('#fff6e8'), ZK + 36);
                kutu(c, P, d, m.x - 0.19, m.y - 0.19, 0.38, 0.38, 5, renkler('#7a4b2a'), ZK + 42);
                kutu(c, P, d, m.x - 0.06, m.y - 0.06, 0.12, 0.12, 3, renkler('#d32f2f'), ZK + 47);
            }
        }
        if (durum.kesik) continue;
        const katZ = (k) => ZK + (k - 1) * KH;
        if ((tur === 'konut' || (tur === 'vitrin' && b.tip === 'apartman')) && b.tip === 'apartman') {
            for (let k = 1; k < b.kat; k++) for (let u = 0.6, i = 0; u + 1.6 < g.len - 0.3; u += 2.8, i++) {
                const z = katZ(k);
                if (karma(b.tohum, fk, k, i) < 0.55) {
                    K(yuzKutu(g, u, u + 1.6, 0, 0.5), 2, renkler('#cfc6b4'), z);
                    K(yuzKutu(g, u, u + 1.6, 0.44, 0.5), 7, { ust: '#3b4048', sol: 'rgba(40,44,52,.6)', sag: 'rgba(30,34,40,.6)', desen: (cc, x, y, h, sol, st) => { if (st % 3 === 0) { cc.fillStyle = '#2b2f36'; cc.fillRect(x, y, 1, h); } } }, z + 2);
                    if (karma(b.tohum, fk, k, i, 3) < 0.45) for (let j = 0; j < 4; j++) K(yuzKutu(g, u + 0.2 + j * 0.33, u + 0.42 + j * 0.33, 0.26, 0.29), 4, renkler(['#f4efe6', '#d94f3d', '#3d7fd9', '#e3b23c'][(j + k) % 4]), z + 10);
                    if (karma(b.tohum, fk, k, i, 4) < 0.5) { K(yuzKutu(g, u + 0.1, u + 0.32, 0.12, 0.34), 3, renkler('#a8432f'), z + 2); K(yuzKutu(g, u + 0.12, u + 0.3, 0.14, 0.32), 3, renkler('#4caf6a'), z + 5); }
                }
                if (karma(b.tohum, fk, k, i, 5) < 0.4) K(yuzKutu(g, u + 1.75, u + 2.25, 0, 0.22), 6, renkler('#e9ecef', (cc, x, y, h, sol, st) => { if (st % 2) { cc.fillStyle = '#9aa3ad'; cc.fillRect(x, y + 1, 1, h - 2); } }), z + 13);
            }
        }
        if (tur === 'konut' && b.tip === 'ev' && b.malzeme === 'ahsap' && b.kat > 1) {
            // cumba: üst katlarda dışa taşan ahşap çıkma
            K(yuzKutu(g, g.len * 0.28, g.len * 0.72, 0, 0.45), (b.kat - 1) * KH - 6, renkler(ton(b.renk, 1.08), (cc, x, y, h, sol, st) => {
                for (let k = 0; k < b.kat - 1; k++) { if (st % 8 > 1 && st % 8 < 7) { cc.fillStyle = '#2f3d4f'; cc.fillRect(x, y + 6 + k * KH, 1, 13); } }
                if (st % 4 === 0) { cc.fillStyle = 'rgba(0,0,0,.15)'; cc.fillRect(x, y, 1, h); }
            }), ZK + 2);
            K(yuzKutu(g, g.len * 0.26, g.len * 0.74, 0, 0.5), 3, renkler('#7a2e20'), ZK + (b.kat - 1) * KH - 4);
            notlar.cumba = { g };
        }
        if (tur === 'yan' || tur === 'servis') {
            for (let k = 1; k < b.kat; k++) if (karma(b.tohum, fk, k, 11) < 0.45) {
                const u = 0.8 + karma(b.tohum, fk, k, 12) * Math.max(0.2, g.len - 2);
                K(yuzKutu(g, u, u + 0.5, 0, 0.22), 6, renkler('#e9ecef'), katZ(k) + 4);
            }
        }
    }
}
const pt = (g, u, p) => ({ x: g.ax + g.ux * u + g.nx * p, y: g.ay + g.uy * u + g.ny * p });

// Çatılar
function catiCiz(c, P, d, b, H, notlar) {
    const K = (gx, gy, gw, gd, h, renk, zz = 0) => kutu(c, P, d, gx, gy, gw, gd, h, renk, H + zz);
    const rnd = ((s) => () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; })(b.tohum + 17);
    K(b.x - 0.06, b.y - 0.06, b.w + 0.12, b.d + 0.12, 3, renkler(ton(b.renk, 0.72)));            // saçak
    if (b.cati === 'kiremit') {
        const kir = (cc, x, y, hh, sol, st) => { cc.fillStyle = sol ? '#7a2e20' : '#64251a'; cc.fillRect(x, y + hh - 1, 1, 1); if (st % 4 === 0) cc.fillRect(x, y, 1, hh); };
        const adim = 0.42, n = Math.max(1, Math.floor(Math.min(b.w, b.d) / 2 / adim));
        for (let i = 0; i < n; i++) K(b.x + i * adim, b.y + i * adim, b.w - 2 * i * adim, b.d - 2 * i * adim, 5, { ...renkler(i % 2 ? '#a8432f' : '#b24a34', kir), ust: i === n - 1 ? '#8f3826' : (i % 2 ? '#a8432f' : '#b24a34') }, 3 + i * 5);
        K(b.x + n * adim - 0.1, b.y + n * adim, b.w - 2 * n * adim + 0.2, Math.max(0.2, b.d - 2 * n * adim), 2, renkler('#5a2318'), 3 + n * 5);   // mahya
        if (b.kat > 1 && Math.min(b.w, b.d) > 3) {
            const g = yuzGeo(b, b.on), m = pt(g, g.len / 2, -0.9);
            K(m.x - 0.5, m.y - 0.3, 1, 0.6, 10, renkler('#e8d6b3', (cc, x, y, hh, sol, st) => { if (st % 8 > 1 && st % 8 < 7) { cc.fillStyle = '#2f3d4f'; cc.fillRect(x, y + 3, 1, hh - 5); } }), 6);
            K(m.x - 0.58, m.y - 0.36, 1.16, 0.72, 3, renkler('#8f3826'), 16);                     // çatı penceresi
            notlar.catiPencere = { x: m.x, y: m.y, z: H + 10 };
        }
        K(b.x + 1, b.y + 1.2, 0.55, 0.55, 22, renkler('#8a4f34', tuglaDeseni), 0);                 // baca
        notlar.dumanlar.push({ x: b.x + 1.28, y: b.y + 1.48, z: H + 22 });
        return;
    }
    // düz / teras: korkuluk, çakıl, çatı donatıları
    const t = 0.15;
    K(b.x + 0.1, b.y + 0.1, b.w - 0.2, b.d - 0.2, 0, { ust: b.cati === 'teras' ? '#a89a84' : '#5a5f66' }, 3);
    for (const [x, y, w, h] of [[b.x, b.y, b.w, t], [b.x, b.y, t, b.d], [b.x + b.w - t, b.y, t, b.d], [b.x, b.y + b.d - t, b.w, t]]) K(x, y, w, h, 6, renkler(ton(b.renk, 0.85)), 3);
    const alan = (w, h) => ({ x: b.x + 0.4 + rnd() * Math.max(0.1, b.w - 0.8 - w), y: b.y + 0.4 + rnd() * Math.max(0.1, b.d - 0.8 - h) });
    if (b.cati === 'teras') {
        for (let x = b.x + 0.3; x < b.x + b.w - 0.5; x += 0.9) { K(x, b.y + b.d - 0.5, 0.35, 0.3, 4, renkler('#a8432f'), 3); K(x + 0.04, b.y + b.d - 0.46, 0.27, 0.22, 4, renkler('#4caf6a'), 7); }
        const p = { x: b.x + b.w / 2 - 1, y: b.y + b.d / 2 - 1 };                                      // pergola
        for (const [u, v] of [[0, 0], [1.9, 0], [0, 1.9], [1.9, 1.9]]) K(p.x + u, p.y + v, 0.1, 0.1, 16, renkler('#7a4b2a'), 3);
        for (let i = 0; i < 5; i++) K(p.x, p.y + i * 0.48, 2, 0.08, 2, renkler('#8b5a2b'), 19);
        K(p.x + 0.7, p.y + 0.7, 0.6, 0.6, 7, renkler('#e8d6b3'), 3);
        return;
    }
    if (b.w * b.d > 14) {
        // ayaklı su deposu
        const s = alan(1.4, 1.4);
        for (const [u, v] of [[0, 0], [1.1, 0], [0, 1.1], [1.1, 1.1]]) K(s.x + u, s.y + v, 0.1, 0.1, 10, renkler('#3b4048'), 3);
        K(s.x - 0.05, s.y - 0.05, 1.3, 1.3, 14, renkler('#6b737d', (cc, x, y, h, sol, st) => { if (st % 6 === 0) { cc.fillStyle = 'rgba(0,0,0,.2)'; cc.fillRect(x, y, 1, h); } }), 13);
        K(s.x + 0.15, s.y + 0.15, 0.9, 0.9, 3, renkler('#5b6470'), 27);
    }
    // güneş paneli + termosifon
    if (rnd() < 0.75) {
        const s = alan(1.4, 1);
        K(s.x, s.y + 0.35, 1.3, 0.65, 3, { ust: '#2b4a7a', sol: '#1f3a60', sag: '#183050', desen: (cc, x, y, h, sol, st) => { if (st % 5 === 0) { cc.fillStyle = '#8fb0d0'; cc.fillRect(x, y, 1, h); } } }, 4);
        K(s.x, s.y, 1.3, 0.3, 5, renkler('#e9ecef'), 7);
    }
    // çanak antenler
    for (let i = 0, n = 1 + Math.floor(rnd() * 3); i < n; i++) {
        const s = alan(0.4, 0.4);
        K(s.x + 0.15, s.y + 0.15, 0.08, 0.08, 6, renkler('#9aa3ad'), 3);
        K(s.x, s.y, 0.4, 0.4, 2, renkler('#e9ecef'), 8);
        K(s.x + 0.12, s.y + 0.12, 0.16, 0.16, 1, renkler('#c4ccd4'), 10);
    }
    if (b.baca || rnd() < 0.5) { const s = alan(0.5, 0.5); K(s.x, s.y, 0.5, 0.5, 18, renkler('#8a4f34', tuglaDeseni), 3); notlar.dumanlar.push({ x: s.x + 0.25, y: s.y + 0.25, z: H + 21, cok: b.baca }); }
    const s = alan(0.3, 0.3); K(s.x, s.y, 0.22, 0.22, 9, renkler('#8f98a3'), 3);                    // havalandırma
}

// ---------------------------------------------------------------- sprite önbelleği
const onbellek = new Map();
const ONBELLEK_SINIR = 140;
function sakla(anahtar, deger) {
    onbellek.set(anahtar, deger);
    if (onbellek.size > ONBELLEK_SINIR) onbellek.delete(onbellek.keys().next().value);
    return deger;
}

// Ekran altıgeni: kutunun izdüşümü (L, B, R alt; R, T, L üst) — örtme testi ve fare için
export function binaAltigeni(b, d, kesik = false) {
    const P = izdusum(d);
    const r = dikdortgenDondur(d, b.x, b.y, b.w, b.d);
    const H = binaYuk(b, kesik) + (kesik ? 0 : b.cati === 'kiremit' ? 30 : 12);
    const T = P.R(r.gx, r.gy), Rr = P.R(r.gx + r.gw, r.gy), Bb = P.R(r.gx + r.gw, r.gy + r.gd), L = P.R(r.gx, r.gy + r.gd);
    return [L, Bb, Rr, { x: Rr.x, y: Rr.y - H }, { x: T.x, y: T.y - H }, { x: L.x, y: L.y - H }];
}

export function binaSprite(b, d, durum, emis = false) {
    const kep = 0;                                          // kepenk sprite'a girmez, her karede ayrı çizilir
    const anahtar = `${b.id}|${d}|${kep}|${durum.kesik ? 1 : 0}|${emis ? 'e' + (durum.pencereOrani ?? 0.45) : 0}`;
    const var0 = onbellek.get(anahtar);
    if (var0) { onbellek.delete(anahtar); onbellek.set(anahtar, var0); return var0; }
    const P = izdusum(d);
    const H = binaYuk(b, durum.kesik);
    const r = dikdortgenDondur(d, b.x - 0.7, b.y - 0.7, b.w + 1.4, b.d + 1.4);
    const koseler = [P.R(r.gx, r.gy), P.R(r.gx + r.gw, r.gy), P.R(r.gx + r.gw, r.gy + r.gd), P.R(r.gx, r.gy + r.gd)];
    const x0 = Math.floor(Math.min(...koseler.map((p) => p.x))) - 4, x1 = Math.ceil(Math.max(...koseler.map((p) => p.x))) + 4;
    const y0 = Math.floor(Math.min(...koseler.map((p) => p.y))) - H - UST_PAY, y1 = Math.ceil(Math.max(...koseler.map((p) => p.y))) + ALT_PAY;
    const tuval = document.createElement('canvas');
    tuval.width = x1 - x0; tuval.height = y1 - y0;
    const c = pikselBaglami(tuval);
    c.translate(-x0, -y0);
    const notlar = { dumanlar: [], tabelalar: [] };
    const d2 = { ...durum, kepenk: kep };
    if (emis) {
        const bos = 'rgba(0,0,0,0)';
        kutu(c, P, d, b.x, b.y, b.w, b.d, H, { ust: bos, sol: bos, sag: bos, desen: cepheDeseni(b, d, d2, true) });
    } else {
        golge(c, P, d, b.x, b.y, b.w, b.d, 1.8);
        const kesitUst = durum.kesik ? ton(b.renk, 0.62) : ton(b.renk, 0.72);
        kutu(c, P, d, b.x, b.y, b.w, b.d, H, { ...renkler(b.renk, cepheDeseni(b, d, d2, false)), ust: kesitUst });
        if (durum.kesik) {
            // kesit: duvar kalınlığı içinde ahşap döşeme, iç duvar gölgesi ve birkaç raf/tezgâh (Sims tarzı)
            kutu(c, P, d, b.x + 0.2, b.y + 0.2, b.w - 0.4, b.d - 0.4, 0, { ust: '#8a6a4a' }, H);
            kutu(c, P, d, b.x + 0.2, b.y + 0.2, b.w - 0.4, 0.18, 0, { ust: 'rgba(0,0,0,.28)' }, H);
            kutu(c, P, d, b.x + 0.2, b.y + 0.2, 0.18, b.d - 0.4, 0, { ust: 'rgba(0,0,0,.2)' }, H);
            if (b.w > 2 && b.d > 2) {
                kutu(c, P, d, b.x + 0.5, b.y + 0.4, b.w - 1, 0.4, 6, renkler('#6b4423', (cc, x, y, h, sol, st) => { if (st % 3 === 0) { cc.fillStyle = OYUN_RENKLERI[(st + b.tohum) % 5]; cc.fillRect(x, y + 1, 1, 3); } }), H);
                kutu(c, P, d, b.x + b.w / 2 - 0.8, b.y + b.d / 2 - 0.3, 1.6, 0.6, 4, renkler('#a8743f'), H);
            }
        }
        cepheEklentileri(c, P, d, b, d2, notlar);
        if (!durum.kesik) catiCiz(c, P, d, b, H, notlar);
    }
    return sakla(anahtar, { tuval, x0, y0, notlar, H });
}

// Kepenk: kapanış saatinde vitrinin önüne yukarıdan inen oluklu metal (her karede, görünen vitrin yüzlerine)
function kepenkCiz(c, P, d, b, durum) {
    if (!(durum.kepenk > 0) || b.tip === 'kiosk' || b.kapanis == null) return;
    const yz = gorunenYuzler(d);
    const h = Math.max(1, Math.round(durum.kepenk * (ZK - 9)));
    for (const F of [yz.sol, yz.sag]) {
        if (b.yuz[F] !== 'vitrin') continue;
        const g = yuzGeo(b, F);
        const [x, y, w, dd] = yuzKutu(g, 0.12, g.len - 0.12, 0, 0.05);
        kutu(c, P, d, x, y, w, dd, h, { ust: '#5b6470', sol: '#8a9099', sag: '#7d848c', desen: (cc, xx, yy, hh) => { cc.fillStyle = 'rgba(0,0,0,.22)'; for (let r = 1; r < hh; r += 2) cc.fillRect(xx, yy + r, 1, 1); } }, ZK - 4 - h);
    }
}

// Her karede: sprite + animasyonlu ayrıntılar (berber direği, baca dumanı); gece ışıkları ışık kuyruğuna
export function binaCiz(c, P, d, b, durum, sahne) {
    const s = binaSprite(b, d, durum);
    c.drawImage(s.tuval, s.x0, s.y0);
    kepenkCiz(c, P, d, b, durum);
    const t = performance.now();
    const n = s.notlar;
    if (n.berber) {
        // dönen kırmızı-beyaz-mavi berber direği
        const q = P.W(n.berber.x, n.berber.y);
        for (let i = 0; i < 20; i++) {
            const faz = (i + t / 120) % 6;
            c.fillStyle = faz < 2 ? '#d32f2f' : faz < 3 ? '#f4efe6' : faz < 5 ? '#2b6cb0' : '#f4efe6';
            c.fillRect(Math.round(q.x) - 1, Math.round(q.y) - n.berber.z - 3 - i, 3, 1);
        }
    }
    for (const u of n.dumanlar) {
        if (!u.cok && (b.tohum % 3)) continue;                              // bacaların bir kısmı tüter
        const q = P.W(u.x, u.y);
        for (let i = 0; i < 4; i++) {
            const f = (t / 1100 + i / 4 + (b.tohum % 7) / 7) % 1;
            c.fillStyle = `rgba(205,205,212,${(u.cok ? 0.5 : 0.32) * (1 - f)})`;
            c.fillRect(q.x - 2 + Math.sin(f * 6 + i) * 3, q.y - u.z - 4 - f * 26, 4 + f * 4, 3 + f * 3);
        }
    }
    const guc = sahne.isikGucu || 0;
    if (guc > 0.02 && b.tip !== undefined) {
        sahne.emisler.push(() => { const e = binaSprite(b, d, durum, true); c.globalAlpha = guc; c.drawImage(e.tuval, e.x0, e.y0); c.globalAlpha = 1; kepenkCiz(c, P, d, b, durum); });
        if (n.eczane) {
            const q = P.W(n.eczane.x, n.eczane.y);
            sahne.isiklar.push((g) => parilti(c, q.x, q.y - n.eczane.z, 22, 22, '255,80,80', 0.7 * g));
        }
        for (const tb of n.tabelalar) {
            const q = P.W(tb.g.ax + tb.g.ux * tb.g.len / 2 + tb.g.nx * 0.3, tb.g.ay + tb.g.uy * tb.g.len / 2 + tb.g.ny * 0.3);
            const kapali = durum.kepenk >= 1;
            if (kapali && b.ozel !== 'eczane') continue;
            sahne.isiklar.push((g) => {
                parilti(c, q.x, q.y - tb.z, 34, 30, '255,214,140', 0.3 * g);
                parilti(c, q.x, q.y + 4, 46, 22, '255,190,110', 0.24 * g);                               // vitrin ışığı kaldırıma düşer
            });
        }
    }
    if (n.eczane) {                                                                                 // kırmızı "E" (her zaman)
        const q = P.W(n.eczane.x, n.eczane.y), x = Math.round(q.x), y = Math.round(q.y) - n.eczane.z;
        c.fillStyle = (Math.floor(t / 700) % 2 || guc < 0.1) ? '#e53935' : '#ff8a80';
        c.fillRect(x - 2, y - 4, 1, 8); c.fillRect(x - 2, y - 4, 4, 1); c.fillRect(x - 2, y, 3, 1); c.fillRect(x - 2, y + 3, 4, 1);
    }
}
export { hexA };
