// Ortak React kancaları
import { useCallback, useEffect, useRef, useState } from 'react';
import { al } from './api.js';

// GET isteği; aralik verilirse düzenli yenilenir (masa panosu, bekleme sırası gibi canlı ekranlar için)
export function useVeri(yol, { aralik = 0 } = {}) {
    const [veri, setVeri] = useState(null);
    const [hata, setHata] = useState(null);
    const [yukleniyor, setYukleniyor] = useState(true);
    const aktif = useRef(true);

    const yenile = useCallback(async () => {
        if (!yol) return;
        try {
            const v = await al(yol);
            if (aktif.current) { setVeri(v); setHata(null); }
        } catch (e) {
            if (aktif.current) setHata(e.message);
        } finally {
            if (aktif.current) setYukleniyor(false);
        }
    }, [yol]);

    useEffect(() => {
        aktif.current = true;
        setYukleniyor(true);
        yenile();
        if (!aralik) return () => { aktif.current = false; };
        const t = setInterval(yenile, aralik);
        return () => { aktif.current = false; clearInterval(t); };
    }, [yenile, aralik]);

    return { veri, hata, yukleniyor, yenile };
}

// Her saniye güncellenen şimdiki zaman (geri sayımlar için)
export function useSimdi(aktifMi = true) {
    const [simdi, setSimdi] = useState(() => Date.now());
    useEffect(() => {
        if (!aktifMi) return undefined;
        const t = setInterval(() => setSimdi(Date.now()), 1000);
        return () => clearInterval(t);
    }, [aktifMi]);
    return simdi;
}
