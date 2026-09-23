/* ===========================================================
   조정대상지역 판정 모듈 (공통)
   - 데이터 : data/조정대상지역.json
   - 사용처 : 조정대상지역 조회 페이지, (3단계) 양도세·취득세·종부세 계산기

   사용 예)
     const data = await AdjustedArea.load("../../data/조정대상지역.json");
     const r = AdjustedArea.judge(data, {
         시도: "경기도", 시군구: "화성시 동탄구", 읍면동: "", 기준일: "2026-08-01",
         거주요건특례: false   // true 이면 2017.9.6 지정분을 2017.8.3 지정으로 봄 (소득령 §154①)
     });
     r.상태  → "조정" | "비조정" | "확인필요"
     r.요약  → 한 줄 설명
     r.근거  → [{ 레코드, 판정: "해당"|"확인필요"|"제외"|"선해제로 배제", 사유 }]
   =========================================================== */
(function (global) {
    "use strict";

    const T2_ORIGINAL = "2017-09-06";   // 2017.9.6 고시
    const T2_DEEMED = "2017-08-03";     // 소득령 §154① 적용시 의제 지정일

    let cache = null;

    /** JSON 을 한 번만 읽어서 보관 */
    async function load(url) {
        if (cache) return cache;
        const res = await fetch(url);
        if (!res.ok) throw new Error("조정대상지역 데이터를 읽지 못했습니다: " + res.status);
        cache = await res.json();
        return cache;
    }

    /** 특례(T2) 반영한 실제 지정일 */
    function startDate(rec, useT2) {
        if (useT2 && rec.지정일 === T2_ORIGINAL && (rec.특례 || []).includes("T2")) return T2_DEEMED;
        return rec.지정일;
    }

    /** 기준일에 지정 기간 안인가? (지정일 <= 기준일 < 해제일) */
    function isActive(rec, day, useT2) {
        return startDate(rec, useT2) <= day && (rec.해제일 === null || day < rec.해제일);
    }

    /**
     * 레코드의 시군구가 입력 시군구를 포함하는가?
     *  - 같은 이름이면 포함
     *  - 레코드가 "화성시", 입력이 "화성시 동탄구" → 포함 (시 전체 레코드는 모든 구를 포함)
     */
    function coversArea(rec, 시도, 시군구) {
        if (rec.시도 !== 시도) return false;
        return rec.시군구.some(a => a === 시군구 || 시군구.startsWith(a + " "));
    }

    /**
     * 읍면동 이름 비교
     *  "같음"   : 입력이 목록 항목과 같거나 그 하위 (예: 항목 "서신면", 입력 "서신면 백미리")
     *  "부분"   : 입력이 목록 항목의 상위 (예: 항목 "원삼면 사암리", 입력 "원삼면") → 리까지 봐야 앎
     *  "다름"
     */
    function matchPlace(input, item) {
        if (!input) return "다름";
        if (input === item || input.startsWith(item + " ")) return "같음";
        if (item.startsWith(input + " ")) return "부분";
        return "다름";
    }

    function matchList(input, list) {
        let best = "다름";
        for (const item of list || []) {
            const m = matchPlace(input, item);
            if (m === "같음") return "같음";
            if (m === "부분") best = "부분";
        }
        return best;
    }

    /**
     * 선해제(세부) 레코드가 일반 레코드를 덮어쓰는가?
     *  세부 레코드(포함 목록 있음)가 일반 레코드의 같은 지정 기간 중에 시작했다면,
     *  그 읍면동에 대해서는 세부 레코드의 기간이 우선한다.
     *  예) 화성시 전역(2020.6.19~2022.11.14) 중 서신면(2020.6.19~2022.7.5) 선해제
     */
    function overrides(specific, general) {
        return general.지정일 <= specific.지정일 &&
            (general.해제일 === null || specific.지정일 < general.해제일);
    }

    /** 레코드 하나를 입력 읍면동에 적용 */
    function applyRecord(rec, 읍면동) {
        if (rec.포함) {
            if (!읍면동) return { 판정: "확인필요", 사유: "일부 지역만 지정: " + (rec.세부 || rec.포함.join(", ")) };
            const m = matchList(읍면동, rec.포함);
            if (m === "다름") return null;
            if (m === "부분") return { 판정: "확인필요", 사유: "리(里) 단위까지 확인 필요: " + rec.포함.join(", ") };
            if (rec.지구한정) return { 판정: "확인필요", 사유: "택지개발지구 등 지구 안인 경우에만 지정 — 지구 포함 여부 확인" };
            return { 판정: "해당", 사유: 읍면동 + " 지정 대상" };
        }
        if (rec.제외) {
            if (!읍면동) return { 판정: "확인필요", 사유: "제외지역이 아니면 조정: " + rec.제외.join(", ") + " 제외" };
            const m = matchList(읍면동, rec.제외);
            if (m === "같음") return { 판정: "제외", 사유: 읍면동 + " 은(는) 제외지역" };
            if (m === "부분") return { 판정: "확인필요", 사유: "리(里) 단위 제외 있음: " + rec.제외.join(", ") };
            return { 판정: "해당", 사유: "제외지역 아님" };
        }
        return { 판정: "해당", 사유: "전역 지정" };
    }

    /**
     * 판정
     * @param {object} data  load() 결과
     * @param {object} q     { 시도, 시군구, 읍면동?, 기준일(YYYY-MM-DD), 거주요건특례? }
     */
    function judge(data, q) {
        const 읍면동 = (q.읍면동 || "").trim();
        const day = q.기준일;
        const useT2 = !!q.거주요건특례;

        const all = data.지정이력.filter(r => coversArea(r, q.시도, q.시군구));

        // 입력 읍면동에 해당하는 세부(포함) 레코드
        const specifics = 읍면동
            ? all.filter(r => r.포함 && matchList(읍면동, r.포함) === "같음")
            : [];

        const 근거 = [];
        for (const rec of all) {
            if (!isActive(rec, day, useT2)) continue;

            // 일반 레코드가 선해제 세부 레코드에 덮어써지는지 확인
            if (!rec.포함) {
                const over = specifics.find(s => overrides(s, rec));
                if (over && !isActive(over, day, useT2)) {
                    근거.push({ 레코드: rec, 판정: "선해제로 배제", 사유: `${over.id} 에 따라 ${formatDate(over.해제일)} 해제` });
                    continue;
                }
            }

            const a = applyRecord(rec, 읍면동);
            if (a) 근거.push({ 레코드: rec, ...a });
        }

        // "화성시"만 골랐는데 "화성시 동탄구" 처럼 구 단위로 지정된 경우 → 구까지 확인 필요
        const subAreas = data.지정이력.filter(r =>
            r.시도 === q.시도 && isActive(r, day, useT2) &&
            r.시군구.some(a => a.startsWith(q.시군구 + " ")));
        for (const rec of subAreas) {
            const gus = rec.시군구.filter(a => a.startsWith(q.시군구 + " ")).join(", ");
            근거.push({ 레코드: rec, 판정: "확인필요", 사유: "구 단위로 지정됨: " + gus + " — 구까지 선택하세요" });
        }

        let 상태 = "비조정";
        if (근거.some(g => g.판정 === "해당")) 상태 = "조정";
        else if (근거.some(g => g.판정 === "확인필요")) 상태 = "확인필요";

        const 요약 = {
            "조정": `${formatDate(day)} 기준 조정대상지역입니다.`,
            "비조정": `${formatDate(day)} 기준 조정대상지역이 아닙니다.`,
            "확인필요": `${formatDate(day)} 기준 일부 지역만 지정되어 있어 읍·면·동(또는 지구) 확인이 필요합니다.`
        }[상태];

        return { 상태, 요약, 근거, 이력: all };
    }

    /** 기준일에 지정 중인 레코드 목록 (현황표용) */
    function activeOn(data, day) {
        return data.지정이력.filter(r => isActive(r, day, false));
    }

    /** "2017-09-06" → "2017.09.06" */
    function formatDate(d) {
        return d ? d.replace(/-/g, ".") : "";
    }

    global.AdjustedArea = { load, judge, activeOn, isActive, formatDate };
})(window);
