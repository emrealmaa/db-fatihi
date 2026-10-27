// Şehir yerleşimi: kafenin çevresindeki 3x3 sokak bloğu. Yollar, bloklar, kavşaklar, yaya geçitleri, yaya
// güzergâhları ve sokak eşyaları burada tanımlıdır. Tamamen görsel katmandır: simülasyon ve veritabanı okumaz.
//
//   x:  [-26 … -10]   bati(-10…-8)   [-8 … 28 KAFE BLOĞU]   dogu(28…30)   [30 … 46]
//   y:  [-17 … -3] kuzey bloklar | arka sokak (-3…-1) | [-1 … 19] orta bloklar | ana cadde (19…22) | [22 … 37] güney
//
//  kuzey-batı: apartmanlar        kuzey: arka sokağa servis yüzü veren binalar   kuzey-doğu: park & meydan
//  batı: dükkân sırası            orta: KARAVANA ve iki yanında cep parkları     doğu: dondurmacı + çarşı, kahvehane
//  güney-batı: apartman, dükkân   güney: çiçekçi, kırtasiye, pizza, oyuncakçı    güney-doğu: otobüs durağı + büfe
import { tohumlu } from './rastgele.js';

// Maket plakası: en dış binaların ardından 2 karo kaldırım/yeşil pay. Plakanın dışında hiçbir şey çizilmez.
export const PLAKA_PAYI = 2;
export const DUNYA = { x0: -27, y0: -17, x1: 48, y1: 38 };
export const SINIR = DUNYA;

// eksen 'x': yol x boyunca uzanır, y ∈ [a0, a1]; eksen 'y': yol y boyunca uzanır, x ∈ [a0, a1].
// tur: cadde (asfalt, çift şerit), ara (parke taşı, tek şerit + park şeridi), arka (dar asfalt, tek yön)
export const YOLLAR = [
    { id: 'ana', ad: 'Ana cadde', eksen: 'x', a0: 19, a1: 22, tur: 'cadde', seritler: [{ c: 19.5, yon: 1 }, { c: 21.5, yon: -1 }], refuj: [20, 21] },
    { id: 'arka', ad: 'Arka sokak', eksen: 'x', a0: -3, a1: -1, tur: 'arka', seritler: [{ c: -2, yon: -1 }] },
    { id: 'bati', ad: 'Ara sokak', eksen: 'y', a0: -10, a1: -8, tur: 'ara', seritler: [{ c: -8.5, yon: 1 }], park: -9.5 },
    { id: 'dogu', ad: 'Doğu caddesi', eksen: 'y', a0: 28, a1: 30, tur: 'cadde', seritler: [{ c: 28.5, yon: -1 }, { c: 29.5, yon: 1 }] },
];
const YATAY = YOLLAR.filter((y) => y.eksen === 'x'), DIKEY = YOLLAR.filter((y) => y.eksen === 'y');

// Kavşaklar: ana caddedekiler trafik ışıklı, arka sokaktakiler ışıksız
export const KAVSAKLAR = [];
for (const h of YATAY) for (const v of DIKEY) {
    KAVSAKLAR.push({ id: `${h.id}-${v.id}`, x0: v.a0, x1: v.a1, y0: h.a0, y1: h.a1, isikli: h.id === 'ana', ofset: KAVSAKLAR.length * 5 });
}
export const ZEBRA = 1.4;                                   // yaya geçidi genişliği; dur çizgisi 0,2 daha geride

// Yaya geçitleri: her kavşağın dört kolunda + kafe kapısının önünde (ana caddede, ışıksız)
export const GECITLER = [];
for (const k of KAVSAKLAR) {
    GECITLER.push(
        { x0: k.x0 - ZEBRA, x1: k.x0, y0: k.y0, y1: k.y1, yol: 'x', kavsak: k },          // yatay yolun batı kolu
        { x0: k.x1, x1: k.x1 + ZEBRA, y0: k.y0, y1: k.y1, yol: 'x', kavsak: k },          // doğu kolu
        { x0: k.x0, x1: k.x1, y0: k.y0 - ZEBRA, y1: k.y0, yol: 'y', kavsak: k },          // dikey yolun kuzey kolu
        { x0: k.x0, x1: k.x1, y0: k.y1, y1: k.y1 + ZEBRA, yol: 'y', kavsak: k },          // güney kolu
    );
}
export const KAFE_GECIDI = { x0: 1.6, x1: 3.8, y0: 19, y1: 22, yol: 'x', kavsak: null };
GECITLER.push(KAFE_GECIDI);

// Bloklar (yollar arasındaki adalar); kenar: o kenarda yol var mı (varsa 1 karo kaldırım)
const XA = [[SINIR.x0, -10], [-8, 28], [30, SINIR.x1]];
const YA = [[SINIR.y0, -3], [-1, 19], [22, SINIR.y1]];
export const BLOKLAR = [];
for (const [x0, x1] of XA) for (const [y0, y1] of YA) {
    BLOKLAR.push({ x0, x1, y0, y1, kenar: { B: x0 !== SINIR.x0, D: x1 !== SINIR.x1, K: y0 !== SINIR.y0, G: y1 !== SINIR.y1 }, kafe: x0 === -8 && y0 === -1 });
}

// Park & meydan (kuzey-doğu blok)
export const PARK = { x0: 31, y0: -16, x1: 45, y1: -4 };
export const HAVUZ = { cx: 37.5, cy: -10.5, r: 1.6 };          // çeşmeli havuz
export const OYUN_ALANI = { x0: 41.2, y0: -15.6, x1: 44.6, y1: -12.2 };
const parkYolu = (x, y) => Math.abs(x + 0.5 - 37.5) < 0.6 || Math.abs(y + 0.5 - -10.5) < 0.6
    || Math.abs((x + 0.5 - 37.5) - (y + 0.5 + 10.5)) < 0.5;    // çapraz patika

// Kafenin iki yanındaki cep parkları (eski Sahaf ve Simit Fırını parselleri). yol: kıvrımlı yürüyüş yolunun kırık
// çizgisi; iki ucu da kaldırıma bağlanır (batıdaki ara sokak kaldırımına / ön kaldırıma, doğudaki ön kaldırıma / doğu caddesine)
export const BAHCELER = [
    { id: 'bati', x0: -7, x1: -0.35, y0: 0.3, y1: 16, yol: [[-7.2, 4.5], [-5.2, 5.4], [-4.2, 8], [-3.6, 11.5], [-3.2, 16.2]] },
    { id: 'dogu', x0: 20.35, x1: 27, y0: 0.3, y1: 16, yol: [[23.6, 16.2], [23.8, 12.5], [24.6, 9.6], [26, 8.2], [27.2, 7.8]] },
];
const dogruUzaklik = (px, py, [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
export const bahceYoluUzakligi = (g, px, py) => Math.min(...g.yol.slice(1).map((p, i) => dogruUzaklik(px, py, g.yol[i], p)));

// Karo (x, y) için zemin türü: yol / kavşak / refüj / kaldırım / park / bahçe / avlu / kafe
export function zeminTuru(x, y) {
    const cx = x + 0.5, cy = y + 0.5;
    const yatay = YATAY.find((h) => cy > h.a0 && cy < h.a1), dikey = DIKEY.find((v) => cx > v.a0 && cx < v.a1);
    if (yatay && dikey) return { tur: 'kavsak' };
    if (yatay || dikey) {
        const yl = yatay || dikey;
        if (yl.refuj && cy > yl.refuj[0] && cy < yl.refuj[1] && !GECITLER.some((g) => cx > g.x0 - 0.3 && cx < g.x1 + 0.3 && g.yol === 'x')) return { tur: 'refuj', yol: yl };
        return { tur: 'yol', yol: yl };
    }
    if (x >= 0 && x < 20 && y >= 0 && y < 16) return { tur: 'kafe' };
    if (y === 16 && x >= 0 && x < 20) return { tur: 'cephe' };
    for (const g of BAHCELER) if (cx > g.x0 && cx < g.x1 && cy > g.y0 && cy < g.y1) {
        if (bahceYoluUzakligi(g, cx, cy) < 0.62) return { tur: 'bahceyolu' };
        return { tur: 'bahce', kenar: cx < g.x0 + 1 || cx > g.x1 - 1 || cy < g.y0 + 1 || cy > g.y1 - 1 };
    }
    const b = BLOKLAR.find((k) => cx > k.x0 && cx < k.x1 && cy > k.y0 && cy < k.y1);
    if (!b) return { tur: 'avlu' };
    const kaldirim = (b.kenar.B && cx < b.x0 + 1) || (b.kenar.D && cx > b.x1 - 1) || (b.kenar.K && cy < b.y0 + 1) || (b.kenar.G && cy > b.y1 - 1)
        || (b.kafe && cy > 16);                                // kafe bloğunun ön kaldırımı (kuyruk + yürüme sırası)
    if (kaldirim) return { tur: 'kaldirim' };
    if (cx > PARK.x0 && cx < PARK.x1 && cy > PARK.y0 && cy < PARK.y1) {
        if ((cx - HAVUZ.cx) ** 2 + (cy - HAVUZ.cy) ** 2 < (HAVUZ.r + 0.6) ** 2) return { tur: 'meydan' };
        if (cx > OYUN_ALANI.x0 && cx < OYUN_ALANI.x1 && cy > OYUN_ALANI.y0 && cy < OYUN_ALANI.y1) return { tur: 'kum' };
        return { tur: parkYolu(x, y) ? 'patika' : 'cim' };
    }
    return { tur: 'avlu' };
}

// Yaya güzergâhları: kaldırımların ortasından geçen düz çizgiler (kavşaklarda yaya geçidinden karşıya geçilir)
export const YAYA_YOLLARI = [
    { eksen: 'x', c: 18.55, bas: DUNYA.x0 + 1.5, son: DUNYA.x1 - 1.5, kafeOnu: true, bakis: -1 },
    { eksen: 'x', c: 22.45, bas: DUNYA.x0 + 1.5, son: DUNYA.x1 - 1.5, bakis: 1 },
    { eksen: 'x', c: -0.5, bas: DUNYA.x0 + 1.5, son: DUNYA.x1 - 1.5, bakis: 1 },
    { eksen: 'x', c: -3.5, bas: DUNYA.x0 + 1.5, son: DUNYA.x1 - 1.5, bakis: -1 },
    { eksen: 'y', c: -10.5, bas: DUNYA.y0 + 1.5, son: DUNYA.y1 - 1.5, bakis: -1 },
    { eksen: 'y', c: -7.5, bas: DUNYA.y0 + 1.5, son: DUNYA.y1 - 1.5, bakis: 1 },
    { eksen: 'y', c: 27.5, bas: DUNYA.y0 + 1.5, son: DUNYA.y1 - 1.5, bakis: -1 },
    { eksen: 'y', c: 30.5, bas: DUNYA.y0 + 1.5, son: DUNYA.y1 - 1.5, bakis: 1 },
];
// Güzergâhın kestiği yollar: [bas, son] aralığı, geçit ve kavşak (ışıklıysa yaya ışığına uyulur)
for (const r of YAYA_YOLLARI) {
    r.gecisler = [];
    for (const yl of r.eksen === 'x' ? DIKEY : YATAY) {
        const k = KAVSAKLAR.find((q) => (r.eksen === 'x' ? r.c > q.y0 - ZEBRA - 0.1 && r.c < q.y1 + ZEBRA + 0.1 && q.x0 === yl.a0
            : r.c > q.x0 - ZEBRA - 0.1 && r.c < q.x1 + ZEBRA + 0.1 && q.y0 === yl.a0));
        r.gecisler.push({ a0: yl.a0, a1: yl.a1, kavsak: k || null, eksen: yl.eksen });
    }
}

// Otobüs durağı (güney-doğu kaldırımı) ve durma noktası (ana caddenin batı yönlü şeridi)
export const DURAK = { gx: 33, gy: 23, gw: 2.8, gd: 0.75, durX: 34.4 };

// Ara sokakta park etmiş araçlar (y konumları)
export const PARKLI = [-14.5, -9.5, 2.5, 6.8, 11.2, 25.5, 30, 34];

// ---------------------------------------------------------------- sokak eşyaları
const rnd = tohumlu(4242);
const kavsakYakini = (x, y) => KAVSAKLAR.some((k) => x > k.x0 - 2.2 && x < k.x1 + 2.2 && y > k.y0 - 2.2 && y < k.y1 + 2.2);
const L = (gx, gy) => ({ tur: 'sokaklambasi', gx, gy, gw: 0.3, gd: 0.3, h: 52 });
export const SOKAK_ESYALARI = [];
const E = (o) => SOKAK_ESYALARI.push(o);

// lambalar ve çöp kutuları: ana caddenin iki yanı, arka sokak, dikey yollar (kafe bloğunun önü harita.js'te)
for (let x = DUNYA.x0 + 2; x < DUNYA.x1 - 1; x += 7) {
    if (!kavsakYakini(x, 18.7) && (x < -8 || x > 28)) { E(L(x, 18.72)); if (x % 2) E({ tur: 'cop', gx: x + 0.6, gy: 18.6, gw: 0.36, gd: 0.36, h: 12 }); }
    if (!kavsakYakini(x, 22.1) && !(x > 32 && x < 36.5)) { E(L(x + 3, 22.02)); if (x % 3 === 0) E({ tur: 'cop', gx: x + 3.6, gy: 22.04, gw: 0.36, gd: 0.36, h: 12 }); }
    if (!kavsakYakini(x, -0.7)) E(L(x + 1, -0.72));
    if (!kavsakYakini(x, -3.9)) E(L(x + 4, -3.98));
}
for (let y = DUNYA.y0 + 2; y < DUNYA.y1 - 1; y += 7) {
    for (const x of [-10.72, -7.98, 27.98, 30.02]) if (!kavsakYakini(x, y) && !(y > 15 && y < 19)) E(L(x, y));
}
// refüj ağaçları
for (let x = DUNYA.x0 + 1; x < DUNYA.x1 - 1; x += 3) {
    if (!kavsakYakini(x, 20.5) && !(x > KAFE_GECIDI.x0 - 1 && x < KAFE_GECIDI.x1 + 0.5)) E({ tur: 'agac', gx: x + 0.2, gy: 20.2, gw: 0.6, gd: 0.6, h: 10 });
}
// trafik ışıkları (ışıklı kavşakların dört köşesi)
for (const k of KAVSAKLAR.filter((q) => q.isikli)) {
    for (const [x, y, eksen] of [[k.x0 - 0.35, k.y0 - 0.35, 'y'], [k.x1 + 0.05, k.y0 - 0.35, 'x'], [k.x0 - 0.35, k.y1 + 0.05, 'x'], [k.x1 + 0.05, k.y1 + 0.05, 'y']]) {
        E({ tur: 'trafiklambasi', gx: x, gy: y, gw: 0.3, gd: 0.3, h: 46, kavsak: k.id, eksen });
    }
}
// arka sokak: çöp konteynerleri ve kasalar (kuzey bloklarının servis yüzlerinin önü)
for (const x of [-21, -13.5, -4, 4.5, 13, 21.5, 40.5]) {
    E({ tur: 'konteyner', gx: x, gy: -4.45 + (x > 30 ? 0 : 0), gw: 1.2, gd: 0.45, h: 14, renk: rnd() < 0.5 ? '#3f6f4f' : '#5b6470' });
    if (rnd() < 0.6) E({ tur: 'kasalar', gx: x + 1.5, gy: -4.4, gw: 0.6, gd: 0.4, h: 10 });
}
// kafe yanı: bisiklet park yeri
E({ tur: 'bisikletpark', gx: -6.6, gy: 16.15, gw: 1.6, gd: 0.4, h: 10 });

// dükkân önleri
// bakkal: meyve-sebze kasaları, gazete standı, dondurma dolabı
E({ tur: 'meyvekasasi', gx: -21.4, gy: 18.08, gw: 0.7, gd: 0.4, h: 6, renk: '#e07b39' });
E({ tur: 'meyvekasasi', gx: -20.6, gy: 18.08, gw: 0.7, gd: 0.4, h: 6, renk: '#7cb342' });
E({ tur: 'meyvekasasi', gx: -19.8, gy: 18.08, gw: 0.7, gd: 0.4, h: 6, renk: '#d94f3d' });
E({ tur: 'gazetestandi', gx: -18.9, gy: 18.05, gw: 0.5, gd: 0.35, h: 14 });
E({ tur: 'dondurmadolabi', gx: -22.3, gy: 18.05, gw: 0.8, gd: 0.4, h: 11 });
// dondurmacı: Maraş tezgâhı ve şemsiyeli masalar
E({ tur: 'dondurmatezgahi', gx: 32.6, gy: 16.15, gw: 1.8, gd: 0.5, h: 11 });
for (const x of [31.2, 35.2]) E({ tur: 'semsiyelimasa', gx: x, gy: 16.7, gw: 0.8, gd: 0.8, h: 10, renk: '#e05a8a' });
E({ tur: 'semsiyelimasa', gx: 36.9, gy: 16.9, gw: 0.8, gd: 0.8, h: 10, renk: '#f4efe6' });
// kahvehane terası: tavla masaları ve tabureler
for (const y of [1.6, 3.9]) {
    E({ tur: 'tavlamasasi', gx: 31.6, gy: y, gw: 0.7, gd: 0.7, h: 9 });
    E({ tur: 'tabure', gx: 31.05, gy: y + 0.2, gw: 0.3, gd: 0.3, h: 5 }); E({ tur: 'tabure', gx: 32.45, gy: y + 0.2, gw: 0.3, gd: 0.3, h: 5 });
}
E({ tur: 'tabure', gx: 32.3, gy: 5.4, gw: 0.3, gd: 0.3, h: 5 });
// seyyar satıcılar
E({ tur: 'simitci', gx: 36.1, gy: 22.95, gw: 1, gd: 0.5, h: 12 });
E({ tur: 'misirci', gx: 34.3, gy: -4.7, gw: 0.9, gd: 0.5, h: 12 });
// otobüs durağı
E({ tur: 'durak', ...DURAK, h: 30 });
E({ tur: 'parkbanki', gx: 39.6, gy: 23.4, gw: 1.6, gd: 0.5, h: 16 });

// park: çeşme, oyun alanı, banklar, ağaçlar, çay bahçesi masaları
E({ tur: 'cesme', gx: HAVUZ.cx - HAVUZ.r, gy: HAVUZ.cy - HAVUZ.r, gw: HAVUZ.r * 2, gd: HAVUZ.r * 2, h: 6 });
E({ tur: 'oyunalani', gx: OYUN_ALANI.x0, gy: OYUN_ALANI.y0, gw: OYUN_ALANI.x1 - OYUN_ALANI.x0, gd: OYUN_ALANI.y1 - OYUN_ALANI.y0, h: 20 });
for (const [x, y] of [[33.5, -9.35], [39.8, -9.35], [33.5, -12.35], [39.8, -12.35], [36.1, -6.2], [36.1, -14.8]]) E({ tur: 'parkbanki', gx: x, gy: y, gw: 1.6, gd: 0.5, h: 16 });
for (const [x, y] of [[32.2, -12], [34.2, -12]]) E({ tur: 'semsiyelimasa', gx: x, gy: y, gw: 0.8, gd: 0.8, h: 10, renk: '#3f8f4f' });
for (let i = 0; i < 26; i++) {
    const x = PARK.x0 + 0.4 + rnd() * (PARK.x1 - PARK.x0 - 1.2), y = PARK.y0 + 0.4 + rnd() * (PARK.y1 - PARK.y0 - 1.2);
    const t = zeminTuru(Math.floor(x + 0.3), Math.floor(y + 0.3)).tur;
    const dolu = SOKAK_ESYALARI.some((o) => x + 0.6 > o.gx - 0.3 && x < o.gx + o.gw + 0.3 && y + 0.6 > o.gy - 0.3 && y < o.gy + o.gd + 0.3);
    if (t === 'cim' && !dolu && !(x > 31 && x < 36 && y < -12)) E({ tur: 'agac', gx: x, gy: y, gw: 0.6, gd: 0.6, h: 10, cesit: ((r) => (r < 0.25 ? 'cam' : r < 0.5 ? 'buyuk' : 'yaprak'))(rnd()) });
}
for (const [x, y] of [[31.4, -4.8], [44.2, -4.8]]) E(L(x, y));
E({ tur: 'bisikletpark', gx: 41.5, gy: -4.6, gw: 1.6, gd: 0.4, h: 10 });

// ---------------------------------------------------------------- yol uçları: plaka kenarında bariyer
for (const yl of YOLLAR) {
    const [b0, b1] = yl.eksen === 'x' ? [DUNYA.x0, DUNYA.x1] : [DUNYA.y0, DUNYA.y1];
    for (const u of [b0 + 0.25, b1 - 0.55]) {
        E(yl.eksen === 'x' ? { tur: 'bariyer', gx: u, gy: yl.a0 + 0.05, gw: 0.3, gd: yl.a1 - yl.a0 - 0.1, h: 10 } : { tur: 'bariyer', gx: yl.a0 + 0.05, gy: u, gw: yl.a1 - yl.a0 - 0.1, gd: 0.3, h: 10 });
    }
}

// ---------------------------------------------------------------- yeşil: kenar çitleri, ağaçlı kaldırımlar, refüj çalıları
const yolda = (x, y, pay = 0.4) => YOLLAR.some((q) => (q.eksen === 'x' ? y > q.a0 - pay && y < q.a1 + pay : x > q.a0 - pay && x < q.a1 + pay));
const doluMu = (x, y, w, h, pay = 0.25) => SOKAK_ESYALARI.some((o) => x + w > o.gx - pay && x < o.gx + o.gw + pay && y + h > o.gy - pay && y < o.gy + o.gd + pay);
const rk = tohumlu(777);
// plaka kenarı: aralıklı çit, çalı ve ağaç sırası; köşelerde ağaç kümeleri
for (const [x0, y0, ux, uy, len, nx, ny] of [
    [DUNYA.x0 + 0.3, DUNYA.y0 + 0.3, 1, 0, DUNYA.x1 - DUNYA.x0 - 0.6, 0, 1], [DUNYA.x0 + 0.3, DUNYA.y1 - 1.0, 1, 0, DUNYA.x1 - DUNYA.x0 - 0.6, 0, -1],
    [DUNYA.x0 + 0.3, DUNYA.y0 + 0.3, 0, 1, DUNYA.y1 - DUNYA.y0 - 0.6, 1, 0], [DUNYA.x1 - 1.0, DUNYA.y0 + 0.3, 0, 1, DUNYA.y1 - DUNYA.y0 - 0.6, -1, 0],
]) {
    for (let t = 2.2; t < len - 2.2; t += 1.7) {
        const x = x0 + ux * t, yy = y0 + uy * t;
        if (yolda(x, yy, 1.2)) continue;
        const r = rk();
        if (r < 0.42) E(ux ? { tur: 'cit', gx: x, gy: yy, gw: 1.3, gd: 0.42, h: 8 } : { tur: 'cit', gx: x, gy: yy, gw: 0.42, gd: 1.3, h: 8 });
        else if (r < 0.7 && !doluMu(x, yy, 0.6, 0.6)) E({ tur: 'agac', gx: x, gy: yy, gw: 0.6, gd: 0.6, h: 10, cesit: rk() < 0.5 ? 'orta' : 'buyuk' });
        else if (r < 0.85) E({ tur: 'cali', gx: x, gy: yy, gw: 0.6, gd: 0.6, h: 6 });
    }
}
for (const [x, yy] of [[DUNYA.x0 + 0.4, DUNYA.y0 + 0.4], [DUNYA.x1 - 1.6, DUNYA.y0 + 0.4], [DUNYA.x0 + 0.4, DUNYA.y1 - 1.6], [DUNYA.x1 - 1.6, DUNYA.y1 - 1.6]]) {
    for (const [u, v] of [[0, 0], [0.9, 0.3], [0.3, 0.9]]) if (!yolda(x + u, yy + v, 1)) E({ tur: 'agac', gx: x + u, gy: yy + v, gw: 0.6, gd: 0.6, h: 10, cesit: 'buyuk' });
}
// ağaçlı kaldırımlar (dibinde ağaç çukuru): ana cadde iki yan, ara sokak ve doğu caddesi kaldırımları
const kaldirimAgaci = (x, yy) => { if (!kavsakYakini(x, yy) && !doluMu(x, yy, 0.55, 0.55, 0.6)) E({ tur: 'agac', gx: x, gy: yy, gw: 0.55, gd: 0.55, h: 10, cesit: rk() < 0.3 ? 'buyuk' : 'orta', cukur: true }); };
for (let x = DUNYA.x0 + 3.5; x < DUNYA.x1 - 2; x += 4.2) {
    if (x < -8.5 || x > 28.5 || (x > 5 && x < 7.5) || (x > 13 && x < 15.5)) kaldirimAgaci(x, 18.42);
    if (!(x > 32 && x < 37.5)) kaldirimAgaci(x + 1.6, 22.03);
}
for (let yy = DUNYA.y0 + 3.5; yy < DUNYA.y1 - 2; yy += 4.4) {
    if (yy > 14.5 && yy < 23.5) continue;
    kaldirimAgaci(-10.97, yy); kaldirimAgaci(27.42, yy); kaldirimAgaci(30.03, yy + 2);
}
// refüjde ağaçların arasında çalılar, cadde kenarında beton çiçeklikler
for (let x = DUNYA.x0 + 2.5; x < DUNYA.x1 - 1; x += 3) {
    if (!kavsakYakini(x, 20.5) && !(x > KAFE_GECIDI.x0 - 1.4 && x < KAFE_GECIDI.x1 + 0.6)) E({ tur: 'cali', gx: x, gy: 20.2, gw: 0.6, gd: 0.6, h: 6 });
}
for (let x = DUNYA.x0 + 6; x < DUNYA.x1 - 2; x += 11) {
    if (!kavsakYakini(x, 22.1) && !doluMu(x, 22.05, 1, 0.36, 0.5)) E({ tur: 'cicek', gx: x, gy: 22.05, gw: 1, gd: 0.36, h: 7 });
}
// parkın boş kısımlarına çiçek tarhları
for (const [x, yy] of [[32.2, -6.4], [42, -8.8], [33, -15.2], [39.6, -14.6]]) if (!doluMu(x, yy, 1.4, 0.8)) E({ tur: 'tarh', gx: x, gy: yy, gw: 1.4, gd: 0.8, h: 3 });

// ---------------------------------------------------------------- cep parkları
{
    const rb = tohumlu(5150);
    for (const g of BAHCELER) {
        const yolaYakin = (x, yy, w, h, m) => bahceYoluUzakligi(g, x + w / 2, yy + h / 2) < m;
        const bat = g.id === 'bati';
        // ağaçlar: büyük çınar, orta boy, meyve ağacı (yoldan ve birbirinden uzak)
        const agaclar = bat ? [[-6.2, 1.2, 'buyuk'], [-2.2, 3.2, 'orta'], [-6, 10.6, 'meyve'], [-1.6, 8.4, 'buyuk'], [-5.4, 14, 'meyve']]
            : [[21.2, 1.4, 'buyuk'], [25.6, 2.6, 'orta'], [21.4, 9.6, 'meyve'], [26, 12.8, 'orta'], [21.8, 14.4, 'meyve']];
        for (const [x, yy, cesit] of agaclar) if (!yolaYakin(x, yy, 0.6, 0.6, 1)) E({ tur: 'agac', gx: x, gy: yy, gw: 0.6, gd: 0.6, h: 10, cesit, bahce: true });
        // budanmış alçak çitler: kaldırıma bakan kenarlarda, yol ağzında açıklık
        const kenarlar = bat ? [['y', -6.92, g.y0 + 0.2, g.y1 - 0.4], ['x', 15.55, g.x0 + 0.1, g.x1 - 0.1]] : [['y', 26.5, g.y0 + 0.2, g.y1 - 0.4], ['x', 15.55, g.x0 + 0.1, g.x1 - 0.1]];
        for (const [eksen, sabit, a, z] of kenarlar) for (let t = a; t < z - 0.3; t += 1.05) {
            const [x, yy, w, h] = eksen === 'x' ? [t, sabit, 1, 0.38] : [sabit, t, 0.38, 1];
            if (!yolaYakin(x, yy, w, h, 1.1)) E({ tur: 'cit', gx: x, gy: yy, gw: w, gd: h, h: 7 });
        }
        // çiçek tarhları
        for (const [x, yy] of bat ? [[-5.6, 6.6], [-2.4, 13], [-2.6, 0.9]] : [[25.4, 5.4], [21.2, 12.2], [24.6, 14.2]]) if (!yolaYakin(x, yy, 1.2, 0.7, 0.9)) E({ tur: 'tarh', gx: x, gy: yy, gw: 1.2, gd: 0.7, h: 3 });
        // banklar, bahçe lambaları, çöp kutusu, çeşme / kuş yemliği, çardak
        for (const [x, yy] of bat ? [[-6.2, 7.6], [-2.4, 10.2]] : [[22.4, 7.6], [25.2, 10.6], [21.4, 4.6]]) E({ tur: 'parkbanki', gx: x, gy: yy, gw: 1.4, gd: 0.5, h: 16 });
        for (const [x, yy] of bat ? [[-4.6, 4.2], [-2.6, 14.4], [-4.9, 9.6]] : [[24.4, 14.6], [25.6, 7.4], [23.3, 10.8]]) E({ tur: 'bahcelambasi', gx: x, gy: yy, gw: 0.2, gd: 0.2, h: 18 });
        E({ tur: 'cop', gx: bat ? -3.1 : 22.7, gy: bat ? 9 : 12.6, gw: 0.32, gd: 0.32, h: 11 });
        E(bat ? { tur: 'icmecesmesi', gx: -4.4, gy: 12.2, gw: 0.4, gd: 0.4, h: 14 } : { tur: 'kusyemligi', gx: 25.8, gy: 4.6, gw: 0.3, gd: 0.3, h: 26 });
        if (bat) E({ tur: 'cardak', gx: -6.6, gy: 2.8, gw: 1.8, gd: 1.6, h: 28 });
        void rb;
    }
}

// Kediler ve güvercinler için yerler
export const KEDI_YERLERI = [
    { x: -4, y: -4.45, z: 14, durum: 'yatiyor' },               // konteynerin üstünde
    { x: 13.4, y: -4.4, z: 14, durum: 'oturuyor' },
    { x: 30.6, y: 15.2, durum: 'yatiyor' },
    { x: -9.9, y: 12, durum: 'oturuyor' },
    { x: 21.9, y: 22.6, durum: 'yatiyor' },
    { x: -0.5, y: -0.6, durum: 'yuruyor', x2: 18, y2: -0.6 },
    { x: 33.4, y: 16.1, durum: 'oturuyor' },
    { x: -5.3, y: 12.8, durum: 'yatiyor' },                     // batı cep parkının çiminde
];
export const GUVERCIN_BAHCE = { x0: 21.6, y0: 5.2, x1: 24.4, y1: 8.4 };
export const GUVERCIN_ALANI = { x0: 35.6, y0: -12.4, x1: 39.4, y1: -8.6 };
