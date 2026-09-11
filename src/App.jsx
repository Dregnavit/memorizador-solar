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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  // CORRECCIÓN: Apuntando a la colección raíz "texts" (tu base de datos original)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "texts")); 
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const texts = [];
        snapshot.forEach((document) => {
          // Filtramos en el cliente por si acaso la colección es compartida
          if (document.data().userId === user.uid || !document.data().userId) {
            texts.push({ id: document.id, ...document.data() });
          }
        });
        setTextsData(texts);
      },
      (error) => console.error("Error cargando textos:", error)
    );
    return () => unsubscribe();
  }, [user]);

  const handleAddText = async (newTextObj) => {
    if (!user) return;
    await addDoc(collection(db, "texts"), {
      ...newTextObj,
      userId: user.uid,
      createdAt: serverTimestamp()
    });
  };

  if (!user) {
    return (
      <div className="app-root theme-medieval" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/solmedieval1.png" alt="Sol" style={{ width: '80px', marginBottom: '1rem', borderRadius: '8px' }} />
          <h1 style={{ fontFamily: 'CloisterBlack, serif', fontSize: '3rem', color: '#8B0000', marginBottom: '2rem' }}>Memorizador Solar</h1>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>Iniciar sesión con Google</button>
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
              <h1 className="header-title">Memorizador Solar</h1>
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
            data={textsData} 
            textsData={textsData} 
            onSelectText={t => { setActiveText(t); setCurrentScreen("detail"); }} 
            onAddText={handleAddText} 
          />
        )}
        
        {currentScreen === "detail" && activeText && (
          <TextDetailScreen 
            textItem={activeText} 
            progressMap={progressMap} 
            onBack={() => { setActiveText(null); setCurrentScreen("dashboard"); }} 
          />
        )}
      </div>
    </div>
  );
}