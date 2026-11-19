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
                    <button className="dugme-ikon" onClick={kapat} aria-label="Kapat"><Ikon ad="kapat" /></button>
                </header>
                <div className="modal-icerik">{children}</div>
            </div>
        </div>
    );
}

// Arayüz ikonları: tek çizgi kalınlığında, metin rengini alan küçük SVG'ler
const IKONLAR = {
    menu: 'M4 7h16M4 12h16M4 17h16',
    kapat: 'M6 6l12 12M18 6L6 18',
    cikis: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4',
};
export function Ikon({ ad, boyut = 20 }) {
    return (
        <svg className="ikon" width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={IKONLAR[ad]} />
        </svg>
    );
}

// Yükleniyor / hata / boş durumlarını tek yerde ele alır. bosIpucu: boş ekranın ne zaman dolacağını anlatır.
// iskelet: yükleniyorken gösterilecek yer tutucu (yoksa sade metin)
export function Durum({ yukleniyor, hata, bos, bosMesaj = 'Kayıt yok', bosIpucu, iskelet, children }) {
    if (hata) return <div className="durum durum-hata" role="alert"><strong>Veri alınamadı</strong><span>{hata}</span></div>;
    if (yukleniyor) return iskelet || <p className="durum" aria-busy="true">Yükleniyor…</p>;
    if (bos) return <div className="durum"><strong>{bosMesaj}</strong>{bosIpucu && <span>{bosIpucu}</span>}</div>;
    return children;
}

// Zorluk gibi 1–5 arası değerler için nokta ölçer
export function Olcer({ deger, en = 5, baslik }) {
    return (
        <span className="olcer" role="img" aria-label={baslik || `${deger} / ${en}`} title={baslik || `${deger} / ${en}`}>
            {Array.from({ length: en }, (_, i) => <i key={i} className={i < deger ? 'dolu' : ''} />)}
        </span>
    );
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

export function Adet({ deger, degistir, min = 0, max = 99, etiket = 'Adet' }) {
    return (
        <div className="adet" role="group" aria-label={etiket}>
            <button type="button" onClick={() => degistir(Math.max(min, deger - 1))} disabled={deger <= min} aria-label={`${etiket}: azalt`}>−</button>
            <span aria-live="polite">{deger}</span>
            <button type="button" onClick={() => degistir(Math.min(max, deger + 1))} disabled={deger >= max} aria-label={`${etiket}: artır`}>+</button>
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
