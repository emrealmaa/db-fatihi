// Küçük ortak bileşenler
import { useEffect, useRef } from 'react';
import KAPAKLAR from '../kapaklar.json';

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

// VIP Kulüp rozeti (altın, kilitli): VIP oyunlar ve VIP masalar
export function VipRozet({ baslik = 'Sadece VIP üyeler oynayabilir' }) {
    return (
        <span className="etiket etiket-vip" title={baslik}>
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M3 5V3.6a3 3 0 0 1 6 0V5h.6c.5 0 .9.4.9.9v4.2c0 .5-.4.9-.9.9H2.4a.9.9 0 0 1-.9-.9V5.9c0-.5.4-.9.9-.9H3Zm1.4 0h3.2V3.6a1.6 1.6 0 0 0-3.2 0V5Z" fill="currentColor" /></svg>
            VIP
        </span>
    );
}

// Oyun listelerinde Tümü / Standart / VIP süzgeci
export const VIP_SUZGEC = [['', 'Tümü'], ['standart', 'Standart'], ['vip', 'VIP']];
export const vipSuzgecUyar = (suzgec, o) => !suzgec || (suzgec === 'vip') === !!o.vip_ozel;

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

// Oyun kutusunun piksel-art küçük görseli (scripts/kapaklar.py üretir); görseli olmayan oyunda hiçbir şey çizilmez
export const kutuGorseli = (ad) => (KAPAKLAR[ad] ? { ...KAPAKLAR[ad], src: `/kapaklar/${KAPAKLAR[ad].dosya}` } : null);
export function KutuGorseli({ ad }) {
    const g = kutuGorseli(ad);
    if (!g) return <span className="kutu-gorsel bos" aria-hidden="true" />;
    return <img className="kutu-gorsel" src={g.src} width={g.w} height={g.h} alt="" loading="lazy" />;
}
