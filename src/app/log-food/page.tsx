// src/app/log-food/page.tsx
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
import { handleRecognizeFood, handleNutritionalEstimation } from '@/lib/actions';
import type { RecognizeFoodOutput } from '@/ai/flows/food-recognition';
import type { NutritionalEstimationOutput } from '@/ai/flows/nutritional-estimation';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, Barcode, Edit3, Clock, Tag, Trash2, LogIn, RotateCw } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { firestore } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, updateDoc, doc, query, orderBy, limit, getDocs, deleteDoc, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

// Schema for AI Food Recognition (file upload)
const foodRecognitionSchema = z.object({
  photo: z.instanceof(File, { message: "Photo is required." })
    .refine(file => file.size < 5 * 1024 * 1024, "Photo must be less than 5MB.")
    .refine(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Only JPG, PNG, WEBP images are allowed."),
});
type FoodRecognitionFormValues = z.infer<typeof foodRecognitionSchema>;

// Schema for Manual Food Log
const manualLogSchema = z.object({
  foodItem: z.string().min(1, "Food item name is required."),
  quantity: z.string().min(1, "Quantity is required."),
  mealTime: z.string().min(1, "Meal time is required."),
  notes: z.string().optional(),
  tags: z.string().optional(), // e.g., people present
});
type ManualLogFormValues = z.infer<typeof manualLogSchema>;

interface LoggedMeal {
    id: string; // Firestore document ID
    type: 'photo' | 'manual' | 'barcode';
    content: string | string[]; // Food items (array for photo, string for manual/barcode)
    mealDescriptionForNutrition: string; // Description used for nutritional estimation
    loggedAt: Timestamp; 
    imagePreview?: string; 
    notes?: string;
    tags?: string;
    barcodeData?: string; 
    userId?: string; 
    estimatedCalories?: number;
    estimatedProtein?: number;
    estimatedCarbs?: number;
    estimatedFat?: number;
    nutritionNotes?: string;
    isEstimatingNutrition?: boolean;
}

const MAX_RECENT_LOGS_TO_DISPLAY = 5;

// Barcode Scanner Tab Content Component
const BarcodeScannerTabContent = ({ onBarcodeScanned }: { onBarcodeScanned: (barcode: string) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const { toast } = useToast();
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const { user } = useAuth();
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    let streamInstance: MediaStream | null = null;

    const getCameraPermission = async () => {
      if (!user) { // Don't request if not logged in
        setHasCameraPermission(false);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        try {
          streamInstance = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } });
          if (videoRef.current) {
            videoRef.current.srcObject = streamInstance;
          }
          setHasCameraPermission(true);
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this feature. You might need to refresh.',
          });
        }
      } else {
        setHasCameraPermission(false);
        toast({
            variant: 'destructive',
            title: 'Camera Not Supported',
            description: 'Your browser does not support camera access or you are in an insecure context (non-HTTPS).',
        });
      }
    };

    getCameraPermission();

    return () => {
      if (streamInstance) {
        streamInstance.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [toast, user, facingMode]);

  const handleSimulateScanBarcode = () => {
    const dummyBarcode = `SIM_${Date.now().toString().slice(-6)}`;
    setScannedBarcode(dummyBarcode);
    onBarcodeScanned(dummyBarcode); 
    toast({
      title: "Barcode Scanned (Simulated)",
      description: `Barcode: ${dummyBarcode}. Nutritional info will be estimated.`,
    });
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log with Barcode Scanner</CardTitle>
        <CardDescription>Point your camera at a barcode. Ensure good lighting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
          {hasCameraPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4 text-center">
                 <Alert variant="destructive" className="w-full max-w-md">
                    <Camera className="h-5 w-5" />
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                        Please allow camera access in your browser settings to use this feature. You might need to refresh the page after granting permission.
                    </AlertDescription>
                </Alert>
            </div>
          )}
          {hasCameraPermission === null && user && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="mt-2 text-white">Requesting camera access...</p>
            </div>
          )}
           {hasCameraPermission === true && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/3 border-2 border-dashed border-green-500 rounded-lg opacity-75"></div>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
            <Button onClick={toggleFacingMode} variant="outline" size="icon" disabled={!hasCameraPermission || !user}>
                <RotateCw className="h-4 w-4"/>
            </Button>
            <Button onClick={handleSimulateScanBarcode} disabled={!hasCameraPermission || !user} className="w-full">
                <Barcode className="mr-2 h-4 w-4" /> 
                Simulate Scan Barcode & Log
            </Button>
        </div>
        {scannedBarcode && (
          <div className="mt-4 rounded-md bg-muted p-3 text-sm">
            <p className="font-semibold">Last Scanned Barcode (Simulated):</p>
            <p className="text-muted-foreground">{scannedBarcode}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
            Note: Actual barcode decoding and product lookup via API are not implemented in this prototype. This simulates a scan and logs the barcode number. Nutritional information will be estimated by AI.
        </p>
      </CardContent>
    </Card>
  );
};


export default function LogFoodPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isRecognizing, startRecognizingTransition] = useTransition();
  const [isLoggingManual, startLoggingManualTransition] = useTransition();
  
  const [recognizedFoodItems, setRecognizedFoodItems] = useState<string[] | null>(null);
  const [uploadImagePreview, setUploadImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recentLogs, setRecentLogs] = useState<LoggedMeal[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  // States for live camera capture
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const recognitionForm = useForm<FoodRecognitionFormValues>({
    resolver: zodResolver(foodRecognitionSchema),
  });

  const manualLogForm = useForm<ManualLogFormValues>({
    resolver: zodResolver(manualLogSchema),
    defaultValues: {
      foodItem: '',
      quantity: '',
      mealTime: '',
      notes: '',
      tags: '',
    },
  });

  useEffect(() => {
    if (user) { 
      manualLogForm.reset({
        ...manualLogForm.getValues(),
        mealTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); 

  useEffect(() => {
    const fetchRecentLogs = async () => {
      if (!user) {
        setRecentLogs([]);
        setIsLoadingLogs(false);
        return;
      }
      setIsLoadingLogs(true);
      try {
        const q = query(
            collection(firestore, "mealLogs"), 
            where("userId", "==", user.uid),
            orderBy("loggedAt", "desc"), 
            limit(MAX_RECENT_LOGS_TO_DISPLAY)
        );
        const querySnapshot = await getDocs(q);
        const logs: LoggedMeal[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          logs.push({
            id: docSnap.id,
            type: data.type,
            content: data.content,
            mealDescriptionForNutrition: data.mealDescriptionForNutrition,
            loggedAt: data.loggedAt as Timestamp,
            imagePreview: data.imagePreview,
            notes: data.notes,
            tags: data.tags,
            barcodeData: data.barcodeData,
            userId: data.userId,
            estimatedCalories: data.estimatedCalories,
            estimatedProtein: data.estimatedProtein,
            estimatedCarbs: data.estimatedCarbs,
            estimatedFat: data.estimatedFat,
            nutritionNotes: data.nutritionNotes,
            isEstimatingNutrition: false, 
          } as LoggedMeal);
        });
        setRecentLogs(logs);
      } catch (error) {
        console.error("Error fetching recent meal logs: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch recent meal logs." });
      }
      setIsLoadingLogs(false);
    };
    if (!authLoading) {
        fetchRecentLogs();
    }
  }, [user, toast, authLoading]);
  
  // Camera permission and streaming effect for capture modal
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    const setupCamera = async () => {
      if (!isCaptureModalOpen || capturedImage) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        return;
      }
      setHasCameraPermission(null);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacingMode } });
        streamRef.current = currentStream;
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
          await videoRef.current.play();
          setHasCameraPermission(true);
        }
      } catch (error) {
        console.error('Error accessing camera for photo capture:', error);
        setHasCameraPermission(false);
        toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera permissions.' });
      }
    };
    setupCamera();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [isCaptureModalOpen, capturedImage, toast, cameraFacingMode]);


  const estimateAndSaveNutrition = async (docId: string, mealDescription: string, logType: LoggedMeal['type']) => {
    if (!user) return;
    setRecentLogs(prev => prev.map(log => log.id === docId ? {...log, isEstimatingNutrition: true} : log));
    try {
      const nutrition = await handleNutritionalEstimation({ mealDescription });
      await updateDoc(doc(firestore, "mealLogs", docId), {
        estimatedCalories: nutrition.calories,
        estimatedProtein: nutrition.protein,
        estimatedCarbs: nutrition.carbs,
        estimatedFat: nutrition.fat,
        nutritionNotes: nutrition.notes || '',
      });
      setRecentLogs(prev => prev.map(log => log.id === docId ? {
        ...log, 
        estimatedCalories: nutrition.calories,
        estimatedProtein: nutrition.protein,
        estimatedCarbs: nutrition.carbs,
        estimatedFat: nutrition.fat,
        nutritionNotes: nutrition.notes || '',
        isEstimatingNutrition: false,
      } : log));
      toast({ title: "Nutrition Estimated!", description: `Nutritional info updated for your ${logType} log.`});
    } catch (error) {
      console.error("Error estimating nutrition:", error);
      toast({ variant: "destructive", title: "Nutrition Estimation Error", description: (error as Error).message });
      setRecentLogs(prev => prev.map(log => log.id === docId ? {...log, isEstimatingNutrition: false, nutritionNotes: "Failed to estimate."} : log));
    }
  };

  const processAndLogImage = async (photoDataUri: string) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "Please log in to save your meal log." });
      return;
    }
    startRecognizingTransition(async () => {
      setRecognizedFoodItems(null); 
      try {
        const result = await handleRecognizeFood({ photoDataUri });
        setRecognizedFoodItems(result.foodItems);
        
        const mealDescriptionForNutrition = result.foodItems.join(', ') || "Unrecognized items from photo";
        const currentLoggedAt = Timestamp.now();
        const mealDataToSave = {
          type: 'photo' as const,
          content: result.foodItems,
          mealDescriptionForNutrition,
          imagePreview: photoDataUri,
          loggedAt: currentLoggedAt,
          userId: user.uid,
        };
        const docRef = await addDoc(collection(firestore, "mealLogs"), mealDataToSave);
        
        const optimisticLog: LoggedMeal = {
          id: docRef.id,
          ...mealDataToSave,
          isEstimatingNutrition: true,
        };
        setRecentLogs(prev => [optimisticLog, ...prev.slice(0, MAX_RECENT_LOGS_TO_DISPLAY - 1)]);

        toast({ title: "Food Recognized & Logged!", description: "Items identified. Estimating nutrition..." });
        
        // Reset forms and previews
        recognitionForm.reset();
        setUploadImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsCaptureModalOpen(false);
        setCapturedImage(null);

        await estimateAndSaveNutrition(docRef.id, mealDescriptionForNutrition, 'photo');

      } catch (error) {
        toast({ variant: "destructive", title: "Recognition/Log Error", description: (error as Error).message });
      }
    });
  };

  const onUploadSubmit: SubmitHandler<FoodRecognitionFormValues> = (data) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const photoDataUri = reader.result as string;
      setUploadImagePreview(photoDataUri);
      processAndLogImage(photoDataUri);
    };
    reader.readAsDataURL(data.photo);
  };


  const onManualLogSubmit: SubmitHandler<ManualLogFormValues> = async (data) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "Please log in to save your meal log." });
      return;
    }
    startLoggingManualTransition(async () => {
      const mealDescriptionForNutrition = `${data.foodItem} (${data.quantity})`;
      const currentLoggedAt = Timestamp.now();
      const mealDataToSave = {
        type: 'manual' as const,
        content: data.foodItem,
        mealDescriptionForNutrition,
        quantity: data.quantity,
        mealTime: data.mealTime,
        notes: data.notes || '',
        tags: data.tags || '',
        loggedAt: currentLoggedAt,
        userId: user.uid,
      };

      try {
        const docRef = await addDoc(collection(firestore, "mealLogs"), mealDataToSave);
        
        const optimisticLog: LoggedMeal = {
            id: docRef.id, 
            ...mealDataToSave,
            isEstimatingNutrition: true,
        };
        setRecentLogs(prev => [optimisticLog, ...prev.slice(0, MAX_RECENT_LOGS_TO_DISPLAY - 1)]);

        toast({ title: "Meal Logged!", description: `${data.foodItem} saved. Estimating nutrition...`});
        manualLogForm.reset({ mealTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'}), foodItem: '', quantity: '', notes: '', tags: '' });

        await estimateAndSaveNutrition(docRef.id, mealDescriptionForNutrition, 'manual');

      } catch (e) {
        console.error("Error adding document: ", e);
        toast({ variant: "destructive", title: "Log Error", description: "Failed to save meal log. Please try again."});
      }
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = event.target.files?.[0];
    if (file) {
      recognitionForm.setValue("photo", file);
      recognitionForm.trigger("photo"); 
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setRecognizedFoodItems(null); 
    }
  };
  
  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current && videoRef.current.srcObject && videoRef.current.readyState >= videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setCapturedImage(canvas.toDataURL('image/jpeg'));
      }
    } else {
      toast({ variant: "destructive", title: "Capture Error", description: "Camera not ready." });
    }
  };

  const handleRetakePhoto = () => {
    setCapturedImage(null);
  };
  
  const handleUseCapturedPhoto = () => {
    if (capturedImage) {
      processAndLogImage(capturedImage);
    }
  };


  const handleBarcodeScannedAndLog = async (barcode: string) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "Please log in to save your meal log." });
      return;
    }
    const mealDescriptionForNutrition = `Item with barcode: ${barcode}`;
    const currentLoggedAt = Timestamp.now();
    const mealDataToSave = {
        type: 'barcode' as const,
        content: `Scanned: ${barcode}`,
        mealDescriptionForNutrition,
        barcodeData: barcode,
        loggedAt: currentLoggedAt,
        userId: user.uid,
    };
    try {
        const docRef = await addDoc(collection(firestore, "mealLogs"), mealDataToSave);
        const optimisticLog: LoggedMeal = {
            id: docRef.id,
            ...mealDataToSave,
            isEstimatingNutrition: true,
        };
        setRecentLogs(prev => [optimisticLog, ...prev.slice(0, MAX_RECENT_LOGS_TO_DISPLAY - 1)]);
        toast({ title: "Barcode Logged!", description: `Item ${barcode} saved. Estimating nutrition...`});
        
        await estimateAndSaveNutrition(docRef.id, mealDescriptionForNutrition, 'barcode');

    } catch (e) {
        console.error("Error logging barcode scan: ", e);
        toast({ variant: "destructive", title: "Barcode Log Error", description: "Failed to save barcode scan."});
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!user) return;
    setDeletingLogId(logId);
    try {
      await deleteDoc(doc(firestore, "mealLogs", logId));
      setRecentLogs(prevLogs => prevLogs.filter(log => log.id !== logId));
      toast({ title: "Log Deleted", description: "The meal log has been successfully removed." });
    } catch (error) {
      console.error("Error deleting meal log: ", error);
      toast({ variant: "destructive", title: "Delete Error", description: "Could not delete the meal log." });
    }
    setDeletingLogId(null);
  };
  
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
        <div className="space-y-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center flex items-center justify-center"><LogIn className="mr-2 h-6 w-6"/>Log In Required</CardTitle>
                    <CardDescription className="text-center">
                        Please log in to access the food logging features and view your meal history.
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
        <h1 className="text-3xl font-bold tracking-tight">Log Your Food</h1>
        <p className="text-muted-foreground">
          Track meals via photo, barcode, or manual entry. Nutritional info will be AI-estimated.
        </p>
      </header>
      
      <Dialog open={isCaptureModalOpen} onOpenChange={setIsCaptureModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Capture a Photo of Your Meal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
              <div className={cn("relative aspect-video w-full overflow-hidden rounded-md border bg-muted", { 'hidden': capturedImage })}>
                  <video ref={videoRef} className={cn("h-full w-full object-cover", {'hidden': !hasCameraPermission || capturedImage })} autoPlay muted playsInline />
                  {hasCameraPermission === null && !capturedImage && ( <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70"><Loader2 className="h-8 w-8 animate-spin text-white" /><p className="mt-2 text-white">Requesting camera...</p></div> )}
                  {hasCameraPermission === false && !capturedImage && ( <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4"><Alert variant="destructive"><Camera className="h-5 w-5" /><AlertTitle>Camera Issue</AlertTitle><AlertDescription>Could not access camera. Grant permission & refresh.</AlertDescription></Alert></div> )}
              </div>
              {capturedImage && ( <div className="flex justify-center"><Image src={capturedImage} alt="Meal preview" width={320} height={240} className="rounded-md object-cover" data-ai-hint="food meal"/></div> )}
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
            <DialogFooter className="gap-2 sm:justify-center">
                {!capturedImage && (
                    <div className='flex w-full justify-between items-center'>
                        <Button variant="outline" size="icon" onClick={() => setCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user')} disabled={!hasCameraPermission || isRecognizing}>
                            <RotateCw className='h-4 w-4' />
                        </Button>
                        <Button onClick={handleCapturePhoto} className="flex-grow ml-2" disabled={!hasCameraPermission || isRecognizing}>Capture</Button>
                    </div>
                )}
                {capturedImage && (
                    <>
                        <Button variant="outline" onClick={handleRetakePhoto} disabled={isRecognizing}>Retake</Button>
                        <Button onClick={handleUseCapturedPhoto} disabled={isRecognizing} className="w-full sm:w-auto">
                            {isRecognizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Use Photo & Log
                        </Button>
                    </>
                )}
                <DialogClose asChild><Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={isRecognizing}>Close</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      <Tabs defaultValue="photo" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="photo"><Camera className="mr-2 h-4 w-4 sm:hidden md:inline-block" />Photo</TabsTrigger>
          <TabsTrigger value="barcode"><Barcode className="mr-2 h-4 w-4 sm:hidden md:inline-block" />Barcode</TabsTrigger>
          <TabsTrigger value="manual"><Edit3 className="mr-2 h-4 w-4 sm:hidden md:inline-block" />Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="photo">
          <Card>
            <CardHeader>
              <CardTitle>Log with Photo (AI Recognition)</CardTitle>
              <CardDescription>Upload or capture a photo. AI will identify items, log the meal, and estimate nutrition.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...recognitionForm}>
                <form onSubmit={recognitionForm.handleSubmit(onUploadSubmit)} className="space-y-4">
                  <FormField
                    control={recognitionForm.control}
                    name="photo"
                    render={({ field }) => ( 
                      <FormItem>
                        <FormLabel>Meal Photo</FormLabel>
                        <div className="flex space-x-2">
                           <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-grow" disabled={!user}>
                                <Camera className="mr-2 h-4 w-4" /> Upload Photo
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsCaptureModalOpen(true)} className="flex-grow" disabled={!user}>
                                <Camera className="mr-2 h-4 w-4" /> Capture Photo
                            </Button>
                        </div>
                        <FormControl>
                          <Input 
                            type="file" 
                            accept="image/jpeg,image/png,image/webp"
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="hidden" 
                            id="photo-upload"
                            disabled={!user}
                          />
                        </FormControl>
                        {uploadImagePreview && (
                            <div className="mt-4 flex justify-center">
                                <Image src={uploadImagePreview} alt="Meal preview" width={200} height={200} className="rounded-md object-cover" data-ai-hint="food meal" />
                            </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isRecognizing || !uploadImagePreview || !recognitionForm.formState.isValid || !user} className="w-full md:w-auto">
                    {isRecognizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Log Uploaded Photo
                  </Button>
                </form>
              </Form>
              {isRecognizing && (
                <div className="mt-4 flex items-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing photo...
                </div>
              )}
              {recognizedFoodItems && !isRecognizing && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold">Identified Food Items:</h3>
                  {recognizedFoodItems.length > 0 ? (
                    <ul className="list-disc pl-5 text-muted-foreground">
                        {recognizedFoodItems.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Could not identify items from the photo. Try a clearer image.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="barcode">
          <BarcodeScannerTabContent onBarcodeScanned={handleBarcodeScannedAndLog} />
        </TabsContent>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Manual Food Log</CardTitle>
              <CardDescription>Enter details, log the meal, and AI will estimate nutrition.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...manualLogForm}>
                <form onSubmit={manualLogForm.handleSubmit(onManualLogSubmit)} className="space-y-4">
                  <FormField control={manualLogForm.control} name="foodItem" render={({ field }) => (
                    <FormItem><FormLabel>Food Item</FormLabel><FormControl><Input placeholder="e.g., Grilled Salmon" {...field} disabled={!user} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={manualLogForm.control} name="quantity" render={({ field }) => (
                    <FormItem><FormLabel>Quantity / Portion Size</FormLabel><FormControl><Input placeholder="e.g., 1 fillet, 100g" {...field} disabled={!user} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField control={manualLogForm.control} name="mealTime" render={({ field }) => (
                      <FormItem><FormLabel>Meal Time</FormLabel><FormControl><Input type="time" {...field} disabled={!user} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={manualLogForm.control} name="tags" render={({ field }) => (
                      <FormItem><FormLabel>Tags (e.g., people present, location - Optional)</FormLabel><FormControl><Input placeholder="e.g., With Sarah at The Cafe" {...field} disabled={!user} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={manualLogForm.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., felt a bit heavy afterwards" {...field} disabled={!user} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" disabled={isLoggingManual || !user} className="w-full md:w-auto">
                    {isLoggingManual ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Log Meal & Estimate
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

        <Card className="mt-8">
            <CardHeader>
                <CardTitle>Recent Meal Logs</CardTitle>
            </CardHeader>
            <CardContent>
                {(isLoadingLogs || authLoading) ? (
                     <div className="flex items-center justify-center py-6">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading recent logs...
                    </div>
                ) : recentLogs.length === 0 ? (
                    <p className="text-muted-foreground">No meals logged yet. Log one above to see it here.</p>
                ) : (
                    <ul className="space-y-4">
                        {recentLogs.map(log => (
                            <li key={log.id} className="rounded-md border p-4">
                                <div className="flex items-start space-x-3">
                                    {log.type === 'photo' && log.imagePreview && (
                                        <Image src={log.imagePreview} alt="Logged meal" width={60} height={60} className="rounded-md object-cover flex-shrink-0" data-ai-hint="food meal plate" />
                                    )}
                                    {(log.type === 'manual' || log.type === 'barcode') && (
                                        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted flex-shrink-0">
                                            {log.type === 'manual' && <Edit3 className="h-6 w-6 text-muted-foreground" />}
                                            {log.type === 'barcode' && <Barcode className="h-6 w-6 text-muted-foreground" />}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-foreground truncate">
                                            {Array.isArray(log.content) ? log.content.join(', ') : log.content}
                                        </p>
                                        <p className="text-xs text-muted-foreground flex items-center">
                                            <Clock className="mr-1 h-3 w-3" /> 
                                            { log.loggedAt ? log.loggedAt.toDate().toLocaleString() : 'Processing time...'} ({log.type})
                                        </p>
                                        {log.notes && <p className="text-xs text-muted-foreground mt-1 truncate">Notes: {log.notes}</p>}
                                        {log.tags && <p className="text-xs text-muted-foreground mt-1 flex items-center truncate"><Tag className="mr-1 h-3 w-3"/>{log.tags}</p>}
                                        {log.barcodeData && <p className="text-xs text-muted-foreground mt-1 truncate">Barcode: {log.barcodeData}</p>}
                                        
                                        {log.isEstimatingNutrition ? (
                                            <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Estimating nutrition...
                                            </div>
                                        ) : (log.estimatedCalories !== undefined) && (
                                            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                                                <p>Est. Nutrition: {log.estimatedCalories} kcal, {log.estimatedProtein}g P, {log.estimatedCarbs}g C, {log.estimatedFat}g F</p>
                                                {log.nutritionNotes && <p className="italic">Notes: {log.nutritionNotes}</p>}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteLog(log.id)}
                                        disabled={deletingLogId === log.id || !user}
                                        className="flex-shrink-0"
                                        aria-label="Delete log"
                                    >
                                        {deletingLogId === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
