// Sokak ortamı: araçlar, yayalar, sabit NPC'ler (tavla oynayan amcalar, çay taşıyan çırak, dondurma ustası...),
// kediler, güvercinler ve trafik ışıkları. Tamamen görseldir: veritabanına yazmaz, simülasyon hesaplarını etkilemez.
// Simülasyondan yalnızca okur: saat, popülerlik, dışarıdaki kuyruk ve kafeden çıkan müşteriler (sokakta yürüyüp gider).
// Gerçek zamanla ilerler (simülasyon hızından bağımsız).
import { karakterPaleti } from '../cizim.js';
import { yogunluk } from './isik.js';
import { tohumlu } from './rastgele.js';
import { ARAC_BOY } from './sokakCizim.js';
import { DURAK, GECITLER, GUVERCIN_ALANI, KAFE_GECIDI, KAVSAKLAR, KEDI_YERLERI, PARKLI, SINIR, YAYA_YOLLARI, YOLLAR, ZEBRA } from './yerlesim.js';

export const ARAC_SINIR = 26;        // aynı anda yoldaki en fazla araç
export const YAYA_SINIR = 60;        // aynı anda kaldırımdaki en fazla yaya
const ISIK_DONGU = 16;               // trafik ışığı döngüsü (sn): x yeşil 6,5 · sarı 1,5 · y yeşil 6,5 · sarı 1,5

const SERITLER = YOLLAR.flatMap((yl) => yl.seritler.map((s) => ({ yol: yl, eksen: yl.eksen, c: s.c, yon: s.yon })));
const ARAC_RENK = ['#c0392b', '#2b6cb0', '#f4efe6', '#2b2b2b', '#3f8f4f', '#7b2d8b', '#e07b39', '#9aa3ad', '#5c6bc0'];
const KEDI_RENK = [['#e08a3c', '#b8652a', '#f7d9b0'], ['#2b2b2b', '#1a1a1a', '#5a5a5a'], ['#d9d6cf', '#8f8a80', '#f4efe6'], ['#f4efe6', '#c97a3c', '#2b2b2b']];

export function isikDurumu(k, zaman) {
    if (!k.isikli) return null;
    const f = (zaman + k.ofset) % ISIK_DONGU;
    return { x: f < 6.5 ? 'yesil' : f < 8 ? 'sari' : 'kirmizi', y: f >= 8 && f < 14.5 ? 'yesil' : f >= 14.5 ? 'sari' : 'kirmizi' };
}

export class Sehir {
    constructor() {
        this.rnd = tohumlu(2026);
        this.zaman = 0;
        this.sayac = 0;
        this.araclar = [];
        this.yayalar = [];
        this.isiklar = {};
        this.seritZaman = SERITLER.map(() => this.rnd() * 3);
        this.rotaZaman = YAYA_YOLLARI.map(() => this.rnd() * 2);
        this.parkli = PARKLI.map((y, i) => ({ id: `p${i}`, tip: i % 3 === 0 ? 'taksi' : 'oto', eksen: 'y', yon: i % 2 ? 1 : -1, x: -9.5, y, renk: i % 3 === 0 ? '#f2c230' : ARAC_RENK[i % ARAC_RENK.length], park: true }));
        this.sabitler = this.sabitNpcler();
        this.kediler = KEDI_YERLERI.map((k, i) => ({ ...k, x0: k.x, y0: k.y, renk: KEDI_RENK[i % KEDI_RENK.length], yon: 1, ilerle: 0 }));
        this.guvercinler = Array.from({ length: 12 }, () => this.guvercinYeri());
        this.kopek = { x: 6, y: 22.75, yon: 1, hedef: 9, bekle: 0, oturuyor: false, kare: 0 };
        // açılışta yollar ve kaldırımlar boş görünmesin
        for (let i = 0; i < 40; i++) this.adim(0.5, { dakika: 12 * 60, populerlik: 50, disarida: 0, cikanlar: [] });
    }
    r(a, b) { return a + this.rnd() * (b - a); }
    sec(d) { return d[Math.floor(this.rnd() * d.length)]; }
    birey(x, y, ek = {}) { return { id: `s${++this.sayac}`, x, y, vx: 0, vy: 1, kare: 0, animT: 0, palet: karakterPaleti(Math.floor(this.rnd() * 40)), ...ek }; }
    guvercinYeri() { const a = GUVERCIN_ALANI; return { x: this.r(a.x0, a.x1), y: this.r(a.y0, a.y1), z: 0, ucus: null }; }

    sabitNpcler() {
        const s = [];
        for (const y of [1.6, 3.9]) {                                                          // tavla oynayan amcalar
            s.push(this.birey(31.2, y + 0.35, { oturuyor: true, vx: 1, vy: 0, tavla: true, palet: karakterPaleti(31 + y * 7, 'musteri', false, { sac: '#d9d6cf' }) }));
            s.push(this.birey(32.6, y + 0.35, { oturuyor: true, vx: -1, vy: 0, tavla: true, palet: karakterPaleti(57 + y * 7, 'musteri', false, { sac: '#9aa3ad' }) }));
        }
        s.push(this.birey(32.9, 1.3, { devriye: [[32.9, 1.3], [32.9, 5.6]], hiz: 0.9, tepsi: true }));          // çay taşıyan çırak
        s.push(this.birey(33.5, 15.75, { vx: 0, vy: 1, usta: true }));                                          // Maraş dondurma ustası
        s.push(this.birey(33.1, 17.25, { vx: 0, vy: -1 }), this.birey(33.9, 17.45, { vx: 0, vy: -1 }));        // dondurma kuyruğu
        s.push(this.birey(-22.1, 18.25, { vx: 0, vy: -1 }), this.birey(-22.9, 18.3, { vx: 0, vy: -1 }));       // ATM sırası
        for (const x of [33.5, 34.3, 35.3]) s.push(this.birey(x, 22.8, { vx: 0, vy: -1, durak: true }));         // durakta bekleyenler
        s.push(this.birey(26.7, 17.45, { vx: -1, vy: 0, palet: karakterPaleti(4401, 'musteri', false, { gomlek: '#f4efe6' }) }));   // simitçi
        s.push(this.birey(35.5, -4.25, { vx: -1, vy: 0 }));                                                       // mısırcı
        for (const [x, y] of [[34.3, -9.1], [40.6, -9.1], [36.9, -5.95], [34.1, -12.1]]) s.push(this.birey(x, y, { oturuyor: true, vx: 0, vy: 1 }));   // bankta oturanlar
        s.push(this.birey(32.6, -11.6, { oturuyor: true, vx: 1, vy: 0 }), this.birey(34.6, -11.6, { oturuyor: true, vx: -1, vy: 0 }));   // çay bahçesi
        s.push(this.birey(42, -14, { devriye: [[42, -14], [44, -13]], hiz: 1.4, palet: karakterPaleti(77, 'musteri', true) }));        // oyun alanında çocuklar
        s.push(this.birey(43.5, -15, { devriye: [[43.5, -15], [42, -12.8]], hiz: 1.2, palet: karakterPaleti(78, 'musteri', true) }));
        return s;
    }

    // ------------------------------------------------------------------ adım
    adim(dt, okuma) {
        this.zaman += dt;
        for (const k of KAVSAKLAR) this.isiklar[k.id] = isikDurumu(k, this.zaman);
        const yog = yogunluk(okuma.dakika);
        this.aracAdim(dt, yog);
        this.yayaAdim(dt, yog, okuma);
        this.sabitAdim(dt);
        this.hayvanAdim(dt);
    }

    seritKonumu(s, p) { return s.eksen === 'x' ? { x: p, y: s.c } : { x: s.c, y: p }; }

    aracAdim(dt, yog) {
        SERITLER.forEach((s, i) => {
            this.seritZaman[i] -= dt * yog;
            if (this.seritZaman[i] > 0 || this.araclar.length >= ARAC_SINIR) return;
            this.seritZaman[i] = this.r(2.5, 6.5);
            const ana = s.yol.id === 'ana';
            const tip = this.sec(ana ? ['oto', 'oto', 'oto', 'taksi', 'taksi', 'dolmus', 'otobus', 'motor', 'motor'] : s.yol.tur === 'arka' ? ['oto', 'motor', 'motor', 'taksi'] : ['oto', 'oto', 'taksi', 'motor', 'dolmus']);
            const [a0, a1] = s.eksen === 'x' ? [SINIR.x0, SINIR.x1] : [SINIR.y0, SINIR.y1];
            const p = s.yon > 0 ? a0 - 2 : a1 + 2;
            if (this.araclar.some((a) => a.serit === i && Math.abs(a.p - p) < 4)) return;
            const renk = tip === 'taksi' ? '#f2c230' : tip === 'dolmus' ? '#f0e6c8' : tip === 'otobus' ? '#2b6cb0' : this.sec(ARAC_RENK);
            this.araclar.push({ id: `a${++this.sayac}`, tip, serit: i, p, v: 3, hizMax: tip === 'otobus' ? 3.2 : tip === 'motor' ? 6 : this.r(3.8, 5.6), renk, eksen: s.eksen, yon: s.yon, bekle: 0 });
        });
        SERITLER.forEach((s, i) => {
            const liste = this.araclar.filter((a) => a.serit === i).sort((a, b) => (b.p - a.p) * s.yon);
            liste.forEach((a, j) => {
                const L = ARAC_BOY[a.tip] / 2;
                const on = a.p + s.yon * L;
                let hedef = a.hizMax;
                const onde = liste[j - 1];
                if (onde) {
                    const bosluk = (onde.p - a.p) * s.yon - (ARAC_BOY[onde.tip] / 2 + L);
                    hedef = Math.min(hedef, Math.max(0, (bosluk - 0.8) * 2.2));
                }
                // trafik ışığı: dur çizgisinin önünde kırmızıda (ve uzaktayken sarıda) dur
                for (const k of KAVSAKLAR) {
                    const isik = this.isiklar[k.id];
                    if (!isik) continue;
                    const kesisir = s.eksen === 'x' ? s.c > k.y0 && s.c < k.y1 : s.c > k.x0 && s.c < k.x1;
                    if (!kesisir) continue;
                    const [b0, b1] = s.eksen === 'x' ? [k.x0, k.x1] : [k.y0, k.y1];
                    const giris = s.yon > 0 ? b0 - ZEBRA - 0.3 : b1 + ZEBRA + 0.3;
                    const kalan = (giris - on) * s.yon;
                    const d = isik[s.eksen];
                    if (kalan > -0.2 && kalan < 7 && (d === 'kirmizi' || (d === 'sari' && kalan > 1.4))) hedef = Math.min(hedef, Math.max(0, (kalan - 0.1) * 2));
                }
                // yaya geçidinde yaya varsa dur
                for (const g of GECITLER) {
                    if (g.yol !== s.eksen) continue;
                    const kesisir = s.eksen === 'x' ? s.c > g.y0 && s.c < g.y1 : s.c > g.x0 && s.c < g.x1;
                    if (!kesisir) continue;
                    const [b0, b1] = s.eksen === 'x' ? [g.x0, g.x1] : [g.y0, g.y1];
                    const kalan = ((s.yon > 0 ? b0 : b1) - on) * s.yon;
                    if (kalan < -0.3 || kalan > 4) continue;
                    if (this.yayalar.some((y) => y.x > g.x0 - 0.2 && y.x < g.x1 + 0.2 && y.y > g.y0 - 0.2 && y.y < g.y1 + 0.2)) hedef = Math.min(hedef, Math.max(0, (kalan - 0.3) * 2));
                }
                // otobüs durağı: batı yönlü ana cadde şeridinde durur, yolcu alır
                if (a.tip === 'otobus' && s.yol.id === 'ana' && s.yon < 0 && !a.durdu) {
                    const kalan = a.p - DURAK.durX;
                    if (kalan > 0 && kalan < 5) hedef = Math.min(hedef, Math.max(0.3, kalan * 1.4));
                    if (kalan <= 0.15) { a.durdu = true; a.bekle = 5; this.durakBinis = this.zaman + 2; }
                }
                if (a.bekle > 0) { a.bekle -= dt; hedef = 0; }
                a.v += Math.max(-7 * dt, Math.min(3 * dt, hedef - a.v));
                a.p += s.yon * Math.max(0, a.v) * dt;
                Object.assign(a, this.seritKonumu(s, a.p));
            });
        });
        this.araclar = this.araclar.filter((a) => {
            const [a0, a1] = a.eksen === 'x' ? [SINIR.x0, SINIR.x1] : [SINIR.y0, SINIR.y1];
            return a.p > a0 - 4 && a.p < a1 + 4;
        });
    }

    // Yaya karşıya geçebilir mi? Işıklı kavşakta kesilen yolun araç ışığı kırmızıysa; ışıksızda yaklaşan araç yoksa
    gecebilir(gecis, nokta) {
        if (gecis.kavsak?.isikli) return this.isiklar[gecis.kavsak.id]?.[gecis.eksen] === 'kirmizi';
        return !this.araclar.some((a) => a.eksen === gecis.eksen && Math.abs(a.p - nokta) < 4.5 && (nokta - a.p) * a.yon > -1);
    }

    yayaAdim(dt, yog, okuma) {
        // kafeden çıkan müşteriler sokakta yürüyüp uzaklaşır
        for (const c of okuma.cikanlar) {
            if (this.yayalar.length >= YAYA_SINIR + 10) break;
            this.yayalar.push({ ...this.birey(c.gx + 0.5, 18.55), palet: c.palet, rota: 0, p: c.gx + 0.5, yon: -1, hiz: this.r(1, 1.4), durum: 'yuru', yan: this.r(-0.12, 0.12), cikan: true });
        }
        YAYA_YOLLARI.forEach((r, i) => {
            let carpan = yog;
            if (r.kafeOnu) carpan *= 0.6 + okuma.populerlik / 100 + Math.min(0.6, okuma.disarida * 0.05);
            this.rotaZaman[i] -= dt * carpan;
            if (this.rotaZaman[i] > 0 || this.yayalar.length >= YAYA_SINIR) return;
            this.rotaZaman[i] = this.r(2, 5.5);
            const yon = this.rnd() < 0.5 ? 1 : -1;
            const p = yon > 0 ? r.bas : r.son;
            this.yayalar.push({ ...this.birey(0, 0), rota: i, p, yon, hiz: this.r(0.9, 1.5), durum: 'yuru', yan: this.r(-0.15, 0.15),
                karsiya: (r.c === 18.55 || r.c === 22.45) && this.rnd() < 0.3 });
        });
        for (const y of this.yayalar) {
            const r = YAYA_YOLLARI[y.rota];
            y.animT += dt;
            if (y.durum === 'vitrin' || y.durum === 'bekle') {
                y.bekle -= dt;
                if (y.durum === 'vitrin' && y.bekle <= 0) y.durum = 'yuru';
                if (y.durum === 'bekle') y.durum = 'yuru';                                       // her karede yeniden denetlenir
            }
            if (y.durum === 'karsiya') {
                // kafe kapısı önündeki yaya geçidinden ana caddeyi geçer
                const hedefC = y.hedefC;
                const ileri = Math.sign(hedefC - y.y);
                if (y.y > 18.9 && y.y < 22.1 || this.gecebilir({ eksen: 'x', kavsak: null }, y.x)) {
                    y.y += ileri * y.hiz * dt; y.vx = 0; y.vy = ileri; y.hareketli = true;
                } else y.hareketli = false;
                if ((hedefC - y.y) * ileri <= 0) {
                    y.y = hedefC; y.rota = YAYA_YOLLARI.findIndex((q) => q.c === hedefC); y.durum = 'yuru'; y.karsiya = false; y.gecti = true;
                }
                y.kare = y.hareketli ? Math.floor(y.animT * 6) % 4 : 0;
                continue;
            }
            if (y.durum !== 'yuru') { y.hareketli = false; y.kare = 0; this.konumla(y, r); continue; }
            const sonraki = y.p + y.yon * y.hiz * dt;
            let dur = false;
            for (const g of r.gecisler) {
                const sinir = y.yon > 0 ? g.a0 : g.a1;
                if ((y.p - sinir) * y.yon < 0 && (sonraki - sinir) * y.yon > -0.35 && !this.gecebilir(g, r.c)) dur = true;
            }
            if (dur) { y.hareketli = false; y.kare = 0; this.konumla(y, r); continue; }
            y.p = sonraki; y.hareketli = true;
            y.kare = Math.floor(y.animT * 6) % 4;
            this.konumla(y, r);
            // kafe önündeki geçitten karşıya
            if (y.karsiya && !y.gecti && y.x > KAFE_GECIDI.x0 + 0.4 && y.x < KAFE_GECIDI.x1 - 0.4) {
                y.durum = 'karsiya'; y.hedefC = r.c === 18.55 ? 22.45 : 18.55; y.x = (KAFE_GECIDI.x0 + KAFE_GECIDI.x1) / 2;
            }
            // vitrine bakma
            const yolda = r.gecisler.some((g) => y.p > g.a0 - 0.5 && y.p < g.a1 + 0.5);
            if (!yolda && !y.cikan && this.rnd() < dt * 0.02) {
                y.durum = 'vitrin'; y.bekle = this.r(1.5, 4);
                if (r.eksen === 'x') { y.vx = 0; y.vy = r.bakis; } else { y.vx = r.bakis; y.vy = 0; }
            }
        }
        this.yayalar = this.yayalar.filter((y) => { const r = YAYA_YOLLARI[y.rota]; return y.durum === 'karsiya' || (y.p >= r.bas - 1 && y.p <= r.son + 1); });
    }
    konumla(y, r) {
        if (r.eksen === 'x') { y.x = y.p; y.y = r.c + y.yan; if (y.durum === 'yuru') { y.vx = y.yon; y.vy = 0; } }
        else { y.x = r.c + y.yan; y.y = y.p; if (y.durum === 'yuru') { y.vx = 0; y.vy = y.yon; } }
    }

    sabitAdim(dt) {
        for (const s of this.sabitler) {
            s.animT += dt;
            if (s.devriye) {
                const [a, b] = s.devriye;
                s.faz = (s.faz || 0) + dt * s.hiz / Math.hypot(b[0] - a[0], b[1] - a[1]);
                const f = s.faz % 2, u = f < 1 ? f : 2 - f;
                s.x = a[0] + (b[0] - a[0]) * u; s.y = a[1] + (b[1] - a[1]) * u;
                const yon = f < 1 ? 1 : -1;
                s.vx = (b[0] - a[0]) * yon; s.vy = (b[1] - a[1]) * yon;
                s.hareketli = true; s.kare = Math.floor(s.animT * 6) % 4;
            }
            if (s.usta) s.elKalkik = Math.floor(s.animT * 2.5) % 2 === 0;               // dondurmayı kepçeyle havaya kaldırır
            if (s.tavla) s.elKalkik = Math.floor(s.animT / 3 + s.x) % 4 === 0;          // zar atar
            if (s.durak) s.gizli = this.durakBinis && this.zaman > this.durakBinis && this.zaman < this.durakBinis + 40;   // otobüse bindi
        }
    }

    hayvanAdim(dt) {
        for (const k of this.kediler) {
            if (k.durum !== 'yuruyor') continue;
            k.ilerle = (k.ilerle + dt * 0.5 / Math.hypot(k.x2 - k.x0, k.y2 - k.y0)) % 2;
            const u = k.ilerle < 1 ? k.ilerle : 2 - k.ilerle;
            k.x = k.x0 + (k.x2 - k.x0) * u; k.y = k.y0 + (k.y2 - k.y0) * u; k.yon = k.ilerle < 1 ? 1 : -1;
        }
        for (const g of this.guvercinler) {
            if (!g.ucus && this.yayalar.concat(this.sabitler).some((y) => Math.abs(y.x - g.x) < 1.3 && Math.abs(y.y - g.y) < 1.3 && y.hareketli)) {
                const h = this.guvercinYeri(); g.ucus = { x: h.x, y: h.y };
            }
            if (g.ucus) {
                const dx = g.ucus.x - g.x, dy = g.ucus.y - g.y, m = Math.hypot(dx, dy);
                if (m < 0.1) { g.z = Math.max(0, g.z - dt * 30); if (!g.z) g.ucus = null; continue; }
                g.z = Math.min(16, g.z + dt * 30);
                const a = Math.min(m, dt * 3);
                g.x += dx / m * a; g.y += dy / m * a;
            }
        }
        const k = this.kopek;
        if (k.bekle > 0) { k.bekle -= dt; k.oturuyor = true; return; }
        k.oturuyor = false;
        const dx = k.hedef - k.x;
        if (Math.abs(dx) < 0.1) { k.bekle = this.r(1.5, 4); k.hedef = this.r(-6, 26); return; }
        k.yon = Math.sign(dx);
        k.x += k.yon * Math.min(Math.abs(dx), 1.8 * dt);
        k.kare = Math.floor(this.zaman * 8) % 2;
    }

    // Çizim için anlık görünüm
    gorunum() {
        const birey = (y) => ({ ...y, gx: y.x - 0.5, gy: y.y - 0.5 });
        return {
            araclar: [...this.araclar, ...this.parkli],
            yayalar: [...this.yayalar.map(birey), ...this.sabitler.filter((s) => !s.gizli).map(birey)],
            kediler: this.kediler, guvercinler: this.guvercinler, kopek: this.kopek, isiklar: this.isiklar,
        };
    }
}
