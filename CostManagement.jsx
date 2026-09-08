import { useState, useEffect } from "react";

// ────────────────────────────────────────────────────────────
// 길갈라운지 비용관리 — 유지비 카테고리 확장판
// 매월 정기비용 / 연간·비정기 관리비 / 수선예비비 / 설비점검 체크리스트
// ────────────────────────────────────────────────────────────

const STORAGE_KEY = "gilgal-cost-management-v1";

const MONTHLY_ITEMS = [
  { id: "m1", name: "전기·수도·난방비", memo: "계절별 변동 큼 (겨울 난방↑)" },
  { id: "m2", name: "인터넷·통신비", memo: "" },
  { id: "m3", name: "개별 보안장비 비용", memo: "CCTV·도어락 등" },
  { id: "m4", name: "왕복 교통비", memo: "관리 방문 시" },
  { id: "m5", name: "공용시설 관리·분담 비용", memo: "해당 시" },
];

const ANNUAL_ITEMS = [
  { id: "a1", name: "정원·제초·조경 관리비", memo: "계절별" },
  { id: "a2", name: "외벽·지붕·배수로 점검비", memo: "연 1~2회" },
  { id: "a3", name: "데크·외부시설 유지비", memo: "" },
  { id: "a4", name: "세금·보험료", memo: "보유세·종부세, 화재·재산 보험료" },
  { id: "a5", name: "소모품 교체비", memo: "필터, 전구, 방충망 등" },
];

const EQUIPMENT_ITEMS = [
  { id: "e1", name: "보일러·온수설비" },
  { id: "e2", name: "환풍기" },
  { id: "e3", name: "수전" },
  { id: "e4", name: "조명" },
  { id: "e5", name: "방충망" },
  { id: "e6", name: "도어락" },
  { id: "e7", name: "각종 필터" },
];

function makeInitialState() {
  const amounts = {};
  const memos = {};
  [...MONTHLY_ITEMS, ...ANNUAL_ITEMS].forEach((i) => {
    amounts[i.id] = "";
    memos[i.id] = i.memo || "";
  });
  const equipment = {};
  EQUIPMENT_ITEMS.forEach((i) => {
    equipment[i.id] = { checked: false, date: "" };
  });
  return { amounts, memos, reserve: "", equipment };
}

function toNumber(v) {
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatWon(n) {
  return Math.round(n).toLocaleString("ko-KR") + "원";
}

export default function CostManagement() {
  const [state, setState] = useState(makeInitialState());
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          setState({ ...makeInitialState(), ...JSON.parse(res.value) });
        }
      } catch (e) {
        // 첫 사용이면 키가 없어서 에러가 날 수 있음 — 무시
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(state), false);
        setSaveState("saved");
      } catch (e) {
        setSaveState("idle");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [state, loaded]);

  const setAmount = (id, v) =>
    setState((s) => ({ ...s, amounts: { ...s.amounts, [id]: v } }));
  const setMemo = (id, v) =>
    setState((s) => ({ ...s, memos: { ...s.memos, [id]: v } }));
  const setReserve = (v) => setState((s) => ({ ...s, reserve: v }));
  const setEquipment = (id, field, v) =>
    setState((s) => ({
      ...s,
      equipment: { ...s.equipment, [id]: { ...s.equipment[id], [field]: v } },
    }));

  const monthlySum = MONTHLY_ITEMS.reduce(
    (sum, i) => sum + toNumber(state.amounts[i.id]),
    0
  );
  const annualSum = ANNUAL_ITEMS.reduce(
    (sum, i) => sum + toNumber(state.amounts[i.id]),
    0
  );
  const reserveAmount = toNumber(state.reserve);

  const monthlyEquivalent = monthlySum + (annualSum + reserveAmount) / 12;
  const annualTotal = monthlySum * 12 + annualSum + reserveAmount;

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: #a99f88; }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <header style={styles.header}>
        <p style={styles.eyebrow}>길갈라운지 · 비용관리</p>
        <h1 style={styles.title}>연간 유지비 정리</h1>
        <p style={styles.sub}>
          매월 나가는 돈과 연간·비정기로 나가는 돈을 나눠서 적어두면,
          한 해 전체 부담을 한눈에 비교할 수 있어요.
        </p>
      </header>

      <Section
        tone="green"
        title="매월 정기 비용"
        subtitle="달마다 반복되는 지출"
      >
        {MONTHLY_ITEMS.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            amount={state.amounts[item.id]}
            memo={state.memos[item.id]}
            onAmount={(v) => setAmount(item.id, v)}
            onMemo={(v) => setMemo(item.id, v)}
          />
        ))}
        <RowTotal label="매월 합계" value={monthlySum} />
      </Section>

      <Section
        tone="brown"
        title="연간·비정기 관리비"
        subtitle="1년에 한두 번, 또는 비정기적으로 나가는 지출"
      >
        {ANNUAL_ITEMS.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            amount={state.amounts[item.id]}
            memo={state.memos[item.id]}
            onAmount={(v) => setAmount(item.id, v)}
            onMemo={(v) => setMemo(item.id, v)}
          />
        ))}
        <RowTotal label="연간 합계" value={annualSum} />
      </Section>

      <Section tone="gold" title="수선 예비비" subtitle="갑작스런 설비 고장·교체 대비">
        <div style={styles.reserveBox}>
          <p style={styles.reserveText}>
            매년 일정 금액을 미리 떼어두면, 보일러 고장 같은 갑작스러운
            상황에도 당황하지 않을 수 있어요.
          </p>
          <div style={styles.inputRow}>
            <label style={styles.inputLabel}>연간 배정액</label>
            <input
              style={styles.amountInput}
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={state.reserve}
              onChange={(e) => setReserve(e.target.value)}
            />
            <span style={styles.won}>원</span>
          </div>
        </div>
      </Section>

      <Section
        tone="green"
        title="설비 점검 체크리스트"
        subtitle="소모품·설비는 정기적으로 점검해야 갑작스런 교체를 줄일 수 있어요"
      >
        <div style={styles.equipGrid}>
          {EQUIPMENT_ITEMS.map((item) => (
            <div key={item.id} style={styles.equipRow}>
              <label style={styles.equipCheckLabel}>
                <input
                  type="checkbox"
                  checked={state.equipment[item.id].checked}
                  onChange={(e) =>
                    setEquipment(item.id, "checked", e.target.checked)
                  }
                  style={styles.checkbox}
                />
                <span
                  style={
                    state.equipment[item.id].checked
                      ? styles.equipNameChecked
                      : styles.equipName
                  }
                >
                  {item.name}
                </span>
              </label>
              <input
                type="date"
                style={styles.dateInput}
                value={state.equipment[item.id].date}
                onChange={(e) =>
                  setEquipment(item.id, "date", e.target.value)
                }
              />
            </div>
          ))}
        </div>
        <p style={styles.equipHint}>날짜: 마지막 점검일</p>
      </Section>

      <footer style={styles.footer}>
        <div style={styles.footerRow}>
          <span style={styles.footerLabel}>월 환산 합계</span>
          <span style={styles.footerValue}>{formatWon(monthlyEquivalent)}</span>
        </div>
        <div style={styles.footerDivider} />
        <div style={styles.footerRow}>
          <span style={styles.footerLabel}>연간 예상 합계</span>
          <span style={styles.footerValueGold}>{formatWon(annualTotal)}</span>
        </div>
        <p style={styles.footerNote}>
          연간·비정기 비용과 수선 예비비는 12개월로 나눠 월 환산액에
          포함했어요.
        </p>
        <p style={styles.saveNote}>
          {saveState === "saving" ? "저장 중…" : "자동 저장됨"}
        </p>
      </footer>
    </div>
  );
}

function Section({ tone, title, subtitle, children }) {
  const bar = tone === "green" ? "#1E3B2C" : tone === "brown" ? "#8A5A34" : "#A8874F";
  return (
    <section style={styles.section}>
      <div style={{ ...styles.sectionBar, background: bar }} />
      <div style={styles.sectionBody}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        {subtitle && <p style={styles.sectionSubtitle}>{subtitle}</p>}
        <div style={styles.sectionContent}>{children}</div>
      </div>
    </section>
  );
}

function ItemRow({ item, amount, memo, onAmount, onMemo }) {
  return (
    <div style={styles.itemRow}>
      <div style={styles.itemHead}>
        <span style={styles.itemName}>{item.name}</span>
        <div style={styles.inputRowTight}>
          <input
            style={styles.amountInputSmall}
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
          />
          <span style={styles.wonSmall}>원</span>
        </div>
      </div>
      <input
        style={styles.memoInput}
        type="text"
        placeholder="비고"
        value={memo}
        onChange={(e) => onMemo(e.target.value)}
      />
    </div>
  );
}

function RowTotal({ label, value }) {
  return (
    <div style={styles.rowTotal}>
      <span style={styles.rowTotalLabel}>{label}</span>
      <span style={styles.rowTotalValue}>{formatWon(value)}</span>
    </div>
  );
}

const styles = {
  page: {
    fontFamily:
      "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif",
    background: "#F6F2E8",
    color: "#2A2A24",
    maxWidth: 640,
    margin: "0 auto",
    padding: "28px 16px 100px",
    lineHeight: 1.5,
  },
  header: { marginBottom: 28 },
  eyebrow: {
    fontSize: 13,
    color: "#8A5A34",
    fontWeight: 600,
    letterSpacing: 0.2,
    margin: "0 0 6px",
  },
  title: {
    fontFamily: "Georgia, 'Nanum Myeongjo', serif",
    fontSize: 26,
    color: "#1E3B2C",
    margin: "0 0 10px",
  },
  sub: { fontSize: 14, color: "#5c5747", margin: 0 },

  section: {
    display: "flex",
    background: "#FFFDF7",
    border: "1px solid #E7DFC9",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 18,
  },
  sectionBar: { width: 6, flexShrink: 0 },
  sectionBody: { padding: "18px 18px 16px", flex: 1, minWidth: 0 },
  sectionTitle: {
    fontFamily: "Georgia, 'Nanum Myeongjo', serif",
    fontSize: 18,
    margin: "0 0 4px",
    color: "#1E3B2C",
  },
  sectionSubtitle: { fontSize: 12.5, color: "#8b8368", margin: "0 0 14px" },
  sectionContent: { display: "flex", flexDirection: "column", gap: 12 },

  itemRow: {
    borderBottom: "1px solid #EFE9D8",
    paddingBottom: 10,
  },
  itemHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  itemName: { fontSize: 14.5, fontWeight: 500 },
  inputRowTight: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 },
  amountInputSmall: {
    width: 92,
    textAlign: "right",
    padding: "6px 8px",
    border: "1px solid #D8D0B8",
    borderRadius: 6,
    fontSize: 14,
    background: "#FCFAF3",
  },
  wonSmall: { fontSize: 13, color: "#6f6a58" },
  memoInput: {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #EFE9D8",
    borderRadius: 6,
    fontSize: 12.5,
    color: "#6f6a58",
    background: "transparent",
  },

  rowTotal: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  rowTotalLabel: { fontSize: 13.5, fontWeight: 600, color: "#1E3B2C" },
  rowTotalValue: { fontSize: 15, fontWeight: 700, color: "#1E3B2C" },

  reserveBox: {
    background: "#FBF5E6",
    border: "1px solid #E9DBB6",
    borderRadius: 8,
    padding: 14,
  },
  reserveText: { fontSize: 13, color: "#6f6a58", margin: "0 0 12px" },
  inputRow: { display: "flex", alignItems: "center", gap: 8 },
  inputLabel: { fontSize: 13.5, fontWeight: 600, flexShrink: 0 },
  amountInput: {
    flex: 1,
    padding: "8px 10px",
    border: "1px solid #D8D0B8",
    borderRadius: 6,
    fontSize: 15,
    textAlign: "right",
    background: "#FFFDF7",
  },
  won: { fontSize: 13, color: "#6f6a58" },

  equipGrid: { display: "flex", flexDirection: "column", gap: 8 },
  equipRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "6px 0",
    borderBottom: "1px solid #EFE9D8",
  },
  equipCheckLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    cursor: "pointer",
  },
  checkbox: { width: 16, height: 16, accentColor: "#1E3B2C" },
  equipName: { fontSize: 14 },
  equipNameChecked: { fontSize: 14, color: "#9a9481", textDecoration: "line-through" },
  dateInput: {
    fontSize: 12.5,
    padding: "4px 6px",
    border: "1px solid #E7DFC9",
    borderRadius: 6,
    color: "#6f6a58",
    background: "#FCFAF3",
  },
  equipHint: { fontSize: 11.5, color: "#a99f88", marginTop: 8, textAlign: "right" },

  footer: {
    position: "sticky",
    bottom: 0,
    background: "#1E3B2C",
    color: "#F6F2E8",
    borderRadius: 10,
    padding: "16px 18px",
    marginTop: 8,
  },
  footerRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  footerLabel: { fontSize: 13.5, opacity: 0.85 },
  footerValue: { fontSize: 19, fontWeight: 700 },
  footerValueGold: { fontSize: 19, fontWeight: 700, color: "#E3C687" },
  footerDivider: { height: 1, background: "rgba(255,255,255,0.15)", margin: "10px 0" },
  footerNote: { fontSize: 11.5, opacity: 0.7, margin: "10px 0 0" },
  saveNote: { fontSize: 11, opacity: 0.55, margin: "6px 0 0", textAlign: "right" },
};
