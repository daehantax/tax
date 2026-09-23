#!/usr/bin/env python3
"""조정대상지역 JSON 검증기.

사용법:
    python scripts/check_조정대상지역.py                 # 형식 검사 + 기본 시점 현황 출력
    python scripts/check_조정대상지역.py 2021-01-01      # 특정 기준일 현황 출력

하는 일:
    1) 형식 검사 : 필수 항목, 날짜 형식(YYYY-MM-DD), 지정일 < 해제일, id 중복, 특례 id 존재
    2) 시점 현황 : 기준일에 지정 중인 레코드 목록 (원본 PDF 현황표와 눈으로 대조용)
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "조정대상지역.json"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REQUIRED = ["id", "시도", "시군구", "범위", "지정일", "해제일", "재지정"]


def validate(data: dict) -> list[str]:
    errors: list[str] = []
    special_ids = {t["id"] for t in data.get("특례", [])}
    seen: set[str] = set()
    for r in data["지정이력"]:
        rid = r.get("id", "?")
        for key in REQUIRED:
            if key not in r:
                errors.append(f"{rid}: '{key}' 항목 없음")
        if rid in seen:
            errors.append(f"{rid}: id 중복")
        seen.add(rid)
        if not DATE_RE.match(r.get("지정일") or ""):
            errors.append(f"{rid}: 지정일 형식 오류 {r.get('지정일')}")
        end = r.get("해제일")
        if end is not None:
            if not DATE_RE.match(end):
                errors.append(f"{rid}: 해제일 형식 오류 {end}")
            elif end <= r["지정일"]:
                errors.append(f"{rid}: 해제일이 지정일보다 빠름")
        if r.get("범위") not in ("전역", "일부"):
            errors.append(f"{rid}: 범위는 '전역' 또는 '일부'")
        if r.get("범위") == "일부" and not (r.get("포함") or r.get("제외")):
            errors.append(f"{rid}: 범위가 '일부'인데 포함/제외 목록 없음")
        for t in r.get("특례", []):
            if t not in special_ids:
                errors.append(f"{rid}: 없는 특례 id {t}")
    return errors


def active_on(data: dict, day: str) -> list[dict]:
    """기준일에 지정 중인 레코드 (지정일 <= day < 해제일)."""
    return [
        r for r in data["지정이력"]
        if r["지정일"] <= day and (r["해제일"] is None or day < r["해제일"])
    ]


def print_snapshot(data: dict, day: str) -> None:
    rows = active_on(data, day)
    print(f"\n■ {day} 기준 지정 중 ({len(rows)}건)")
    for r in rows:
        area = ", ".join(r["시군구"])
        detail = f"  ※ {r['세부']}" if r.get("세부") else ""
        print(f"  [{r['id']}] {r['시도']} {area} (지정 {r['지정일']}){detail}")


def main() -> int:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    errors = validate(data)
    print(f"레코드 {len(data['지정이력'])}건, 특례 {len(data['특례'])}건")
    if errors:
        print("형식 오류:")
        for e in errors:
            print("  -", e)
    else:
        print("형식 검사 통과")

    days = sys.argv[1:] or ["2023-01-05", "2025-10-16", "2026-07-01"]
    for d in days:
        print_snapshot(data, d)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
