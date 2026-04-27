# OrthoAlign

> AI-ассистент планирования ортодонтического лечения. 3D-сегментация зубов, интерактивная расстановка, автогенерация стадий движения.

Демонстрация инженерного подхода к автоматизации работы техника по планированию элайнеров. Цикл «загрузил скан → получил сегментированную челюсть → расставил целевые позиции → получил стадии лечения», который у техника занимает 30-60 минут, выполняется здесь за 1-2 минуты.

## Стек

- **Backend:** Python 3.11, FastAPI, SQLAlchemy, MySQL 8, Redis 7, Celery
- **Frontend:** React 18, TypeScript, Vite, Three.js через react-three-fiber, drei
- **3D / Mesh:** trimesh, Open3D
- **ML:** PyTorch (mesh segmentation, в v2)
- **LLM:** Anthropic Claude API (предложение целевых позиций, в v2)
- **Инфра:** Docker Compose, nginx, Vercel (фронт), VPS (бэк)

## Статус

- [x] Скаффолд
- [ ] v1: UX-loop на 3 предкэшированных кейсах
- [ ] v1: Деплой
- [ ] v2: Живой ML-инференс
- [ ] v2: LLM-suggest

## Запуск локально

```bash
# Backend (Docker)
docker compose up -d

# Frontend (host)
cd frontend
npm install
npm run dev
```

Backend: http://localhost:8001/docs
Frontend: http://localhost:5173

Если порты 8001/3306/6380 заняты — поправить в `docker-compose.yml` и `frontend/vite.config.ts`.

## Лицензия данных

Демо-кейсы основаны на [Teeth3DS](https://github.com/abenhamadou/3DTeethSeg22_challenge) (CC BY-NC-SA 4.0). Использование некоммерческое, портфолио.
