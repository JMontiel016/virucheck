/**
 * ============================================================================
 * CONTEXTO DE AUTENTICACIÓN - VIRUCHECK
 * ============================================================================
 * Gestiona la sesión global de Firebase, perfiles de Firestore y soporte para Google.
 */

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  ActionCodeSettings,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { UserProfile } from "@/types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<{ user: User; isNewUser: boolean }>; // Devuelve el objeto user y el booleano isNewUser
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas
const SESSION_TIMESTAMP_KEY = "virucheck_session_time";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSessionExpiration = async () => {
    const loginTime = localStorage.getItem(SESSION_TIMESTAMP_KEY);
    if (loginTime) {
      const elapsed = Date.now() - parseInt(loginTime, 10);
      if (elapsed > SESSION_MAX_AGE_MS) {
        localStorage.removeItem(SESSION_TIMESTAMP_KEY);
        await signOut(auth);
        setUser(null);
        setProfile(null);
      }
    }
  };

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        } as UserProfile);
      }
    } catch (err) {
      console.error("Error al cargar perfil:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await checkSessionExpiration();
        setUser(currentUser);
        await fetchProfile(currentUser.uid);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    await fetchProfile(cred.user.uid);
  };

  const registerWithEmail = async (name: string, email: string, pass: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });

    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName: name,
      createdAt: new Date(),
    };

    await setDoc(doc(db, "users", cred.user.uid), {
      ...newProfile,
      createdAt: serverTimestamp(),
    });

    localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    setProfile(newProfile);
  };

  /**
   * loginWithGoogle verificado: comprueba si el usuario existe en Firestore
   * para determinar si es un usuario nuevo y obligarlo a registrar su contraseña.
   */
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);

    const docRef = doc(db, "users", cred.user.uid);
    const docSnap = await getDoc(docRef);

    let isNewUser = false;

    if (!docSnap.exists()) {
      isNewUser = true; // Se marca como nuevo para que el Login lo intercepte
    } else {
      const data = docSnap.data();
      setProfile({
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
      } as UserProfile);
    }

    localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    return { user: cred.user, isNewUser };
  };

  const resetPassword = async (email: string) => {
    try {
      auth.languageCode = "es";
      const currentOrigin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "http://localhost:3001";

      const actionCodeSettings: ActionCodeSettings = {
        url: `${currentOrigin}/auth/action`,
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        throw new Error("El correo ingresado no se encuentra registrado en el sistema.");
      } else if (err.code === "auth/invalid-email") {
        throw new Error("El formato del correo electrónico es inválido.");
      } else {
        throw err;
      }
    }
  };

  const logout = async () => {
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);