import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { collection, query, onSnapshot, addDoc, doc, writeBatch, serverTimestamp, where } from "firebase/firestore";

// Componentes
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

  // 2. Cargar Textos (Ruta corregida a la colección principal)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "texts"), where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const texts = [];
      snapshot.forEach((document) => texts.push({ id: document.id, ...document.data() }));
      setTextsData(texts);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Cargar Progreso del Texto Activo
  useEffect(() => {
    if (!user || !activeText) return;
    const q = query(collection(db, `texts/${activeText.id}/progress`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pMap = {};
      snapshot.forEach((document) => {
        pMap[document.id] = document.data();
      });
      setProgressMap(pMap);
    });
    return () => unsubscribe();
  }, [user, activeText]);

  // 4. Agregar Texto
  const handleAddText = async (newTextObj) => {
    if (!user) return;
    await addDoc(collection(db, "texts"), {
      ...newTextObj,
      userId: user.uid,
      createdAt: serverTimestamp()
    });
  };

  // 5. Iniciar Estudio
  const startStudy = (mode) => {
    if (!activeText || !activeText.chunks) return;
    let targets = [];
    if (mode === "all") {
      targets = activeText.chunks;
    } else {
      const now = Date.now();
      targets = activeText.chunks.filter(c => {
        const p = progressMap[c.id];
        return !p || !p.nextReview <= now;
      });
    }
    setStudyChunks(targets);
    setCurrentScreen("study");
  };

  // 6. Guardar Progreso y Método Ícaro en Firebase
  const handleStudyDone = async (results) => {
    const updatedProgress = { ...progressMap };
    const batch = writeBatch(db);

    for (const res of results) {
      const { chunkId, rating, icaro } = res;
      const current = updatedProgress[chunkId] || { interval: 0, ease: 2.5, nextReview: Date.now() };

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
      const newProgressData = { interval, ease, nextReview, icaro };

      updatedProgress[chunkId] = newProgressData;
      const chunkRef = doc(db, `texts/${activeText.id}/progress/${chunkId}`);
      batch.set(chunkRef, newProgressData, { merge: true });
    }

    await batch.commit();
    setProgressMap(updatedProgress);
    setCurrentScreen("detail");
  };

  if (loadingAuth) {
    return <div className="loading-screen"><div className="spin">⚙</div></div>;
  }

  if (!user) {
    return (
      <div className="app-root theme-medieval" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="screen" style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: '20px' }}>Memorizador Solar</h1>
          <button className="btn btn-primary" onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>
            Iniciar sesión con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-root theme-${theme}`}>
      <div className="screen">
        <div className="app-header">
          <div className="brand">
            <div>
              <h1>Memorizador Solar</h1>
              <p className="tagline">Método Ícaro Integrado</p>
            </div>
          </div>
          <div className="header-right">
            {currentScreen === "dashboard" && (
              <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                style={{ 
                  marginRight: '15px', 
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  background: 'var(--surface)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border)' 
                }}
              >
                <option value="medieval">Medieval</option>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
              </select>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => { signOut(auth); setUser(null); }}>
              Salir
            </button>
          </div>
        </div>

        {currentScreen === "dashboard" && (
          <Dashboard
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