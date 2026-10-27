// Kat yerleşimleri, masa yuvaları, yürünebilir ızgara, yol bulma (A*) ve kamera döndürme dönüşümleri.
// Dünya koordinatları karo cinsinden: x (gx) ve y (gy); (0,0) kuzey-batı köşe. Dünya 20x20: iç mekân
// y = 0..IC_DERINLIK, önünde (yalnızca kat 1'de) cephe şeridi, kaldırım ve sokak. Odanın dört duvarı:
// K (y = 0), B (x = 0), G (y = IC_DERINLIK, ön cephe), D (x = GENISLIK). Kamera döndükçe arkada kalan iki duvar çizilir.

export const GENISLIK = 20;      // x
export const DERINLIK = 22;      // y (dünya): 16 cephe, 17–18 kaldırım, 19–20 yol, 21 karşı kaldırım
export const IC_DERINLIK = 16;   // iç mekân derinliği

// Asansör her katta aynı yerde (eski merdivenin yeri); katlar arası geçiş kapısının önündeki karodan yapılır
export const ASANSOR = { gx: 17, gy: 2 };
export const ASANSOR_GOVDE = { gx: 17, gy: 0, gw: 2, gd: 2 };

// Kat 1 mutfağı: şefler ocak/tezgah başında çalışır, hazır tabağı servis tezgahına koyar,
// garson tezgahın önündeki alış noktasından alır
export const MUTFAK = {
    istasyonlar: [{ gx: 11, gy: 1 }, { gx: 14, gy: 1 }],
    tezgah: { gx: 12, gy: 1 },
    alis: { gx: 11, gy: 3 },
};
// VIP Kulüp (kat 3): yalnızca VIP üyeler oturur (veritabanında ayar.vip_kat + tetikleyici); kulüpte canlı piyano
export const VIP_KAT = 3;
export const MUZISYENLER = [{ rol: 'piyanist', gx: 16, gy: 13 }];
// VIP girişindeki karşılama görevlisi (kadife bariyerin yanında, kürsünün arkasında)
export const HOST = { gx: 19, gy: 4 };
// Kat 1 girişi: ön cephedeki kapı (x = 2..3). KAPI kaldırımdaki kapı önü, KAPI_IC içerideki ilk karo.
export const KAPI = { gx: 2, gy: 17 };
export const KAPI_IC = { gx: 2, gy: 15 };
export const KAPI_ARALIK = { bas: 2, son: 4 };
export const KALDIRIM_Y = 17;
export const SOKAK_Y = 18;        // kafenin önündeki yürüme sırası (kaldırımın dış kenarı)
export const KARSI_KALDIRIM_Y = 21;
export const SOKAK_GIRIS = { gx: 19, gy: SOKAK_Y };   // müşteriler sağdan gelir,
export const SOKAK_CIKIS = { gx: 0, gy: SOKAK_Y };    // soldan gider
// Kaldırımdaki tek sıra kuyruk: kapıya en yakın yer önce
export const DIS_SIRA = Array.from({ length: 15 }, (_, i) => ({ gx: 4 + i, gy: KALDIRIM_Y }));
// Kuyruk sırasındaki park bankları: bu karolara düşen bekleyenler oturur
export const BANKLAR = [{ gx: 5, gw: 2 }, { gx: 9, gw: 2 }, { gx: 13, gw: 2 }];
export const BANK_KAROLARI = new Set(BANKLAR.flatMap((b) => Array.from({ length: b.gw }, (_, i) => b.gx + i)));

// Kameraya göre kafenin arka duvarlarının gerisinde kalan dikdörtgen (oda katmanından önce çizilmeli)
export function arkadaMi(d, gx, gy, gw, gd) {
    const r = dikdortgenDondur(d, gx, gy, gw, gd), ic = dikdortgenDondur(d, 0, 0, GENISLIK, IC_DERINLIK);
    return r.gx + r.gw <= ic.gx + 0.01 || r.gy + r.gd <= ic.gy + 0.01;
}

// Nesne: { tur, gx, gy, gw, gd, h }  (taban karo cinsinden, h piksel yükseklik)
// Masa yuvası: { gx, gy, gw, gd, sekil } — veritabanındaki o kattaki masalar masa_no sırasıyla yuvalara yerleşir
// Duvar dekoru: { tur, duvar: 'K'|'B'|'G'|'D', bas, son } — duvar boyunca karo aralığı
// Organik yerleşim: masalar elle, düzensiz konumlara yerleştirildi; her masanın sandalye halkası ile
// komşusununki arasında en az bir karo yürüme boşluğu var. 1x1 masa 2 veya 4 kişilik, 2x1 masa 6 kişiliktir.
// tercih: yuvanın tasarlandığı kapasite. Kat 1'de bar ve mutfağa yakın sıradaki masalar hızlı sirkülasyon için
// 2 kişilik, iç kısımdakiler uzun oyun ve yemek için 4 kişilik; veritabanındaki masalar önce tercihi uyan yuvaya yerleşir.
// Kat 1: mutfağın önü (x 10–16, y 3–6) şeflerin ve servisin alanı olarak tamamen boş.
// Barın önünde ve duvar kenarlarında 6 adet 2 kişilik, iç salonda 4 adet 4 kişilik masa.
const kat1Masalar = [
    // 2 kişilik: bar önü (2), batı duvarı (1), doğu duvarı (3)
    { gx: 2, gy: 4, gw: 1, gd: 1, tercih: 2 }, { gx: 6, gy: 4, gw: 1, gd: 1, tercih: 2 },
    { gx: 1, gy: 8, gw: 1, gd: 1, tercih: 2 },
    { gx: 18, gy: 5, gw: 1, gd: 1, tercih: 2 }, { gx: 18, gy: 9, gw: 1, gd: 1, tercih: 2 }, { gx: 18, gy: 13, gw: 1, gd: 1, tercih: 2 },
    // 4 kişilik: iç salon
    { gx: 6, gy: 9, gw: 1, gd: 1, tercih: 4 }, { gx: 10, gy: 9, gw: 1, gd: 1, tercih: 4 },
    { gx: 14, gy: 8, gw: 1, gd: 1, tercih: 4 }, { gx: 14, gy: 12, gw: 1, gd: 1, tercih: 4 },
];
export const MUTFAK_ONU = { gx: 10, gy: 3, gw: 7, gd: 4 };

// Kat 2 strateji masaları: her birinin üstünde sarkıt lamba (yuva.lamba)
const kat2Masalar = [
    { gx: 3, gy: 3, gw: 2, gd: 1 }, { gx: 8, gy: 4, gw: 1, gd: 1 }, { gx: 12, gy: 3, gw: 2, gd: 1 },
    { gx: 4, gy: 8, gw: 1, gd: 1 }, { gx: 8, gy: 8, gw: 2, gd: 1 }, { gx: 13, gy: 7, gw: 1, gd: 1 },
    { gx: 17, gy: 7, gw: 1, gd: 1 }, { gx: 3, gy: 12, gw: 2, gd: 1 }, { gx: 8, gy: 12, gw: 1, gd: 1 },
    { gx: 13, gy: 12, gw: 2, gd: 1 },
].map((y) => ({ ...y, lamba: 'sarkit' }));

// Kat 3 VIP masaları: ortada avizeli büyük ağır strateji masası, ikili masa (Twilight Struggle gibi 2 kişilikler için).
// tercih: yuvanın tasarlandığı kapasite (veritabanındaki 8'likler geniş yuvarlak masalara, 2'lik ikili masaya)
const kat3Masalar = [
    { gx: 8, gy: 6, gw: 3, gd: 2, sekil: 'harita', tercih: 6, lamba: 'avize' },
    { gx: 13, gy: 4, gw: 2, gd: 2, sekil: 'yuvarlak', tercih: 6 },
    { gx: 13, gy: 9, gw: 3, gd: 2, sekil: 'yuvarlak', tercih: 8 },
    { gx: 8, gy: 12, gw: 3, gd: 2, sekil: 'yuvarlak', tercih: 8 },
    { gx: 5, gy: 13, gw: 1, gd: 1, tercih: 2 },
];

export const KATLAR = {
    1: {
        ad: 'Giriş & Espresso Bar',
        zemin: 'ahsap',
        isik: 0,
        nesneler: [
            { tur: 'arkaraf', gx: 1, gy: 0, gw: 7, gd: 1, h: 44 },
            { tur: 'bar', gx: 1, gy: 1, gw: 7, gd: 1, h: 22 },
            { tur: 'pasta', gx: 7, gy: 1, gw: 1, gd: 1, h: 22 },
            { tur: 'espresso', gx: 2, gy: 1, gw: 1, gd: 1, h: 22 },
            { tur: 'vitrin', gx: 5, gy: 1, gw: 2, gd: 1, h: 22 },
            { tur: 'kasa', gx: 1, gy: 12, gw: 1, gd: 2, h: 20 },
            { tur: 'koltuk', gx: 6, gy: 15, gw: 4, gd: 1, h: 10 },
            { tur: 'bitki', gx: 19, gy: 15, gw: 1, gd: 1, h: 18 },
            { tur: 'bitki', gx: 1, gy: 15, gw: 1, gd: 1, h: 18 },
            { tur: 'tabela', gx: 9, gy: 1, gw: 1, gd: 1, h: 30 },
            // mutfak: duvar boyunca ekipman, önünde servis tezgahı
            { tur: 'ocak', gx: 11, gy: 0, gw: 1, gd: 1, h: 22 }, { tur: 'firin', gx: 12, gy: 0, gw: 1, gd: 1, h: 24 },
            { tur: 'buzdolabi', gx: 13, gy: 0, gw: 1, gd: 1, h: 50 }, { tur: 'evye', gx: 14, gy: 0, gw: 1, gd: 1, h: 22 },
            { tur: 'hazirlik', gx: 15, gy: 0, gw: 1, gd: 1, h: 22 },
            { tur: 'servistezgahi', gx: 11, gy: 2, gw: 4, gd: 1, h: 20 },
        ],
        masalar: kat1Masalar,
        bar: { gx: 4, gy: 2 },
        kasa: { gx: 2, gy: 12 },
        kasiyer: { gx: 0, gy: 12 },
        bekleme: [
            { gx: 5, gy: 14 }, { gx: 6, gy: 14 }, { gx: 7, gy: 14 }, { gx: 8, gy: 14 }, { gx: 9, gy: 14 }, { gx: 10, gy: 14 },
            { gx: 5, gy: 13 }, { gx: 6, gy: 13 }, { gx: 7, gy: 13 }, { gx: 8, gy: 13 }, { gx: 9, gy: 13 }, { gx: 10, gy: 13 },
        ],
        halilar: [{ gx: 5, gy: 13, gw: 6, gd: 3, renk: 'bekleme' }, { gx: 2, gy: 15, gw: 2, gd: 1, renk: 'paspas' },
            { gx: 11, gy: 0, gw: 5, gd: 2, renk: 'mutfak' }],
        duvar: [
            { tur: 'pencere', duvar: 'K', bas: 8.5, son: 10.5 }, { tur: 'fayans', duvar: 'K', bas: 11, son: 16 },
            { tur: 'poster', duvar: 'B', bas: 11, son: 12.5, oyun: 'catan' }, { tur: 'poster', duvar: 'D', bas: 13, son: 14.5, oyun: 'tren' },
            { tur: 'pencere', duvar: 'B', bas: 2.5, son: 5 }, { tur: 'poster', duvar: 'B', bas: 6, son: 7.5, oyun: 'carcassonne' },
            { tur: 'pano', duvar: 'B', bas: 8.5, son: 10.5 },
            { tur: 'kapi', duvar: 'G', bas: 2, son: 4 }, { tur: 'pencere', duvar: 'G', bas: 6, son: 9 },
            { tur: 'pencere', duvar: 'G', bas: 11, son: 14 }, { tur: 'pencere', duvar: 'D', bas: 5, son: 8 },
            { tur: 'poster', duvar: 'D', bas: 10, son: 11.5, oyun: 'dixit' },
        ],
        // Dış mekân (yalnızca ön cephe kameraya dönükken görünür): cephe şeridindeki süs nesneleri
        dis: [
            // cephe dibi: çiçeklikler ve menü tahtası
            { tur: 'saksi', gx: 5, gy: 16.35, gw: 0.6, gd: 0.5, h: 8 }, { tur: 'saksi', gx: 9, gy: 16.35, gw: 0.6, gd: 0.5, h: 8 },
            { tur: 'saksi', gx: 13, gy: 16.35, gw: 0.6, gd: 0.5, h: 8 }, { tur: 'saksi', gx: 17.2, gy: 16.35, gw: 0.6, gd: 0.5, h: 8 },
            { tur: 'menutahta', gx: 4.3, gy: 16.4, gw: 0.5, gd: 0.4, h: 18 },
            // kuyruk sırası: park bankları (bekleyenler oturur)
            ...BANKLAR.map((b) => ({ tur: 'parkbanki', gx: b.gx, gy: 17.2, gw: b.gw, gd: 0.55, h: 16 })),
            // kaldırım kenarı: sokak lambaları, çöp kutuları, çiçeklikler
            { tur: 'sokaklambasi', gx: 1.2, gy: 18.75, gw: 0.3, gd: 0.3, h: 52 }, { tur: 'sokaklambasi', gx: 10.6, gy: 18.75, gw: 0.3, gd: 0.3, h: 52 },
            { tur: 'sokaklambasi', gx: 18.8, gy: 18.75, gw: 0.3, gd: 0.3, h: 52 },
            { tur: 'cop', gx: 7.8, gy: 18.6, gw: 0.36, gd: 0.36, h: 12 }, { tur: 'cop', gx: 15.8, gy: 18.6, gw: 0.36, gd: 0.36, h: 12 },
            { tur: 'cicek', gx: 4.2, gy: 18.6, gw: 1, gd: 0.36, h: 7 }, { tur: 'cicek', gx: 12.4, gy: 18.6, gw: 1, gd: 0.36, h: 7 },
            // ön kaldırımın yan binalar önündeki uzantısı ve yan/arka kaldırımlar
            { tur: 'sokaklambasi', gx: -4.2, gy: 18.75, gw: 0.3, gd: 0.3, h: 52 }, { tur: 'sokaklambasi', gx: 24.2, gy: 18.75, gw: 0.3, gd: 0.3, h: 52 },
            { tur: 'parkbanki', gx: -6, gy: 17.2, gw: 2, gd: 0.55, h: 16 }, { tur: 'parkbanki', gx: 23.5, gy: 17.2, gw: 2, gd: 0.55, h: 16 },
            { tur: 'cop', gx: -1.6, gy: 18.6, gw: 0.36, gd: 0.36, h: 12 }, { tur: 'cicek', gx: 21.6, gy: 18.6, gw: 1, gd: 0.36, h: 7 },
            // (şehrin geri kalanındaki sokak eşyaları sehir/yerlesim.js içinde)
        ],
    },
    2: {
        ad: 'Strateji Salonu & Bistro',
        zemin: 'koyu',
        isik: 0.18,
        nesneler: [
            // kuzey duvarı: uzun oyun kütüphanesi rafı
            { tur: 'kitaplik', gx: 2, gy: 0, gw: 12, gd: 1, h: 52 },
            // batı duvarı: bistro servis köşesi — kat 1 mutfağından yemek asansörü, ısıtıcı lambalı servis tezgâhı
            { tur: 'yemekasansoru', gx: 0, gy: 2, gw: 1, gd: 1, h: 46, on: 'D' },
            { tur: 'bistrotezgah', gx: 0, gy: 3, gw: 1, gd: 3, h: 20, isik: { r: 70, rgb: '255,150,60', a: 0.22 } },
            { tur: 'oyunstandi', gx: 0, gy: 13, gw: 1, gd: 1, h: 30 },
            { tur: 'bar', gx: 15, gy: 15, gw: 4, gd: 1, h: 22 },
            { tur: 'lamba', gx: 16, gy: 4, gw: 1, gd: 1, h: 40 },
            // doğu duvarına asılı turnuva panosu (bugün en çok oynanan oyunlar); duvar arkada kalınca görünür
            { tur: 'turnuva', gx: 19.86, gy: 7.2, gw: 0.14, gd: 2.6, h: 0, duvar: 'D', engelsiz: true },
            // okuma köşesi: iki koltuk, sehpa, ayaklı lamba
            { tur: 'okumakoltugu', gx: 18, gy: 10, gw: 1, gd: 1, h: 10 }, { tur: 'okumakoltugu', gx: 18, gy: 12, gw: 1, gd: 1, h: 10 },
            { tur: 'sehpa', gx: 17.15, gy: 11.15, gw: 0.7, gd: 0.7, h: 9 },
            { tur: 'lamba', gx: 16, gy: 10, gw: 1, gd: 1, h: 40 },
            // saksılar
            { tur: 'bitki', gx: 18, gy: 13, gw: 1, gd: 1, h: 18 }, { tur: 'bitki', gx: 14, gy: 0, gw: 1, gd: 1, h: 18 },
            { tur: 'bitki', gx: 19, gy: 0, gw: 1, gd: 1, h: 18 }, { tur: 'bitki', gx: 0, gy: 15, gw: 1, gd: 1, h: 18 },
        ],
        masalar: kat2Masalar,
        bar: { gx: 16, gy: 14 },
        // garsonun yemek asansöründen gelen tabağı aldığı yer (servis tezgâhının önü)
        servis: { gx: 1, gy: 4 }, servisYon: { vx: -1, vy: 0 },
        halilar: [{ gx: 2, gy: 3, gw: 12, gd: 12, renk: 'salon' },
            // okuma köşesinin kilimi ve bistro köşesinin siyah-beyaz dama zemini
            { gx: 16, gy: 10, gw: 3, gd: 3, renk: 'bohem' }, { gx: 0, gy: 2, gw: 2, gd: 7, renk: 'dama' }],
        duvar: [
            // raf üstündeki duvara asılı posterler (ust: rafın üstünde kalacak yükseklik)
            { tur: 'poster', duvar: 'K', bas: 3, son: 4.5, oyun: 'dixit', ust: true },
            { tur: 'poster', duvar: 'K', bas: 7.5, son: 9, oyun: 'pandemic', ust: true },
            { tur: 'poster', duvar: 'K', bas: 12, son: 13.5, oyun: 'catan', ust: true },
            { tur: 'karatahta', duvar: 'B', bas: 2.8, son: 5.8 },
            { tur: 'poster', duvar: 'B', bas: 7.5, son: 9, oyun: 'tren', ust: true },
            { tur: 'poster', duvar: 'B', bas: 10, son: 11.5, oyun: 'carcassonne', ust: true },
            { tur: 'pencere', duvar: 'G', bas: 3, son: 6 }, { tur: 'pencere', duvar: 'G', bas: 9, son: 12 },
            // doğu duvarı: sokağa ve arka bahçeye bakan pencereler (aralarında turnuva panosu)
            { tur: 'pencere', duvar: 'D', bas: 2.5, son: 5.5 }, { tur: 'pencere', duvar: 'D', bas: 12.5, son: 15 },
        ],
    },
    3: {
        ad: 'VIP Kulüp',
        zemin: 'koyuahsap',
        isik: 0.3,
        nesneler: [
            // kuzey duvarı: camlı VIP oyun vitrini, koyu ahşap VIP bar (arkasında şişe rafı), yemek asansörü
            { tur: 'vipvitrin', gx: 2, gy: 0, gw: 5, gd: 1, h: 50 },
            { tur: 'vipraf', gx: 9, gy: 0, gw: 5, gd: 0.6, h: 54 },
            { tur: 'vipbar', gx: 9, gy: 1, gw: 5, gd: 1, h: 22, isik: { r: 80, rgb: '255,196,110', a: 0.16 } },
            { tur: 'yemekasansoru', gx: 14, gy: 0, gw: 1, gd: 1, h: 46, on: 'G' },
            ...[9.6, 10.8, 12, 13.2].map((x) => ({ tur: 'bartaburesi', gx: x, gy: 2.2, gw: 0.42, gd: 0.42, h: 12, engelsiz: true })),
            // VIP girişi: asansör önünde kadife bariyer (altın direkler, kırmızı ip) ve karşılama kürsüsü
            { tur: 'kadifebariyer', gx: 16.05, gy: 2, gw: 0.12, gd: 2.6, h: 18, engelsiz: true },
            { tur: 'kadifebariyer', gx: 16.05, gy: 4.6, gw: 1.3, gd: 0.12, h: 18, engelsiz: true },
            { tur: 'hostkursu', gx: 18.85, gy: 2.7, gw: 0.6, gd: 0.6, h: 22, engelsiz: true },
            // batı duvarı: şömine ve önünde dinlenme köşesi; altta perdeli özel loca
            { tur: 'somine', gx: 0, gy: 5.8, gw: 0.9, gd: 2.4, h: 40, isik: { r: 90, rgb: '255,140,50', a: 0.3, titrek: true } },
            { tur: 'chesterfield', gx: 3, gy: 5.7, gw: 0.95, gd: 2.6, h: 9, sirt: 'D' },
            { tur: 'sehpa', gx: 1.7, gy: 6.6, gw: 0.8, gd: 0.8, h: 8 },
            { tur: 'derikoltuk', gx: 1.8, gy: 9.1, gw: 0.9, gd: 0.9, h: 9, sirt: 'G' },
            { tur: 'loca', gx: 0, gy: 11, gw: 3, gd: 4.6, h: 30 },
            // güneydoğu: piyano köşesi
            { tur: 'piyano', gx: 17, gy: 12.6, gw: 1, gd: 0.9, h: 16, klavye: 'B' },
            { tur: 'piyanotaburesi', gx: 16.25, gy: 12.8, gw: 0.5, gd: 0.5, h: 8, engelsiz: true },
            // saksılar (avize büyük masanın üstünde, masa çiziminde)
            { tur: 'bitki', gx: 19, gy: 15, gw: 1, gd: 1, h: 18 }, { tur: 'bitki', gx: 7, gy: 0, gw: 1, gd: 1, h: 18 },
            { tur: 'bitki', gx: 0, gy: 0, gw: 1, gd: 1, h: 18 }, { tur: 'bitki', gx: 4, gy: 15, gw: 1, gd: 1, h: 18 },
        ],
        masalar: kat3Masalar,
        bar: { gx: 14, gy: 2 },
        servis: { gx: 14, gy: 1 },
        halilar: [{ gx: 6, gy: 4, gw: 7, gd: 6, renk: 'vip' }, { gx: 12, gy: 8, gw: 5, gd: 4, renk: 'vip' }],
        duvar: [
            { tur: 'tablo', duvar: 'K', bas: 15.2, son: 16.6 },
            { tur: 'tablo', duvar: 'B', bas: 6.3, son: 7.7 },                               // şöminenin üstünde
            { tur: 'tablo', duvar: 'B', bas: 2, son: 3.6 },
            { tur: 'perde', duvar: 'B', bas: 11, son: 15.6 },                               // locanın kadife perdesi
            { tur: 'tablo', duvar: 'D', bas: 6, son: 7.6 }, { tur: 'tablo', duvar: 'D', bas: 10, son: 11.6 },
            { tur: 'pencere', duvar: 'D', bas: 13, son: 15 },
            { tur: 'tablo', duvar: 'G', bas: 6, son: 7.6 }, { tur: 'tablo', duvar: 'G', bas: 12, son: 13.6 },
        ],
    },
};

// ------------------------------------------------------------------ döndürme
// d: 0..3 (90° adımlar). Nokta dönüşümü (sürekli koordinat); döndürülmüş oda boyutları (RW, RH).
export function boyut(d) {
    return d % 2 ? { RW: DERINLIK, RH: GENISLIK } : { RW: GENISLIK, RH: DERINLIK };
}
export function dondur(d, x, y) {
    switch (d) {
        case 1: return { x: DERINLIK - y, y: x };
        case 2: return { x: GENISLIK - x, y: DERINLIK - y };
        case 3: return { x: y, y: GENISLIK - x };
        default: return { x, y };
    }
}
// Dikdörtgen taban (karo aralığı) dönüşümü
export function dikdortgenDondur(d, gx, gy, gw, gd) {
    const a = dondur(d, gx, gy), b = dondur(d, gx + gw, gy + gd);
    return { gx: Math.min(a.x, b.x), gy: Math.min(a.y, b.y), gw: Math.abs(b.x - a.x), gd: Math.abs(b.y - a.y) };
}
// Kamera açısına göre arkada kalan duvarlar: [sol-arka, sağ-arka]
export function arkaDuvarlar(d) {
    return [['B', 'K'], ['G', 'B'], ['D', 'G'], ['K', 'D']][d];
}
// Duvar boyunca t konumundaki noktanın dünya koordinatı
export function duvarNoktasi(duvar, t) {
    return { K: { x: t, y: 0 }, B: { x: 0, y: t }, G: { x: t, y: IC_DERINLIK }, D: { x: GENISLIK, y: t } }[duvar];
}
// Ön cephe (G) kameraya dönükse (önde kalıyorsa) dış mekân çizilir
export function disGorunur(d) {
    return !arkaDuvarlar(d).includes('G');
}

// ------------------------------------------------------------------ oturma yerleri ve engeller
// Masanın çevresindeki oturma karoları; karşılıklı dengeli sıralanır, sonra köşeler
export function oturmaYerleri(m) {
    const kuzey = [], guney = [], bati = [], dogu = [];
    for (let x = m.gx; x < m.gx + m.gw; x++) { kuzey.push({ gx: x, gy: m.gy - 1 }); guney.push({ gx: x, gy: m.gy + m.gd }); }
    for (let y = m.gy; y < m.gy + m.gd; y++) { bati.push({ gx: m.gx - 1, gy: y }); dogu.push({ gx: m.gx + m.gw, gy: y }); }
    const sira = [];
    const n = Math.max(kuzey.length, bati.length);
    for (let i = 0; i < n; i++) for (const kenar of [guney, kuzey, dogu, bati]) if (kenar[i]) sira.push(kenar[i]);
    sira.push({ gx: m.gx - 1, gy: m.gy - 1 }, { gx: m.gx + m.gw, gy: m.gy + m.gd },
        { gx: m.gx + m.gw, gy: m.gy - 1 }, { gx: m.gx - 1, gy: m.gy + m.gd });
    return sira;
}

function engelIzgarasi(kat) {
    const t = KATLAR[kat];
    const izgara = Array.from({ length: GENISLIK }, () => Array(DERINLIK).fill(false));
    const kapat = (o) => {
        // kesirli konumlu nesneler (ör. duvara yaslı makineler) değdikleri tüm karoları kapatır
        for (let x = Math.floor(o.gx); x < Math.ceil(o.gx + o.gw); x++) for (let y = Math.floor(o.gy); y < Math.ceil(o.gy + o.gd); y++) {
            if (x >= 0 && y >= 0 && x < GENISLIK && y < DERINLIK) izgara[x][y] = true;
        }
    };
    for (const o of t.nesneler) if (!o.engelsiz) kapat(o);
    for (const m of t.masalar) kapat(m);
    kapat(ASANSOR_GOVDE);
    // İç mekân dışı: üst katlarda tamamen kapalı; kat 1'de cephe şeridi yalnızca kapıdan geçilir,
    // kaldırım ve yakın şerit yürünebilir, uzak şerit kapalı
    for (let x = 0; x < GENISLIK; x++) for (let y = IC_DERINLIK; y < DERINLIK; y++) {
        const acik = kat === 1 && ((y === IC_DERINLIK && x >= KAPI_ARALIK.bas && x < KAPI_ARALIK.son) || y === KALDIRIM_Y || y === SOKAK_Y);
        if (!acik) izgara[x][y] = true;
    }
    return izgara;
}

const IZGARALAR = { 1: engelIzgarasi(1), 2: engelIzgarasi(2), 3: engelIzgarasi(3) };

export function yurunebilir(kat, gx, gy) {
    return gx >= 0 && gy >= 0 && gx < GENISLIK && gy < DERINLIK && !IZGARALAR[kat][gx][gy];
}

// A* (8 yön, köşe kesmeden). Hedef engelliyse (ör. sandalye) bile hedefe kadar yol bulunur.
export function yolBul(kat, bas, hedef) {
    const anahtar = (x, y) => x * 100 + y;
    const bx = Math.round(bas.gx), by = Math.round(bas.gy);
    if (bx === hedef.gx && by === hedef.gy) return [];
    const acik = [{ x: bx, y: by, g: 0, f: 0 }];
    const gelen = new Map();
    const gSkor = new Map([[anahtar(bx, by), 0]]);
    const kapali = new Set();
    const h = (x, y) => Math.max(Math.abs(x - hedef.gx), Math.abs(y - hedef.gy));
    const gecilir = (x, y) => (x === hedef.gx && y === hedef.gy) || yurunebilir(kat, x, y);

    while (acik.length) {
        let ei = 0;
        for (let i = 1; i < acik.length; i++) if (acik[i].f < acik[ei].f) ei = i;
        const c = acik.splice(ei, 1)[0];
        const ck = anahtar(c.x, c.y);
        if (c.x === hedef.gx && c.y === hedef.gy) {
            const yol = [];
            let k = ck;
            while (gelen.has(k)) { yol.unshift({ gx: Math.floor(k / 100), gy: k % 100 }); k = gelen.get(k); }
            return yol;
        }
        if (kapali.has(ck)) continue;
        kapali.add(ck);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy) continue;
            const nx = c.x + dx, ny = c.y + dy;
            if (!gecilir(nx, ny)) continue;
            if (dx && dy && (!gecilir(c.x + dx, c.y) || !gecilir(c.x, c.y + dy))) continue;
            const nk = anahtar(nx, ny);
            const g = c.g + (dx && dy ? 1.414 : 1);
            if (g < (gSkor.get(nk) ?? Infinity)) {
                gSkor.set(nk, g);
                gelen.set(nk, ck);
                acik.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
            }
        }
    }
    return [{ gx: hedef.gx, gy: hedef.gy }];
}
