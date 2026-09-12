import React, { useState } from "react";

export default function StudyFlow({ 
  textItem = {}, 
  targetChunks = [], 
  onDone = () => {}, 
  onBack = () => {} 
}) {
  const chunks = Array.isArray(targetChunks) && targetChunks.length > 0 
    ? targetChunks 
    : (Array.isArray(textItem?.chunks) ? textItem.chunks : []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState([]);

  if (chunks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <p>No hay fragmentos disponibles para estudiar.</p>
        <button onClick={onBack}>Volver</button>
      </div>
    );
  }

  const currentChunk = chunks[currentIndex];

  const handleRating = (rating) => {
    const updatedResults = [...results, { chunkId: currentChunk.id, rating }];
    setResults(updatedResults);
    setShowAnswer(false);

    if (currentIndex + 1 < chunks.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onDone(updatedResults);
    }
  };

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "1rem" }}>
      <button 
        onClick={onBack} 
        style={{ background: "transparent", border: "1px solid var(--text-muted)", padding: "0.4rem 0.8rem", cursor: "pointer", marginBottom: "1rem" }}
      >
        ← Salir del Estudio
      </button>

      <div className="dashboard-item" style={{ padding: "2rem", textAlign: "center", minHeight: "220px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "1rem" }}>
          Fragmento {currentIndex + 1} de {chunks.length}
        </p>

        <h2 style={{ fontSize: "1.6rem", marginBottom: "1.5rem" }}>
          {currentChunk?.text || "Sin texto"}
        </h2>

        {!showAnswer ? (
          <button 
            className="btn-primary" 
            onClick={() => setShowAnswer(true)}
            style={{ padding: "0.6rem 1.2rem", fontSize: "1rem", margin: "0 auto", cursor: "pointer" }}
          >
            Revelar / Memorizar
          </button>
        ) : (
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => handleRating("again")} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>Repetir</button>
            <button onClick={() => handleRating("hard")} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>Difícil</button>
            <button onClick={() => handleRating("good")} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>Bueno</button>
            <button onClick={() => handleRating("easy")} className="btn-primary" style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>Fácil</button>
          </div>
        )}
      </div>
    </div>
  );
}