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
    ASANSOR, DIS_SIRA, KAPI, KATLAR, MUTFAK, MUZISYENLER, oturmaYerleri, SAHNE_Z, SOKAK_CIKIS, SOKAK_GIRIS, yolBul, yurunebilir,
} from './harita.js';
import { karakterPaleti, OYUN_RENK } from './cizim.js';
import {
    dinleyiciCumlesi, izleyiciCumlesi, muzikCumlesi, oyunCumlesi, sabirsizCumle, sefCumlesi, servisCumlesi, siparisCumlesi, TERK_CUMLESI,
} from './diyalog.js';

const ADLAR = ['Ayşe', 'Mehmet', 'Zeynep', 'Can', 'Elif', 'Burak', 'Deniz', 'Ece', 'Emre', 'Selin', 'Mert', 'Defne', 'Kerem', 'İrem', 'Onur', 'Ceren', 'Baran', 'Ada', 'Arda', 'Nil'];
const SOYADLAR = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Koç', 'Kurt', 'Polat', 'Erdem', 'Tekin'];
const KAT_TERCIHI = { 1: ['Kart', 'Aile', 'Parti', 'Geleneksel'], 2: ['Strateji', 'Kooperatif', 'Soyut'], 3: ['Parti', 'Kooperatif', 'Strateji', 'Zar'] };

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
        // Canlı müzik (kat 3 sahnesi): şarkıcı, gitarist, piyanist
        this.muzisyenler = MUZISYENLER.map((m, i) => {
            const b = yeniBirey('muzisyen', 3, m.gx, m.gy, 950 + i);
            b.palet = karakterPaleti(950 + i, 'musteri', false, { rol: m.rol });
            Object.assign(b, { z: SAHNE_Z, vx: m.rol === 'piyanist' ? -1 : 1, vy: 0, oturuyor: m.rol === 'piyanist' });
            return { ...m, birey: b };
        });

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
        this.muzikAdim(dk);
        if (this.kapanisBasladi && !this.gruplar.length && !this.gunSonu && !this.gunSonuBekleniyor) this.gunuKapat();
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
        g.vip = m.kat === 3;
        g.karsilayan = this.garsonlar.length ? sec(this.garsonlar) : null;
        g.uyeler.forEach((b, i) => {
            const y = m.yerler[i] || m.yerler[0];
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
    grupOlustur(kisi, kat, yer) {
        const eski = this.musteriHavuzu.length > 5 && Math.random() < 0.3;
        const musteri = eski ? sec(this.musteriHavuzu) : {
            ad: sec(ADLAR), soyad: sec(SOYADLAR),
            telefon: `053${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
            ogrenci: Math.random() < 0.3,
        };
        if (!eski) this.musteriHavuzu.push(musteri);
        // Grupların bir kısmı öğrenci grubu (çoğu üye öğrenci); diğer gruplarda ara sıra bir öğrenci
        const ogrenciGrubu = Math.random() < 0.35;
        const ogrenciler = Array.from({ length: kisi }, () => Math.random() < (ogrenciGrubu ? 0.8 : 0.06));
        const uyeler = ogrenciler.map((ogr) => {
            const b = yeniBirey('musteri', kat, yer.gx, yer.gy);
            b.ogrenci = ogr;
            b.palet = karakterPaleti(b.id, 'musteri', ogr);
            return b;
        });
        const ogrenciSayisi = ogrenciler.filter(Boolean).length;
        musteri.ogrenci = ogrenciSayisi > 0;
        return {
            id: ++birimSayac, kisi, uyeler, musteri, durum: 'GELIYOR', masa: null, oturumId: null, oturumOyunId: null,
            beklemeId: null, oyun: null, bekledigiOyun: null, oyunBitis: 0, memnuniyet: 70, gelis: this.dakika,
            masaBeklemeBas: null, sonrakiSiparis: 0, siparis: null, siparisSayisi: 0, oyunSayisi: 0, mesgul: false,
            sonIslemEsitleme: 0, karsilayan: null, garson: null, hakVar: false, secZamani: null, sonrakiDeneme: 0,
            sabir: 100, sabirUyarisi: 100, ogrenciSayisi,
            // tek başına gelip sadece etrafı izleyenler; sabah gruplarının bir kısmı oyunsuz kahvaltıya gelir
            izleyici: kisi === 1 && Math.random() < saatProfili(this.dakika).izleyici,
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
        const kisi = agirlikliSec([1, 2, 3, 4, 5, 6, 7, 8], (k) => ({ 1: 2.5 / b, 2: 5, 3: 4 * b, 4: 5 * b, 5: 2 * b, 6: 2 * b, 7: 0.6 * b, 8: 0.6 * b }[k]));
        const g = this.grupOlustur(kisi, 1, SOKAK_GIRIS);
        this.gruplar.push(g);
        this.gun.gelenGrup++;
        this.gun.gelenKisi += kisi;
        this.gun.ogrenciKisi += g.ogrenciSayisi;
        // Sokağın sağından yürüyerek gelir, kapı önünde karar verir
        g.uyeler.forEach((b, i) => { b.gx = SOKAK_GIRIS.gx + i * 0.6; b.gy = SOKAK_GIRIS.gy; this.git(b, { kat: 1, ...KAPI }); });
        this.kaydet(`${kisi} kişilik grup geldi (${g.musteri.ad} ${g.musteri.soyad})`, 'bilgi');
    }

    masaAyir(g) {
        const tercihKat = g.kisi >= 7 ? 3 : g.kisi >= 3 ? 2 : 1;
        const adaylar = this.masalar.filter((m) => !m.grup && !m.kirli && m.db?.durum === 'BOS' && m.kapasite >= g.kisi);
        if (!adaylar.length) return null;
        adaylar.sort((a, b) => (a.kapasite - g.kisi + (a.kat !== tercihKat) * 2) - (b.kapasite - g.kisi + (b.kat !== tercihKat) * 2));
        const m = adaylar[0];
        m.grup = g; g.masa = m;
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
                // Sırada bekleyen varsa önce onlar: yeni gelen doğrudan kuyruğun sonuna
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
                if (Math.random() < dk * 0.02) this.baloncuk(lider, g.kahvalti ? sec(['Kahvaltı harika', 'Bir çay daha?', 'Menemen nefis']) : izleyiciCumlesi());
                if (this.dakika >= g.izlemeBitis) this.hesabaGec(g);
                return;

            case 'OYNUYOR':
                g.memnuniyet = Math.min(100, g.memnuniyet + dk * 0.25);
                this.siparisKontrol(g);
                if (Math.random() < dk * 0.05) this.baloncuk(sec(g.uyeler), g.vip && this.acikMi() && Math.random() < 0.3 ? dinleyiciCumlesi() : oyunCumlesi(g.oyun?.ad));
                if (this.dakika >= g.oyunBitis) this.oyunBitir(g);
                return;

            case 'HESAP':
                if (!this.vardi(lider)) return;
                g.durum = 'ODUYOR';
                this.ode(g);
                return;

            case 'CIKIYOR':
                if (!this.hepsiVardi(g)) return;
                this.gruplar.splice(this.gruplar.indexOf(g), 1);
                return;
            default:
        }
    }

    // Grubun karşılayan garsonu adına (yoksa yönetici olarak) istek
    garsonApi(g) {
        return adina(g.karsilayan?.personel.id);
    }

    async masaAc(g) {
        const m = g.masa;
        g.karsilayan = this.garsonlar.length ? sec(this.garsonlar) : null;
        try {
            const r = await this.api(g, () => this.garsonApi(g).gonder(`/masalar/${m.masaId}/ac`, { kisiSayisi: g.kisi, ogrenciSayisi: g.ogrenciSayisi, musteri: g.musteri }));
            g.oturumId = r.oturumId;
            g.oturma = this.dakika;
            g.vip = m.kat === 3;
            g.uyeler.forEach((b) => this.otur(b, m));
            g.durum = 'OYUN_SECIYOR';
            if (g.izleyici || g.kahvalti) this.izlemeyeBasla(g);
            g.sonrakiSiparis = this.dakika + rastgele(2, 6);
            this.kaydet(`Masa ${m.masaNo} açıldı: ${g.kisi} kişi${g.karsilayan ? ` · karşılayan ${g.karsilayan.ad}` : ''}`, 'bilgi');
        } catch (e) {
            this.kaydet(`Masa ${m.masaNo} açılamadı: ${e.message}`, 'uyari');
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
        const uygun = this.oyunlar.filter((o) => g.kisi >= o.min_oyuncu && g.kisi <= o.max_oyuncu && o.oyun_id !== g.reddedilen);
        if (!uygun.length) return this.izlemeyeBasla(g);   // uygun oyun yoksa etrafı izler
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
        const agirlik = (u) => /Sıcak/.test(u.kategori) ? 3 : /Soğuk/.test(u.kategori) ? 2
            : /Yiyecek/.test(u.kategori) ? (g.masa.kat === 3 ? Math.max(2.5, yemek) : yemek) : 1;
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
                b.vx = 0; b.vy = -1;
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
            const yemek = g.siparis.kalemler.some((k) => /Yiyecek|Tatlı/.test(k.kategori));
            if (yemek && this.sefler.length) {
                // Yemek mutfağa fiş olarak düşer; garson kat 1'deki servis tezgahının önünde bekler
                w.fis = { id: ++birimSayac, grup: g, masa: g.masa, durum: 'BEKLIYOR', kalemSayisi: g.siparis.kalemler.length, zaman: this.dakika };
                this.mutfakFisleri.push(w.fis);
                w.durum = 'MUTFAGA';
                this.git(w.birey, { kat: 1, ...MUTFAK.alis });
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
                sf.bitis = this.dakika + (2.5 + f.kalemSayisi * 1.2) / sf.hizCarpani;
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
                else { sf.fis.durum = 'HAZIR'; sf.hazirlanan++; this.baloncuk(b, 'Servis!', 1.5); }
                sf.fis = null;
                sf.durum = 'BOSTA';
                return;
            default:
        }
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
        const n = w.gorev?.masa?.masaNo;
        return {
            BOSTA: 'Boşta', MASAYA: `Masa ${n}'e gidiyor`, SIPARIS_ALIYOR: `Masa ${n} siparişi alıyor`, BARA: `Masa ${n} için bara`,
            HAZIRLIYOR: `Masa ${n} siparişi hazırlanıyor`, MUTFAGA: `Masa ${n} için mutfağa`, MUTFAK_BEKLIYOR: `Mutfakta Masa ${n} yemeğini bekliyor`, SERVIS: `Masa ${n}'e servis`, TEMIZLIGE: `Masa ${n} temizliğe`, TEMIZLIYOR: `Masa ${n} temizleniyor`,
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
                bireyler.push({ ...b, ikon, elKalkik, ruh, minder, hareketli: b.yol.length > 0 });
            });
        }
        for (const w of this.garsonlar) {
            if (w.birey.kat === kat && !w.birey.asansor) bireyler.push({ ...w.birey, hareketli: w.birey.yol.length > 0, tepsi: w.durum === 'SERVIS' });
        }
        if (kat === 1 && this.kasiyer) bireyler.push({ ...this.kasiyer, vx: 1, vy: 0.2 });
        if (kat === 1) for (const sf of this.sefler) bireyler.push({ ...sf.birey, hareketli: sf.birey.yol.length > 0 });
        const calan = this.acikMi();
        if (kat === 3) {
            for (const m of this.muzisyenler) {
                // çalarken hafifçe dans eder; şarkıcı mikrofonu kaldırıp indirir
                bireyler.push({ ...m.birey, hareketli: calan && m.rol !== 'piyanist', kare: Math.floor(this.zaman * 2) % 4,
                    elKalkik: m.rol === 'sarkici' && calan && Math.floor(this.zaman / 3) % 2 === 0 });
            }
        }
        const mutfak = kat === 1 ? {
            pisiyor: this.sefler.some((x) => x.durum === 'PISIRIYOR'),
            hazir: this.mutfakFisleri.filter((f) => f.durum === 'HAZIR').length,
        } : null;
        return { kat, d, masalar, bireyler, seciliMasaId, mutfak, asansorAcik: this.asansorKapi[kat] > this.zaman,
            muzik: kat === 3 && calan ? this.muzisyenler.map((m) => ({ gx: m.gx, gy: m.gy })) : null };
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
            },
            garsonlar: this.garsonlar.map((w) => ({
                id: w.personel.id, ad: w.ad, durum: this.garsonDurumu(w), stat: w.stat, tamamlanan: w.tamamlanan,
                dbSiparis: this.dbSiparis[w.personel.id] ?? 0, kat: w.birey.kat,
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
            kisi: g?.kisi, ogrenci: g?.ogrenciSayisi ?? 0, oyun: g?.oyun?.ad || null, oyunId: g?.oyun?.id ?? null, vip: m.kat === 3,
            sonServis: g?.sonServis || null, sabir: g ? Math.round(g.sabir) : null, bekledigiOyun: g?.durum === 'SIRADA' ? g.bekledigiOyun?.ad : null,
            eglence: g ? Math.round(g.memnuniyet) : null, garson: g?.garson?.ad || g?.karsilayan?.ad || null,
            grupDurumu: g ? (g.kahvalti && g.durum === 'IZLIYOR' ? 'Kahvaltı / kahve keyfi' : DURUM_METNI[g.durum]) : null,
            kalisDk: g?.oturma != null ? Math.floor(this.dakika - g.oturma) : null,
            bekleyenSiparis: g?.siparis ? g.siparis.kalemler.map((k) => `${k.adet}× ${k.ad}`).join(', ') : null,
        };
    }
}
