import React from "react";

export default function TextDetailScreen({ textItem, progressMap, onBack, onStudy, onExam }) {
  const title = textItem.title || "Texto sin título";
  const rawText = textItem.rawText || "";
  const chunks = textItem.chunks || [];

  const dueCount = chunks.filter(c => {
    const p = progressMap[c.id];
    return !p || p.nextReview <= Date.now();
  }).length;

  return (
    <div className="detail-container" style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
      <button 
        onClick={onBack}
        style={{ background: "transparent", border: "1px solid var(--text-muted)", padding: "0.4rem 0.8rem", cursor: "pointer", marginBottom: "1rem" }}
      >
        ← Volver al Menú
      </button>

      <div className="dashboard-item" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h1 className="header-title" style={{ fontFamily: "CloisterBlack, serif", fontSize: "2.2rem", marginTop: 0 }}>
          {title}
        </h1>
        
        {rawText && (
          <div style={{ 
            background: "rgba(0,0,0,0.03)", 
            padding: "1rem", 
            borderRadius: "6px", 
            marginBottom: "1.5rem", 
            whiteSpace: "pre-wrap",
            lineHeight: "1.6",
            maxHeight: "180px",
            overflowY: "auto",
            borderLeft: "3px solid var(--accent, #8b0000)"
          }}>
            {rawText}
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button 
            className="btn-primary" 
            onClick={onStudy}
            style={{ padding: "0.7rem 1.4rem", fontSize: "1rem", cursor: "pointer" }}
          >
            Estudiar Todo ({chunks.length} fragmentos)
          </button>
          
          <button 
            onClick={onExam}
            style={{ padding: "0.7rem 1.4rem", fontSize: "1rem", cursor: "pointer" }}
          >
            Repasar Pendientes ({dueCount})
          </button>
        </div>
      </div>

      <h3 style={{ fontFamily: "CloisterBlack, serif", fontSize: "1.4rem" }}>Fragmentos ({chunks.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        {chunks.map((chunk, index) => {
          const prog = progressMap[chunk.id];
          const isDue = !prog || prog.nextReview <= Date.now();
          return (
            <div 
              key={chunk.id || index} 
              className="dashboard-item" 
              style={{ padding: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <span style={{ fontWeight: "bold", marginRight: "0.5rem", opacity: 0.7 }}>#{index + 1}</span>
                <span>{chunk.text}</span>
              </div>
              <span style={{ 
                fontSize: "0.8rem", 
                padding: "0.2rem 0.5rem", 
                borderRadius: "4px",
                background: isDue ? "rgba(200,50,50,0.15)" : "rgba(50,150,50,0.15)",
                color: isDue ? "#a00" : "#080"
              }}>
                {isDue ? "Pendiente" : "Repasado"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}