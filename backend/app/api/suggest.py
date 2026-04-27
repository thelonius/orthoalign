"""
LLM-критик для эвристически расставленных целевых позиций зубов.

Принимает: текущее состояние плана (исходные центры + предложенные смещения).
Отдаёт: текстовый клинический разбор + список адресных правок per-tooth.

LLM провайдер задаётся переменными окружения и должен быть OpenAI-совместим:
    LLM_BASE_URL    напр. https://api.groq.com/openai/v1
    LLM_API_KEY     токен провайдера
    LLM_MODEL       напр. meta-llama/llama-3.3-70b-versatile

Локальный Ollama:
    LLM_BASE_URL=http://localhost:11434/v1
    LLM_API_KEY=ollama  (любая непустая строка)
    LLM_MODEL=llama3.3:70b
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

CASES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "cases"


class ToothTarget(BaseModel):
    position: list[float] = Field(..., min_length=3, max_length=3)
    rotation_deg_z: float = 0.0


class SuggestRequest(BaseModel):
    case_id: str
    current_targets: dict[int, ToothTarget] = Field(default_factory=dict)


class ToothAdjustment(BaseModel):
    label: int
    delta_position: list[float] = Field(..., min_length=3, max_length=3)
    rationale: str


class SuggestResponse(BaseModel):
    commentary: str
    adjustments: list[ToothAdjustment]
    model: str
    raw_llm_text: str | None = None


SYSTEM_PROMPT = """Ты — опытный ортодонт с 15-летним стажем, рецензируешь автоматически сгенерированный план лечения элайнерами.

Тебе дают:
- Тип челюсти (upper/lower)
- Список зубов в FDI-нумерации с их исходными центрами (X=сагиттально-боковой, Y=мезио-дистальный, Z=окклюзионный) в миллиметрах
- Список предложенных смещений (delta) для некоторых зубов

Ты должен:
1. Дать краткий (3-5 предложений) клинический разбор: что в текущем плане разумно, что бы ты поправил, какие риски видишь
2. Предложить точечные правки: список зубов с дельта-смещениями (мм) и обоснованием

Контекст: координаты в нормализованном пространстве, где меш масштабирован к ±50 мм. Реальное движение зуба за курс лечения редко превышает 3-4 мм. Будь консервативен в смещениях.

Отвечай СТРОГО валидным JSON:
{
  "commentary": "Текст клинического разбора...",
  "adjustments": [
    {"label": 11, "delta_position": [0.5, -0.3, 0], "rationale": "Резец смещён орально, нужен лёгкий вестибулярный наклон"},
    ...
  ]
}

Никакого текста до или после JSON. Никаких markdown-обёрток."""


def _load_case_centers(case_id: str) -> tuple[str, dict[int, list[float]]]:
    case_dir = CASES_DIR / case_id
    data_path = case_dir / "data.json"
    if not data_path.exists():
        raise HTTPException(404, f"Case {case_id} not found")
    with data_path.open() as f:
        data = json.load(f)
    centers = {int(k): v for k, v in data.get("toothInitialCenters", {}).items()}
    return data.get("jaw", "upper"), centers


def _build_user_prompt(jaw: str, centers: dict[int, list[float]],
                        current_targets: dict[int, ToothTarget]) -> str:
    lines = [
        f"Челюсть: {jaw}",
        f"Зубов в кейсе: {len(centers)}",
        "",
        "Исходные центры зубов (FDI: x, y, z мм):",
    ]
    for label in sorted(centers):
        c = centers[label]
        lines.append(f"  {label}: ({c[0]:+.2f}, {c[1]:+.2f}, {c[2]:+.2f})")

    if current_targets:
        lines.extend(["", "Уже предложенные смещения (FDI: dx, dy, dz):"])
        for label in sorted(current_targets):
            t = current_targets[label]
            lines.append(
                f"  {label}: ({t.position[0]:+.2f}, {t.position[1]:+.2f}, "
                f"{t.position[2]:+.2f})"
            )
    else:
        lines.extend(["", "Предложенных смещений пока нет — состояние исходное."])

    return "\n".join(lines)


def _extract_json(text: str) -> dict[str, Any]:
    """LLM иногда заворачивает JSON в ```json ... ``` или добавляет преамбулу."""
    text = text.strip()
    if text.startswith("```"):
        # Убираем code fences
        text = text.lstrip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    # Берём от первой { до последней }
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"Не нашёл JSON в ответе LLM: {text[:200]}")
    return json.loads(text[start:end + 1])


@router.post("", response_model=SuggestResponse)
def suggest(req: SuggestRequest) -> SuggestResponse:
    base_url = os.getenv("LLM_BASE_URL")
    api_key = os.getenv("LLM_API_KEY")
    model = os.getenv("LLM_MODEL")
    if not (base_url and api_key and model):
        raise HTTPException(
            500,
            "LLM не сконфигурирован. Установи LLM_BASE_URL, LLM_API_KEY, LLM_MODEL.",
        )

    jaw, centers = _load_case_centers(req.case_id)
    user_prompt = _build_user_prompt(jaw, centers, req.current_targets)

    # OpenAI-совместимый клиент: работает с Groq, Together, Ollama, Fireworks, etc.
    from openai import OpenAI
    client = OpenAI(base_url=base_url, api_key=api_key, timeout=60.0)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
    except Exception as e:
        # Не все провайдеры поддерживают response_format; пробуем без него.
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=2000,
        )

    raw = response.choices[0].message.content or ""

    try:
        parsed = _extract_json(raw)
    except (ValueError, json.JSONDecodeError) as e:
        raise HTTPException(
            502,
            f"LLM вернул некорректный JSON: {e}. Сырая выдача: {raw[:500]}",
        )

    adjustments_data = parsed.get("adjustments", [])
    adjustments: list[ToothAdjustment] = []
    for item in adjustments_data:
        try:
            adjustments.append(ToothAdjustment(**item))
        except Exception:
            # Скипаем кривые элементы, не валим весь ответ.
            continue

    return SuggestResponse(
        commentary=parsed.get("commentary", "(нет комментария)"),
        adjustments=adjustments,
        model=model,
        raw_llm_text=raw,
    )
