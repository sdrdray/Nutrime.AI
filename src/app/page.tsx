// src/app/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Utensils, CalendarDays, BarChart3, Lightbulb, Loader2, Settings, LogIn } from "lucide-react"; // Added LogIn
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context'; // Added useAuth

const dailyTips = [
  "Stay hydrated! Drinking enough water can boost your metabolism and help with digestion.",
  "Incorporate a variety of colorful fruits and vegetables into your daily meals for a wide range of nutrients.",
  "Prioritize whole grains like oats, quinoa, and brown rice over refined grains for sustained energy.",
  "Include lean protein sources such as chicken, fish, beans, or tofu in every meal to support muscle health.",
  "Don't skip breakfast! A balanced breakfast can kickstart your metabolism and improve focus.",
  "Practice mindful eating: pay attention to your food, chew slowly, and savor each bite.",
  "Limit processed foods, which are often high in unhealthy fats, sugar, and sodium.",
  "Read food labels carefully to understand ingredients and nutritional content.",
  "Control portion sizes to manage calorie intake effectively.",
  "Get enough sleep (7-9 hours) as it plays a crucial role in hormone regulation and overall health.",
  "Incorporate regular physical activity into your routine, aiming for at least 150 minutes of moderate-intensity exercise per week.",
  "Choose healthy fats like those found in avocados, nuts, seeds, and olive oil.",
  "Reduce your intake of sugary drinks like sodas and fruit juices; opt for water instead.",
  "Plan your meals ahead of time to make healthier choices and avoid impulsive eating.",
  "Cook at home more often to have better control over ingredients and cooking methods.",
  "Listen to your body's hunger and fullness cues.",
  "Add herbs and spices to flavor your food instead of relying on salt.",
  "Make half your plate vegetables at lunch and dinner.",
  "Snack smart: choose nutrient-dense options like fruits, nuts, or yogurt.",
  "Don't be afraid of healthy carbs; they are your body's primary energy source.",
  "Include fiber-rich foods in your diet to promote digestive health and satiety.",
  "Limit alcohol consumption as it can contribute empty calories and affect health.",
  "Find healthy ways to manage stress, as chronic stress can impact eating habits.",
  "Start your day with a glass of water to rehydrate your body.",
  "Try a new healthy recipe each week to keep your meals exciting.",
  "Eat slowly. It takes about 20 minutes for your brain to register fullness.",
  "Keep a food journal for a week to become more aware of your eating patterns.",
  "Opt for grilling, baking, or steaming over frying when cooking.",
  "Share your health goals with a friend or family member for support and accountability.",
  "Focus on progress, not perfection. Small, consistent changes lead to big results.",
  "Celebrate your non-scale victories, like having more energy or clothes fitting better."
];

const DEFAULT_CALORIE_GOAL = 2000;

export default function DashboardPage() {
  const [currentTip, setCurrentTip] = useState<string>("Loading tip...");
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth(); // Get user and auth loading state

  const [calorieGoal, setCalorieGoal] = useState<number>(DEFAULT_CALORIE_GOAL);
  const [consumedCaloriesToday, setConsumedCaloriesToday] = useState<number>(0);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [isLoadingProgress, setIsLoadingProgress] = useState<boolean>(true);
  const [isGoalSet, setIsGoalSet] = useState<boolean>(false);

  useEffect(() => {
    const dayOfMonth = new Date().getDate();
    setCurrentTip(dailyTips[(dayOfMonth - 1) % dailyTips.length]);
  }, []);

  useEffect(() => {
    const loadGoal = () => {
      if (user) {
        const storedGoal = localStorage.getItem(`dailyCalorieGoal_${user.uid}`);
        if (storedGoal) {
          setCalorieGoal(parseInt(storedGoal, 10));
          setIsGoalSet(true);
        } else {
          setCalorieGoal(DEFAULT_CALORIE_GOAL);
          setIsGoalSet(false);
        }
      } else {
        // If no user, use default and mark as not specifically set by this (non-existent) user
        setCalorieGoal(DEFAULT_CALORIE_GOAL);
        setIsGoalSet(false);
      }
    };
    
    if (!authLoading) { // Only load goal once auth state is resolved
        loadGoal();
    }

    // Listen for changes to local storage (e.g., if goal updated in settings)
    const handleStorageChange = (event: StorageEvent) => {
      if (user && event.key === `dailyCalorieGoal_${user.uid}`) {
        if (event.newValue) {
          setCalorieGoal(parseInt(event.newValue, 10));
          setIsGoalSet(true);
        } else {
          setCalorieGoal(DEFAULT_CALORIE_GOAL);
          setIsGoalSet(false);
        }
      } else if (!user && event.key && event.key.startsWith('dailyCalorieGoal_')) {
          // If user logs out, reset to default
          setCalorieGoal(DEFAULT_CALORIE_GOAL);
          setIsGoalSet(false);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, authLoading]);


  useEffect(() => {
    const fetchTodaysProgress = async () => {
      if (!user) { // If no user, don't fetch progress and show defaults
        setIsLoadingProgress(false);
        setConsumedCaloriesToday(0);
        setProgressPercentage(0);
        return;
      }
      
      setIsLoadingProgress(true);
      try {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const startOfTodayTimestamp = Timestamp.fromDate(startOfToday);
        const endOfTodayTimestamp = Timestamp.fromDate(endOfToday);

        const q = query(
          collection(firestore, "mealLogs"),
          where("userId", "==", user.uid), // Fetch only for the current user
          where("loggedAt", ">=", startOfTodayTimestamp),
          where("loggedAt", "<=", endOfTodayTimestamp)
        );

        const querySnapshot = await getDocs(q);
        let totalCalories = 0;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.estimatedCalories && typeof data.estimatedCalories === 'number') {
            totalCalories += data.estimatedCalories;
          }
        });
        setConsumedCaloriesToday(totalCalories);

        if (calorieGoal > 0) {
          const percentage = Math.min(Math.round((totalCalories / calorieGoal) * 100), 100);
          setProgressPercentage(percentage);
        } else {
          setProgressPercentage(0);
        }

      } catch (error) {
        console.error("Error fetching today's progress: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch daily progress." });
      }
      setIsLoadingProgress(false);
    };

    if (!authLoading) { // Only fetch progress once auth state is resolved
        fetchTodaysProgress();
    }
  }, [user, calorieGoal, toast, authLoading]);


  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {user ? `Welcome back, ${user.displayName || user.email}!` : "Welcome to NutriMe.AI"}
        </h1>
        <p className="text-muted-foreground">
          {user ? "Your personalized nutrition and meal planning assistant." : "Log in to unlock your personalized experience and features."}
        </p>
      </header>

      {!user && (
        <Card className="shadow-lg bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center text-primary"><LogIn className="mr-3 h-6 w-6"/>Access Your Personalized Dashboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-muted-foreground">
                    Please log in or sign up to access all features of NutriMe.AI, including personalized tracking, meal planning, and saved data.
                </p>
                <Button asChild>
                    <Link href="/settings">
                        Go to Login / Sign Up
                    </Link>
                </Button>
            </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Calorie Progress</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {(isLoadingProgress || authLoading) && !user ? ( // Show loader if auth is still loading for an unauth user
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !user ? (
                <>
                    <div className="text-2xl font-bold text-primary">--%</div>
                    <p className="text-xs text-muted-foreground">
                        Log in to track your progress.
                    </p>
                    <Progress value={0} className="mt-2 h-2" />
                </>
            ) : isLoadingProgress ? (
                <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ): (
              <>
                <div className="text-2xl font-bold text-primary">{progressPercentage}%</div>
                <p className="text-xs text-muted-foreground">
                  Consumed: {consumedCaloriesToday.toLocaleString()} / {calorieGoal.toLocaleString()} kcal
                </p>
                <Progress value={progressPercentage} className="mt-2 h-2" />
                {!isGoalSet && user && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Default goal shown. <Link href="/settings" className="underline text-primary hover:text-primary/80">Set your goal in Settings</Link>.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start" variant="outline" disabled={!user}>
              <Link href="/log-food">
                <Utensils className="mr-2 h-4 w-4" /> Log a Meal
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" disabled={!user}>
              <Link href="/meal-planner">
                <CalendarDays className="mr-2 h-4 w-4" /> Plan Your Meals
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tip of the Day</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              {currentTip}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Explore Recipes</CardTitle>
            <CardDescription>Discover new and adaptive recipes tailored to your needs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Image 
              src="https://images.unsplash.com/photo-1651256785597-4efe48fd71f9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxN3x8UkVDSVBFU3xlbnwwfHx8fDE3NTMyOTc1MzV8MA&ixlib=rb-4.1.0&q=80&w=1080" 
              alt="Healthy Food" 
              width={600} 
              height={400} 
              className="mb-4 rounded-lg object-cover"
              data-ai-hint="healthy food" 
            />
            <Button asChild disabled={!user}>
              <Link href="/recipes">
                Find Recipes
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Check Your Pantry</CardTitle>
            <CardDescription>Manage your pantry inventory and see what you can cook with "My Fridge" AI Chef.</CardDescription>
          </CardHeader>
          <CardContent>
             <Image 
              src="https://images.unsplash.com/photo-1590311824865-bac58a024e51?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw2fHxQQU5UUll8ZW58MHx8fHwxNzUzMjk3NDcxfDA&ixlib=rb-4.1.0&q=80&w=1080" 
              alt="Pantry Items" 
              width={600} 
              height={400} 
              className="mb-4 rounded-lg object-cover"
              data-ai-hint="pantry kitchen" 
            />
            <div className="flex space-x-2">
              <Button asChild variant="secondary" disabled={!user}>
                <Link href="/pantry">
                  Go to Pantry
                </Link>
              </Button>
              <Button asChild disabled={!user}>
                <Link href="/my-fridge">
                  AI Fridge Chef
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
