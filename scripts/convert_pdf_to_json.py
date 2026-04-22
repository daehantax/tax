"""산업통상부 기회발전특구 지정 통합고시 PDF → JSON 변환기.

입력: data/산업통상부고시제2026-10호(기회발전특구 지정 통합고시).pdf
출력: data/기회발전특구_지정현황.json

구조:
  Phase 1 - 페이지 1~2의 요약 표에서 (시도, 시군구, 부지명, 지정고시일, 면적) 추출
  Phase 2 - 페이지 3~이후의 시도별 "Ⅱ. 지번" 표에서 (시도, 부지명) → 지번 매핑
  Phase 3 - 두 데이터를 병합해 JSON 레코드 생성
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pdfplumber

REPO_ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = REPO_ROOT / "data" / "산업통상부고시제2026-10호(기회발전특구 지정 통합고시).pdf"
JSON_PATH = REPO_ROOT / "data" / "기회발전특구_지정현황.json"

SUMMARY_HEADER = ("No", "시·도", "시·군·구", "부지명")
SIDO_MARKER = re.compile(r"^ㅇ\s*(\S+(?:특별자치도|특별자치시|광역시|특별시|도))\s*$")


def normalize_cell(v):
    if v is None:
        return None
    return " ".join(v.replace("\n", " ").split()).strip() or None


def normalize_site_name(name: str | None) -> str:
    """부지명 매칭용: 공백·점·괄호 접두·'등' 제거 + 축약어 통일."""
    if not name:
        return ""
    s = name
    s = re.sub(r"^\([^)]+\)\s*", "", s)
    s = re.sub(r"[, ]+등$", "", s)
    s = s.replace("일반산단", "일반산업단지")
    s = re.sub(r"[\s·ㆍ,]+", "", s)
    return s


def squeeze_row(row: list) -> list:
    """선·후행 None 컬럼을 제거해 의미있는 3열로 압축."""
    cleaned = [normalize_cell(c) for c in row]
    # 선행 None 제거
    while cleaned and cleaned[0] is None:
        cleaned.pop(0)
    # 후행 None 제거
    while cleaned and cleaned[-1] is None:
        cleaned.pop()
    return cleaned


def parse_date_token(tok: str | None) -> str | None:
    """`24.11.6`, `25.7.30`, `26.2.5` → '2024-11-06' 형식."""
    if not tok:
        return None
    m = re.search(r"(\d{2})\.(\d{1,2})\.(\d{1,2})", tok)
    if not m:
        return None
    yy, mm, dd = m.groups()
    return f"20{yy}-{int(mm):02d}-{int(dd):02d}"


def parse_area(tok: str | None) -> int | None:
    if not tok:
        return None
    digits = re.sub(r"[^\d]", "", tok)
    return int(digits) if digits else None


def extract_summary(pdf) -> list[dict]:
    """페이지 1~2의 요약 표에서 사이트 레코드 추출."""
    rows: list[dict] = []
    last_no: str | None = None
    last_sido: str | None = None
    last_sigungu: str | None = None
    last_date: str | None = None

    for page_idx in (0, 1):
        page = pdf.pages[page_idx]
        tables = page.extract_tables()
        if not tables:
            continue
        table = tables[0]
        for raw_row in table:
            row = [normalize_cell(c) for c in raw_row]
            if row and row[0] == "No" and row[1] and "시" in row[1]:
                continue
            if len(row) < 6:
                continue
            no, sido, sigungu, site, date, area = row[:6]

            if no:
                last_no = no
            if sido:
                last_sido = sido
                last_sigungu = None  # 시도가 바뀌면 시군구 리셋
            if date:
                last_date = date

            if sigungu == "합계":
                last_date = None
                last_sigungu = None
                continue
            if site is None:
                continue

            # 시군구 세로 병합 포워드-필
            if sigungu:
                last_sigungu = sigungu
            effective_sigungu = sigungu or last_sigungu

            rows.append(
                {
                    "no": int(last_no) if last_no and last_no.isdigit() else None,
                    "시도": last_sido,
                    "시군구": effective_sigungu,
                    "부지명": site,
                    "지정고시일": parse_date_token(date or last_date),
                    "지정면적_㎡": parse_area(area),
                }
            )
    return rows


def _find_sido_markers(page) -> list[tuple[float, str]]:
    """페이지 내 'ㅇ <시도>' 마커의 (top y, 시도명) 리스트 반환."""
    markers: list[tuple[float, str]] = []
    # 단어 단위로 모아 라인 재구성
    words = page.extract_words(use_text_flow=True, keep_blank_chars=False)
    lines: dict[int, list] = {}
    for w in words:
        key = round(w["top"] / 3)  # 3px 버킷으로 같은 라인 묶기
        lines.setdefault(key, []).append(w)
    for _, ws in sorted(lines.items(), key=lambda x: x[0]):
        ws.sort(key=lambda w: w["x0"])
        text_line = " ".join(w["text"] for w in ws).strip()
        m = SIDO_MARKER.match(text_line)
        if m:
            markers.append((ws[0]["top"], m.group(1)))
    return markers


def extract_jibun(pdf) -> dict[tuple[str, str], str]:
    """페이지 3 이후의 시도별 지번 표에서 (시도, 부지명) → 지번 매핑."""
    mapping: dict[tuple[str, str], str] = {}
    current_sido: str | None = None
    last_site: str | None = None
    last_table_sido: str | None = None  # 이전 표의 귀속 시도 — 바뀌면 last_site 초기화

    for page_idx in range(2, len(pdf.pages)):
        page = pdf.pages[page_idx]
        markers = _find_sido_markers(page)

        # 페이지 처리 끝나면 가장 마지막 마커를 current_sido에 반영 (다음 페이지로 이월)
        def flush_trailing_sido():
            nonlocal current_sido
            if markers:
                current_sido = markers[-1][1]

        for tbl in page.find_tables():
            top = tbl.bbox[1]
            # 이 표 위쪽에 있는 마지막 마커의 시도를 사용 (마커 없으면 이전 페이지 컨텍스트)
            sido_here = current_sido
            for mtop, ms in markers:
                if mtop <= top:
                    sido_here = ms
            if sido_here is None:
                continue

            if sido_here != last_table_sido:
                last_site = None
            last_table_sido = sido_here
            current_sido = sido_here

            table = tbl.extract()

            if not table:
                continue
            # 지형도면 표(시군구/부지명/지번 헤더 아님)는 건너뜀
            has_header = any(
                row and any(normalize_cell(c) == "시·군·구" for c in row)
                and any(normalize_cell(c) == "지번" for c in row)
                for row in table
            )
            # 지번 표가 아닌 지형도면 표라면 헤더는 없지만 잎 셀이 문자열 "(xx시)"로 시작
            is_jibun_table = has_header or any(
                len(squeeze_row(r)) == 3 for r in table
            )
            if not is_jibun_table:
                # 지형도면 표로 보이면 스킵 (이미지 리스트)
                all_imgs = all(
                    not any(c and ("/" in c or "지번" in c) for c in (r or []))
                    for r in table
                )
                if all_imgs:
                    continue

            for raw_row in table:
                cols = squeeze_row(raw_row)
                if len(cols) < 1:
                    continue
                # 헤더 행 스킵
                if len(cols) >= 3 and cols[0] == "시·군·구" and "지번" in (cols[2] or ""):
                    continue

                if len(cols) >= 3:
                    sigungu, site, jibun = cols[0], cols[1], cols[2]
                elif len(cols) == 2:
                    sigungu, site, jibun = None, cols[0], cols[1]
                else:
                    sigungu, site, jibun = None, None, cols[0]

                if site:
                    last_site = site
                if not last_site or not jibun:
                    continue

                key = (current_sido, normalize_site_name(last_site))
                existing = mapping.get(key, "")
                # 여러 행에 걸쳐 지번이 나뉘는 경우 이어붙임
                piece = jibun.replace("\n", " ").strip()
                if piece and piece not in existing:
                    mapping[key] = (existing + " " + piece).strip() if existing else piece

        flush_trailing_sido()
    return mapping


def build_dataset() -> dict:
    with pdfplumber.open(PDF_PATH) as pdf:
        summary = extract_summary(pdf)
        jibun_map = extract_jibun(pdf)

    for row in summary:
        key = (row["시도"], normalize_site_name(row["부지명"]))
        row["지번"] = jibun_map.get(key)

    total_area = sum((r.get("지정면적_㎡") or 0) for r in summary)
    return {
        "고시번호": "산업통상부고시 제2026-10호",
        "제목": "기회발전특구 지정 통합고시",
        "고시일": "2026-02-05",
        "근거법령": "지방자치분권 및 지역균형발전에 관한 특별법 제23조 제2항",
        "총_사이트수": len(summary),
        "총_지정면적_㎡": total_area,
        "sites": summary,
    }


def main():
    data = build_dataset()
    JSON_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {JSON_PATH.relative_to(REPO_ROOT)}")
    print(f"  총 {data['총_사이트수']}개 사이트 / {data['총_지정면적_㎡']:,}㎡")
    # 시도별 요약
    from collections import Counter
    by_sido = Counter(r["시도"] for r in data["sites"])
    for sido, n in sorted(by_sido.items()):
        print(f"  - {sido}: {n}개")


if __name__ == "__main__":
    main()
