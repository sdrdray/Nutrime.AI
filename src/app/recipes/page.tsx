
// src/app/recipes/page.tsx
"use client";

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { handleGenerateRecipe, handleAdaptRecipe, handleRecognizeFood } from '@/lib/actions';
import type { GenerateRecipeOutput } from '@/ai/flows/ai-recipe-generation';
import type { AdaptRecipeOutput } from '@/ai/flows/recipe-adaptation';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Minus, Plus, Utensils, Camera, Save, Trash2, BookOpenCheck } from 'lucide-react';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { firestore } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, Timestamp, deleteDoc, doc, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from '@/contexts/auth-context';


// Schema for AI Recipe Generator
const recipeGeneratorSchema = z.object({
  dietaryPreferences: z.string().min(1, "Dietary preferences are required."),
  availableIngredients: z.string().min(1, "Available ingredients are required."),
  cuisine: z.string().optional(),
  maxCookingTime: z.coerce.number().positive("Max cooking time must be a positive number.").optional(),
});
type RecipeGeneratorFormValues = z.infer<typeof recipeGeneratorSchema>;

// Schema for Recipe Adaptation
const recipeAdapterSchema = z.object({
  recipe: z.string().min(1, "Original recipe is required."),
  instructions: z.string().min(1, "Adaptation instructions are required."),
});
type RecipeAdapterFormValues = z.infer<typeof recipeAdapterSchema>;

interface UserSavedAiRecipe {
  id: string;
  recipeName: string;
  ingredients: string;
  instructions: string;
  savedAt: Timestamp;
  userId: string;
}

export default function RecipesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [isAdapting, startAdaptingTransition] = useTransition();
  const [isRecognizingIngredients, startRecognizingIngredientsTransition] = useTransition();
  const [isSavingRecipe, startSavingRecipeTransition] = useTransition();
  const [isDeletingRecipe, setIsDeletingRecipe] = useState<string | null>(null);


  const [generatedRecipe, setGeneratedRecipe] = useState<GenerateRecipeOutput | null>(null);
  const [adaptedRecipe, setAdaptedRecipe] = useState<AdaptRecipeOutput | null>(null);
  
  const [currentStep, setCurrentStep] = useState(0);

  const [isScanIngredientsModalOpen, setIsScanIngredientsModalOpen] = useState(false);
  const [scanIngredientsImagePreview, setScanIngredientsImagePreview] = useState<string | null>(null);
  const [hasCameraPermissionForIngredients, setHasCameraPermissionForIngredients] = useState<boolean | null>(null);
  const videoRefIngredients = useRef<HTMLVideoElement>(null);
  const canvasRefIngredients = useRef<HTMLCanvasElement>(null);
  const ingredientsStreamRef = useRef<MediaStream | null>(null);

  const [savedAiRecipes, setSavedAiRecipes] = useState<UserSavedAiRecipe[]>([]);
  const [isLoadingSavedRecipes, setIsLoadingSavedRecipes] = useState(true);
  const [isSelectRecipeModalOpen, setIsSelectRecipeModalOpen] = useState(false);


  const generatorForm = useForm<RecipeGeneratorFormValues>({
    resolver: zodResolver(recipeGeneratorSchema),
    defaultValues: { dietaryPreferences: "", availableIngredients: "" },
  });

  const adapterForm = useForm<RecipeAdapterFormValues>({
    resolver: zodResolver(recipeAdapterSchema),
    defaultValues: { recipe: "", instructions: "" },
  });
  
  useEffect(() => {
    const fetchSavedRecipes = async () => {
      if (!user) {
        setIsLoadingSavedRecipes(false);
        setSavedAiRecipes([]);
        return;
      }
      setIsLoadingSavedRecipes(true);
      try {
        const recipesCollectionRef = collection(firestore, "userSavedAiRecipes");
        const q = query(recipesCollectionRef, where("userId", "==", user.uid), orderBy("savedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedRecipes: UserSavedAiRecipe[] = [];
        querySnapshot.forEach((doc) => {
          fetchedRecipes.push({ id: doc.id, ...doc.data() } as UserSavedAiRecipe);
        });
        setSavedAiRecipes(fetchedRecipes);
      } catch (error) {
        console.error("Error fetching saved AI recipes:", error);
        toast({ variant: "destructive", title: "Load Error", description: "Could not load saved AI recipes."});
      }
      setIsLoadingSavedRecipes(false);
    };
    fetchSavedRecipes();
  }, [toast, user]);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const setupCamera = async () => {
      if (!isScanIngredientsModalOpen || scanIngredientsImagePreview) {
        if (ingredientsStreamRef.current) {
          ingredientsStreamRef.current.getTracks().forEach(track => track.stop());
          ingredientsStreamRef.current = null;
        }
        if (videoRefIngredients.current) {
          videoRefIngredients.current.srcObject = null;
        }
        return;
      }

      setHasCameraPermissionForIngredients(null); 

      if (ingredientsStreamRef.current) {
        ingredientsStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoRefIngredients.current) {
        videoRefIngredients.current.srcObject = null;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setHasCameraPermissionForIngredients(false);
        toast({ variant: 'destructive', title: 'Camera Not Supported', description: 'Your browser does not support camera access for ingredient scanning.' });
        return;
      }

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        ingredientsStreamRef.current = currentStream;

        if (videoRefIngredients.current) {
          videoRefIngredients.current.srcObject = currentStream;
          await videoRefIngredients.current.play(); 
          setHasCameraPermissionForIngredients(true);
        } else {
          console.error("RecipesPage: videoRefIngredients.current is null when trying to attach stream.");
          if (currentStream) currentStream.getTracks().forEach(track => track.stop()); 
          ingredientsStreamRef.current = null;
          setHasCameraPermissionForIngredients(false);
          toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not initialize video display. Please try closing and reopening the scan dialog.' });
        }
      } catch (error) {
        console.error('Error accessing camera for ingredients:', error);
        setHasCameraPermissionForIngredients(false);
        let description = 'Could not access the camera. Please ensure it is not in use by another application.';
        if (error instanceof DOMException) {
          if (error.name === "NotAllowedError") {
              description = "Camera permission was denied. Please enable it in your browser settings and try again.";
          } else if (error.name === "NotFoundError") {
              description = "No camera was found. Please ensure a camera is connected and enabled.";
          } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
              description = "The camera is already in use or could not be started. Please check other applications or browser tabs.";
          }
        }
        toast({ variant: 'destructive', title: 'Camera Access Issue', description });
        if (currentStream) { 
          currentStream.getTracks().forEach(track => track.stop());
          ingredientsStreamRef.current = null;
        }
      }
    };
    if (isScanIngredientsModalOpen) {
        setupCamera();
    }
    return () => { 
      if (ingredientsStreamRef.current) {
        ingredientsStreamRef.current.getTracks().forEach(track => track.stop());
        ingredientsStreamRef.current = null;
      }
      if (currentStream) { 
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (videoRefIngredients.current) {
        videoRefIngredients.current.srcObject = null;
      }
    };
  }, [isScanIngredientsModalOpen, scanIngredientsImagePreview, toast]);

  const handleOpenScanIngredientsModal = () => {
    setScanIngredientsImagePreview(null); 
    setIsScanIngredientsModalOpen(true);
  };
  
  const handleCloseScanIngredientsModal = () => {
    setIsScanIngredientsModalOpen(false);
  };

  const handleCaptureIngredientsPhoto = () => {
    if (videoRefIngredients.current && canvasRefIngredients.current && videoRefIngredients.current.srcObject && videoRefIngredients.current.readyState >= videoRefIngredients.current.HAVE_ENOUGH_DATA) {
      const video = videoRefIngredients.current;
      const canvas = canvasRefIngredients.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg');
        setScanIngredientsImagePreview(dataUri); 
      }
    } else {
        let errorMsg = "Camera not ready or no video stream.";
        if (!videoRefIngredients.current?.srcObject) errorMsg = "No active video stream to capture from.";
        else if (videoRefIngredients.current?.readyState < videoRefIngredients.current.HAVE_ENOUGH_DATA) errorMsg = "Video stream is not ready for capture.";
        toast({ variant: "destructive", title: "Capture Error", description: errorMsg + " Please ensure the camera is active and try again."});
    }
  };

  const handleRetakeIngredientsPhoto = () => {
    setScanIngredientsImagePreview(null); 
  };

  const handleUseIngredientsPhoto = async () => {
    if (!scanIngredientsImagePreview) return;
    startRecognizingIngredientsTransition(async () => {
      try {
        const result = await handleRecognizeFood({ photoDataUri: scanIngredientsImagePreview });
        const currentIngredients = generatorForm.getValues("availableIngredients");
        const newIngredientsString = result.foodItems.join(', ');
        
        if (currentIngredients.trim() && newIngredientsString.trim()) {
          generatorForm.setValue("availableIngredients", `${currentIngredients}, ${newIngredientsString}`);
        } else if (newIngredientsString.trim()) {
          generatorForm.setValue("availableIngredients", newIngredientsString);
        }
        
        toast({ title: "Ingredients Recognized!", description: "Added to your available ingredients list." });
        handleCloseScanIngredientsModal(); 
      } catch (error) {
        toast({ variant: "destructive", title: "Ingredient Recognition Error", description: (error as Error).message });
      }
    });
  };

  const onGenerateSubmit: SubmitHandler<RecipeGeneratorFormValues> = (data) => {
    startGeneratingTransition(async () => {
      try {
        const result = await handleGenerateRecipe(data);
        setGeneratedRecipe(result);
        setAdaptedRecipe(null);
        setCurrentStep(0); 
        toast({ title: "Recipe Generated!", description: "Your new recipe is ready." });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: (error as Error).message });
      }
    });
  };

  const onAdaptSubmit: SubmitHandler<RecipeAdapterFormValues> = (data) => {
    startAdaptingTransition(async () => {
      try {
        const result = await handleAdaptRecipe(data);
        setAdaptedRecipe(result);
        setGeneratedRecipe(null);
        setCurrentStep(0); 
        toast({ title: "Recipe Adapted!", description: "Your recipe has been modified." });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: (error as Error).message });
      }
    });
  };
  
  const handleSaveGeneratedRecipe = async () => {
    if (!generatedRecipe) {
      toast({ variant: "destructive", title: "No Recipe", description: "There is no recipe to save." });
      return;
    }
     if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to save a recipe." });
      return;
    }
    startSavingRecipeTransition(async () => {
      try {
        const recipeData = {
          recipeName: generatedRecipe.recipeName,
          ingredients: generatedRecipe.ingredients,
          instructions: generatedRecipe.instructions,
          savedAt: serverTimestamp(),
          userId: user.uid,
        };
        const docRef = await addDoc(collection(firestore, "userSavedAiRecipes"), recipeData);
        
        const newSavedRecipe: UserSavedAiRecipe = {
          id: docRef.id,
          ...generatedRecipe,
          savedAt: Timestamp.now(), // Optimistic update
          userId: user.uid,
        };
        setSavedAiRecipes(prev => [newSavedRecipe, ...prev].sort((a,b) => b.savedAt.toMillis() - a.savedAt.toMillis()));
        setGeneratedRecipe(null); // Clear generated recipe after saving
        toast({ title: "Recipe Saved!", description: `${recipeData.recipeName} saved to your collection.` });
      } catch (error) {
        console.error("Error saving AI recipe:", error);
        toast({ variant: "destructive", title: "Save Error", description: "Could not save the AI recipe." });
      }
    });
  };

  const handleDiscardGeneratedRecipe = () => {
    setGeneratedRecipe(null);
    toast({ title: "Recipe Discarded", description: "The generated recipe has been cleared." });
  };

  const handleSelectRecipeFromDialog = (recipe: UserSavedAiRecipe) => {
    const recipeContent = `Recipe Name: ${recipe.recipeName}\n\nIngredients:\n${recipe.ingredients}\n\nInstructions:\n${recipe.instructions}`;
    adapterForm.setValue("recipe", recipeContent);
    setIsSelectRecipeModalOpen(false);
    toast({ title: "Recipe Loaded", description: `${recipe.recipeName} loaded into adapter.` });
  };

  const handleDeleteSavedAiRecipe = async (recipeId: string) => {
    setIsDeletingRecipe(recipeId);
    try {
      await deleteDoc(doc(firestore, "userSavedAiRecipes", recipeId));
      setSavedAiRecipes(prevRecipes => prevRecipes.filter(recipe => recipe.id !== recipeId));
      toast({ title: "Recipe Deleted", description: "The saved recipe has been successfully deleted." });
    } catch (error) {
      console.error("Error deleting saved AI recipe:", error);
      toast({ variant: "destructive", title: "Delete Error", description: "Could not delete the saved recipe." });
    }
    setIsDeletingRecipe(null);
  };


  const displayedRecipe = generatedRecipe || (adaptedRecipe ? { recipeName: "Adapted Recipe", ingredients: adaptedRecipe.adaptedRecipe.split("Instructions:")[0].replace("Ingredients:","").trim(), instructions: adaptedRecipe.adaptedRecipe.split("Instructions:")[1]?.trim() || "No instructions provided."} : null);
  
  // This regex is designed to split by numbered lists (e.g., "1.", "2. ", "Step 3:")
  // It also handles cases where there might be newlines between steps.
  const recipeInstructionsArray = displayedRecipe?.instructions
    .split(/(?:\d+\.\s*|Step\s*\d+[:.]\s*)/)
    .map(step => step.trim())
    .filter(step => step) || [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Recipes Hub</h1>
        <p className="text-muted-foreground">
          Generate, adapt, and manage your recipes with AI assistance.
        </p>
      </header>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate">AI Recipe Generator</TabsTrigger>
          <TabsTrigger value="adapt">Smart Recipe Adaptor</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>AI Recipe Generator</CardTitle>
              <CardDescription>Generate new recipes based on your preferences and available ingredients.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...generatorForm}>
                <form onSubmit={generatorForm.handleSubmit(onGenerateSubmit)} className="space-y-6">
                  <FormField control={generatorForm.control} name="dietaryPreferences" render={({ field }) => (
                    <FormItem><FormLabel>Dietary Preferences</FormLabel><FormControl><Input placeholder="e.g., vegan, low-carb" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField
                    control={generatorForm.control}
                    name="availableIngredients"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Ingredients</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., chicken, broccoli, rice. Or scan them using the button below."
                            {...field} 
                          />
                        </FormControl>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="mt-2"
                          onClick={handleOpenScanIngredientsModal}
                        >
                          <Camera className="mr-2 h-4 w-4" /> Scan Ingredients
                        </Button>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField control={generatorForm.control} name="cuisine" render={({ field }) => (
                      <FormItem><FormLabel>Cuisine (Optional)</FormLabel><FormControl><Input placeholder="e.g., Italian, Mexican" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={generatorForm.control} name="maxCookingTime" render={({ field }) => (
                      <FormItem><FormLabel>Max Cooking Time (minutes, Optional)</FormLabel><FormControl><Input type="number" placeholder="e.g., 30" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <Button type="submit" disabled={isGenerating} className="w-full md:w-auto">
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Generate Recipe
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>My Saved AI Recipes</CardTitle>
              <CardDescription>Review and manage your previously saved AI-generated recipes.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSavedRecipes ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
                  <p>Loading saved recipes...</p>
                </div>
              ) : savedAiRecipes.length === 0 ? (
                <p className="text-muted-foreground">You haven't saved any AI-generated recipes yet.</p>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {savedAiRecipes.map((recipe) => (
                    <AccordionItem value={recipe.id} key={recipe.id}>
                      <AccordionTrigger>
                        <div className="flex-1 text-left">
                          {recipe.recipeName}
                          <span className="block text-xs text-muted-foreground font-normal">
                            Saved on: {recipe.savedAt ? format(recipe.savedAt.toDate(), "PPP") : "Date not available"}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-sm mb-1">Ingredients:</h4>
                            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs text-muted-foreground mt-1">
                              {recipe.ingredients}
                            </pre>
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm mb-1">Instructions:</h4>
                            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs text-muted-foreground mt-1">
                              {recipe.instructions}
                            </pre>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSavedAiRecipe(recipe.id)}
                            disabled={isDeletingRecipe === recipe.id}
                            className="mt-2"
                          >
                            {isDeletingRecipe === recipe.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Recipe
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="adapt">
          <Card>
            <CardHeader>
              <CardTitle>Smart Recipe Adaptor</CardTitle>
              <CardDescription>Modify existing recipes for dietary needs or ingredient substitutions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...adapterForm}>
                <form onSubmit={adapterForm.handleSubmit(onAdaptSubmit)} className="space-y-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="mb-2" 
                    onClick={() => setIsSelectRecipeModalOpen(true)}
                    disabled={isLoadingSavedRecipes || savedAiRecipes.length === 0}
                  >
                    <BookOpenCheck className="mr-2 h-4 w-4" /> 
                    {isLoadingSavedRecipes ? "Loading Recipes..." : (savedAiRecipes.length === 0 ? "No Saved Recipes" : "Select from My Saved Recipes")}
                  </Button>
                  <FormField control={adapterForm.control} name="recipe" render={({ field }) => (
                    <FormItem><FormLabel>Original Recipe</FormLabel><FormControl><Textarea placeholder="Paste the original recipe here, or select one from your saved recipes..." {...field} rows={8} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={adapterForm.control} name="instructions" render={({ field }) => (
                    <FormItem><FormLabel>Adaptation Instructions</FormLabel><FormControl><Textarea placeholder="e.g., make it gluten-free, substitute chicken with tofu" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" disabled={isAdapting} className="w-full md:w-auto">
                    {isAdapting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Adapt Recipe
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog open={isScanIngredientsModalOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCloseScanIngredientsModal(); else setIsScanIngredientsModalOpen(true);}}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Scan Your Ingredients</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className={cn("relative aspect-video w-full overflow-hidden rounded-md border bg-muted", { 'hidden': scanIngredientsImagePreview })}>
                <video 
                    ref={videoRefIngredients} 
                    className={cn("h-full w-full object-cover", {'hidden': !hasCameraPermissionForIngredients || scanIngredientsImagePreview })} 
                    autoPlay 
                    muted 
                    playsInline 
                />
                {hasCameraPermissionForIngredients === null && !scanIngredientsImagePreview && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                    <p className="mt-2 text-white">Requesting camera access...</p>
                  </div>
                )}
                 {hasCameraPermissionForIngredients === false && !scanIngredientsImagePreview && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4 text-center">
                        <Alert variant="destructive" className="w-full max-w-md">
                            <Camera className="h-5 w-5" />
                            <AlertTitle>Camera Access Issue</AlertTitle>
                            <AlertDescription>
                            Could not access camera. Please ensure permissions are granted and no other app is using it. You may need to refresh or check browser settings.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
                {hasCameraPermissionForIngredients && !scanIngredientsImagePreview && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-3/4 h-2/3 border-2 border-dashed border-green-500 rounded-lg opacity-75"></div>
                    </div>
                )}
            </div>
            
            {scanIngredientsImagePreview && (
              <div className="flex justify-center">
                <Image src={scanIngredientsImagePreview} alt="Captured ingredients" width={320} height={240} className="rounded-md object-cover" data-ai-hint="food items" />
              </div>
            )}
            <canvas ref={canvasRefIngredients} className="hidden"></canvas>
          </div>
          <DialogFooter className="gap-2 sm:justify-center">
            {!scanIngredientsImagePreview && hasCameraPermissionForIngredients && (
              <Button onClick={handleCaptureIngredientsPhoto} className="w-full" disabled={isRecognizingIngredients}>Capture Photo</Button>
            )}
            {scanIngredientsImagePreview && (
              <>
                <Button variant="outline" onClick={handleRetakeIngredientsPhoto} disabled={isRecognizingIngredients}>Retake Photo</Button>
                <Button onClick={handleUseIngredientsPhoto} disabled={isRecognizingIngredients} className="w-full sm:w-auto">
                  {isRecognizingIngredients && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Use Photo & Recognize
                </Button>
              </>
            )}
             <DialogClose asChild>
                <Button type="button" variant="secondary" onClick={handleCloseScanIngredientsModal} className="w-full sm:w-auto" disabled={isRecognizingIngredients}>
                    Cancel
                </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSelectRecipeModalOpen} onOpenChange={setIsSelectRecipeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select a Saved Recipe</DialogTitle>
            <DialogDescription>Choose one of your previously AI-generated recipes to adapt.</DialogDescription>
          </DialogHeader>
          {isLoadingSavedRecipes ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2">Loading your recipes...</p>
            </div>
          ) : savedAiRecipes.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">You haven't saved any AI-generated recipes yet.</p>
          ) : (
            <ScrollArea className="h-[300px] pr-3">
              <div className="space-y-2">
                {savedAiRecipes.map((recipe) => (
                  <Button
                    key={recipe.id}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => handleSelectRecipeFromDialog(recipe)}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{recipe.recipeName}</span>
                      <span className="text-xs text-muted-foreground">
                        Saved: {recipe.savedAt ? format(recipe.savedAt.toDate(), "MMM dd, yyyy") : "Date unknown"}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {(isGenerating || isAdapting) && !displayedRecipe && (
        <div className="mt-8 flex items-center justify-center rounded-lg border p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Processing your recipe...</p>
        </div>
      )}

      {displayedRecipe && !isGenerating && !isAdapting && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-2xl">{displayedRecipe.recipeName}</CardTitle>
            {adaptedRecipe && <CardDescription>Reasoning: {adaptedRecipe.reasoning}</CardDescription>}
             {generatedRecipe && !adaptedRecipe && (
                <div className="mt-4 flex space-x-2">
                    <Button onClick={handleSaveGeneratedRecipe} disabled={isSavingRecipe}>
                        {isSavingRecipe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Recipe
                    </Button>
                    <Button variant="outline" onClick={handleDiscardGeneratedRecipe} disabled={isSavingRecipe}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Discard Recipe
                    </Button>
                </div>
            )}
          </CardHeader>
          <CardContent>
             <Image 
                src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxmb29kJTIwY29va2luZ3xlbnwwfHx8fDE3NTMyOTY2NzN8MA&ixlib=rb-4.1.0&q=80&w=1080" 
                alt={displayedRecipe.recipeName} 
                width={800} 
                height={300} 
                className="mb-6 rounded-lg object-cover w-full"
                data-ai-hint="cooked meal"
              />
            
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-semibold mb-2">Ingredients:</h3>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm text-muted-foreground">{displayedRecipe.ingredients}</pre>
                </div>
                <div>
                    <h3 className="text-lg font-semibold mb-2">Instructions (Cooking Guidance):</h3>
                    {recipeInstructionsArray.length > 0 ? (
                        <div className="space-y-4">
                        {recipeInstructionsArray.map((step, index) => (
                            <div key={index} className={cn("rounded-md border p-4 transition-all", currentStep === index ? "border-primary shadow-lg" : "border-border")}>
                            <p className={cn("font-medium", currentStep === index && "text-primary")}>Step {index + 1}</p>
                            <p className="text-sm text-muted-foreground">{step}</p>
                            {currentStep === index && <Utensils className="mt-2 h-4 w-4 text-accent" />}
                            </div>
                        ))}
                        <div className="flex justify-between mt-4">
                            <Button onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={currentStep === 0}>Previous Step</Button>
                            <Button onClick={() => setCurrentStep(s => Math.min(recipeInstructionsArray.length - 1, s + 1))} disabled={currentStep === recipeInstructionsArray.length - 1}>Next Step</Button>
                        </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No instructions provided.</p>
                    )}
                </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
