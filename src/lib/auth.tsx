import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "@tanstack/react-router";

import { auth, googleProvider, db, testFirestoreConnection } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
});

async function checkIsAdmin(u: User): Promise<boolean> {
  try {
    const tokenResult = await u.getIdTokenResult();
    if (tokenResult.claims.admin === true) {
      return true;
    }
    const adminRef = doc(db, "admins", u.uid);
    const snap = await getDoc(adminRef);
    return snap.exists();
  } catch (err) {
    console.warn("Could not check admin status:", err);
    return false;
  }
}

async function ensureUserProfile(u: User, extraName?: { first: string; last: string }) {
  try {
    const ref = doc(db, "profiles", u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const displayNameParts = (u.displayName || "").trim().split(" ");
      const firstName = extraName?.first || displayNameParts[0] || "Foydalanuvchi";
      const lastName = extraName?.last || displayNameParts.slice(1).join(" ") || "";

      await setDoc(ref, {
        id: u.uid,
        first_name: firstName,
        last_name: lastName,
        bio: "Assalomu alaykum! PeerSwap-da yangi ko‘nikmalarni o‘rganish va o‘rgatishga tayyorman.",
        teach: ["Frontend", "Ingliz tili"],
        learn: ["Python", "UI/UX Dizayn"],
        plan: "free",
        peercoins: 10,
        weekly_lessons_used: 0,
        is_active: true,
        is_demo: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("Could not auto-create profile:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const isUserAdmin = await checkIsAdmin(nextUser);
        setIsAdmin(isUserAdmin);
        await ensureUserProfile(nextUser);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    const res = await signInWithPopup(auth, googleProvider);
    if (res.user) {
      await ensureUserProfile(res.user);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    firstName: string,
    lastName: string,
  ) => {
    const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (res.user) {
      try {
        await updateProfile(res.user, {
          displayName: `${firstName} ${lastName}`.trim(),
        });
      } catch {
        // ignore
      }
      await ensureUserProfile(res.user, { first: firstName, last: lastName });
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Redirects to /login once we know there is no session. */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, user, navigate]);

  return { user, loading };
}

/** Redirects to /login if no session, or to /dashboard if user is not an admin. */
export function useRequireAdmin() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate({ to: "/login" });
      } else if (!isAdmin) {
        navigate({ to: "/dashboard" });
      }
    }
  }, [loading, user, isAdmin, navigate]);

  return { user, loading, isAdmin };
}
