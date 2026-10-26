// Bekleme sırası: seçim hakkı olan masa en üstte, geri sayımla. Seçim buradan da yapılabilir.
import { useState } from 'react';
import { gonder, sil } from '../api.js';
import { useUygulama } from '../baglam.jsx';
import { useSimdi, useVeri } from '../kancalar.js';
import { gecenSure, kalanSure } from '../bicim.js';
import { Durum, Etiket, Modal, SayfaBaslik } from '../bilesenler/ortak.jsx';
import OyunSecici from '../bilesenler/OyunSecici.jsx';

export default function Bekleme() {
    const { islem } = useUygulama();
    const { veri, hata, yukleniyor, yenile } = useVeri('/bekleme', { aralik: 3000 });
    const simdi = useSimdi();
    const [secen, setSecen] = useState(null);
    const [bekliyor, setBekliyor] = useState(false);

    async function calistir(fn, mesaj) {
        setBekliyor(true);
        const ok = await islem(fn, mesaj);
        setBekliyor(false);
        if (ok !== undefined) { setSecen(null); yenile(); }
    }

    return (
        <>
            <SayfaBaslik baslik="Bekleme sırası"
                         aciklama="Bir oyun iade edilince, kişi sayısına uygun oyun bulunan ilk masaya seçim hakkı geçer. Süre dolarsa masa sıranın sonuna gider." />
            <Durum yukleniyor={yukleniyor && !veri} hata={hata} bos={!veri?.length} bosMesaj="Sırada bekleyen masa yok">
                <ol className="sira-listesi">
                    {veri?.map((b) => {
                        const hak = b.durum === 'SECIM_HAKKI';
                        return (
                            <li key={b.bekleme_id} className={hak ? 'hak' : ''}>
                                <span className="sira-no">{b.sira}</span>
                                <div className="sira-bilgi">
                                    <strong>Masa {b.masa_no}</strong>
                                    <span className="soluk">{b.kisi_sayisi} kişi · {gecenSure(b.olusturma, simdi)} bekliyor</span>
                                </div>
                                {hak
                                    ? <Etiket tur="uyari">Seçim hakkı · <span className="geri-sayim">{kalanSure(b.secim_bitis, simdi)}</span></Etiket>
                                    : <Etiket>Bekliyor</Etiket>}
                                <div className="satir">
                                    {hak && <button className="dugme dugme-ana" onClick={() => setSecen(b)}>Oyun seç</button>}
                                    <button className="dugme dugme-hafif" disabled={bekliyor}
                                            onClick={() => calistir(() => sil(`/bekleme/${b.bekleme_id}`), `Masa ${b.masa_no} sıradan çıkarıldı`)}>
                                        Sıradan çıkar
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </Durum>
            {secen && (
                <Modal baslik={`Masa ${secen.masa_no} · oyun seç`} kapat={() => setSecen(null)} genis>
                    <OyunSecici kisiSayisi={secen.kisi_sayisi} bekliyor={bekliyor}
                                sec={(o) => calistir(() => gonder(`/bekleme/${secen.bekleme_id}/sec`, { oyunId: o.oyun_id }), `Masa ${secen.masa_no}: ${o.ad}`)} />
                </Modal>
            )}
        </>
    );
}
