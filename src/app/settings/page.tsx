// src/app/settings/page.tsx
"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, UserCircle, Bell, Zap, Palette, ShieldCheck, Target, LogIn, UserPlus, LogOut, Loader2, Phone, Save, Trash2, KeyRound } from "lucide-react";
import Image from "next/image";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import LoginForm from '@/components/auth/login-form';
import SignupForm from '@/components/auth/signup-form';
import PhoneSignInForm from '@/components/auth/phone-signin-form';
import ReauthForm from '@/components/auth/reauth-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';


export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { toast } = useToast();
  const { user, loading, logOut, updateUserProfile, sendPasswordReset, deleteAccount, reauthenticateUser } = useAuth();

  const [dailyGoalInput, setDailyGoalInput] = useState<string>("");
  const [userNameInput, setUserNameInput] = useState<string>("");
  const [emailInput, setEmailInput] = useState<string>("");

  const [isProfileChanged, setIsProfileChanged] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'updateProfile' | 'deleteAccount' | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{ displayName?: string; email?: string } | null>(null);


  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialIsDark = storedTheme ? storedTheme === 'dark' : systemPrefersDark;
    setIsDarkMode(initialIsDark);
    if (initialIsDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    if (user) {
      const storedGoal = localStorage.getItem(`dailyCalorieGoal_${user.uid}`);
      setDailyGoalInput(storedGoal || "2000");
      setUserNameInput(user.displayName || "");
      setEmailInput(user.email || "");
    } else {
      setDailyGoalInput("2000"); // Default placeholder if no user
    }

  }, [user]);

  useEffect(() => {
    if (user) {
        const nameChanged = userNameInput.trim() !== (user.displayName || "");
        const emailChanged = emailInput.trim() !== (user.email || "");
        setIsProfileChanged(nameChanged || emailChanged);
    } else {
        setIsProfileChanged(false);
    }
  }, [userNameInput, emailInput, user]);

  const handleThemeToggle = (checked: boolean) => {
    setIsDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSaveGoal = () => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "Please log in to save your goals." });
      return;
    }
    const goalValue = parseInt(dailyGoalInput, 10);
    if (!isNaN(goalValue) && goalValue > 0) {
      localStorage.setItem(`dailyCalorieGoal_${user.uid}`, goalValue.toString());
      toast({ title: "Goal Saved", description: `Daily calorie goal set to ${goalValue.toLocaleString()} kcal.` });
    } else {
      toast({ variant: "destructive", title: "Invalid Goal", description: "Please enter a valid positive number for calories." });
    }
  };
  
  const handleLogout = async () => {
    await logOut();
  };
  
  const handleSaveProfile = async () => {
    if (!user) return;
    
    const updates: { displayName?: string } = {};
    
    if (userNameInput.trim() !== (user.displayName || '')) {
      updates.displayName = userNameInput.trim();
    }
    
    if (Object.keys(updates).length === 0) {
        toast({ title: "No Changes", description: "There are no changes to save." });
        return;
    }
    
    setIsSavingProfile(true);
    const result = await updateUserProfile(updates);

    if (result.success) {
      toast({ title: "Profile Updated", description: "Your profile information has been saved." });
      setIsProfileChanged(false);
    } else if (result.requiresReauth) {
      setPendingUpdate(updates);
      setPendingAction('updateProfile');
      setShowReauthModal(true);
    }
    setIsSavingProfile(false);
  };
  
  const onReauthSuccess = async () => {
    setShowReauthModal(false);

    if (pendingAction === 'updateProfile' && pendingUpdate) {
      setIsSavingProfile(true);
      const result = await updateUserProfile(pendingUpdate); 
      if (result.success) {
        toast({ title: "Profile Updated", description: "Your profile information has been successfully saved." });
        setIsProfileChanged(false);
      }
      setIsSavingProfile(false);

    } else if (pendingAction === 'deleteAccount') {
      setIsProcessingAction(true);
      await deleteAccount(); 
      setIsProcessingAction(false);
    }

    setPendingAction(null);
    setPendingUpdate(null);
  };


  const handleChangePassword = async () => {
    if (!user || !user.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'No user email found to send reset link.' });
      return;
    }
    setIsProcessingAction(true);
    await sendPasswordReset(user.email);
    setIsProcessingAction(false);
  };
  
  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsProcessingAction(true);
    const result = await deleteAccount();
    if (result.requiresReauth) {
        setPendingAction('deleteAccount');
        setShowReauthModal(true);
    }
    setIsProcessingAction(false);
  };


  if (loading && !user && mounted) { 
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center space-x-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
            <p className="text-muted-foreground">
            Manage your account, preferences, and app settings.
            </p>
        </div>
      </header>

      {!user ? (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Access NutriMe.AI</CardTitle>
            <CardDescription className="text-center">Log in or sign up to personalize your experience and save your data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login"><LogIn className="mr-2 h-4 w-4"/>Log In</TabsTrigger>
                <TabsTrigger value="signup"><UserPlus className="mr-2 h-4 w-4"/>Sign Up</TabsTrigger>
                <TabsTrigger value="phone"><Phone className="mr-2 h-4 w-4"/>Phone</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="pt-4">
                <LoginForm />
              </TabsContent>
              <TabsContent value="signup" className="pt-4">
                <SignupForm />
              </TabsContent>
              <TabsContent value="phone" className="pt-4">
                <PhoneSignInForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        // Authenticated User Settings
        <>
            <Dialog open={showReauthModal} onOpenChange={setShowReauthModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Re-authentication Required</DialogTitle>
                         <DialogDescription>
                            For your security, please confirm your password to continue.
                        </DialogDescription>
                    </DialogHeader>
                    <ReauthForm 
                        onSuccess={onReauthSuccess} 
                        onCancel={() => {
                            setShowReauthModal(false);
                            setPendingAction(null);
                            setPendingUpdate(null);
                        }}
                    />
                </DialogContent>
            </Dialog>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><UserCircle className="mr-2 h-5 w-5 text-accent" /> Profile</CardTitle>
                        <CardDescription>Your account information.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={userNameInput} onChange={(e) => setUserNameInput(e.target.value)} disabled={isSavingProfile}/>
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} disabled/>
                            <p className="text-xs text-muted-foreground mt-1">Email changes are temporarily disabled.</p>
                        </div>
                        {user.phoneNumber && (
                            <div>
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" type="tel" value={user.phoneNumber} disabled />
                            </div>
                        )}
                        <Button onClick={handleSaveProfile} className="w-full" disabled={!isProfileChanged || isSavingProfile}>
                            {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save Profile
                        </Button>
                        <Button onClick={handleLogout} variant="outline" className="w-full" disabled={loading || isSavingProfile}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <LogOut className="mr-2 h-4 w-4" /> Log Out
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5 text-accent" /> Nutrition Goals</CardTitle>
                    <CardDescription>Set your daily nutritional targets.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                    <Label htmlFor="calorie-goal">Daily Calorie Goal (kcal)</Label>
                    <Input 
                        id="calorie-goal" 
                        type="number" 
                        value={dailyGoalInput}
                        onChange={(e) => setDailyGoalInput(e.target.value)}
                        placeholder="e.g., 2000"
                    />
                    </div>
                    <Button onClick={handleSaveGoal}>Save Goal</Button>
                </CardContent>
                </Card>
                
                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Bell className="mr-2 h-5 w-5 text-accent" /> Notifications</CardTitle>
                    <CardDescription>Manage your notification preferences (placeholders).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                    <Label htmlFor="meal-reminders">Meal Log Reminders</Label>
                    <Switch id="meal-reminders" defaultChecked disabled />
                    </div>
                    <div className="flex items-center justify-between">
                    <Label htmlFor="weekly-summary">Weekly Progress Summary</Label>
                    <Switch id="weekly-summary" disabled />
                    </div>
                </CardContent>
                </Card>

                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Zap className="mr-2 h-5 w-5 text-accent" /> Integrations</CardTitle>
                    <CardDescription>Connect with health trackers (placeholders).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start" disabled>
                    <Image src="https://placehold.co/20x20.png" alt="Google Fit" width={20} height={20} className="mr-2" data-ai-hint="google fit logo" /> Connect Google Fit
                    </Button>
                    <Button variant="outline" className="w-full justify-start" disabled>
                    <Image src="https://placehold.co/20x20.png" alt="Apple Health" width={20} height={20} className="mr-2" data-ai-hint="apple logo" /> Connect Apple Health
                    </Button>
                </CardContent>
                </Card>
                
                <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5 text-accent" /> Appearance</CardTitle>
                    <CardDescription>Customize the look and feel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                    <Label htmlFor="dark-mode">Dark Mode</Label>
                    {mounted ? (
                        <Switch 
                        id="dark-mode" 
                        checked={isDarkMode}
                        onCheckedChange={handleThemeToggle}
                        />
                    ) : (
                        <Switch id="dark-mode" disabled /> 
                    )}
                    </div>
                </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-accent" /> Account & Privacy</CardTitle>
                    <CardDescription>Manage your account security and data privacy.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-start space-y-3">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="link" className="p-0 h-auto text-primary" disabled>
                                <KeyRound className="mr-2 h-4 w-4"/> Change Password
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Change Password?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    We will send a password reset link to your registered email address ({user.email}). Are you sure you want to proceed?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleChangePassword}>Send Reset Link</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    
                    <Button variant="link" className="p-0 h-auto text-primary" disabled>Privacy Policy</Button>
                    
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="link" className="p-0 h-auto text-destructive" disabled={isProcessingAction}>
                                <Trash2 className="mr-2 h-4 w-4"/> Delete Account
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">
                                    {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Yes, Delete Account
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
                </Card>
            </div>
        </>
      )}
      
      {user && (
        <>
          <Separator />
          <div className="text-center text-muted-foreground text-sm">
            <p>NutriMe.AI Version 1.0.0 (Authenticated User)</p>
            <p>For support, contact: your-support-email@domain.com</p>
          </div>
        </>
      )}
    </div>
  );
}
