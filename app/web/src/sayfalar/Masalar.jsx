// Masa panosu: tüm masalar tek bakışta; masaya tıklayınca açma / oyun / sıra / sipariş / hesap paneli.
import { useState } from 'react';
import { al, gonder, sil } from '../api.js';
import { useUygulama } from '../baglam.jsx';
import { useSimdi, useVeri } from '../kancalar.js';
import { gecenSure, kalanSure, saatBicim } from '../bicim.js';
import { Adet, Durum, Etiket, Modal, SayfaBaslik } from '../bilesenler/ortak.jsx';
import OyunSecici from '../bilesenler/OyunSecici.jsx';
import SiparisPaneli from '../bilesenler/SiparisPaneli.jsx';
import HesapPaneli from '../bilesenler/HesapPaneli.jsx';

export function masaDurumu(m) {
    if (m.durum === 'BOS') return { tur: 'bos', metin: 'Boş' };
    if (m.bekleme_durumu === 'SECIM_HAKKI') return { tur: 'hak', metin: 'Seçim hakkı' };
    if (m.bekleme_durumu === 'BEKLIYOR') return { tur: 'sira', metin: 'Sırada' };
    if (m.oynanan_oyun) return { tur: 'oyun', metin: 'Oynuyor' };
    return { tur: 'dolu', metin: 'Oyunsuz' };
}

export default function Masalar() {
    const { veri, hata, yukleniyor, yenile } = useVeri('/masalar', { aralik: 5000 });
    const simdi = useSimdi();
    const [seciliNo, setSeciliNo] = useState(null);
    const secili = veri?.find((m) => m.masa_no === seciliNo);

    const dolu = veri?.filter((m) => m.durum === 'DOLU').length ?? 0;
    const kisi = veri?.reduce((t, m) => t + (m.kisi_sayisi || 0), 0) ?? 0;

    return (
        <>
            <SayfaBaslik baslik="Masalar" aciklama={veri ? `${dolu}/${veri.length} masa dolu · ${kisi} misafir` : ''} />
            <Durum yukleniyor={yukleniyor && !veri} hata={hata} bos={!veri?.length} bosMesaj="Tanımlı masa yok">
                <div className="masa-izgara">
                    {veri?.map((m) => {
                        const d = masaDurumu(m);
                        return (
                            <button key={m.masa_id} className={`masa-kart masa-${d.tur}`} onClick={() => setSeciliNo(m.masa_no)}>
                                <span className="masa-no">Masa {m.masa_no}</span>
                                <span className="masa-durum">{d.metin}</span>
                                {m.durum === 'BOS' ? (
                                    <span className="soluk">{m.kapasite} kişilik</span>
                                ) : (
                                    <>
                                        <span>{m.kisi_sayisi}/{m.kapasite} kişi · {gecenSure(m.acilis, simdi)}</span>
                                        {m.oynanan_oyun && <span className="masa-oyun-adi">{m.oynanan_oyun}</span>}
                                        {d.tur === 'hak' && <span className="geri-sayim">{kalanSure(m.secim_bitis, simdi)}</span>}
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            </Durum>
            {secili && <MasaPaneli masa={secili} kapat={() => setSeciliNo(null)} yenile={yenile} />}
        </>
    );
}

function MasaPaneli({ masa, kapat, yenile }) {
    const [sekme, setSekme] = useState('masa');
    const { yetkili } = useUygulama();
    const baslik = `Masa ${masa.masa_no}`;

    if (masa.durum === 'BOS') {
        return <Modal baslik={`${baslik} · aç`} kapat={kapat}><MasaAc masa={masa} acildi={yenile} /></Modal>;
    }

    const sekmeler = [['masa', 'Masa ve oyun'], ['siparis', 'Sipariş'], ...(yetkili('KASIYER') ? [['hesap', 'Hesap']] : [])];
    return (
        <Modal baslik={baslik} kapat={kapat} genis>
            <div className="sekmeler" role="tablist">
                {sekmeler.map(([k, ad]) => (
                    <button key={k} role="tab" aria-selected={sekme === k} className={sekme === k ? 'secili' : ''}
                            onClick={() => setSekme(k)}>{ad}</button>
                ))}
            </div>
            {sekme === 'masa' && <MasaOyun masa={masa} yenile={yenile} />}
            {sekme === 'siparis' && <SiparisPaneli oturumId={masa.oturum_id} />}
            {sekme === 'hesap' && <HesapPaneli oturumId={masa.oturum_id} kapandi={() => { yenile(); kapat(); }} />}
        </Modal>
    );
}

// ---------------------------------------------------------------- masa açma
function MasaAc({ masa, acildi }) {
    const { islem } = useUygulama();
    const [kisi, setKisi] = useState(Math.min(2, masa.kapasite));
    const [telefon, setTelefon] = useState('');
    const [musteri, setMusteri] = useState(null);       // bulunan kayıtlı müşteri
    const [yeni, setYeni] = useState(null);             // yeni kayıt formu
    const [aramaHata, setAramaHata] = useState('');
    const [bekliyor, setBekliyor] = useState(false);

    async function ara(e) {
        e.preventDefault();
        setAramaHata(''); setMusteri(null); setYeni(null);
        try {
            setMusteri(await al(`/musteriler/ara?telefon=${encodeURIComponent(telefon)}`));
        } catch (err) {
            if (err.durum === 404) setYeni({ ad: '', soyad: '', email: '', ogrenci: false });
            else setAramaHata(err.message);
        }
    }

    async function ac(musterisiz = false) {
        setBekliyor(true);
        const govde = { kisiSayisi: kisi };
        if (!musterisiz && musteri) govde.kullaniciId = musteri.id;
        if (!musterisiz && yeni) govde.musteri = { ...yeni, telefon };
        const ok = await islem(() => gonder(`/masalar/${masa.masa_id}/ac`, govde), `Masa ${masa.masa_no} açıldı`);
        setBekliyor(false);
        if (ok) acildi();
    }

    const yeniGecerli = yeni && yeni.ad.trim() && yeni.soyad.trim();

    return (
        <div className="form">
            <label className="satir-etiket">
                Kişi sayısı <small className="soluk">(en fazla {masa.kapasite})</small>
                <Adet deger={kisi} degistir={setKisi} min={1} max={masa.kapasite} />
            </label>

            <form className="satir" onSubmit={ara}>
                <label className="genis">
                    Müşteri telefonu
                    <input type="tel" inputMode="tel" placeholder="05XX XXX XX XX" value={telefon}
                           onChange={(e) => { setTelefon(e.target.value); setMusteri(null); setYeni(null); }} />
                </label>
                <button className="dugme" disabled={!telefon.trim()}>Ara</button>
            </form>
            {aramaHata && <p className="form-hata">{aramaHata}</p>}

            {musteri && (
                <div className="bilgi-kutu">
                    Kayıtlı müşteri: <strong>{musteri.ad} {musteri.soyad}</strong> ({musteri.telefon})
                    {musteri.ogrenci && <> <Etiket tur="bilgi">Öğrenci</Etiket></>}
                </div>
            )}

            {yeni && (
                <fieldset className="bilgi-kutu">
                    <legend>Yeni müşteri: masa açılırken kaydedilecek</legend>
                    <div className="iki-sutun">
                        <label>Ad<input value={yeni.ad} onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} required /></label>
                        <label>Soyad<input value={yeni.soyad} onChange={(e) => setYeni({ ...yeni, soyad: e.target.value })} required /></label>
                    </div>
                    <label>E-posta <small className="soluk">(isteğe bağlı)</small>
                        <input type="email" value={yeni.email} onChange={(e) => setYeni({ ...yeni, email: e.target.value })} />
                    </label>
                    <label className="onay">
                        <input type="checkbox" checked={yeni.ogrenci} onChange={(e) => setYeni({ ...yeni, ogrenci: e.target.checked })} />
                        Öğrenci
                    </label>
                </fieldset>
            )}

            <div className="satir sag-hizali">
                <button className="dugme dugme-hafif" onClick={() => ac(true)} disabled={bekliyor}
                        title="Kayıt zorunluysa reddedilir">Müşterisiz aç</button>
                <button className="dugme dugme-ana" onClick={() => ac(false)}
                        disabled={bekliyor || !(musteri || yeniGecerli)}>Masayı aç</button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- oyun ve bekleme sırası
function MasaOyun({ masa, yenile }) {
    const { islem } = useUygulama();
    const simdi = useSimdi(masa.bekleme_durumu === 'SECIM_HAKKI');
    const sira = useVeri(masa.bekleme_id ? '/bekleme' : null, { aralik: 5000 });
    const benim = sira.veri?.find((b) => b.bekleme_id === masa.bekleme_id);
    const [bekliyor, setBekliyor] = useState(false);

    async function calistir(fn, mesaj) {
        setBekliyor(true);
        const ok = await islem(fn, mesaj);
        setBekliyor(false);
        if (ok !== undefined) yenile();
    }

    const oyunBaslat = (o) => calistir(() => gonder(`/oturumlar/${masa.oturum_id}/oyun`, { oyunId: o.oyun_id }), `${o.ad} başladı`);
    const oyunSec = (o) => calistir(() => gonder(`/bekleme/${masa.bekleme_id}/sec`, { oyunId: o.oyun_id }), `${o.ad} seçildi`);

    return (
        <div className="masa-oyun-paneli">
            <dl className="ozet">
                <div><dt>Kişi</dt><dd>{masa.kisi_sayisi}/{masa.kapasite}</dd></div>
                <div><dt>Açılış</dt><dd>{saatBicim(masa.acilis)} ({gecenSure(masa.acilis)})</dd></div>
                <div><dt>Oyun</dt><dd>{masa.oynanan_oyun || '–'}</dd></div>
            </dl>

            {masa.oynanan_oyun && (
                <div className="bilgi-kutu satir">
                    <span><strong>{masa.oynanan_oyun}</strong> · {gecenSure(masa.oyun_baslangic)} oynanıyor</span>
                    <button className="dugme" disabled={bekliyor}
                            onClick={() => calistir(() => gonder(`/oturum-oyunlar/${masa.oturum_oyun_id}/bitir`), 'Oyun iade edildi')}>
                        Oyunu iade et
                    </button>
                </div>
            )}

            {masa.bekleme_durumu === 'SECIM_HAKKI' && (
                <>
                    <div className="bilgi-kutu vurgulu">
                        Sıra bu masada! Seçim için kalan süre: <strong className="geri-sayim">{kalanSure(masa.secim_bitis, simdi)}</strong>
                    </div>
                    <OyunSecici kisiSayisi={masa.kisi_sayisi} sec={oyunSec} bekliyor={bekliyor} />
                </>
            )}

            {masa.bekleme_durumu === 'BEKLIYOR' && (
                <div className="bilgi-kutu satir">
                    <span>Bekleme sırasında{benim ? `: ${benim.sira}. sıra` : ''}. Uygun bir oyun boşalınca seçim hakkı gelecek.</span>
                    <button className="dugme dugme-hafif" disabled={bekliyor}
                            onClick={() => calistir(() => sil(`/bekleme/${masa.bekleme_id}`), 'Sıradan çıkarıldı')}>
                        Sıradan çık
                    </button>
                </div>
            )}

            {!masa.oynanan_oyun && !masa.bekleme_durumu && (
                <>
                    <div className="satir arasi">
                        <h3>Oyun başlat</h3>
                        <button className="dugme dugme-hafif" disabled={bekliyor}
                                onClick={() => calistir(() => gonder(`/oturumlar/${masa.oturum_id}/bekleme`), 'Bekleme sırasına eklendi')}>
                            İstediği oyun dolu: sıraya ekle
                        </button>
                    </div>
                    <OyunSecici kisiSayisi={masa.kisi_sayisi} sec={oyunBaslat} bekliyor={bekliyor} />
                </>
            )}
        </div>
    );
}
