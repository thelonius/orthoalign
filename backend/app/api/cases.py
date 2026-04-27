import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

CASES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "cases"


@router.get("")
def list_cases():
    cases = []
    if not CASES_DIR.exists():
        return cases
    for case_dir in sorted(CASES_DIR.iterdir()):
        meta_path = case_dir / "meta.json"
        if meta_path.exists():
            with meta_path.open() as f:
                cases.append(json.load(f))
    return cases


@router.get("/{case_id}")
def get_case(case_id: str):
    data_path = CASES_DIR / case_id / "data.json"
    if not data_path.exists():
        raise HTTPException(404, f"Case {case_id} not found")
    with data_path.open() as f:
        return json.load(f)
