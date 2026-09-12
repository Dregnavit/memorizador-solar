import React, { useState } from "react";

export default function Dashboard({ texts = [], onSelectText = () => {}, onAddText = () => {} }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("prosa");
  const [rawText, setRawText] = useState("");

  const safeTexts = Array.isArray(texts) ? texts : [];

  const handleCreate = (e) => {
    e.preventDefault();
    if (!title.trim() || !rawText.trim()) return;

    let lines = [];
    if (type === "poesia") {
      lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
    } else {
      lines = rawText
        .split(/(?<=[.!?])\s+|\n+/)
        .map(l => l.trim())
        .filter(Boolean);
    }

    if (lines.length === 0) lines = [rawText.trim()];

    const chunks = lines.map((line, idx) => ({
      id: `chunk_${Date.now()}_${idx}`,
      text: line,
      order: idx
    }));

    onAddText({
      title: title.trim(),
      rawText: rawText.trim(),
      type,
      chunks
    });

    setTitle("");
    setRawText("");
    setShowForm(false);
  };

  const getPreviewText = (item) => {
    const txt = item?.rawText || item?.content || item?.texto || item?.text || item?.body || "";
    if (!txt) return "Sin contenido disponible.";
    return txt.length > 120 ? txt.substring(0, 120) + "..." : txt;
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
      {!showForm ? (
        <button 
          className="btn-primary" 
          onClick={() => setShowForm(true)}
          style={{ marginBottom: "1.5rem", padding: "0.6rem 1.2rem", fontSize: "1rem", cursor: "pointer" }}
        >
          + Nuevo Texto
        </button>
      ) : (
        <form onSubmit={handleCreate} className="dashboard-item" style={{ marginBottom: "2rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontFamily: "CloisterBlack, serif", fontSize: "1.6rem" }}>Añadir Nuevo Texto</h2>
            <button 
              type="button" 
              onClick={() => setShowForm(false)}
              style={{ background: "transparent", border: "1px solid var(--text-muted)", padding: "0.3rem 0.8rem", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>

          <input
            type="text"
            placeholder="Título del texto"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ width: "100%", padding: "0.6rem", marginBottom: "1rem", fontSize: "1rem" }}
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{ width: "100%", padding: "0.6rem", marginBottom: "1rem", fontSize: "1rem" }}
          >
            <option value="prosa">Texto General (Prosa / Oraciones)</option>
            <option value="poesia">Poesía / Versos (Línea por línea)</option>
          </select>

          <textarea
            placeholder="Pega tu texto aquí..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            required
            rows={6}
            style={{ width: "100%", padding: "0.6rem", marginBottom: "1rem", fontSize: "1rem", resize: "vertical" }}
          />

          <button type="submit" className="btn-primary" style={{ width: "100%", padding: "0.7rem", fontSize: "1.05rem", cursor: "pointer" }}>
            Fragmentar y Guardar
          </button>
        </form>
      )}

      <div className="texts-list" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {safeTexts.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "2rem" }}>
            No tienes textos guardados. Haz clic en "+ Nuevo Texto" para añadir el primero.
          </p>
        ) : (
          safeTexts.map((item) => {
            const preview = getPreviewText(item);
            const chunksList = Array.isArray(item?.chunks) ? item.chunks : [];

            return (
              <div
                key={item.id}
                className="dashboard-item text-card"
                onClick={() => onSelectText(item)}
                style={{
                  padding: "1.2rem",
                  cursor: "pointer",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h3 
                    className="header-title" 
                    style={{ margin: 0, fontSize: "1.5rem", fontFamily: "CloisterBlack, serif" }}
                  >
                    {item.title || "Texto sin título"}
                  </h3>
                  <span style={{ fontSize: "1.1rem", opacity: 0.7 }}>➔</span>
                </div>

                <p style={{ 
                  margin: "0.2rem 0", 
                  fontSize: "0.95rem", 
                  color: "var(--text-muted, #666)", 
                  fontStyle: "italic",
                  lineHeight: "1.4"
                }}>
                  "{preview}"
                </p>

                <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "0.2rem" }}>
                  {chunksList.length} fragmentos
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}