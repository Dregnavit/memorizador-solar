import { useState, useEffect } from "react";

export default function StudyFlow({ textItem, targetChunks, onDone, onBack }) {
  const [chunkIndex, setChunkIndex] = useState(0);
  const [phase, setPhase] = useState("analitica");
  const [icaroForm, setIcaroForm] = useState({ keyword: "", imagen: "", palacio: "" });
  const [sessionResults, setSessionResults] = useState([]);

  const currentChunk = targetChunks[chunkIndex];

  // Si el fragmento ya tenía Método Ícaro guardado en Firebase, lo cargamos
  useEffect(() => {
    if (currentChunk) {
      setIcaroForm({
        keyword: currentChunk.icaro?.keyword || "",
        imagen: currentChunk.icaro?.imagen || "",
        palacio: currentChunk.icaro?.palacio || ""
      });
      setPhase("analitica");
    }
  }, [currentChunk]);

  const advancePhase = () => {
    if (phase === "analitica") setPhase("visual");
    else if (phase === "visual") setPhase("espacial");
    else if (phase === "espacial") setPhase("evaluacion");
  };

  const finishChunk = (rating) => {
    const newResults = [...sessionResults, { 
      chunkId: currentChunk.id, 
      rating, 
      icaro: icaroForm 
    }];

    if (chunkIndex + 1 < targetChunks.length) {
      setSessionResults(newResults);
      setChunkIndex(chunkIndex + 1);
    } else {
      // Envía todos los datos a App.jsx para que haga el push a Firebase
      onDone(newResults); 
    }
  };

  return (
    <div className="screen study-panel">
      <div className="top-nav">
        <h2>{textItem?.title || "Memorización"} - Ícaro</h2>
        <button className="icon-btn" onClick={onBack}>✕</button>
      </div>

      <div className="step-dots">
        {["analitica", "visual", "espacial", "evaluacion"].map((p) => (
          <div key={p} className={`step-dot ${phase === p ? "is-active" : ""}`} />
        ))}
      </div>

      <div className="study-text">{currentChunk?.text}</div>

      {phase === "analitica" && (
        <div className="form-panel">
          <label className="field-label">Fase 1: Palabra Clave / Idea Maestra</label>
          <input type="text" className="text-input" placeholder="Ej: Revolución, 1984, Mitocondria..." 
            value={icaroForm.keyword} onChange={e => setIcaroForm({...icaroForm, keyword: e.target.value})} />
          <button className="btn btn-primary" onClick={advancePhase} disabled={!icaroForm.keyword}>Destilar Idea</button>
        </div>
      )}

      {phase === "visual" && (
        <div className="form-panel">
          <label className="field-label">Fase 2: Forjado de Imagen (Agente Visual)</label>
          <textarea className="text-area-lg" placeholder="Describe una imagen absurda, exagerada o en movimiento..." 
            value={icaroForm.imagen} onChange={e => setIcaroForm({...icaroForm, imagen: e.target.value})} />
          <button className="btn btn-primary" onClick={advancePhase} disabled={!icaroForm.imagen}>Fijar Imagen</button>
        </div>
      )}

      {phase === "espacial" && (
        <div className="form-panel">
          <label className="field-label">Fase 3: Estación Espacial (Loci)</label>
          <input type="text" className="text-input" placeholder="Ej: La puerta de mi casa, el escritorio..." 
            value={icaroForm.palacio} onChange={e => setIcaroForm({...icaroForm, palacio: e.target.value})} />
          <button className="btn btn-primary" onClick={advancePhase} disabled={!icaroForm.palacio}>Anclar en el Espacio</button>
        </div>
      )}

      {phase === "evaluacion" && (
        <div className="form-panel">
          <label className="field-label">Fase 4: Recuperación Activa</label>
          <div className="reorder-answer" style={{ flexDirection: "column", alignItems: "flex-start" }}>
            <span className="chunk-preview">💡 Pista Visual: {icaroForm.imagen}</span>
            <span className="chunk-preview">📍 Estación: {icaroForm.palacio}</span>
          </div>
          <p className="detail-sub" style={{ marginTop: "16px" }}>¿Qué tan nítida fue la recuperación usando tus anclajes?</p>
          <div className="rate-buttons">
            <button className="btn rate-btn rate-again" onClick={() => finishChunk("again")}>Olvidé</button>
            <button className="btn rate-btn rate-hard" onClick={() => finishChunk("hard")}>Difícil</button>
            <button className="btn rate-btn rate-good" onClick={() => finishChunk("good")}>Bien</button>
            <button className="btn rate-btn rate-easy" onClick={() => finishChunk("easy")}>Fácil</button>
          </div>
        </div>
      )}
    </div>
  );
}