import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { collection, query, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";

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
  
  // Estados para tu sistema de acceso por correo
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "texts")); 
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const texts = [];
        snapshot.forEach((document) => {
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
      setAuthError("Error: Verifica tus credenciales o contraseña (mínimo 6 caracteres).");
    }
  };

  const handleAddText = async (newTextObj) => {
    if (!user) return;
    await addDoc(collection(db, "texts"), {
      ...newTextObj,
      userId: user.uid,
      createdAt: serverTimestamp()
    });
  };

  // PANTALLA DE INICIO DE SESIÓN RESTAURADA
  if (!user) {
    return (
      <div className="app-root theme-medieval" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="dashboard-item" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', margin: '2rem' }}>
          <img src="/solmedieval1.png" alt="Sol" style={{ width: '80px', marginBottom: '1rem', borderRadius: '12px' }} />
          
          {/* Se añade la clase header-title para que CSS no lo oculte y aplique CloisterBlack */}
          <h1 className="header-title" style={{ marginBottom: '1.5rem', fontSize: '2.5rem' }}>
            Memorizador Solar
          </h1>
          
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input 
              type="email" 
              placeholder="Correo electrónico" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ marginBottom: '0' }}
            />
            <input 
              type="password" 
              placeholder="Contraseña" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ marginBottom: '10px' }}
            />
            {authError && <p style={{ color: 'var(--accent)', fontSize: '0.9rem', margin: '0 0 10px 0' }}>{authError}</p>}
            
            <button type="submit" style={{ width: '100%' }}>
              {isLogin ? "Entrar" : "Crear Cuenta"}
            </button>
          </form>

          <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <span 
              onClick={() => { setIsLogin(!isLogin); setAuthError(""); }} 
              style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
            >
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