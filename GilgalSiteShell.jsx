import { useState, useEffect, useRef } from "react";

// ────────────────────────────────────────────────────────────
// 길갈라운지 사이트 구조 (탭 순서: 홈 · 객실 · 리뷰 · 사진 · 주변 · 지도 · 예약조회 · Q&A)
//
// "리뷰" 탭에는 실제로 작동하는 후기 게시판을 연결했어요.
// 나머지 탭은 자리만 잡아뒀으니, 기존에 만들어두신 화면(룸투어, 예약폼,
// 갤러리, 관광지 안내, Q&A 게시판)의 코드를 그 자리에 넣으시면 돼요.
// ────────────────────────────────────────────────────────────

const TABS = [
  { key: "home", label: "홈" },
  { key: "rooms", label: "객실" },
  { key: "reviews", label: "리뷰" },
  { key: "gallery", label: "사진" },
  { key: "nearby", label: "주변" },
  { key: "map", label: "지도" },
  { key: "lookup", label: "예약조회" },
  { key: "qna", label: "Q&A" },
];

export default function GilgalSiteShell() {
  const [active, setActive] = useState("home");

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>길갈라운지</p>
        <h1 style={styles.title}>줄포에서 마음돌보기</h1>
      </header>

      <nav style={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            style={{
              ...styles.tabBtn,
              ...(active === t.key ? styles.tabBtnActive : {}),
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {active === "home" && <PlaceholderPanel title="홈" desc="히어로 섹션, 숙소 소개 — 지금 만들어두신 화면을 그대로 이 자리에 두시면 돼요." />}
        {active === "rooms" && <PlaceholderPanel title="객실" desc="룸투어(마루·큰방·작은방·주방·화장실·자갈마당), 예약 캘린더, 예약 폼이 들어갈 자리예요." />}
        {active === "reviews" && <ReviewBoard />}
        {active === "gallery" && <PlaceholderPanel title="사진" desc="관리자 포털의 갤러리·사진관리 기능과 연결된 사진들이 여기 보이면 돼요." />}
        {active === "nearby" && <PlaceholderPanel title="주변" desc="부안·군산·정읍·광주·목포 관광지와 물때 안내가 들어갈 자리예요." />}
        {active === "map" && <PlaceholderPanel title="지도" desc="숙소 위치 지도 — 아직 없다면 새로 추가하면 좋아요." />}
        {active === "lookup" && <PlaceholderPanel title="예약조회" desc="전화번호로 내 예약 확인하는 기능이 들어갈 자리예요." />}
        {active === "qna" && <PlaceholderPanel title="Q&A" desc="지금 있는 공개 질문/답변 게시판을 이 자리에 두시면 돼요." />}
      </main>
    </div>
  );
}

function PlaceholderPanel({ title, desc }) {
  return (
    <div style={styles.placeholder}>
      <p style={styles.placeholderLabel}>{title} 자리</p>
      <p style={styles.placeholderDesc}>{desc}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 리뷰 탭 — 실제로 작동하는 후기 게시판
// ────────────────────────────────────────────────────────────

const INDEX_KEY = "gilgal-review-index";
const REVIEW_PREFIX = "gilgal-review:";
const MAX_DIM = 1100;
const JPEG_QUALITY = 0.72;

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지를 처리할 수 없어요"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height >= width && height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function Stars({ value, onChange }) {
  return (
    <div style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{ ...styles.starBtn, color: n <= value ? "#B08D57" : "#DCD5C0" }}
          aria-label={`${n}점`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function StarsDisplay({ value }) {
  return (
    <span style={styles.starDisplay}>
      {"★".repeat(value)}
      <span style={{ color: "#DCD5C0" }}>{"★".repeat(5 - value)}</span>
    </span>
  );
}

function ReviewBoard() {
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const idxRes = await window.storage.get(INDEX_KEY, true);
        const ids = idxRes && idxRes.value ? JSON.parse(idxRes.value) : [];
        const loadedReviews = [];
        for (const id of ids) {
          try {
            const r = await window.storage.get(REVIEW_PREFIX + id, true);
            if (r && r.value) loadedReviews.push(JSON.parse(r.value));
          } catch (e) {}
        }
        setReviews(loadedReviews);
      } catch (e) {
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoErr("사진 파일만 올릴 수 있어요.");
      return;
    }
    setPhotoErr("");
    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setPhotoData(dataUrl);
    } catch (err) {
      setPhotoErr("사진을 불러오는 데 실패했어요. 다른 사진으로 시도해 주세요.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function clearPhoto() {
    setPhotoData("");
    setPhotoErr("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const canSubmit = name.trim() && text.trim() && !submitting && !photoBusy;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitErr("");
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newReview = {
      id,
      name: name.trim(),
      rating,
      text: text.trim(),
      photoData,
      date: new Date().toISOString(),
    };
    try {
      const saveRes = await window.storage.set(REVIEW_PREFIX + id, JSON.stringify(newReview), true);
      if (!saveRes) throw new Error("save failed");
      let ids = [];
      try {
        const idxRes = await window.storage.get(INDEX_KEY, true);
        ids = idxRes && idxRes.value ? JSON.parse(idxRes.value) : [];
      } catch (e) {
        ids = [];
      }
      ids = [id, ...ids];
      await window.storage.set(INDEX_KEY, JSON.stringify(ids), true);
      setReviews((prev) => [newReview, ...prev]);
      setName("");
      setRating(5);
      setText("");
      clearPhoto();
    } catch (err) {
      setSubmitErr("등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const avg =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <div>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #a99f88; }
      `}</style>

      <p style={styles.sub}>다녀가신 소감과 사진을 남겨주시면, 다음 손님들에게 큰 도움이 돼요.</p>
      {avg && (
        <div style={styles.avgBox}>
          <StarsDisplay value={Math.round(avg)} />
          <span style={styles.avgText}>평균 {avg}점 · 후기 {reviews.length}개</span>
        </div>
      )}

      <form style={styles.form} onSubmit={handleSubmit}>
        <h2 style={styles.formTitle}>후기 남기기</h2>

        <label style={styles.label}>
          이름 (닉네임 가능)
          <input style={styles.input} type="text" value={name} maxLength={30} placeholder="예: 부안 여행자" onChange={(e) => setName(e.target.value)} />
        </label>

        <label style={styles.label}>
          별점
          <Stars value={rating} onChange={setRating} />
        </label>

        <label style={styles.label}>
          후기 내용
          <textarea style={styles.textarea} rows={4} maxLength={800} placeholder="숙소는 어떠셨나요?" value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        <label style={styles.label}>
          사진 (선택)
          <input ref={fileInputRef} style={styles.fileInput} type="file" accept="image/*" onChange={handleFileChange} />
        </label>
        {photoBusy && <p style={styles.hintText}>사진 준비 중…</p>}
        {photoErr && <p style={styles.imgErrorText}>{photoErr}</p>}
        {photoData && !photoBusy && (
          <div style={styles.previewWrap}>
            <img src={photoData} alt="첨부 사진 미리보기" style={styles.previewImg} />
            <button type="button" style={styles.removePhotoBtn} onClick={clearPhoto}>사진 제거</button>
          </div>
        )}

        <button type="submit" style={{ ...styles.submitBtn, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }} disabled={!canSubmit}>
          {submitting ? "등록 중…" : "후기 등록하기"}
        </button>
        {submitErr && <p style={styles.errorText}>{submitErr}</p>}
      </form>

      <section style={styles.list}>
        {!loaded ? (
          <p style={styles.emptyText}>불러오는 중…</p>
        ) : reviews.length === 0 ? (
          <p style={styles.emptyText}>아직 등록된 후기가 없어요. 첫 후기를 남겨주세요!</p>
        ) : (
          reviews.map((r) => (
            <article key={r.id} style={styles.card}>
              <div style={styles.cardHead}>
                <div>
                  <span style={styles.cardName}>{r.name}</span>
                  <StarsDisplay value={r.rating} />
                </div>
                <span style={styles.cardDate}>{formatDate(r.date)}</span>
              </div>
              {r.photoData && <img src={r.photoData} alt={`${r.name}님이 남긴 사진`} style={styles.cardImg} />}
              <p style={styles.cardText}>{r.text}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif",
    background: "#F6F2E8",
    color: "#2A2A24",
    maxWidth: 640,
    margin: "0 auto",
    lineHeight: 1.5,
    minHeight: "100%",
  },
  header: { padding: "24px 16px 12px" },
  eyebrow: { fontSize: 13, color: "#8A5A34", fontWeight: 600, margin: "0 0 4px" },
  title: { fontFamily: "Georgia, 'Nanum Myeongjo', serif", fontSize: 22, color: "#1E3B2C", margin: 0 },

  tabBar: {
    display: "flex",
    overflowX: "auto",
    gap: 4,
    padding: "0 12px 10px",
    borderBottom: "1px solid #E7DFC9",
    position: "sticky",
    top: 0,
    background: "#F6F2E8",
    zIndex: 1,
  },
  tabBtn: {
    flexShrink: 0,
    padding: "8px 14px",
    fontSize: 13.5,
    fontWeight: 600,
    color: "#8b8368",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
  },
  tabBtnActive: { color: "#1E3B2C", borderBottom: "2px solid #1E3B2C" },

  main: { padding: "18px 16px 60px" },

  placeholder: {
    background: "#FFFDF7",
    border: "1px dashed #D8D0B8",
    borderRadius: 10,
    padding: "28px 18px",
    textAlign: "center",
  },
  placeholderLabel: { fontFamily: "Georgia, 'Nanum Myeongjo', serif", fontSize: 17, color: "#1E3B2C", margin: "0 0 8px" },
  placeholderDesc: { fontSize: 13, color: "#8b8368", margin: 0 },

  sub: { fontSize: 14, color: "#5c5747", margin: "0 0 12px" },
  avgBox: { display: "flex", alignItems: "center", gap: 8, marginBottom: 18 },
  avgText: { fontSize: 13, color: "#6f6a58" },

  form: {
    background: "#FFFDF7",
    border: "1px solid #E7DFC9",
    borderRadius: 10,
    padding: 18,
    marginBottom: 28,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  formTitle: { fontFamily: "Georgia, 'Nanum Myeongjo', serif", fontSize: 18, color: "#1E3B2C", margin: 0 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 600, color: "#3d3a2e" },
  input: { padding: "9px 10px", border: "1px solid #D8D0B8", borderRadius: 6, fontSize: 14, fontWeight: 400, background: "#FCFAF3" },
  fileInput: { fontSize: 13, fontWeight: 400 },
  textarea: { padding: "9px 10px", border: "1px solid #D8D0B8", borderRadius: 6, fontSize: 14, fontWeight: 400, background: "#FCFAF3", resize: "vertical", fontFamily: "inherit" },
  starRow: { display: "flex", gap: 2 },
  starBtn: { background: "none", border: "none", fontSize: 26, padding: 0, cursor: "pointer", lineHeight: 1 },
  starDisplay: { fontSize: 15, letterSpacing: 1, marginLeft: 8 },
  hintText: { fontSize: 12.5, color: "#8b8368", margin: 0 },
  previewWrap: { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" },
  previewImg: { width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 8, border: "1px solid #E7DFC9" },
  removePhotoBtn: { fontSize: 12.5, color: "#8A5A34", background: "none", border: "1px solid #D8D0B8", borderRadius: 6, padding: "5px 10px", cursor: "pointer" },
  imgErrorText: { fontSize: 12, color: "#a35d3a", margin: 0 },
  submitBtn: { marginTop: 4, padding: "12px 16px", background: "#1E3B2C", color: "#F6F2E8", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600 },
  errorText: { fontSize: 12.5, color: "#a35d3a", margin: 0 },

  list: { display: "flex", flexDirection: "column", gap: 14 },
  emptyText: { fontSize: 13.5, color: "#8b8368", textAlign: "center", padding: "20px 0" },
  card: { background: "#FFFDF7", border: "1px solid #E7DFC9", borderRadius: 10, padding: 16 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardName: { fontSize: 14.5, fontWeight: 700, marginRight: 8 },
  cardDate: { fontSize: 12, color: "#a99f88" },
  cardImg: { width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 8, marginBottom: 10 },
  cardText: { fontSize: 14, color: "#3d3a2e", margin: 0, whiteSpace: "pre-wrap" },
};
