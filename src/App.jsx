import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { collection, query, onSnapshot, addDoc, doc, writeBatch, serverTimestamp } from "firebase/firestore";

import Dashboard from "./components/Dashboard";
import TextDetailScreen from "./components/TextDetailScreen";
import StudyFlow from "./components/StudyFlow";
import "./App.css";

// Función normalizadora: Garantiza títulos, vistas previas y fragmentos para textos viejos y nuevos
function normalizeText(data, id) {
  const title = data.title || data.titulo || data.name || "Texto sin título";
  const rawText = data.rawText || data.content || data.texto || data.text || data.body || "";
  
  let chunks = Array.isArray(data.chunks) && data.chunks.length > 0 
    ? data.chunks 
    : (Array.isArray(data.fragmentos) && data.fragmentos.length > 0 ? data.fragmentos : []);

  // Si el texto en Firestore no tiene fragmentos, los genera dinámicamente por oraciones/líneas
  if (chunks.length === 0 && rawText) {
    const lines = rawText.split(/(?<=[.!?])\s+|\n+/).map(l => l.trim()).filter(Boolean);
    chunks = lines.map((line, idx) => ({
      id: `chunk_auto_${idx}`,
      text: line,
      order: idx
    }));
  }

  return {
    ...data,
    id: id || data.id,
    title,
    rawText,
    chunks
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("medieval");
  const [textsData, setTextsData] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [activeText, setActiveText] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [studyChunks, setStudyChunks] = useState([]);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState("");

  // 1. Autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  // 2. Carga y Normalización de Textos
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "texts")); 
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const texts = [];
        snapshot.forEach((document) => {
          const data = document.data();
          if (data.userId === user.uid || !data.userId) {
            texts.push(normalizeText(data, document.id));
          }
        });
        setTextsData(texts);

        if (activeText) {
          const updatedActive = texts.find(t => t.id === activeText.id);
          if (updatedActive) setActiveText(updatedActive);
        }
      },
      (error) => console.error("Error cargando textos:", error)
    );
    return () => unsubscribe();
  }, [user]);

  // 3. Carga de Progreso
  useEffect(() => {
    if (!user || !activeText) return;
    const q = query(collection(db, `texts/${activeText.id}/progress`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pMap = {};
      snapshot.forEach((document) => { pMap[document.id] = document.data(); });
      setProgressMap(pMap);
    });
    return () => unsubscribe();
  }, [user, activeText]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail("");
      setPassword("");
    } catch (error) {
      setAuthError("Error: Verifica tus credenciales.");
    }
  };

  const handleAddText = async (newTextObj) => {
    if (!user) return;
    const normalized = normalizeText(newTextObj);
    const docData = {
      title: normalized.title,
      rawText: normalized.rawText,
      type: normalized.type || "prosa",
      chunks: normalized.chunks,
      userId: user.uid,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, "texts"), docData);
  };

  // 4. Modo Estudio y Examen
  const startStudy = (mode) => {
    if (!activeText) return;
    const chunks = activeText.chunks || [];
    
    if (chunks.length === 0) {
      alert("Este texto no contiene fragmentos válidos para estudiar.");
      return;
    }
    
    let targets = mode === "all" 
      ? chunks 
      : chunks.filter(c => !progressMap[c.id] || progressMap[c.id].nextReview <= Date.now());
    
    if (targets.length === 0 && mode === "due") {
      targets = chunks; // Si no hay pendientes en el examen, repasa todos los fragmentos
    }

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
      const chunkRef = doc(db, `texts/${activeText.id}/progress/${chunkId}`);
      batch.set(chunkRef, newProgressData, { merge: true });
    }

    await batch.commit();
    setProgressMap(updatedProgress);
    setCurrentScreen("detail");
  };

  if (!user) {
    return (
      <div className="app-root theme-medieval" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="dashboard-item" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', margin: '2rem' }}>
          <img src="/solmedieval1.png" alt="Sol" style={{ width: '80px', marginBottom: '1rem', borderRadius: '12px' }} />
          <h1 className="header-title" style={{ marginBottom: '1.5rem', fontSize: '2.5rem', fontFamily: 'CloisterBlack, serif' }}>
            Memorizador Solar
          </h1>
          
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {authError && <p style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>{authError}</p>}
            <button type="submit" style={{ width: '100%' }}>{isLogin ? "Entrar" : "Crear Cuenta"}</button>
          </form>

          <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <span onClick={() => { setIsLogin(!isLogin); setAuthError(""); }} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 'bold' }}>
              {isLogin ? "Regístrate aquí" : "Inicia sesión"}
            </span>
          </p>
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
            <div>
              <h1 className="header-title" style={{ fontFamily: 'CloisterBlack, serif' }}>Memorizador Solar</h1>
              <p className="tagline">Método Ícaro Integrado</p>
            </div>
          </div>
          
          <div className="theme-tabs">
            {currentScreen === "dashboard" && (
              <>
                <button className={`theme-tab ${theme === 'medieval' ? 'active' : ''}`} onClick={() => setTheme('medieval')}>Medieval</button>
                <button className={`theme-tab ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>Light</button>
                <button className={`theme-tab ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>Dark</button>
              </>
            )}
            <button className="theme-tab" onClick={() => signOut(auth)}>Salir</button>
          </div>
        </header>

        {currentScreen === "dashboard" && (
          <Dashboard 
            texts={textsData} 
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