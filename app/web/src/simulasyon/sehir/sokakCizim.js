// Sokak çizimi: zemin (yollar, kaldırımlar, refüj, park), sokak eşyaları, araçlar, kediler ve güvercinler.
import { dikdortgenDondur, dondur } from '../harita.js';
import { elmasR, golge, kutu, parilti, renkler, ton } from '../cizim.js';
import { karma } from './rastgele.js';
import { GECITLER, HAVUZ, KAVSAKLAR, SINIR, YOLLAR, ZEBRA, zeminTuru } from './yerlesim.js';

// ---------------------------------------------------------------- zemin (önbellekli katmana bir kez çizilir)
const RENK = {
    cadde: ['#4a4a50', '#45454b'], arka: ['#3f3f44', '#3a3a3f'], kavsak: ['#48484e', '#46464c'],
    kaldirim: ['#c4bfb5', '#b9b4aa'], cephe: ['#9c8f7e', '#a89a88'], avlu: ['#9a9184', '#8f877b'],
    cim: ['#5f8f4a', '#57864a'], patika: ['#c9b48a', '#c2ad83'], meydan: ['#b8ab94', '#ad9f88'], kum: ['#e0c890', '#d8bf86'],
    refuj: ['#4f7a3f', '#4a743a'], bahce: ['#6a9a50', '#629248'], bahceKenar: ['#5a8a44', '#54843f'], bahceyolu: ['#d9c9a3', '#d2c19a'],
};


export function sehirZemini(c, P, d) {
    const BORDUR = renkler('#8f8a80');
    const K = (gx, gy, gw, gd, h, renk, z) => kutu(c, P, d, gx, gy, gw, gd, h, renk, z);
    for (let x = SINIR.x0; x < SINIR.x1; x++) for (let y = SINIR.y0; y < SINIR.y1; y++) {
        const z = zeminTuru(x, y);
        if (z.tur === 'kafe') continue;
        const tek = (x + y) & 1;
        const r = dikdortgenDondur(d, x, y, 1, 1);
        if (z.tur === 'yol' && z.yol.tur === 'ara') {
            // parke taşı: dört küçük taş, aralarında derz
            elmasR(c, P, r.gx, r.gy, '#5f594f');
            for (const [u, v] of [[0.04, 0.04], [0.52, 0.04], [0.04, 0.52], [0.52, 0.52]]) {
                K(x + u, y + v, 0.44, 0.44, 0, { ust: ['#857d70', '#7a7266', '#8f877a'][Math.floor(karma(x, y, u, v) * 3)] });
            }
            continue;
        }
        const tur = z.tur === 'yol' ? (z.yol.tur === 'arka' ? 'arka' : 'cadde') : z.tur === 'bahce' && z.kenar ? 'bahceKenar' : z.tur;
        elmasR(c, P, r.gx, r.gy, RENK[tur][tek]);
        if (tur === 'bahceyolu') for (const [u, v] of [[0.1, 0.12], [0.55, 0.5], [0.2, 0.7]]) K(x + u, y + v, 0.14, 0.1, 0, { ust: '#bfae88' });     // stabilize taneleri
        // bahçe yolunun kenarında ince bordür taşı (çimenle komşu kenarlar)
        if (tur === 'bahceyolu') {
            for (const [dx, dy, bx, by, bw, bd] of [[-1, 0, 0, 0, 0.06, 1], [1, 0, 0.94, 0, 0.06, 1], [0, -1, 0, 0, 1, 0.06], [0, 1, 0, 0.94, 1, 0.06]]) {
                if (zeminTuru(x + dx, y + dy).tur === 'bahce') K(x + bx, y + by, bw, bd, 1, renkler('#b8b0a2'));
            }
        }
        if (tur === 'kaldirim' && (x + y * 3) % 5 === 0) K(x + 0.1, y + 0.1, 0.8, 0.8, 0, { ust: ton(RENK.kaldirim[tek], 0.96) });
        if ((tur === 'cim' || tur === 'bahce') && karma(x, y, 3) < 0.35) K(x + 0.3, y + 0.3, 0.2, 0.2, 0, { ust: '#4a7a3a' });
        // çim şeridi: arka sokağın ve doğu caddesinin kaldırım kenarında
        if (tur === 'kaldirim') {
            if (y === -4 && zeminTuru(x, -3).tur === 'yol') K(x, y + 0.72, 1, 0.24, 0, { ust: '#5f8f4a' });
            if (x === 27 && zeminTuru(28, y).tur === 'yol') K(x + 0.74, y, 0.22, 1, 0, { ust: '#5f8f4a' });
            if (x === 30 && zeminTuru(29, y).tur === 'yol') K(x + 0.04, y, 0.22, 1, 0, { ust: '#5f8f4a' });
        }
        if (tur === 'arka' && karma(x, y, 5) < 0.12) K(x + 0.2, y + 0.45, 0.6, 0.04, 0, { ust: '#2e2e33' });     // çatlak
        // rögar kapakları
        if ((tur === 'cadde' || tur === 'kaldirim') && karma(x, y, 8) < 0.025) {
            K(x + 0.3, y + 0.3, 0.4, 0.4, 0, { ust: '#2b2b30' });
            K(x + 0.36, y + 0.36, 0.28, 0.28, 0, { ust: '#3b3b42' });
        }
        if (tur === 'refuj') {
            K(x, y + 0.02, 1, 0.96, 3, { ust: RENK.refuj[tek], sol: '#a39d92', sag: '#8f8a80' });
            if (karma(x, y, 6) < 0.5) K(x + 0.35, y + 0.35, 0.3, 0.3, 2, renkler('#e07b39'), 3);    // çiçek
        }
    }
    // bordürler: yol kenarında, kaldırım/avlu tarafında (kavşak köşeleri yuvarlatılır)
    const kose = (x, y) => KAVSAKLAR.some((k) => (x === k.x0 - 1 || x === k.x1) && (y === k.y0 - 1 || y === k.y1));
    for (const yl of YOLLAR) {
        if (yl.eksen === 'x') {
            for (let x = SINIR.x0; x < SINIR.x1; x++) {
                if (zeminTuru(x, yl.a0 - 1).tur.match(/yol|kavsak/) || kose(x, yl.a0 - 1)) continue;
                K(x, yl.a0 - 0.1, 1, 0.1, 2, BORDUR);
                if (!kose(x, yl.a1)) K(x, yl.a1, 1, 0.1, 2, BORDUR);
            }
        } else {
            for (let y = SINIR.y0; y < SINIR.y1; y++) {
                if (zeminTuru(yl.a0 - 1, y).tur.match(/yol|kavsak/) || kose(yl.a0 - 1, y)) continue;
                K(yl.a0 - 0.1, y, 0.1, 1, 2, BORDUR);
                if (!kose(yl.a1, y)) K(yl.a1, y, 0.1, 1, 2, BORDUR);
            }
        }
    }
    // kavşak köşeleri: köşe karosu yol rengine boyanır, üstüne çeyrek daire kaldırım + kavisli bordür
    const ceyrek = (cx, cy, sx, sy, r, renk) => {
        for (let u = 0; u < r; u += 0.1) {
            const yari = Math.sqrt(Math.max(0, r * r - (u + 0.05) ** 2));
            K(sx > 0 ? cx + u : cx - u - 0.1, sy > 0 ? cy : cy - yari, 0.1, yari, 0, { ust: renk });
        }
    };
    for (const k of KAVSAKLAR) {
        const yolRenk = RENK[YOLLAR.find((q) => q.eksen === 'x' && q.a0 === k.y0).tur === 'arka' ? 'arka' : 'cadde'][0];
        for (const [tx, ty, sx, sy] of [[k.x0 - 1, k.y0 - 1, 1, 1], [k.x1, k.y0 - 1, -1, 1], [k.x0 - 1, k.y1, 1, -1], [k.x1, k.y1, -1, -1]]) {
            const kx = sx > 0 ? tx : tx + 1, ky = sy > 0 ? ty : ty + 1;       // köşe karosunun blok içi köşesi
            K(tx, ty, 1, 1, 0, { ust: yolRenk });
            ceyrek(kx, ky, sx, sy, 1, RENK.kaldirim[0]);
            for (let a = 0; a <= 1.0001; a += 1 / 10) K(kx + sx * Math.cos(a * Math.PI / 2) - 0.06, ky + sy * Math.sin(a * Math.PI / 2) - 0.06, 0.12, 0.12, 2, BORDUR);
        }
    }
    // yaya geçitleri (zebra): şeritler yürüme yönünde uzun
    for (const g of GECITLER) {
        if (g.yol === 'x') for (let x = g.x0 + 0.1; x < g.x1 - 0.12; x += 0.34) K(x, g.y0 + 0.08, 0.18, g.y1 - g.y0 - 0.16, 0, { ust: '#e9e6df' });
        else for (let y = g.y0 + 0.1; y < g.y1 - 0.12; y += 0.34) K(g.x0 + 0.08, y, g.x1 - g.x0 - 0.16, 0.18, 0, { ust: '#e9e6df' });
    }
    // dur çizgileri (ışıklı kavşaklar) ve şerit çizgileri
    for (const k of KAVSAKLAR.filter((q) => q.isikli)) {
        for (const yl of YOLLAR) for (const s of yl.seritler) {
            if (yl.eksen === 'x' && yl.a0 === k.y0) K(s.yon > 0 ? k.x0 - ZEBRA - 0.3 : k.x1 + ZEBRA + 0.18, s.c - 0.45, 0.12, 0.9, 0, { ust: '#f4efe6' });
            if (yl.eksen === 'y' && yl.a0 === k.x0) K(s.c - 0.45, s.yon > 0 ? k.y0 - ZEBRA - 0.3 : k.y1 + ZEBRA + 0.18, 0.9, 0.12, 0, { ust: '#f4efe6' });
        }
    }
    const serbest = (x, y) => !KAVSAKLAR.some((k) => x > k.x0 - ZEBRA - 0.5 && x < k.x1 + ZEBRA + 0.5 && y > k.y0 - ZEBRA - 0.5 && y < k.y1 + ZEBRA + 0.5);
    for (let y = SINIR.y0 + 1; y < SINIR.y1 - 1; y += 2) if (serbest(29, y)) K(28.95, y + 0.2, 0.1, 0.8, 0, { ust: '#e3d26b' });   // kenardan 1 karo önce biter        // doğu caddesi orta çizgi
    for (let y = SINIR.y0 + 1; y < SINIR.y1 - 1; y += 2) if (serbest(-9.5, y)) K(-10 + 0.05, y, 0.9, 0.06, 0, { ust: '#d9d4c8' });     // park cepleri
    // park havuzu: taş kenar, su
    const daire = (r, renk) => { for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) ceyrek(HAVUZ.cx, HAVUZ.cy, sx, sy, r, renk); };
    daire(HAVUZ.r + 0.25, '#9a948a'); daire(HAVUZ.r, '#3f7fb0'); daire(HAVUZ.r * 0.55, '#4f93c4');
}

// ---------------------------------------------------------------- sokak eşyaları (nesneCiz'in tanımadığı türler)
export function esyaCiz(c, P, d, o, sahne) {
    const K = (gx, gy, gw, gd, h, renk, z = 0) => kutu(c, P, d, gx, gy, gw, gd, h, renk, z);
    const t = performance.now();
    switch (o.tur) {
        case 'trafiklambasi': {
            const q = P.W(o.gx + 0.15, o.gy + 0.15);
            c.fillStyle = '#2b2f36'; c.fillRect(q.x - 1, q.y - o.h, 2, o.h); c.fillRect(q.x - 3, q.y - 2, 6, 2);
            c.fillStyle = '#1c1f24'; c.fillRect(q.x - 3, q.y - o.h - 13, 6, 14);
            const durum = sahne.sehir?.isiklar?.[o.kavsak]?.[o.eksen] || 'kirmizi';
            const renk = { kirmizi: ['#ff3b30', 0], sari: ['#ffcc00', 1], yesil: ['#34c759', 2] }[durum];
            for (let i = 0; i < 3; i++) { c.fillStyle = i === renk[1] ? renk[0] : '#3b3f46'; c.fillRect(q.x - 1, q.y - o.h - 11 + i * 4, 2, 3); }
            if (sahne.isiklar) {
                const yy = q.y - o.h - 10 + renk[1] * 4, rgb = { kirmizi: '255,59,48', sari: '255,204,0', yesil: '52,199,89' }[durum];
                sahne.isiklar.push((g) => parilti(c, q.x, yy, 8, 8, rgb, 0.6 * Math.max(0.3, g)));
            }
            break;
        }
        case 'konteyner':
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd);
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler(o.renk, (cc, x, y, h, sol, st) => { if (st % 5 === 0) { cc.fillStyle = 'rgba(0,0,0,.2)'; cc.fillRect(x, y + 2, 1, h - 3); } }));
            K(o.gx - 0.03, o.gy - 0.03, o.gw + 0.06, o.gd + 0.06, 2, renkler(ton(o.renk, 0.8)), o.h);
            break;
        case 'kasalar':
            for (let i = 0; i < 3; i++) K(o.gx + (i % 2) * 0.05, o.gy, o.gw, o.gd, 4, renkler(i % 2 ? '#a8743f' : '#9b6a3a'), i * 4);
            break;
        case 'meyvekasasi':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#a8743f', (cc, x, y, h, sol, st) => { if (st % 3 === 0) { cc.fillStyle = '#7a4b2a'; cc.fillRect(x, y, 1, h); } }));
            for (let i = 0; i < 5; i++) K(o.gx + 0.08 + (i % 3) * 0.2, o.gy + 0.08 + Math.floor(i / 3) * 0.16, 0.14, 0.14, 2, renkler(o.renk), o.h);
            break;
        case 'gazetestandi':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#3b4048', (cc, x, y, h, sol, st) => { for (let r = 2; r < h - 2; r += 4) { cc.fillStyle = ['#f4efe6', '#e9e2c0', '#d94f3d'][(st + r) % 3]; cc.fillRect(x, y + r, 1, 2); } }));
            break;
        case 'dondurmadolabi':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#f4efe6', (cc, x, y, h, sol, st) => { if (st % 6 === 0) { cc.fillStyle = '#d94f3d'; cc.fillRect(x, y + 2, 1, h - 4); } }));
            K(o.gx + 0.05, o.gy + 0.05, o.gw - 0.1, o.gd - 0.1, 1, { ust: 'rgba(180,220,240,.8)', sol: '#9fc7dc', sag: '#8fb0c4' }, o.h);
            break;
        case 'dondurmatezgahi':
            // Maraş dondurması tezgâhı: metal kazan kapakları, uzun kepçe asılı
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd);
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#c4ccd4', (cc, x, y, h, sol, st) => { if (st % 7 === 0) { cc.fillStyle = '#e05a8a'; cc.fillRect(x, y + 3, 1, h - 5); } }));
            for (let i = 0; i < 3; i++) K(o.gx + 0.15 + i * 0.55, o.gy + 0.1, 0.4, 0.3, 2, renkler('#9aa3ad'), o.h);
            break;
        case 'semsiyelimasa': {
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd, 0.8);
            K(o.gx + 0.36, o.gy + 0.36, 0.08, 0.08, 9, renkler('#5b6470'));
            K(o.gx + 0.1, o.gy + 0.1, 0.6, 0.6, 2, renkler('#f4efe6'), 9);
            K(o.gx + 0.38, o.gy + 0.38, 0.04, 0.04, 16, renkler('#5b6470'), 11);
            K(o.gx - 0.15, o.gy - 0.15, 1.1, 1.1, 3, renkler(o.renk, (cc, x, y, h, sol, st) => { if (Math.floor(st / 4) % 2) { cc.fillStyle = '#f4efe6'; cc.fillRect(x, y, 1, h); } }), 26);
            K(o.gx + 0.1, o.gy + 0.1, 0.6, 0.6, 2, renkler(ton(o.renk, 1.1)), 29);
            break;
        }
        case 'tabure':
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#7a4b2a'));
            break;
        case 'tavlamasasi':
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd, 0.8);
            K(o.gx + 0.3, o.gy + 0.3, 0.1, 0.1, 8, renkler('#3b2a1e'));
            K(o.gx, o.gy, o.gw, o.gd, 2, renkler('#8b5a2b'), 8);
            K(o.gx + 0.12, o.gy + 0.15, o.gw - 0.24, o.gd - 0.3, 1, renkler('#c9a46b', (cc, x, y, h, sol, st) => { if (st % 2) { cc.fillStyle = '#7a2e20'; cc.fillRect(x, y, 1, h); } }), 10);
            K(o.gx + 0.2, o.gy + 0.25, 0.06, 0.06, 1, renkler('#f4efe6'), 11); K(o.gx + 0.45, o.gy + 0.4, 0.06, 0.06, 1, renkler('#1c1c1c'), 11);
            K(o.gx + 0.55, o.gy + 0.05, 0.08, 0.08, 4, { ust: '#c0392b', sol: '#e8a87c', sag: '#c98b5f' }, 10);   // ince belli çay bardağı
            break;
        case 'simitci': {
            // simit arabası: camlı kasa, tekerler, içinde simitler
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd);
            for (const u of [0.1, o.gw - 0.25]) K(o.gx + u, o.gy + o.gd - 0.06, 0.15, 0.06, 4, renkler('#1c1c1c'));
            K(o.gx, o.gy, o.gw, o.gd, 6, renkler('#c0392b'), 3);
            K(o.gx + 0.04, o.gy + 0.04, o.gw - 0.08, o.gd - 0.08, 8, { ust: 'rgba(200,235,245,.5)', sol: 'rgba(170,215,230,.55)', sag: 'rgba(150,195,215,.55)' }, 9);
            for (let i = 0; i < 4; i++) K(o.gx + 0.12 + i * 0.2, o.gy + 0.15, 0.16, 0.16, 2, renkler('#b5793f'), 10 + (i % 2) * 2);
            break;
        }
        case 'misirci': {
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd);
            for (const u of [0.1, o.gw - 0.25]) K(o.gx + u, o.gy + o.gd - 0.06, 0.15, 0.06, 4, renkler('#1c1c1c'));
            K(o.gx, o.gy, o.gw, o.gd, 8, renkler('#2b6cb0'), 3);
            K(o.gx + 0.1, o.gy + 0.1, 0.35, 0.3, 3, renkler('#3b3b42'), 11);
            K(o.gx + 0.5, o.gy + 0.1, 0.3, 0.3, 4, renkler('#e3b23c'), 11);
            const q = P.W(o.gx + 0.28, o.gy + 0.25);
            for (let i = 0; i < 3; i++) { const f = (t / 1000 + i / 3) % 1; c.fillStyle = `rgba(220,220,225,${0.45 * (1 - f)})`; c.fillRect(q.x - 2 + Math.sin(f * 5 + i) * 2, q.y - 16 - f * 18, 3 + f * 3, 3); }
            break;
        }
        case 'durak': {
            // otobüs durağı: camlı sığınak, reklam panosu, bank
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd, 1.2);
            for (const u of [0, o.gw - 0.08]) K(o.gx + u, o.gy + o.gd - 0.08, 0.08, 0.08, 26, renkler('#5b6470'));
            K(o.gx, o.gy, o.gw, 0.06, 24, { ust: '#9fc7dc', sol: 'rgba(170,215,230,.45)', sag: 'rgba(150,195,215,.45)' });
            K(o.gx + o.gw - 0.9, o.gy + 0.04, 0.8, 0.06, 22, renkler('#f4efe6', (cc, x, y, h, sol, st) => { cc.fillStyle = ['#d94f3d', '#3d7fd9', '#e3b23c'][Math.floor(st / 6) % 3]; cc.fillRect(x, y + 3, 1, h - 6); }), 2);
            K(o.gx + 0.2, o.gy + 0.12, o.gw - 1.2, 0.3, 2, renkler('#7a4b2a'), 7);
            K(o.gx - 0.1, o.gy - 0.05, o.gw + 0.2, o.gd + 0.15, 2, renkler('#3b4048'), 26);
            const q = P.W(o.gx + 0.2, o.gy + o.gd);                                       // durak tabelası
            c.fillStyle = '#2b2f36'; c.fillRect(q.x, q.y - 34, 1, 34); c.fillStyle = '#2bb0a8'; c.fillRect(q.x - 3, q.y - 40, 7, 7);
            c.fillStyle = '#f4efe6'; c.fillRect(q.x - 1, q.y - 38, 3, 1); c.fillRect(q.x - 1, q.y - 36, 3, 1);
            break;
        }
        case 'cesme': {
            const q = P.W(o.gx + o.gw / 2, o.gy + o.gd / 2);
            K(o.gx + o.gw / 2 - 0.3, o.gy + o.gd / 2 - 0.3, 0.6, 0.6, 8, renkler('#b8ab94'));
            K(o.gx + o.gw / 2 - 0.12, o.gy + o.gd / 2 - 0.12, 0.24, 0.24, 8, renkler('#9a948a'), 8);
            for (let i = 0; i < 8; i++) {                                                // fıskiye
                const f = (t / 700 + i / 8) % 1, a = i * Math.PI / 4;
                c.fillStyle = `rgba(200,230,255,${0.8 - f * 0.6})`;
                c.fillRect(q.x + Math.cos(a) * f * 12, q.y - 18 - Math.sin(f * Math.PI) * 8 + f * 8 + Math.sin(a) * f * 5, 2, 2);
            }
            break;
        }
        case 'oyunalani': {
            // kaydırak, salıncak, kum havuzu kenarı
            const x = o.gx, y = o.gy;
            K(x + 0.3, y + 0.4, 0.6, 0.6, 18, renkler('#e3b23c'));
            for (let i = 0; i < 5; i++) K(x + 0.9 + i * 0.3, y + 0.5, 0.3, 0.4, 2, renkler('#d94f3d'), 16 - i * 4);
            for (const u of [0, 1.6]) K(x + 0.3 + u, y + 2.4, 0.08, 0.08, 20, renkler('#3d7fd9'));
            K(x + 0.3, y + 2.4, 1.7, 0.08, 2, renkler('#3d7fd9'), 20);
            const sal = Math.sin(t / 500) * 0.25;
            for (const u of [0.6, 1.4]) { K(x + u + sal, y + 2.38, 0.3, 0.12, 2, renkler('#7a4b2a'), 8); }
            break;
        }
        case 'bisikletpark':
            for (let i = 0; i < 3; i++) K(o.gx + 0.15 + i * 0.5, o.gy + 0.1, 0.06, 0.25, 7, renkler('#9aa3ad'));
            for (const [u, r] of [[0.1, '#d94f3d'], [0.6, '#2b6cb0']]) {
                K(o.gx + u, o.gy + 0.15, 0.4, 0.06, 2, renkler(r), 6);
                for (const v of [0, 0.32]) K(o.gx + u + v, o.gy + 0.14, 0.08, 0.08, 6, renkler('#1c1c1c'));
            }
            break;
        case 'cit':
            // budanmış alçak çit: yaprak dokulu kutu, açık tepe
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd, 0.6);
            K(o.gx, o.gy, o.gw, o.gd, o.h, { ...renkler('#3f7a3a', (cc, x, y, h, sol, st) => { for (let r = 1; r < h; r += 2) if ((st + r) % 3 === 0) { cc.fillStyle = sol ? '#4f8f46' : '#34692f'; cc.fillRect(x, y + r, 1, 1); } }), ust: '#5a9a4c' });
            break;
        case 'cali': {
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd, 0.6);
            for (const [u, v, s0, h] of [[0.05, 0.2, 0.32, 6], [0.28, 0.05, 0.3, 7], [0.25, 0.28, 0.32, 5]]) K(o.gx + u, o.gy + v, s0, s0, h, { ...renkler('#3f7a3a'), ust: '#5a9a4c' });
            if (karma(o.gx, o.gy) < 0.5) { const q = P.W(o.gx + 0.35, o.gy + 0.3); c.fillStyle = '#f06292'; c.fillRect(q.x, q.y - 7, 1, 1); c.fillRect(q.x + 3, q.y - 6, 1, 1); }
            break;
        }
        case 'tarh': {
            // çiçek tarhı: taş kenarlı toprak, kırmızı-sarı-mor-beyaz piksel çiçekler
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#9a948a'));
            K(o.gx + 0.06, o.gy + 0.06, o.gw - 0.12, o.gd - 0.12, 0, { ust: '#5a3d26' }, o.h);
            for (let i = 0; i < 14; i++) {
                const q = P.W(o.gx + 0.12 + karma(o.gx, i, 1) * (o.gw - 0.24), o.gy + 0.12 + karma(o.gy, i, 2) * (o.gd - 0.24));
                c.fillStyle = '#3f8f4f'; c.fillRect(q.x, q.y - o.h - 3, 1, 3);
                c.fillStyle = ['#d94f3d', '#ffd166', '#9b59b6', '#f4efe6'][i % 4]; c.fillRect(q.x - 1, q.y - o.h - 5, 3, 2);
            }
            break;
        }
        case 'bahcelambasi': {
            const q = P.W(o.gx + 0.1, o.gy + 0.1);
            c.fillStyle = '#2b2f36'; c.fillRect(q.x - 1, q.y - o.h, 2, o.h); c.fillRect(q.x - 2, q.y - 2, 4, 2);
            c.fillStyle = sahne.lambalar ? '#fff1b8' : '#8a8f96'; c.fillRect(q.x - 2, q.y - o.h - 3, 4, 3);
            if (sahne.lambalar && sahne.isiklar) sahne.isiklar.push((g) => { parilti(c, q.x, q.y - o.h - 1, 6, 6, '255,241,184', 0.8 * g); parilti(c, q.x, q.y, 22, 11, '255,206,130', 0.3 * g); });
            break;
        }
        case 'icmecesmesi': {
            K(o.gx, o.gy, o.gw, o.gd, o.h, renkler('#b8ab94', (cc, x, y, h, sol, st) => { if (st % 3 === 0) { cc.fillStyle = 'rgba(0,0,0,.12)'; cc.fillRect(x, y, 1, h); } }));
            K(o.gx - 0.08, o.gy - 0.08, o.gw + 0.16, o.gd + 0.16, 2, renkler('#9a948a'), o.h);
            const q = P.W(o.gx + o.gw / 2, o.gy + o.gd / 2);
            c.fillStyle = '#9aa3ad'; c.fillRect(q.x, q.y - o.h - 5, 1, 4); c.fillRect(q.x, q.y - o.h - 5, 3, 1);
            if (Math.floor(performance.now() / 200) % 3) { c.fillStyle = 'rgba(160,210,255,.9)'; c.fillRect(q.x + 3, q.y - o.h - 4, 1, 3); }
            break;
        }
        case 'kusyemligi': {
            const q = P.W(o.gx + 0.15, o.gy + 0.15);
            c.fillStyle = '#7a4b2a'; c.fillRect(q.x - 1, q.y - o.h, 2, o.h);
            K(o.gx - 0.2, o.gy - 0.2, 0.7, 0.7, 2, renkler('#a8743f'), o.h);
            K(o.gx - 0.25, o.gy - 0.25, 0.8, 0.8, 4, { ...renkler('#a33b20'), ust: '#c0392b' }, o.h + 6);
            c.fillStyle = '#e3b23c'; c.fillRect(q.x - 3, q.y - o.h - 2, 6, 1);
            break;
        }
        case 'cardak': {
            // sarmaşıklı ahşap çardak: dört dikme, kirişler, üstte yeşil örtü ve sarkan çiçekler
            golge(c, P, d, o.gx, o.gy, o.gw, o.gd, 0.8);
            for (const [u, v] of [[0, 0], [o.gw - 0.12, 0], [0, o.gd - 0.12], [o.gw - 0.12, o.gd - 0.12]]) K(o.gx + u, o.gy + v, 0.12, 0.12, o.h, renkler('#7a4b2a'));
            for (let i = 0; i < 4; i++) K(o.gx - 0.1, o.gy + i * (o.gd / 3) - 0.04, o.gw + 0.2, 0.08, 2, renkler('#8b5a2b'), o.h);
            K(o.gx - 0.05, o.gy - 0.05, o.gw + 0.1, o.gd + 0.1, 2, { ...renkler('#3f7a3a', (cc, x, y, h, sol, st) => { if (st % 4 === 1) { cc.fillStyle = '#f06292'; cc.fillRect(x, y + h, 1, 3); } }), ust: '#5a9a4c' }, o.h + 2);
            K(o.gx + 0.4, o.gy + 0.5, 0.9, 0.5, 7, renkler('#a8743f'));                                  // içinde bank
            break;
        }
        case 'bariyer': {
            // yol sonu bariyeri: iki dikme, kırmızı-beyaz çizgili kalas, reflektörler
            const yatay = o.gw > o.gd;
            for (const u of [0.08, 0.86]) K(yatay ? o.gx + o.gw * u : o.gx + 0.08, yatay ? o.gy + 0.08 : o.gy + o.gd * u, 0.1, 0.1, o.h, renkler('#5b6470'));
            K(o.gx, o.gy, o.gw, o.gd, 4, renkler('#f4efe6', (cc, x, y, h, sol, st) => { if (Math.floor(st / 4) % 2) { cc.fillStyle = sol ? '#d32f2f' : '#b71c1c'; cc.fillRect(x, y, 1, h); } }), o.h - 4);
            if (sahne.isiklar && sahne.lambalar) {
                const q = P.W(o.gx + o.gw / 2, o.gy + o.gd / 2);
                sahne.isiklar.push((g) => parilti(c, q.x, q.y - o.h + 2, 8, 5, '255,80,60', 0.35 * g * (Math.floor(performance.now() / 600) % 2 ? 1 : 0.4)));
            }
            break;
        }
        default:
            return false;
    }
    return true;
}

// ---------------------------------------------------------------- araçlar
// a: { tip, x, y, eksen ('x'|'y'), yon (±1), renk }. Gövde yerel eksende (u: arkadan öne, v: yandan) tanımlanır.
export const ARAC_BOY = { oto: 1.7, taksi: 1.7, dolmus: 2.3, otobus: 3.6, motor: 0.9 };
export function aracCiz(c, P, d, a, sahne) {
    const yatay = a.eksen === 'x', yon = a.yon;
    const B = (u0, u1, v0, v1, hh, renk, zz = 0) => {
        const p = a.x + (yatay ? yon * u0 : v0), q = a.x + (yatay ? yon * u1 : v1);
        const r = a.y + (yatay ? v0 : yon * u0), s = a.y + (yatay ? v1 : yon * u1);
        kutu(c, P, d, Math.min(p, q), Math.min(r, s), Math.abs(q - p), Math.abs(s - r), hh, renk, zz);
    };
    const N = (u, v) => P.W(a.x + (yatay ? yon * u : v), a.y + (yatay ? v : yon * u));
    const L = ARAC_BOY[a.tip] / 2, W = a.tip === 'otobus' ? 0.4 : a.tip === 'motor' ? 0.13 : a.tip === 'dolmus' ? 0.33 : 0.3;
    const alfa = a.alfa ?? 1;
    if (alfa <= 0.02) return;
    const eskiAlfa = c.globalAlpha;
    c.globalAlpha = alfa;
    golge(c, P, d, a.x - (yatay ? L : W), a.y - (yatay ? W : L), yatay ? 2 * L : 2 * W, yatay ? 2 * W : 2 * L, 1.3);
    const teker = renkler('#1a1a1a');
    const tekerler = a.tip === 'otobus' ? [-1.4, 0.9] : a.tip === 'dolmus' ? [-0.85, 0.55] : a.tip === 'motor' ? [-0.4, 0.25] : [-0.63, 0.35];
    for (const u of tekerler) for (const v of a.tip === 'motor' ? [-0.04] : [-W - 0.02, W - 0.06]) B(u, u + (a.tip === 'motor' ? 0.16 : 0.28), v, v + 0.08, 5, teker);
    if (a.tip === 'motor') {
        B(-0.4, 0.4, -0.08, 0.08, 4, renkler(a.renk), 3);
        B(-0.42, -0.08, -0.12, 0.12, 6, renkler('#d32f2f'), 7);                                  // kurye kutusu
        B(-0.05, 0.15, -0.08, 0.08, 8, renkler('#3b4048'), 7);                                    // sürücü
        B(-0.02, 0.12, -0.06, 0.06, 4, renkler('#e3b23c'), 15);                                   // kask
    } else if (a.tip === 'otobus') {
        B(-L, L, -W, W, 16, renkler(a.renk, (cc, x, y, hh, sol, st) => {
            cc.fillStyle = '#f4efe6'; cc.fillRect(x, y, 1, 5);
            if (st % 7 !== 0) { cc.fillStyle = '#2f4a5f'; cc.fillRect(x, y + 1, 1, 4); }
            cc.fillStyle = '#e3b23c'; cc.fillRect(x, y + 9, 1, 1);
        }), 3);
        B(-L + 0.1, L - 0.1, -W + 0.05, W - 0.05, 2, renkler('#dfe4e8'), 19);
        B(L - 0.05, L + 0.02, -W + 0.05, W - 0.05, 3, renkler('#e3b23c'), 14);                  // güzergâh tabelası
    } else if (a.tip === 'dolmus') {
        B(-L, L, -W, W, 6, renkler(a.renk), 2);
        B(-L + 0.05, L - 0.25, -W + 0.03, W - 0.03, 7, { ust: ton(a.renk, 1.05), sol: '#7fb6cc', sag: '#5f97ad', desen: (cc, x, y, hh, sol, st) => { if (st % 6 === 0) { cc.fillStyle = a.renk; cc.fillRect(x, y, 1, hh); } } }, 8);
        B(-L, L, -W, W, 1, renkler('#2b6cb0'), 6);                                               // şerit
    } else {
        B(-L, L, -W, W, 6, renkler(a.renk), 2);
        B(L - 0.06, L + 0.02, -W + 0.04, W - 0.04, 3, renkler('#c4ccd4'), 2);
        B(-0.5, 0.35, -W + 0.06, W - 0.06, 6, { ust: ton(a.renk, 0.95), sol: '#7fb6cc', sag: '#5f97ad', desen: (cc, x, y, hh, sol, st) => {
            if (st % 9 === 0) { cc.fillStyle = ton(a.renk, 0.7); cc.fillRect(x, y, 1, hh); }
        } }, 8);
        B(-0.46, 0.31, -W + 0.1, W - 0.1, 1, renkler(ton(a.renk, 1.05)), 14);
        if (a.tip === 'taksi') B(-0.12, 0.08, -0.12, 0.12, 3, renkler('#1c1c1c', (cc, x, y) => { cc.fillStyle = '#ffd166'; cc.fillRect(x, y, 1, 1); }), 15);
    }
    const on = N(L + 0.02, 0), arka = N(-L - 0.02, 0);
    const z = a.tip === 'otobus' ? 8 : 7;
    c.fillStyle = '#b83a2e'; c.fillRect(arka.x - 2, arka.y - z, 3, 2);
    c.fillStyle = '#f4efe6'; c.fillRect(on.x - 2, on.y - z, 3, 2);
    c.globalAlpha = eskiAlfa;
    if (sahne.isiklar && (sahne.isikGucu || 0) > 0.05 && alfa > 0.3) {
        const ileri = N(L + 1.1, 0);
        sahne.isiklar.push((g) => {
            parilti(c, (on.x + ileri.x) / 2, (on.y + ileri.y) / 2 - 2, 22, 11, '255,241,184', 0.32 * g);   // far ışığı yolda
            parilti(c, on.x, on.y - z, 10, 10, '255,246,201', 0.75 * g);
            parilti(c, arka.x, arka.y - z, 8, 8, '255,77,61', 0.7 * g);
        });
    }
}

// ---------------------------------------------------------------- hayvanlar
// Kedi: yatan, oturan veya yürüyen; kuyruk sallanır, ara sıra göz kırpar
export function kediCiz(c, P, d, k) {
    const q = P.W(k.x, k.y);
    const a = dondur(d, 0, 0), b = dondur(d, k.yon || 1, 0);
    const s = ((b.x - a.x) - (b.y - a.y)) < 0 ? -1 : 1;
    const x = Math.round(q.x), y = Math.round(q.y) - (k.z || 0);
    const R = (dx, dy, w, h, renk) => { c.fillStyle = renk; c.fillRect(s > 0 ? x + dx : x - dx - w, y + dy, w, h); };
    const [ana, koyu, acik] = k.renk;
    const t = performance.now();
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x - 4, y - 1, 9, 2);
    const kuyruk = Math.floor(t / 260 + k.x) % 3;
    if (k.durum === 'yatiyor') {
        R(-4, -3, 8, 3, ana); R(-3, -3, 3, 1, koyu); R(3, -5, 3, 3, ana); R(3, -6, 1, 1, ana); R(5, -6, 1, 1, ana);
        R(-6, -2 - (kuyruk === 1 ? 1 : 0), 2, 1, koyu);
    } else if (k.durum === 'oturuyor') {
        R(-2, -6, 4, 6, ana); R(-1, -4, 2, 3, acik); R(0, -9, 4, 3, ana); R(0, -10, 1, 1, ana); R(3, -10, 1, 1, ana);
        R(-4, -1 - kuyruk, 2, 1, koyu);
    } else {
        R(-4, -5, 8, 3, ana); R(-3, -5, 3, 1, koyu); R(3, -8, 3, 3, ana); R(3, -9, 1, 1, ana); R(5, -9, 1, 1, ana);
        const adim = Math.floor(t / 150) % 2;
        R(-4, -2, 1, 2, koyu); R(2, -2, 1, 2, koyu); R(-2 + adim, -2, 1, 2, ana); R(0 - adim, -2, 1, 2, ana);
        R(-6, -6 - (kuyruk === 1 ? 1 : 0), 2, 1, koyu);
    }
    if (Math.floor(t / 2400 + k.x * 3) % 7) { const gy = k.durum === 'oturuyor' ? -8 : k.durum === 'yatiyor' ? -4 : -7; R(5, gy, 1, 1, '#2e8b57'); }
}

// Güvercin: yerde gagalar (baş iner kalkar), ürkünce kanat çırparak havalanır
export function guvercinCiz(c, P, d, g) {
    const q = P.W(g.x, g.y);
    const x = Math.round(q.x), y = Math.round(q.y) - Math.round(g.z || 0);
    if (!g.z) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x - 2, y - 1, 4, 1); }
    c.fillStyle = '#8f98a3'; c.fillRect(x - 2, y - 3, 4, 2);
    c.fillStyle = '#6b737d'; c.fillRect(x - 3, y - 3, 1, 1);
    const gaga = !g.z && Math.floor(performance.now() / 300 + g.x * 7) % 3 === 0;
    c.fillStyle = '#5b6470'; c.fillRect(x + 1, y - (gaga ? 2 : 5), 2, 2);
    c.fillStyle = '#7cb342'; c.fillRect(x + 1, y - (gaga ? 1 : 3), 1, 1);
    if (g.z) { const k = Math.floor(performance.now() / 90) % 2; c.fillStyle = '#c4ccd4'; c.fillRect(x - 3, y - 5 - k * 2, 3, 1); c.fillRect(x + 1, y - 5 - k * 2, 3, 1); }
}
