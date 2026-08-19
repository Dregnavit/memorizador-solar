// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyB1o0X5IaYiQEnp7c-jl8wS2Felld4VqQ8",
  authDomain: "memorizador-solar.firebaseapp.com",
  projectId: "memorizador-solar",
  storageBucket: "memorizador-solar.firebasestorage.app",
  messagingSenderId: "1064779879671",
  appId: "1:1064779879671:web:19c9e7a44a60c726652ff2",
  measurementId: "G-RXTG0T8MY7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exportar la autenticación y la base de datos para usarlas en nuestra App
export const auth = getAuth(app);
export const db = getFirestore(app);