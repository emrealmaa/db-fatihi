"""Oyun kutu görsellerini BoardGameGeek'ten çekip temaya uygun piksel-art kapaklara çevirir.

Kullanım (Pillow gerekir):  python3 app/web/scripts/kapaklar.py [--onbellek DIZIN]
Çıktı: app/web/public/kapaklar/<ad>.png (en çok 56x44, sınırlı palet) ve app/web/src/kapaklar.json.
Orijinal görseller yalnızca önbellek dizinine iner, depoya girmez. Görseller yayıncılarına aittir;
yalnızca ders projesinde eğitim amaçlı kullanılır.
"""
import argparse, io, json, pathlib, re, time, unicodedata, urllib.request
from PIL import Image, ImageEnhance

# Veritabanındaki oyun adı → BoardGameGeek kimliği (06_seed.sql + 07_vip_kulup.sql)
OYUNLAR = {
    'Root': 237182, 'Carcassonne': 822, 'Ticket to Ride': 9209, 'Codenames': 178900, 'Dixit': 39856,
    'Pandemic': 30549, '7 Wonders': 68448, 'Azul': 230802, 'Splendor': 148228, 'Uno': 2223, 'Catan': 13,
    'Monopoly': 1406, 'Okey': 29146, 'Tavla': 2397, 'Rummikub': 811, 'Mangala': 39492, 'Satranç': 171,
    'Tabu': 1111, 'Jenga': 2452, 'Risk': 181, 'Scrabble': 320, 'Exploding Kittens': 172225,
    'Kingdomino': 204583, 'King of Tokyo': 70323, 'Sushi Go!': 133473, 'Love Letter': 129622,
    'The Mind': 244992, 'Coup': 131357, 'Avalon': 128882, 'Vampir Köylü': 925, 'Bang!': 3955,
    'Hanabi': 98778, 'Patchwork': 163412, 'Jaipur': 54043, 'Terraforming Mars': 167791, 'Scythe': 169786,
    'Wingspan': 266192, 'Gloomhaven': 174430, 'Brass: Birmingham': 224517, 'Everdell': 199792,
    'Cascadia': 295947, 'Concordia': 124361, 'Agricola': 31260, 'Puerto Rico': 3076, 'Dominion': 36218,
    'Small World': 40692, 'Takenoko': 70919, 'İstanbul': 148949, 'Quacks of Quedlinburg': 244521,
    'Dune: Imperium': 316554,
    'Twilight Imperium (4. baskı)': 233078, 'Gloomhaven (2. baskı)': 174430, 'Brass: Birmingham (Deluxe)': 224517,
    'Spirit Island': 162886, 'Mage Knight': 96848, 'Through the Ages: A New Story of Civilization': 182028,
    'Gaia Project': 220308, 'Food Chain Magnate': 175914, 'War of the Ring (2. baskı)': 115746,
    'Twilight Struggle': 12333,
}
EN_GENIS, EN_YUKSEK = 56, 44    # kapak penceresi 120x88: her piksel-art pikseli ekranda 2x2
RENK = 28                       # palet büyüklüğü
UA = {'User-Agent': 'karavana-ders-projesi/0.1'}
KOK = pathlib.Path(__file__).resolve().parent.parent


def dosya_adi(ad):
    a = unicodedata.normalize('NFKD', ad.replace('ı', 'i').replace('İ', 'I')).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', a.lower()).strip('-')


def getir(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()


def piksellestir(veri):
    g = Image.open(io.BytesIO(veri)).convert('RGB')
    g = ImageEnhance.Color(g).enhance(1.25)
    g = ImageEnhance.Contrast(g).enhance(1.1)
    oran = min(EN_GENIS / g.width, EN_YUKSEK / g.height)
    g = g.resize((max(1, round(g.width * oran)), max(1, round(g.height * oran))), Image.Resampling.BOX)
    return g.quantize(colors=RENK, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--onbellek', default=str(KOK / 'scripts' / '.kapak-onbellek'))
    a = p.parse_args()
    onbellek = pathlib.Path(a.onbellek); onbellek.mkdir(parents=True, exist_ok=True)
    cikti = KOK / 'public' / 'kapaklar'; cikti.mkdir(parents=True, exist_ok=True)
    liste = {}
    for ad, bgg in OYUNLAR.items():
        ham = onbellek / f'{bgg}.jpg'
        try:
            if not ham.exists():
                oge = json.loads(getir(f'https://api.geekdo.com/api/geekitems?objectid={bgg}&objecttype=thing'))['item']
                ham.write_bytes(getir(oge['imageurl']))
                time.sleep(0.5)
            g = piksellestir(ham.read_bytes())
        except Exception as e:  # görseli olmayan oyun çizilen kapakla kalır
            print(f'atlandı: {ad} ({e})')
            continue
        dosya = f'{dosya_adi(ad)}.png'
        g.save(cikti / dosya, optimize=True)
        liste[ad] = {'dosya': dosya, 'bgg': bgg, 'w': g.width, 'h': g.height}
        print(f'{ad:46} {g.width}x{g.height}  {dosya}')
    (KOK / 'src' / 'kapaklar.json').write_text(json.dumps(liste, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
