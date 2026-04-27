# OrthoAlign

> AI-ассистент планирования ортодонтического лечения. 3D-сегментация зубов, интерактивная расстановка, автогенерация стадий движения элайнеров.

Демонстрация инженерного подхода к автоматизации работы техника по планированию элайнеров. Цикл «загрузил скан → получил сегментированную челюсть → расставил целевые позиции → получил стадии лечения», который у техника занимает 30-60 минут, выполняется здесь за 1-2 минуты.

## Что показывает

1. **Сегментация:** загруженный 3D-скан челюсти автоматически разделён на отдельные зубы по FDI-нумерации.
2. **Стадии:** слайдер прогоняет интерполяцию между исходным и целевым положением каждого зуба.
3. **Редактирование:** на максимальной стадии можно выбрать любой зуб и подвинуть его TransformControls-гизмо — это и есть работа техника.

## Стек

- **Backend:** Python 3.11, FastAPI, Celery, Redis, MySQL, SQLAlchemy
- **Frontend:** React 18, TypeScript, Vite, Three.js (через react-three-fiber), drei, zustand
- **Mesh / 3D:** trimesh, fast-simplification, WebGL
- **ML (v2):** PyTorch, MeshSegNet (pretrained, оффлайн-инференс через Celery)
- **Инфра:** Docker Compose, Vercel/любой статик-хост

## Архитектура

Frontend — статический SPA, читает кейсы из `/cases/<id>.json`. Backend (FastAPI + Celery + Redis + MySQL) — для демонстрации стека и для v2 (живой инференс). В продакшене фронт обходится без бэкенда; в dev можно запускать оба.

```
[ React + r3f ]  →  /cases/index.json   ← static (Vercel)
                    /cases/<id>.json
        ↓
   zustand store: { selectedTooth, targets, stage }
        ↓
   <TransformControls> ↔ Three.js scene
```

## Запуск локально

### Только фронт (быстро):
```bash
cd frontend
npm install
npm run sync-cases     # копирует кейсы из backend/data/cases в public/
npm run dev            # http://localhost:5173
```

### Полный стек (FastAPI + Celery + Redis + MySQL):
```bash
docker compose up -d   # backend на :8001, mysql на :3306, redis на :6380
cd frontend
VITE_API_MODE=backend npm run dev  # фронт читает API вместо статики
```

## Production build

```bash
cd frontend
npm run build          # выводит в dist/, готово для статик-хоста
```

5MB итогово, включая 2 демо-кейса с готовой сегментацией.

## Деплой на Vercel

```bash
cd frontend
npx vercel --prod
```

Или подключить `frontend/` директорию в Vercel UI как проект (build command: `npm run build`, output: `dist`).

## Подготовка демо-кейсов

```bash
python3 -m venv .venv
.venv/bin/pip install trimesh fast-simplification scipy 'numpy<2'

.venv/bin/python ml/prepare_cases.py \
  --mesh path/to/scan.obj \
  --labels path/to/labels.json \
  --case-id MY_CASE_upper \
  --name "Описание для UI" \
  --jaw upper
```

Подробнее — `docs/data-prep.md`.

## Лицензия данных

Демо-кейсы — открытый датасет [Teeth3DS](https://crns-smartvision.github.io/teeth3ds) (CC BY-NC-SA 4.0). Использование в портфолио с указанием источника — ОК. Для коммерческого использования — нет.
