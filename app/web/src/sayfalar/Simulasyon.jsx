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
    DOGAL_G, DOGAL_Y, gorunurAlan, kapakCiz, nesneBul, pikselBaglami, ruhHali, sahneCiz, ustKatmanCiz,
} from '../simulasyon/cizim.js';
import { KATLAR } from '../simulasyon/harita.js';

const HIZLAR = [1, 2, 4];
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
    const [merdiven, setMerdiven] = useState(false);
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
        const s = Math.min(w / aw, h / ah) * k.yakinlik;
        const ox = (w - aw * s) / 2 - g0.x0 * s + k.panX;
        let oy = (h - ah * s) / 2 - g0.y0 * s + k.panY;
        const g = gorunum.current.gecis;
        if (g) {                                       // kat geçişi: dikey kayma
            const t = Math.min(1, g.t / GECIS_SN);
            oy += (t < 0.5 ? -t * 2 : (1 - t) * 2) * 40 * g.yon;
        }
        return { s, ox, oy, w, h };
    }, []);

    const katDegistir = useCallback((yeni) => {
        if (yeni === gorunum.current.kat || gorunum.current.gecis) return;
        gorunum.current.gecis = { t: 0, hedef: yeni, yon: yeni > gorunum.current.kat ? 1 : -1, degisti: false };
        setSecili(null);
        setMerdiven(false);
    }, []);

    const kameraGuncelle = useCallback((f) => {
        f(kamera.current);
        const k = kamera.current;
        k.yakinlik = Math.max(YAKINLIK.min, Math.min(YAKINLIK.max, k.yakinlik));
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
        ara.width = DOGAL_G; ara.height = DOGAL_Y;
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
                sahneCiz(ac, sahne);
                const c = tuval.getContext('2d');
                c.setTransform(dpr, 0, 0, dpr, 0, 0);
                c.imageSmoothingEnabled = false;
                c.fillStyle = '#1d1712';
                c.fillRect(0, 0, w, h);
                c.drawImage(ara, ox, oy, DOGAL_G * s, DOGAL_Y * s);
                ustKatmanCiz(c, s, (p) => ({ x: ox + p.x * s, y: oy + p.y * s }), sahne);
                if (g.gecis) {                         // kat geçişi: kararma
                    const t = Math.min(1, g.gecis.t / GECIS_SN);
                    c.fillStyle = `rgba(20,12,6,${Math.sin(Math.PI * t) * 0.9})`;
                    c.fillRect(0, 0, w, h);
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
        if (n?.tur === 'merdiven') { setMerdiven(true); setSecili(null); return; }
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
                    <div className="sim-ipucu">Sağ tık / Space + sürükle: kaydır · Tekerlek: yakınlaş · Q/E: döndür · Merdivene tıkla: kat değiştir</div>
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
            {merdiven && <KatDegistir kat={kat} ozet={ozet} sec={katDegistir} kapat={() => setMerdiven(false)} />}
        </div>
    );
}

function Hud({ ozet, duraklat, hizAyarla }) {
    if (!ozet) return <header className="sim-hud" />;
    const t = ozet.takvim;
    return (
        <header className="sim-hud">
            <div className="sim-kutu"><span className="sim-etiket">Takvim</span>{t.yil}. Yıl {t.ay}. Ay {t.gun}. Gün</div>
            <div className="sim-kutu sim-saat">{t.saat}</div>
            <div className="sim-kutu"><span className="sim-etiket">Kasa (bugün)</span>{tl(ozet.ciro.bugun)}</div>
            <div className="sim-kutu"><span className="sim-etiket">Açık hesap</span>{tl(ozet.ciro.acik)}</div>
            <div className="sim-kutu">
                <span className="sim-etiket">Müşteri</span>{ozet.musteri}
                {ozet.masaBekleyen > 0 && <small className="sim-uyari"> ({ozet.masaBekleyen} kişi masa bekliyor)</small>}
            </div>
            <div className={`sim-kutu ${ozet.disarida ? 'sim-kutu-uyari' : ''}`}><span className="sim-etiket">Dışarıda sırada</span>{ozet.disarida} kişi</div>
            <div className={`sim-kutu ${ozet.terkSayisi ? 'sim-kutu-uyari' : ''}`}><span className="sim-etiket">Terk eden grup</span>{ozet.terkSayisi}</div>
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
                        <div className="satir arasi"><strong>{w.ad}</strong><small>Kat {w.kat}</small></div>
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

// Merdiven: kat değiştirme penceresi
function KatDegistir({ kat, ozet, sec, kapat }) {
    const secenek = (k, yon) => (
        <button className="sim-kat-secenek" onClick={() => sec(k)}>
            <span className="sim-kat-ok">{yon === 'yukari' ? '▲' : '▼'}</span>
            <span>
                <strong>{yon === 'yukari' ? 'Yukarı çık' : 'Aşağı in'}: Kat {kat} → Kat {k}</strong>
                <small>{KATLAR[k].ad} · {ozet?.katSayilari[k] ?? 0} kişi</small>
            </span>
        </button>
    );
    return (
        <SimPencere baslik="Merdiven · kat değiştir" kapat={kapat}>
            <div className="sim-kat-secenekler">
                {kat < 3 && secenek(kat + 1, 'yukari')}
                {kat > 1 && secenek(kat - 1, 'asagi')}
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
        <SimPencere baslik={`Masa ${b.masaNo} · Kat ${b.kat}${b.vip ? ' · VIP' : ''}`} kapat={kapat} genis>
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
                <dt>Kişi</dt><dd>{b.kisi ? `${b.kisi} / ${b.kapasite}` : `${b.kapasite} kişilik`}</dd>
                <dt>Siparişler</dt><dd>{toplu.length ? toplu.map(([u, a]) => `${a}× ${u}`).join(', ') : '–'}
                    {b.bekleyenSiparis && <div className="sim-uyari">Bekleyen istek: {b.bekleyenSiparis}</div>}</dd>
                <dt>Garson</dt><dd>{b.garson || '–'}</dd>
                <dt>Son servis</dt><dd>{b.sonServis ? `${b.sonServis.saat} · ${b.sonServis.garson}` : '–'}</dd>
                <dt>Kalış süresi</dt><dd>{b.kalisDk != null ? `${b.kalisDk} dk` : '–'}</dd>
                <dt>Biriken hesap</dt><dd><strong>{db.hesap ? tl(db.hesap.toplam) : '–'}</strong>
                    {db.hesap && <small> (giriş {tl(db.hesap.giris_toplam)} + sipariş {tl(db.hesap.siparis_toplam)})</small>}</dd>
            </dl>
        </SimPencere>
    );
}

function Kutuphane({ motor, kapat }) {
    const [, yenile] = useState(0);
    useEffect(() => {
        const t = setInterval(() => yenile((x) => x + 1), 1000);
        return () => clearInterval(t);
    }, []);
    const oyunlar = [...motor.oyunlar].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    return (
        <SimPencere baslik="Oyun kütüphanesi" kapat={kapat} genis>
            <table className="sim-tablo">
                <thead><tr><th>Oyun</th><th>Kategori</th><th>Kişi</th><th>Rafta</th><th>Sırada</th></tr></thead>
                <tbody>
                    {oyunlar.map((o) => (
                        <tr key={o.oyun_id}>
                            <td><strong>{o.ad}</strong></td><td>{o.kategori}</td><td>{o.min_oyuncu}–{o.max_oyuncu}</td>
                            <td className={o.alinabilir_adet ? '' : 'sim-uyari'}>{o.alinabilir_adet}/{o.toplam_adet}</td>
                            <td>{o.bekleyen_masa || '–'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </SimPencere>
    );
}
