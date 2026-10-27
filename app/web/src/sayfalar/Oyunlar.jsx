// Oyun kataloğu: müsait adetler, kişi sayısı, kategori ve VIP/standart süzgeci
import { useMemo, useState } from 'react';
import { useVeri } from '../kancalar.js';
import { Durum, Etiket, SayfaBaslik, VIP_SUZGEC, VipRozet, vipSuzgecUyar } from '../bilesenler/ortak.jsx';

export default function Oyunlar() {
    const { veri, hata, yukleniyor } = useVeri('/oyunlar', { aralik: 10000 });
    const [ara, setAra] = useState('');
    const [kisi, setKisi] = useState('');
    const [kategori, setKategori] = useState('');
    const [musaitMi, setMusaitMi] = useState(false);
    const [tur, setTur] = useState('');

    const kategoriler = useMemo(() => [...new Set((veri || []).map((o) => o.kategori))].sort((a, b) => a.localeCompare(b, 'tr')), [veri]);
    const liste = useMemo(() => {
        const a = ara.trim().toLocaleLowerCase('tr');
        const k = Number(kisi);
        return (veri || []).filter((o) =>
            (!a || o.ad.toLocaleLowerCase('tr').includes(a))
            && (!k || (k >= o.min_oyuncu && k <= o.max_oyuncu))
            && (!kategori || o.kategori === kategori)
            && (!musaitMi || o.musait_adet > 0)
            && vipSuzgecUyar(tur, o));
    }, [veri, ara, kisi, kategori, musaitMi, tur]);

    const toplamKopya = veri?.reduce((t, o) => t + o.toplam_adet, 0) ?? 0;
    const masada = veri?.reduce((t, o) => t + (o.toplam_adet - o.musait_adet), 0) ?? 0;
    const vipSayisi = veri?.filter((o) => o.vip_ozel).length ?? 0;

    return (
        <>
            <SayfaBaslik baslik="Oyunlar" aciklama={veri ? `${veri.length} oyun (${vipSayisi} VIP) · ${toplamKopya} kopya · ${masada} kopya masada` : ''}>
                <div className="segmentli" role="group" aria-label="Oyun türü">
                    {VIP_SUZGEC.map(([k, ad]) => <button key={k} className={tur === k ? 'secili' : ''} aria-pressed={tur === k} onClick={() => setTur(k)}>{ad}</button>)}
                </div>
            </SayfaBaslik>
            <div className="filtreler">
                <input type="search" placeholder="Oyun ara…" value={ara} onChange={(e) => setAra(e.target.value)} aria-label="Oyun ara" />
                <input type="number" min="1" max="20" placeholder="Kişi sayısı" value={kisi} onChange={(e) => setKisi(e.target.value)} aria-label="Kişi sayısı" />
                <select value={kategori} onChange={(e) => setKategori(e.target.value)} aria-label="Kategori">
                    <option value="">Tüm kategoriler</option>
                    {kategoriler.map((k) => <option key={k}>{k}</option>)}
                </select>
                <label className="onay"><input type="checkbox" checked={musaitMi} onChange={(e) => setMusaitMi(e.target.checked)} /> Yalnızca müsait</label>
            </div>
            <Durum yukleniyor={yukleniyor && !veri} hata={hata} bos={!liste.length} bosMesaj="Filtreye uyan oyun yok">
                <table className="tablo">
                    <thead><tr><th>Oyun</th><th>Kategori</th><th>Kişi</th><th>Süre</th><th>Zorluk</th><th className="sag">Müsait</th></tr></thead>
                    <tbody>
                        {liste.map((o) => (
                            <tr key={o.oyun_id}>
                                <td>
                                    <strong>{o.ad}</strong>{o.vip_ozel && <VipRozet />}
                                    {o.vip_ozel && <span className="vip-not">Sadece VIP üyeler oynayabilir</span>}
                                </td>
                                <td>{o.kategori}</td>
                                <td>{o.min_oyuncu}–{o.max_oyuncu}</td>
                                <td>{o.sure_dk} dk</td>
                                <td title={`${o.zorluk} / 5`}>{'★'.repeat(o.zorluk)}<span className="soluk">{'★'.repeat(5 - o.zorluk)}</span></td>
                                <td className="sag">
                                    {o.musait_adet > 0
                                        ? <Etiket tur="basari">{o.musait_adet}/{o.toplam_adet}</Etiket>
                                        : <Etiket tur="hata">0/{o.toplam_adet}</Etiket>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Durum>
        </>
    );
}
