import { GoogleAuthProvider, GithubAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export async function signIn(providerType: 'google' | 'github' = 'google') {
  try {
    const provider = providerType === 'google' ? googleProvider : githubProvider;
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if profile exists
    const profileRef = doc(db, 'profiles', user.uid);
    try {
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        return { user, isNew: true };
      }

      return { user, isNew: false, profile: profileSnap.data() };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `profiles/${user.uid}`);
      return { user, isNew: true };
    }
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

export async function createProfile(uid: string, data: any) {
  const profileRef = doc(db, 'profiles', uid);
  try {
    await setDoc(profileRef, {
      uid,
      createdAt: serverTimestamp(),
      ...data
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `profiles/${uid}`);
  }
}

export async function updateProfile(uid: string, data: any) {
  const profileRef = doc(db, 'profiles', uid);
  try {
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    await setDoc(profileRef, cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${uid}`);
  }
}

export async function getProfile(uid: string) {
  const profileRef = doc(db, 'profiles', uid);
  try {
    const snap = await getDoc(profileRef);
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `profiles/${uid}`);
    return null;
  }
}
