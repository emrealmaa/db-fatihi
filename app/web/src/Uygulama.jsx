// Kabuk: giriş kontrolü, role göre menü ve basit hash yönlendirme (#/masalar gibi)
import { useEffect, useState } from 'react';
import { useUygulama } from './baglam.jsx';
import { ROL_ADI } from './bicim.js';
import Giris from './sayfalar/Giris.jsx';
import Masalar from './sayfalar/Masalar.jsx';
import Oyunlar from './sayfalar/Oyunlar.jsx';
import Bekleme from './sayfalar/Bekleme.jsx';
import Kasa from './sayfalar/Kasa.jsx';
import Raporlar from './sayfalar/Raporlar.jsx';
import Yonetim from './sayfalar/Yonetim.jsx';
import Simulasyon from './sayfalar/Simulasyon.jsx';

const SAYFALAR = [
    { yol: 'masalar', ad: 'Masalar', rol: 'GARSON', bilesen: Masalar },
    { yol: 'bekleme', ad: 'Bekleme sırası', rol: 'GARSON', bilesen: Bekleme },
    { yol: 'oyunlar', ad: 'Oyunlar', rol: 'GARSON', bilesen: Oyunlar },
    { yol: 'kasa', ad: 'Kasa', rol: 'KASIYER', bilesen: Kasa },
    { yol: 'raporlar', ad: 'Raporlar', rol: 'YONETICI', bilesen: Raporlar },
    { yol: 'yonetim', ad: 'Yönetim', rol: 'YONETICI', bilesen: Yonetim },
    { yol: 'simulasyon', ad: 'Simülasyon', rol: 'YONETICI', bilesen: Simulasyon, tamEkran: true },
];

function useHash() {
    const oku = () => window.location.hash.replace(/^#\/?/, '');
    const [hash, setHash] = useState(oku);
    useEffect(() => {
        const f = () => setHash(oku());
        window.addEventListener('hashchange', f);
        return () => window.removeEventListener('hashchange', f);
    }, []);
    return hash;
}

export default function Uygulama() {
    const { personel, cikis, yetkili } = useUygulama();
    const hash = useHash();
    const [menuAcik, setMenuAcik] = useState(false);

    if (!personel) return <Giris />;

    const erisilebilir = SAYFALAR.filter((s) => yetkili(s.rol));
    const [yol, ...parametreler] = hash.split('/');
    const sayfa = erisilebilir.find((s) => s.yol === yol) || erisilebilir[0];
    const Sayfa = sayfa.bilesen;

    return (
        <div className="kabuk">
            <header className="ust-cubuk">
                <a className="marka" href="#/masalar">
                    <img src="/karavana.svg" alt="" width="32" height="32" />
                    <span>Karavana</span>
                </a>
                <button className="dugme-ikon menu-dugme" onClick={() => setMenuAcik((m) => !m)}
                        aria-expanded={menuAcik} aria-label="Menü">☰</button>
                <nav className={`ana-menu ${menuAcik ? 'acik' : ''}`} onClick={() => setMenuAcik(false)}>
                    {erisilebilir.map((s) => (
                        <a key={s.yol} href={`#/${s.yol}`} className={s === sayfa ? 'secili' : ''}
                           aria-current={s === sayfa ? 'page' : undefined}>{s.ad}</a>
                    ))}
                </nav>
                <div className="kullanici">
                    <span>{personel.ad} <small className="soluk">{ROL_ADI[personel.rol]}</small></span>
                    <button className="dugme dugme-hafif" onClick={cikis}>Çıkış</button>
                </div>
            </header>
            <main className={sayfa.tamEkran ? 'icerik-tam' : 'icerik'}>
                <Sayfa parametreler={parametreler} />
            </main>
        </div>
    );
}
