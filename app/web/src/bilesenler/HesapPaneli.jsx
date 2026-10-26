// Hesap dökümü ve ödeme (kasiyer). Kapatınca oyun iade edilir, masa boşalır.
import { useState } from 'react';
import { gonder } from '../api.js';
import { useUygulama } from '../baglam.jsx';
import { useVeri } from '../kancalar.js';
import { tl } from '../bicim.js';
import { Durum } from './ortak.jsx';

export default function HesapPaneli({ oturumId, kapandi }) {
    const { islem } = useUygulama();
    const { veri: h, hata, yukleniyor } = useVeri(`/oturumlar/${oturumId}/hesap`, { aralik: 10000 });
    const [onay, setOnay] = useState(null);   // 'NAKIT' | 'KART'
    const [bekliyor, setBekliyor] = useState(false);

    async function kapat() {
        setBekliyor(true);
        const sonuc = await islem(() => gonder(`/oturumlar/${oturumId}/kapat`, { odemeTuru: onay }));
        setBekliyor(false);
        if (sonuc) kapandi?.(sonuc.toplam, onay);
        else setOnay(null);
    }

    return (
        <Durum yukleniyor={yukleniyor && !h} hata={hata}>
            {h && (
                <div className="hesap">
                    <p className="soluk">Masa {h.masa_no} · {h.musteri} · {h.kisi_sayisi} kişi</p>
                    <table className="tablo">
                        <tbody>
                            <tr><td>Giriş ({h.kisi_sayisi} × {tl(h.giris_ucreti)})</td><td className="sag">{tl(h.giris_toplam)}</td></tr>
                            {h.kalemler.map((k) => (
                                <tr key={k.siparis_id}><td>{k.adet} × {k.urun}</td><td className="sag">{tl(k.tutar)}</td></tr>
                            ))}
                            {h.indirim > 0 && <tr><td>İndirim</td><td className="sag">−{tl(h.indirim)}</td></tr>}
                        </tbody>
                        <tfoot><tr><th>Toplam</th><th className="sag hesap-toplam">{tl(h.toplam)}</th></tr></tfoot>
                    </table>
                    {!onay ? (
                        <div className="odeme-dugmeleri">
                            <button className="dugme dugme-ana" onClick={() => setOnay('NAKIT')}>Nakit al</button>
                            <button className="dugme dugme-ana" onClick={() => setOnay('KART')}>Kart ile al</button>
                        </div>
                    ) : (
                        <div className="onay-kutu">
                            <p><strong>{tl(h.toplam)}</strong> {onay === 'NAKIT' ? 'nakit' : 'kart ile'} tahsil edilip masa kapatılsın mı?</p>
                            <div className="satir">
                                <button className="dugme dugme-hafif" onClick={() => setOnay(null)} disabled={bekliyor}>Vazgeç</button>
                                <button className="dugme dugme-ana" onClick={kapat} disabled={bekliyor}>Onayla ve kapat</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Durum>
    );
}
