import { initializeApp } from 'firebase/app';

import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User as FirebaseUser,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';

import { getFirestore } from 'firebase/firestore';

import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

/*
 * Utilise la base Firestore indiquée dans la configuration
 * lorsqu'elle existe.
 */
export const db_fs = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Auth error (Google):', error);
    throw error;
  }
};

export const signInWithFacebook = async () => {
  try {
    const result = await signInWithPopup(auth, facebookProvider);
    return result.user;
  } catch (error) {
    console.error('Auth error (Facebook):', error);
    throw error;
  }
};

export const setupRecaptcha = (containerId: string) => {
  const existingVerifier = (window as any).recaptchaVerifier;

  if (existingVerifier) {
    return existingVerifier;
  }

  const verifier = new RecaptchaVerifier(
    auth,
    containerId,
    {
      size: 'invisible',
      callback: () => {
        console.log('Recaptcha solved');
      }
    }
  );

  (window as any).recaptchaVerifier = verifier;

  return verifier;
};

export const sendSmsCode = async (
  phoneNumber: string,
  appVerifier: any
): Promise<ConfirmationResult> => {
  try {
    return await signInWithPhoneNumber(
      auth,
      phoneNumber,
      appVerifier
    );
  } catch (error) {
    console.error('SMS sending error:', error);
    throw error;
  }
};

export const ensureFirebaseAuth =
  (): Promise<FirebaseUser | null> => {
    return new Promise((resolve) => {
      let resolved = false;

      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          if (!resolved) {
            resolved = true;
            unsubscribe();
            resolve(user);
          }
        },
        (error) => {
          console.warn(
            'Firebase Auth state error:',
            error
          );

          if (!resolved) {
            resolved = true;
            unsubscribe();
            resolve(null);
          }
        }
      );
    });
  };
