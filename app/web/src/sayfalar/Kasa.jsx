// Kasa: açık hesaplar, hesap dökümü ve ödeme; günün cirosu
import { useState } from 'react';
import { useUygulama } from '../baglam.jsx';
import { useSimdi, useVeri } from '../kancalar.js';
import { gecenSure, tarihBicim, tl } from '../bicim.js';
import { Durum, Modal, SayfaBaslik } from '../bilesenler/ortak.jsx';
import HesapPaneli from '../bilesenler/HesapPaneli.jsx';

export default function Kasa() {
    const { bildir } = useUygulama();
    const hesaplar = useVeri('/hesaplar', { aralik: 10000 });
    const ciro = useVeri('/raporlar/ciro', { aralik: 30000 });
    const simdi = useSimdi();
    const [secili, setSecili] = useState(null);

    const bugun = yerelGun(new Date());
    const bugunCiro = ciro.veri?.find((c) => c.gun === bugun);
    const acikToplam = hesaplar.veri?.reduce((t, h) => t + h.toplam, 0) ?? 0;

    function kapandi(toplam, tur) {
        bildir(`Masa ${secili.masa_no} kapatıldı: ${tl(toplam)} ${tur === 'NAKIT' ? 'nakit' : 'kart'}`, 'basari');
        setSecili(null);
        hesaplar.yenile();
        ciro.yenile();
    }

    return (
        <>
            <SayfaBaslik baslik="Kasa" />
            <div className="kartlar">
                <div className="sayi-kart"><span>Bugünkü ciro</span><strong>{tl(bugunCiro?.ciro ?? 0)}</strong>
                    <small className="soluk">Nakit {tl(bugunCiro?.nakit ?? 0)} · Kart {tl(bugunCiro?.kart ?? 0)}</small></div>
                <div className="sayi-kart"><span>Kapanan hesap</span><strong>{bugunCiro?.hesap_sayisi ?? 0}</strong></div>
                <div className="sayi-kart"><span>Açık hesaplar</span><strong>{tl(acikToplam)}</strong>
                    <small className="soluk">{hesaplar.veri?.length ?? 0} masa</small></div>
            </div>

            <h2>Açık hesaplar</h2>
            <Durum yukleniyor={hesaplar.yukleniyor && !hesaplar.veri} hata={hesaplar.hata} bos={!hesaplar.veri?.length} bosMesaj="Açık hesap yok">
                <table className="tablo tablo-tiklanir">
                    <thead><tr><th>Masa</th><th>Müşteri</th><th>Kişi</th><th>Süre</th><th className="sag">Giriş</th><th className="sag">Sipariş</th><th className="sag">Toplam</th></tr></thead>
                    <tbody>
                        {hesaplar.veri?.map((h) => (
                            <tr key={h.oturum_id} onClick={() => setSecili(h)} tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && setSecili(h)}>
                                <td><strong>{h.masa_no}</strong></td><td>{h.musteri}</td><td>{h.kisi_sayisi}</td>
                                <td>{gecenSure(h.acilis, simdi)}</td>
                                <td className="sag">{tl(h.giris_toplam)}</td><td className="sag">{tl(h.siparis_toplam)}</td>
                                <td className="sag"><strong>{tl(h.toplam)}</strong></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Durum>

            <h2>Son günler</h2>
            <Durum yukleniyor={ciro.yukleniyor && !ciro.veri} hata={ciro.hata} bos={!ciro.veri?.length} bosMesaj="Henüz ödeme yok">
                <table className="tablo">
                    <thead><tr><th>Gün</th><th className="sag">Hesap</th><th className="sag">Nakit</th><th className="sag">Kart</th><th className="sag">Ciro</th></tr></thead>
                    <tbody>
                        {ciro.veri?.map((c) => (
                            <tr key={c.gun}>
                                <td>{tarihBicim(`${c.gun}T00:00`)}</td><td className="sag">{c.hesap_sayisi}</td>
                                <td className="sag">{tl(c.nakit ?? 0)}</td><td className="sag">{tl(c.kart ?? 0)}</td>
                                <td className="sag"><strong>{tl(c.ciro)}</strong></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Durum>

            {secili && (
                <Modal baslik={`Masa ${secili.masa_no} · hesap`} kapat={() => setSecili(null)}>
                    <HesapPaneli oturumId={secili.oturum_id} kapandi={kapandi} />
                </Modal>
            )}
        </>
    );
}

// API günü 'YYYY-MM-DD' metni olarak verir; bugünü aynı biçimde (yerel saatle) üret
function yerelGun(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
