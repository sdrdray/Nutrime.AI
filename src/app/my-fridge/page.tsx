// src/app/my-fridge/page.tsx
"use client";

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { handleFridgeAiChef, handleRecognizeFood, handleDeleteSavedFridgeRecipe } from '@/lib/actions';
import type { FridgeAiChefOutput, FridgeAiChefInput as AiChefRecipeInput } from '@/ai/flows/fridge-ai-chef'; // Renamed to avoid conflict
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, XCircle, ThumbsUp, AlertTriangle, Camera, Save, ThumbsDown, BookMarked, RotateCw, LogIn, Trash2 } from 'lucide-react'; // Added Save, ThumbsDown, BookMarked, Trash2
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, addDoc, query, orderBy, getDocs, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';

const fridgeChefSchema = z.object({
  ingredients: z.array(z.string().min(1, "Ingredient cannot be empty")).min(1, "Please add at least one ingredient."),
  dietaryPreferences: z.string().optional(),
});

type FridgeChefFormValues = z.infer<typeof fridgeChefSchema>;

interface SuggestedRecipe { // From FridgeAiChefOutput
    name: string;
    ingredients: string[];
    instructions: string;
}

interface SavedFridgeRecipe extends SuggestedRecipe {
  id: string;
  savedAt: Timestamp;
  userId: string; 
}


export default function MyFridgePage() {
  const { user } = useAuth();
  const [isAiChefPending, startAiChefTransition] = useTransition();
  const [isInventoryLoading, setIsInventoryLoading] = useState(true);
  const [isInventorySaving, startInventorySavingTransition] = useTransition();
  const [suggestedRecipes, setSuggestedRecipes] = useState<SuggestedRecipe[]>([]); 
  const { toast } = useToast();
  const [currentIngredient, setCurrentIngredient] = useState("");

  // For ingredient scanning dialog
  const [isScanIngredientsModalOpen, setIsScanIngredientsModalOpen] = useState(false);
  const [scanIngredientsImagePreview, setScanIngredientsImagePreview] = useState<string | null>(null);
  const [hasCameraPermissionForIngredients, setHasCameraPermissionForIngredients] = useState<boolean | null>(null);
  const videoRefIngredients = useRef<HTMLVideoElement>(null);
  const canvasRefIngredients = useRef<HTMLCanvasElement>(null);
  const ingredientsStreamRef = useRef<MediaStream | null>(null);
  const [isRecognizingIngredients, startRecognizingIngredientsTransition] = useTransition();
  const [fridgeCameraFacingMode, setFridgeCameraFacingMode] = useState<'environment' | 'user'>('environment');


  // For saved recipes
  const [savedFridgeRecipes, setSavedFridgeRecipes] = useState<SavedFridgeRecipe[]>([]);
  const [isLoadingSavedRecipes, setIsLoadingSavedRecipes] = useState(true);
  const [isProcessingRecipeAction, setIsProcessingRecipeAction] = useState<string | null>(null); 
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);


  const form = useForm<FridgeChefFormValues>({
    resolver: zodResolver(fridgeChefSchema),
    defaultValues: {
      ingredients: [],
      dietaryPreferences: "",
    },
  });
  
  useEffect(() => {
    const fetchInitialData = async () => {
        if (!user) {
            setIsInventoryLoading(false);
            setIsLoadingSavedRecipes(false);
            form.setValue("ingredients", []);
            setSavedFridgeRecipes([]);
            return;
        }

        setIsInventoryLoading(true);
        setIsLoadingSavedRecipes(true);
        
        // Fetch Fridge Items
        try {
            const fridgeDocRef = doc(firestore, "userFridges", user.uid);
            const docSnap = await getDoc(fridgeDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                form.setValue("ingredients", data.items || []);
            } else {
                form.setValue("ingredients", []);
            }
        } catch (error) {
            console.error("Error fetching fridge items:", error);
            toast({ variant: "destructive", title: "Load Error", description: "Could not load fridge inventory." });
        }
        setIsInventoryLoading(false);

        // Fetch Saved Recipes
        try {
            const recipesCollectionRef = collection(firestore, "userSavedFridgeRecipes");
            const q = query(recipesCollectionRef, where("userId", "==", user.uid), orderBy("savedAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedRecipes: SavedFridgeRecipe[] = [];
            querySnapshot.forEach((doc) => {
                fetchedRecipes.push({ id: doc.id, ...doc.data() } as SavedFridgeRecipe);
            });
            setSavedFridgeRecipes(fetchedRecipes);
        } catch (error) {
            console.error("Error fetching saved fridge recipes:", error);
            toast({ variant: "destructive", title: "Load Error", description: "Could not load saved recipes."});
        }
        setIsLoadingSavedRecipes(false);
    };

    fetchInitialData();
  }, [user, form, toast]);


  const saveFridgeItemsToFirestore = async (newIngredients: string[]) => {
    if (!user) {
        toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to save ingredients."});
        return;
    }
    startInventorySavingTransition(async () => {
      try {
        const fridgeDocRef = doc(firestore, "userFridges", user.uid);
        await setDoc(fridgeDocRef, { items: newIngredients }, { merge: true });
        toast({ title: "Fridge Updated", description: "Your ingredients have been saved.", icon: <ThumbsUp className="h-4 w-4" /> });
      } catch (error) {
        console.error("Error saving fridge items:", error);
        toast({ variant: "destructive", title: "Save Error", description: "Could not save fridge inventory.", icon: <AlertTriangle className="h-4 w-4" /> });
      }
    });
  };

  const addIngredient = () => {
    if (currentIngredient.trim() !== "") {
      const currentIngredients = form.getValues("ingredients");
      if (!currentIngredients.includes(currentIngredient.trim())) {
        const updatedIngredients = [...currentIngredients, currentIngredient.trim()];
        form.setValue("ingredients", updatedIngredients);
        setCurrentIngredient("");
        saveFridgeItemsToFirestore(updatedIngredients);
      } else {
        toast({ variant: "default", title: "Duplicate", description: "Ingredient already in fridge." });
        setCurrentIngredient("");
      }
    }
  };

  const removeIngredient = (index: number) => {
    const currentIngredients = form.getValues("ingredients");
    const updatedIngredients = currentIngredients.filter((_, i) => i !== index);
    form.setValue("ingredients", updatedIngredients);
    saveFridgeItemsToFirestore(updatedIngredients);
  };

  const onAiChefSubmit: SubmitHandler<FridgeChefFormValues> = (data) => {
    startAiChefTransition(async () => {
      setSuggestedRecipes([]);
      try {
        const result: FridgeAiChefOutput = await handleFridgeAiChef(data as AiChefRecipeInput);
        setSuggestedRecipes(result.recipes || []);
        if (!result.recipes || result.recipes.length === 0) {
          toast({ title: "No Recipes Found", description: "Try adding more ingredients or changing dietary preferences." });
        } else {
          toast({ title: "Recipes Suggested!", description: "Here are some ideas based on your ingredients." });
        }
      } catch (error) {
        toast({ variant: "destructive", title: "AI Chef Error", description: (error as Error).message });
        console.error(error);
      }
    });
  };

  const handleAcceptRecipe = async (recipeToSave: SuggestedRecipe) => {
    if (!user) {
        toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to save recipes."});
        return;
    }
    setIsProcessingRecipeAction(recipeToSave.name);
    try {
        const recipeData = {
            ...recipeToSave,
            savedAt: serverTimestamp(),
            userId: user.uid
        };
        const docRef = await addDoc(collection(firestore, "userSavedFridgeRecipes"), recipeData);
        
        const newSavedRecipe: SavedFridgeRecipe = {
            ...recipeToSave,
            id: docRef.id,
            savedAt: Timestamp.now(),
            userId: user.uid,
        };
        setSavedFridgeRecipes(prev => [newSavedRecipe, ...prev].sort((a,b) => b.savedAt.toMillis() - a.savedAt.toMillis()));
        setSuggestedRecipes(prev => prev.filter(r => r.name !== recipeToSave.name));

        toast({ title: "Recipe Saved!", description: `${recipeToSave.name} has been added to your saved recipes.`});
    } catch (error) {
        console.error("Error saving recipe:", error);
        toast({ variant: "destructive", title: "Save Error", description: `Could not save ${recipeToSave.name}.`});
    }
    setIsProcessingRecipeAction(null);
  };

  const handleRejectRecipe = (recipeNameToReject: string) => {
    setSuggestedRecipes(prev => prev.filter(r => r.name !== recipeNameToReject));
    toast({ title: "Suggestion Dismissed", description: `${recipeNameToReject} was removed from suggestions.`});
  };

  const onDeleteSavedRecipe = async (recipeId: string) => {
    if (!user) {
        toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to delete recipes."});
        return;
    }
    setDeletingRecipeId(recipeId);
    try {
        const result = await handleDeleteSavedFridgeRecipe({ recipeId, userId: user.uid });
        if (result.success) {
            setSavedFridgeRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
            toast({ title: "Recipe Deleted", description: "The saved recipe has been removed." });
        } else {
            toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
        }
    } catch (error) {
        toast({ variant: "destructive", title: "Deletion Error", description: "An unexpected error occurred." });
    }
    setDeletingRecipeId(null);
  };

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    const setupCamera = async () => {
      if (!isScanIngredientsModalOpen || scanIngredientsImagePreview) {
        if (ingredientsStreamRef.current) {
          ingredientsStreamRef.current.getTracks().forEach(track => track.stop());
          ingredientsStreamRef.current = null;
        }
        if (videoRefIngredients.current) videoRefIngredients.current.srcObject = null;
        return;
      }

      setHasCameraPermissionForIngredients(null);
      if (ingredientsStreamRef.current) ingredientsStreamRef.current.getTracks().forEach(track => track.stop());
      if (videoRefIngredients.current) videoRefIngredients.current.srcObject = null;

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setHasCameraPermissionForIngredients(false);
        toast({ variant: 'destructive', title: 'Camera Not Supported', description: 'Your browser does not support camera access.' });
        return;
      }

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: fridgeCameraFacingMode } });
        ingredientsStreamRef.current = currentStream;
        if (videoRefIngredients.current) {
          videoRefIngredients.current.srcObject = currentStream;
          await videoRefIngredients.current.play();
          setHasCameraPermissionForIngredients(true);
        } else {
          console.error("MyFridgePage: videoRefIngredients.current is null when trying to attach stream.");
          currentStream.getTracks().forEach(track => track.stop());
          ingredientsStreamRef.current = null;
          setHasCameraPermissionForIngredients(false);
        }
      } catch (error) {
        console.error('Error accessing camera for ingredients:', error);
        setHasCameraPermissionForIngredients(false);
        let description = 'Could not access the camera.';
        if (error instanceof DOMException) {
            if (error.name === "NotAllowedError") description = "Camera permission denied. Please enable it in browser settings.";
            else if (error.name === "NotFoundError") description = "No camera found. Please ensure one is connected.";
            else if (error.name === "NotReadableError") description = "Camera is already in use or unreadable.";
        }
        toast({ variant: 'destructive', title: 'Camera Access Issue', description });
        if (currentStream) currentStream.getTracks().forEach(track => track.stop());
        ingredientsStreamRef.current = null;
      }
    };
    setupCamera();
    return () => {
      if (ingredientsStreamRef.current) ingredientsStreamRef.current.getTracks().forEach(track => track.stop());
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      if (videoRefIngredients.current) videoRefIngredients.current.srcObject = null;
    };
  }, [isScanIngredientsModalOpen, scanIngredientsImagePreview, toast, fridgeCameraFacingMode]);

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
      toast({ variant: "destructive", title: "Capture Error", description: "Camera not ready or no video stream." });
    }
  };

  const handleRetakeIngredientsPhoto = () => {
    setScanIngredientsImagePreview(null);
  };

  const handleUseIngredientsPhotoAndAdd = async () => {
    if (!scanIngredientsImagePreview) return;
    startRecognizingIngredientsTransition(async () => {
      try {
        const result = await handleRecognizeFood({ photoDataUri: scanIngredientsImagePreview });
        const currentFridgeIngredients = form.getValues("ingredients") || [];
        const newRecognized = result.foodItems.filter(item => !currentFridgeIngredients.includes(item.trim()));
        
        if (newRecognized.length > 0) {
            const updatedIngredients = [...currentFridgeIngredients, ...newRecognized.map(item => item.trim())];
            form.setValue("ingredients", updatedIngredients);
            await saveFridgeItemsToFirestore(updatedIngredients);
            toast({ title: "Ingredients Added!", description: `${newRecognized.join(', ')} added to your fridge.` });
        } else if (result.foodItems.length > 0) {
             toast({ title: "Ingredients Recognized", description: "All recognized items were already in your fridge." });
        } else {
            toast({ title: "No New Ingredients", description: "Could not recognize new items from the photo." });
        }
        
        handleCloseScanIngredientsModal();
      } catch (error) {
        toast({ variant: "destructive", title: "Ingredient Recognition Error", description: (error as Error).message });
      }
    });
  };

  if (!user) {
    return (
        <div className="space-y-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center flex items-center justify-center"><LogIn className="mr-2 h-6 w-6"/>Log In Required</CardTitle>
                    <CardDescription className="text-center">
                        Please log in to manage your fridge and get recipe suggestions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                    <Button asChild>
                        <Link href="/settings">Go to Login / Sign Up</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Fridge AI Chef</h1>
        <p className="text-muted-foreground">
          List your available ingredients. They'll be saved for next time!
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>What's in Your Fridge?</CardTitle>
          <CardDescription>Your ingredients are saved automatically. Add or remove items below.</CardDescription>
        </CardHeader>
        <CardContent>
          {isInventoryLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
              <p>Loading your fridge...</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAiChefSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="ingredients"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Ingredients</FormLabel>
                      <div className="flex space-x-2">
                        <Input
                          placeholder="e.g., Chicken breast"
                          value={currentIngredient}
                          onChange={(e) => setCurrentIngredient(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIngredient();}}}
                          disabled={isInventorySaving}
                        />
                        <Button type="button" onClick={addIngredient} variant="outline" size="icon" disabled={isInventorySaving || currentIngredient.trim() === ''}>
                          {isInventorySaving && field.value.includes(currentIngredient.trim()) ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          onClick={handleOpenScanIngredientsModal}
                          disabled={isInventorySaving}
                          title="Scan ingredients with camera"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                      {field.value.length > 0 && (
                        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-2">
                          {field.value.map((ingredient, index) => (
                            <div key={index} className="flex items-center justify-between rounded-md bg-muted p-2 text-sm">
                              <span>{ingredient}</span>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(index)} disabled={isInventorySaving}>
                                <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                       {field.value.length === 0 && !isInventorySaving && <p className="text-sm text-muted-foreground pt-2">Your fridge is empty. Add some ingredients!</p>}
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dietaryPreferences"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dietary Preferences (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., vegetarian, gluten-free" {...field} disabled={isInventorySaving}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isAiChefPending || isInventorySaving || form.getValues("ingredients").length === 0} className="w-full md:w-auto">
                  {isAiChefPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Find Recipes
                </Button>
                 {isInventorySaving && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing fridge...</p>}
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Dialog open={isScanIngredientsModalOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCloseScanIngredientsModal(); else setIsScanIngredientsModalOpen(true);}}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Scan Ingredients for Your Fridge</DialogTitle>
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
                            Could not access camera. Ensure permissions are granted and no other app is using it.
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
                <Image src={scanIngredientsImagePreview} alt="Captured ingredients for fridge" width={320} height={240} className="rounded-md object-cover" data-ai-hint="food items" />
              </div>
            )}
            <canvas ref={canvasRefIngredients} className="hidden"></canvas>
          </div>
          <DialogFooter className="gap-2 sm:justify-center">
            {!scanIngredientsImagePreview && (
                 <div className='flex w-full justify-between items-center'>
                    <Button variant="outline" size="icon" onClick={() => setFridgeCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user')} disabled={!hasCameraPermissionForIngredients || isRecognizingIngredients}>
                        <RotateCw className='h-4 w-4' />
                    </Button>
                    <Button onClick={handleCaptureIngredientsPhoto} className="flex-grow ml-2" disabled={!hasCameraPermissionForIngredients || isRecognizingIngredients}>Capture Photo</Button>
                </div>
            )}
            {scanIngredientsImagePreview && (
              <>
                <Button variant="outline" onClick={handleRetakeIngredientsPhoto} disabled={isRecognizingIngredients}>Retake Photo</Button>
                <Button onClick={handleUseIngredientsPhotoAndAdd} disabled={isRecognizingIngredients} className="w-full sm:w-auto">
                  {isRecognizingIngredients && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Use Photo & Add to Fridge
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

      {isAiChefPending && (
        <div className="flex items-center justify-center rounded-lg border p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Finding recipes...</p>
        </div>
      )}

      {suggestedRecipes.length > 0 && !isAiChefPending && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested Recipes</CardTitle>
             <CardDescription>Review these AI-generated recipe ideas. Click "Save" to add them to your collection.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
            {suggestedRecipes.map((recipe, index) => (
              <Card key={index} className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-xl">{recipe.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <h4 className="font-semibold mb-1">Ingredients:</h4>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
                      {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                    </ul>
                  </div>
                  <div className="mt-3">
                    <h4 className="font-semibold mb-1">Instructions:</h4>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{recipe.instructions}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        onClick={() => handleRejectRecipe(recipe.name)}
                        disabled={isProcessingRecipeAction === recipe.name || isInventorySaving}
                    >
                        <ThumbsDown className="mr-2 h-4 w-4" />
                        Reject
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={() => handleAcceptRecipe(recipe)}
                        disabled={isProcessingRecipeAction === recipe.name || isInventorySaving}
                    >
                        {isProcessingRecipeAction === recipe.name ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save to My Recipes
                    </Button>
                </CardFooter>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
      
      {suggestedRecipes.length === 0 && !isAiChefPending && form.getValues("ingredients").length > 0 && (
           <Card>
                <CardHeader>
                    <CardTitle>Suggested Recipes</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No recipes found for the current ingredients and preferences. Try adjusting them or adding more ingredients to your fridge.</p>
                </CardContent>
           </Card>
      )}

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><BookMarked className="mr-2 h-5 w-5 text-primary" /> Your Saved Fridge Recipes</CardTitle>
                <CardDescription>Recipes you've previously saved from fridge suggestions.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingSavedRecipes ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
                        <p>Loading saved recipes...</p>
                    </div>
                ) : savedFridgeRecipes.length === 0 ? (
                    <p className="text-muted-foreground">You haven't saved any fridge recipes yet. Accept some suggestions to build your collection!</p>
                ) : (
                    <Accordion type="single" collapsible className="w-full">
                        {savedFridgeRecipes.map((recipe) => (
                            <AccordionItem value={recipe.id} key={recipe.id}>
                                <AccordionTrigger>
                                    {recipe.name} - <span className="text-xs text-muted-foreground ml-2">Saved on: {recipe.savedAt ? format(recipe.savedAt.toDate(), "MMM dd, yyyy") : "Date unavailable"}</span>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="font-semibold text-sm">Ingredients:</h4>
                                            <ul className="list-disc pl-5 text-xs text-muted-foreground">
                                                {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm">Instructions:</h4>
                                            <p className="whitespace-pre-wrap text-xs text-muted-foreground mt-1">{recipe.instructions}</p>
                                        </div>
                                         <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onDeleteSavedRecipe(recipe.id)}
                                            disabled={deletingRecipeId === recipe.id}
                                            className="mt-2"
                                        >
                                            {deletingRecipeId === recipe.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
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

    </div>
  );
}
