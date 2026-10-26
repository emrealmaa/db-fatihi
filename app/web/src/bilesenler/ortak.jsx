// Küçük ortak bileşenler
import { useEffect, useRef } from 'react';

export function Modal({ baslik, kapat, children, genis = false }) {
    const ref = useRef(null);
    useEffect(() => {
        const esc = (e) => e.key === 'Escape' && kapat();
        document.addEventListener('keydown', esc);
        ref.current?.focus();
        return () => document.removeEventListener('keydown', esc);
    }, [kapat]);
    return (
        <div className="modal-arka" onMouseDown={(e) => e.target === e.currentTarget && kapat()}>
            <div className={`modal ${genis ? 'modal-genis' : ''}`} role="dialog" aria-modal="true"
                 aria-label={baslik} tabIndex={-1} ref={ref}>
                <header className="modal-baslik">
                    <h2>{baslik}</h2>
                    <button className="dugme-ikon" onClick={kapat} aria-label="Kapat">×</button>
                </header>
                <div className="modal-icerik">{children}</div>
            </div>
        </div>
    );
}

// Yükleniyor / hata / boş durumlarını tek yerde ele alır
export function Durum({ yukleniyor, hata, bos, bosMesaj = 'Kayıt yok', children }) {
    if (hata) return <p className="durum durum-hata">{hata}</p>;
    if (yukleniyor) return <p className="durum">Yükleniyor…</p>;
    if (bos) return <p className="durum">{bosMesaj}</p>;
    return children;
}

export function Etiket({ tur = 'notr', children }) {
    return <span className={`etiket etiket-${tur}`}>{children}</span>;
}

export function SayfaBaslik({ baslik, aciklama, children }) {
    return (
        <div className="sayfa-baslik">
            <div>
                <h1>{baslik}</h1>
                {aciklama && <p className="soluk">{aciklama}</p>}
            </div>
            {children && <div className="sayfa-eylemler">{children}</div>}
        </div>
    );
}

export function Adet({ deger, degistir, min = 0, max = 99 }) {
    return (
        <div className="adet">
            <button type="button" onClick={() => degistir(Math.max(min, deger - 1))} disabled={deger <= min} aria-label="Azalt">−</button>
            <span>{deger}</span>
            <button type="button" onClick={() => degistir(Math.min(max, deger + 1))} disabled={deger >= max} aria-label="Artır">+</button>
        </div>
    );
}
