import React, { useState, useEffect, useMemo } from "react";
import { auth } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import {
  Sun, Moon, BookOpen, Plus, ArrowLeft, Trash2, Layers, Flame, ChevronRight,
  Loader2, Clock, PenLine, ListChecks, Shuffle, Eye, EyeOff,
} from "lucide-react";

/* ---------------- Polyfill para almacenamiento local ---------------- */
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    get: async (key) => {
      const val = localStorage.getItem(key);
      return val !== null ? { value: val } : null;
    },
    set: async (key, val) => {
      localStorage.setItem(key, val);
    },
    delete: async (key) => {
      localStorage.removeItem(key);
    }
  };
}

/* ---------------- Almacenamiento persistente ---------------- */
const LIB_KEY = "library";
const THEME_KEY = "theme_preference";
const textKey = (id) => `text:${id}`;
const progressKey = (id) => `progress:${id}`;
const STATS_KEY = "stats";

async function safeGet(key) {
  try {
    const r = await window.storage.get(key, false);
    return r ? r.value : null;
  } catch { return null; }
}
async function safeSet(key, value) {
  try { await window.storage.set(key, value, false); } catch (e) { console.error("Error guardando", key, e); }
}
async function safeDelete(key) {
  try { await window.storage.delete(key, false); } catch {}
}

async function loadLibrary() {
  const raw = await safeGet(LIB_KEY);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
async function saveLibrary(lib) { await safeSet(LIB_KEY, JSON.stringify(lib)); }
async function loadTextData(id) {
  const raw = await safeGet(textKey(id));
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
async function saveTextData(id, data) { await safeSet(textKey(id), JSON.stringify(data)); }
async function loadProgress(id) {
  const raw = await safeGet(progressKey(id));
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
async function saveProgress(id, data) { await safeSet(progressKey(id), JSON.stringify(data)); }
async function deleteTextEverywhere(id) {
  await safeDelete(textKey(id));
  await safeDelete(progressKey(id));
}
async function loadStats() {
  const raw = await safeGet(STATS_KEY);
  try { return raw ? JSON.parse(raw) : { streak: 0, lastActiveDate: null, totalReviews: 0 }; } catch {
    return { streak: 0, lastActiveDate: null, totalReviews: 0 };
  }
}
async function saveStats(s) { await safeSet(STATS_KEY, JSON.stringify(s)); }

/* ---------------- Fragmentación de Texto ---------------- */
function chunkText(raw) {
  const text = raw.trim().replace(/\r\n/g, "\n");
  const MAX = 320;
  if (text.length <= MAX + 80) return [text];

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];

  const splitParagraph = (para) => {
    if (para.length <= MAX) {
      chunks.push(para);
      return;
    }
    const sentences = para.match(/[^.!?]+[.!?]+[”"')\]]*\s*|[^.!?]+$/g) || [para];
    let current = "";
    sentences.forEach((s) => {
      if (current && (current + s).length > MAX) {
        chunks.push(current.trim());
        current = s;
      } else {
        current += s;
      }
    });
    if (current.trim()) chunks.push(current.trim());
  };

  paragraphs.forEach(splitParagraph);
  return chunks.length ? chunks : [text];
}

/* ---------------- Algoritmo SRS ---------------- */
function nextSRS(prev, quality) {
  let reps = prev?.reps || 0;
  let ease = prev?.ease || 2.5;
  let interval = prev?.interval || 0;

  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ease);
    reps += 1;
    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease < 1.3) ease = 1.3;
  }

  const now = new Date();
  const next = new Date(now.getTime() + interval * 86400000);
  return { reps, ease: Number(ease.toFixed(2)), interval, lastReview: now.toISOString(), nextReview: next.toISOString() };
}

function stageFromReps(reps = 0) {
  if (reps <= 0) return 0;
  if (reps === 1) return 1;
  if (reps === 2) return 2;
  if (reps <= 4) return 3;
  return 4;
}
const STAGE_LABELS = ["Nuevo", "Aprendiendo", "Familiar", "Consolidado", "Dominado"];

function isDue(state) {
  if (!state) return true;
  return new Date(state.nextReview) <= new Date();
}

function qualityFromAccuracy(acc) {
  if (acc >= 0.95) return 5;
  if (acc >= 0.85) return 4;
  if (acc >= 0.65) return 3;
  if (acc >= 0.4) return 2;
  if (acc > 0) return 1;
  return 0;
}

function formatRelative(iso) {
  if (!iso) return "Nuevo";
  const d = new Date(iso);
  const diffMs = d - new Date();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffMs <= 0) return "Disponible ahora";
  if (diffDays <= 1) return "Mañana";
  if (diffDays < 7) return `En ${diffDays} días`;
  if (diffDays < 30) return `En ${Math.round(diffDays / 7)} sem.`;
  return `En ${Math.round(diffDays / 30)} meses`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* ---------------- Utilidades de texto ---------------- */
function normalizeWord(w) {
  return (w || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function firstLetterHint(text) {
  return text.replace(/[\wÀ-ÿ]+/g, (w) => (w.length <= 1 ? w : w[0] + "_".repeat(w.length - 1)));
}
function blankText(text) {
  return text.replace(/[\wÀ-ÿ]+/g, (w) => "_".repeat(w.length));
}

function buildCloze(text, ratio = 0.3) {
  const tokens = text.match(/[\wÀ-ÿ'’-]+|[^\wÀ-ÿ'’-]+/g) || [text];
  const wordIdx = [];
  tokens.forEach((t, i) => { if (/[\wÀ-ÿ]/.test(t)) wordIdx.push(i); });
  const count = Math.max(1, Math.round(wordIdx.length * ratio));
  const chosen = new Set();
  const pool = [...wordIdx];
  while (chosen.size < count && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    chosen.add(pool.splice(idx, 1)[0]);
  }
  return { tokens, blanks: chosen };
}

function lcsDiff(origWords, typedWords) {
  const n = origWords.length;
  const m = typedWords.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (normalizeWord(origWords[i]) === normalizeWord(typedWords[j]) && normalizeWord(origWords[i])) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  let i = 0, j = 0;
  const result = [];
  while (i < n && j < m) {
    if (normalizeWord(origWords[i]) === normalizeWord(typedWords[j]) && normalizeWord(origWords[i])) {
      result.push({ expected: origWords[i], typed: typedWords[j], status: "correct" });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ expected: origWords[i], typed: null, status: "missing" });
      i++;
    } else {
      result.push({ expected: null, typed: typedWords[j], status: "extra" });
      j++;
    }
  }
  while (i < n) { result.push({ expected: origWords[i], typed: null, status: "missing" }); i++; }
  while (j < m) { result.push({ expected: null, typed: typedWords[j], status: "extra" }); j++; }

  const correct = result.filter((r) => r.status === "correct").length;
  const accuracy = n ? correct / n : 1;
  return { result, correct, total: n, accuracy };
}

function reorderTokens(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 18) return words;
  const groupSize = Math.ceil(words.length / 14);
  const groups = [];
  for (let i = 0; i < words.length; i += groupSize) {
    groups.push(words.slice(i, i + groupSize).join(" "));
  }
  return groups;
}

function textStageInfo(item, progress) {
  let dueCount = 0;
  let stageSum = 0;
  for (let i = 0; i < item.chunkCount; i++) {
    const cid = `${item.id}_${i}`;
    const st = progress[cid];
    stageSum += stageFromReps(st?.reps || 0);
    if (isDue(st)) dueCount++;
  }
  const avgStage = item.chunkCount ? Math.round(stageSum / item.chunkCount) : 0;
  return { avgStage, dueCount };
}

/* ============================================================
   COMPONENTES
   ============================================================ */

function ThemeSelector({ currentTheme, onChangeTheme }) {
  return (
    <div className="theme-selector">
      <button className={`theme-btn ${currentTheme === "dark" ? "active" : ""}`} onClick={() => onChangeTheme("dark")} title="Oscuro">
        <Moon size={15} />
      </button>
      <button className={`theme-btn ${currentTheme === "light" ? "active" : ""}`} onClick={() => onChangeTheme("light")} title="Claro">
        <Sun size={15} />
      </button>
      <button className={`theme-btn ${currentTheme === "medieval" ? "active" : ""}`} onClick={() => onChangeTheme("medieval")} title="Medieval">
        <BookOpen size={15} />
      </button>
      <button className="icon-btn" onClick={() => signOut(auth)} title="Cerrar sesión">
  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Salir</span>
</button>
    </div>
  );
}

function SunArc({ stage = 0, size = 56 }) {
  const w = size, h = size * 0.68;
  const cx = w / 2, cy = h - 2;
  const r = w / 2 - 6;
  const angleDeg = 180 - stage * 22.5;
  const rad = (angleDeg * Math.PI) / 180;
  const sx = cx + r * Math.cos(rad);
  const sy = cy - r * Math.sin(rad);
  const colors = ["#5B6394", "#F2965E", "#F6B15A", "#FBC857", "#FFD873"];
  const sunColor = colors[stage] || colors[0];
  const sunR = 4 + stage * 1.5;
  return (
    <svg width={w} height={h + 4} viewBox={`0 0 ${w} ${h + 4}`} className="sun-arc">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} className="sun-arc-guide" fill="none" />
      <line x1={cx - r - 3} y1={cy} x2={cx + r + 3} y2={cy} className="sun-arc-horizon" />
      {stage >= 4 && <circle cx={sx} cy={sy} r={sunR + 6} className="sun-arc-glow" fill={sunColor} opacity="0.35" />}
      <circle cx={sx} cy={sy} r={sunR} fill={sunColor} />
    </svg>
  );
}

function TopNav({ title, onBack, right }) {
  return (
    <div className="top-nav">
      <button className="icon-btn" onClick={onBack} aria-label="Volver"><ArrowLeft size={18} /></button>
      <h2>{title}</h2>
      <div className="top-nav-right">{right}</div>
    </div>
  );
}

/* ============================================================
   PANTALLAS
   ============================================================ */

function Dashboard({ library, progressMap, stats, onOpen, onAddNew, onStartSession, onRequestDelete, theme, onChangeTheme }) {
  const totalDue = library.reduce(
    (s, item) => s + textStageInfo(item, progressMap[item.id] || {}).dueCount, 0
  );
  return (
    <div className="screen dashboard">
      <header className="app-header">
        <div className="brand">
          <img src="/solmedieval1.png" alt="Sol" className="brand-icon-img" onError={(e) => { e.target.style.display = 'none'; }} />
          <div>
            <h1>Memorizador Solar</h1>
            <p className="tagline">Aprende de memoria, un ciclo a la vez</p>
          </div>
        </div>
        <div className="header-right">
          <ThemeSelector currentTheme={theme} onChangeTheme={onChangeTheme} />
          {stats.streak > 0 && <div className="streak-badge"><Flame size={15} /> {stats.streak}</div>}
        </div>
      </header>

      <section className="today-panel">
        <div className="today-info">
          <h2>Hoy</h2>
          {totalDue > 0 ? (
            <p>{totalDue} {totalDue === 1 ? "fragmento listo" : "fragmentos listos"} para repasar</p>
          ) : (
            <p>Todo al día. Vuelve más tarde o añade un texto nuevo.</p>
          )}
        </div>
        {totalDue > 0 && (
          <button className="btn btn-primary btn-lg" onClick={onStartSession}>
            Comenzar repaso <ChevronRight size={18} />
          </button>
        )}
      </section>

      <section className="library-section">
        <div className="section-heading">
          <h2>Tu biblioteca</h2>
          <button className="btn btn-primary" onClick={onAddNew}><Plus size={16} /> Nuevo texto</button>
        </div>

        {library.length === 0 ? (
          <div className="empty-state">
            <Sun size={38} />
            <p>Aún no has añadido ningún texto.</p>
            <button className="btn btn-primary" onClick={onAddNew}><Plus size={16} /> Añadir el primero</button>
          </div>
        ) : (
          <div className="library-grid">
            {library.map((item) => {
              const { avgStage, dueCount } = textStageInfo(item, progressMap[item.id] || {});
              return (
                <div key={item.id} className="text-card" onClick={() => onOpen(item.id)}>
                  <button className="icon-btn delete-btn" onClick={(e) => { e.stopPropagation(); onRequestDelete(item.id); }}>
                    <Trash2 size={14} />
                  </button>
                  <div className="text-card-top">
                    <SunArc stage={avgStage} size={48} />
                    {dueCount > 0 && <span className="due-pill">{dueCount}</span>}
                  </div>
                  <h3>{item.title}</h3>
                  <div className="text-card-meta">
                    <span><Layers size={13} /> {item.chunkCount} {item.chunkCount === 1 ? "parte" : "partes"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function AddTextScreen({ onCancel, onSave }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const preview = useMemo(() => (body.trim() ? chunkText(body) : []), [body]);

  return (
    <div className="screen add-screen">
      <TopNav title="Nuevo texto" onBack={onCancel} />
      <div className="form-panel">
        <label className="field-label" htmlFor="title-input">Título</label>
        <input id="title-input" className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Soneto XVII, Neruda" />

        <label className="field-label" htmlFor="body-input">Texto a memorizar</label>
        <textarea id="body-input" className="text-area-lg" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Pega o escribe aquí el texto..." rows={10} />

        {body.trim() && (
          <div className="chunk-preview"><Layers size={14} /> Se dividirá en {preview.length} {preview.length === 1 ? "parte" : "partes"}</div>
        )}

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" disabled={!body.trim()} onClick={() => onSave(title, body)}>Guardar texto</button>
        </div>
      </div>
    </div>
  );
}

function TextDetailScreen({ text, progress, onBack, onStudy, onExam, onRequestDelete }) {
  if (!text) return <div className="screen"><div className="loading-inline"><Loader2 className="spin" size={22} /></div></div>;

  return (
    <div className="screen detail-screen">
      <TopNav title={text.title} onBack={onBack} right={<button className="icon-btn" onClick={() => onRequestDelete(text.id)}><Trash2 size={16} /></button>} />
      <p className="detail-sub">{text.chunks.length} {text.chunks.length === 1 ? "parte" : "partes"} · {text.fullText.length} caracteres</p>

      <div className="chunk-list">
        {text.chunks.map((chunk, i) => {
          const st = progress[chunk.id];
          const stage = stageFromReps(st?.reps || 0);
          const due = isDue(st);
          return (
            <div key={chunk.id} className="chunk-card">
              <SunArc stage={stage} size={40} />
              <div className="chunk-info">
                <p className="chunk-preview-text">{chunk.text.slice(0, 90)}{chunk.text.length > 90 ? "…" : ""}</p>
                <div className="chunk-meta">
                  <span className="chunk-stage-label">{STAGE_LABELS[stage]}</span>
                  <span className={`chunk-due ${due ? "is-due" : ""}`}><Clock size={12} /> {due ? "Disponible ahora" : formatRelative(st.nextReview)}</span>
                </div>
              </div>
              <div className="chunk-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onStudy(i)}>Estudiar</button>
                <button className="btn btn-primary btn-sm" onClick={() => onExam(i)}>Examinar</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   ESTUDIO Y EXAMEN
   ============================================================ */

function StudyFlow({ chunk, onDone }) {
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const hinted = useMemo(() => firstLetterHint(chunk.text), [chunk.text]);
  const blanked = useMemo(() => blankText(chunk.text), [chunk.text]);

  return (
    <div className="study-panel">
      <div className="step-dots">
        {[0, 1, 2, 3].map((s) => <span key={s} className={`step-dot ${s <= step ? "is-active" : ""}`} />)}
      </div>

      {step === 0 && (
        <>
          <div className="study-step-label">Paso 1 · Lectura completa</div>
          <div className="study-text">{chunk.text}</div>
          <button className="btn btn-primary" onClick={() => setStep(1)}>Siguiente <ChevronRight size={16} /></button>
        </>
      )}
      {step === 1 && (
        <>
          <div className="study-step-label">Paso 2 · Con pistas iniciales</div>
          <div className="study-text hint-text">{hinted}</div>
          <button className="btn btn-primary" onClick={() => setStep(2)}>Siguiente <ChevronRight size={16} /></button>
        </>
      )}
      {step === 2 && (
        <>
          <div className="study-step-label">Paso 3 · Sin pistas</div>
          <div className="study-text blank-text">{revealed ? chunk.text : blanked}</div>
          <div className="mode-actions">
            <button className="btn btn-ghost" onClick={() => setRevealed((r) => !r)}>
              {revealed ? <><EyeOff size={16} /> Ocultar</> : <><Eye size={16} /> Revelar</>}
            </button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Continuar <ChevronRight size={16} /></button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <div className="study-step-label">¿Qué tan bien lo recordaste?</div>
          <div className="rate-buttons">
            <button className="btn rate-btn rate-again" onClick={() => onDone(1)}>Otra vez</button>
            <button className="btn rate-btn rate-hard" onClick={() => onDone(3)}>Difícil</button>
            <button className="btn rate-btn rate-good" onClick={() => onDone(4)}>Bien</button>
            <button className="btn rate-btn rate-easy" onClick={() => onDone(5)}>Fácil</button>
          </div>
        </>
      )}
    </div>
  );
}

function ClozeMode({ text, onComplete }) {
  const { tokens, blanks } = useMemo(() => buildCloze(text, 0.3), [text]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = () => {
    let correct = 0;
    blanks.forEach((i) => {
      if (normalizeWord(answers[i]) === normalizeWord(tokens[i]) && normalizeWord(tokens[i])) correct++;
    });
    const total = blanks.size;
    const accuracy = total ? correct / total : 1;
    setResult({ correct, total, accuracy });
    setSubmitted(true);
  };

  return (
    <div className="mode-panel">
      <div className="mode-label"><ListChecks size={16} /> Completa los espacios</div>
      <div className="cloze-text">
        {tokens.map((t, i) => {
          if (blanks.has(i)) {
            const correct = submitted && normalizeWord(answers[i]) === normalizeWord(t);
            return (
              <input
                key={i}
                className={`cloze-input ${submitted ? (correct ? "is-correct" : "is-wrong") : ""}`}
                style={{ width: Math.max(3, t.length + 1) + "ch" }}
                value={answers[i] || ""}
                disabled={submitted}
                autoComplete="off"
                spellCheck="false"
                onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
              />
            );
          }
          return <span key={i}>{t}</span>;
        })}
      </div>
      {!submitted ? (
        <button className="btn btn-primary" onClick={handleSubmit}>Comprobar</button>
      ) : (
        <div className="mode-result">
          <p>{result.correct} de {result.total} correctas ({Math.round(result.accuracy * 100)}%)</p>
          <button className="btn btn-primary" onClick={() => onComplete(qualityFromAccuracy(result.accuracy), result.accuracy)}>Continuar</button>
        </div>
      )}
    </div>
  );
}

function TypingMode({ text, onComplete }) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [diff, setDiff] = useState(null);

  const handleSubmit = () => {
    const origWords = text.match(/[\wÀ-ÿ'’-]+/gi) || [];
    const typedWords = value.match(/[\wÀ-ÿ'’-]+/gi) || [];
    setDiff(lcsDiff(origWords, typedWords));
    setSubmitted(true);
  };

  return (
    <div className="mode-panel">
      <div className="mode-label"><PenLine size={16} /> Escribe de memoria</div>
      {!submitted ? (
        <>
          <textarea className="typing-area" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Escribe aquí..." rows={6} autoFocus />
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!value.trim()}>Comprobar</button>
        </>
      ) : (
        <div className="mode-result">
          <div className="diff-text">
            {diff.result.map((r, i) => {
              if (r.status === "correct") return <span key={i} className="diff-correct">{r.expected} </span>;
              if (r.status === "missing") return <span key={i} className="diff-missing">{r.expected} </span>;
              return <span key={i} className="diff-extra">{r.typed} </span>;
            })}
          </div>
          <p>{diff.correct} de {diff.total} palabras ({Math.round(diff.accuracy * 100)}%)</p>
          <button className="btn btn-primary" onClick={() => onComplete(qualityFromAccuracy(diff.accuracy), diff.accuracy)}>Continuar</button>
        </div>
      )}
    </div>
  );
}

function ReorderMode({ text, onComplete }) {
  const original = useMemo(() => reorderTokens(text), [text]);
  const [bank, setBank] = useState(() => shuffle(original));
  const [answer, setAnswer] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  const pick = (idx) => {
    if (submitted) return;
    setAnswer((a) => [...a, bank[idx]]);
    setBank((b) => b.filter((_, i) => i !== idx));
  };
  const undo = () => {
    if (submitted || !answer.length) return;
    const w = answer[answer.length - 1];
    setAnswer((a) => a.slice(0, -1));
    setBank((b) => [...b, w]);
  };
  const handleSubmit = () => {
    let correct = 0;
    original.forEach((w, i) => { if (normalizeWord(answer[i]) === normalizeWord(w)) correct++; });
    const total = original.length;
    const accuracy = total ? correct / total : 1;
    setResult({ correct, total, accuracy });
    setSubmitted(true);
  };

  return (
    <div className="mode-panel">
      <div className="mode-label"><Shuffle size={16} /> Ordena el texto</div>
      <div className="reorder-answer">
        {answer.length === 0 && <span className="placeholder">Toca las palabras en orden...</span>}
        {answer.map((w, i) => {
          const correct = submitted && normalizeWord(w) === normalizeWord(original[i] || "");
          return <span key={i} className={`chip chip-answer ${submitted ? (correct ? "is-correct" : "is-wrong") : ""}`}>{w}</span>;
        })}
      </div>
      {!submitted && (
        <div className="reorder-bank">
          {bank.map((w, i) => <button key={i} className="chip chip-bank" onClick={() => pick(i)}>{w}</button>)}
        </div>
      )}
      {!submitted ? (
        <div className="mode-actions">
          <button className="btn btn-ghost" onClick={undo} disabled={!answer.length}>Deshacer</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={bank.length > 0}>Comprobar</button>
        </div>
      ) : (
        <div className="mode-result">
          <p>{result.correct} de {result.total} en orden ({Math.round(result.accuracy * 100)}%)</p>
          <button className="btn btn-primary" onClick={() => onComplete(qualityFromAccuracy(result.accuracy), result.accuracy)}>Continuar</button>
        </div>
      )}
    </div>
  );
}

const EXAM_MODES = ["cloze", "typing", "reorder"];
function ExamBody({ text, onDone }) {
  const mode = useMemo(() => EXAM_MODES[Math.floor(Math.random() * EXAM_MODES.length)], [text]);
  if (mode === "cloze") return <ClozeMode text={text} onComplete={onDone} />;
  if (mode === "typing") return <TypingMode text={text} onComplete={onDone} />;
  return <ReorderMode text={text} onComplete={onDone} />;
}

/* ============================================================
   APP PRINCIPAL
   ============================================================ */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [library, setLibrary] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [stats, setStats] = useState({ streak: 0, lastActiveDate: null, totalReviews: 0 });
  const [theme, setTheme] = useState("dark");

  const [screen, setScreen] = useState("dashboard");
  const [activeTextId, setActiveTextId] = useState(null);
  const [activeText, setActiveText] = useState(null);
  const [studyTarget, setStudyTarget] = useState(null);
  const [examTarget, setExamTarget] = useState(null);

  const [queueList, setQueueList] = useState(null);
  const [queuePos, setQueuePos] = useState(0);
  const [sessionCache, setSessionCache] = useState({});
  const [sessionResults, setSessionResults] = useState([]);

  const [toast, setToast] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // --- ESTADOS DE AUTENTICACIÓN ---
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authError, setAuthError] = useState('');

  // Escuchar si hay una sesión activa al cargar la app
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Función para procesar el formulario de ingreso/registro
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (error) {
      setAuthError("Error: Revisa tus datos o la longitud de tu contraseña (mín. 6 caracteres).");
    }
  };

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const savedTheme = await safeGet(THEME_KEY);
    if (savedTheme) setTheme(savedTheme);

    const lib = await loadLibrary();
    setLibrary(lib);
    const pm = {};
    await Promise.all(lib.map(async (item) => { pm[item.id] = await loadProgress(item.id); }));
    setProgressMap(pm);
    setStats(await loadStats());
    setLoading(false);
  }

  function handleThemeChange(newTheme) {
    setTheme(newTheme);
    safeSet(THEME_KEY, newTheme);
  }

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function bumpStreak() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const y = yesterdayStr();
    setStats((prev) => {
      let streak;
      if (prev.lastActiveDate === todayStr) streak = prev.streak || 1;
      else if (prev.lastActiveDate === y) streak = (prev.streak || 0) + 1;
      else streak = 1;
      const ns = { streak, lastActiveDate: todayStr, totalReviews: (prev.totalReviews || 0) + 1 };
      saveStats(ns);
      return ns;
    });
  }

  async function recordResult(textId, chunkId, quality) {
    setProgressMap((pm) => {
      const current = pm[textId] || {};
      const updated = { ...current, [chunkId]: nextSRS(current[chunkId], quality) };
      saveProgress(textId, updated);
      return { ...pm, [textId]: updated };
    });
    await bumpStreak();
  }

  async function handleAddText(title, fullText) {
    const id = "txt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const parts = chunkText(fullText);
    const chunks = parts.map((t, i) => ({ id: `${id}_${i}`, index: i, text: t }));
    const data = { id, title: title.trim() || "Sin título", fullText: fullText.trim(), chunks, createdAt: new Date().toISOString() };
    await saveTextData(id, data);
    const entry = { id, title: data.title, createdAt: data.createdAt, chunkCount: chunks.length, charCount: data.fullText.length };
    const newLib = [entry, ...library];
    setLibrary(newLib);
    await saveLibrary(newLib);
    setProgressMap((pm) => ({ ...pm, [id]: {} }));
    await saveProgress(id, {});
    notify("Texto guardado");
    setScreen("dashboard");
  }

  async function openText(id) {
    setActiveTextId(id);
    setActiveText(null);
    setScreen("detail");
    setActiveText(await loadTextData(id));
  }

  async function handleDelete(id) {
    await deleteTextEverywhere(id);
    const newLib = library.filter((l) => l.id !== id);
    setLibrary(newLib);
    await saveLibrary(newLib);
    setProgressMap((pm) => { const c = { ...pm }; delete c[id]; return c; });
    setConfirmDeleteId(null);
    if (activeTextId === id) {
      setScreen("dashboard");
      setActiveTextId(null);
      setActiveText(null);
    }
    notify("Texto eliminado");
  }

  async function startReviewSession() {
    const dueItems = [];
    for (const item of library) {
      const prog = progressMap[item.id] || {};
      for (let i = 0; i < item.chunkCount; i++) {
        const cid = `${item.id}_${i}`;
        if (isDue(prog[cid])) dueItems.push({ textId: item.id, chunkIndex: i, chunkId: cid });
      }
    }
    if (!dueItems.length) { notify("No hay repasos pendientes"); return; }
    const shuffled = shuffle(dueItems);
    const neededIds = [...new Set(shuffled.map((d) => d.textId))];
    const cache = {};
    await Promise.all(neededIds.map(async (id) => { cache[id] = await loadTextData(id); }));
    setSessionCache(cache);
    setQueueList(shuffled);
    setQueuePos(0);
    setSessionResults([]);
    setScreen("session");
  }

// --- PANTALLA DE LOGIN ---
  if (!user) {
    return (
      <div className={`app-root theme-${theme}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-card" style={{ maxWidth: '400px', width: '100%', padding: '30px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
            {isLoginView ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          
          {authError && <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '15px' }}>{authError}</p>}
          
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="email" 
              placeholder="Tu correo" 
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc', background: 'var(--bg)', color: 'var(--text-primary)' }}
            />
            <input 
              type="password" 
              placeholder="Contraseña" 
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc', background: 'var(--bg)', color: 'var(--text-primary)' }}
            />
            <button type="submit" className="primary-btn" style={{ padding: '12px', marginTop: '10px' }}>
              {isLoginView ? 'Entrar al Memorizador' : 'Registrarme'}
            </button>
          </form>
          
          <button 
            onClick={() => setIsLoginView(!isLoginView)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '100%', marginTop: '20px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLoginView ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-root theme-${theme}`}>
      <style>{CSS}</style>
      {toast && <div className="toast">{toast}</div>}

      {loading ? (
        <div className="loading-screen">
          <Loader2 className="spin" size={28} />
          <p>Cargando datos...</p>
        </div>
      ) : (
        <>
          {screen === "dashboard" && (
            <Dashboard
              library={library}
              progressMap={progressMap}
              stats={stats}
              onOpen={openText}
              onAddNew={() => setScreen("add")}
              onStartSession={startReviewSession}
              onRequestDelete={setConfirmDeleteId}
              theme={theme}
              onChangeTheme={handleThemeChange}
            />
          )}

          {screen === "add" && <AddTextScreen onCancel={() => setScreen("dashboard")} onSave={handleAddText} />}

          {screen === "detail" && (
            <TextDetailScreen
              text={activeText}
              progress={progressMap[activeTextId] || {}}
              onBack={() => { setScreen("dashboard"); setActiveTextId(null); setActiveText(null); }}
              onStudy={(idx) => { setStudyTarget({ chunkIndex: idx }); setScreen("study"); }}
              onExam={(idx) => { setExamTarget({ chunkIndex: idx }); setScreen("exam"); }}
              onRequestDelete={setConfirmDeleteId}
            />
          )}

          {screen === "study" && activeText && studyTarget && (
            <div className="screen study-screen">
              <TopNav title={`Estudiar · parte ${studyTarget.chunkIndex + 1} de ${activeText.chunks.length}`} onBack={() => setScreen("detail")} />
              <StudyFlow
                chunk={activeText.chunks[studyTarget.chunkIndex]}
                onDone={(q) => {
                  recordResult(activeText.id, activeText.chunks[studyTarget.chunkIndex].id, q);
                  notify("Progreso guardado");
                  setScreen("detail");
                }}
              />
            </div>
          )}

          {screen === "exam" && activeText && examTarget && (
            <div className="screen exam-screen">
              <TopNav title={`Examinar · parte ${examTarget.chunkIndex + 1} de ${activeText.chunks.length}`} onBack={() => setScreen("detail")} />
              <ExamBody
                text={activeText.chunks[examTarget.chunkIndex].text}
                onDone={(q) => {
                  recordResult(activeText.id, activeText.chunks[examTarget.chunkIndex].id, q);
                  setScreen("detail");
                }}
              />
            </div>
          )}

          {screen === "session" && queueList && sessionCache[queueList[queuePos]?.textId] && (
            <div className="screen exam-screen">
              <TopNav title={`Repaso · ${queuePos + 1} de ${queueList.length}`} onBack={() => setScreen("dashboard")} />
              <p className="session-source">{sessionCache[queueList[queuePos].textId].title}</p>
              <ExamBody
                text={sessionCache[queueList[queuePos].textId].chunks[queueList[queuePos].chunkIndex].text}
                onDone={async (q, acc) => {
                  const item = queueList[queuePos];
                  setSessionResults((r) => [...r, { quality: q, accuracy: acc ?? 1 }]);
                  await recordResult(item.textId, item.chunkId, q);
                  if (queuePos + 1 < queueList.length) setQueuePos((p) => p + 1);
                  else setScreen("session-summary");
                }}
              />
            </div>
          )}

          {screen === "session-summary" && (
            <div className="screen summary-screen">
              <SunArc stage={4} size={96} />
              <h2>Repaso completado</h2>
              <p>{sessionResults.length} {sessionResults.length === 1 ? "fragmento repasado" : "fragmentos repasados"}</p>
              <p className="summary-accuracy">
                {Math.round((sessionResults.reduce((s, r) => s + r.accuracy, 0) / (sessionResults.length || 1)) * 100)}% de precisión media
              </p>
              <button className="btn btn-primary btn-lg" onClick={() => setScreen("dashboard")}>Volver al inicio</button>
            </div>
          )}
        </>
      )}

      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p>¿Eliminar este texto y su progreso?</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDeleteId)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ESTILOS CSS CON CORRECCIÓN DE CONTRASTE ESTRICTA
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=MedievalSharp&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@font-face {
  font-family: 'CloisterBlack';
  src: url('/CloisterBlack.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

/* --- TEMA OSCURO --- */
.app-root.theme-dark {
  --bg: #0F1428;
  --bg-panel: #171F3D;
  --bg-panel-hover: #1D2646;
  --bg-elevated: #232C52;
  --border: #2A3460;
  --border-soft: #212A4D;
  --sun-core: #FFC857;
  --sun-dawn: #F2965E;
  --coral: #F2765C;
  --text-primary: #F7F3E8;
  --text-secondary: #A9B0D4;
  --text-tertiary: #6B7299;
  --btn-primary-bg: #FFC857;
  --btn-primary-text: #0F1428;
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Sora', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  background: radial-gradient(ellipse 120% 80% at 50% -10%, #1a2348 0%, var(--bg) 55%);
}

/* --- TEMA CLARO --- */
.app-root.theme-light {
  --bg: #F4F6FB;
  --bg-panel: #FFFFFF;
  --bg-panel-hover: #EBF0FA;
  --bg-elevated: #E2E8F5;
  --border: #A3AED0;
  --border-soft: #CBD2E6;
  --sun-core: #D97706;
  --sun-dawn: #EA580C;
  --coral: #DC2626;
  --text-primary: #0F172A !important;
  --text-secondary: #334155 !important;
  --text-tertiary: #64748B !important;
  --btn-primary-bg: #D97706;
  --btn-primary-text: #FFFFFF;
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Sora', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  background: #F4F6FB;
}

/* --- TEMA MEDIEVAL CON CLOISTER BLACK --- */
.app-root.theme-medieval {
  --bg: #EFE5CE;
  --bg-panel: #E3D3B0;
  --bg-panel-hover: #D7C39A;
  --bg-elevated: #CDB687;
  --border: #5C3D1E;
  --border-soft: #8C6239;
  --sun-core: #5C1D06;
  --sun-dawn: #8B3A0F;
  --coral: #7A0000;
  --text-primary: #1A0D00 !important;
  --text-secondary: #3B1E05 !important;
  --text-tertiary: #5C3D1E !important;
  --btn-primary-bg: #5C1D06;
  --btn-primary-text: #FDF8ED;
  --font-display: 'CloisterBlack', 'MedievalSharp', serif;
  --font-body: 'MedievalSharp', Georgia, serif;
  --font-mono: 'MedievalSharp', Georgia, serif;
  background: #EFE5CE;
  background-image: radial-gradient(#5C3D1E 0.4px, transparent 0.4px), radial-gradient(#5C3D1E 0.4px, #EFE5CE 0.4px);
  background-size: 16px 16px;
}

/* --- FORZADO DE COLOR OSCURO EN TÍTULOS PARA TEMAS CLAROS --- */

.app-root.theme-medieval h1,
.app-root.theme-medieval h2,
.app-root.theme-medieval h3,
.app-root.theme-medieval h4,
.app-root.theme-medieval .brand h1,
.app-root.theme-medieval .today-info h2,
.app-root.theme-medieval .section-heading h2,
.app-root.theme-medieval .text-card h3 {
  color: #1A0D00 !important;
}

.app-root.theme-light h1,
.app-root.theme-light h2,
.app-root.theme-light h3,
.app-root.theme-light h4,
.app-root.theme-light .brand h1,
.app-root.theme-light .today-info h2,
.app-root.theme-light .section-heading h2,
.app-root.theme-light .text-card h3 {
  color: #0F172A !important;
}

.brand-icon-img { width: 38px; height: 38px; object-fit: contain; }

.screen { max-width: 720px; margin: 0 auto; animation: fadeIn 0.35s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.loading-screen, .loading-inline {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 80px 0; color: var(--text-secondary);
}
.spin { animation: spin 1s linear infinite; color: var(--sun-core); }
@keyframes spin { to { transform: rotate(360deg); } }

.toast {
  position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text-primary); padding: 10px 18px; border-radius: 999px;
  font-size: 13.5px; z-index: 50; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}

.header-right { display: flex; align-items: center; gap: 10px; }
.theme-selector {
  display: flex; background: var(--bg-panel); border: 1px solid var(--border);
  border-radius: 999px; padding: 3px; gap: 2px;
}
.theme-btn {
  background: transparent; border: none; color: var(--text-secondary);
  padding: 5px 8px; border-radius: 999px; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
}
.theme-btn:hover { color: var(--text-primary); }
.theme-btn.active { background: var(--bg-elevated); color: var(--sun-core); }

.app-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 26px; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand h1 { font-family: var(--font-display); font-size: 32px; font-weight: 600; margin: 0; color: var(--text-primary) !important; }
.tagline { margin: 2px 0 0; color: var(--text-secondary); font-size: 13px; }
.streak-badge {
  display: flex; align-items: center; gap: 5px; background: var(--bg-panel);
  border: 1px solid var(--border); padding: 6px 12px; border-radius: 999px;
  font-family: var(--font-mono); font-size: 13px; color: var(--sun-dawn);
}

.today-panel {
  background: var(--bg-panel); border: 1px solid var(--border); border-radius: 20px; padding: 22px 24px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 34px; flex-wrap: wrap;
}
.today-info h2 { font-family: var(--font-display); font-size: 26px; margin: 0 0 4px; color: var(--text-primary) !important; }
.today-info p { margin: 0; color: var(--text-secondary); font-size: 14px; }

.section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-heading h2 { font-family: var(--font-display); font-size: 26px; margin: 0; color: var(--text-primary) !important; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 56px 20px; color: var(--text-secondary); text-align: center;
  border: 1px dashed var(--border); border-radius: 18px;
}

.library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.text-card {
  position: relative; background: var(--bg-panel); border: 1px solid var(--border);
  border-radius: 16px; padding: 18px; cursor: pointer; transition: transform 0.15s, background 0.15s;
}
.text-card:hover { background: var(--bg-panel-hover); transform: translateY(-2px); }
.text-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.text-card h3 { font-family: var(--font-display); font-size: 20px; margin: 4px 0 8px; font-weight: 600; line-height: 1.3; color: var(--text-primary) !important; }
.text-card-meta { display: flex; gap: 10px; color: var(--text-tertiary); font-size: 12px; font-family: var(--font-mono); }
.due-pill { background: var(--coral); color: #FFF !important; font-family: var(--font-mono); font-weight: 600; font-size: 11.5px; padding: 2px 8px; border-radius: 999px; }
.delete-btn { position: absolute; top: 10px; right: 10px; opacity: 0; transition: opacity 0.15s; }
.text-card:hover .delete-btn { opacity: 1; }

.btn {
  font-family: var(--font-body); font-size: 14px; font-weight: 600; border: none;
  border-radius: 11px; padding: 10px 16px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary { background: var(--btn-primary-bg); color: var(--btn-primary-text) !important; }
.btn-primary * { color: var(--btn-primary-text) !important; }
.btn-ghost { background: transparent; color: var(--text-primary) !important; border: 1px solid var(--border); }
.btn-ghost * { color: var(--text-primary) !important; }
.btn-danger { background: #DC2626; color: #FFF !important; }
.btn-lg { padding: 13px 22px; font-size: 15px; }
.btn-sm { padding: 7px 12px; font-size: 12.5px; }
.icon-btn {
  background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-primary);
  width: 34px; height: 34px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
}

.top-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.top-nav h2 { font-family: var(--font-display); font-size: 26px; margin: 0; flex: 1; color: var(--text-primary) !important; }
.top-nav-right { display: flex; gap: 8px; }

.form-panel { display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 12.5px; color: var(--text-secondary); margin-top: 14px; font-weight: 600; text-transform: uppercase; }
.text-input, .text-area-lg {
  background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-primary);
  border-radius: 12px; padding: 12px 14px; font-family: var(--font-body); font-size: 14.5px; outline: none;
}
.text-area-lg { line-height: 1.6; font-family: var(--font-display); font-size: 17px; }
.chunk-preview { display: flex; align-items: center; gap: 6px; color: var(--sun-dawn); font-size: 13px; font-family: var(--font-mono); }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }

.detail-sub { color: var(--text-tertiary); font-size: 13px; font-family: var(--font-mono); margin: -8px 0 22px; }
.chunk-list { display: flex; flex-direction: column; gap: 10px; }
.chunk-card {
  display: flex; align-items: center; gap: 14px; background: var(--bg-panel);
  border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px;
}
.chunk-info { flex: 1; min-width: 0; }
.chunk-preview-text { margin: 0 0 6px; font-family: var(--font-display); font-size: 16px; line-height: 1.4; color: var(--text-primary) !important; }
.chunk-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-tertiary); font-family: var(--font-mono); }
.chunk-due.is-due { color: var(--coral) !important; }
.chunk-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }

.study-panel, .mode-panel { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 18px; padding: 26px; }
.step-dots { display: flex; gap: 6px; margin-bottom: 18px; }
.step-dot { width: 22px; height: 4px; border-radius: 999px; background: var(--border); }
.step-dot.is-active { background: var(--sun-core); }
.study-step-label, .mode-label { color: var(--sun-dawn); font-size: 12.5px; font-weight: 600; text-transform: uppercase; margin-bottom: 14px; }
.study-text { font-family: var(--font-display); font-size: 20px; line-height: 1.75; white-space: pre-wrap; color: var(--text-primary) !important; margin-bottom: 22px; }
.hint-text, .blank-text { font-family: var(--font-mono); font-size: 16px; color: var(--text-secondary); }

.rate-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.rate-btn { flex: 1; min-width: 100px; justify-content: center; color: #FFF !important; }
.rate-again { background: #DC2626; }
.rate-hard { background: #EA580C; }
.rate-good { background: #D97706; }
.rate-easy { background: #16A34A; }

.cloze-text { font-family: var(--font-display); font-size: 20px; line-height: 2.1; white-space: pre-wrap; margin-bottom: 20px; color: var(--text-primary) !important; }
.cloze-input {
  background: var(--bg-elevated); border: 1px solid var(--border-soft); border-bottom: 2px solid var(--sun-dawn);
  color: var(--text-primary); font-family: var(--font-mono); font-size: 15px; padding: 2px 6px; border-radius: 6px; text-align: center; outline: none;
}
.cloze-input.is-correct { border-bottom-color: #16A34A; background: rgba(22, 163, 74, 0.2); }
.cloze-input.is-wrong { border-bottom-color: #DC2626; background: rgba(220, 38, 38, 0.2); }

.typing-area {
  width: 100%; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-primary);
  border-radius: 12px; padding: 14px; font-family: var(--font-display); font-size: 18px; line-height: 1.7; outline: none; margin-bottom: 16px;
}
.diff-text { font-family: var(--font-display); font-size: 19px; line-height: 1.9; white-space: pre-wrap; margin-bottom: 16px; }
.diff-correct { color: #16A34A; }
.diff-missing { color: #DC2626; text-decoration: line-through; }
.diff-extra { color: var(--text-tertiary); font-style: italic; }

.reorder-answer {
  min-height: 64px; background: var(--bg-elevated); border: 1px solid var(--border-soft);
  border-radius: 12px; padding: 12px; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
}
.reorder-bank { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.chip { font-family: var(--font-body); font-size: 14px; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-panel); color: var(--text-primary) !important; cursor: pointer; }
.chip-answer.is-correct { border-color: #16A34A; color: #16A34A !important; }
.chip-answer.is-wrong { border-color: #DC2626; color: #DC2626 !important; }

.summary-screen { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 20px; gap: 6px; }
.summary-screen h2 { font-family: var(--font-display); font-size: 28px; margin: 14px 0 2px; color: var(--text-primary) !important; }
.summary-accuracy { font-family: var(--font-mono); color: var(--sun-core) !important; font-size: 16px !important; margin-bottom: 22px !important; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 20px; }
.modal { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 16px; padding: 22px; max-width: 360px; width: 100%; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.sun-arc-guide { stroke: var(--border); stroke-width: 1.5; stroke-dasharray: 3 4; }
.sun-arc-horizon { stroke: var(--border-soft); stroke-width: 2; }
`;