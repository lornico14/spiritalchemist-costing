import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('openid');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');

export const googleSignIn = async (): Promise<{ firebaseUser: FirebaseUser } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    return { firebaseUser: result.user };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const logout = async () => {
  await auth.signOut();
};
