// İstek parametresi doğrulama yardımcıları. Asıl kurallar veritabanında;
// burada yalnızca tip ve zorunluluk denetlenir.
import { HttpHata } from './hatalar.js';

export function tamsayi(deger, ad, { zorunlu = true } = {}) {
    if (deger === undefined || deger === null || deger === '') {
        if (zorunlu) throw new HttpHata(400, `${ad} gerekli`);
        return null;
    }
    const n = Number(deger);
    if (!Number.isInteger(n)) throw new HttpHata(400, `${ad} tam sayı olmalı`);
    return n;
}

export function sayi(deger, ad, { zorunlu = true } = {}) {
    if (deger === undefined || deger === null || deger === '') {
        if (zorunlu) throw new HttpHata(400, `${ad} gerekli`);
        return null;
    }
    const n = Number(deger);
    if (!Number.isFinite(n)) throw new HttpHata(400, `${ad} sayı olmalı`);
    return n;
}

export function metin(deger, ad, { zorunlu = true } = {}) {
    const s = typeof deger === 'string' ? deger.trim() : '';
    if (!s) {
        if (zorunlu) throw new HttpHata(400, `${ad} gerekli`);
        return null;
    }
    return s;
}

export function mantiksal(deger, { varsayilan = null } = {}) {
    if (deger === undefined || deger === null) return varsayilan;
    return deger === true || deger === 'true';
}

// Telefonu 05XXXXXXXXX biçimine getirir (boşluk, tire, +90 temizlenir)
export function telefon(deger, ad = 'Telefon') {
    let t = metin(deger, ad).replace(/[\s()-]/g, '');
    if (t.startsWith('+90')) t = '0' + t.slice(3);
    else if (t.startsWith('90') && t.length === 12) t = '0' + t.slice(2);
    else if (t.startsWith('5') && t.length === 10) t = '0' + t;
    return t;
}
