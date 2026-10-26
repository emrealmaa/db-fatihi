// Oyun seçimi. Alınabilir kopyası olan uygun oyun doğrudan başlatılır; kopyası kalmayan
// (veya sıradaki masalara ayrılmış) uygun oyun için "Sıraya gir" çıkar.
import { useMemo, useState } from 'react';
import { useVeri } from '../kancalar.js';
import { Durum } from './ortak.jsx';

export default function OyunSecici({ kisiSayisi, sec, siraya, bekliyor }) {
    const { veri, hata, yukleniyor } = useVeri('/oyunlar', { aralik: 5000 });
    const [ara, setAra] = useState('');
    const [hepsi, setHepsi] = useState(false);

    const liste = useMemo(() => {
        const a = ara.trim().toLocaleLowerCase('tr');
        return (veri || [])
            .map((o) => ({
                ...o,
                uygun: kisiSayisi >= o.min_oyuncu && kisiSayisi <= o.max_oyuncu,
                alinabilir: o.alinabilir_adet > 0,
            }))
            .filter((o) => (!a || o.ad.toLocaleLowerCase('tr').includes(a)) && (hepsi || o.uygun))
            .sort((x, y) => (y.uygun - x.uygun) || (y.alinabilir - x.alinabilir) || x.ad.localeCompare(y.ad, 'tr'));
    }, [veri, ara, hepsi, kisiSayisi]);

    return (
        <div className="oyun-secici">
            <div className="satir">
                <input type="search" placeholder="Oyun ara…" value={ara} onChange={(e) => setAra(e.target.value)} />
                <label className="onay">
                    <input type="checkbox" checked={hepsi} onChange={(e) => setHepsi(e.target.checked)} />
                    Kişi sayısına uymayanları da göster
                </label>
            </div>
            <Durum yukleniyor={yukleniyor && !veri} hata={hata} bos={!liste.length}
                   bosMesaj={`${kisiSayisi} kişiye uygun oyun yok.`}>
                <ul className="oyun-listesi">
                    {liste.map((o) => (
                        <li key={o.oyun_id} className="oyun-satir-kap">
                            <div className={`oyun-satir ${o.uygun ? '' : 'pasif'}`}>
                                <span className="oyun-ad">{o.ad}</span>
                                <span className="soluk">
                                    {o.kategori} · {o.min_oyuncu}–{o.max_oyuncu} kişi · {o.sure_dk} dk
                                    {o.bekleyen_masa > 0 && ` · sırada ${o.bekleyen_masa} masa`}
                                </span>
                                <span className={`oyun-adet ${o.alinabilir ? '' : 'yok'}`}>
                                    {o.alinabilir ? `${o.alinabilir_adet}/${o.toplam_adet} müsait` : 'Hepsi masada'}
                                </span>
                            </div>
                            {o.uygun && (o.alinabilir
                                ? <button className="dugme dugme-ana dugme-kucuk" disabled={bekliyor} onClick={() => sec(o)}>Başlat</button>
                                : siraya && <button className="dugme dugme-kucuk" disabled={bekliyor} onClick={() => siraya(o)}>Sıraya gir</button>)}
                        </li>
                    ))}
                </ul>
            </Durum>
        </div>
    );
}
