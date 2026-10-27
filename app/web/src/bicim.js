// Görüntüleme biçimleri
const para = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
const saat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
const tarih = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

export const tl = (n) => (n == null ? '–' : para.format(Number(n)));
export const saatBicim = (t) => (t ? saat.format(new Date(t)) : '–');
export const tarihBicim = (t) => (t ? tarih.format(new Date(t)) : '–');

// Başlangıçtan bu yana geçen süre: "1 sa 05 dk"
export function gecenSure(baslangic, simdi = Date.now()) {
    if (!baslangic) return '–';
    const dk = Math.max(0, Math.floor((simdi - new Date(baslangic).getTime()) / 60000));
    const sa = Math.floor(dk / 60);
    return sa ? `${sa} sa ${String(dk % 60).padStart(2, '0')} dk` : `${dk} dk`;
}

// Bitiş zamanına kalan süre: "4:12"
export function kalanSure(bitis, simdi = Date.now()) {
    if (!bitis) return '';
    const sn = Math.max(0, Math.floor((new Date(bitis).getTime() - simdi) / 1000));
    return `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`;
}

export const ROL_ADI = { GARSON: 'Garson', KASIYER: 'Kasiyer', YONETICI: 'Yönetici' };
export const KAT_ADI = { 1: 'Kat 1 · Giriş & Espresso Bar', 2: 'Kat 2 · Strateji Salonu & Bistro', 3: 'Kat 3 · VIP Kulüp' };
