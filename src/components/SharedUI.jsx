// src/components/SharedUI.jsx
import React from 'react';
import { Sun, Moon, BookOpen, ArrowLeft } from "lucide-react";
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export function ThemeSelector({ currentTheme, onChangeTheme }) {
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

export function SunArc({ stage = 0, size = 56 }) {
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

export function TopNav({ title, onBack, right }) {
  return (
    <div className="top-nav">
      <button className="icon-btn" onClick={onBack} aria-label="Volver"><ArrowLeft size={18} /></button>
      <h2>{title}</h2>
      <div className="top-nav-right">{right}</div>
    </div>
  );
}