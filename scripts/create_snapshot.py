#!/usr/bin/env python3
"""연도별 스냅샷 생성기.

사용법:
    python scripts/create_snapshot.py 2025
    python scripts/create_snapshot.py 2025 --note "2025.12.23 개정 직전"

동작:
    현재 data/ 아래 JSON 4종(공제목록·조문상세·중복배제매트릭스·개정이력·메타)
    을 data/archive/<YEAR>/ 로 복사하고, _README.md 를 생성한다.

이미 존재하면: 확인 후 덮어쓰기 (--force 옵션 있으면 질문 없이 덮음).
"""
from __future__ import annotations
import argparse
import json
import shutil
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ARCHIVE = DATA / "archive"

# 아카이브에 포함할 JSON 파일 (현행 갱신용 '연도목록.json' 은 제외)
SNAPSHOT_FILES = [
    "조특법_공제목록.json",
    "조특법_조문상세.json",
    "조특법_중복배제매트릭스.json",
    "조특법_개정이력.json",
    "조특법_메타.json",
]


def summarize_counts(meta_path: Path) -> str:
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        c = meta.get("counts", {})
        return (
            f"- 공제: {c.get('deductions','?')}개\n"
            f"- 조문 상세: {c.get('article_detail','?')}개\n"
            f"- 중복배제 페어: {c.get('127_matrix_pairs','?')}개\n"
            f"- 개정이력: {c.get('revisions','?')}개"
        )
    except Exception:
        return "- 카운트 정보 없음"


def main():
    p = argparse.ArgumentParser(description="연도별 스냅샷 생성기")
    p.add_argument("year", help="예: 2025")
    p.add_argument("--note", default="", help="_README.md 에 기록할 메모")
    p.add_argument("--force", action="store_true", help="기존 아카이브 덮어쓰기")
    args = p.parse_args()

    year = args.year.strip()
    if not year.isdigit() or not (2000 <= int(year) <= 2100):
        sys.exit(f"[오류] 연도 형식이 잘못됨: {year}")

    target = ARCHIVE / year
    if target.exists():
        if not args.force:
            reply = input(f"'{target}' 가 이미 존재합니다. 덮어쓸까요? [y/N] ")
            if reply.strip().lower() not in ("y", "yes"):
                sys.exit("취소됨.")
        shutil.rmtree(target)

    # 원본 존재 확인
    missing = [f for f in SNAPSHOT_FILES if not (DATA / f).exists()]
    if missing:
        sys.exit(f"[오류] 원본 파일 없음: {missing}\n  먼저 convert_xlsx_to_json.py 를 실행하세요.")

    target.mkdir(parents=True, exist_ok=True)

    # 복사
    for name in SNAPSHOT_FILES:
        src = DATA / name
        dst = target / name
        shutil.copy2(src, dst)
        print(f"[복사] {name}")

    # README 생성
    kst = timezone(timedelta(hours=9))
    stamp = datetime.now(kst).strftime("%Y-%m-%d %H:%M:%S KST")
    counts_md = summarize_counts(target / "조특법_메타.json")
    readme = target / "_README.md"
    note_md = f"\n## 메모\n{args.note}\n" if args.note else ""
    readme.write_text(
        f"# {year}년 세법 기준 스냅샷\n\n"
        f"- 스냅샷 생성: {stamp}\n"
        f"- 기준: {year}년 조특법·관련법 시행 상태\n\n"
        f"## 포함 내용\n{counts_md}\n"
        f"{note_md}"
        f"\n---\n"
        f"이 디렉토리는 변경하지 마세요. 과거 조회 전용입니다.\n"
        f"복원이 필요하면 `python scripts/json_to_xlsx.py {year}` 로 엑셀로 환원 가능.\n",
        encoding="utf-8",
    )
    print(f"[OK] 스냅샷 생성 완료: {target}")
    print(f"     README: {readme}")
    print()
    print("다음 단계: convert_xlsx_to_json.py 재실행 → 연도목록.json 갱신")


if __name__ == "__main__":
    main()
