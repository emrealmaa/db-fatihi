// Gün saati ışığı: oyun saatinden (dakika) sürekli bir renk tonu ve "gece ışığı gücü" üretir.
// Anahtar kareler arasında doğrusal geçiş yapılır; ani renk sıçraması olmaz.
const KARELER = [
    // dakika, r, g, b, alfa (karartma), guc (lamba/vitrin/pencere ışıkları)
    [9 * 60, 255, 236, 200, 0.07, 0],          // sabah: hafif sıcak
    [12 * 60, 255, 255, 255, 0, 0],            // öğlen: nötr
    [16 * 60, 255, 245, 225, 0.02, 0],
    [17 * 60 + 30, 255, 150, 80, 0.12, 0.25],  // akşamüstü: turuncu
    [18 * 60 + 30, 120, 60, 140, 0.22, 0.65],  // gün batımı: mor
    [19 * 60 + 30, 30, 30, 90, 0.34, 0.9],     // akşam
    [21 * 60, 12, 14, 50, 0.42, 1],            // gece
    [24 * 60, 12, 14, 50, 0.44, 1],
];

export function gunIsigi(dakika) {
    const m = ((dakika % 1440) + 1440) % 1440;
    let a = KARELER[0], b = KARELER[0];
    for (let i = 0; i < KARELER.length - 1; i++) if (m >= KARELER[i][0] && m < KARELER[i + 1][0]) { a = KARELER[i]; b = KARELER[i + 1]; }
    if (m < KARELER[0][0]) { a = KARELER[0]; b = KARELER[0]; }
    const t = b[0] === a[0] ? 0 : (m - a[0]) / (b[0] - a[0]);
    const k = (i) => a[i] + (b[i] - a[i]) * t;
    return { r: Math.round(k(1)), g: Math.round(k(2)), b: Math.round(k(3)), alfa: k(4), guc: k(5) };
}

// Yaya ve araç yoğunluğu çarpanı (gece azalır, akşam pik)
export function yogunluk(dakika) {
    const h = (dakika % 1440) / 60;
    if (h < 11) return 0.7;
    if (h < 16) return 1;
    if (h < 19.5) return 1.25;
    if (h < 21) return 0.8;
    return 0.45;
}

// Yanık pencere oranı (0,05'lik adımlarla; her adımda pencereler kendi sabit eşiğine göre birer birer yanar/söner)
const PENCERE_KARELER = [[17 * 60, 0.12], [18 * 60 + 30, 0.48], [21 * 60, 0.45], [22 * 60, 0.3], [24 * 60, 0.1]];
export function pencereOrani(dakika) {
    const m = ((dakika % 1440) + 1440) % 1440;
    let v = PENCERE_KARELER[0][1];
    for (let k = 0; k < PENCERE_KARELER.length - 1; k++) {
        const [a, va] = PENCERE_KARELER[k], [b, vb] = PENCERE_KARELER[k + 1];
        if (m >= a && m < b) v = va + (vb - va) * (m - a) / (b - a);
    }
    if (m >= PENCERE_KARELER[PENCERE_KARELER.length - 1][0]) v = 0.1;
    return Math.round(v * 20) / 20;
}
