import { useState } from 'react';
import { useUygulama } from '../baglam.jsx';

export default function Giris() {
    const { giris } = useUygulama();
    const [kullaniciAdi, setKullaniciAdi] = useState('');
    const [parola, setParola] = useState('');
    const [hata, setHata] = useState('');
    const [bekliyor, setBekliyor] = useState(false);

    async function gonder(e) {
        e.preventDefault();
        setHata('');
        setBekliyor(true);
        try {
            await giris(kullaniciAdi.trim(), parola);
        } catch (err) {
            setHata(err.message);
            setBekliyor(false);
        }
    }

    return (
        <div className="giris-sayfa">
            <form className="giris-kart" onSubmit={gonder}>
                <img src="/karavana.svg" alt="" width="64" height="64" />
                <h1>Karavana</h1>
                <p className="soluk">Kutu oyunu cafe · personel girişi</p>
                <label>
                    Kullanıcı adı
                    <input value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)}
                           autoComplete="username" autoCapitalize="none" autoFocus required />
                </label>
                <label>
                    Parola
                    <input type="password" value={parola} onChange={(e) => setParola(e.target.value)}
                           autoComplete="current-password" required />
                </label>
                {hata && <p className="form-hata" role="alert">{hata}</p>}
                <button className="dugme dugme-ana" disabled={bekliyor}>{bekliyor ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
            </form>
        </div>
    );
}
