// Simülasyon motoru: müşteri grupları ve garsonlar için durum makineleri.
// Her kritik adım gerçek API çağrısıdır (masa aç, oyun başlat, sıraya gir, sipariş, ödeme);
// kurallar (kapasite, sıra, stok) veritabanında uygulanır, motor yalnızca sonuca göre davranır.
// Garson işlemleri o personel adına yapılır (X-Personel), böylece raporlar gerçek kişiye yazılır.
//
// Zaman: oyun saati dakika cinsinden; 1x hızda 1 gerçek saniye = 1 oyun dakikası.
import { adina, al, gonder } from '../api.js';

// Çalışma saatleri (oyun dakikası, gün içinde): 10:00 açılış, 22:00 kapanış süreci
export const ACILIS = 10 * 60, KAPANIS = 22 * 60;
// Saatlik yoğunluk eğrisi: geliş hızı çarpanı ve müşteri karışımı
//   10–13 sabah/öğle: kahve, kahvaltı, tek başına takılanlar; oyun talebi düşük
//   14–17 denge: oyun grupları gelir ama birkaç masa hep boş kalır
//   17–19 pik: kafe dolar, kapıda uzun kuyruk, sabırsızlık zirvede
//   19–20 akşam: yoğun ama azalıyor; 20–22 azalma ve çıkış dalgası
export function saatProfili(dakika) {
    const h = (dakika % 1440) / 60;
    if (h < 13) return { ad: 'Sabah · kahve & kahvaltı', gelis: 0.45, izleyici: 0.6, kahvalti: 0.45, yemek: 3, bosMasa: 0, buyukGrup: 0.3 };
    if (h < 14) return { ad: 'Öğle', gelis: 0.6, izleyici: 0.45, kahvalti: 0.3, yemek: 3, bosMasa: 0, buyukGrup: 0.5 };
    if (h < 17) return { ad: 'Öğleden sonra · oyun grupları', gelis: 0.9, izleyici: 0.2, kahvalti: 0.05, yemek: 1.5, bosMasa: 3, buyukGrup: 1 };
    if (h < 19) return { ad: 'Pik saatler', gelis: 2.6, izleyici: 0.1, kahvalti: 0, yemek: 1.5, bosMasa: 0, buyukGrup: 1.3 };
    if (h < 20) return { ad: 'Akşam', gelis: 1.2, izleyici: 0.15, kahvalti: 0, yemek: 2, bosMasa: 0, buyukGrup: 1 };
    return { ad: 'Kapanışa doğru', gelis: 0.4, izleyici: 0.3, kahvalti: 0, yemek: 1, bosMasa: 0, buyukGrup: 0.6 };
}

const SON_CIKIS = 22 * 60 + 15;   // bu saatte hâlâ içeride olan zorla uğurlanır (fiş ~22:15–22:30)
import {
    ASANSOR, BANK_KAROLARI, DIS_SIRA, HOST, KAPI, KATLAR, MUTFAK, MUZISYENLER, oturmaYerleri, SOKAK_CIKIS, SOKAK_GIRIS, VIP_KAT, yolBul, yurunebilir,
} from './harita.js';
import { karakterPaleti, OYUN_RENK } from './cizim.js';
import { Sehir } from './sehir/ortam.js';
import {
    dinleyiciCumlesi, izleyiciCumlesi, muzikCumlesi, oyunCumlesi, sabirsizCumle, sefCumlesi, servisCumlesi, siparisCumlesi, TERK_CUMLESI,
} from './diyalog.js';

const ADLAR = ['Ayşe', 'Mehmet', 'Zeynep', 'Can', 'Elif', 'Burak', 'Deniz', 'Ece', 'Emre', 'Selin', 'Mert', 'Defne', 'Kerem', 'İrem', 'Onur', 'Ceren', 'Baran', 'Ada', 'Arda', 'Nil'];
const SOYADLAR = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Koç', 'Kurt', 'Polat', 'Erdem', 'Tekin'];
const KAT_TERCIHI = { 1: ['Kart', 'Aile', 'Parti', 'Geleneksel'], 2: ['Strateji', 'Kooperatif', 'Soyut'], 3: ['Ağır strateji', 'Strateji', 'Kooperatif'] };

// VIP Kulüp: gelen grupların bu oranı VIP üyedir (üyelik yönetici prosedürüyle veritabanına yazılır); VIP grup
// oyun seçerken bu olasılıkla VIP oyunlardan birini ister. Kulüp doluysa bu kadar dakika bekler, sonra alt katlara iner.
const VIP_GRUP_ORANI = 0.14;
const VIP_OYUN_OLASILIGI = 0.75;
const VIP_BEKLEME_DK = 8;
// Yemek asansörü: kat 1 mutfağında hazırlanan tabağın üst kattaki servis tezgâhına çıkış süresi (oyun dakikası)
const YEMEK_ASANSORU_DK = 1.5;
// Mutfak süresi: tabak başına sabit + kalem başına (içecekler barda 1–4 dk; yemek bundan uzun sürer)
const PISIRME = { sabit: 4, kalem: 1.5 };
const yemekMi = (k) => /Kahvaltı|Yemek|Atıştırmalık|Yiyecek|Tatlı/.test(k.kategori);

// Sabır (0–100): bekleme türüne göre dakikada azalma; oynarken toparlanma. 0'a inen grup kafeyi terk eder.
const SABIR = { masa: 1.5, siparis: 1.3, oyun: 0.7, toparlanma: 0.6, servis: 15, siparisToleransDk: 4, vipCarpan: 1.3 };

const rastgele = (a, b) => a + Math.random() * (b - a);
const tamRastgele = (a, b) => Math.floor(rastgele(a, b + 1));
const sec = (dizi) => dizi[Math.floor(Math.random() * dizi.length)];
function agirlikliSec(dizi, agirlik) {
    const t = dizi.reduce((s, x) => s + agirlik(x), 0);
    let r = Math.random() * t;
    for (const x of dizi) { r -= agirlik(x); if (r <= 0) return x; }
    return dizi[dizi.length - 1];
}

let birimSayac = 0;
function yeniBirey(tur, kat, gx, gy, tohum = ++birimSayac) {
    return { id: ++birimSayac, tur, kat, gx, gy, yol: [], hiz: tur === 'garson' ? 2.6 : 2, palet: karakterPaleti(tohum, tur),
        kare: 0, animT: 0, oturuyor: false, baloncuk: null, balonBitis: 0 };
}

export const DURUM_METNI = {
    GELIYOR: 'Geliyor', DISARIDA: 'Dışarıda sırada', MASA_BEKLIYOR: 'Masa bekliyor', IZLIYOR: 'Etrafı izliyor', MASAYA_GIDIYOR: 'Masaya yürüyor', MASA_ACILIYOR: 'Oturuyor',
    OYUN_SECIYOR: 'Oyun seçiyor', OYNUYOR: 'Oynuyor', SIRADA: 'Oyun sırasında', HESAP: 'Kasaya gidiyor',
    ODUYOR: 'Ödüyor', CIKIYOR: 'Çıkıyor',
};

export class Simulasyon {
    constructor() {
        this.hiz = 1;
        this.calisiyor = true;
        this.dakika = ACILIS;                 // oyun saati (gün × 1440 + dakika)
        this.gun = this.yeniGunSayaci();
        this.gunSonu = null;                  // kapanış sonrası fiş verisi
        this.kapanisBasladi = false;
        this.zaman = 0;                       // gerçek saniye (baloncuklar, eşitleme)
        this.gruplar = [];
        this.garsonlar = [];
        this.masalar = [];
        this.yerlesmeyen = [];
        this.gorevler = [];
        this.kayitlar = [];
        this.oyunlar = [];
        this.menu = [];
        this.populerlik = 60;
        this.ciro = { bugun: 0, nakit: 0, kart: 0, acik: 0 };
        this.dbSiparis = {};
        this.sonrakiGelis = this.dakika + 1;
        this.musteriHavuzu = [];
        this.beklemeYerleri = KATLAR[1].bekleme.map((y) => ({ ...y, birey: null }));
        this.disKuyruk = [];                   // kaldırımda sırada bekleyen gruplar (geliş sırası)
        this.mutfakFisleri = [];               // yemek siparişleri: BEKLIYOR → PISIYOR → HAZIR
        this.sefler = [];
        this.muzisyenler = [];
        this.asansorKapi = { 1: 0, 2: 0, 3: 0 };   // kapının açık kalacağı zaman (gerçek sn)
        this.gunOyunlari = {};                 // bugün başlatılan oyunlar (kat 2 turnuva panosu): ad → sayı
        // sokak ortamı (görsel; simülasyon hızından bağımsız, gerçek zamanla hareket eder, veritabanına yazmaz)
        this.sehir = new Sehir();
        this.cikanlar = [];                    // kafeden çıkan müşteriler: sokakta yürüyüp uzaklaşırlar
        this.terkSayisi = 0;
        this.esitlemeSayac = 0;
        this.zamanlayicilar = { masa: 0, oyun: 0, ciro: 0, menu: 0 };
        this.hazir = false;
    }

    // ------------------------------------------------------------------ kurulum
    async baslat() {
        const [personel, masalar, oyunlar, menu] = await Promise.all([
            al('/yonetim/personel'), al('/masalar'), al('/oyunlar'), al('/menu')]);
        this.oyunlar = oyunlar;
        this.menu = menu;

        const aktif = personel.filter((p) => p.aktif);
        const garsonlar = aktif.filter((p) => p.rol === 'GARSON');
        this.kasiyerPersonel = aktif.find((p) => p.rol === 'KASIYER') || aktif.find((p) => p.rol === 'YONETICI');
        const kasiyerYeri = KATLAR[1].kasiyer;
        this.kasiyer = yeniBirey('kasiyer', 1, kasiyerYeri.gx, kasiyerYeri.gy, 7);

        // Masaları kat yuvalarına yerleştir: büyük kapasiteden başlayarak, oturma yeri yeten en küçük yuvaya
        for (const kat of [1, 2, 3]) {
            const katMasalari = masalar.filter((m) => m.kat === kat).sort((a, b) => b.kapasite - a.kapasite || a.masa_no - b.masa_no);
            const bosYuvalar = KATLAR[kat].masalar.map((yuva) => ({
                yuva, yerler: oturmaYerleri(yuva).filter((y) => yurunebilir(kat, y.gx, y.gy)),
            }));
            katMasalari.forEach((db) => {
                const aday = bosYuvalar.filter((y) => y.yerler.length >= db.kapasite)
                    .sort((a, b) => ((a.yuva.tercih ?? db.kapasite) !== db.kapasite) - ((b.yuva.tercih ?? db.kapasite) !== db.kapasite)
                        || a.yerler.length - b.yerler.length)[0];
                if (!aday) { this.yerlesmeyen.push(db.masa_no); return; }
                bosYuvalar.splice(bosYuvalar.indexOf(aday), 1);
                const { yuva, yerler } = aday;
                const kullanilan = yerler.slice(0, db.kapasite);
                this.masalar.push({
                    masaId: db.masa_id, masaNo: db.masa_no, kat, kapasite: db.kapasite, yuva, db,
                    yerler: kullanilan, sandalyeler: kullanilan,
                    servisYeri: yerler[db.kapasite] || kullanilan[0] || { gx: yuva.gx - 1, gy: yuva.gy },
                    grup: null, kirli: false,
                });
            });
            this.masalar.sort((a, b) => a.masaNo - b.masaNo);
        }
        if (this.yerlesmeyen.length) this.kaydet(`Yerleşim planında yer olmayan masalar: ${this.yerlesmeyen.join(', ')}`, 'uyari');

        // Garsonlar: gerçek personel; istatistikler kimliğe göre sabit
        // Garsonlar katlara eşit dağıtılır (6 garson → her kata 2); her garson kendi katına bakar
        const katlar = [...new Set(this.masalar.map((m) => m.kat))].sort();
        const kattaki = {};
        this.garsonlar = garsonlar.map((p, i) => {
            const r = (n) => Math.abs(Math.sin(p.id * 7919 + n * 104729)) % 1;
            const kat = katlar[i % katlar.length] || 1;
            const sira = (kattaki[kat] = (kattaki[kat] || 0) + 1) - 1;
            const bar = KATLAR[kat].bar;
            const ev = yurunebilir(kat, bar.gx + sira, bar.gy) ? { gx: bar.gx + sira, gy: bar.gy } : bar;
            const b = yeniBirey('garson', kat, ev.gx, ev.gy, p.id * 31);
            if (kat === VIP_KAT) b.palet = karakterPaleti(p.id * 31, 'garson', false, { vip: true });   // VIP servis: siyah yelek, altın papyon
            const stat = { hiz: 2 + r(1) * 1.5, siparis: 1 + r(2) * 2, yetenek: 1 + Math.floor(r(3) * 5) };
            b.hiz = stat.hiz;
            return { personel: p, ad: `${p.ad} ${p.soyad[0]}.`, birey: b, durum: 'BOSTA', gorev: null, stat, ev: { kat, ...ev }, tamamlanan: 0, gunluk: 0, bitis: 0 };
        });
        // Mutfak (kat 1): şef ve yardımcı şef — veritabanı personeli değil, simülasyon karakterleri
        this.sefler = [
            { ad: 'Şef Hasan', unvan: 'Şef', hizCarpani: 1.3, istasyon: MUTFAK.istasyonlar[0] },
            { ad: 'Zeynep', unvan: 'Yardımcı şef', hizCarpani: 1, istasyon: MUTFAK.istasyonlar[1], yardimci: true },
        ].map((x, i) => {
            const b = yeniBirey('sef', 1, x.istasyon.gx, x.istasyon.gy, 900 + i);
            b.palet = karakterPaleti(900 + i, 'sef', false, { yardimci: !!x.yardimci });
            b.vx = 0; b.vy = -1;
            return { ...x, birey: b, durum: 'BOSTA', fis: null, bitis: 0, hazirlanan: 0 };
        });
        // VIP Kulüp (kat 3): piyano başında piyanist, girişte karşılama görevlisi
        this.muzisyenler = MUZISYENLER.map((m, i) => {
            const b = yeniBirey('muzisyen', VIP_KAT, m.gx, m.gy, 950 + i);
            b.palet = karakterPaleti(950 + i, 'musteri', false, { rol: m.rol });
            Object.assign(b, { vx: 1, vy: 0, oturuyor: true });
            return { ...m, birey: b };
        });
        this.host = yeniBirey('host', VIP_KAT, HOST.gx, HOST.gy, 970);
        Object.assign(this.host, { vx: -1, vy: 0 });
        // VIP olmayan grupların sığabileceği en büyük masa (büyük gruplar yalnızca VIP Kulüp'e sığabilir)
        this.standartKapasite = Math.max(1, ...this.masalar.filter((m) => m.kat !== VIP_KAT).map((m) => m.kapasite));

        if (!this.garsonlar.length) this.kaydet('Aktif garson yok: siparişler alınamayacak. Yönetim > Personel\'den garson ekleyin.', 'uyari');

        this.masaGuncelle(masalar, ++this.esitlemeSayac);
        this.kaydet(`Karavana açıldı · ${this.masalar.length} masa, ${this.garsonlar.length} garson`, 'bilgi');
        this.sabahTedariki();
        this.hazir = true;
    }

    // ------------------------------------------------------------------ döngü
    tick(dtSn) {
        if (!this.hazir) return;
        dtSn = Math.min(dtSn, 0.25);
        this.zaman += dtSn;
        this.esitle(dtSn);
        this.ortamAdim(dtSn);
        if (!this.calisiyor) return;
        const dk = dtSn * this.hiz;
        this.dakika += dk;

        for (const g of this.gruplar) for (const b of g.uyeler) this.hareket(b, dtSn);
        for (const w of this.garsonlar) this.hareket(w.birey, dtSn);
        for (const sf of this.sefler) this.hareket(sf.birey, dtSn);

        const saat = this.dakika % 1440;
        if (saat >= ACILIS && saat < KAPANIS && this.dakika >= this.sonrakiGelis) this.gelisPlanla();
        if (saat >= KAPANIS && !this.kapanisBasladi) this.kapanisBaslat();
        if (saat >= SON_CIKIS && this.kapanisBasladi) this.herkesiUgurla();
        for (const g of [...this.gruplar]) this.grupAdim(g, dk);
        for (const w of this.garsonlar) this.garsonAdim(w);
        for (const sf of this.sefler) this.sefAdim(sf);
        this.yemekAsansoruAdim();
        this.muzikAdim(dk);
        if (this.kapanisBasladi && !this.gruplar.length && !this.gunSonu && !this.gunSonuBekleniyor) this.gunuKapat();
    }

    // ------------------------------------------------------------------ dış mekân ortamı
    ortamAdim(dt) {
        // kaldırım kuyruğunda yerine varan ve bank karosundaki bekleyenler oturur (caddeye bakar)
        for (const g of this.disKuyruk) for (const b of g.uyeler) {
            if (!b.yol.length && b.hedefSira && BANK_KAROLARI.has(b.hedefSira.gx) && !b.oturuyor) { b.oturuyor = true; b.vx = 0; b.vy = 1; }
        }
        // sokak ortamı simülasyonu yalnızca okur: saat, popülerlik, dışarıdaki kuyruk, çıkan müşteriler
        this.sehir.adim(dt, { dakika: this.dakika % 1440, populerlik: this.populerlik, disarida: this.disKuyruk.length, cikanlar: this.cikanlar.splice(0) });
    }

    // ------------------------------------------------------------------ gün döngüsü
    yeniGunSayaci() {
        return { baslangic: new Date().toISOString(), gelenKisi: 0, gelenGrup: 0, ogrenciKisi: 0, terkGrup: 0, terkKisi: 0,
            yerBulamayan: 0, kapanistaDonen: 0 };
    }

    acikMi() {
        const saat = this.dakika % 1440;
        return saat >= ACILIS && saat < KAPANIS;
    }

    // 22:00: yeni müşteri alınmaz, bekleyenler uğurlanır, masadakilerin oyunu kısa sürede biter
    kapanisBaslat() {
        this.kapanisBasladi = true;
        this.kaydet('22:00 · Kapanış: yeni müşteri alınmıyor, son siparişler', 'uyari');
        for (const g of [...this.gruplar]) {
            if (['GELIYOR', 'DISARIDA', 'MASA_BEKLIYOR'].includes(g.durum)) {
                this.gun.kapanistaDonen += g.kisi;
                this.baloncuk(g.uyeler[0], 'Kapanıyormuş, yarın geliriz', 4);
                this.disKuyruktanCikar(g);
                this.beklemeYeriBirak(g);
                if (g.masa) { g.masa.grup = null; g.masa = null; }
                this.cikisaYolla(g);
            } else if (g.durum === 'OYNUYOR') {
                g.oyunBitis = Math.min(g.oyunBitis, this.dakika + rastgele(2, 6));
            } else if (['OYUN_SECIYOR', 'SIRADA', 'IZLIYOR'].includes(g.durum) && g.oturumId && !g.mesgul) {
                this.baloncuk(g.uyeler[0], 'Hesabı isteyelim');
                this.hesabaGec(g);
            }
        }
    }

    // Kapanıştan uzun süre sonra hâlâ içeride olanlar (takılan grup kalmasın)
    herkesiUgurla() {
        for (const g of [...this.gruplar]) {
            if (g.mesgul) continue;
            if (['OYUN_SECIYOR', 'SIRADA', 'OYNUYOR', 'IZLIYOR'].includes(g.durum) && g.oturumId) this.hesabaGec(g);
            else if (!['HESAP', 'ODUYOR', 'CIKIYOR'].includes(g.durum)) this.cikisaYolla(g);
        }
        if ((this.dakika % 1440) >= SON_CIKIS + 10) {        // yolda kalanlar
            for (const g of [...this.gruplar]) if (g.durum === 'CIKIYOR') this.gruplar.splice(this.gruplar.indexOf(g), 1);
        }
    }

    // Son müşteri çıkınca: gün sonu fişi verisi veritabanından (fn_donem_ozeti) alınır, simülasyon durur
    async gunuKapat() {
        this.gunSonuBekleniyor = true;
        this.calisiyor = false;
        const t = this.takvim();
        let ozet = null;
        try {
            ozet = await al(`/raporlar/donem?bas=${encodeURIComponent(this.gun.baslangic)}`);
        } catch (e) {
            this.kaydet(`Gün sonu raporu alınamadı: ${e.message}`, 'uyari');
        }
        this.gunSonu = {
            takvim: t, tarih: new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }),
            kapanisSaati: this.saatMetni(), db: ozet, gun: { ...this.gun },
            garsonlar: this.garsonlar.map((w) => ({ ad: w.ad, kat: w.ev.kat, servis: w.gunluk })),
        };
        this.gunSonuBekleniyor = false;
        this.kaydet('Gün sonu fişi hazır', 'para');
    }

    // Açılışta stoğu azalan ürünler tamamlanır (yönetici adına sp_stok_ekle; kayıtlar veritabanında)
    async sabahTedariki() {
        try {
            const urunler = await al('/yonetim/urunler');
            const eksik = urunler.filter((u) => u.aktif && u.stok < Math.max(40, u.kritik_stok * 4));
            await Promise.all(eksik.map((u) => gonder(`/yonetim/urunler/${u.id}/stok`, { adet: Math.max(40, u.kritik_stok * 4) * 2 - u.stok })));
            if (eksik.length) this.kaydet(`Sabah tedariki: ${eksik.length} ürünün stoğu tamamlandı`, 'bilgi');
            this.menu = await al('/menu');
        } catch (e) {
            this.kaydet(`Sabah tedariki yapılamadı: ${e.message}`, 'uyari');
        }
    }

    // Ertesi gün 10:00
    yeniGun() {
        this.dakika = (Math.floor(this.dakika / 1440) + 1) * 1440 + ACILIS;
        this.sonrakiGelis = this.dakika + 1;
        this.gun = this.yeniGunSayaci();
        this.gunSonu = null;
        this.kapanisBasladi = false;
        for (const w of this.garsonlar) w.gunluk = 0;
        this.gunOyunlari = {};
        this.calisiyor = true;
        this.kaydet(`${this.takvim().gun}. gün · 10:00 · Karavana açıldı`, 'bilgi');
        this.sabahTedariki();
    }

    // Veritabanıyla eşitleme (gerçek zamanlı aralıklar; hızdan bağımsız)
    esitle(dtSn) {
        const z = this.zamanlayicilar;
        for (const k of Object.keys(z)) z[k] -= dtSn;
        if (z.masa <= 0) {
            z.masa = 2;
            const no = ++this.esitlemeSayac;
            al('/masalar').then((m) => this.masaGuncelle(m, no)).catch((e) => this.kaydet(e.message, 'uyari'));
        }
        if (z.oyun <= 0) { z.oyun = 3; al('/oyunlar').then((o) => { this.oyunlar = o; }).catch(() => {}); }
        if (z.menu <= 0) { z.menu = 8; al('/menu').then((m) => { this.menu = m; }).catch(() => {}); }
        if (z.ciro <= 0) {
            z.ciro = 5;
            Promise.all([al(`/raporlar/donem?bas=${encodeURIComponent(this.gun.baslangic)}`), al('/hesaplar'), al('/raporlar/personel-performans')]).then(([g, h, p]) => {
                this.ciro = { bugun: g?.ciro || 0, nakit: g?.nakit || 0, kart: g?.kart || 0, acik: h.reduce((t, x) => t + x.toplam, 0) };
                this.dbSiparis = Object.fromEntries(p.map((x) => [x.personel_id, x.siparis_sayisi]));
            }).catch(() => {});
        }
    }

    masaGuncelle(satirlar, no) {
        for (const s of satirlar) {
            const m = this.masalar.find((x) => x.masaId === s.masa_id);
            if (!m) continue;
            m.db = s;
            const g = m.grup;
            // Bu eşitleme, grubun son işleminden önce başladıysa eski veridir: atla
            if (g && (g.mesgul || no <= g.sonIslemEsitleme)) continue;
            if (g && g.oturumId && ['OYUN_SECIYOR', 'OYNUYOR', 'SIRADA', 'IZLIYOR'].includes(g.durum)) {
                if (s.oturum_id !== g.oturumId) {                      // hesap dışarıdan kapatıldı
                    this.kaydet(`Masa ${m.masaNo}: hesap personel tarafından kapatıldı`, 'bilgi');
                    this.ayril(g, { odendi: true });
                    continue;
                }
                if (s.oturum_oyun_id && g.oturumOyunId !== s.oturum_oyun_id) {   // oyun dışarıdan başlatıldı
                    g.oturumOyunId = s.oturum_oyun_id;
                    g.oyun = this.oyunBilgisi(s.oyun_id, s.oynanan_oyun);
                    g.durum = 'OYNUYOR';
                    g.oyunBitis = this.dakika + rastgele(20, 50);
                }
                if (!s.oturum_oyun_id && g.durum === 'OYNUYOR') {            // oyun dışarıdan iade edildi
                    g.oturumOyunId = null; g.oyun = null; g.durum = 'OYUN_SECIYOR';
                }
                if (g.durum === 'SIRADA') g.hakVar = s.bekleme_durumu === 'SECIM_HAKKI';
            }
            // Personelin arayüzden açtığı masa: simülasyon devralır
            if (!m.grup && s.durum === 'DOLU' && s.oturum_id) this.devral(m, s);
        }
    }

    devral(m, s) {
        const g = this.grupOlustur(s.kisi_sayisi, 1, m.yerler[0]);
        g.masa = m; m.grup = g; m.kirli = false;
        g.oturumId = s.oturum_id;
        g.oturma = this.dakika;
        g.vip = !!s.musteri_vip;
        g.karsilayan = this.garsonlar.length ? sec(this.garsonlar) : null;
        g.uyeler.forEach((b, i) => {
            const y = m.yerler[i] || m.yerler[0];
            if (g.vip) b.palet = karakterPaleti(b.id, 'musteri', b.ogrenci, { vipUye: true });
            Object.assign(b, { kat: m.kat, gx: y.gx, gy: y.gy, yol: [] });
            this.otur(b, m);
        });
        if (s.oturum_oyun_id) {
            g.durum = 'OYNUYOR'; g.oturumOyunId = s.oturum_oyun_id;
            g.oyun = this.oyunBilgisi(s.oyun_id, s.oynanan_oyun);
            g.oyunBitis = this.dakika + rastgele(15, 50);
        } else if (s.bekleme_id) {
            g.durum = 'SIRADA'; g.beklemeId = s.bekleme_id; g.beklemeBas = this.dakika;
            g.bekledigiOyun = this.oyunBilgisi(s.beklenen_oyun_id, s.beklenen_oyun);
            g.hakVar = s.bekleme_durumu === 'SECIM_HAKKI';
        } else {
            g.durum = 'OYUN_SECIYOR';
        }
        g.sonrakiSiparis = this.dakika + rastgele(2, 8);
        this.gruplar.push(g);
    }

    // ------------------------------------------------------------------ hareket
    git(b, hedef) {
        const yol = [];
        let kat = b.kat;
        let bas = { gx: Math.round(b.gx), gy: Math.round(b.gy) };
        if (kat !== hedef.kat) {
            yol.push(...yolBul(kat, bas, ASANSOR), { katDegis: hedef.kat });
            kat = hedef.kat; bas = ASANSOR;
        }
        yol.push(...yolBul(kat, bas, hedef));
        b.yol = yol;
        b.oturuyor = false;
    }

    hareket(b, dtSn) {
        if (!b.yol.length) { b.kare = 0; return; }
        const h = b.yol[0];
        if (h.katDegis) {
            // Asansör: kapı açılır, binilir (görünmez), kısa yolculuk, hedef katta kapı açılıp inilir
            if (!b.asansor) { b.asansor = { bitis: this.dakika + 1.2 }; this.asansorKapi[b.kat] = this.zaman + 0.8; return; }
            if (this.dakika < b.asansor.bitis) return;
            b.kat = h.katDegis; b.asansor = null; this.asansorKapi[b.kat] = this.zaman + 0.8; b.yol.shift();
            return;
        }
        const dx = h.gx - b.gx, dy = h.gy - b.gy, d = Math.hypot(dx, dy);
        if (d > 0.01) { b.vx = dx; b.vy = dy; }
        const adim = b.hiz * dtSn * this.hiz;
        if (d <= adim) { b.gx = h.gx; b.gy = h.gy; b.yol.shift(); }
        else { b.gx += (dx / d) * adim; b.gy += (dy / d) * adim; }
        b.animT += dtSn * this.hiz;
        b.kare = Math.floor(b.animT * 6) % 2;
    }

    vardi = (b) => b.yol.length === 0;

    // Oturan bireyi masanın ortasına döndür
    otur(b, m) {
        b.oturuyor = true;
        b.vx = m.yuva.gx + m.yuva.gw / 2 - 0.5 - b.gx;
        b.vy = m.yuva.gy + m.yuva.gd / 2 - 0.5 - b.gy;
    }
    hepsiVardi = (g) => g.uyeler.every(this.vardi);

    baloncuk(b, metin, sure = 3.5) {
        b.baloncuk = metin;
        b.balonBitis = this.zaman + sure;
    }

    // ------------------------------------------------------------------ müşteri grupları
    grupOlustur(kisi, kat, yer, vip = false) {
        // Gelen grubun sahibi: bazen daha önce gelmiş bir müşteri (aynı üyelik türünden), çoğunlukla yeni kayıt
        const tanidik = this.musteriHavuzu.filter((m) => !!m.vip === vip);
        const eski = tanidik.length > 5 && Math.random() < 0.3;
        const musteri = eski ? sec(tanidik) : {
            ad: sec(ADLAR), soyad: sec(SOYADLAR),
            telefon: `053${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
            ogrenci: Math.random() < 0.3, vip,
        };
        if (!eski) this.musteriHavuzu.push(musteri);
        // Grupların bir kısmı öğrenci grubu (çoğu üye öğrenci); diğer gruplarda ara sıra bir öğrenci
        const ogrenciGrubu = Math.random() < 0.35;
        const ogrenciler = Array.from({ length: kisi }, () => Math.random() < (ogrenciGrubu ? 0.8 : 0.06));
        const uyeler = ogrenciler.map((ogr) => {
            const b = yeniBirey('musteri', kat, yer.gx, yer.gy);
            b.ogrenci = ogr;
            b.palet = karakterPaleti(b.id, 'musteri', ogr, vip ? { vipUye: true } : {});
            return b;
        });
        const ogrenciSayisi = ogrenciler.filter(Boolean).length;
        musteri.ogrenci = ogrenciSayisi > 0;
        return {
            id: ++birimSayac, kisi, uyeler, musteri, durum: 'GELIYOR', masa: null, oturumId: null, oturumOyunId: null,
            beklemeId: null, oyun: null, bekledigiOyun: null, oyunBitis: 0, memnuniyet: 70, gelis: this.dakika,
            masaBeklemeBas: null, sonrakiSiparis: 0, siparis: null, siparisSayisi: 0, oyunSayisi: 0, mesgul: false,
            sonIslemEsitleme: 0, karsilayan: null, garson: null, hakVar: false, secZamani: null, sonrakiDeneme: 0,
            sabir: 100, sabirUyarisi: 100, ogrenciSayisi, vip, vipBeklemeBas: null, vipKatDisi: false,
            // tek başına gelip sadece etrafı izleyenler; sabah gruplarının bir kısmı oyunsuz kahvaltıya gelir
            izleyici: !vip && kisi === 1 && Math.random() < saatProfili(this.dakika).izleyici,
            kahvalti: kisi > 1 && Math.random() < saatProfili(this.dakika).kahvalti,
        };
    }

    gelisPlanla() {
        const p = Math.max(this.populerlik, 10);
        this.sonrakiGelis = this.dakika + rastgele(3, 6) * (80 / (p + 20));
        // Bekleme alanı doluyken kapıda yığılma olmasın
        const prf = saatProfili(this.dakika);
        // saatlik eğri: geliş aralığı geliş çarpanıyla kısalır (pikte 2,6 kat sık)
        this.sonrakiGelis = this.dakika + (this.sonrakiGelis - this.dakika) / prf.gelis;
        const disarida = this.disKuyruk.reduce((t, g) => t + g.kisi, 0);
        if (this.gruplar.length >= this.masalar.length + 14 || disarida >= DIS_SIRA.length) return;
        // öğleden sonra her zaman birkaç masa boş kalsın
        if (prf.bosMasa && this.masalar.filter((m) => !m.grup && !m.kirli).length <= prf.bosMasa) return;
        const b = prf.buyukGrup;
        // VIP grupları 2–8 kişi (kulübün 8'lik masaları); standart gruplar VIP katı dışındaki en büyük masaya sığar
        const vip = Math.random() < VIP_GRUP_ORANI && this.masalar.some((m) => m.kat === VIP_KAT);
        const kisi = agirlikliSec([1, 2, 3, 4, 5, 6, 7, 8].filter((k) => (vip ? k >= 2 : k <= this.standartKapasite)),
            (k) => ({ 1: 2.5 / b, 2: 5, 3: 4 * b, 4: 5 * b, 5: 2 * b, 6: 2 * b, 7: 0.6 * b, 8: 0.6 * b }[k]));
        const g = this.grupOlustur(kisi, 1, SOKAK_GIRIS, vip);
        this.gruplar.push(g);
        this.gun.gelenGrup++;
        this.gun.gelenKisi += kisi;
        this.gun.ogrenciKisi += g.ogrenciSayisi;
        // Sokağın sağından yürüyerek gelir, kapı önünde karar verir
        g.uyeler.forEach((b, i) => { b.gx = SOKAK_GIRIS.gx + i * 0.6; b.gy = SOKAK_GIRIS.gy; this.git(b, { kat: 1, ...KAPI }); });
        this.kaydet(`${kisi} kişilik ${vip ? 'VIP ' : ''}grup geldi (${g.musteri.ad} ${g.musteri.soyad})`, 'bilgi');
    }

    // VIP Kulüp'ün grubu alabilecek boş masaları
    vipMasalari(g) {
        return this.masalar.filter((m) => m.kat === VIP_KAT && !m.grup && !m.kirli && m.db?.durum === 'BOS' && m.kapasite >= g.kisi);
    }

    masaAyir(g) {
        const tercihKat = g.vip ? VIP_KAT : g.kisi >= 3 ? 2 : 1;
        // VIP katına yalnızca VIP grup (veritabanı tetikleyicisi de reddeder); VIP grup önce kulübü dener,
        // kulüp doluysa VIP_BEKLEME_DK bekler, sonra alt katlarda standart masaya razı olur
        let adaylar = this.masalar.filter((m) => !m.grup && !m.kirli && m.db?.durum === 'BOS' && m.kapasite >= g.kisi && (g.vip || m.kat !== VIP_KAT));
        if (g.vip) {
            const kulup = adaylar.filter((m) => m.kat === VIP_KAT);
            if (kulup.length) adaylar = kulup;
            else {
                g.vipBeklemeBas ??= this.dakika;
                if (this.dakika - g.vipBeklemeBas < VIP_BEKLEME_DK) return null;
                if (adaylar.length && !g.vipKatDisi) {
                    g.vipKatDisi = true;
                    this.baloncuk(g.uyeler[0], 'Kulüp dolu, aşağıda oturalım');
                    this.kaydet(`VIP Kulüp dolu: ${g.musteri.ad} ${g.musteri.soyad} grubu alt kata geçti`, 'uyari');
                }
            }
        }
        if (!adaylar.length) return null;
        adaylar.sort((a, b) => (a.kapasite - g.kisi + (a.kat !== tercihKat) * 2) - (b.kapasite - g.kisi + (b.kat !== tercihKat) * 2));
        const m = adaylar[0];
        m.grup = g; g.masa = m;
        if (m.kat === VIP_KAT && this.host) this.baloncuk(this.host, sec(['Kulübe hoş geldiniz', 'Masanız hazır', 'İyi oyunlar efendim']), 3);
        this.beklemeYeriBirak(g);
        this.disKuyruktanCikar(g);
        g.uyeler.forEach((b, i) => this.git(b, { kat: m.kat, ...m.yerler[i] }));
        g.durum = 'MASAYA_GIDIYOR';
        return m;
    }

    // Kaldırım kuyruğu: kapıya en yakın yerden başlayarak gruplar sırayla dizilir
    disSirayaAl(g) {
        const dolu = this.disKuyruk.reduce((t, x) => t + x.kisi, 0);
        if (dolu + g.kisi > DIS_SIRA.length) return false;
        this.disKuyruk.push(g);
        g.durum = 'DISARIDA';
        this.disSiraDuzenle();
        return true;
    }

    disKuyruktanCikar(g) {
        const i = this.disKuyruk.indexOf(g);
        if (i < 0) return;
        this.disKuyruk.splice(i, 1);
        this.disSiraDuzenle();
    }

    disSiraDuzenle() {
        let i = 0;
        for (const g of this.disKuyruk) for (const b of g.uyeler) {
            const y = DIS_SIRA[i++];
            if (b.hedefSira !== y) { b.hedefSira = y; this.git(b, { kat: 1, ...y }); }
        }
    }

    beklemeYeriBirak(g) {
        for (const y of this.beklemeYerleri) if (g.uyeler.includes(y.birey)) y.birey = null;
    }

    beklemeAlaninaAl(g) {
        const bos = this.beklemeYerleri.filter((y) => !y.birey);
        if (bos.length < g.kisi) return false;
        g.uyeler.forEach((b, i) => { bos[i].birey = b; this.git(b, { kat: 1, gx: bos[i].gx, gy: bos[i].gy }); });
        g.durum = 'MASA_BEKLIYOR';
        g.masaBeklemeBas = this.dakika;
        return true;
    }

    async api(g, fn) {
        g.mesgul = true;
        try {
            return await fn();
        } finally {
            g.mesgul = false;
            g.sonIslemEsitleme = this.esitlemeSayac;
        }
    }

    // Hangi beklemenin içinde (yoksa null): masa, sipariş, oyun
    beklemeTuru(g) {
        if (g.durum === 'DISARIDA' || g.durum === 'MASA_BEKLIYOR') return 'masa';
        if (g.siparis && this.dakika - g.siparis.zaman > SABIR.siparisToleransDk) return 'siparis';
        if (g.durum === 'SIRADA') return 'oyun';
        return null;
    }

    sabirGuncelle(g, dk) {
        const tur = this.beklemeTuru(g);
        if (tur) g.sabir -= dk * SABIR[tur] * (g.vip ? SABIR.vipCarpan : 1);
        else if (g.durum === 'OYNUYOR' || g.durum === 'IZLIYOR') g.sabir += dk * SABIR.toparlanma;
        g.sabir = Math.max(0, Math.min(100, g.sabir));
        // Eşik geçişlerinde sabırsızlık cümlesi
        for (const esik of [40, 20]) {
            if (g.sabir < esik && g.sabirUyarisi >= esik && tur) { this.baloncuk(g.uyeler[0], sabirsizCumle(tur), 4); }
        }
        g.sabirUyarisi = g.sabir;
        if (g.sabir <= 0 && tur && !g.terk) this.terket(g, tur);
    }

    // Öfkeyle terk: servis edilmemiş siparişler iptal edilir (stok geri döner), masadaysa hesap kapatılır
    async terket(g, tur) {
        g.terk = true;
        this.terkSayisi++;
        this.gun.terkGrup++;
        this.gun.terkKisi += g.kisi;
        this.baloncuk(g.uyeler[0], TERK_CUMLESI, 5);
        this.populerlik = Math.max(0, this.populerlik - 3);
        this.populerlikGuncelle(0);
        const yer = g.masa ? `Masa ${g.masa.masaNo}` : `${g.kisi} kişilik grup`;
        this.kaydet(`${yer} çok bekledi (${{ masa: 'masa', siparis: 'servis', oyun: 'oyun' }[tur]}), kafeyi terk etti`, 'uyari');
        if (!g.oturumId) {
            this.disKuyruktanCikar(g);
            this.beklemeYeriBirak(g);
            if (g.masa) { g.masa.grup = null; g.masa = null; }
            this.cikisaYolla(g);
            return;
        }
        const idler = g.siparis?.durum === 'ALINDI' ? g.siparis.idler || [] : [];
        if (idler.length) {
            try {
                await this.api(g, () => Promise.all(idler.map((id) => this.garsonApi(g).sil(`/siparisler/${id}`))));
                this.kaydet(`Masa ${g.masa.masaNo}: servis edilmemiş ${idler.length} sipariş iptal edildi`, 'uyari');
            } catch (e) {
                this.kaydet(`Masa ${g.masa.masaNo} sipariş iptali: ${e.message}`, 'uyari');
            }
        }
        g.memnuniyet = 0;
        this.hesabaGec(g);
    }

    grupAdim(g, dk) {
        for (const b of g.uyeler) if (b.baloncuk && this.zaman > b.balonBitis) b.baloncuk = null;
        if (g.mesgul) return;
        const lider = g.uyeler[0];
        const masaNo = g.masa?.masaNo;
        if (!['GELIYOR', 'MASAYA_GIDIYOR', 'MASA_ACILIYOR', 'HESAP', 'ODUYOR', 'CIKIYOR'].includes(g.durum)) {
            this.sabirGuncelle(g, dk);
            if (g.terk) return;
        }

        switch (g.durum) {
            case 'GELIYOR':
                if (!this.vardi(lider)) return;
                // Sırada bekleyen varsa önce onlar: yeni gelen doğrudan kuyruğun sonuna. VIP üye, kulüpte yer varsa
                // kuyruğu beklemeden doğrudan VIP Kulüp'e çıkar.
                if (g.vip && this.vipMasalari(g).length && this.masaAyir(g)) { this.baloncuk(lider, 'VIP Kulüp lütfen'); return; }
                if (!this.disKuyruk.length && this.masaAyir(g)) return;
                if (!this.disKuyruk.length && this.beklemeAlaninaAl(g)) { this.baloncuk(lider, 'Masa yok mu?'); return; }
                if (this.disSirayaAl(g)) {
                    this.baloncuk(lider, 'Sıra varmış…');
                    this.kaydet(`İçerisi dolu: ${g.kisi} kişi kapının önünde sıraya girdi`, 'uyari');
                    return;
                }
                this.kaydet(`${g.kisi} kişilik grup kuyruk çok uzun diye gitti`, 'uyari');
                this.gun.yerBulamayan += g.kisi;
                this.baloncuk(lider, 'Çok kalabalık…');
                this.populerlikGuncelle(25);
                this.cikisaYolla(g);
                return;

            case 'DISARIDA':
                // Yalnızca kuyruğun başındaki grup içeri girebilir: boş masa varsa masaya, yoksa bekleme alanına
                if (this.disKuyruk[0] !== g || !this.hepsiVardi(g)) return;
                if (this.masaAyir(g)) { this.baloncuk(lider, 'Sıra bizde!'); return; }
                if (this.beklemeAlaninaAl(g)) { this.disKuyruktanCikar(g); this.baloncuk(lider, 'İçeri geçelim'); }
                return;

            case 'MASA_BEKLIYOR':
                // Gruplar geliş sırasıyla denenir: önce gelen, sığdığı ilk boş masayı alır
                if (this.masaAyir(g)) { this.baloncuk(lider, 'Sonunda!'); return; }
                return;

            case 'MASAYA_GIDIYOR':
                if (!this.hepsiVardi(g)) return;
                g.durum = 'MASA_ACILIYOR';
                this.masaAc(g);
                return;

            case 'OYUN_SECIYOR':
                if (this.dakika < g.sonrakiDeneme) return;
                this.oyunSec(g);
                this.siparisKontrol(g);
                return;

            case 'SIRADA':
                this.siparisKontrol(g);
                g.memnuniyet -= dk * 0.08;
                if (g.hakVar && g.secZamani == null) g.secZamani = this.dakika + rastgele(0.5, 2);
                if (g.secZamani != null && this.dakika >= g.secZamani) { g.secZamani = null; this.sirayiKullan(g); return; }
                if (this.dakika - g.beklemeBas > 35 && !g.hakVar) {
                    this.baloncuk(lider, 'Başka oyun seçelim');
                    this.api(g, () => this.garsonApi(g).sil(`/bekleme/${g.beklemeId}`))
                        .then(() => { g.beklemeId = null; g.reddedilen = g.bekledigiOyun?.id; g.durum = 'OYUN_SECIYOR'; })
                        .catch((e) => this.kaydet(`Masa ${masaNo}: ${e.message}`, 'uyari'));
                }
                return;

            case 'IZLIYOR':
                g.memnuniyet = Math.min(100, g.memnuniyet + dk * 0.2);
                this.siparisKontrol(g);
                if (Math.random() < dk * 0.05) this.izlenecekYon(g);
                if (Math.random() < dk * 0.02) this.baloncuk(lider, g.kahvalti ? sec(['Kahvaltı harika', 'Bir çay daha?', 'Menemen nefis', 'Simitler taze', 'Serpme kahvaltı efsane']) : izleyiciCumlesi());
                if (this.dakika >= g.izlemeBitis) this.hesabaGec(g);
                return;

            case 'OYNUYOR':
                g.memnuniyet = Math.min(100, g.memnuniyet + dk * 0.25);
                this.siparisKontrol(g);
                if (Math.random() < dk * 0.05) this.baloncuk(sec(g.uyeler), g.masa?.kat === VIP_KAT && this.acikMi() && Math.random() < 0.3 ? dinleyiciCumlesi() : oyunCumlesi(g.oyun?.ad));
                if (this.dakika >= g.oyunBitis) this.oyunBitir(g);
                return;

            case 'HESAP':
                if (!this.vardi(lider)) return;
                g.durum = 'ODUYOR';
                this.ode(g);
                return;

            case 'CIKIYOR':
                if (!this.hepsiVardi(g)) return;
                for (const b of g.uyeler) if (b.kat === 1) this.cikanlar.push({ gx: b.gx, palet: b.palet });
                this.gruplar.splice(this.gruplar.indexOf(g), 1);
                return;
            default:
        }
    }

    // Grubun karşılayan garsonu adına (yoksa yönetici olarak) istek
    garsonApi(g) {
        return adina(g.karsilayan?.personel.id);
    }

    // VIP üyenin müşteri kaydı ve üyeliği: kayıt garson adına (sp_musteri_kaydet), haftalık üyelik ücreti kasa prosedürüyle (sp_vip_uyelik_ode; üyeliği de başlatır).
    // Simülasyonu yönetici çalıştırır; üyelik verilemezse grup standart müşteri olarak devam eder.
    async vipUyelik(g) {
        const mu = g.musteri;
        if (!mu.kullaniciId) {
            const { ad, soyad, telefon, ogrenci } = mu;
            mu.kullaniciId = (await this.garsonApi(g).gonder('/musteriler', { ad, soyad, telefon, ogrenci })).kullaniciId;
        }
        if (!mu.vipVerildi) {
            const odeme = await gonder(`/musteriler/${mu.kullaniciId}/vip-odeme`, { odemeTuru: Math.random() < 0.7 ? 'KART' : 'NAKIT' });
            mu.vipVerildi = true;
            this.kaydet(`${mu.ad} ${mu.soyad} VIP Kulüp haftalık üyelik ücretini ödedi (${Number(odeme.tutar).toLocaleString('tr-TR')} TL)`, 'para');
        }
    }

    async masaAc(g) {
        const m = g.masa;
        g.karsilayan = (m.kat === VIP_KAT && this.garsonlar.find((w) => w.ev.kat === VIP_KAT)) || (this.garsonlar.length ? sec(this.garsonlar) : null);
        try {
            const r = await this.api(g, async () => {
                if (g.vip) await this.vipUyelik(g);
                const govde = { kisiSayisi: g.kisi, ogrenciSayisi: g.ogrenciSayisi };
                if (g.musteri.kullaniciId) govde.kullaniciId = g.musteri.kullaniciId; else govde.musteri = g.musteri;
                return this.garsonApi(g).gonder(`/masalar/${m.masaId}/ac`, govde);
            });
            g.musteri.kullaniciId = r.kullaniciId;
            g.oturumId = r.oturumId;
            g.oturma = this.dakika;
            g.uyeler.forEach((b) => this.otur(b, m));
            g.durum = 'OYUN_SECIYOR';
            if (g.izleyici || g.kahvalti) this.izlemeyeBasla(g);
            g.sonrakiSiparis = this.dakika + rastgele(2, 6);
            this.kaydet(`Masa ${m.masaNo} açıldı: ${g.kisi} kişi${g.karsilayan ? ` · karşılayan ${g.karsilayan.ad}` : ''}`, 'bilgi');
        } catch (e) {
            this.kaydet(`Masa ${m.masaNo} açılamadı: ${e.message}`, 'uyari');
            if (g.vip && !g.musteri.vipVerildi) {          // üyelik verilemedi (ör. yönetici değil): standart grup
                g.vip = false; g.musteri.vip = false;
                for (const b of g.uyeler) b.palet = karakterPaleti(b.id, 'musteri', b.ogrenci);
            }
            m.grup = null; g.masa = null;
            if (!this.beklemeAlaninaAl(g)) this.cikisaYolla(g);
        }
    }

    // İzleyici: oyun oynamaz, bir şeyler içip oynayanları izler, sonra kalkar
    izlemeyeBasla(g) {
        g.izleyici = !g.kahvalti;
        g.oyun = null;
        g.durum = 'IZLIYOR';
        g.izlemeBitis = this.dakika + (g.kahvalti ? rastgele(25, 50) : rastgele(30, 70));
        g.sonrakiSiparis = this.dakika + rastgele(1, 3);
        this.baloncuk(g.uyeler[0], g.kahvalti ? sec(['Kahvaltı zamanı!', 'Önce bir kahve', 'Ne yesek?']) : 'Biraz izleyeyim', 3);
    }

    // İzleyici en yakın oyun oynanan masaya döner
    izlenecekYon(g) {
        const b = g.uyeler[0];
        let en = null, enMesafe = Infinity;
        for (const m of this.masalar) {
            if (m.kat !== b.kat || m === g.masa || m.grup?.durum !== 'OYNUYOR') continue;
            const dx = m.yuva.gx + m.yuva.gw / 2 - b.gx, dy = m.yuva.gy + m.yuva.gd / 2 - b.gy;
            const u = dx * dx + dy * dy;
            if (u < enMesafe) { enMesafe = u; en = { dx, dy }; }
        }
        if (en) { b.vx = en.dx; b.vy = en.dy; }
    }

    oyunBilgisi(id, ad) {
        const o = this.oyunlar.find((x) => x.oyun_id === id);
        return { id, ad: ad || o?.ad || 'Oyun', renk: OYUN_RENK[(id || 0) % OYUN_RENK.length], sure: o?.sure_dk || 45 };
    }

    oyunSec(g) {
        // VIP oyunları yalnızca VIP gruplar görür (veritabanı tetikleyicisi son güvence)
        const uygun = this.oyunlar.filter((o) => g.kisi >= o.min_oyuncu && g.kisi <= o.max_oyuncu && o.oyun_id !== g.reddedilen && (g.vip || !o.vip_ozel));
        if (!uygun.length) return this.izlemeyeBasla(g);   // uygun oyun yoksa etrafı izler
        // VIP grup çoğunlukla koleksiyondan (tek kopya) rafta olan bir VIP oyun ister
        const vipRafta = g.vip ? uygun.filter((o) => o.vip_ozel && o.alinabilir_adet > 0) : [];
        if (vipRafta.length && Math.random() < VIP_OYUN_OLASILIGI) return this.oyunBaslat(g, agirlikliSec(vipRafta, (o) => o.talep || 5));
        // Talep ağırlıklı seçim (popüler oyunlar daha sık istenir); katın konseptine uyan kategoriler 2 kat
        const tercih = KAT_TERCIHI[g.masa.kat] || [];
        const istenen = agirlikliSec(uygun, (o) => (o.talep || 5) * (tercih.includes(o.kategori) ? 2 : 1));
        if (istenen.alinabilir_adet > 0) return this.oyunBaslat(g, istenen);
        const alternatif = uygun.filter((o) => o.alinabilir_adet > 0);
        if (Math.random() < 0.55 || !alternatif.length) return this.siraya(g, istenen);
        return this.oyunBaslat(g, sec(alternatif));
    }

    async oyunBaslat(g, o) {
        try {
            const r = await this.api(g, () => this.garsonApi(g).gonder(`/oturumlar/${g.oturumId}/oyun`, { oyunId: o.oyun_id }));
            g.oturumOyunId = r.oturumOyunId;
            g.oyun = this.oyunBilgisi(o.oyun_id, o.ad);
            g.durum = 'OYNUYOR';
            g.oyunSayisi++;
            g.oyunBitis = this.dakika + o.sure_dk * rastgele(0.6, 1.0) * (g.vip ? 1.4 : 1);
            this.gunOyunlari[o.ad] = (this.gunOyunlari[o.ad] || 0) + 1;
            this.baloncuk(g.uyeler[0], `${o.ad}!`);
            this.kaydet(`Masa ${g.masa.masaNo}: ${o.ad} başladı`, 'bilgi');
        } catch (e) {
            g.sonrakiDeneme = this.dakika + 1;    // kopya başkasına gittiyse yeniden seçer
            this.kaydet(`Masa ${g.masa.masaNo}: ${e.message}`, 'uyari');
        }
    }

    async siraya(g, o) {
        try {
            const r = await this.api(g, () => this.garsonApi(g).gonder(`/oturumlar/${g.oturumId}/bekleme`, { oyunId: o.oyun_id }));
            g.beklemeId = r.beklemeId;
            g.bekledigiOyun = this.oyunBilgisi(o.oyun_id, o.ad);
            g.durum = 'SIRADA'; g.beklemeBas = this.dakika; g.hakVar = false;
            this.baloncuk(g.uyeler[0], `${o.ad} bekliyoruz`);
            this.kaydet(`Masa ${g.masa.masaNo}: ${o.ad} dolu, sıraya girdi`, 'bilgi');
        } catch (e) {
            if (/müsait/.test(e.message)) return this.oyunBaslat(g, o);
            g.sonrakiDeneme = this.dakika + 1;
            this.kaydet(`Masa ${g.masa.masaNo}: ${e.message}`, 'uyari');
        }
    }

    async sirayiKullan(g) {
        try {
            const r = await this.api(g, () => this.garsonApi(g).gonder(`/bekleme/${g.beklemeId}/sec`));
            g.oturumOyunId = r.oturumOyunId;
            g.oyun = g.bekledigiOyun;
            g.durum = 'OYNUYOR'; g.oyunSayisi++; g.beklemeId = null;
            g.oyunBitis = this.dakika + g.oyun.sure * rastgele(0.6, 1.0) * (g.vip ? 1.4 : 1);
            this.gunOyunlari[g.oyun.ad] = (this.gunOyunlari[g.oyun.ad] || 0) + 1;
            g.memnuniyet = Math.min(100, g.memnuniyet + 8);
            this.baloncuk(g.uyeler[0], 'Sıra bizde!');
            this.kaydet(`Masa ${g.masa.masaNo}: sırası geldi, ${g.oyun.ad} aldı`, 'bilgi');
        } catch (e) {
            g.hakVar = false;
            this.kaydet(`Masa ${g.masa.masaNo}: ${e.message}`, 'uyari');
        }
    }

    async oyunBitir(g) {
        try {
            if (g.oturumOyunId) await this.api(g, () => this.garsonApi(g).gonder(`/oturum-oyunlar/${g.oturumOyunId}/bitir`));
        } catch (e) {
            this.kaydet(`Masa ${g.masa.masaNo}: ${e.message}`, 'uyari');
        }
        g.oturumOyunId = null;
        const ad = g.oyun?.ad;
        g.oyun = null;
        if (ad && !this.kapanisBasladi && g.oyunSayisi < (g.vip ? 3 : 2) && Math.random() < (g.vip ? 0.6 : 0.35)) {
            g.durum = 'OYUN_SECIYOR';
            this.baloncuk(g.uyeler[0], 'Bir oyun daha!');
            return;
        }
        this.hesabaGec(g);
    }

    hesabaGec(g) {
        // Alınmamış siparişi iptal et; yoldaki sipariş garson tarafından bırakılır
        this.gorevler = this.gorevler.filter((t) => t.grup !== g);
        g.siparis = null;
        g.durum = 'HESAP';
        g.masa.kirli = true;
        const kasa = KATLAR[1].kasa;
        g.uyeler.forEach((b, i) => this.git(b, { kat: 1, gx: kasa.gx + (i % 3), gy: kasa.gy + Math.floor(i / 3) % 3 }));
    }

    async ode(g) {
        const m = g.masa;
        const tur = Math.random() < 0.4 ? 'NAKIT' : 'KART';
        try {
            const r = await this.api(g, () => adina(this.kasiyerPersonel?.id).gonder(`/oturumlar/${g.oturumId}/kapat`, { odemeTuru: tur }));
            const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(r.toplam);
            this.baloncuk(g.uyeler[0], g.terk ? `${tl} · Bir daha gelmeyiz!` : g.memnuniyet >= 60 ? `${tl} · Yine geleceğiz!` : `${tl} · Fena değil`, 4);
            this.kaydet(`Masa ${m.masaNo} ödedi: ${tl} (${tur === 'NAKIT' ? 'nakit' : 'kart'})`, 'para');
        } catch (e) {
            this.kaydet(`Masa ${m.masaNo} ödeme: ${e.message}`, 'uyari');
        }
        this.ayril(g, { odendi: true });
    }

    ayril(g, { odendi }) {
        const m = g.masa;
        if (m) { m.grup = null; m.kirli = true; this.gorevler.push({ tur: 'temizlik', masa: m, zaman: this.dakika }); }
        this.gorevler = this.gorevler.filter((t) => t.grup !== g);
        g.siparis = null;
        if (odendi) this.populerlikGuncelle(g.memnuniyet);
        this.cikisaYolla(g);
    }

    cikisaYolla(g) {
        g.durum = 'CIKIYOR';
        g.uyeler.forEach((b) => this.git(b, { kat: 1, ...SOKAK_CIKIS }));
    }

    populerlikGuncelle(memnuniyet) {
        this.populerlik = Math.max(0, Math.min(100, this.populerlik * 0.9 + memnuniyet * 0.1));
    }

    // ------------------------------------------------------------------ siparişler
    siparisKontrol(g) {
        if (!g.oturumId || g.siparis || g.siparisSayisi >= (g.vip ? 6 : 3) || this.dakika < g.sonrakiSiparis) return;
        if (this.kapanisBasladi) return;                     // son siparişler alındı
        const menu = this.menu.filter((u) => u.stok > 0);
        if (!menu.length) return;
        const yemek = saatProfili(this.dakika).yemek * (g.kahvalti ? 1.5 : 1);
        // Kahvaltı yalnızca sabah dilimlerinde (13:00'e kadar) istenir, kahvaltıya gelenler için çok ağır basar
        const sabah = (this.dakika % 1440) < 14 * 60;
        const agirlik = (u) => /Kahvaltı/.test(u.kategori) ? (sabah ? (g.kahvalti ? 8 : 3) : 0.05)
            : /Sıcak/.test(u.kategori) ? 3 : /Soğuk/.test(u.kategori) ? 2
            : /Yemek|Atıştırmalık|Yiyecek/.test(u.kategori) ? (g.masa.kat > 1 ? Math.max(2.5, yemek) : yemek) : 1;
        const kalemler = [];
        // VIP gruplar daha çok ve daha bol sipariş verir
        for (let i = 0; i < Math.ceil(g.kisi / (g.vip ? 1.5 : 2)); i++) {
            const u = agirlikliSec(menu, agirlik);
            const var_ = kalemler.find((k) => k.urunId === u.urun_id);
            if (var_) var_.adet++; else kalemler.push({ urunId: u.urun_id, adet: tamRastgele(1, g.vip ? 3 : 2), ad: u.ad, kategori: u.kategori });
        }
        g.siparis = { kalemler, durum: 'ISTENDI', zaman: this.dakika };
        this.baloncuk(g.uyeler[0], siparisCumlesi(kalemler), 5);
        this.gorevler.push({ tur: 'siparis', grup: g, masa: g.masa, zaman: this.dakika });
    }

    // ------------------------------------------------------------------ garsonlar
    garsonAdim(w) {
        if (w.mesgul) return;
        const b = w.birey;
        const t = w.gorev;
        const g = t?.grup;
        const grupGitti = t?.tur === 'siparis' && (!this.gruplar.includes(g) || g.masa !== t.masa || !['OYUN_SECIYOR', 'OYNUYOR', 'SIRADA', 'IZLIYOR'].includes(g.durum));

        switch (w.durum) {
            case 'BOSTA': {
                if (!this.gorevler.length) {
                    if (this.vardi(b) && (b.kat !== w.ev.kat || Math.round(b.gx) !== w.ev.gx || Math.round(b.gy) !== w.ev.gy)) this.git(b, w.ev);
                    return;
                }
                // Önce kendi katındaki en eski görev
                // Kendi katının görevleri; o katın hiç garsonu yoksa başka kattan da yardım edilir
                const garsonluKatlar = new Set(this.garsonlar.map((x) => x.ev.kat));
                const uygun = this.gorevler.filter((t) => t.masa.kat === w.ev.kat || !garsonluKatlar.has(t.masa.kat));
                if (!uygun.length) {
                    if (this.vardi(b) && (b.kat !== w.ev.kat || Math.round(b.gx) !== w.ev.gx || Math.round(b.gy) !== w.ev.gy)) this.git(b, w.ev);
                    return;
                }
                const sirali = uygun.sort((a, c) => a.zaman - c.zaman);
                w.gorev = sirali[0];
                this.gorevler.splice(this.gorevler.indexOf(w.gorev), 1);
                w.gorev.garson = w;
                if (w.gorev.grup) w.gorev.grup.garson = w;
                this.git(b, { kat: w.gorev.masa.kat, ...w.gorev.masa.servisYeri });
                w.durum = w.gorev.tur === 'siparis' ? 'MASAYA' : 'TEMIZLIGE';
                return;
            }
            case 'MASAYA':
                if (grupGitti) return this.garsonBosalt(w);
                if (!this.vardi(b)) return;
                w.durum = 'SIPARIS_ALIYOR';
                w.bitis = this.dakika + w.stat.siparis;
                this.baloncuk(b, 'Ne alırsınız?', 2);
                return;
            case 'SIPARIS_ALIYOR':
                if (grupGitti) return this.garsonBosalt(w);
                if (this.dakika < w.bitis) return;
                this.siparisiYaz(w, g);
                return;
            case 'MUTFAGA':
                if (grupGitti) return this.garsonBosalt(w);
                if (!this.vardi(b)) return;
                w.durum = 'MUTFAK_BEKLIYOR';
                Object.assign(b, KATLAR[b.kat].servisYon || { vx: 0, vy: -1 });    // tezgâha / yemek asansörüne dön
                return;
            case 'MUTFAK_BEKLIYOR':
                if (grupGitti) return this.garsonBosalt(w);
                if (w.fis?.durum !== 'HAZIR') return;
                this.fisiKaldir(w.fis);
                w.fis = null;
                w.durum = 'SERVIS';
                this.git(b, { kat: t.masa.kat, ...t.masa.servisYeri });
                return;
            case 'BARA':
                if (!this.vardi(b)) return;
                w.durum = 'HAZIRLIYOR';
                w.bitis = this.dakika + Math.max(1, 5 - w.stat.yetenek * 0.7);
                return;
            case 'HAZIRLIYOR':
                if (this.dakika < w.bitis) return;
                if (grupGitti) return this.garsonBosalt(w);
                w.durum = 'SERVIS';
                this.git(b, { kat: t.masa.kat, ...t.masa.servisYeri });
                return;
            case 'SERVIS':
                if (grupGitti) return this.garsonBosalt(w);
                if (!this.vardi(b)) return;
                g.siparis = null;
                g.siparisSayisi++;
                g.sonrakiSiparis = this.dakika + (g.vip ? rastgele(15, 30) : rastgele(25, 50));
                g.memnuniyet = Math.min(100, g.memnuniyet + 4 + w.stat.yetenek);
                g.sonServis = { saat: this.saatMetni(), garson: w.ad };
                this.baloncuk(sec(g.uyeler), servisCumlesi());
                g.sabir = Math.min(100, g.sabir + SABIR.servis);
                w.tamamlanan++;
                w.gunluk++;
                this.kaydet(`${w.ad} → Masa ${t.masa.masaNo} servis tamam`, 'bilgi');
                this.garsonBosalt(w);
                return;
            case 'TEMIZLIGE':
                if (!this.vardi(b)) return;
                w.durum = 'TEMIZLIYOR';
                w.bitis = this.dakika + 2;
                return;
            case 'TEMIZLIYOR':
                if (this.dakika < w.bitis) return;
                t.masa.kirli = false;
                this.garsonBosalt(w);
                return;
            default:
        }
    }

    async siparisiYaz(w, g) {
        w.mesgul = true;
        const kalemler = g.siparis.kalemler.map(({ urunId, adet }) => ({ urunId, adet }));
        try {
            const r = await this.api(g, () => adina(w.personel.id).gonder(`/oturumlar/${g.oturumId}/siparisler`, { kalemler }));
            if (!g.siparis) return;              // bu arada terk ettiyse
            g.siparis.durum = 'ALINDI';
            g.siparis.idler = r.siparisIdleri;
            const yemek = g.siparis.kalemler.some(yemekMi);
            if (yemek && this.sefler.length) {
                // Yemek kat 1 mutfağına fiş olarak düşer. Kat 1'de garson mutfak tezgâhının önünde bekler; üst katlarda
                // tabak yemek asansörüyle çıkar, garson kendi katındaki servis tezgâhında bekler.
                const kat = g.masa.kat;
                w.fis = { id: ++birimSayac, grup: g, masa: g.masa, durum: 'BEKLIYOR', kalemSayisi: g.siparis.kalemler.filter(yemekMi).length, zaman: this.dakika };
                this.mutfakFisleri.push(w.fis);
                w.durum = 'MUTFAGA';
                this.git(w.birey, kat === 1 || !KATLAR[kat].servis ? { kat: 1, ...MUTFAK.alis } : { kat, ...KATLAR[kat].servis });
            } else {
                w.durum = 'BARA';
                this.git(w.birey, { kat: g.masa.kat, ...KATLAR[g.masa.kat].bar });
            }
            this.kaydet(`${w.ad} → Masa ${g.masa.masaNo}: ${g.siparis.kalemler.map((k) => `${k.adet}× ${k.ad}`).join(', ')}`, 'bilgi');
        } catch (e) {
            this.baloncuk(g.uyeler[0], 'Tükenmiş mi?!');
            g.memnuniyet -= 8;
            g.siparis = null;
            g.sonrakiSiparis = this.dakika + 10;
            this.kaydet(`Masa ${g.masa.masaNo} sipariş: ${e.message}`, 'uyari');
            this.garsonBosalt(w);
        } finally {
            w.mesgul = false;
        }
    }

    // Şef: sıradaki fişi alır, ocakta pişirir (süre kalem sayısı / hız), tabağı servis tezgahına koyar
    sefAdim(sf) {
        const b = sf.birey;
        switch (sf.durum) {
            case 'BOSTA': {
                const f = this.mutfakFisleri.find((x) => x.durum === 'BEKLIYOR' && !x.iptal);
                if (!f) {
                    if (this.vardi(b) && (Math.round(b.gx) !== sf.istasyon.gx || Math.round(b.gy) !== sf.istasyon.gy)) this.git(b, { kat: 1, ...sf.istasyon });
                    return;
                }
                if (!this.vardi(b)) return;
                f.durum = 'PISIYOR'; f.sef = sf; sf.fis = f;
                sf.durum = 'PISIRIYOR';
                sf.bitis = this.dakika + (PISIRME.sabit + f.kalemSayisi * PISIRME.kalem) / sf.hizCarpani;
                b.vx = 0; b.vy = -1;
                if (Math.random() < 0.35) this.baloncuk(b, sefCumlesi(), 2.5);
                return;
            }
            case 'PISIRIYOR':
                if (this.dakika < sf.bitis) return;
                sf.durum = 'TEZGAHA';
                this.git(b, { kat: 1, ...MUTFAK.tezgah });
                return;
            case 'TEZGAHA':
                if (!this.vardi(b)) return;
                b.vx = 0; b.vy = 1;
                if (sf.fis.iptal) this.fisiKaldir(sf.fis);
                else if (sf.fis.masa.kat !== 1 && KATLAR[sf.fis.masa.kat].servis) {
                    // üst kat siparişi: tabak yemek asansörüne konur
                    Object.assign(sf.fis, { durum: 'ASANSORDE', varis: this.dakika + YEMEK_ASANSORU_DK });
                    sf.hazirlanan++;
                    this.baloncuk(b, `Kat ${sf.fis.masa.kat}'e gidiyor!`, 1.5);
                } else { sf.fis.durum = 'HAZIR'; sf.hazirlanan++; this.baloncuk(b, 'Servis!', 1.5); }
                sf.fis = null;
                sf.durum = 'BOSTA';
                return;
            default:
        }
    }

    // Yemek asansöründeki tabaklar üst kattaki servis tezgâhına varır
    yemekAsansoruAdim() {
        for (const f of this.mutfakFisleri) if (f.durum === 'ASANSORDE' && this.dakika >= f.varis) f.durum = 'HAZIR';
    }

    fisiKaldir(f) {
        const i = this.mutfakFisleri.indexOf(f);
        if (i >= 0) this.mutfakFisleri.splice(i, 1);
    }

    // Müzik ekibi: açıkken çalar; şarkıcı ara sıra seslenir
    muzikAdim(dk) {
        if (!this.acikMi() || !this.muzisyenler.length) return;
        if (Math.random() < dk * 0.03) this.baloncuk(this.muzisyenler[0].birey, muzikCumlesi(), 3);
        for (const m of this.muzisyenler) if (m.birey.baloncuk && this.zaman > m.birey.balonBitis) m.birey.baloncuk = null;
        for (const sf of this.sefler) if (sf.birey.baloncuk && this.zaman > sf.birey.balonBitis) sf.birey.baloncuk = null;
        if (this.host?.baloncuk && this.zaman > this.host.balonBitis) this.host.baloncuk = null;
    }

    garsonBosalt(w) {
        if (w.fis) { w.fis.iptal = true; if (w.fis.durum !== 'PISIYOR') this.fisiKaldir(w.fis); w.fis = null; }
        if (w.gorev?.grup?.garson === w) w.gorev.grup.garson = null;
        w.gorev = null;
        w.durum = 'BOSTA';
    }

    // ------------------------------------------------------------------ görünüm
    kaydet(metin, tur = 'bilgi') {
        this.kayitlar.unshift({ id: ++birimSayac, saat: this.saatMetni(), metin, tur });
        if (this.kayitlar.length > 80) this.kayitlar.length = 80;
    }

    saatMetni() {
        const d = Math.floor(this.dakika % 1440);
        return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
    }

    takvim() {
        const gun = Math.floor(this.dakika / 1440);
        return { yil: Math.floor(gun / 360) + 1, ay: Math.floor((gun % 360) / 30) + 1, gun: (gun % 30) + 1, saat: this.saatMetni() };
    }

    masaDurumu(m) {
        if (m.kirli && !m.grup) return { metin: 'Temizleniyor', renk: '#8d6e63' };
        const g = m.grup;
        if (!g) return { metin: 'Boş', renk: '#4caf6a' };
        if (g.siparis?.durum === 'ISTENDI') return { metin: 'Hizmet bekliyor', renk: '#d94f3d' };
        if (g.durum === 'SIRADA') return g.hakVar ? { metin: 'Oyun ayrıldı', renk: '#e07b39' } : { metin: 'Oyun sırasında', renk: '#e3b23c' };
        if (g.durum === 'MASAYA_GIDIYOR' || g.durum === 'MASA_ACILIYOR') return { metin: 'Oturuyor', renk: '#7e8a97' };
        if (['HESAP', 'ODUYOR'].includes(g.durum)) return { metin: 'Kalkıyor', renk: '#8d6e63' };
        if (g.durum === 'IZLIYOR') return g.kahvalti ? { metin: 'Kahvaltı', renk: '#c9772a' } : { metin: 'İzleyici', renk: '#2bb0a8' };
        return { metin: 'Dolu', renk: '#3d7fd9' };
    }

    garsonDurumu(w) {
        const m = w.gorev?.masa;
        const vip = m?.kat === VIP_KAT;
        const n = m ? `${vip ? 'VIP masa' : 'Masa'} ${m.masaNo}` : '';
        const ust = m && m.kat !== 1 && KATLAR[m.kat].servis;          // yemek, yemek asansörüyle gelir
        const yemek = w.gorev?.grup?.siparis?.kalemler?.some(yemekMi);
        return {
            BOSTA: 'Boşta', MASAYA: `${n}'e gidiyor`, SIPARIS_ALIYOR: `${n} siparişi alıyor`, BARA: `${n} için bara`,
            HAZIRLIYOR: `${n} içecekleri hazırlanıyor`,
            MUTFAGA: ust ? `${n} için yemek asansörüne` : `${n} için mutfağa`,
            MUTFAK_BEKLIYOR: ust ? (w.fis?.durum === 'ASANSORDE' ? `${n} tabağı asansörde, geliyor` : `Yemek asansöründe ${n} tabağını bekliyor`) : `Mutfakta ${n} yemeğini bekliyor`,
            SERVIS: yemek ? `${n}'e yemek servisi` : `${n}'e servis`, TEMIZLIGE: `${n} temizliğe`, TEMIZLIYOR: `${n} temizleniyor`,
        }[w.durum];
    }

    sahne(kat, seciliMasaId, d = 0) {
        const masalar = this.masalar.filter((m) => m.kat === kat).map((m) => ({
            ...m, durumRenk: this.masaDurumu(m).renk, oyunRenk: m.grup?.oyun?.renk,
            oyunAd: m.grup?.durum === 'OYNUYOR' ? m.grup.oyun?.ad : null,
        }));
        const bireyler = [];
        for (const g of this.gruplar) {
            g.uyeler.forEach((b, i) => {
                if (b.kat !== kat || b.asansor) return;
                const ikon = i === 0 && g.oyun && g.durum === 'OYNUYOR' ? { renk: g.oyun.renk, harf: g.oyun.ad[0] } : null;
                const elKalkik = i === 0 && g.siparis?.durum === 'ISTENDI' && b.oturuyor;
                const ruh = i === 0 && !['CIKIYOR', 'GELIYOR'].includes(g.durum) && (this.beklemeTuru(g) || g.sabir < 70 || g.terk)
                    ? { sabir: g.terk ? 0 : g.sabir } : null;
                const minder = b.oturuyor && g.masa?.yuva.tip === 'minder';
                bireyler.push({ ...b, ikon, elKalkik, ruh, minder, vip: g.vip, hareketli: b.yol.length > 0 });
            });
        }
        for (const w of this.garsonlar) {
            if (w.birey.kat === kat && !w.birey.asansor) bireyler.push({ ...w.birey, hareketli: w.birey.yol.length > 0, tepsi: w.durum === 'SERVIS' });
        }
        if (kat === 1 && this.kasiyer) bireyler.push({ ...this.kasiyer, vx: 1, vy: 0.2 });
        if (kat === 1) for (const sf of this.sefler) bireyler.push({ ...sf.birey, hareketli: sf.birey.yol.length > 0 });
        const calan = this.acikMi();
        if (kat === VIP_KAT) {
            for (const m of this.muzisyenler) bireyler.push({ ...m.birey });
            if (this.host) bireyler.push({ ...this.host });
        }
        // Mutfak tezgâhı (kat 1) ve üst katların servis tezgâhı / yemek asansörü: o kata ait tabaklar
        const katFisleri = this.mutfakFisleri.filter((f) => (f.masa.kat === kat || (kat === 1 && !KATLAR[f.masa.kat].servis)) && !f.iptal);
        const mutfak = {
            pisiyor: kat === 1 && this.sefler.some((x) => x.durum === 'PISIRIYOR'),
            hazir: katFisleri.filter((f) => f.durum === 'HAZIR').length,
            asansorde: katFisleri.some((f) => f.durum === 'ASANSORDE'),
        };
        // VIP vitrini: veritabanındaki VIP oyunlar (rafta değilse yeri boş görünür); kat 2 turnuva panosu: bugünün en çok oynananları
        const vipOyunlar = kat === VIP_KAT ? this.oyunlar.filter((o) => o.vip_ozel).sort((a, b) => a.oyun_id - b.oyun_id)
            .map((o) => ({ ad: o.ad, renk: OYUN_RENK[o.oyun_id % OYUN_RENK.length], rafta: o.musait_adet > 0 })) : null;
        const turnuva = kat === 2 ? Object.entries(this.gunOyunlari).sort((a, b) => b[1] - a[1]).slice(0, 4)
            .map(([ad, n]) => ({ ad, n, renk: OYUN_RENK[(this.oyunlar.find((o) => o.ad === ad)?.oyun_id || 0) % OYUN_RENK.length] })) : null;
        const saat = this.dakika % 1440;
        const evre = saat < 17 * 60 ? 'gun' : saat < 19 * 60 ? 'aksam' : 'gece';
        return { kat, d, masalar, bireyler, seciliMasaId, mutfak, vipOyunlar, turnuva, asansorAcik: this.asansorKapi[kat] > this.zaman,
            evre, lambalar: saat >= 18 * 60, mevsim: [9, 10, 11].includes(this.takvim().ay) ? 'sonbahar' : null,
            sehir: kat === 1 ? this.sehir.gorunum() : null, dakika: saat,
            muzik: kat === VIP_KAT && calan ? this.muzisyenler.map((m) => ({ gx: m.gx, gy: m.gy })) : null };
    }

    ozet() {
        const icerde = this.gruplar.filter((g) => g.durum !== 'CIKIYOR');
        const katSayilari = { 1: 0, 2: 0, 3: 0 };
        for (const g of icerde) for (const b of g.uyeler) katSayilari[b.kat]++;
        return {
            takvim: this.takvim(), hiz: this.hiz, calisiyor: this.calisiyor, populerlik: Math.round(this.populerlik),
            ciro: this.ciro, musteri: icerde.reduce((t, g) => t + g.kisi, 0),
            masaBekleyen: icerde.filter((g) => g.durum === 'MASA_BEKLIYOR').reduce((t, g) => t + g.kisi, 0),
            disarida: this.disKuyruk.reduce((t, g) => t + g.kisi, 0),
            terkSayisi: this.gun.terkGrup,
            calismaDurumu: this.gunSonu ? 'KAPALI' : this.kapanisBasladi ? 'KAPANIYOR' : 'ACIK',
            saatDilimi: saatProfili(this.dakika).ad,
            gunSonu: this.gunSonu,
            gunluk: { gelenKisi: this.gun.gelenKisi, ogrenciKisi: this.gun.ogrenciKisi, terkGrup: this.gun.terkGrup },
            katSayilari,
            mutfak: {
                sefler: this.sefler.map((x) => ({ ad: x.ad, unvan: x.unvan, hazirlanan: x.hazirlanan,
                    durum: { BOSTA: 'Boşta', PISIRIYOR: `Masa ${x.fis?.masa?.masaNo} yemeğini pişiriyor`, TEZGAHA: 'Tabağı tezgaha koyuyor' }[x.durum] })),
                bekleyen: this.mutfakFisleri.filter((f) => f.durum === 'BEKLIYOR').length,
                hazir: this.mutfakFisleri.filter((f) => f.durum === 'HAZIR').length,
                asansorde: this.mutfakFisleri.filter((f) => f.durum === 'ASANSORDE').length,
            },
            garsonlar: this.garsonlar.map((w) => ({
                id: w.personel.id, ad: w.ad, durum: this.garsonDurumu(w), stat: w.stat, tamamlanan: w.tamamlanan,
                dbSiparis: this.dbSiparis[w.personel.id] ?? 0, kat: w.birey.kat, vip: w.ev.kat === VIP_KAT,
            })),
            kayitlar: this.kayitlar.slice(0, 40),
        };
    }

    masaBilgisi(masaId) {
        const m = this.masalar.find((x) => x.masaId === masaId);
        if (!m) return null;
        const g = m.grup;
        return {
            masaNo: m.masaNo, kat: m.kat, kapasite: m.kapasite, durum: this.masaDurumu(m).metin, oturumId: g?.oturumId || null,
            kisi: g?.kisi, ogrenci: g?.ogrenciSayisi ?? 0, oyun: g?.oyun?.ad || null, oyunId: g?.oyun?.id ?? null, vip: m.kat === VIP_KAT, vipUye: !!g?.vip,
            sonServis: g?.sonServis || null, sabir: g ? Math.round(g.sabir) : null, bekledigiOyun: g?.durum === 'SIRADA' ? g.bekledigiOyun?.ad : null,
            eglence: g ? Math.round(g.memnuniyet) : null, garson: g?.garson?.ad || g?.karsilayan?.ad || null,
            grupDurumu: g ? (g.kahvalti && g.durum === 'IZLIYOR' ? 'Kahvaltı / kahve keyfi' : DURUM_METNI[g.durum]) : null,
            kalisDk: g?.oturma != null ? Math.floor(this.dakika - g.oturma) : null,
            bekleyenSiparis: g?.siparis ? g.siparis.kalemler.map((k) => `${k.adet}× ${k.ad}`).join(', ') : null,
        };
    }
}
