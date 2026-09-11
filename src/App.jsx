import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { collection, query, onSnapshot, addDoc, doc, writeBatch, serverTimestamp } from "firebase/firestore";

import Dashboard from "./components/Dashboard";
import TextDetailScreen from "./components/TextDetailScreen";
import StudyFlow from "./components/StudyFlow";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("medieval");
  const [textsData, setTextsData] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [activeText, setActiveText] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [studyChunks, setStudyChunks] = useState([]);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // 1. Autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Cargar Textos (Ruta original: users/UID/texts)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/texts`));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const texts = [];
        snapshot.forEach((document) => texts.push({ id: document.id, ...document.data() }));
        setTextsData(texts);
      },
      (error) => console.error("Error al cargar Firebase:", error)
    );
    return () => unsubscribe();
  }, [user]);

  // 3. Cargar Progreso
  useEffect(() => {
    if (!user || !activeText) return;
    const q = query(collection(db, `users/${user.uid}/texts/${activeText.id}/progress`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pMap = {};
      snapshot.forEach((document) => { pMap[document.id] = document.data(); });
      setProgressMap(pMap);
    });
    return () => unsubscribe();
  }, [user, activeText]);

  const handleAddText = async (newTextObj) => {
    if (!user) return;
    await addDoc(collection(db, `users/${user.uid}/texts`), {
      ...newTextObj,
      createdAt: serverTimestamp()
    });
  };

  const startStudy = (mode) => {
    if (!activeText || !activeText.chunks) return;
    let targets = mode === "all" 
      ? activeText.chunks 
      : activeText.chunks.filter(c => !progressMap[c.id] || progressMap[c.id].nextReview <= Date.now());
    
    setStudyChunks(targets);
    setCurrentScreen("study");
  };

  const handleStudyDone = async (results) => {
    const updatedProgress = { ...progressMap };
    const batch = writeBatch(db);

    for (const res of results) {
      const { chunkId, rating, icaro } = res;
      const current = updatedProgress[chunkId] || { interval: 0, ease: 2.5, nextReview: Date.now() };
      let { interval, ease } = current;

      if (rating === "again") { interval = 0; ease = Math.max(1.3, ease - 0.2); } 
      else if (rating === "hard") { interval = Math.max(1, interval * 1.2); ease = Math.max(1.3, ease - 0.15); } 
      else if (rating === "good") { interval = interval === 0 ? 1 : interval * 2.5; } 
      else if (rating === "easy") { interval = interval === 0 ? 4 : interval * ease * 1.3; ease += 0.15; }

      const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;
      const newProgressData = { interval, ease, nextReview, icaro };

      updatedProgress[chunkId] = newProgressData;
      const chunkRef = doc(db, `users/${user.uid}/texts/${activeText.id}/progress/${chunkId}`);
      batch.set(chunkRef, newProgressData, { merge: true });
    }

    await batch.commit();
    setProgressMap(updatedProgress);
    setCurrentScreen("detail");
  };

  if (loadingAuth) return <div className="screen">Cargando...</div>;

  if (!user) {
    return (
      <div className="app-root theme-medieval" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="screen" style={{ textAlign: 'center' }}>
          <img src="/solmedieval1.png" alt="Sol" style={{ width: '80px', marginBottom: '1rem', borderRadius: '12px' }} />
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '3rem', marginBottom: '2rem' }}>Memorizador Solar</h1>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>
            Iniciar sesión con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-root theme-${theme}`}>
      <div className="screen">
        <header className="app-header">
          <div className="brand-group">
            <img src="/solmedieval1.png" alt="Icono Sol" className="app-icon" />
            <div className="brand-text">
              <h1>Memorizador Solar</h1>
              <p className="tagline">Método Ícaro Integrado</p>
            </div>
          </div>
          
          <div className="theme-tabs">
            {currentScreen === "dashboard" && (
              <>
                {['medieval', 'light', 'dark'].map(t => (
                  <button 
                    key={t}
                    className={`theme-tab ${theme === t ? 'active' : ''}`}
                    onClick={() => setTheme(t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </>
            )}
            <button className="theme-tab" onClick={() => { signOut(auth); setUser(null); }}>
              Salir
            </button>
          </div>
        </header>

        {currentScreen === "dashboard" && (
          <Dashboard 
            texts={textsData}        /* Inyección doble para asegurar compatibilidad */
            textsData={textsData} 
            progressMap={progressMap} 
            onSelectText={t => { setActiveText(t); setCurrentScreen("detail"); }} 
            onAddText={handleAddText} 
          />
        )}
        
        {currentScreen === "detail" && activeText && (
          <TextDetailScreen 
            textItem={activeText} 
            progressMap={progressMap} 
            onBack={() => { setActiveText(null); setCurrentScreen("dashboard"); }} 
            onStudy={() => startStudy("all")} 
            onExam={() => startStudy("due")} 
          />
        )}
        
        {currentScreen === "study" && activeText && studyChunks.length > 0 && (
          <StudyFlow 
            textItem={activeText} 
            targetChunks={studyChunks} 
            onDone={handleStudyDone} 
            onBack={() => setCurrentScreen("detail")} 
          />
        )}
      </div>
    </div>
  );
}