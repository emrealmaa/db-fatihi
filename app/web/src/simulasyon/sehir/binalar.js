// Bina tanımları. Her bina bir tanımdan üretilir; dört cephesi (G: güney/+y, D: doğu/+x, K: kuzey/−y, B: batı/−x)
// ve çatısı ayrı ayrı çizilir, böylece kamera hangi yöne dönerse dönsün görünen yüzler doludur.
//
//   yon       : ön cephenin baktığı yön (S/N/E/W)
//   tip       : dukkan (zeminde vitrin, üstte konut) | apartman (balkonlu; magaza ise zeminde dükkân) | ev | kiosk |
//               banka (cam cephe) | siluet (harita kenarındaki sade bina)
//   malzeme   : tugla | siva | tas | ahsap | cam
//   cati      : duz (su deposu, çanak anten, güneş paneli, baca) | kiremit | teras (saksılar, pergola)
//   ozel      : dondurma | eczane | berber | banka | bakkal | kahvehane | bufe (özel cephe/animasyon ayrıntıları)
//   kapanis   : kepengin ineceği dakika (null: gece de açık, ör. nöbetçi eczane, büfe)
// Cephe türleri tanımdan türetilir: ön → vitrin/konut, arka → servis (servis kapısı, yangın merdiveni), yanlar → yan
// (küçük pencere, yağmur borusu, elektrik panosu, afiş); bitişik iki binanın birbirine bakan yüzleri → sagir.
import { tohumlu } from './rastgele.js';
import { DUNYA, SINIR, YOLLAR } from './yerlesim.js';

const B = (o) => ({ kat: 2, malzeme: 'siva', renk: '#c9b49a', cati: 'duz', tip: 'dukkan', yon: 'S', kapanis: 20 * 60, ...o });

export const BINALAR = [
    // ---- kafe bloğu: kafenin iki yanı
    B({ id: 'sahaf', ad: 'Sahaf Kitabevi', x: -7, y: 0.3, w: 5.8, d: 15.7, kat: 4, malzeme: 'tugla', renk: '#7a4b3a', cati: 'kiremit', tente: '#2b6cb0', tabela: '#1f3f66' }),
    B({ id: 'firin', ad: 'Simit Fırını', x: 21.2, y: 0.3, w: 5.8, d: 15.7, kat: 3, renk: '#7d8a96', baca: true, tente: '#e3b23c', tabela: '#7a4b2a', kapanis: 21 * 60 }),

    // ---- batı blok: ana caddeye bakan dükkân sırası (bitişik nizam) ve arkada konutlar
    B({ id: 'banka', ad: 'Şehir Bankası · ATM', x: -25, y: 13, w: 3.4, d: 5, kat: 3, tip: 'banka', malzeme: 'cam', renk: '#3d6f8f', tabela: '#1c3a5a', ozel: 'banka', kapanis: 17 * 60 }),
    B({ id: 'bakkal', ad: 'Bakkal · Market', x: -21.6, y: 13, w: 4, d: 5, renk: '#d8c7a1', tente: '#3f8f4f', tabela: '#2f5f3a', ozel: 'bakkal', kapanis: 22 * 60 }),
    B({ id: 'berber', ad: 'Berber', x: -17.6, y: 13, w: 3, d: 5, malzeme: 'tas', renk: '#a99a83', tente: '#c0392b', tabela: '#2a1d16', ozel: 'berber', kapanis: 21 * 60 }),
    B({ id: 'eczane', ad: 'Eczane · Nöbetçi', x: -14.6, y: 13, w: 3.6, d: 5, renk: '#eef0ea', tente: '#2e8b57', tabela: '#2e8b57', ozel: 'eczane', kapanis: null }),
    B({ id: 'gulapt', ad: 'Gül Apt. · Terzi', x: -25, y: 1, w: 8, d: 9, kat: 6, tip: 'apartman', magaza: true, yon: 'N', renk: '#c99a7a', tente: '#9b59b6' }),
    B({ id: 'cumbali1', x: -16, y: 2, w: 4.6, d: 7, kat: 3, tip: 'ev', yon: 'E', malzeme: 'ahsap', renk: '#b5824f', cati: 'kiremit' }),

    // ---- doğu blok: dondurmacı + çarşı, kahvehane, apartman
    B({ id: 'dondurma', ad: 'Maraş Dondurmacısı', x: 31, y: 10, w: 5, d: 6, renk: '#f3d1dc', tente: '#e05a8a', tabela: '#8a2c4f', ozel: 'dondurma', kapanis: 22 * 60 }),
    B({ id: 'kasap', ad: 'Kasap', x: 36, y: 12, w: 3.4, d: 6, malzeme: 'tas', renk: '#b9a88a', tente: '#a33b20', tabela: '#5a1f12' }),
    B({ id: 'lokumcu', ad: 'Lokumcu', x: 39.4, y: 12, w: 3.3, d: 6, malzeme: 'tas', renk: '#c7b08a', tente: '#e07b39', tabela: '#7a3e1a', cati: 'kiremit' }),
    B({ id: 'zuccaciye', ad: 'Züccaciye', x: 42.7, y: 12, w: 3.3, d: 6, kat: 3, renk: '#a89474', tente: '#2b6cb0', tabela: '#1f3f66' }),
    B({ id: 'kahvehane', ad: 'Çay Ocağı · Kahvehane', x: 33, y: 1, w: 6, d: 5, kat: 1, yon: 'W', malzeme: 'tas', renk: '#9b7b5a', cati: 'kiremit', tente: '#7a4b2a', tabela: '#3b2418', ozel: 'kahvehane', kapanis: null }),
    B({ id: 'doguapt', x: 40, y: 1, w: 6, d: 8, kat: 5, tip: 'apartman', yon: 'N', renk: '#d9b99b', cati: 'teras' }),

    // ---- kuzey blok: arka sokağa servis yüzü veren binalar (ön cepheleri kuzeye bakar)
    B({ id: 'kuzey1', x: -7, y: -15, w: 7.6, d: 10.5, kat: 5, tip: 'apartman', yon: 'N', renk: '#c9a27e' }),
    B({ id: 'han', ad: 'Eski Han', x: 0.6, y: -14, w: 8, d: 9.5, kat: 3, tip: 'ev', yon: 'N', malzeme: 'tas', renk: '#b8a585', cati: 'kiremit' }),
    B({ id: 'kuzey3', x: 8.6, y: -15, w: 8.4, d: 10.5, kat: 6, tip: 'apartman', yon: 'N', renk: '#a7b5a0', cati: 'teras' }),
    B({ id: 'kuzey4', x: 17, y: -13, w: 10, d: 8.5, kat: 4, tip: 'apartman', yon: 'N', renk: '#d8c2a8' }),

    // ---- kuzey-batı blok: arka sokağa bakan apartmanlar
    B({ id: 'laleapt', ad: 'Lale Apt. · Kuaför', x: -25, y: -15, w: 7.5, d: 10.5, kat: 5, tip: 'apartman', magaza: true, renk: '#e0c3a0', tente: '#f06292' }),
    B({ id: 'taskev', x: -17, y: -12, w: 5.6, d: 7.5, kat: 3, tip: 'ev', malzeme: 'tas', renk: '#a8957a', cati: 'kiremit' }),

    // ---- kuzey-doğu: park binaları
    B({ id: 'caybahcesi', ad: 'Çay Bahçesi', x: 31.5, y: -15.6, w: 4, d: 3, kat: 1, malzeme: 'ahsap', renk: '#8a5a34', cati: 'teras', tente: '#3f8f4f', tabela: '#2f5f3a', kapanis: null }),
    B({ id: 'wc', ad: 'WC', x: 44, y: -6.4, w: 1.6, d: 1.4, kat: 1, tip: 'kiosk', yon: 'W', malzeme: 'tas', renk: '#b0a898', kapanis: null }),

    // ---- güney blok: ana caddenin karşısındaki dükkânlar (ön cephe kuzeye, kafeye bakar)
    B({ id: 'cicekci', ad: 'Çiçekçi', x: -6.8, y: 23.2, w: 5.6, d: 4.6, yon: 'N', renk: '#7fa88a', tente: '#d94f3d', tabela: '#2f5f3a' }),
    B({ id: 'kirtasiye', ad: 'Kırtasiye', x: -1.2, y: 23.2, w: 4.6, d: 4.6, yon: 'N', malzeme: 'tugla', renk: '#8a6a3a', tente: '#3f8f4f', tabela: '#1f3f2a' }),
    B({ id: 'pizza', ad: 'Pizza Dükkânı', x: 3.4, y: 23.2, w: 5.2, d: 4.6, yon: 'N', renk: '#c96a4e', tente: '#f4efe6', tabela: '#8b3a2e', kapanis: 22 * 60 }),
    B({ id: 'oyuncakci', ad: 'Oyuncakçı', x: 8.6, y: 23.2, w: 5.8, d: 4.6, kat: 3, yon: 'N', renk: '#8f94c9', tente: '#e07b39', tabela: '#3a3f7a' }),
    B({ id: 'papatya', ad: 'Papatya Apt. · Kuruyemiş', x: 14.4, y: 23.2, w: 7, d: 9, kat: 6, tip: 'apartman', magaza: true, yon: 'N', renk: '#e5d3b3', tente: '#e3b23c' }),
    B({ id: 'cumbali2', x: 21.4, y: 23.2, w: 5.6, d: 6, kat: 3, tip: 'ev', yon: 'N', malzeme: 'ahsap', renk: '#9c6b45', cati: 'kiremit' }),
    B({ id: 'guney5', x: -7, y: 29.4, w: 7, d: 6.6, kat: 4, tip: 'apartman', yon: 'S', renk: '#c4b29a' }),
    B({ id: 'guney6', x: 0.4, y: 29.4, w: 8, d: 6.6, kat: 5, tip: 'apartman', yon: 'S', renk: '#b7c4c9', cati: 'teras' }),

    // ---- güney-batı ve güney-doğu
    B({ id: 'lokanta', ad: 'Lokanta', x: -25, y: 23.2, w: 7, d: 8, kat: 5, tip: 'apartman', magaza: true, yon: 'N', renk: '#d7b48a', tente: '#c0392b' }),
    B({ id: 'ayakkabi', ad: 'Ayakkabıcı', x: -17.6, y: 23.2, w: 6.2, d: 6, yon: 'N', malzeme: 'tas', renk: '#a8957a', cati: 'kiremit', tente: '#5c6bc0', tabela: '#2a2f5a' }),
    B({ id: 'bufe', ad: 'Büfe · Tost & Ayran', x: 38, y: 23.6, w: 2.4, d: 1.8, kat: 1, tip: 'kiosk', yon: 'N', renk: '#e3b23c', tabela: '#c0392b', ozel: 'bufe', kapanis: null }),
    B({ id: 'camasir', ad: 'Çamaşırhane', x: 41, y: 23.4, w: 5, d: 9, kat: 6, tip: 'apartman', magaza: true, yon: 'N', renk: '#cfc2d9', tente: '#2bb0a8' }),
    B({ id: 'guneydogu2', x: 31, y: 26, w: 6, d: 7, kat: 4, tip: 'apartman', yon: 'N', renk: '#d9c7a1', cati: 'teras' }),
];

// Harita kenarı siluetleri: "şehir devam ediyor" hissi için sade, düşük ayrıntılı binalar (tohumlu, her açılışta aynı)
{
    const rnd = tohumlu(9001);
    const renk = ['#5b5f6b', '#6b6258', '#57606b', '#655a5f', '#5a6457'];
    const yolUstu = (a0, a1, eksen) => YOLLAR.some((y) => y.eksen !== eksen && a1 > y.a0 - 0.5 && a0 < y.a1 + 0.5);
    let n = 0;
    const ekle = (x, y, w, d) => BINALAR.push(B({ id: `siluet${n++}`, x, y, w, d, kat: 3 + Math.floor(rnd() * 5), tip: 'siluet', renk: renk[n % renk.length], kapanis: null }));
    for (const [y, d] of [[SINIR.y0 + 0.6, DUNYA.y0 - SINIR.y0 - 1.2], [DUNYA.y1 + 0.6, SINIR.y1 - DUNYA.y1 - 1.2]]) {
        for (let x = SINIR.x0 + 0.5; x < SINIR.x1 - 2;) {
            const w = 4 + rnd() * 4;
            if (!yolUstu(x, x + w, 'x')) ekle(x, y, Math.min(w, SINIR.x1 - 0.5 - x), d);
            else { x = YOLLAR.find((q) => q.eksen === 'y' && x + w > q.a0 - 0.5 && x < q.a1 + 0.5).a1 + 0.6; continue; }
            x += w + 0.4;
        }
    }
    for (const [x, w] of [[SINIR.x0 + 0.6, DUNYA.x0 - SINIR.x0 - 1.2], [DUNYA.x1 + 0.6, SINIR.x1 - DUNYA.x1 - 1.2]]) {
        for (let y = DUNYA.y0 + 0.5; y < DUNYA.y1 - 2;) {
            const d = 4 + rnd() * 4;
            if (!yolUstu(y, y + d, 'y')) ekle(x, y, w, Math.min(d, DUNYA.y1 - 0.5 - y));
            else { y = YOLLAR.find((q) => q.eksen === 'x' && y + d > q.a0 - 0.5 && y < q.a1 + 0.5).a1 + 0.6; continue; }
            y += d + 0.4;
        }
    }
}

// Ön yüz ve yüz türleri
const ON = { S: 'G', N: 'K', E: 'D', W: 'B' };
const KARSI = { G: 'K', K: 'G', D: 'B', B: 'D' };
for (const b of BINALAR) {
    b.on = ON[b.yon];
    b.tohum = [...b.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    b.yuz = {};
    for (const F of ['G', 'D', 'K', 'B']) {
        if (b.tip === 'siluet') b.yuz[F] = 'siluet';
        else if (F === b.on) b.yuz[F] = ['ev'].includes(b.tip) || (b.tip === 'apartman' && !b.magaza) ? 'konut' : 'vitrin';
        else if (F === KARSI[b.on]) b.yuz[F] = b.tip === 'kiosk' ? 'yan' : 'servis';
        else b.yuz[F] = 'yan';
    }
}
// Bitişik nizam: birbirine 0,15 karodan yakın, karşılıklı ve en az 0,5 karo örtüşen yüzler sağır duvar olur
for (const a of BINALAR) for (const b of BINALAR) {
    if (a === b) continue;
    const ortusY = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y), ortusX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (Math.abs(a.x + a.w - b.x) < 0.15 && ortusY > 0.5) a.yuz.D = 'sagir';
    if (Math.abs(a.y + a.d - b.y) < 0.15 && ortusX > 0.5) a.yuz.G = 'sagir';
    if (Math.abs(b.x + b.w - a.x) < 0.15 && ortusY > 0.5) a.yuz.B = 'sagir';
    if (Math.abs(b.y + b.d - a.y) < 0.15 && ortusX > 0.5) a.yuz.K = 'sagir';
}

// Kepengin inme oranı (0 açık … 1 tamamen kapalı): kapanıştan önceki 30 dakikada yavaş yavaş iner
export function kepenkOrani(b, dakika) {
    if (b.kapanis == null || b.tip === 'siluet') return 0;
    return Math.max(0, Math.min(1, (dakika - (b.kapanis - 30)) / 30));
}
