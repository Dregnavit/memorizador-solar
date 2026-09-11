import React from 'react';
import { TopNav, SunArc } from './SharedUI';
import { isDue, formatRelative, STAGE_LABELS, stageFromReps } from '../utils';

export default function TextDetailScreen({ textItem, progressMap, onBack, onStudy, onExam }) {
  const dueChunks = textItem.chunks.filter((_, i) => isDue(progressMap[`${textItem.id}_${i}`]));

  return (
    <div className="text-detail">
      <TopNav title={textItem.title} onBack={onBack} right={
        <div className="detail-actions">
          <button className="btn-secondary" onClick={onStudy}>Estudiar ({textItem.chunkCount})</button>
          <button className="btn-primary" onClick={onExam} disabled={dueChunks.length === 0}>
            Examinar ({dueChunks.length})
          </button>
        </div>
      } />

      <div className="chunk-list">
        {textItem.chunks.map((chunk, i) => {
          // Soporte para cuando los chunks sean objetos (Ícaro) o strings (Legacy)
          const chunkTextValue = typeof chunk === 'string' ? chunk : chunk.text;
          const cid = `${textItem.id}_${i}`;
          const p = progressMap[cid];
          const stage = stageFromReps(p?.reps);
          const due = isDue(p);

          return (
            <div key={i} className={`chunk-card card ${due ? 'due' : ''}`}>
              <div className="chunk-header">
                <span className="chunk-index">#{i + 1}</span>
                <div className="chunk-stats">
                  <SunArc stage={stage} size={24} />
                  <span className="status-badge">{STAGE_LABELS[stage]}</span>
                </div>
              </div>
              <p className="chunk-preview">{chunkTextValue.substring(0, 90)}...</p>
              <div className="chunk-footer">
                Próximo repaso: {formatRelative(p?.nextReview)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}