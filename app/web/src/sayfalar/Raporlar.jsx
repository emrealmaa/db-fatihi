// Yönetici raporları: oyun popülerliği, ürün satışları, personel performansı, kritik stok,
// VIP oyun kullanımı (v_vip_oyun_kullanimi) ve kat bazında günlük gelir (v_kat_gelir)
import { useState } from 'react';
import { useUygulama } from '../baglam.jsx';
import { gonder } from '../api.js';
import { useVeri } from '../kancalar.js';
import { KAT_ADI, ROL_ADI, tarihBicim, tl } from '../bicim.js';
import { Durum, Etiket, SayfaBaslik, VipRozet } from '../bilesenler/ortak.jsx';

const SEKMELER = [
    ['oyun-populerlik', 'Oyun popülerliği'],
    ['urun-satis', 'Ürün satışları'],
    ['personel-performans', 'Personel'],
    ['kritik-stok', 'Kritik stok'],
    ['vip-oyun-kullanimi', 'VIP oyunlar'],
    ['kat-gelir', 'Kat geliri'],
    ['musteri-segment', 'Müşteriler'],
    ['vip-uyelik-gelir', 'VIP üyelik geliri'],
];

export default function Raporlar({ parametreler }) {
    const [sekme, setSekme] = useState(SEKMELER.some(([k]) => k === parametreler[0]) ? parametreler[0] : SEKMELER[0][0]);
    const { veri, hata, yukleniyor, yenile } = useVeri(`/raporlar/${sekme}`, { aralik: 30000 });

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
                {sekme === 'vip-oyun-kullanimi' && <VipOyunRaporu satirlar={veri} />}
                {sekme === 'kat-gelir' && <KatGelirRaporu satirlar={veri} />}
                {sekme === 'musteri-segment' && <MusteriRaporu satirlar={veri} yenile={yenile} />}
                {sekme === 'vip-uyelik-gelir' && <VipUyelikGelirRaporu satirlar={veri} />}
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

function VipOyunRaporu({ satirlar }) {
    const enBuyuk = Math.max(...satirlar.map((s) => s.oturum_sayisi));
    return (
        <table className="tablo">
            <thead><tr><th>VIP oyun</th><th className="sag">Oturum</th><th className="cubuk-sutun" /><th className="sag">Toplam süre</th>
                <th className="sag">Ortalama</th><th className="sag">Oynayan VIP</th><th>Durum</th></tr></thead>
            <tbody>
                {satirlar.map((s) => (
                    <tr key={s.oyun_id}>
                        <td>{s.ad}<VipRozet /></td><td className="sag">{s.oturum_sayisi}</td>
                        <td className="cubuk-sutun"><Cubuk deger={s.oturum_sayisi} enBuyuk={enBuyuk} /></td>
                        <td className="sag">{s.toplam_dk} dk</td><td className="sag">{s.ortalama_dk} dk</td>
                        <td className="sag">{s.oynayan_vip}</td>
                        <td>{s.su_an_masada ? <Etiket tur="basari">Masada</Etiket> : <Etiket>Vitrinde</Etiket>}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// Kat bazında günlük gelir: kat 2 bistro yemek geliri ve kat 3 VIP geliri ayrı sütunlarda
function KatGelirRaporu({ satirlar }) {
    const gunler = [...new Set(satirlar.map((s) => s.gun))];
    const toplam = (alan) => satirlar.reduce((t, s) => t + Number(s[alan] || 0), 0);
    return (
        <table className="tablo">
            <thead><tr><th>Gün</th><th>Kat</th><th className="sag">Hesap</th><th className="sag">Kişi</th><th className="sag">Giriş</th>
                <th className="sag">Yemek</th><th className="sag">İçecek</th><th className="sag">VIP ciro</th><th className="sag">Ciro</th></tr></thead>
            <tbody>
                {gunler.flatMap((g) => satirlar.filter((s) => s.gun === g).map((s, i) => (
                    <tr key={`${g}-${s.kat}`}>
                        <td>{i === 0 ? new Date(g).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' }) : ''}</td>
                        <td>{KAT_ADI[s.kat] || `Kat ${s.kat}`}</td>
                        <td className="sag">{s.hesap_sayisi}{s.vip_hesap > 0 && <span className="soluk"> ({s.vip_hesap} VIP)</span>}</td>
                        <td className="sag">{s.kisi}</td><td className="sag">{tl(s.giris_geliri)}</td>
                        <td className="sag">{tl(s.yemek_geliri)}</td><td className="sag">{tl(s.icecek_geliri)}</td>
                        <td className="sag">{s.vip_ciro > 0 ? tl(s.vip_ciro) : '–'}</td><td className="sag"><strong>{tl(s.ciro)}</strong></td>
                    </tr>
                )))}
            </tbody>
            <tfoot><tr><th colSpan={4}>Toplam</th><th className="sag">{tl(toplam('giris_geliri'))}</th><th className="sag">{tl(toplam('yemek_geliri'))}</th>
                <th className="sag">{tl(toplam('icecek_geliri'))}</th><th className="sag">{tl(toplam('vip_ciro'))}</th><th className="sag">{tl(toplam('ciro'))}</th></tr></tfoot>
        </table>
    );
}

const SEGMENTLER = [['', 'Tümü'], ['VIP', 'VIP'], ['OGRENCI', 'Öğrenci'], ['NORMAL', 'Normal']];

// Kayıtlı müşteriler: VIP / öğrenci / normal. VIP üyenin haftalık ücreti buradan alınır (kasiyer prosedürü).
function MusteriRaporu({ satirlar, yenile }) {
    const { bildir } = useUygulama();
    const [segment, setSegment] = useState('');
    const [oduyor, setOduyor] = useState(null);
    const say = (s) => satirlar.filter((m) => !s || m.segment === s).length;
    const gorunen = satirlar.filter((m) => !segment || m.segment === segment);

    async function ode(m, odemeTuru) {
        setOduyor(m.id);
        try {
            const r = await gonder(`/musteriler/${m.id}/vip-odeme`, { odemeTuru });
            bildir(`${m.ad} ${m.soyad}: ${tl(r.tutar)} alındı, üyelik ${tarihBicim(r.bitis)} tarihine kadar geçerli`, 'basari');
            yenile();
        } catch (e) {
            bildir(e.message, 'hata');
        } finally {
            setOduyor(null);
        }
    }

    return (
        <>
            <div className="sekmeler" role="tablist" aria-label="Müşteri segmenti">
                {SEGMENTLER.map(([k, ad]) => (
                    <button key={k} role="tab" aria-selected={segment === k} className={segment === k ? 'secili' : ''}
                            onClick={() => setSegment(k)}>{ad} ({say(k)})</button>
                ))}
            </div>
            <table className="tablo">
                <thead><tr><th>Müşteri</th><th>Telefon</th><th>Segment</th><th>VIP üyelik</th><th className="sag">Ziyaret</th>
                    <th className="sag">Harcama</th><th className="sag">VIP ücreti al</th></tr></thead>
                <tbody>
                    {gorunen.map((m) => (
                        <tr key={m.id}>
                            <td>{m.ad} {m.soyad}</td><td className="soluk">{m.telefon}</td>
                            <td>{m.segment === 'VIP' ? <VipRozet baslik="VIP üye" /> : m.segment === 'OGRENCI' ? <Etiket tur="bilgi">Öğrenci</Etiket> : <Etiket>Normal</Etiket>}
                                {m.segment === 'VIP' && m.ogrenci && <span className="soluk"> (öğrenci)</span>}</td>
                            <td>{m.vip_bitis ? (m.vip_aktif ? <Etiket tur="basari">{tarihBicim(m.vip_bitis)}'e kadar</Etiket> : <Etiket tur="uyari">Süresi doldu</Etiket>) : '–'}</td>
                            <td className="sag">{m.ziyaret_sayisi}</td><td className="sag">{tl(m.harcama)}</td>
                            <td className="sag">
                                <button className="dugme" disabled={oduyor === m.id} onClick={() => ode(m, 'KART')}>Kart</button>{' '}
                                <button className="dugme" disabled={oduyor === m.id} onClick={() => ode(m, 'NAKIT')}>Nakit</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}

function VipUyelikGelirRaporu({ satirlar }) {
    const toplam = (alan) => satirlar.reduce((t, s) => t + Number(s[alan] || 0), 0);
    return (
        <table className="tablo">
            <thead><tr><th>Gün</th><th className="sag">Ödeme</th><th className="sag">Nakit</th><th className="sag">Kart</th><th className="sag">Gelir</th></tr></thead>
            <tbody>
                {satirlar.map((s) => (
                    <tr key={s.gun}>
                        <td>{tarihBicim(`${s.gun}T00:00`)}</td><td className="sag">{s.odeme_sayisi}</td>
                        <td className="sag">{tl(s.nakit)}</td><td className="sag">{tl(s.kart)}</td><td className="sag"><strong>{tl(s.gelir)}</strong></td>
                    </tr>
                ))}
            </tbody>
            <tfoot><tr><th>Toplam</th><th className="sag">{toplam('odeme_sayisi')}</th><th className="sag">{tl(toplam('nakit'))}</th>
                <th className="sag">{tl(toplam('kart'))}</th><th className="sag">{tl(toplam('gelir'))}</th></tr></tfoot>
        </table>
    );
}
