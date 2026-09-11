// src/utils.js

/* ---------------- Preferencias Locales ---------------- */
export const THEME_KEY = "theme_preference";
export function getSavedTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}
export function saveThemeLocal(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { console.error(e); }
}

/* ---------------- Fragmentación de Texto ---------------- */
export const TEXT_CATEGORIES = {
  prose: { id: "prose", label: "Texto General (Prosa)", chunkSize: 12 },
  code: { id: "code", label: "Números / Código (Exactitud)", chunkSize: 4 },
};

export function splitChunkElements(text, category) {
  if (category === "code") {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) return { elements: lines, joiner: "\n" };
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) return { elements: tokens, joiner: " " };
    return { elements: Array.from(text), joiner: "" };
  }

  const sentences = (text.match(/[^.!?]+[.!?]+[”"')\]]*\s*|[^.!?]+$/g) || [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length >= 2) return { elements: sentences, joiner: " " };

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length >= 2) return { elements: paragraphs, joiner: "\n\n" };

  return { elements: text.split(/\s+/).filter(Boolean), joiner: " " };
}

export function chunkText(raw, category = "prose") {
  const text = raw.trim().replace(/\r\n/g, "\n");
  const limit = TEXT_CATEGORIES[category]?.chunkSize || TEXT_CATEGORIES.prose.chunkSize;
  const { elements, joiner } = splitChunkElements(text, category);
  if (!elements.length) return [text];
  if (elements.length <= limit) return [text];

  const chunks = [];
  for (let i = 0; i < elements.length; i += limit) {
    chunks.push(elements.slice(i, i + limit).join(joiner).trim());
  }
  return chunks.filter(Boolean).length ? chunks.filter(Boolean) : [text];
}

/* ---------------- Algoritmo SRS ---------------- */
export function nextSRS(prev, quality) {
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

export function stageFromReps(reps = 0) {
  if (reps <= 0) return 0;
  if (reps === 1) return 1;
  if (reps === 2) return 2;
  if (reps <= 4) return 3;
  return 4;
}

export const STAGE_LABELS = ["Nuevo", "Aprendiendo", "Familiar", "Consolidado", "Dominado"];

export function isDue(state) {
  if (!state) return true;
  return new Date(state.nextReview) <= new Date();
}

export function qualityFromAccuracy(acc) {
  if (acc >= 0.95) return 5;
  if (acc >= 0.85) return 4;
  if (acc >= 0.65) return 3;
  if (acc >= 0.4) return 2;
  if (acc > 0) return 1;
  return 0;
}

export function formatRelative(iso) {
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

export function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* ---------------- Utilidades de texto ---------------- */
export function normalizeWord(w) {
  return (w || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function firstLetterHint(text) {
  return text.replace(/[\wÀ-ÿ]+/g, (w) => (w.length <= 1 ? w : w[0] + "_".repeat(w.length - 1)));
}

export function blankText(text) {
  return text.replace(/[\wÀ-ÿ]+/g, (w) => "_".repeat(w.length));
}

export function buildCloze(text, ratio = 0.3) {
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

export function lcsDiff(origWords, typedWords) {
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

export function reorderTokens(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 18) return words;
  const groupSize = Math.ceil(words.length / 14);
  const groups = [];
  for (let i = 0; i < words.length; i += groupSize) {
    groups.push(words.slice(i, i + groupSize).join(" "));
  }
  return groups;
}

export function textStageInfo(item, progress) {
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