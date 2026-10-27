// Karavana simülasyonu: 3 katlı izometrik piksel-art kafe. Müşteriler ve garsonlar motor.js'teki
// durum makineleriyle hareket eder; her işlem gerçek API/veritabanı üzerinden yapılır.
//
// Kamera: sahne ara tuvale (DOGAL_G x DOGAL_Y) çizilir, ekrana aktarılırken
//   ekran = ofset + doğal * (sigdirma * yakinlik)
// dönüşümü uygulanır. Döndürme (d: 0..3) çizim aşamasında dünya koordinatlarında yapılır.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { al } from '../api.js';
import { tl } from '../bicim.js';
import { Simulasyon as Motor } from '../simulasyon/motor.js';
import {
    ARKA_RENK, dunyaKutusu,
    DOGAL_G, DOGAL_Y, gorunurAlan, kapakCiz, nesneBul, pikselBaglami, ruhHali, sahneCiz, ustKatmanCiz,
} from '../simulasyon/cizim.js';
import { KATLAR } from '../simulasyon/harita.js';
import { VIP_SUZGEC, VipRozet, vipSuzgecUyar } from '../bilesenler/ortak.jsx';

const HIZLAR = [1, 2, 4, 10];
const YAKINLIK = { min: 0.6, max: 5 };
const GECIS_SN = 0.5;
const YON_ADI = ['Kuzey-batı', 'Kuzey-doğu', 'Güney-doğu', 'Güney-batı'];

export default function Simulasyon() {
    const motorRef = useRef(null);
    const tuvalRef = useRef(null);
    const alanRef = useRef(null);
    // Kamera ve görünüm durumu döngü içinde okunduğu için ref'te; React durumu yalnızca arayüz için
    const kamera = useRef({ yakinlik: 1, panX: 0, panY: 0, d: 0 });
    const gorunum = useRef({ kat: 1, secili: null, gecis: null });
    const surukle = useRef(null);
    const bosluk = useRef(false);
    const [kat, setKat] = useState(1);
    const [secili, setSecili] = useState(null);
    const [ozet, setOzet] = useState(null);
    const [hata, setHata] = useState(null);
    const [panel, setPanel] = useState('garsonlar');
    const [kutuphane, setKutuphane] = useState(false);
    const [asansor, setAsansor] = useState(false);
    const [kameraDurum, setKameraDurum] = useState({ yakinlik: 1, d: 0 });

    gorunum.current.secili = secili;

    // Ekran dönüşümü (doğal → ekran CSS pikseli)
    const donusum = useCallback(() => {
        const alan = alanRef.current;
        const k = kamera.current;
        const w = alan?.clientWidth || 800, h = alan?.clientHeight || 500;
        // Katın görünür kısmı (iç mekân; kat 1'de görünüyorsa dış mekân da) ekrana sığdırılır
        const g0 = gorunurAlan(gorunum.current.kat, k.d);
        const aw = g0.x1 - g0.x0, ah = g0.y1 - g0.y0;
        const g = gorunum.current.gecis;
        const tg = g ? Math.min(1, g.t / GECIS_SN) : 0;
        // kat geçişi: kamera hafifçe geri çekilir (asansör kuyusunda yükselme/inme hissi)
        const s = Math.min(w / aw, h / ah) * k.yakinlik * (1 - 0.14 * Math.sin(Math.PI * tg));
        let ox = (w - aw * s) / 2 - g0.x0 * s + k.panX;
        let oy = (h - ah * s) / 2 - g0.y0 * s + k.panY;
        if (g) {                                       // kat geçişi: eski kat yukarı/aşağı kayar, yenisi karşı yönden gelir
            oy += (tg < 0.5 ? tg * 2 : -(1 - tg) * 2) * 160 * g.yon;
        }
        // kat 1: ekranın ortası dünya kutusunun dışına kaydırılamaz
        if (gorunum.current.kat === 1 && !g) {
            const dk = dunyaKutusu(k.d);
            const mx = (w / 2 - ox) / s, my = (h / 2 - oy) / s;
            const cx = Math.max(dk.x0, Math.min(dk.x1, mx)), cy = Math.max(dk.y0, Math.min(dk.y1, my));
            if (cx !== mx) { k.panX -= (cx - mx) * s; ox -= (cx - mx) * s; }
            if (cy !== my) { k.panY -= (cy - my) * s; oy -= (cy - my) * s; }
        }
        return { s, ox, oy, w, h };
    }, []);

    const katDegistir = useCallback((yeni) => {
        if (yeni === gorunum.current.kat || gorunum.current.gecis) return;
        gorunum.current.gecis = { t: 0, hedef: yeni, yon: yeni > gorunum.current.kat ? 1 : -1, degisti: false };
        setSecili(null);
        setAsansor(false);
    }, []);

    const kameraGuncelle = useCallback((f) => {
        f(kamera.current);
        const k = kamera.current;
        let enAz = YAKINLIK.min;
        if (gorunum.current.kat === 1) {
            // en uzakta maketin tamamı ve çevresinde biraz arka plan görünür, daha fazlası değil
            const alan = alanRef.current, w = alan?.clientWidth || 800, h = alan?.clientHeight || 500;
            const g0 = gorunurAlan(1, k.d), dk = dunyaKutusu(k.d);
            const sigdir = Math.min(w / (g0.x1 - g0.x0), h / (g0.y1 - g0.y0));
            enAz = (Math.min(w / (dk.x1 - dk.x0), h / (dk.y1 - dk.y0 + 160)) * 0.92) / sigdir;
        }
        k.yakinlik = Math.max(enAz, Math.min(YAKINLIK.max, k.yakinlik));
        setKameraDurum({ yakinlik: k.yakinlik, d: k.d });
    }, []);

    // Yakınlaştırma: ekrandaki (mx, my) noktası sabit kalacak şekilde
    const yakinlastir = useCallback((oran, mx, my) => {
        const once = donusum();
        const x = mx ?? once.w / 2, y = my ?? once.h / 2;
        const nx = (x - once.ox) / once.s, ny = (y - once.oy) / once.s;
        kameraGuncelle((k) => { k.yakinlik *= oran; });
        const sonra = donusum();
        kamera.current.panX += x - (sonra.ox + nx * sonra.s);
        kamera.current.panY += y - (sonra.oy + ny * sonra.s);
    }, [donusum, kameraGuncelle]);

    const dondur = useCallback((adim) => {
        kameraGuncelle((k) => { k.d = (k.d + adim + 4) % 4; k.panX = 0; k.panY = 0; });
    }, [kameraGuncelle]);
    const sifirla = useCallback(() => kameraGuncelle((k) => Object.assign(k, { yakinlik: 1, panX: 0, panY: 0, d: 0 })), [kameraGuncelle]);

    // Motor ve çizim döngüsü
    useEffect(() => {
        const motor = new Motor();
        motorRef.current = motor;
        motor.baslat().catch((e) => setHata(e.message));

        const ara = document.createElement('canvas');
        ara.width = 16; ara.height = 16;
        const ac = pikselBaglami(ara);

        let son = performance.now(), ozetZamani = 0, kare;
        const dongu = (simdi) => {
            const dt = Math.min(0.25, (simdi - son) / 1000);
            son = simdi;
            motor.tick(dt);
            const g = gorunum.current;
            if (g.gecis) {
                g.gecis.t += dt;
                if (!g.gecis.degisti && g.gecis.t >= GECIS_SN / 2) { g.kat = g.gecis.hedef; g.gecis.degisti = true; setKat(g.kat); }
                if (g.gecis.t >= GECIS_SN) g.gecis = null;
            }
            const tuval = tuvalRef.current;
            if (tuval && motor.hazir) {
                const dpr = window.devicePixelRatio || 1;
                const { s, ox, oy, w, h } = donusum();
                if (tuval.width !== Math.round(w * dpr) || tuval.height !== Math.round(h * dpr)) {
                    tuval.width = Math.round(w * dpr); tuval.height = Math.round(h * dpr);
                }
                const sahne = motor.sahne(g.kat, g.secili, kamera.current.d);
                // yalnızca ekranda görünen bölge çizilir (doğal koordinatta; tam sayı kaydırma piksel keskinliğini korur)
                const bx0 = Math.floor(-ox / s) - 2, by0 = Math.floor(-oy / s) - 2;
                const bw = Math.ceil(w / s) + 4, bh = Math.ceil(h / s) + 4;
                if (ara.width !== bw || ara.height !== bh) { ara.width = bw; ara.height = bh; ac.imageSmoothingEnabled = false; }
                ac.setTransform(1, 0, 0, 1, -bx0, -by0);
                sahne.olcek = s; sahne.fare = g.fare; sahne.yakinlik = kamera.current.yakinlik;
                sahneCiz(ac, sahne, { x0: bx0, y0: by0, x1: bx0 + bw, y1: by0 + bh });
                const c = tuval.getContext('2d');
                c.setTransform(dpr, 0, 0, dpr, 0, 0);
                c.imageSmoothingEnabled = false;
                // tuvalin dışı arka planın kenar rengiyle doldurulur (vinyet bu renge karardığı için dikiş görünmez)
                c.fillStyle = ARKA_RENK[sahne.evre || 'gun']; c.fillRect(0, 0, w, h);
                if (sahne.kat > 1) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, w, h); }
                if (KATLAR[sahne.kat].isik) { c.fillStyle = `rgba(12,6,24,${KATLAR[sahne.kat].isik})`; c.fillRect(0, 0, w, h); }
                c.drawImage(ara, ox + bx0 * s, oy + by0 * s, bw * s, bh * s);
                if (sahne.kat === 1) {                 // odak: kenarlara doğru çok hafif kararma
                    const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
                    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.2)');
                    c.fillStyle = v; c.fillRect(0, 0, w, h);
                }
                ustKatmanCiz(c, s, (p) => ({ x: ox + p.x * s, y: oy + p.y * s }), sahne);
                if (g.gecis) {                         // kat geçişi: kararma
                    const t = Math.min(1, g.gecis.t / GECIS_SN);
                    c.fillStyle = `rgba(20,12,6,${Math.sin(Math.PI * t) * 0.9})`;
                    c.fillRect(0, 0, w, h);
                    // asansör kuyusu: katlar arasındaki döşeme kirişleri hareket yönünün tersine akar
                    const a = Math.sin(Math.PI * t);
                    for (let i = 0; i < 4; i++) {
                        const yy = ((i / 4 + t * 2 * g.gecis.yon) % 1 + 1) % 1 * h;
                        c.fillStyle = `rgba(70,52,40,${0.85 * a})`; c.fillRect(0, yy, w, 22);
                        c.fillStyle = `rgba(140,110,80,${0.6 * a})`; c.fillRect(0, yy, w, 2);
                        c.fillStyle = `rgba(0,0,0,${0.5 * a})`; c.fillRect(0, yy + 22, w, 6);
                    }
                }
            }
            ozetZamani -= dt;
            if (ozetZamani <= 0 && motor.hazir) { ozetZamani = 0.25; setOzet(motor.ozet()); }
            kare = requestAnimationFrame(dongu);
        };
        kare = requestAnimationFrame(dongu);
        return () => cancelAnimationFrame(kare);
    }, [donusum]);

    // Klavye: Q/E döndür, +/- yakınlaş, Space basılıyken sürükle, 0 sıfırla
    useEffect(() => {
        const yazimda = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
        const bas = (e) => {
            if (yazimda(e)) return;
            if (e.key === 'q' || e.key === 'Q') dondur(-1);
            else if (e.key === 'e' || e.key === 'E') dondur(1);
            else if (e.key === '+' || e.key === '=') yakinlastir(1.2);
            else if (e.key === '-') yakinlastir(1 / 1.2);
            else if (e.key === '0') sifirla();
            else if (e.code === 'Space') { bosluk.current = true; e.preventDefault(); }
        };
        const birak = (e) => { if (e.code === 'Space') bosluk.current = false; };
        window.addEventListener('keydown', bas);
        window.addEventListener('keyup', birak);
        return () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', birak); };
    }, [dondur, yakinlastir, sifirla]);

    // Tekerlek (pasif olmayan dinleyici: sayfa kaymasın)
    useEffect(() => {
        const t = tuvalRef.current;
        if (!t) return undefined;
        const tekerlek = (e) => {
            e.preventDefault();
            const r = t.getBoundingClientRect();
            yakinlastir(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
        };
        t.addEventListener('wheel', tekerlek, { passive: false });
        return () => t.removeEventListener('wheel', tekerlek);
    }, [yakinlastir]);

    function fareBas(e) {
        if (e.button === 2 || e.button === 1 || (e.button === 0 && bosluk.current)) {
            e.preventDefault();
            surukle.current = { x: e.clientX, y: e.clientY, panX: kamera.current.panX, panY: kamera.current.panY };
            e.currentTarget.setPointerCapture?.(e.pointerId);
        }
    }
    function fareOynat(e) {
        // fare doğal koordinatta (öndeki kesik binanın üstüne gelince bina tam görünür)
        const kutu = e.currentTarget.getBoundingClientRect(), dn = donusum();
        gorunum.current.fare = { x: (e.clientX - kutu.left - dn.ox) / dn.s, y: (e.clientY - kutu.top - dn.oy) / dn.s };
        const s = surukle.current;
        if (!s) return;
        kamera.current.panX = s.panX + e.clientX - s.x;
        kamera.current.panY = s.panY + e.clientY - s.y;
    }
    function fareBirak() { surukle.current = null; }

    function tikla(e) {
        if (bosluk.current || !motorRef.current?.hazir) return;
        const r = e.currentTarget.getBoundingClientRect();
        const { s, ox, oy } = donusum();
        const x = (e.clientX - r.left - ox) / s, y = (e.clientY - r.top - oy) / s;
        const n = nesneBul(motorRef.current.sahne(gorunum.current.kat, null, kamera.current.d), x, y);
        if (n?.tur === 'asansor') { setAsansor(true); setSecili(null); return; }
        setSecili(n?.tur === 'masa' ? n.masa.masaId : null);
    }

    const motor = motorRef.current;
    const hizAyarla = (h) => { motor.hiz = h; motor.calisiyor = true; setOzet(motor.ozet()); };
    const duraklat = () => { motor.calisiyor = !motor.calisiyor; setOzet(motor.ozet()); };

    if (hata) return <div className="sim"><p className="sim-hata">Simülasyon başlatılamadı: {hata}</p></div>;

    return (
        <div className="sim">
            <Hud ozet={ozet} duraklat={duraklat} hizAyarla={hizAyarla} />
            <div className="sim-orta">
                <div className="sim-tuval-alani" ref={alanRef}>
                    <canvas ref={tuvalRef} className="sim-tuval" aria-label={`Kat ${kat} görünümü`}
                            onClick={tikla} onPointerDown={fareBas} onPointerMove={fareOynat} onPointerUp={fareBirak}
                            onPointerCancel={fareBirak} onContextMenu={(e) => e.preventDefault()} />
                    <div className="sim-kat-etiket">Kat {kat} · {KATLAR[kat].ad}</div>
                    <div className="sim-kamera" role="group" aria-label="Kamera">
                        <button className="sim-dugme" onClick={() => yakinlastir(1.25)} title="Yakınlaş (+ / tekerlek)" aria-label="Yakınlaş">+</button>
                        <button className="sim-dugme" onClick={() => yakinlastir(1 / 1.25)} title="Uzaklaş (- / tekerlek)" aria-label="Uzaklaş">−</button>
                        <button className="sim-dugme" onClick={() => dondur(-1)} title="Sola döndür (Q)" aria-label="Sola döndür">⟲</button>
                        <button className="sim-dugme" onClick={() => dondur(1)} title="Sağa döndür (E)" aria-label="Sağa döndür">⟳</button>
                        <button className="sim-dugme" onClick={sifirla} title="Kamerayı sıfırla (0)">Sıfırla</button>
                        <small>{Math.round(kameraDurum.yakinlik * 100)}% · {YON_ADI[kameraDurum.d]}</small>
                    </div>
                    <div className="sim-ipucu">Sağ tık / Space + sürükle: kaydır · Tekerlek: yakınlaş · Q/E: döndür · Asansöre tıkla: kat değiştir</div>
                    {!ozet && <div className="sim-yukleniyor">Kafe hazırlanıyor…</div>}
                </div>
                {panel && ozet && (
                    <aside className="sim-panel">
                        {panel === 'garsonlar' ? <GarsonPaneli ozet={ozet} /> : <OlayGunlugu kayitlar={ozet.kayitlar} />}
                    </aside>
                )}
            </div>
            <nav className="sim-alt">
                {[1, 2, 3].map((k) => (
                    <button key={k} className={`sim-dugme ${kat === k ? 'secili' : ''}`} onClick={() => katDegistir(k)}>
                        Kat {k} <small>{ozet?.katSayilari[k] ?? 0} kişi</small>
                    </button>
                ))}
                <span className="sim-ara" />
                <button className={`sim-dugme ${panel === 'garsonlar' ? 'secili' : ''}`} onClick={() => setPanel(panel === 'garsonlar' ? null : 'garsonlar')}>Garsonlar</button>
                <button className={`sim-dugme ${panel === 'kayit' ? 'secili' : ''}`} onClick={() => setPanel(panel === 'kayit' ? null : 'kayit')}>Olay günlüğü</button>
                <button className="sim-dugme" onClick={() => setKutuphane(true)}>Oyun kütüphanesi</button>
            </nav>
            {secili && motor && <MasaDetay motor={motor} masaId={secili} kapat={() => setSecili(null)} />}
            {kutuphane && motor && <Kutuphane motor={motor} kapat={() => setKutuphane(false)} />}
            {asansor && <AsansorPaneli kat={kat} ozet={ozet} sec={katDegistir} kapat={() => setAsansor(false)} />}
            {ozet?.gunSonu && <GunSonuFisi fis={ozet.gunSonu} yeniGun={() => { motor.yeniGun(); setOzet(motor.ozet()); }} />}
        </div>
    );
}

function Hud({ ozet, duraklat, hizAyarla }) {
    if (!ozet) return <header className="sim-hud" />;
    const t = ozet.takvim;
    return (
        <header className="sim-hud">
            <div className="sim-kutu"><span className="sim-etiket">Takvim</span>{t.yil}. Yıl {t.ay}. Ay {t.gun}. Gün</div>
            <div className="sim-kutu sim-saat">
                {t.saat}
                <span className={`sim-durum sim-durum-${ozet.calismaDurumu.toLowerCase()}`}>
                    {{ ACIK: ozet.saatDilimi, KAPANIYOR: 'Kapanıyor', KAPALI: 'Kapalı' }[ozet.calismaDurumu]}
                </span>
            </div>
            <div className="sim-kutu"><span className="sim-etiket">Kasa (bugün)</span>{tl(ozet.ciro.bugun)}</div>
            <div className="sim-kutu"><span className="sim-etiket">Açık hesap</span>{tl(ozet.ciro.acik)}</div>
            <div className="sim-kutu">
                <span className="sim-etiket">Müşteri</span>{ozet.musteri}
                {ozet.masaBekleyen > 0 && <small className="sim-uyari"> ({ozet.masaBekleyen} kişi masa bekliyor)</small>}
            </div>
            <div className={`sim-kutu ${ozet.disarida ? 'sim-kutu-uyari' : ''}`}><span className="sim-etiket">Dışarıda sırada</span>{ozet.disarida} kişi</div>
            <div className={`sim-kutu ${ozet.terkSayisi ? 'sim-kutu-uyari' : ''}`}><span className="sim-etiket">Terk eden (bugün)</span>{ozet.terkSayisi}</div>
            <div className="sim-kutu sim-pop">
                <span className="sim-etiket">Popülerlik</span>
                <div className="sim-cubuk"><div style={{ width: `${ozet.populerlik}%` }} /></div>
                <span>{ozet.populerlik}</span>
            </div>
            <div className="sim-hiz" role="group" aria-label="Simülasyon hızı">
                <button className={`sim-dugme ${!ozet.calisiyor ? 'secili' : ''}`} onClick={duraklat} aria-label="Duraklat / sürdür">
                    {ozet.calisiyor ? '❚❚' : '▶'}
                </button>
                {HIZLAR.map((h) => (
                    <button key={h} className={`sim-dugme ${ozet.calisiyor && ozet.hiz === h ? 'secili' : ''}`} onClick={() => hizAyarla(h)}>{h}×</button>
                ))}
            </div>
        </header>
    );
}

function Yildiz({ n }) {
    const k = Math.max(0, Math.min(5, n));
    return <span className="sim-yildiz" aria-label={`${k} / 5`}>{'★'.repeat(k)}<span>{'★'.repeat(5 - k)}</span></span>;
}

function GarsonPaneli({ ozet }) {
    return (
        <>
            <h2>Garsonlar</h2>
            {!ozet.garsonlar.length && <p className="sim-soluk">Aktif garson yok.</p>}
            <ul className="sim-garsonlar">
                {ozet.garsonlar.map((w) => (
                    <li key={w.id}>
                        <div className="satir arasi"><strong>{w.ad}{w.vip && <VipRozet baslik="VIP Kulüp servisi" />}</strong><small>Kat {w.kat}</small></div>
                        <div className={`sim-gorev ${w.durum === 'Boşta' ? 'bos' : ''}`}>{w.durum}</div>
                        <dl>
                            <dt>Hız</dt><dd><Yildiz n={Math.round(w.stat.hiz - 1)} /></dd>
                            <dt>Sipariş alma</dt><dd><Yildiz n={Math.max(1, 6 - Math.round(w.stat.siparis * 1.6))} /></dd>
                            <dt>Servis yeteneği</dt><dd><Yildiz n={w.stat.yetenek} /></dd>
                        </dl>
                        <small className="sim-soluk">Bu oturumda {w.tamamlanan} servis · veritabanında toplam {w.dbSiparis} sipariş</small>
                    </li>
                ))}
            </ul>
            <h2>Mutfak · kat 1</h2>
            <ul className="sim-garsonlar">
                {ozet.mutfak.sefler.map((x) => (
                    <li key={x.ad}>
                        <div className="satir arasi"><strong>{x.ad}</strong><small>{x.unvan}</small></div>
                        <div className={`sim-gorev ${x.durum === 'Boşta' ? 'bos' : ''}`}>{x.durum}</div>
                        <small className="sim-soluk">Bu oturumda {x.hazirlanan} tabak</small>
                    </li>
                ))}
            </ul>
            <p className="sim-soluk">Bekleyen fiş: {ozet.mutfak.bekleyen} · yemek asansöründe: {ozet.mutfak.asansorde} · tezgahta hazır: {ozet.mutfak.hazir}</p>
            <h2>Son olaylar</h2>
            <OlayGunlugu kayitlar={ozet.kayitlar.slice(0, 8)} basliksiz />
        </>
    );
}

function OlayGunlugu({ kayitlar, basliksiz }) {
    return (
        <>
            {!basliksiz && <h2>Olay günlüğü</h2>}
            <ol className="sim-kayitlar">
                {kayitlar.map((k) => (
                    <li key={k.id} className={`sim-kayit-${k.tur}`}><span>{k.saat}</span> {k.metin}</li>
                ))}
            </ol>
        </>
    );
}

function SimPencere({ baslik, kapat, children, genis }) {
    useEffect(() => {
        const esc = (e) => e.key === 'Escape' && kapat();
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [kapat]);
    return (
        <div className="sim-pencere-arka" onMouseDown={(e) => e.target === e.currentTarget && kapat()}>
            <section className={`sim-pencere ${genis ? 'genis' : ''}`} role="dialog" aria-modal="true" aria-label={baslik}>
                <header><h2>{baslik}</h2><button className="sim-dugme" onClick={kapat} aria-label="Kapat">✕</button></header>
                {children}
            </section>
        </div>
    );
}

// Asansör: kat seçim paneli (bulunulan kat işaretli)
function AsansorPaneli({ kat, ozet, sec, kapat }) {
    return (
        <SimPencere baslik="Asansör · kat seçin" kapat={kapat}>
            <div className="sim-kat-secenekler">
                {[3, 2, 1].map((k) => (
                    <button key={k} className={`sim-kat-secenek ${k === kat ? 'bulunulan' : ''}`} disabled={k === kat} onClick={() => sec(k)}>
                        <span className="sim-kat-ok">{k === kat ? '●' : k > kat ? '▲' : '▼'}</span>
                        <span>
                            <strong>Kat {k}{k === kat ? ' · buradasınız' : ''}</strong>
                            <small>{KATLAR[k].ad} · {ozet?.katSayilari[k] ?? 0} kişi</small>
                        </span>
                    </button>
                ))}
            </div>
        </SimPencere>
    );
}

function Kapak({ ad, no }) {
    const ref = useRef(null);
    useEffect(() => { if (ref.current) kapakCiz(ref.current, ad, no); }, [ad, no]);
    return <canvas ref={ref} width={120} height={88} className="sim-kapak" aria-label={`${ad} kapağı`} />;
}

// Masa detayı: simülasyon durumu + veritabanından siparişler ve anlık hesap
function MasaDetay({ motor, masaId, kapat }) {
    const [, yenile] = useState(0);
    const [db, setDb] = useState({ siparisler: [], hesap: null });
    const b = motor.masaBilgisi(masaId);
    const oturumId = b?.oturumId;

    useEffect(() => {
        const t = setInterval(() => yenile((x) => x + 1), 500);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        if (!oturumId) { setDb({ siparisler: [], hesap: null }); return undefined; }
        let aktif = true;
        const getir = () => Promise.all([al(`/oturumlar/${oturumId}/siparisler`), al(`/oturumlar/${oturumId}/hesap`).catch(() => null)])
            .then(([siparisler, hesap]) => aktif && setDb({ siparisler, hesap })).catch(() => {});
        getir();
        const t = setInterval(getir, 3000);
        return () => { aktif = false; clearInterval(t); };
    }, [oturumId]);

    const toplu = useMemo(() => {
        const m = new Map();
        for (const s of db.siparisler) m.set(s.urun, (m.get(s.urun) || 0) + s.adet);
        return [...m.entries()];
    }, [db.siparisler]);

    if (!b) return null;
    const oyunAdi = b.oyun || b.bekledigiOyun;
    return (
        <SimPencere baslik={`Masa ${b.masaNo} · Kat ${b.kat}${b.vip ? ' · VIP Kulüp' : ''}`} kapat={kapat} genis>
            <div className="sim-detay-ust">
                {oyunAdi ? <Kapak ad={oyunAdi} no={b.oyunId ?? oyunAdi.length} /> : <div className="sim-kapak bos">Oyun yok</div>}
                <div>
                    <div className="sim-detay-oyun">{b.oyun || (b.bekledigiOyun ? `${b.bekledigiOyun} (sırada)` : 'Oyun oynanmıyor')}</div>
                    <span className="sim-rozet">{b.durum}</span>{b.grupDurumu && <small className="sim-soluk"> {b.grupDurumu}</small>}
                    <div className="sim-eglence">
                        <span className="sim-etiket">Eğlence</span>
                        {b.eglence != null ? <><div className="sim-cubuk"><div style={{ width: `${b.eglence}%` }} /></div> {b.eglence}</> : '–'}
                    </div>
                    {b.sabir != null && (
                        <div className="sim-eglence">
                            <span className="sim-etiket">Sabır</span>
                            <div className="sim-cubuk sim-cubuk-sabir">
                                <div style={{ width: `${b.sabir}%`, background: ruhHali(b.sabir).renk }} />
                            </div>
                            <span aria-hidden="true">{ruhHali(b.sabir).ikon}</span> {b.sabir}
                        </div>
                    )}
                </div>
            </div>
            <dl className="sim-detay">
                <dt>Kişi</dt><dd>{b.kisi ? `${b.kisi} / ${b.kapasite}` : `${b.kapasite} kişilik`}
                    {b.ogrenci > 0 && <span className="sim-ogrenci">🎓 {b.ogrenci} öğrenci · giriş yarı fiyat</span>}</dd>
                <dt>Siparişler</dt><dd>{toplu.length ? toplu.map(([u, a]) => `${a}× ${u}`).join(', ') : '–'}
                    {b.bekleyenSiparis && <div className="sim-uyari">Bekleyen istek: {b.bekleyenSiparis}</div>}</dd>
                <dt>Üyelik</dt><dd>{b.kisi ? (b.vipUye ? <VipRozet baslik="VIP Kulüp üyesi" /> : 'Standart') : '–'}</dd>
                <dt>Garson</dt><dd>{b.garson || '–'}</dd>
                <dt>Son servis</dt><dd>{b.sonServis ? `${b.sonServis.saat} · ${b.sonServis.garson}` : '–'}</dd>
                <dt>Kalış süresi</dt><dd>{b.kalisDk != null ? `${b.kalisDk} dk` : '–'}</dd>
                <dt>Biriken hesap</dt><dd><strong>{db.hesap ? tl(db.hesap.toplam) : '–'}</strong>
                    {db.hesap && <small> (giriş {tl(db.hesap.giris_toplam)} + sipariş {tl(db.hesap.siparis_toplam)}
                        {db.hesap.ogrenci_indirimi > 0 && <> − öğrenci {tl(db.hesap.ogrenci_indirimi)}</>})</small>}</dd>
            </dl>
        </SimPencere>
    );
}

// Gün sonu fişi: yazar kasadan çıkıyormuş gibi yukarıdan süzülür. Tutarlar veritabanından (fn_donem_ozeti),
// müşteri akışı (gelen, terk eden, kapanışta dönen) simülasyonun gün sayaçlarından gelir.
function GunSonuFisi({ fis, yeniGun }) {
    const o = fis.db || {};
    const g = fis.gun;
    const satir = (sol, sag, vurgu) => (
        <div className={`fis-satir ${vurgu ? 'vurgu' : ''}`}><span>{sol}</span><span>{sag}</span></div>
    );
    const toplamServis = fis.garsonlar.reduce((t, w) => t + w.servis, 0);
    return (
        <div className="fis-arka" role="dialog" aria-modal="true" aria-label="Gün sonu fişi">
            <div className="fis-yazici" aria-hidden="true" />
            <article className="fis">
                <header className="fis-baslik">
                    <div className="fis-logo">KARAVANA</div>
                    <div>Kutu Oyunu Cafe</div>
                    <div className="fis-kucuk">GÜN SONU RAPORU</div>
                    <div className="fis-kucuk">{fis.takvim.yil}. Yıl {fis.takvim.ay}. Ay {fis.takvim.gun}. Gün · {fis.tarih}</div>
                    <div className="fis-kucuk">Açılış 10:00 · Kapanış {fis.kapanisSaati}</div>
                </header>
                <div className="fis-cizgi" />
                {satir(`Giriş · normal (${(o.kisi ?? 0) - (o.ogrenci ?? 0)} kişi)`, tl(o.normal_giris ?? 0))}
                {satir(`Giriş · öğrenci 🎓 ${o.ogrenci ?? 0} kişi`, tl(o.ogrenci_giris ?? 0))}
                {satir('Yiyecek & içecek', tl(o.siparis ?? 0))}
                {o.diger_indirim > 0 && satir('Ek indirim', `−${tl(o.diger_indirim)}`)}
                <div className="fis-cizgi" />
                {satir('TOPLAM CİRO', tl(o.ciro ?? 0), true)}
                {satir('  Nakit', tl(o.nakit ?? 0))}
                {satir('  Kart', tl(o.kart ?? 0))}
                {satir('Kapanan hesap', `${o.hesap_sayisi ?? 0} masa`)}
                <div className="fis-cizgi" />
                {satir('Gelen müşteri', `${g.gelenKisi} kişi · ${g.gelenGrup} grup`)}
                {satir('Masaya oturan', `${o.kisi ?? 0} kişi`)}
                {satir('Sıkılıp terk eden 😡', `${g.terkGrup} grup · ${g.terkKisi} kişi`)}
                {g.yerBulamayan > 0 && satir('Kuyruk dolu diye giden', `${g.yerBulamayan} kişi`)}
                {g.kapanistaDonen > 0 && satir('Kapanışta geri dönen', `${g.kapanistaDonen} kişi`)}
                <div className="fis-cizgi" />
                <div className="fis-kucuk fis-orta">GARSON SERVİSLERİ · toplam {toplamServis}</div>
                {fis.garsonlar.map((w) => satir(`${w.ad} (kat ${w.kat})`, `${w.servis} servis`))}
                <div className="fis-cizgi" />
                {!fis.db && <div className="fis-kucuk fis-orta">Tutarlar alınamadı (bağlantı)</div>}
                <div className="fis-orta">Teşekkürler, yarın görüşmek üzere!</div>
                <div className="fis-barkod" aria-hidden="true" />
                <button className="sim-dugme fis-dugme" onClick={yeniGun} autoFocus>Kapat · Yeni güne başla (10:00)</button>
            </article>
        </div>
    );
}

function Kutuphane({ motor, kapat }) {
    const [, yenile] = useState(0);
    useEffect(() => {
        const t = setInterval(() => yenile((x) => x + 1), 1000);
        return () => clearInterval(t);
    }, []);
    const [tur, setTur] = useState('');
    const oyunlar = motor.oyunlar.filter((o) => vipSuzgecUyar(tur, o)).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    return (
        <SimPencere baslik="Oyun kütüphanesi" kapat={kapat} genis>
            <div className="segmentli" role="group" aria-label="Oyun türü">
                {VIP_SUZGEC.map(([k, ad]) => <button key={k} className={tur === k ? 'secili' : ''} aria-pressed={tur === k} onClick={() => setTur(k)}>{ad}</button>)}
            </div>
            <table className="sim-tablo">
                <thead><tr><th>Oyun</th><th>Kategori</th><th>Kişi</th><th>Rafta</th><th>Sırada</th></tr></thead>
                <tbody>
                    {oyunlar.map((o) => (
                        <tr key={o.oyun_id}>
                            <td><strong>{o.ad}</strong>{o.vip_ozel && <VipRozet />}{o.vip_ozel && <span className="vip-not">Sadece VIP üyeler oynayabilir</span>}</td>
                            <td>{o.kategori}</td><td>{o.min_oyuncu}–{o.max_oyuncu}</td>
                            <td className={o.alinabilir_adet ? '' : 'sim-uyari'}>{o.alinabilir_adet}/{o.toplam_adet}</td>
                            <td>{o.bekleyen_masa || '–'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </SimPencere>
    );
}
