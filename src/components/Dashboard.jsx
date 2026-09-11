import React, { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { TEXT_CATEGORIES, textStageInfo } from '../utils';
import { SunArc } from './SharedUI';

export default function Dashboard({ textsData, progressMap, onSelectText, onAddText }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [category, setCategory] = useState("prose");

  const handleAdd = (e) => {
    e.preventDefault();
    if(!newTitle.trim() || !newContent.trim()) return;
    onAddText(newTitle, newContent, category);
    setNewTitle(""); setNewContent(""); setShowAdd(false);
  };

  return (
    <div className="dashboard">
      <header className="dash-header">
        <h1>Memorizador Solar</h1>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={18} /> {showAdd ? "Cancelar" : "Nuevo Texto"}
        </button>
      </header>

      {showAdd && (
        <form className="add-form card" onSubmit={handleAdd}>
          <input type="text" placeholder="Título..." value={newTitle} onChange={e => setNewTitle(e.target.value)} required />
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {Object.values(TEXT_CATEGORIES).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <textarea placeholder="Pega tu texto aquí..." value={newContent} onChange={e => setNewContent(e.target.value)} required className="text-area-lg" />
          <button type="submit" className="btn-primary">Fragmentar y Guardar</button>
        </form>
      )}

      <div className="text-list">
        {textsData.map(item => {
          const { avgStage, dueCount } = textStageInfo(item, progressMap);
          return (
            <div key={item.id} className="text-card card" onClick={() => onSelectText(item)}>
              <div className="text-card-info">
                <h3>{item.title}</h3>
                <p>{item.chunkCount} fragmentos • {dueCount} repasos pendientes</p>
              </div>
              <SunArc stage={avgStage} size={40} />
              <ChevronRight size={20} className="icon-muted" />
            </div>
          );
        })}
        {textsData.length === 0 && !showAdd && <p className="empty-state">No hay textos. ¡Agrega uno para empezar!</p>}
      </div>
    </div>
  );
}