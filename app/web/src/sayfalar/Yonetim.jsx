// Yönetim: menü, oyunlar, masalar, personel ve işletme ayarları.
// Tablolar aynı düzenleyici bileşeniyle yönetilir; alanlar aşağıdaki tanımlardan gelir.
import { useState } from 'react';
import { gonder, guncelle, sil } from '../api.js';
import { useUygulama } from '../baglam.jsx';
import { useVeri } from '../kancalar.js';
import { KAT_ADI, ROL_ADI, tarihBicim, tl } from '../bicim.js';
import { Durum, Etiket, Modal, SayfaBaslik } from '../bilesenler/ortak.jsx';

const SEKMELER = [
    ['urunler', 'Menü'],
    ['oyunlar', 'Oyunlar'],
    ['masalar', 'Masalar'],
    ['personel', 'Personel'],
    ['ayar', 'Ayarlar'],
];

export default function Yonetim({ parametreler }) {
    const [sekme, setSekme] = useState(SEKMELER.some(([k]) => k === parametreler[0]) ? parametreler[0] : SEKMELER[0][0]);
    return (
        <>
            <SayfaBaslik baslik="Yönetim" />
            <div className="sekmeler" role="tablist">
                {SEKMELER.map(([k, ad]) => (
                    <button key={k} role="tab" aria-selected={sekme === k} className={sekme === k ? 'secili' : ''}
                            onClick={() => { setSekme(k); window.history.replaceState(null, '', `#/yonetim/${k}`); }}>{ad}</button>
                ))}
            </div>
            {sekme === 'urunler' && <Urunler />}
            {sekme === 'oyunlar' && <OyunYonetimi />}
            {sekme === 'masalar' && <MasaYonetimi />}
            {sekme === 'personel' && <Personel />}
            {sekme === 'ayar' && <Ayarlar />}
        </>
    );
}

// ---------------------------------------------------------------- genel düzenleyici
// alanlar: [{ ad, etiket, tur: 'metin'|'sayi'|'para'|'onay'|'secim', secenekler, zorunlu,
//            metinDeger (secim değeri sayıya çevrilmez), yalnizYeni (yalnızca eklemede gösterilir) }]
function KayitFormu({ baslik, alanlar, ilk, kaydet, kapat }) {
    const [deger, setDeger] = useState(() => Object.fromEntries(alanlar.map((a) => [a.ad, ilk?.[a.ad] ?? a.varsayilan ?? (a.tur === 'onay' ? false : '')])));
    const [bekliyor, setBekliyor] = useState(false);

    async function gonderForm(e) {
        e.preventDefault();
        setBekliyor(true);
        const govde = {};
        for (const a of alanlar) {
            let v = deger[a.ad];
            if (a.yalnizYeni && ilk) continue;
            if (a.tur === 'sayi' || a.tur === 'para' || (a.tur === 'secim' && !a.metinDeger)) v = v === '' ? null : Number(v);
            if (a.tur === 'metin' && v === '' && !a.zorunlu) v = null;
            if (ilk && ilk[a.ad] === v) continue;   // düzenlemede yalnızca değişenler
            govde[a.ad] = v;
        }
        const ok = await kaydet(govde);
        setBekliyor(false);
        if (ok !== undefined) kapat();
    }

    return (
        <Modal baslik={baslik} kapat={kapat}>
            <form className="form" onSubmit={gonderForm}>
                {alanlar.filter((a) => !(a.yalnizYeni && ilk)).map((a) => (
                    a.tur === 'onay' ? (
                        <label key={a.ad} className="onay">
                            <input type="checkbox" checked={!!deger[a.ad]} onChange={(e) => setDeger({ ...deger, [a.ad]: e.target.checked })} />
                            {a.etiket}
                        </label>
                    ) : (
                        <label key={a.ad}>
                            {a.etiket}
                            {a.tur === 'secim' ? (
                                <select value={deger[a.ad] ?? ''} required={a.zorunlu}
                                        onChange={(e) => setDeger({ ...deger, [a.ad]: e.target.value })}>
                                    <option value="" disabled>Seçin</option>
                                    {a.secenekler.map(([v, ad]) => <option key={v} value={v}>{ad}</option>)}
                                </select>
                            ) : (
                                <input type={a.tur === 'metin' ? (a.girdi || 'text') : 'number'}
                                       step={a.tur === 'para' ? '0.01' : '1'} min={a.tur === 'metin' ? undefined : 0}
                                       value={deger[a.ad] ?? ''} required={a.zorunlu}
                                       onChange={(e) => setDeger({ ...deger, [a.ad]: e.target.value })} />
                            )}
                        </label>
                    )
                ))}
                <div className="satir sag-hizali">
                    <button type="button" className="dugme dugme-hafif" onClick={kapat}>Vazgeç</button>
                    <button className="dugme dugme-ana" disabled={bekliyor}>Kaydet</button>
                </div>
            </form>
        </Modal>
    );
}

function useDuzenleyici(yol, adlandir) {
    const { islem } = useUygulama();
    const liste = useVeri(yol);
    const [form, setForm] = useState(null);   // { ilk } veya { ilk: null } (yeni)
    const kaydet = async (govde) => {
        const ok = await islem(() => (form.ilk ? guncelle(`${yol}/${form.ilk.id}`, govde) : gonder(yol, govde)),
            form.ilk ? `${adlandir(form.ilk)} güncellendi` : 'Kaydedildi');
        if (ok !== undefined) liste.yenile();
        return ok;
    };
    const kaldir = async (kayit) => {
        const ok = await islem(() => sil(`${yol}/${kayit.id}`), `${adlandir(kayit)} silindi`);
        if (ok !== undefined) liste.yenile();
    };
    const aktifDegistir = async (kayit) => {
        const ok = await islem(() => guncelle(`${yol}/${kayit.id}`, { aktif: !kayit.aktif }));
        if (ok !== undefined) liste.yenile();
    };
    return { liste, form, setForm, kaydet, kaldir, aktifDegistir };
}

// ---------------------------------------------------------------- menü
function Urunler() {
    const { islem } = useUygulama();
    const kategoriler = useVeri('/yonetim/urun-kategorileri');
    const d = useDuzenleyici('/yonetim/urunler', (u) => u.ad);
    const [kategoriFormu, setKategoriFormu] = useState(false);
    const [stokUrunu, setStokUrunu] = useState(null);
    const katAd = Object.fromEntries((kategoriler.veri || []).map((k) => [k.id, k.ad]));

    async function stokEkle({ adet }) {
        const ok = await islem(() => gonder(`/yonetim/urunler/${stokUrunu.id}/stok`, { adet }), `${stokUrunu.ad}: +${adet} stok`);
        if (ok !== undefined) d.liste.yenile();
        return ok;
    }

    const alanlar = [
        { ad: 'ad', etiket: 'Ürün adı', tur: 'metin', zorunlu: true },
        { ad: 'kategori_id', etiket: 'Kategori', tur: 'secim', zorunlu: true, secenekler: (kategoriler.veri || []).map((k) => [k.id, k.ad]) },
        { ad: 'fiyat', etiket: 'Fiyat (TL)', tur: 'para', zorunlu: true },
        { ad: 'stok', etiket: 'Stok', tur: 'sayi', varsayilan: 0 },
        { ad: 'kritik_stok', etiket: 'Kritik stok seviyesi', tur: 'sayi', varsayilan: 5 },
        { ad: 'aktif', etiket: 'Menüde', tur: 'onay', varsayilan: true },
    ];

    return (
        <>
            <div className="satir arasi">
                <p className="soluk">Satıştan kalkan ürün silinmez, “menüde” işareti kaldırılır.</p>
                <div className="satir">
                    <button className="dugme dugme-hafif" onClick={() => setKategoriFormu(true)}>Kategori ekle</button>
                    <button className="dugme dugme-ana" onClick={() => d.setForm({ ilk: null })}>Ürün ekle</button>
                </div>
            </div>
            <Durum yukleniyor={d.liste.yukleniyor && !d.liste.veri} hata={d.liste.hata} bos={!d.liste.veri?.length} bosMesaj="Menüde ürün yok">
                <table className="tablo">
                    <thead><tr><th>Ürün</th><th>Kategori</th><th className="sag">Fiyat</th><th className="sag">Stok</th><th>Durum</th><th /></tr></thead>
                    <tbody>
                        {d.liste.veri?.map((u) => (
                            <tr key={u.id} className={u.aktif ? '' : 'pasif'}>
                                <td>{u.ad}</td><td>{katAd[u.kategori_id]}</td><td className="sag">{tl(u.fiyat)}</td>
                                <td className="sag">{u.stok <= u.kritik_stok ? <Etiket tur={u.stok ? 'uyari' : 'hata'}>{u.stok}</Etiket> : u.stok}</td>
                                <td>{u.aktif ? 'Menüde' : 'Kaldırıldı'}</td>
                                <td className="sag eylemler">
                                    <button className="dugme dugme-hafif dugme-kucuk" onClick={() => setStokUrunu(u)}>+ Stok</button>
                                    <button className="dugme dugme-hafif dugme-kucuk" onClick={() => d.setForm({ ilk: u })}>Düzenle</button>
                                    <button className="dugme dugme-hafif dugme-kucuk" onClick={() => d.aktifDegistir(u)}>{u.aktif ? 'Menüden kaldır' : 'Menüye al'}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Durum>
            {d.form && <KayitFormu baslik={d.form.ilk ? `${d.form.ilk.ad} düzenle` : 'Yeni ürün'} alanlar={alanlar}
                                   ilk={d.form.ilk} kaydet={d.kaydet} kapat={() => d.setForm(null)} />}
            {stokUrunu && (
                <KayitFormu baslik={`${stokUrunu.ad} · stok girişi (şu an ${stokUrunu.stok})`} kapat={() => setStokUrunu(null)}
                            alanlar={[{ ad: 'adet', etiket: 'Eklenecek adet', tur: 'sayi', zorunlu: true, varsayilan: 10 }]}
                            kaydet={stokEkle} />
            )}
            {kategoriFormu && (
                <KayitFormu baslik="Yeni menü kategorisi" kapat={() => setKategoriFormu(false)}
                            alanlar={[{ ad: 'ad', etiket: 'Kategori adı', tur: 'metin', zorunlu: true },
                                { ad: 'sira', etiket: 'Menüdeki sırası', tur: 'sayi', varsayilan: (kategoriler.veri?.length || 0) + 1 }]}
                            kaydet={async (g) => {
                                const ok = await islem(() => gonder('/yonetim/urun-kategorileri', g), 'Kategori eklendi');
                                if (ok !== undefined) kategoriler.yenile();
                                return ok;
                            }} />
            )}
        </>
    );
}

// ---------------------------------------------------------------- oyunlar
function OyunYonetimi() {
    const { islem } = useUygulama();
    const kategoriler = useVeri('/yonetim/kategoriler');
    const d = useDuzenleyici('/yonetim/oyunlar', (o) => o.ad);
    const [kategoriFormu, setKategoriFormu] = useState(false);
    const katAd = Object.fromEntries((kategoriler.veri || []).map((k) => [k.id, k.ad]));
    const alanlar = [
        { ad: 'ad', etiket: 'Oyun adı', tur: 'metin', zorunlu: true },
        { ad: 'kategori_id', etiket: 'Kategori', tur: 'secim', zorunlu: true, secenekler: (kategoriler.veri || []).map((k) => [k.id, k.ad]) },
        { ad: 'min_oyuncu', etiket: 'En az oyuncu', tur: 'sayi', zorunlu: true, varsayilan: 2 },
        { ad: 'max_oyuncu', etiket: 'En çok oyuncu', tur: 'sayi', zorunlu: true, varsayilan: 4 },
        { ad: 'sure_dk', etiket: 'Ortalama süre (dk)', tur: 'sayi', zorunlu: true, varsayilan: 45 },
        { ad: 'toplam_adet', etiket: 'Kopya sayısı', tur: 'sayi', zorunlu: true, varsayilan: 1 },
        { ad: 'aktif', etiket: 'Rafta (oynanabilir)', tur: 'onay', varsayilan: true },
    ];
    return (
        <>
            <div className="satir arasi">
                <p className="soluk">Kullanımdan kalkan oyun silinmez, raftan kaldırılır.</p>
                <div className="satir">
                    <button className="dugme dugme-hafif" onClick={() => setKategoriFormu(true)}>Kategori ekle</button>
                    <button className="dugme dugme-ana" onClick={() => d.setForm({ ilk: null })}>Oyun ekle</button>
                </div>
            </div>
            <Durum yukleniyor={d.liste.yukleniyor && !d.liste.veri} hata={d.liste.hata} bos={!d.liste.veri?.length} bosMesaj="Oyun yok">
                <table className="tablo">
                    <thead><tr><th>Oyun</th><th>Kategori</th><th>Kişi</th><th>Süre</th><th className="sag">Kopya</th><th>Durum</th><th /></tr></thead>
                    <tbody>
                        {d.liste.veri?.map((o) => (
                            <tr key={o.id} className={o.aktif ? '' : 'pasif'}>
                                <td>{o.ad}</td><td>{katAd[o.kategori_id]}</td><td>{o.min_oyuncu}–{o.max_oyuncu}</td>
                                <td>{o.sure_dk} dk</td><td className="sag">{o.toplam_adet}</td><td>{o.aktif ? 'Rafta' : 'Kaldırıldı'}</td>
                                <td className="sag eylemler">
                                    <button className="dugme dugme-hafif dugme-kucuk" onClick={() => d.setForm({ ilk: o })}>Düzenle</button>
                                    <button className="dugme dugme-hafif dugme-kucuk" onClick={() => d.aktifDegistir(o)}>{o.aktif ? 'Raftan kaldır' : 'Rafa koy'}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Durum>
            {d.form && <KayitFormu baslik={d.form.ilk ? `${d.form.ilk.ad} düzenle` : 'Yeni oyun'} alanlar={alanlar}
                                   ilk={d.form.ilk} kaydet={d.kaydet} kapat={() => d.setForm(null)} />}
            {kategoriFormu && (
                <KayitFormu baslik="Yeni oyun kategorisi" kapat={() => setKategoriFormu(false)}
                            alanlar={[{ ad: 'ad', etiket: 'Kategori adı', tur: 'metin', zorunlu: true }]}
                            kaydet={async (g) => {
                                const ok = await islem(() => gonder('/yonetim/kategoriler', g), 'Kategori eklendi');
                                if (ok !== undefined) kategoriler.yenile();
                                return ok;
                            }} />
            )}
        </>
    );
}

// ---------------------------------------------------------------- masalar
function MasaYonetimi() {
    const d = useDuzenleyici('/yonetim/masalar', (m) => `Masa ${m.masa_no}`);
    const alanlar = [
        { ad: 'masa_no', etiket: 'Masa numarası', tur: 'sayi', zorunlu: true },
        { ad: 'kapasite', etiket: 'Kapasite (kişi)', tur: 'sayi', zorunlu: true, varsayilan: 4 },
        { ad: 'kat', etiket: 'Kat', tur: 'secim', zorunlu: true, varsayilan: 1, secenekler: Object.entries(KAT_ADI) },
    ];
    return (
        <>
            <div className="satir arasi">
                <p className="soluk">Geçmişi olan masa silinemez.</p>
                <button className="dugme dugme-ana" onClick={() => d.setForm({ ilk: null })}>Masa ekle</button>
            </div>
            <Durum yukleniyor={d.liste.yukleniyor && !d.liste.veri} hata={d.liste.hata} bos={!d.liste.veri?.length} bosMesaj="Masa yok">
                <table className="tablo">
                    <thead><tr><th>Masa</th><th>Kat</th><th className="sag">Kapasite</th><th /></tr></thead>
                    <tbody>
                        {d.liste.veri?.map((m) => (
                            <tr key={m.id}>
                                <td>Masa {m.masa_no}</td><td>{KAT_ADI[m.kat]}</td><td className="sag">{m.kapasite} kişi</td>
                                <td className="sag eylemler">
                                    <button className="dugme dugme-hafif dugme-kucuk" onClick={() => d.setForm({ ilk: m })}>Düzenle</button>
                                    <button className="dugme dugme-hafif dugme-kucuk" onClick={() => d.kaldir(m)}>Sil</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Durum>
            {d.form && <KayitFormu baslik={d.form.ilk ? `Masa ${d.form.ilk.masa_no} düzenle` : 'Yeni masa'} alanlar={alanlar}
                                   ilk={d.form.ilk} kaydet={d.kaydet} kapat={() => d.setForm(null)} />}
        </>
    );
}

// ---------------------------------------------------------------- personel
function Personel() {
    const { islem, personel: ben } = useUygulama();
    const d = useDuzenleyici('/yonetim/personel', (p) => `${p.ad} ${p.soyad}`);
    const [parolaKimin, setParolaKimin] = useState(null);
    const roller = Object.entries(ROL_ADI);
    const alanlar = [
        { ad: 'ad', etiket: 'Ad', tur: 'metin', zorunlu: true },
        { ad: 'soyad', etiket: 'Soyad', tur: 'metin', zorunlu: true },
        { ad: 'telefon', etiket: 'Telefon', tur: 'metin', girdi: 'tel', zorunlu: true },
        { ad: 'email', etiket: 'E-posta (isteğe bağlı)', tur: 'metin', girdi: 'email' },
        { ad: 'rol', etiket: 'Rol', tur: 'secim', metinDeger: true, zorunlu: true, secenekler: roller },
        { ad: 'kullanici_adi', etiket: 'Kullanıcı adı', tur: 'metin', zorunlu: true, yalnizYeni: true },
        { ad: 'parola', etiket: 'Parola (en az 6 karakter)', tur: 'metin', girdi: 'password', zorunlu: true, yalnizYeni: true },
    ];

    return (
        <>
            <div className="satir arasi">
                <p className="soluk">Ayrılan personel silinmez, pasif yapılır (geçmiş kayıtlar korunur).</p>
                <button className="dugme dugme-ana" onClick={() => d.setForm({ ilk: null })}>Personel ekle</button>
            </div>
            <Durum yukleniyor={d.liste.yukleniyor && !d.liste.veri} hata={d.liste.hata} bos={!d.liste.veri?.length}>
                <table className="tablo">
                    <thead><tr><th>Ad soyad</th><th>Rol</th><th>Kullanıcı adı</th><th>Telefon</th><th>İşe başlama</th><th>Durum</th><th /></tr></thead>
                    <tbody>
                        {d.liste.veri?.map((p) => (
                            <tr key={p.id} className={p.aktif ? '' : 'pasif'}>
                                <td>{p.ad} {p.soyad}</td><td>{ROL_ADI[p.rol]}</td><td>{p.kullanici_adi}</td>
                                <td>{p.telefon}</td><td>{tarihBicim(`${String(p.ise_baslama).slice(0, 10)}T00:00`)}</td>
                                <td>{p.aktif ? 'Aktif' : 'Pasif'}</td>
                                <td className="sag eylemler">
                                    <button className="dugme dugme-hafif dugme-kucuk" onClick={() => d.setForm({ ilk: p })}>Düzenle</button>
                                    <button className="dugme dugme-hafif dugme-kucuk" onClick={() => setParolaKimin(p)}>Parola</button>
                                    {p.id !== ben.id && (
                                        <button className="dugme dugme-hafif dugme-kucuk" onClick={() => d.aktifDegistir(p)}>{p.aktif ? 'Pasif yap' : 'Aktif yap'}</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Durum>
            {d.form && <KayitFormu baslik={d.form.ilk ? `${d.form.ilk.ad} ${d.form.ilk.soyad}` : 'Yeni personel'}
                                   alanlar={alanlar} ilk={d.form.ilk} kaydet={d.kaydet} kapat={() => d.setForm(null)} />}
            {parolaKimin && (
                <KayitFormu baslik={`${parolaKimin.ad} için yeni parola`} kapat={() => setParolaKimin(null)}
                            alanlar={[{ ad: 'parola', etiket: 'Yeni parola (en az 6 karakter)', tur: 'metin', girdi: 'password', zorunlu: true }]}
                            kaydet={(g) => islem(() => gonder(`/yonetim/personel/${parolaKimin.id}/parola`, g), 'Parola değiştirildi')} />
            )}
        </>
    );
}

// ---------------------------------------------------------------- ayarlar
function Ayarlar() {
    const { islem } = useUygulama();
    const { veri, hata, yukleniyor, yenile } = useVeri('/yonetim/ayar');
    const [form, setForm] = useState(null);
    const d = form ?? veri;

    async function kaydet(e) {
        e.preventDefault();
        const ok = await islem(() => guncelle('/yonetim/ayar', {
            giris_ucreti: Number(d.giris_ucreti), secim_suresi_dk: Number(d.secim_suresi_dk), kayit_zorunlu: d.kayit_zorunlu,
        }), 'Ayarlar kaydedildi');
        if (ok !== undefined) { setForm(null); yenile(); }
    }

    return (
        <Durum yukleniyor={yukleniyor && !veri} hata={hata}>
            {d && (
                <form className="form dar" onSubmit={kaydet}>
                    <label>
                        Kişi başı giriş ücreti (TL)
                        <input type="number" min="0" step="0.01" value={d.giris_ucreti} required
                               onChange={(e) => setForm({ ...d, giris_ucreti: e.target.value })} />
                        <small className="soluk">Yeni açılan masalara uygulanır; açık masaların ücreti değişmez.</small>
                    </label>
                    <label>
                        Seçim hakkı süresi (dakika)
                        <input type="number" min="1" max="60" value={d.secim_suresi_dk} required
                               onChange={(e) => setForm({ ...d, secim_suresi_dk: e.target.value })} />
                    </label>
                    <label className="onay">
                        <input type="checkbox" checked={d.kayit_zorunlu} onChange={(e) => setForm({ ...d, kayit_zorunlu: e.target.checked })} />
                        Masa açmak için müşteri kaydı zorunlu
                    </label>
                    <div className="satir sag-hizali">
                        <button className="dugme dugme-ana" disabled={!form}>Kaydet</button>
                    </div>
                </form>
            )}
        </Durum>
    );
}
