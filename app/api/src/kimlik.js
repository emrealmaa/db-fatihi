// Personel girişi ve token doğrulama.
// Parola veritabanında doğrulanır (fn_personel_giris, giris_app rolüyle); API yalnızca token üretir.
import jwt from 'jsonwebtoken';
import { HttpHata } from './hatalar.js';

// personel.rol -> API'nin bağlandığı veritabanı rolü
const DB_ROLU = { GARSON: 'garson', KASIYER: 'kasiyer', YONETICI: 'yonetici' };
// Bir rol, kendinden alt rollerin her şeyini yapabilir
const SEVIYE = { GARSON: 1, KASIYER: 2, YONETICI: 3 };

export function kimlikModulu({ vt, gizliAnahtar, sure = '12h' }) {
    async function girisYap(kullaniciAdi, parola) {
        if (!kullaniciAdi || !parola) throw new HttpHata(400, 'Kullanıcı adı ve parola gerekli');
        const [p] = await vt.islem('giris', null, (q) =>
            q('SELECT * FROM fn_personel_giris($1, $2)', [String(kullaniciAdi), String(parola)]));
        if (!p) throw new HttpHata(401, 'Kullanıcı adı veya parola hatalı');
        const personel = { id: p.personel_id, ad: p.ad, soyad: p.soyad, rol: p.rol };
        const token = jwt.sign(personel, gizliAnahtar, { expiresIn: sure });
        return { token, personel };
    }

    // Token'ı doğrular, req.personel ve req.vt (personelin rolüyle transaction) ekler
    function kimlikGerekli(req, res, next) {
        const [tur, token] = (req.headers.authorization || '').split(' ');
        if (tur !== 'Bearer' || !token) return next(new HttpHata(401, 'Giriş yapmanız gerekiyor'));
        try {
            const { id, ad, soyad, rol } = jwt.verify(token, gizliAnahtar);
            req.personel = { id, ad, soyad, rol };
        } catch {
            return next(new HttpHata(401, 'Oturumunuzun süresi doldu, tekrar giriş yapın'));
        }
        req.vt = (fn) => vt.islem(DB_ROLU[req.personel.rol], req.personel.id, fn);
        next();
    }

    // En az verilen rol seviyesinde olmayı şart koşar (asıl yetki kontrolü veritabanındadır;
    // bu yalnızca anlamlı bir 403 mesajı ve gereksiz sorguyu önlemek için)
    const enAz = (rol) => (req, res, next) =>
        SEVIYE[req.personel.rol] >= SEVIYE[rol] ? next() : next(new HttpHata(403, 'Bu işlem için yetkiniz yok'));

    return { girisYap, kimlikGerekli, enAz };
}
