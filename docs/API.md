# API

Taban adres: `http://localhost:3001/api`. Gövdeler JSON. Giriş dışındaki her uç
`Authorization: Bearer <token>` ister. Hata yanıtı: `{ "hata": "Türkçe mesaj" }`.

| Durum | Anlamı |
|---|---|
| 400 | Geçersiz istek veya iş kuralı ihlali (CHECK, tetikleyici, prosedür mesajı) |
| 401 | Giriş yok / token süresi dolmuş / parola hatalı |
| 403 | Rolün yetkisi yok (API seviyesi veya veritabanı `permission denied`) |
| 404 | Kayıt bulunamadı |
| 409 | Benzersizlik ihlali (masa dolu, telefon kayıtlı, sırada zaten var...) |

Rol hiyerarşisi: **YONETICI ⊃ KASIYER ⊃ GARSON**. API her isteği personelin rolüne karşılık gelen
veritabanı rolüyle (`garson_app`, `kasiyer_app`, `yonetici_app`) çalıştırır; asıl yetki kontrolü veritabanındadır.

## Giriş
| Yöntem | Yol | Gövde | Yanıt |
|---|---|---|---|
| POST | `/giris` | `{ kullaniciAdi, parola }` | `{ token, personel: { id, ad, soyad, rol } }` |
| GET | `/ben` | – | personel |
| GET | `/saglik` | – (token gerekmez) | `{ durum, surucu }` |

## Garson (ve üstü)
| Yöntem | Yol | Gövde | Kaynak |
|---|---|---|---|
| GET | `/masalar` | – | `v_masa_durumu` |
| POST | `/masalar/:masaId/ac` | `{ kisiSayisi, kullaniciId? , musteri?: { ad, soyad, telefon, email?, ogrenci? } }` | `sp_musteri_kaydet` + `sp_oturum_ac` (tek transaction) |
| GET | `/musteriler/ara?telefon=` | – | `fn_musteri_bul` (maskeli) |
| POST | `/musteriler` | `{ ad, soyad, telefon, email?, ogrenci? }` | `sp_musteri_kaydet` |
| GET | `/oyunlar` | – | `v_musait_oyunlar` (`alinabilir_adet`: sıraya ayrılmamış kopya, `bekleyen_masa`) |
| POST | `/oturumlar/:oturumId/oyun` | `{ oyunId }` | `sp_oyun_baslat` |
| POST | `/oturum-oyunlar/:id/bitir` | – | `sp_oyun_bitir` |
| GET | `/bekleme` | – | `v_bekleme_sirasi` (`oyun`, `oyun_sira`, `secim_bitis` geri sayım için) |
| POST | `/oturumlar/:oturumId/bekleme` | `{ oyunId }` (beklenen oyun) | `sp_bekleme_ekle` |
| POST | `/bekleme/:id/sec` | – (ayrılan oyunu masaya verir) | `sp_oyun_sec` |
| DELETE | `/bekleme/:id` | – | `sp_bekleme_iptal` |
| GET | `/menu` | – | `v_menu` |
| GET | `/oturumlar/:oturumId/siparisler` | – | `v_oturum_siparisleri` |
| POST | `/oturumlar/:oturumId/siparisler` | `{ kalemler: [{ urunId, adet }] }` veya `{ urunId, adet }` | `sp_siparis_ver` (hepsi ya da hiçbiri) |
| DELETE | `/siparisler/:id` | – | `sp_siparis_iptal` (stok iade) |

Telefon `0532 123 45 67`, `+90 532...`, `532...` biçimlerinde gönderilebilir; API `05321234567`'ye çevirir.

## Kasiyer (ve üstü)
| Yöntem | Yol | Gövde | Kaynak |
|---|---|---|---|
| GET | `/hesaplar` | – | `v_acik_hesaplar` |
| GET | `/oturumlar/:oturumId/hesap` | – | `v_acik_hesaplar` + `v_oturum_siparisleri` |
| POST | `/oturumlar/:oturumId/kapat` | `{ odemeTuru: "NAKIT" \| "KART" }` | `sp_oturum_kapat` → `{ toplam }` |
| GET | `/raporlar/ciro` | – | `v_gunluk_ciro` (son 60 gün) |

## Yönetici
| Yöntem | Yol | Kaynak |
|---|---|---|
| GET | `/raporlar/oyun-populerlik` | `v_oyun_populerlik` |
| GET | `/raporlar/personel-performans` | `v_personel_performans` |
| GET | `/raporlar/kritik-stok` | `v_kritik_stok` |
| GET | `/raporlar/urun-satis` | `v_urun_satis` |
| GET/POST/PATCH/DELETE | `/yonetim/kategoriler` | `kategori` (`ad`) |
| GET/POST/PATCH | `/yonetim/oyunlar` | `oyun` (`ad, kategori_id, min_oyuncu, max_oyuncu, sure_dk, toplam_adet, aktif`) |
| GET/POST/PATCH/DELETE | `/yonetim/urun-kategorileri` | `urun_kategori` (`ad, sira`) |
| GET/POST/PATCH | `/yonetim/urunler` | `urun` (`ad, kategori_id, fiyat, stok, kritik_stok, aktif`) |
| POST | `/yonetim/urunler/:id/stok` | `sp_stok_ekle` (`{ adet }`) |
| GET/POST/PATCH/DELETE | `/yonetim/masalar` | `masa` (`masa_no, kapasite`) |
| GET/PATCH | `/yonetim/personel` | `personel` (hash dönmez; `ad, soyad, telefon, email, rol, aktif`) |
| POST | `/yonetim/personel` | `sp_personel_ekle` (`ad, soyad, telefon, rol, kullanici_adi, parola, email?`) |
| POST | `/yonetim/personel/:id/parola` | `sp_personel_parola` (`{ parola }`) |
| GET/PATCH | `/yonetim/ayar` | `ayar` (`giris_ucreti, secim_suresi_dk, kayit_zorunlu`) |

Yönetim gövdelerinde alan adları tablo sütunlarıyla aynıdır (snake_case). Oyun ve ürünler silinmez, `aktif: false` yapılır.

## Zamanlayıcı
Sunucu her `SECIM_KONTROL_MS` (varsayılan 15 sn) `sp_secim_suresi_doldur` çağırır; süresi dolan seçim hakkı sıradakine geçer.
