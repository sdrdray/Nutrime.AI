// src/app/meal-planner/page.tsx
"use client";

import React, { useState, useTransition, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
// import { Label } from '@/components/ui/label'; // Not directly used
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { handlePersonalizedMealPlanner, handleGenerateMealPrepPlan, handleSavePrepPlan } from '@/lib/actions';
import type { PersonalizedMealPlannerOutput } from '@/ai/flows/personalized-meal-planner';
import type { MealPrepPlannerOutput } from '@/ai/flows/meal-prep-planner-flow';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, XCircle, History, Trash2, ListPlus, CheckCircle, CookingPot } from 'lucide-react';
import { firestore } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, Timestamp, deleteDoc, doc, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';

const mealPlannerSchema = z.object({
  dietaryNeeds: z.string().min(3, "Dietary needs are required."),
  healthGoals: z.string().min(3, "Health goals are required."),
  tastePreferences: z.string().min(3, "Taste preferences are required."),
  cookingTime: z.string().min(2, "Cooking time is required (e.g., 30 mins)."),
  budget: z.string().min(3, "Budget is required (e.g., low, medium)."),
  seasonalProduce: z.string().min(3, "Seasonal produce is required."),
});

type MealPlannerFormValues = z.infer<typeof mealPlannerSchema>;

interface UserMealPlan {
  id: string;
  planContent: string;
  preferences: MealPlannerFormValues;
  createdAt: Timestamp;
  userId: string;
}

interface GroceryItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
}

// State for prep plans, keyed by the meal plan ID
type PrepPlanState = {
  [planId: string]: {
    isLoading: boolean;
    data: MealPrepPlannerOutput | null;
    error: string | null;
    isSaving?: boolean;
    isSaved?: boolean;
  }
}

export default function MealPlannerPage() {
  const { user } = useAuth();
  const [isGeneratingPlan, startGeneratingPlanTransition] = useTransition();
  const [isSavingPlan, startSavingPlanTransition] = useTransition();
  const [mealPlan, setMealPlan] = useState<PersonalizedMealPlannerOutput | null>(null);
  const { toast } = useToast();

  const [savedPlans, setSavedPlans] = useState<UserMealPlan[]>([]);
  const [isLoadingSavedPlans, setIsLoadingSavedPlans] = useState(true);
  const [isDeletingPlanId, setIsDeletingPlanId] = useState<string | null>(null);

  const [parsedShoppingList, setParsedShoppingList] = useState<string[]>([]);
  const [isAddingToGroceryList, startAddingToGroceryListTransition] = useTransition();
  const [addedShoppingListItems, setAddedShoppingListItems] = useState<string[]>([]);

  const [prepPlans, setPrepPlans] = useState<PrepPlanState>({});


  const form = useForm<MealPlannerFormValues>({
    resolver: zodResolver(mealPlannerSchema),
    defaultValues: {
      dietaryNeeds: "",
      healthGoals: "",
      tastePreferences: "",
      cookingTime: "30 minutes",
      budget: "medium",
      seasonalProduce: "Any available",
    },
  });

  useEffect(() => {
    const fetchSavedPlans = async () => {
      if (!user) {
        setIsLoadingSavedPlans(false);
        setSavedPlans([]);
        return;
      }
      setIsLoadingSavedPlans(true);
      try {
        const plansCollectionRef = collection(firestore, "userMealPlans");
        const q = query(plansCollectionRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const plans: UserMealPlan[] = [];
        querySnapshot.forEach((doc) => {
          plans.push({ id: doc.id, ...doc.data() } as UserMealPlan);
        });
        setSavedPlans(plans);
      } catch (error) {
        console.error("Error fetching saved meal plans: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch saved meal plans." });
      }
      setIsLoadingSavedPlans(false);
    };
    fetchSavedPlans();
  }, [toast, user]);

  const parseShoppingListFromPlan = (planText: string): string[] => {
    const shoppingListItems: string[] = [];
    const lines = planText.split('\n');
    let inShoppingListSection = false;
    const majorSectionKeywords = ["notes:", "day ", "instructions:", "preparation:", "macros:", "calories:", "summary:"];

    for (const line of lines) {
        const trimmedLine = line.trim();
        const lowerTrimmedLine = trimmedLine.toLowerCase();

        if (!inShoppingListSection) {
            if (lowerTrimmedLine.includes("shopping list")) {
                inShoppingListSection = true;
                // Check if the header line itself contains items (e.g. "Shopping List: eggs, milk")
                const headerItemsPart = lowerTrimmedLine.split("shopping list")[1]?.replace(/^[:\s\(]*(general)?[\)\s:]*/, '').trim();
                if (headerItemsPart) {
                    const potentialItemsFromHeader = headerItemsPart.split(/[,;]/)
                        .map(s => s.replace(/(\band\b|\bor\b)/gi, ',').trim()) // Replace 'and'/'or' with comma for further splitting
                        .flatMap(s => s.split(',')) // Split again if 'and'/'or' were present
                        .map(s => s.trim())
                        .filter(s => s.length > 2 && !s.match(/^\s*\(.*\)\s*$/) && !s.endsWith(":") && !majorSectionKeywords.some(keyword => s.toLowerCase().startsWith(keyword)));
                    
                    potentialItemsFromHeader.forEach(item => {
                        if (item) {
                           shoppingListItems.push(item.replace(/[*-\d\.]+\s*/, '').trim());
                        }
                    });
                }
                continue; 
            }
        }

        if (inShoppingListSection) {
            if (trimmedLine === "") { 
                // Let empty lines pass, they might just be formatting within the list
                continue;
            }
            if (majorSectionKeywords.some(keyword => lowerTrimmedLine.startsWith(keyword))) {
                inShoppingListSection = false; 
                break;
            }

            if (trimmedLine.endsWith(':')) { // Likely a category header
                continue; 
            }
            
            const itemMarkerRegex = /^(\* |- |\d+\.\s)/;
            let baseItemText = trimmedLine;
            if (itemMarkerRegex.test(trimmedLine)) {
                baseItemText = trimmedLine.replace(itemMarkerRegex, '').trim();
            }

            // Split by common delimiters like comma, semicolon, or " and "
            const potentialItems = baseItemText.split(/[,;]|\s+and\s+/)
                .map(item => item.trim())
                .filter(item => item && item.length > 2 && !item.toLowerCase().includes("e.g.") && !item.toLowerCase().includes("optional") && !item.endsWith(":") && !majorSectionKeywords.some(keyword => item.toLowerCase().startsWith(keyword)) && !/^\d+$/.test(item) && !item.match(/^\s*\(.*\)\s*$/));

            potentialItems.forEach(item => {
                // Remove any leftover list markers if the line didn't start with one but contained it
                const cleanedItem = item.replace(itemMarkerRegex, '').trim();
                if (cleanedItem.length > 2) { // Final check for length
                    shoppingListItems.push(cleanedItem);
                }
            });
        }
    }
    
    const uniqueItems = Array.from(new Set(shoppingListItems.map(item => item.toLowerCase())))
                           .map(lowerItem => shoppingListItems.find(item => item.toLowerCase() === lowerItem)!)
                           .filter(item => item && item.trim() !== "" && item.trim().length > 2); // Ensure not empty and reasonably long
    return uniqueItems;
  };


  useEffect(() => {
    if (mealPlan?.mealPlan) {
      const items = parseShoppingListFromPlan(mealPlan.mealPlan);
      setParsedShoppingList(items);
      setAddedShoppingListItems([]); // Reset for new plan
    } else {
      setParsedShoppingList([]); // Clear if no meal plan or plan cleared
    }
  }, [mealPlan]); // Re-run when mealPlan (the AI output) changes


  const onGenerateSubmit: SubmitHandler<MealPlannerFormValues> = (data) => {
    startGeneratingPlanTransition(async () => {
      setMealPlan(null); // Clear previous plan first
      setParsedShoppingList([]);
      setAddedShoppingListItems([]);
      try {
        const result = await handlePersonalizedMealPlanner(data);
        setMealPlan(result); // This will trigger the useEffect above to parse the list
        toast({ title: "Meal Plan Generated!", description: "Your personalized meal plan is ready." });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: (error as Error).message });
        console.error(error);
      }
    });
  };

  const handleSaveMealPlan = async () => {
    if (!mealPlan || !mealPlan.mealPlan) {
      toast({ variant: "destructive", title: "No Plan", description: "There is no meal plan to save." });
      return;
    }
    if (!user) {
        toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to save a plan." });
        return;
    }
    startSavingPlanTransition(async () => {
      try {
        const currentPreferences = form.getValues();
        const docRef = await addDoc(collection(firestore, "userMealPlans"), {
          planContent: mealPlan.mealPlan,
          preferences: currentPreferences,
          createdAt: serverTimestamp(),
          userId: user.uid,
        });
        const newPlanForState : UserMealPlan = {
            id: docRef.id,
            planContent: mealPlan.mealPlan,
            preferences: currentPreferences,
            createdAt: Timestamp.now(),
            userId: user.uid,
        };
        setSavedPlans(prevPlans => [newPlanForState, ...prevPlans].sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
        toast({ title: "Meal Plan Saved!", description: "Your meal plan has been saved to your records." });
      } catch (error) {
        console.error("Error saving meal plan: ", error);
        toast({ variant: "destructive", title: "Save Error", description: "Could not save your meal plan." });
      }
    });
  };

  const handleClearMealPlan = () => {
    setMealPlan(null); // This will trigger the useEffect to clear parsedShoppingList
    toast({ title: "Meal Plan Cleared", description: "The generated meal plan has been cleared from view." });
  };

  const handleDeletePlan = async (planId: string) => {
    setIsDeletingPlanId(planId);
    try {
      await deleteDoc(doc(firestore, "userMealPlans", planId));
      setSavedPlans(prevPlans => prevPlans.filter(p => p.id !== planId));
      toast({ title: "Plan Deleted", description: "The meal plan has been successfully deleted." });
    } catch (error) {
      console.error("Error deleting meal plan: ", error);
      toast({ variant: "destructive", title: "Delete Error", description: "Could not delete the meal plan." });
    }
    setIsDeletingPlanId(null);
  };

  const handleAddItemsToGroceryList = async () => {
    if (parsedShoppingList.length === 0) {
      toast({ title: "No Items", description: "No shopping list items were identified to add." });
      return;
    }
    if (!user) {
        toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to add items." });
        return;
    }
    startAddingToGroceryListTransition(async () => {
      let itemsAddedCount = 0;
      const newAddedItemsState: string[] = [...addedShoppingListItems]; // To update state after loop
      try {
        const groceryItemsCollectionRef = collection(firestore, "groceryItems");
        // Fetch existing grocery items for duplicate checking
        const currentGroceryItemsSnapshot = await getDocs(query(groceryItemsCollectionRef, where("userId", "==", user.uid)));
        const currentGroceryItemNames = currentGroceryItemsSnapshot.docs.map(d => (d.data().name as string).toLowerCase());

        for (const item of parsedShoppingList) {
          const normalizedItemName = item.toLowerCase();
          if (addedShoppingListItems.includes(normalizedItemName)) continue; // Already processed in this session for this plan
          
          if (!currentGroceryItemNames.includes(normalizedItemName)) {
            await addDoc(groceryItemsCollectionRef, {
              name: item, // Store with original casing
              category: "From Meal Plan",
              checked: false,
              userId: user.uid,
            });
            itemsAddedCount++;
          }
          newAddedItemsState.push(normalizedItemName);
        }
        setAddedShoppingListItems(newAddedItemsState);
        if (itemsAddedCount > 0) {
          toast({ title: "Grocery List Updated", description: `${itemsAddedCount} new item(s) added to your grocery list.` });
        } else {
          toast({ title: "Grocery List Synced", description: "All identified items were already in your grocery list or have now been processed." });
        }
      } catch (error) {
        console.error("Error adding items to grocery list: ", error);
        toast({ variant: "destructive", title: "Grocery List Error", description: "Could not add items to your grocery list." });
      }
    });
  };

  const handleGeneratePrepPlan = async (plan: UserMealPlan) => {
    setPrepPlans(prev => ({ ...prev, [plan.id]: { isLoading: true, data: null, error: null } }));

    try {
      const result = await handleGenerateMealPrepPlan({ mealPlan: plan.planContent });
      setPrepPlans(prev => ({ ...prev, [plan.id]: { isLoading: false, data: result, error: null } }));
      toast({ title: "Prep Plan Generated!", description: "Your meal prep strategy is ready." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setPrepPlans(prev => ({ ...prev, [plan.id]: { isLoading: false, data: null, error: errorMessage } }));
      toast({ variant: "destructive", title: "Prep Plan Error", description: errorMessage });
    }
  };

  const onSavePrepPlan = async (plan: UserMealPlan) => {
      if (!user) {
          toast({ variant: "destructive", title: "Not Logged In", description: "You must log in to save a prep plan." });
          return;
      }
      const prepPlanData = prepPlans[plan.id]?.data;
      if (!prepPlanData) {
          toast({ variant: "destructive", title: "No Prep Plan", description: "No prep plan has been generated to save." });
          return;
      }
      
      setPrepPlans(prev => ({ ...prev, [plan.id]: { ...prev[plan.id], isSaving: true } }));
      
      try {
          const result = await handleSavePrepPlan({
              userId: user.uid,
              originalMealPlanId: plan.id,
              prepPlan: prepPlanData,
          });

          if (result.success) {
              toast({ title: "Prep Plan Saved!", description: "Your prep plan has been saved." });
              setPrepPlans(prev => ({ ...prev, [plan.id]: { ...prev[plan.id], isSaving: false, isSaved: true } }));
          } else {
              toast({ variant: "destructive", title: "Save Error", description: result.message });
              setPrepPlans(prev => ({ ...prev, [plan.id]: { ...prev[plan.id], isSaving: false } }));
          }
      } catch(error) {
          console.error("Error during save prep plan call:", error);
          toast({ variant: "destructive", title: "Client Error", description: "An unexpected error occurred while trying to save." });
          setPrepPlans(prev => ({ ...prev, [plan.id]: { ...prev[plan.id], isSaving: false } }));
      }
  };


  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Personalized Meal Planner</h1>
        <p className="text-muted-foreground">
          Craft your perfect meal plan based on your unique preferences and goals.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Your Preferences</CardTitle>
          <CardDescription>Fill in the details below to generate a meal plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onGenerateSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="dietaryNeeds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dietary Needs (e.g., vegetarian, gluten-free)</FormLabel>
                    <FormControl>
                      <Input placeholder="Vegetarian, nut-free" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="healthGoals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Health Goals (e.g., weight loss, muscle gain)</FormLabel>
                    <FormControl>
                      <Input placeholder="Weight loss, more energy" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tastePreferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taste Preferences (e.g., likes spicy, dislikes seafood)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Loves Italian food, prefers chicken over fish" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="cookingTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Cooking Time per Meal</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 30 minutes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grocery Budget</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., low, medium, high" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="seasonalProduce"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seasonal Produce Available</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., summer berries, winter squash" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isGeneratingPlan} className="w-full md:w-auto">
                {isGeneratingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Meal Plan
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isGeneratingPlan && (
        <div className="flex items-center justify-center rounded-lg border p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Generating your meal plan...</p>
        </div>
      )}

      {mealPlan && !isGeneratingPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Your Generated Meal Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted mb-4">
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                {mealPlan.mealPlan}
                </pre>
            </ScrollArea>
            <div className="mt-4 flex space-x-2">
              <Button onClick={handleSaveMealPlan} disabled={isSavingPlan}>
                {isSavingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Plan
              </Button>
              <Button variant="outline" onClick={handleClearMealPlan} disabled={isSavingPlan}>
                <XCircle className="mr-2 h-4 w-4" />
                Clear Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {parsedShoppingList.length > 0 && !isGeneratingPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Identified Shopping List Items</CardTitle>
            <CardDescription>
              Review these items parsed from your meal plan. Click to add them to your main grocery list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] border rounded-md p-2 mb-4">
                <ul className="space-y-1">
                {parsedShoppingList.map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground p-1 flex justify-between items-center">
                        <span>{item}</span>
                        {addedShoppingListItems.includes(item.toLowerCase()) && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </li>
                ))}
                </ul>
            </ScrollArea>
            <Button onClick={handleAddItemsToGroceryList} disabled={isAddingToGroceryList || parsedShoppingList.every(item => addedShoppingListItems.includes(item.toLowerCase()))}>
              {isAddingToGroceryList ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListPlus className="mr-2 h-4 w-4" />}
              {parsedShoppingList.every(item => addedShoppingListItems.includes(item.toLowerCase())) ? "All Items Processed" : "Add Items to Grocery List"}
            </Button>
            {isAddingToGroceryList && <p className="text-sm text-muted-foreground mt-2">Adding items...</p>}
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5 text-primary" /> Your Saved Meal Plans</CardTitle>
          <CardDescription>Review your previously saved meal plans and generate prep strategies.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSavedPlans ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
              <p>Loading saved plans...</p>
            </div>
          ) : savedPlans.length === 0 ? (
            <p className="text-muted-foreground">You haven't saved any meal plans yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {savedPlans.map((plan) => (
                <AccordionItem value={plan.id} key={plan.id}>
                  <AccordionTrigger>
                    <div className="flex-1 text-left">
                        Saved on: {plan.createdAt ? format(plan.createdAt.toDate(), "PPPp") : "Date not available"}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-3">
                        <div>
                            <h4 className="font-semibold text-sm">Preferences Used:</h4>
                            <ul className="list-disc pl-5 text-xs text-muted-foreground">
                                <li>Dietary Needs: {plan.preferences.dietaryNeeds}</li>
                                <li>Health Goals: {plan.preferences.healthGoals}</li>
                                <li>Taste Preferences: {plan.preferences.tastePreferences}</li>
                                <li>Cooking Time: {plan.preferences.cookingTime}</li>
                                <li>Budget: {plan.preferences.budget}</li>
                                <li>Seasonal Produce: {plan.preferences.seasonalProduce}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm">Meal Plan:</h4>
                             <ScrollArea className="h-[200px] w-full rounded-md border p-3 bg-muted/50 mt-1">
                                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                                    {plan.planContent}
                                </pre>
                            </ScrollArea>
                        </div>
                         <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeletePlan(plan.id)}
                            disabled={isDeletingPlanId === plan.id}
                            className="mt-2"
                        >
                            {isDeletingPlanId === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Plan
                        </Button>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-sm mb-2">Meal Prep Strategy</h4>
                       <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handleGeneratePrepPlan(plan)} disabled={prepPlans[plan.id]?.isLoading}>
                            {prepPlans[plan.id]?.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CookingPot className="mr-2 h-4 w-4" />}
                            Generate Prep Plan
                        </Button>
                        {prepPlans[plan.id]?.data && (
                            <Button 
                                onClick={() => onSavePrepPlan(plan)} 
                                disabled={prepPlans[plan.id]?.isSaving || prepPlans[plan.id]?.isSaved}
                            >
                                {prepPlans[plan.id]?.isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {prepPlans[plan.id]?.isSaved ? 'Saved' : 'Save Prep Plan'}
                            </Button>
                        )}
                       </div>


                       {prepPlans[plan.id]?.isLoading && (
                         <p className="text-sm text-muted-foreground mt-2">Generating prep strategy...</p>
                       )}

                       {prepPlans[plan.id]?.error && (
                          <p className="text-sm text-destructive mt-2">{prepPlans[plan.id]?.error}</p>
                       )}

                       {prepPlans[plan.id]?.data && (
                         <div className="mt-4 space-y-4">
                           {(prepPlans[plan.id]?.data?.prepTasks || []).map((prepDay, dayIndex) => (
                              <div key={dayIndex}>
                                <h5 className="font-semibold">{prepDay.day}</h5>
                                <div className="pl-4 mt-2 space-y-2">
                                  {prepDay.tasks.map((task, taskIndex) => (
                                     <div key={taskIndex} className="text-sm">
                                       <span className="font-medium text-primary">{task.type}: </span>
                                       <span className="text-muted-foreground">{task.description}</span>
                                     </div>
                                  ))}
                                </div>
                              </div>
                           ))}
                           {prepPlans[plan.id]?.data?.storageTips && (
                             <div>
                                <h5 className="font-semibold">Storage Tips:</h5>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{prepPlans[plan.id]?.data?.storageTips}</p>
                             </div>
                           )}
                         </div>
                       )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
