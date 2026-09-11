import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

import { getSavedTheme, saveThemeLocal, nextSRS, chunkText } from './utils';
import { ThemeSelector } from './components/SharedUI';
import Dashboard from './components/Dashboard';
import TextDetailScreen from './components/TextDetailScreen';
import StudyFlow from './components/StudyFlow';

import './App.css';

export default function App() {
  const [theme, setTheme] = useState(getSavedTheme() || "medieval");
  const [currentScreen, setCurrentScreen] = useState("dashboard"); // dashboard, detail, study
  const [user, setUser] = useState(null);
  
  // Estado global de datos
  const [textsData, setTextsData] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [activeText, setActiveText] = useState(null);
  const [studyMode, setStudyMode] = useState("all"); 
  const [studyChunks, setStudyChunks] = useState([]);

  // Aplicar tema CSS
  useEffect(() => {
    document.body.className = `theme-${theme}`;
    saveThemeLocal(theme);
  }, [theme]);

  // Autenticación y carga desde Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, "users", u.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          setTextsData(d.textsData || []);
          setProgressMap(d.progressMap || {});
        }
      }
    });
    return () => unsub();
  }, []);

  const syncToCloud = async (newTexts, newProg) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), { textsData: newTexts, progressMap: newProg }, { merge: true });
    } catch (e) {
      console.error("Error sincronizando:", e);
    }
  };

  const handleAddText = (title, content, category) => {
    // Para preparar el Método Ícaro, ahora los chunks se guardarán como objetos, no solo strings
    const rawChunks = chunkText(content, category);
    const chunksAsObjects = rawChunks.map(txt => ({
      text: txt,
      keywords: [],
      agentImage: "",
      palaceLoci: ""
    }));

    const newText = { id: Date.now().toString(), title, chunks: chunksAsObjects, chunkCount: rawChunks.length, category };
    const updated = [newText, ...textsData];
    setTextsData(updated);
    syncToCloud(updated, progressMap);
  };

  const handleStudyDone = async (results) => {
    // results recibe el array desde StudyFlow: [{ chunkId, rating, icaro: {...} }]
    const updatedProgress = { ...progressMap };
    
    // Importa writeBatch y doc de firebase/firestore arriba si no los tienes
    const { writeBatch, doc } = await import('firebase/firestore');
    const batch = writeBatch(db); 

    for (const res of results) {
      const { chunkId, rating, icaro } = res;
      const current = updatedProgress[chunkId] || { interval: 0, ease: 2.5, nextReview: Date.now() };

      // Algoritmo de Repaso Espaciado Básico
      let { interval, ease } = current;
      if (rating === "again") {
        interval = 0;
        ease = Math.max(1.3, ease - 0.2);
      } else if (rating === "hard") {
        interval = Math.max(1, interval * 1.2);
        ease = Math.max(1.3, ease - 0.15);
      } else if (rating === "good") {
        interval = interval === 0 ? 1 : interval * 2.5;
      } else if (rating === "easy") {
        interval = interval === 0 ? 4 : interval * ease * 1.3;
        ease += 0.15;
      }

      const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;
      
      const newProgressData = {
        interval,
        ease,
        nextReview,
        icaro // Aquí inyectamos la data del Método Ícaro a la base de datos
      };

      updatedProgress[chunkId] = newProgressData;

      // Actualizamos el documento en Firestore
      const chunkRef = doc(db, `users/${user.uid}/texts/${activeText.id}/progress/${chunkId}`);
      batch.set(chunkRef, newProgressData, { merge: true });
    }

    await batch.commit();
    setProgressMap(updatedProgress);
    setCurrentScreen("detail");
  };

  const startStudy = (mode) => {
    setStudyMode(mode);
    let targetList = [];
    if (mode === "due") {
      targetList = activeText.chunks
        .map((c, idx) => ({ ...c, originalIndex: idx }))
        .filter(c => {
          const p = progressMap[`${activeText.id}_${c.originalIndex}`];
          return !p || new Date(p.nextReview) <= new Date();
        });
    } else {
      targetList = activeText.chunks.map((c, idx) => ({ ...c, originalIndex: idx }));
    }
    setStudyChunks(targetList);
    setCurrentScreen("study");
  };

  if (!user) return <div style={{padding: '2rem'}}>Cargando o no autenticado...</div>;

  return (
    <div className="app-container">
      {currentScreen === "dashboard" && (
        <>
          <ThemeSelector currentTheme={theme} onChangeTheme={setTheme} />
          <Dashboard textsData={textsData} progressMap={progressMap} onSelectText={t => { setActiveText(t); setCurrentScreen("detail"); }} onAddText={handleAddText} />
        </>
      )}
      {currentScreen === "detail" && activeText && (
        <TextDetailScreen textItem={activeText} progressMap={progressMap} onBack={() => { setActiveText(null); setCurrentScreen("dashboard"); }} onStudy={() => startStudy("all")} onExam={() => startStudy("due")} />
      )}
      {currentScreen === "study" && activeText && studyChunks.length > 0 && (
        <StudyFlow textItem={activeText} targetChunks={studyChunks} onDone={handleStudyDone} onBack={() => setCurrentScreen("detail")} />
      )}
    </div>
  );
}