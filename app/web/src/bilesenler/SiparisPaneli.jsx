// Masanın siparişleri: kategorilere ayrılmış menüden sepet oluşturup tek seferde gönderir.
import { useMemo, useState } from 'react';
import { gonder, sil } from '../api.js';
import { useUygulama } from '../baglam.jsx';
import { useVeri } from '../kancalar.js';
import { saatBicim, tl } from '../bicim.js';
import { Adet, Durum, Etiket } from './ortak.jsx';

export default function SiparisPaneli({ oturumId, degisti }) {
    const { islem } = useUygulama();
    const menu = useVeri('/menu');
    const siparisler = useVeri(`/oturumlar/${oturumId}/siparisler`);
    const [sepet, setSepet] = useState({});          // urunId -> adet
    const [kategori, setKategori] = useState(null);
    const [bekliyor, setBekliyor] = useState(false);

    const kategoriler = useMemo(() => {
        const m = new Map();
        for (const u of menu.veri || []) m.set(u.kategori_id, u.kategori);
        return [...m.entries()];
    }, [menu.veri]);
    const seciliKategori = kategori ?? kategoriler[0]?.[0];
    const urunler = (menu.veri || []).filter((u) => u.kategori_id === seciliKategori);

    const kalemler = Object.entries(sepet).filter(([, a]) => a > 0).map(([id, adet]) => ({ urunId: Number(id), adet }));
    const sepetToplam = kalemler.reduce((t, k) => t + k.adet * (menu.veri?.find((u) => u.urun_id === k.urunId)?.fiyat || 0), 0);

    async function siparisVer() {
        setBekliyor(true);
        const ok = await islem(() => gonder(`/oturumlar/${oturumId}/siparisler`, { kalemler }), 'Sipariş alındı');
        setBekliyor(false);
        if (ok) {
            setSepet({});
            siparisler.yenile();
            menu.yenile();
            degisti?.();
        }
    }

    async function iptal(s) {
        const ok = await islem(() => sil(`/siparisler/${s.siparis_id}`), `${s.urun} iptal edildi`);
        if (ok !== undefined) {
            siparisler.yenile();
            menu.yenile();
            degisti?.();
        }
    }

    return (
        <div className="siparis-paneli">
            <Durum yukleniyor={menu.yukleniyor && !menu.veri} hata={menu.hata} bos={!menu.veri?.length} bosMesaj="Menüde ürün yok">
                <div className="sekmeler" role="tablist">
                    {kategoriler.map(([id, ad]) => (
                        <button key={id} role="tab" aria-selected={id === seciliKategori}
                                className={id === seciliKategori ? 'secili' : ''} onClick={() => setKategori(id)}>{ad}</button>
                    ))}
                </div>
                <ul className="menu-listesi">
                    {urunler.map((u) => (
                        <li key={u.urun_id} className={u.stok === 0 ? 'tukendi' : ''}>
                            <div>
                                <strong>{u.ad}</strong>
                                <span className="soluk"> {tl(u.fiyat)}</span>
                                {u.stok === 0 ? <Etiket tur="hata">Tükendi</Etiket>
                                    : u.stok_az && <Etiket tur="uyari">Son {u.stok}</Etiket>}
                            </div>
                            <Adet deger={sepet[u.urun_id] || 0} max={u.stok}
                                  degistir={(a) => setSepet((s) => ({ ...s, [u.urun_id]: a }))} />
                        </li>
                    ))}
                </ul>
                <div className="sepet">
                    <span>{kalemler.length ? `${kalemler.reduce((t, k) => t + k.adet, 0)} ürün · ${tl(sepetToplam)}` : 'Sepet boş'}</span>
                    <button className="dugme dugme-ana" disabled={!kalemler.length || bekliyor} onClick={siparisVer}>Siparişi gönder</button>
                </div>
            </Durum>

            <h3>Masanın siparişleri</h3>
            <Durum yukleniyor={siparisler.yukleniyor && !siparisler.veri} hata={siparisler.hata}
                   bos={!siparisler.veri?.length} bosMesaj="Henüz sipariş yok">
                <table className="tablo">
                    <thead><tr><th>Saat</th><th>Ürün</th><th>Adet</th><th className="sag">Tutar</th><th>Alan</th><th /></tr></thead>
                    <tbody>
                        {siparisler.veri?.map((s) => (
                            <tr key={s.siparis_id}>
                                <td>{saatBicim(s.zaman)}</td><td>{s.urun}</td><td>{s.adet}</td>
                                <td className="sag">{tl(s.tutar)}</td><td className="soluk">{s.personel}</td>
                                <td className="sag"><button className="dugme dugme-hafif dugme-kucuk" onClick={() => iptal(s)}>İptal</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Durum>
        </div>
    );
}
