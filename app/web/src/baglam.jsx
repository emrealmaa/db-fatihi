// Uygulama geneli durum: giriş yapan personel ve bildirimler
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, kayitliOturum, oturumDusunce, oturumuKaydet, tokenAyarla } from './api.js';

const Baglam = createContext(null);
export const useUygulama = () => useContext(Baglam);

export const SEVIYE = { GARSON: 1, KASIYER: 2, YONETICI: 3 };

export function UygulamaSaglayici({ children }) {
    const [personel, setPersonel] = useState(() => kayitliOturum()?.personel || null);
    const [bildirimler, setBildirimler] = useState([]);
    const sayac = useRef(0);

    const bildir = useCallback((mesaj, tur = 'bilgi') => {
        const id = ++sayac.current;
        setBildirimler((b) => [...b, { id, mesaj, tur }]);
        setTimeout(() => setBildirimler((b) => b.filter((x) => x.id !== id)), tur === 'hata' ? 6000 : 3500);
    }, []);

    const cikis = useCallback(() => {
        tokenAyarla(null);
        oturumuKaydet(null);
        setPersonel(null);
    }, []);

    useEffect(() => {
        oturumDusunce(() => {
            cikis();
            bildir('Oturumunuzun süresi doldu, tekrar giriş yapın', 'hata');
        });
    }, [cikis, bildir]);

    const giris = useCallback(async (kullaniciAdi, parola) => {
        const { token, personel: p } = await api('POST', '/giris', { kullaniciAdi, parola });
        tokenAyarla(token);
        oturumuKaydet({ token, personel: p });
        setPersonel(p);
    }, []);

    // İşlem çalıştır: hata olursa bildirim göster, başarılıysa isteğe bağlı mesaj
    const islem = useCallback(async (fn, basariMesaji) => {
        try {
            const sonuc = await fn();
            if (basariMesaji) bildir(basariMesaji, 'basari');
            return sonuc;
        } catch (e) {
            bildir(e.message, 'hata');
            return undefined;
        }
    }, [bildir]);

    const yetkili = (rol) => personel && SEVIYE[personel.rol] >= SEVIYE[rol];

    return (
        <Baglam.Provider value={{ personel, giris, cikis, bildir, islem, yetkili }}>
            {children}
            <div className="bildirimler" role="status" aria-live="polite">
                {bildirimler.map((b) => <div key={b.id} className={`bildirim bildirim-${b.tur}`}>{b.mesaj}</div>)}
            </div>
        </Baglam.Provider>
    );
}
