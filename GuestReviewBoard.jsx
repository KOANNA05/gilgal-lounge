import { useState, useEffect, useRef } from "react";

// ────────────────────────────────────────────────────────────
// 길갈라운지 방문 후기 게시판
// 손님이 사진 파일을 직접 선택(또는 촬영)해서 올릴 수 있는 공개 게시판
//
// 저장 방식: 후기마다 별도 키(gilgal-review:<id>)에 저장하고,
// 목록 순서만 담은 인덱스(gilgal-review-index)를 따로 둠.
// 사진은 브라우저에서 리사이즈 후 base64로 변환해 함께 저장.
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

export default function GuestReviewBoard() {
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
          } catch (e) {
            // 개별 후기가 없어졌으면 건너뜀
          }
        }
        setReviews(loadedReviews);
      } catch (e) {
        // 첫 사용이면 인덱스가 없어 에러 — 정상 상황
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
      const saveRes = await window.storage.set(
        REVIEW_PREFIX + id,
        JSON.stringify(newReview),
        true
      );
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
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #a99f88; }
      `}</style>

      <header style={styles.header}>
        <p style={styles.eyebrow}>길갈라운지</p>
        <h1 style={styles.title}>머물다 가신 이야기</h1>
        <p style={styles.sub}>
          다녀가신 소감과 사진을 남겨주시면, 다음 손님들에게 큰 도움이 돼요.
        </p>
        {avg && (
          <div style={styles.avgBox}>
            <StarsDisplay value={Math.round(avg)} />
            <span style={styles.avgText}>
              평균 {avg}점 · 후기 {reviews.length}개
            </span>
          </div>
        )}
      </header>

      <form style={styles.form} onSubmit={handleSubmit}>
        <h2 style={styles.formTitle}>후기 남기기</h2>

        <label style={styles.label}>
          이름 (닉네임 가능)
          <input
            style={styles.input}
            type="text"
            value={name}
            maxLength={30}
            placeholder="예: 부안 여행자"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label style={styles.label}>
          별점
          <Stars value={rating} onChange={setRating} />
        </label>

        <label style={styles.label}>
          후기 내용
          <textarea
            style={styles.textarea}
            rows={4}
            maxLength={800}
            placeholder="숙소는 어떠셨나요? 편했던 점, 좋았던 순간을 자유롭게 남겨주세요."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        <label style={styles.label}>
          사진 (선택)
          <input
            ref={fileInputRef}
            style={styles.fileInput}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>
        {photoBusy && <p style={styles.hintText}>사진 준비 중…</p>}
        {photoErr && <p style={styles.imgErrorText}>{photoErr}</p>}
        {photoData && !photoBusy && (
          <div style={styles.previewWrap}>
            <img src={photoData} alt="첨부 사진 미리보기" style={styles.previewImg} />
            <button type="button" style={styles.removePhotoBtn} onClick={clearPhoto}>
              사진 제거
            </button>
          </div>
        )}

        <button
          type="submit"
          style={{
            ...styles.submitBtn,
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
          disabled={!canSubmit}
        >
          {submitting ? "등록 중…" : "후기 등록하기"}
        </button>
        {submitErr && <p style={styles.errorText}>{submitErr}</p>}
      </form>

      <section style={styles.list}>
        {!loaded ? (
          <p style={styles.emptyText}>불러오는 중…</p>
        ) : reviews.length === 0 ? (
          <p style={styles.emptyText}>
            아직 등록된 후기가 없어요. 첫 후기를 남겨주세요!
          </p>
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
              {r.photoData && (
                <img
                  src={r.photoData}
                  alt={`${r.name}님이 남긴 사진`}
                  style={styles.cardImg}
                />
              )}
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
    fontFamily:
      "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif",
    background: "#F6F2E8",
    color: "#2A2A24",
    maxWidth: 640,
    margin: "0 auto",
    padding: "28px 16px 60px",
    lineHeight: 1.5,
  },
  header: { marginBottom: 24 },
  eyebrow: { fontSize: 13, color: "#8A5A34", fontWeight: 600, margin: "0 0 6px" },
  title: {
    fontFamily: "Georgia, 'Nanum Myeongjo', serif",
    fontSize: 26,
    color: "#1E3B2C",
    margin: "0 0 10px",
  },
  sub: { fontSize: 14, color: "#5c5747", margin: "0 0 12px" },
  avgBox: { display: "flex", alignItems: "center", gap: 8 },
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
  formTitle: {
    fontFamily: "Georgia, 'Nanum Myeongjo', serif",
    fontSize: 18,
    color: "#1E3B2C",
    margin: 0,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13.5,
    fontWeight: 600,
    color: "#3d3a2e",
  },
  input: {
    padding: "9px 10px",
    border: "1px solid #D8D0B8",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 400,
    background: "#FCFAF3",
  },
  fileInput: { fontSize: 13, fontWeight: 400 },
  textarea: {
    padding: "9px 10px",
    border: "1px solid #D8D0B8",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 400,
    background: "#FCFAF3",
    resize: "vertical",
    fontFamily: "inherit",
  },
  starRow: { display: "flex", gap: 2 },
  starBtn: { background: "none", border: "none", fontSize: 26, padding: 0, cursor: "pointer", lineHeight: 1 },
  starDisplay: { fontSize: 15, letterSpacing: 1, marginLeft: 8 },
  hintText: { fontSize: 12.5, color: "#8b8368", margin: 0 },
  previewWrap: { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" },
  previewImg: {
    width: "100%",
    maxHeight: 240,
    objectFit: "cover",
    borderRadius: 8,
    border: "1px solid #E7DFC9",
  },
  removePhotoBtn: {
    fontSize: 12.5,
    color: "#8A5A34",
    background: "none",
    border: "1px solid #D8D0B8",
    borderRadius: 6,
    padding: "5px 10px",
    cursor: "pointer",
  },
  imgErrorText: { fontSize: 12, color: "#a35d3a", margin: 0 },
  submitBtn: {
    marginTop: 4,
    padding: "12px 16px",
    background: "#1E3B2C",
    color: "#F6F2E8",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
  },
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
