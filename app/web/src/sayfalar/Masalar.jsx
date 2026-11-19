// Masa panosu: tüm masalar tek bakışta; masaya tıklayınca açma / oyun / sıra / sipariş / hesap paneli.
import { useState } from 'react';
import { al, gonder, sil } from '../api.js';
import { useUygulama } from '../baglam.jsx';
import { useSimdi, useVeri } from '../kancalar.js';
import { gecenSure, KAT_ADI, kalanSure, saatBicim } from '../bicim.js';
import { Adet, Durum, Etiket, Modal, SayfaBaslik, VipRozet } from '../bilesenler/ortak.jsx';
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

// Durumların pano üzerindeki sırası (lejant ve süzgeç)
const DURUM_SIRASI = [['hak', 'Seçim hakkı'], ['sira', 'Sırada'], ['dolu', 'Oyunsuz'], ['oyun', 'Oynuyor'], ['bos', 'Boş']];

export default function Masalar() {
    const { veri, hata, yukleniyor, yenile } = useVeri('/masalar', { aralik: 5000 });
    const simdi = useSimdi();
    const [seciliNo, setSeciliNo] = useState(null);
    const [suzgec, setSuzgec] = useState(null);       // yalnızca bu durumdaki masaları öne çıkar
    const secili = veri?.find((m) => m.masa_no === seciliNo);

    const dolu = veri?.filter((m) => m.durum === 'DOLU').length ?? 0;
    const kisi = veri?.reduce((t, m) => t + (m.kisi_sayisi || 0), 0) ?? 0;
    const sayilar = {};
    for (const m of veri || []) { const t = masaDurumu(m).tur; sayilar[t] = (sayilar[t] || 0) + 1; }

    return (
        <>
            <SayfaBaslik baslik="Masalar" aciklama={veri ? `${dolu}/${veri.length} masa dolu · ${kisi} misafir` : ''}>
                {veri && (
                    <div className="durum-suzgec" role="group" aria-label="Duruma göre öne çıkar">
                        {DURUM_SIRASI.filter(([t]) => sayilar[t]).map(([t, ad]) => (
                            <button key={t} className={`durum-cip cip-${t}`} aria-pressed={suzgec === t}
                                    onClick={() => setSuzgec((s) => (s === t ? null : t))}>
                                <i aria-hidden="true" />{ad}<b>{sayilar[t]}</b>
                            </button>
                        ))}
                    </div>
                )}
            </SayfaBaslik>
            <Durum yukleniyor={yukleniyor && !veri} hata={hata} bos={!veri?.length} bosMesaj="Tanımlı masa yok"
                   bosIpucu="Masalar Yönetim › Masalar sekmesinden eklenir." iskelet={<MasaIskeleti />}>
                {[1, 2, 3].filter((k) => veri?.some((m) => m.kat === k)).map((k) => (
                <section key={k} className="kat-bolum">
                <h2>{KAT_ADI[k]}{veri.some((m) => m.kat === k && m.vip_masa) && <VipRozet baslik="Bu katta yalnızca VIP üyeler oturabilir" />}</h2>
                <div className="masa-izgara">
                    {veri.filter((m) => m.kat === k).map((m) => {
                        const d = masaDurumu(m);
                        const soluk = suzgec && suzgec !== d.tur;
                        return (
                            <button key={m.masa_id} className={`masa-kart masa-${d.tur}${m.vip_masa ? ' masa-vip' : ''}${soluk ? ' masa-soluk' : ''}`}
                                    onClick={() => setSeciliNo(m.masa_no)}
                                    aria-label={`Masa ${m.masa_no}, ${d.metin}${m.oynanan_oyun ? `, ${m.oynanan_oyun}` : ''}`}>
                                <span className="masa-ust">
                                    <span className="masa-no">{m.masa_no}{m.vip_masa && <VipRozet baslik="VIP masa: yalnızca VIP üyeler oturabilir" />}</span>
                                    <span className="masa-durum"><i aria-hidden="true" />{d.metin}</span>
                                </span>
                                {m.durum === 'BOS' ? (
                                    <span className="masa-meta">{m.kapasite} kişilik</span>
                                ) : (
                                    <span className="masa-meta">{m.kisi_sayisi}/{m.kapasite} kişi · {gecenSure(m.acilis, simdi)}</span>
                                )}
                                {m.oynanan_oyun && <span className="masa-oyun-adi">{m.oynanan_oyun}</span>}
                                {d.tur === 'sira' && m.beklenen_oyun && <span className="masa-oyun-adi">{m.beklenen_oyun} bekleniyor</span>}
                                {d.tur === 'hak' && (
                                    <span className="masa-oyun-adi">{m.beklenen_oyun} · <span className="geri-sayim">{kalanSure(m.secim_bitis, simdi)}</span></span>
                                )}
                            </button>
                        );
                    })}
                </div>
                </section>
                ))}
            </Durum>
            {secili && <MasaPaneli masa={secili} kapat={() => setSeciliNo(null)} yenile={yenile} />}
        </>
    );
}

function MasaIskeleti() {
    return (
        <div className="masa-izgara" aria-busy="true" aria-label="Masalar yükleniyor">
            {Array.from({ length: 12 }, (_, i) => <span key={i} className="masa-kart iskelet" />)}
        </div>
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
    const [ogrenci, setOgrenci] = useState(0);
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
        const govde = { kisiSayisi: kisi, ogrenciSayisi: Math.min(ogrenci, kisi) };
        if (!musterisiz && musteri) govde.kullaniciId = musteri.id;
        if (!musterisiz && yeni) govde.musteri = { ...yeni, telefon };
        const ok = await islem(() => gonder(`/masalar/${masa.masa_id}/ac`, govde), `Masa ${masa.masa_no} açıldı`);
        setBekliyor(false);
        if (ok) acildi();
    }

    const yeniGecerli = yeni && yeni.ad.trim() && yeni.soyad.trim();

    return (
        <div className="form">
            <div className="satir-etiket">
                <span className="etiket-metin">Kişi sayısı <small className="soluk">En fazla {masa.kapasite}</small></span>
                <Adet deger={kisi} degistir={setKisi} min={1} max={masa.kapasite} etiket="Kişi sayısı" />
            </div>
            <div className="satir-etiket">
                <span className="etiket-metin">Öğrenci <small className="soluk">Giriş ücretinde öğrenci indirimi uygulanır</small></span>
                <Adet deger={Math.min(ogrenci, kisi)} degistir={setOgrenci} min={0} max={kisi} etiket="Öğrenci sayısı" />
            </div>

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
    const siraya = (o) => calistir(() => gonder(`/oturumlar/${masa.oturum_id}/bekleme`, { oyunId: o.oyun_id }), `${o.ad} sırasına eklendi`);
    const oyunuAl = () => calistir(() => gonder(`/bekleme/${masa.bekleme_id}/sec`), `${masa.beklenen_oyun} masaya verildi`);
    const siradanCik = () => calistir(() => sil(`/bekleme/${masa.bekleme_id}`), 'Sıradan çıkarıldı');

    return (
        <div className="masa-oyun-paneli">
            <dl className="ozet">
                <div><dt>Kişi</dt><dd>{masa.kisi_sayisi}/{masa.kapasite}</dd></div>
                <div><dt>Açılış</dt><dd>{saatBicim(masa.acilis)} ({gecenSure(masa.acilis)})</dd></div>
                <div><dt>Oyun</dt><dd>{masa.oynanan_oyun || '–'}</dd></div>
                <div><dt>Üyelik</dt><dd>{masa.musteri_vip ? <VipRozet baslik="VIP Kulüp üyesi: VIP oyunları oynayabilir" /> : 'Standart'}</dd></div>
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
                <div className="bilgi-kutu vurgulu satir">
                    <span>
                        <strong>{masa.beklenen_oyun}</strong> bu masa için ayrıldı. Kalan süre:{' '}
                        <strong className="geri-sayim">{kalanSure(masa.secim_bitis, simdi)}</strong>
                    </span>
                    <div className="satir">
                        <button className="dugme dugme-hafif" disabled={bekliyor} onClick={siradanCik}>Vazgeç</button>
                        <button className="dugme dugme-ana" disabled={bekliyor} onClick={oyunuAl}>Oyunu al</button>
                    </div>
                </div>
            )}

            {masa.bekleme_durumu === 'BEKLIYOR' && (
                <div className="bilgi-kutu satir">
                    <span>
                        <strong>{masa.beklenen_oyun}</strong> sırasında{benim ? `: ${benim.oyun_sira}. sıra` : ''}.
                        Bir kopya boşalınca bu masaya ayrılacak.
                    </span>
                    <button className="dugme dugme-hafif" disabled={bekliyor} onClick={siradanCik}>Sıradan çık</button>
                </div>
            )}

            {!masa.oynanan_oyun && masa.bekleme_durumu !== 'SECIM_HAKKI' && (
                <>
                    <h3>{masa.bekleme_durumu ? 'Beklerken başka bir oyun başlat' : 'Oyun başlat'}</h3>
                    <OyunSecici kisiSayisi={masa.kisi_sayisi} sec={oyunBaslat} vipUye={masa.musteri_vip}
                                siraya={masa.bekleme_durumu ? null : siraya} bekliyor={bekliyor} />
                </>
            )}
        </div>
    );
}
