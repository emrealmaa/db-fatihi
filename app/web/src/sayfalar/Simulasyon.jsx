// Karavana simülasyonu: 3 katlı izometrik piksel-art kafe. Müşteriler ve garsonlar motor.js'teki
// durum makineleriyle hareket eder; her işlem gerçek API/veritabanı üzerinden yapılır.
import { useEffect, useMemo, useRef, useState } from 'react';
import { al } from '../api.js';
import { tl } from '../bicim.js';
import { Simulasyon as Motor } from '../simulasyon/motor.js';
import { DOGAL_G, DOGAL_Y, masaBul, pikselBaglami, sahneCiz, ustKatmanCiz } from '../simulasyon/cizim.js';
import { KATLAR } from '../simulasyon/harita.js';

const HIZLAR = [1, 2, 4];

export default function Simulasyon() {
    const motorRef = useRef(null);
    const tuvalRef = useRef(null);
    const alanRef = useRef(null);
    const katRef = useRef(1);
    const seciliRef = useRef(null);
    const olcekRef = useRef(2);
    const [kat, setKat] = useState(1);
    const [secili, setSecili] = useState(null);
    const [ozet, setOzet] = useState(null);
    const [hata, setHata] = useState(null);
    const [panel, setPanel] = useState('garsonlar');
    const [kutuphane, setKutuphane] = useState(false);
    const [olcek, setOlcek] = useState(2);

    katRef.current = kat;
    seciliRef.current = secili;

    // Motor ve çizim döngüsü
    useEffect(() => {
        const motor = new Motor();
        motorRef.current = motor;
        motor.baslat().catch((e) => setHata(e.message));

        const dogal = document.createElement('canvas');
        dogal.width = DOGAL_G; dogal.height = DOGAL_Y;
        const dc = pikselBaglami(dogal);

        let son = performance.now(), ozetZamani = 0, kare;
        const dongu = (simdi) => {
            const dt = (simdi - son) / 1000;
            son = simdi;
            motor.tick(dt);
            const tuval = tuvalRef.current;
            if (tuval && motor.hazir) {
                const sahne = motor.sahne(katRef.current, seciliRef.current);
                sahneCiz(dc, sahne);
                const c = tuval.getContext('2d');
                c.imageSmoothingEnabled = false;
                c.clearRect(0, 0, tuval.width, tuval.height);
                c.drawImage(dogal, 0, 0, tuval.width, tuval.height);
                ustKatmanCiz(c, olcekRef.current, sahne);
            }
            ozetZamani -= dt;
            if (ozetZamani <= 0 && motor.hazir) { ozetZamani = 0.25; setOzet(motor.ozet()); }
            kare = requestAnimationFrame(dongu);
        };
        kare = requestAnimationFrame(dongu);
        return () => cancelAnimationFrame(kare);
    }, []);

    // Tuval ölçeği: alana sığan en büyük (0.25 adımlı) büyütme
    useEffect(() => {
        const alan = alanRef.current;
        if (!alan) return undefined;
        const gozlem = new ResizeObserver(() => {
            const o = Math.max(1, Math.floor(Math.min(alan.clientWidth / DOGAL_G, alan.clientHeight / DOGAL_Y) * 4) / 4);
            olcekRef.current = o;
            setOlcek(o);
        });
        gozlem.observe(alan);
        return () => gozlem.disconnect();
    }, []);

    function tikla(e) {
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / olcek, y = (e.clientY - r.top) / olcek;
        const m = masaBul(motorRef.current.sahne(kat).masalar, x, y);
        setSecili(m ? m.masaId : null);
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
                    <canvas ref={tuvalRef} width={Math.round(DOGAL_G * olcek)} height={Math.round(DOGAL_Y * olcek)}
                            onClick={tikla} className="sim-tuval" aria-label={`Kat ${kat} görünümü`} />
                    <div className="sim-kat-etiket">Kat {kat} · {KATLAR[kat].ad}</div>
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
                    <button key={k} className={`sim-dugme ${kat === k ? 'secili' : ''}`} onClick={() => { setKat(k); setSecili(null); }}>
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
    return <span className="sim-yildiz" aria-label={`${n} / 5`}>{'★'.repeat(n)}<span>{'★'.repeat(5 - n)}</span></span>;
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

function SimPencere({ baslik, kapat, children }) {
    useEffect(() => {
        const esc = (e) => e.key === 'Escape' && kapat();
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [kapat]);
    return (
        <div className="sim-pencere-arka" onMouseDown={(e) => e.target === e.currentTarget && kapat()}>
            <section className="sim-pencere" role="dialog" aria-modal="true" aria-label={baslik}>
                <header><h2>{baslik}</h2><button className="sim-dugme" onClick={kapat} aria-label="Kapat">✕</button></header>
                {children}
            </section>
        </div>
    );
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
    return (
        <SimPencere baslik={`Masa ${b.masaNo} · Kat ${b.kat}`} kapat={kapat}>
            <dl className="sim-detay">
                <dt>Durum</dt><dd><span className="sim-rozet">{b.durum}</span>{b.grupDurumu && <small> {b.grupDurumu}</small>}</dd>
                <dt>Kişi</dt><dd>{b.kisi ? `${b.kisi} / ${b.kapasite}` : `${b.kapasite} kişilik`}</dd>
                <dt>Oynanan oyun</dt><dd>{b.oyun || (b.bekledigiOyun ? `${b.bekledigiOyun} (sırada)` : '–')}</dd>
                <dt>Eğlence</dt><dd>{b.eglence != null
                    ? <><div className="sim-cubuk"><div style={{ width: `${b.eglence}%` }} /></div> {b.eglence}</> : '–'}</dd>
                <dt>Aktif siparişler</dt><dd>{toplu.length ? toplu.map(([u, a]) => `${a}× ${u}`).join(', ') : '–'}
                    {b.bekleyenSiparis && <div className="sim-uyari">Bekleyen istek: {b.bekleyenSiparis}</div>}</dd>
                <dt>Kalış süresi</dt><dd>{b.kalisDk != null ? `${b.kalisDk} dk` : '–'}</dd>
                <dt>Biriken hesap</dt><dd><strong>{db.hesap ? tl(db.hesap.toplam) : '–'}</strong>
                    {db.hesap && <small> (giriş {tl(db.hesap.giris_toplam)} + sipariş {tl(db.hesap.siparis_toplam)})</small>}</dd>
                <dt>Atanan garson</dt><dd>{b.garson || '–'}</dd>
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
        <SimPencere baslik="Oyun kütüphanesi" kapat={kapat}>
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
