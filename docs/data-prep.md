# Подготовка демо-данных

OrthoAlign v1 работает на 3 предкэшированных кейсах из [Teeth3DS](https://github.com/abenhamadou/3DTeethSeg22_challenge).

## Откуда брать данные

Варианты по убыванию удобства:

1. **HuggingFace** — `osullivan/Teeth3DS` или эквивалент. Один `git lfs pull` — и есть локально.
2. **GitHub challenge repo** — ссылки на Google Drive, ручная выгрузка.
3. **Запрос у авторов** — через форму на сайте challenge.

## Структура входных данных

Скачанные кейсы должны лежать так:

```
ml/data/raw/
  01A6GW1L_upper/
    01A6GW1L_upper.stl    # меш
    01A6GW1L_upper.json   # {"labels": [...], "instances": [...]}
  0EAKT1CU_upper/
    ...
```

Лейблы — массив целых чисел длиной `len(vertices)`. Кодировка FDI:
- `0` — десна (gingiva)
- `11`-`18` — верхняя челюсть, правый квадрант, от центрального резца
- `21`-`28` — верхняя челюсть, левый квадрант
- `31`-`38` — нижняя челюсть, левый квадрант
- `41`-`48` — нижняя челюсть, правый квадрант

## Запуск препроцессинга

```bash
cd projects/orthoalign
python -m venv .venv
source .venv/bin/activate
pip install trimesh numpy scipy

python ml/prepare_cases.py \
  --input ml/data/raw \
  --output backend/data/cases
```

На выходе в `backend/data/cases/<case_id>/`:
- `meta.json` — короткое описание кейса (попадает в `/api/cases`)
- `data.json` — меш + лейблы + центры зубов (попадает в `/api/cases/{id}`)

## Decimation

Сырые сканы из Teeth3DS бывают по 200-500k треугольников. Скрипт сжимает до 30k через quadric edge collapse, сохраняя лейблы через ближайшего соседа. Это даёт ~5-8 MB JSON на кейс и нормальную производительность Three.js.

Для v2 перейдём на бинарный glTF — будет в 5-10 раз компактнее.

## Лицензия

Teeth3DS лицензирован под [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Для портфолио с указанием источника — ОК. Для коммерческого использования — нет.
