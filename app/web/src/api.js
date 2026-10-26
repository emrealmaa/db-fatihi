// API istemcisi. Token tarayıcıda saklanır (yalnızca bu cihazda oturumu hatırlamak için).
const ANAHTAR = 'karavana.oturum';

export function kayitliOturum() {
    try {
        return JSON.parse(localStorage.getItem(ANAHTAR)) || null;
    } catch {
        return null;
    }
}

export function oturumuKaydet(oturum) {
    try {
        if (oturum) localStorage.setItem(ANAHTAR, JSON.stringify(oturum));
        else localStorage.removeItem(ANAHTAR);
    } catch {
        // depolama kapalıysa oturum yalnızca bu sekmede yaşar
    }
}

let token = kayitliOturum()?.token || null;
let oturumDustu = () => {};

export function tokenAyarla(t) { token = t; }
export function oturumDusunce(fn) { oturumDustu = fn; }

export class ApiHatasi extends Error {
    constructor(durum, mesaj) {
        super(mesaj);
        this.durum = durum;
    }
}

// personel: yönetici başka bir personel adına işlem yapıyorsa o personelin id'si (X-Personel)
export async function api(yontem, yol, govde, { personel } = {}) {
    let res;
    try {
        res = await fetch(`/api${yol}`, {
            method: yontem,
            headers: {
                ...(govde !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(personel ? { 'X-Personel': String(personel) } : {}),
            },
            body: govde !== undefined ? JSON.stringify(govde) : undefined,
        });
    } catch {
        throw new ApiHatasi(0, 'Sunucuya ulaşılamıyor. API çalışıyor mu?');
    }
    const metin = await res.text();
    let veri = null;
    try { veri = metin ? JSON.parse(metin) : null; } catch { /* JSON değil */ }
    if (!res.ok) {
        if (res.status === 401 && yol !== '/giris') oturumDustu();
        throw new ApiHatasi(res.status, veri?.hata || `İstek başarısız (${res.status})`);
    }
    return veri;
}

export const al = (yol) => api('GET', yol);
export const gonder = (yol, govde = {}) => api('POST', yol, govde);
export const guncelle = (yol, govde) => api('PATCH', yol, govde);
export const sil = (yol) => api('DELETE', yol);

// Belirli bir personel adına istek yapan istemci (simülasyon garsonları)
export function adina(personel) {
    return {
        al: (yol) => api('GET', yol, undefined, { personel }),
        gonder: (yol, govde = {}) => api('POST', yol, govde, { personel }),
        sil: (yol) => api('DELETE', yol, undefined, { personel }),
    };
}
