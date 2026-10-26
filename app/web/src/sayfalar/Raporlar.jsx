// Yönetici raporları: oyun popülerliği, ürün satışları, personel performansı, kritik stok
import { useState } from 'react';
import { useVeri } from '../kancalar.js';
import { ROL_ADI, tl } from '../bicim.js';
import { Durum, Etiket, SayfaBaslik } from '../bilesenler/ortak.jsx';

const SEKMELER = [
    ['oyun-populerlik', 'Oyun popülerliği'],
    ['urun-satis', 'Ürün satışları'],
    ['personel-performans', 'Personel'],
    ['kritik-stok', 'Kritik stok'],
];

export default function Raporlar({ parametreler }) {
    const [sekme, setSekme] = useState(SEKMELER.some(([k]) => k === parametreler[0]) ? parametreler[0] : SEKMELER[0][0]);
    const { veri, hata, yukleniyor } = useVeri(`/raporlar/${sekme}`, { aralik: 30000 });

    return (
        <>
            <SayfaBaslik baslik="Raporlar" />
            <div className="sekmeler" role="tablist">
                {SEKMELER.map(([k, ad]) => (
                    <button key={k} role="tab" aria-selected={sekme === k} className={sekme === k ? 'secili' : ''}
                            onClick={() => { setSekme(k); window.history.replaceState(null, '', `#/raporlar/${k}`); }}>{ad}</button>
                ))}
            </div>
            <Durum yukleniyor={yukleniyor && !veri} hata={hata} bos={!veri?.length}
                   bosMesaj={sekme === 'kritik-stok' ? 'Kritik seviyede ürün yok' : 'Veri yok'}>
                {sekme === 'oyun-populerlik' && <OyunRaporu satirlar={veri} />}
                {sekme === 'urun-satis' && <UrunRaporu satirlar={veri} />}
                {sekme === 'personel-performans' && <PersonelRaporu satirlar={veri} />}
                {sekme === 'kritik-stok' && <StokRaporu satirlar={veri} />}
            </Durum>
        </>
    );
}

// Değeri en büyüğe oranla yatay çubuk
function Cubuk({ deger, enBuyuk }) {
    const oran = enBuyuk ? Math.round((deger / enBuyuk) * 100) : 0;
    return <div className="cubuk" aria-hidden="true"><div style={{ width: `${oran}%` }} /></div>;
}

function OyunRaporu({ satirlar }) {
    const enBuyuk = Math.max(...satirlar.map((s) => s.oynanma_sayisi));
    return (
        <table className="tablo">
            <thead><tr><th>Oyun</th><th className="sag">Oynanma</th><th className="cubuk-sutun" /><th className="sag">Toplam süre</th></tr></thead>
            <tbody>
                {satirlar.map((s) => (
                    <tr key={s.oyun_id}>
                        <td>{s.ad}</td><td className="sag">{s.oynanma_sayisi}</td>
                        <td className="cubuk-sutun"><Cubuk deger={s.oynanma_sayisi} enBuyuk={enBuyuk} /></td>
                        <td className="sag">{s.toplam_saat} sa</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function UrunRaporu({ satirlar }) {
    const enBuyuk = Math.max(...satirlar.map((s) => s.gelir));
    const toplam = satirlar.reduce((t, s) => t + s.gelir, 0);
    return (
        <table className="tablo">
            <thead><tr><th>Ürün</th><th>Kategori</th><th className="sag">Adet</th><th className="cubuk-sutun" /><th className="sag">Gelir</th></tr></thead>
            <tbody>
                {satirlar.map((s) => (
                    <tr key={s.urun_id}>
                        <td>{s.ad}</td><td className="soluk">{s.kategori}</td><td className="sag">{s.satilan_adet}</td>
                        <td className="cubuk-sutun"><Cubuk deger={s.gelir} enBuyuk={enBuyuk} /></td>
                        <td className="sag">{tl(s.gelir)}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot><tr><th colSpan={4}>Toplam</th><th className="sag">{tl(toplam)}</th></tr></tfoot>
        </table>
    );
}

function PersonelRaporu({ satirlar }) {
    return (
        <table className="tablo">
            <thead><tr><th>Personel</th><th>Rol</th><th className="sag">Açtığı masa</th><th className="sag">Sipariş</th>
                <th className="sag">Sipariş tutarı</th><th className="sag">Tahsilat</th></tr></thead>
            <tbody>
                {satirlar.map((s) => (
                    <tr key={s.personel_id}>
                        <td>{s.personel}</td><td>{ROL_ADI[s.rol]}</td><td className="sag">{s.acilan_masa}</td>
                        <td className="sag">{s.siparis_sayisi}</td><td className="sag">{tl(s.siparis_tutari)}</td>
                        <td className="sag">{tl(s.tahsilat)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function StokRaporu({ satirlar }) {
    return (
        <table className="tablo">
            <thead><tr><th>Ürün</th><th>Kategori</th><th className="sag">Stok</th><th className="sag">Kritik seviye</th></tr></thead>
            <tbody>
                {satirlar.map((s) => (
                    <tr key={s.urun_id}>
                        <td>{s.ad}</td><td className="soluk">{s.kategori}</td>
                        <td className="sag"><Etiket tur={s.stok === 0 ? 'hata' : 'uyari'}>{s.stok}</Etiket></td>
                        <td className="sag">{s.kritik_stok}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
