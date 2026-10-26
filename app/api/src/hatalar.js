// PostgreSQL hatalarını anlaşılır Türkçe HTTP yanıtlarına çevirir.
// İş kuralı mesajları (RAISE EXCEPTION) zaten Türkçe olduğundan aynen iletilir;
// yalnızca adlandırılmış kısıt ihlalleri için kullanıcı dostu metin eklenir.

export class HttpHata extends Error {
    constructor(durum, mesaj) {
        super(mesaj);
        this.durum = durum;
    }
}

const KISIT_MESAJLARI = {
    uq_kullanici_telefon: 'Bu telefon numarası zaten kayıtlı',
    uq_kullanici_email: 'Bu e-posta adresi zaten kayıtlı',
    ck_kullanici_telefon: 'Telefon 05XXXXXXXXX biçiminde, 11 haneli olmalı',
    ck_kullanici_email: 'E-posta adresi geçersiz',
    uq_personel_kullanici_adi: 'Bu kullanıcı adı zaten kullanılıyor',
    uq_personel_telefon: 'Bu telefon numarası başka bir personelde kayıtlı',
    ck_personel_telefon: 'Telefon 05XXXXXXXXX biçiminde, 11 haneli olmalı',
    ck_personel_email: 'E-posta adresi geçersiz',
    ck_personel_rol: 'Rol GARSON, KASIYER veya YONETICI olmalı',
    ck_personel_kadi: 'Kullanıcı adı 3-30 karakter; küçük harf, rakam, nokta veya alt çizgi olmalı',
    uq_oturum_masa_acik: 'Masa zaten dolu',
    uq_oturum_oyun_aktif: 'Masa zaten bir oyun oynuyor; önce oyunu iade edin',
    uq_bekleme_oturum_aktif: 'Masa zaten bekleme sırasında',
    ck_oturum_kisi: 'Kişi sayısı en az 1 olmalı',
    uq_masa_no: 'Bu masa numarası zaten var',
    ck_masa_kapasite: 'Masa kapasitesi 1-20 arasında olmalı',
    uq_oyun_ad: 'Bu adda bir oyun zaten var',
    ck_oyun_oyuncu: 'Oyuncu sayıları geçersiz (min > 0, max ≥ min)',
    ck_oyun_adet: 'Adet negatif olamaz',
    ck_oyun_sure: 'Süre 0\'dan büyük olmalı',
    uq_urun_ad: 'Bu adda bir ürün zaten var',
    ck_urun_fiyat: 'Fiyat negatif olamaz',
    ck_urun_stok: 'Stok negatif olamaz',
    uq_kategori_ad: 'Bu kategori zaten var',
    uq_urun_kategori_ad: 'Bu kategori zaten var',
    ck_ayar_ucret: 'Giriş ücreti negatif olamaz',
    ck_ayar_secim: 'Seçim süresi 1-60 dakika olmalı',
};

// SQLSTATE -> HTTP durum kodu
function durumKodu(kod) {
    if (!kod) return 500;
    if (kod === '42501') return 403;                       // yetki yok
    if (kod === 'P0002') return 404;                       // no_data_found
    if (kod === '23505') return 409;                       // unique
    if (kod.startsWith('23') || kod === 'P0001') return 400;  // diğer kısıtlar, RAISE
    if (kod.startsWith('22')) return 400;                  // geçersiz veri (tip, sayı aralığı)
    return 500;
}

export function hataYaniti(e) {
    if (e instanceof HttpHata) return { durum: e.durum, hata: e.message };
    const durum = durumKodu(e.code);
    if (durum === 500) return { durum, hata: 'Beklenmeyen bir hata oluştu' };
    if (e.code === '42501' && /permission denied|izin/i.test(e.message)) {
        return { durum, hata: 'Bu işlem için yetkiniz yok' };
    }
    if (e.code === '23503') return { durum, hata: 'İlişkili kayıt bulunamadı veya kayıt kullanımda' };
    if (e.code?.startsWith('22')) return { durum, hata: 'Geçersiz değer' };
    const kisit = e.constraint || e.message.match(/"(\w+)"/)?.[1];
    return { durum, hata: KISIT_MESAJLARI[kisit] || e.message };
}

// Express hata ara katmanı
export function hataIsleyici(log = console.error) {
    // eslint-disable-next-line no-unused-vars
    return (e, req, res, next) => {
        const { durum, hata } = hataYaniti(e);
        if (durum === 500) log(e);
        res.status(durum).json({ hata });
    };
}
