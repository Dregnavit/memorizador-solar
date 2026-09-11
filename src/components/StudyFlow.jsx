import React, { useState, useEffect } from 'react';
import { TopNav } from './SharedUI';
import { lcsDiff } from '../utils';

export default function StudyFlow({ textItem, targetChunks, onDone, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState(0); // 0: Read, 1: Type
  const [results, setResults] = useState([]);
  const [typedText, setTypedText] = useState("");
  const [diffResult, setDiffResult] = useState(null);

  const chunkObj = targetChunks[currentIndex];
  const actualText = typeof chunkObj === 'string' ? chunkObj : chunkObj.text;
  const originalChunkIndex = typeof chunkObj === 'string' ? textItem.chunks.indexOf(actualText) : chunkObj.originalIndex;

  useEffect(() => {
    setStep(0);
    setTypedText("");
    setDiffResult(null);
  }, [currentIndex]);

  const handleNextChunk = (quality) => {
    const newResults = [...results, { chunkIndex: originalChunkIndex, quality }];
    if (currentIndex + 1 < targetChunks.length) {
      setResults(newResults);
      setCurrentIndex(currentIndex + 1);
    } else {
      onDone(newResults);
    }
  };

  const checkTyping = () => {
    const origWords = actualText.split(/\s+/).filter(Boolean);
    const typeWords = typedText.split(/\s+/).filter(Boolean);
    setDiffResult(lcsDiff(origWords, typeWords));
  };

  return (
    <div className="study-flow">
      <TopNav title={`Repaso ${currentIndex + 1}/${targetChunks.length}`} onBack={onBack} />
      <div className="study-container">
        {step === 0 ? (
          <div className="study-step card">
            <h3>Fase de Lectura</h3>
            <p className="reading-text">{actualText}</p>
            <button className="btn-primary" onClick={() => setStep(1)}>Practicar</button>
          </div>
        ) : (
          <div className="study-step card">
            <h3>Modo Escritura</h3>
            {diffResult ? (
              <div className="diff-view">
                <p>Precisión: {Math.round(diffResult.accuracy * 100)}%</p>
                <div className="evaluation-buttons">
                  <button className="btn-fail" onClick={() => handleNextChunk(1)}>Olvidé (1)</button>
                  <button className="btn-hard" onClick={() => handleNextChunk(3)}>Difícil (3)</button>
                  <button className="btn-easy" onClick={() => handleNextChunk(5)}>Perfecto (5)</button>
                </div>
              </div>
            ) : (
              <>
                <textarea autoFocus className="text-area-lg" value={typedText} onChange={e => setTypedText(e.target.value)} placeholder="Escribe el fragmento..." />
                <button className="btn-primary" onClick={checkTyping}>Verificar</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}