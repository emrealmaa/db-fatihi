// Tohumlu rastgelelik: şehir her açılışta aynı kurulur (bina pencereleri, eşyalar, kediler...).
// Simülasyonun kendi rastgeleliğinden (Math.random) bağımsızdır.

// mulberry32: hızlı, küçük durumlu üreteç; [0, 1) döndürür
export function tohumlu(tohum) {
    let a = tohum >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Sayılardan kararlı bir [0, 1) değeri (ör. pencere yanık mı?)
export function karma(...sayilar) {
    let h = 2166136261;
    for (const v of sayilar) {
        h ^= Math.round(v * 1000);
        h = Math.imul(h, 16777619);
    }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
}

// Metinden tohum
export const metinTohumu = (s) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
