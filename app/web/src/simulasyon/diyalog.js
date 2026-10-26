// Müşteri ve garson diyalog havuzu. Motor durumlara göre buradan cümle seçer.

const sec = (dizi) => dizi[Math.floor(Math.random() * dizi.length)];

// Her oyunda geçebilecek masa sohbetleri
const GENEL_OYUN = [
    'Sıra kimde?', 'Zar atıyorum!', 'Kural kitabına baksana', 'Sıramı pas geçiyorum', 'Bu hamle oyunu bitirir!',
    'Zar kötü geldi ya...', 'Enkaz kartı bende kaldı!', 'Hile yok ama!', 'Bir tur daha!', 'Kazanıyorum!',
    'Puanları kim sayıyor?', 'Oyun harika gidiyor!', 'Bunu nasıl görmedim?', 'Son tur!', 'Strateji zamanı',
];

// Oyuna özel cümleler (oyun adındaki anahtar kelimeyle eşleşir)
const OYUNA_OZEL = [
    [/catan/i, ["Catan'da saman teklif ediyorum", 'Odun karşılığı tuğla?', 'Haydut yine bende!', 'En uzun yol benim', 'Koyun lazım, kimde var?']],
    [/carcassonne/i, ["Meeple'ımı şuraya koyuyorum", 'Bu şehri ben kapatırım', 'Manastır puanı geliyor', 'Yol buraya bağlanmaz ki']],
    [/ticket|tren/i, ['Bu rotayı kapatma!', 'Bir vagon daha çekiyorum', 'İstanbul–Ankara bağlantısı benim', 'Gizli bilet tamamlandı!']],
    [/codenames/i, ['İki kelime: deniz!', 'Bu suikastçı olabilir...', 'Mavi takım önde', 'İpucunu anlamadım']],
    [/dixit/i, ['Bu kart çok şiirsel', 'Kimse bulamaz bunu', 'Rüya gibi bir resim', 'Hikâyeni sevdim']],
    [/pandemic/i, ['Salgın kartı geldi!', 'Tedaviyi buluyoruz', 'Birlikte kazanırız', 'Avrupa çok riskli']],
    [/7 wonders/i, ['Kartları sola veriyoruz', 'Askeri güç bende', 'Harikayı tamamladım', 'Bilim kartı lazım']],
    [/azul/i, ['Bu karoyu ben alıyorum', 'Taban çizgim doldu!', 'Mavi karolar bitti', 'Duvar tamamlandı']],
    [/splendor/i, ['Bir mücevher daha', 'Soylu ziyaret etti!', 'Yakutları ayırıyorum', 'Kart rezerve ediyorum']],
    [/uno/i, ['UNO!', '+4 çek bakalım', 'Renk değiştiriyorum!', 'Yön değişti']],
];

// Sipariş isterken; kategoriye ve ürüne göre
export function siparisCumlesi(kalemler) {
    const ilk = kalemler[0];
    const ad = (ilk?.ad || '').toLocaleLowerCase('tr');
    if (ad.includes('filtre')) return sec(['Bir filtre kahve daha söylesek mi?', 'Filtre kahve iyi gider']);
    if (ad.includes('türk kahvesi')) return sec(['Zihnim açılsın diye Türk kahvesi alayım', 'Türk kahvesi lazım!']);
    if (ad.includes('çay')) return sec(['Çaylar tazelensin', 'Demli bir çay alalım']);
    const k = ilk?.kategori || '';
    if (/Sıcak/.test(k)) return sec(['Kahve lazım!', 'Sıcak bir şeyler alalım']);
    if (/Soğuk/.test(k)) return sec(['Susadık!', 'Soğuk bir şey iyi gelir']);
    if (/Yiyecek/.test(k)) return sec(['Acıktık!', 'Masada içecek alanını daraltmayalım', 'Bir tost iyi gider']);
    if (/Tatlı/.test(k)) return sec(['Tatlı zamanı!', 'Bir dilim pasta?']);
    return 'Sipariş verebilir miyiz?';
}

export function oyunCumlesi(oyunAdi) {
    const ozel = OYUNA_OZEL.find(([desen]) => desen.test(oyunAdi || ''));
    return ozel && Math.random() < 0.6 ? sec(ozel[1]) : sec(GENEL_OYUN);
}

export const servisCumlesi = () => sec(['Nefis!', 'Teşekkürler!', 'Harika!', 'Tam zamanında!', 'Oyun harika gidiyor!']);

// Sabırsızlık: bekleme türüne göre
export function sabirsizCumle(tur) {
    if (tur === 'masa') return sec(['Masa ne zaman boşalır?', 'Daha çok bekler miyiz?', 'Hâlâ bekliyoruz…']);
    if (tur === 'siparis') return sec(['Garson nerede?', 'Siparişimiz unutuldu mu?', 'Kahveler soğumasın…']);
    if (tur === 'oyun') return sec(['Oyunumuz ne zaman gelecek?', 'Sıramız gelmedi mi?']);
    return 'Hâlâ bekliyoruz…';
}

export const TERK_CUMLESI = 'Çok bekledik, gidiyoruz!';
