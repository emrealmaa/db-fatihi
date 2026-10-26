// Bekleme sırası: her oyunun kendi sırası. Bir kopya boşalınca o oyunu bekleyen ilk masaya
// ayrılır (seçim hakkı); süre dolarsa masa o oyunun sırasının sonuna gider.
import { useMemo, useState } from 'react';
import { gonder, sil } from '../api.js';
import { useUygulama } from '../baglam.jsx';
import { useSimdi, useVeri } from '../kancalar.js';
import { gecenSure, kalanSure } from '../bicim.js';
import { Durum, Etiket, SayfaBaslik } from '../bilesenler/ortak.jsx';

export default function Bekleme() {
    const { islem } = useUygulama();
    const { veri, hata, yukleniyor, yenile } = useVeri('/bekleme', { aralik: 3000 });
    const simdi = useSimdi();
    const [bekliyor, setBekliyor] = useState(false);

    // Oyuna göre grupla; seçim hakkı olan oyunlar önce
    const gruplar = useMemo(() => {
        const m = new Map();
        for (const b of veri || []) {
            if (!m.has(b.oyun_id)) m.set(b.oyun_id, { oyun: b.oyun, satirlar: [] });
            m.get(b.oyun_id).satirlar.push(b);
        }
        return [...m.values()]
            .map((g) => ({ ...g, satirlar: g.satirlar.sort((x, y) => x.oyun_sira - y.oyun_sira) }))
            .sort((x, y) => (y.satirlar[0].durum === 'SECIM_HAKKI') - (x.satirlar[0].durum === 'SECIM_HAKKI') || x.oyun.localeCompare(y.oyun, 'tr'));
    }, [veri]);

    async function calistir(fn, mesaj) {
        setBekliyor(true);
        const ok = await islem(fn, mesaj);
        setBekliyor(false);
        if (ok !== undefined) yenile();
    }

    return (
        <>
            <SayfaBaslik baslik="Bekleme sırası"
                         aciklama="Her oyunun kendi sırası var. Bir kopya boşalınca o oyunu bekleyen ilk masaya ayrılır; süre dolarsa masa o oyunun sırasının sonuna gider." />
            <Durum yukleniyor={yukleniyor && !veri} hata={hata} bos={!gruplar.length} bosMesaj="Sırada bekleyen masa yok">
                {gruplar.map((g) => (
                    <section key={g.oyun} className="sira-grup">
                        <h2>{g.oyun} <small className="soluk">· {g.satirlar.length} masa</small></h2>
                        <ol className="sira-listesi">
                            {g.satirlar.map((b) => {
                                const hak = b.durum === 'SECIM_HAKKI';
                                return (
                                    <li key={b.bekleme_id} className={hak ? 'hak' : ''}>
                                        <span className="sira-no">{b.oyun_sira}</span>
                                        <div className="sira-bilgi">
                                            <strong>Masa {b.masa_no}</strong>
                                            <span className="soluk">{b.kisi_sayisi} kişi · {gecenSure(b.olusturma, simdi)} bekliyor</span>
                                        </div>
                                        {hak
                                            ? <Etiket tur="uyari">Kopya ayrıldı · <span className="geri-sayim">{kalanSure(b.secim_bitis, simdi)}</span></Etiket>
                                            : <Etiket>Bekliyor</Etiket>}
                                        <div className="satir">
                                            {hak && (
                                                <button className="dugme dugme-ana" disabled={bekliyor}
                                                        onClick={() => calistir(() => gonder(`/bekleme/${b.bekleme_id}/sec`), `Masa ${b.masa_no}: ${b.oyun}`)}>
                                                    Oyunu ver
                                                </button>
                                            )}
                                            <button className="dugme dugme-hafif" disabled={bekliyor}
                                                    onClick={() => calistir(() => sil(`/bekleme/${b.bekleme_id}`), `Masa ${b.masa_no} sıradan çıkarıldı`)}>
                                                Sıradan çıkar
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                ))}
            </Durum>
        </>
    );
}
