// src/contexts/auth-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { 
  Auth, 
  User, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  verifyBeforeUpdateEmail,
  sendPasswordResetEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { auth as firebaseAuth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, displayName?: string) => Promise<User | null>;
  logIn: (email: string, password: string) => Promise<User | null>;
  logOut: () => Promise<void>;
  signInWithPhoneNumberFlow: (phoneNumber: string, appVerifier: RecaptchaVerifier) => Promise<ConfirmationResult | null>;
  confirmOtpFlow: (confirmationResult: ConfirmationResult, otp: string) => Promise<User | null>;
  updateUserProfile: (updates: { displayName?: string, email?: string }) => Promise<{ success: boolean; requiresReauth?: boolean; }>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  deleteAccount: () => Promise<{ success: boolean; requiresReauth?: boolean; }>;
  reauthenticateUser: (password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log('AuthProvider: Initializing Firebase Auth listener...');
    try {
      const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
        console.log('AuthProvider: Auth state changed:', currentUser ? 'User logged in' : 'User logged out');
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error('AuthProvider: Error setting up auth listener:', error);
      setError('Failed to initialize authentication');
      setLoading(false);
    }
  }, []);

  const signUp = async (email: string, password: string, displayName?: string): Promise<User | null> => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
        setUser(firebaseAuth.currentUser); 
      }
      toast({ title: "Sign Up Successful", description: `Welcome, ${displayName || email}!` });
      return userCredential.user;
    } catch (e: any) {
      setError(e.message);
      toast({ variant: "destructive", title: "Sign Up Error", description: e.message });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logIn = async (email: string, password: string): Promise<User | null> => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      toast({ title: "Login Successful", description: `Welcome back, ${userCredential.user.displayName || userCredential.user.email}!`});
      return userCredential.user;
    } catch (e: any) {
      setError(e.message);
      toast({ variant: "destructive", title: "Login Error", description: e.message });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logOut = async () => {
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut(firebaseAuth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (e: any) {
      setError(e.message);
      toast({ variant: "destructive", title: "Logout Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const signInWithPhoneNumberFlow = async (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const confirmationResult = await signInWithPhoneNumber(firebaseAuth, phoneNumber, appVerifier);
      toast({ title: "OTP Sent", description: "An OTP has been sent to your phone number." });
      return confirmationResult;
    } catch (e: any) {
      setError(e.message);
      console.error("Error sending OTP:", e);
      let friendlyMessage = "Failed to send OTP. Please ensure the phone number is correct and try again.";
      if ((e as any).code === 'auth/invalid-phone-number') {
        friendlyMessage = "Invalid phone number format. Please include your country code (e.g., +1XXXXXXXXXX).";
      } else if ((e as any).code === 'auth/too-many-requests') {
        friendlyMessage = "Too many requests. Please try again later.";
      }
      toast({ variant: "destructive", title: "OTP Send Error", description: friendlyMessage });
      // Ensure reCAPTCHA is reset if it was already rendered and an error occurred
      appVerifier.render().then((widgetId) => {
        // @ts-ignore // grecaptcha is available globally via Firebase
        if (typeof grecaptcha !== 'undefined' && grecaptcha.reset) {
          grecaptcha.reset(widgetId);
        }
      }).catch(resetError => console.error("Error resetting reCAPTCHA:", resetError));

      return null;
    } finally {
      setLoading(false);
    }
  };

  const confirmOtpFlow = async (confirmationResult: ConfirmationResult, otp: string): Promise<User | null> => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await confirmationResult.confirm(otp);
      toast({ title: "Phone Verification Successful", description: `Welcome!` });
      return userCredential.user;
    } catch (e: any) {
      setError(e.message);
      let friendlyMessage = "Failed to verify OTP. Please check the code and try again.";
      if ((e as any).code === 'auth/invalid-verification-code') {
        friendlyMessage = "Invalid OTP. Please try again.";
      } else if ((e as any).code === 'auth/code-expired') {
        friendlyMessage = "The OTP has expired. Please request a new one.";
      }
      toast({ variant: "destructive", title: "OTP Verification Error", description: friendlyMessage });
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  const updateUserProfile = async (updates: { displayName?: string, email?: string }): Promise<{ success: boolean; requiresReauth?: boolean; }> => {
    if (!firebaseAuth.currentUser) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "No user is currently logged in." });
      return { success: false };
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const currentUser = firebaseAuth.currentUser;
      
      if (updates.displayName !== undefined && updates.displayName !== currentUser.displayName) {
        await updateProfile(currentUser, { displayName: updates.displayName });
      }
      
      if (updates.email && updates.email !== currentUser.email) {
        await verifyBeforeUpdateEmail(currentUser, updates.email);
        toast({ title: "Verification Email Sent", description: "Please check your new email address to verify the change." });
      }
      
      await currentUser.reload();
      setUser(firebaseAuth.currentUser); 

      return { success: true };
    } catch (e: any) {
      console.error("Error updating profile:", e);
      if (e.code === 'auth/requires-recent-login') {
        return { success: false, requiresReauth: true };
      }
      
      let friendlyMessage = "Failed to update profile. Please try again.";
      if (e.code === 'auth/email-already-in-use') {
        friendlyMessage = "This email address is already in use by another account.";
      } else if (e.code === 'auth/invalid-email') {
        friendlyMessage = "The new email address is not valid.";
      }
      setError(e.message);
      toast({ variant: "destructive", title: "Profile Update Error", description: friendlyMessage, duration: 8000 });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const reauthenticateUser = async (password: string): Promise<boolean> => {
    if (!firebaseAuth.currentUser || !firebaseAuth.currentUser.email) {
      toast({ variant: "destructive", title: "Error", description: "No authenticated user found." });
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const credential = EmailAuthProvider.credential(firebaseAuth.currentUser.email, password);
      await reauthenticateWithCredential(firebaseAuth.currentUser, credential);
      toast({ title: "Re-authentication Successful", description: "You can now proceed with your changes." });
      return true;
    } catch (e: any) {
      setError(e.message);
      let friendlyMessage = "Re-authentication failed.";
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        friendlyMessage = "Incorrect password. Please try again.";
      }
      toast({ variant: "destructive", title: "Authentication Error", description: friendlyMessage });
      return false;
    } finally {
      setLoading(false);
    }
  };


  const sendPasswordReset = async (email: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      toast({ title: "Password Reset Email Sent", description: "Please check your inbox for a link to reset your password." });
      return true;
    } catch (e: any) {
      setError(e.message);
      toast({ variant: "destructive", title: "Error", description: e.message });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; requiresReauth?: boolean; }> => {
    if (!firebaseAuth.currentUser) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "No user is currently logged in." });
      return { success: false };
    }
    
    setLoading(true);
    setError(null);
    const currentUser = firebaseAuth.currentUser;
    try {
      await deleteUser(currentUser);
      toast({ title: "Account Deleted", description: "Your account has been permanently deleted." });
      return { success: true };
    } catch (e: any)
    {
      if (e.code === 'auth/requires-recent-login') {
        return { success: false, requiresReauth: true };
      }
      setError(e.message);
      toast({ variant: "destructive", title: "Deletion Error", description: "Failed to delete account. Please try again.", duration: 8000 });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };


  const value = {
    user,
    loading,
    error,
    signUp,
    logIn,
    logOut,
    signInWithPhoneNumberFlow,
    confirmOtpFlow,
    updateUserProfile,
    sendPasswordReset,
    deleteAccount,
    reauthenticateUser,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
