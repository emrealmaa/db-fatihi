# Normalizasyon ve anahtar stratejisi

## Anahtar stratejisi
- **Birincil anahtarlar:** Tüm tablolarda yapay (surrogate) anahtar, `GENERATED ALWAYS AS IDENTITY`.
  Doğal anahtarlar (telefon, masa numarası, kullanıcı adı) değişebilir; yapay anahtar FK'leri sabit tutar.
  `ALWAYS` sayesinde id elle verilemez, dizi tutarsızlığı oluşmaz.
- **Tip seçimi hacme göre:** sık büyüyen tablolar `bigint` (oturum, siparis, odeme, bekleme, kullanici),
  küçük katalog tabloları `smallint` (masa, kategori, urun_kategori), orta boy `int` (oyun, urun, personel).
- **Doğal anahtarlar UNIQUE kısıtıyla korunur:** `kullanici.telefon`, `kullanici.email`, `personel.kullanici_adi`,
  `masa.masa_no`, `oyun.ad`, `urun.ad`, kategori adları. Böylece yapay anahtar tekrar eden veriye izin vermez.
- **Tek satırlık ayar tablosu:** `ayar.id boolean PRIMARY KEY CHECK (id)` — yalnızca `true` değeri alabildiği için en fazla bir satır olabilir.
- **Yabancı anahtarlar:** geçmişi olan kayıtlar silinemez (`ON DELETE RESTRICT`); oturuma bağlı ayrıntılar
  (oturum_oyun, siparis, bekleme) oturumla birlikte silinir (`CASCADE`). Ödeme `RESTRICT`: tahsil edilmiş hesap silinemez.

## Normal formlar

### 1NF
Her sütun atomik; tekrar eden grup yok. Örneğin bir masanın oynadığı oyunlar bir liste sütunu değil,
ayrı `oturum_oyun` satırlarıdır; sipariş kalemleri ayrı `siparis` satırlarıdır.

### 2NF
Bileşik birincil anahtar kullanılmadığı (her tabloda tek sütunlu yapay PK) için kısmi bağımlılık oluşamaz.
N:M ilişki tabloları (`oturum_oyun`, `siparis`) da yapay PK taşır ve tüm sütunları o satırın tamamına bağlıdır
(ör. `siparis.adet` hem oturuma hem ürüne değil, o sipariş satırına aittir).

### 3NF
Anahtar olmayan hiçbir sütun başka bir anahtar olmayan sütuna bağlı değildir:
- Oyunun kategori adı `oyun` tablosunda tutulmaz, `kategori_id` ile `kategori` tablosundan gelir. Ürün kategorisi de aynı şekilde.
- Masa kapasitesi oturumda tekrar edilmez; tetikleyici `masa` tablosundan okur.
- Müşteri ve personel bilgileri oturum/sipariş/ödemede tekrar edilmez, yalnızca FK tutulur.
- **Türetilmiş değerler saklanmaz:** müsait oyun adedi (`fn_musait_adet`), hesap toplamı (`fn_hesap_detay`),
  sıra numarası (`v_bekleme_sirasi`) her seferinde hesaplanır. Böylece güncelleme anomalisi oluşmaz
  (ör. oyun iade edilince ayrıca bir sayaç güncellemek gerekmez).

### Bilinçli istisnalar (tarihsel anlık görüntü)
Aşağıdaki sütunlar ilk bakışta tekrar gibi görünür ama **o anın değerini** saklar; kaynak değer sonradan
değişse bile geçmiş kayıt doğru kalmalıdır. Bu, 3NF ihlali değil, zamana bağlı ayrı bir olgunun kaydıdır:
| Sütun | Kaynağı | Neden kopyalanır |
|---|---|---|
| `siparis.birim_fiyat` | `urun.fiyat` | Fiyat zam görse eski hesaplar değişmemeli |
| `oturum.giris_ucreti` | `ayar.giris_ucreti` | Giriş ücreti değişse açık/kapanmış masaların hesabı değişmemeli |
| `odeme.tutar` | `fn_hesap_hesapla` | Tahsil edilen tutar kesinleşmiş bir finansal kayıttır |

## Anomali örnekleri ve önlemleri
| Anomali | Bu şemada nasıl önlendi |
|---|---|
| Ekleme | Müşteri, oturum açmadan da kaydedilebilir (`sp_musteri_kaydet`); oyun, hiç oynanmadan kataloğa eklenebilir |
| Güncelleme | Ürün adı/oyun kategorisi tek yerde; müsait adet saklanmadığı için senkron sorunu yok |
| Silme | Geçmişi olan masa/oyun/ürün/personel `RESTRICT` ile korunur; kullanımdan kalkan kayıt `aktif = false` yapılır |
