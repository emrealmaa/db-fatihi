# Kutu Oyunu Cafe İşletme Sistemi

Veritabanı dersi dönem projesi (Enes Öztürk, Emre Alma). **Seçilen DB: PostgreSQL.** Diğer motorlar compose'ta profile olarak duruyor ama kullanılmıyor.
Detaylar: `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `CLAUDE.md`.

## Yapı
- `docs/` – ödev yönergeleri, sunum
- `db/<motor>/init/` – şema/seed betikleri (konteyner ilk açılışta çalıştırır; Neo4j hariç elle)
- `app/` – uygulama ve ön yüz (stack seçilince kurulacak)
- `docker-compose.yml` – profile bazlı veritabanları

## Başlangıç
```
docker compose --profile postgres up -d   # host portu 5433
```
Profiller: `postgres`, `mysql`, `mongo`, `neo4j`, `mssql`, `all`.
Parolalar `.env` dosyasında (git'e girmez; şablon: `.env.example`).

## Seçim rehberi (yönergeye göre)
| Yol | Öne çıkan gereksinimler |
|---|---|
| PostgreSQL / MySQL | ≥6 tablo, ≥5 constraint, ≥2 SP, ≥5 view, ≥2 UDF, yetki/maskeleme |
| MSSQL | Veri ambarı + ≥5 SSIS paketi + SSAS küp (Windows araçları gerekir; Mac'te zor) |
| MongoDB | ≥20 koleksiyon, ≥2 iç içe, ≥5 veri modeli |
| Neo4j | ≥6 etiket, ≥20 düğüm, ≥20 ayrıt, çizge algoritmaları |

Not: M-serisi Mac'te MSSQL emülasyonla çalışır; SSIS/SSAS için Windows VM gerekir.
Teslim: 27 Aralık 2026 23:59; sunumda herkese açık GitHub/Trello linki paylaşılmalı.
