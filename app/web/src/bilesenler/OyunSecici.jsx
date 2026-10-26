// Müsait oyunlar arasından seçim. Kişi sayısına uymayan veya kopyası kalmayan oyunlar pasif görünür.
import { useMemo, useState } from 'react';
import { useVeri } from '../kancalar.js';
import { Durum } from './ortak.jsx';

export default function OyunSecici({ kisiSayisi, sec, bekliyor }) {
    const { veri, hata, yukleniyor } = useVeri('/oyunlar', { aralik: 5000 });
    const [ara, setAra] = useState('');
    const [hepsi, setHepsi] = useState(false);

    const liste = useMemo(() => {
        const a = ara.trim().toLocaleLowerCase('tr');
        return (veri || [])
            .map((o) => ({
                ...o,
                uygun: kisiSayisi >= o.min_oyuncu && kisiSayisi <= o.max_oyuncu,
                musait: o.musait_adet > 0,
            }))
            .filter((o) => (!a || o.ad.toLocaleLowerCase('tr').includes(a)) && (hepsi || (o.uygun && o.musait)))
            .sort((x, y) => (y.uygun && y.musait) - (x.uygun && x.musait) || x.ad.localeCompare(y.ad, 'tr'));
    }, [veri, ara, hepsi, kisiSayisi]);

    return (
        <div className="oyun-secici">
            <div className="satir">
                <input type="search" placeholder="Oyun ara…" value={ara} onChange={(e) => setAra(e.target.value)} />
                <label className="onay">
                    <input type="checkbox" checked={hepsi} onChange={(e) => setHepsi(e.target.checked)} />
                    Uygun olmayanları da göster
                </label>
            </div>
            <Durum yukleniyor={yukleniyor && !veri} hata={hata} bos={!liste.length}
                   bosMesaj={`${kisiSayisi} kişiye uygun müsait oyun yok. Masayı bekleme sırasına ekleyebilirsiniz.`}>
                <ul className="oyun-listesi">
                    {liste.map((o) => (
                        <li key={o.oyun_id}>
                            <button className="oyun-satir" disabled={!o.uygun || !o.musait || bekliyor} onClick={() => sec(o)}>
                                <span className="oyun-ad">{o.ad}</span>
                                <span className="soluk">{o.kategori} · {o.min_oyuncu}–{o.max_oyuncu} kişi · {o.sure_dk} dk</span>
                                <span className={`oyun-adet ${o.musait ? '' : 'yok'}`}>
                                    {o.musait ? `${o.musait_adet}/${o.toplam_adet} müsait` : 'Hepsi masada'}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </Durum>
        </div>
    );
}
