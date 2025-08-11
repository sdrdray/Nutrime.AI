// src/app/grocery-list/page.tsx
"use client";

import React, { useState, useEffect, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Trash2, ListChecks, Loader2, Camera, CheckCircle, PackageSearch, RotateCw, LogIn } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { handleOcrGroceryList, handleSuggestHealthierAlternative } from '@/lib/actions';
import type { OcrGroceryListOutput } from '@/ai/flows/ocr-grocery-list-flow';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';


interface GroceryItem {
  id: string; // Firestore document ID
  name: string;
  category: string;
  checked: boolean;
  userId: string;
}

interface PantryItemInfo { // For pantry check
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: Date | Timestamp;
}

interface PantryCheckDetails {
  groceryItemName: string;
  groceryItemCategory: string;
  matchedPantryItem?: PantryItemInfo;
}

export default function GroceryListPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Other');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);
  const [hasOcrCameraPermission, setHasOcrCameraPermission] = useState<boolean | null>(null);
  const ocrVideoRef = useRef<HTMLVideoElement>(null);
  const ocrCanvasRef = useRef<HTMLCanvasElement>(null);
  const ocrStreamRef = useRef<MediaStream | null>(null);
  const [isRecognizingOcr, startRecognizingOcrTransition] = useTransition();
  const [ocrResults, setOcrResults] = useState<OcrGroceryListOutput | null>(null);
  const [addedOcrItems, setAddedOcrItems] = useState<string[]>([]);
  const [ocrCameraFacingMode, setOcrCameraFacingMode] = useState<'environment' | 'user'>('environment');


  // Pantry Integration State
  const [isPantryCheckModalOpen, setIsPantryCheckModalOpen] = useState(false);
  const [pantryCheckDetails, setPantryCheckDetails] = useState<PantryCheckDetails | null>(null);
  const [itemToAddAfterPantryCheck, setItemToAddAfterPantryCheck] = useState<{name: string, category: string} | null>(null);
  const [isCheckingPantry, startPantryCheckTransition] = useTransition();


  useEffect(() => {
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(firestore, "groceryItems"), where("userId", "==", user.uid), orderBy("category"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        const groceryList: GroceryItem[] = [];
        querySnapshot.forEach((doc) => {
          groceryList.push({ id: doc.id, ...doc.data() } as GroceryItem);
        });
        setItems(groceryList);
      } catch (error) {
        console.error("Error fetching grocery items: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch grocery items." });
      }
      setIsLoading(false);
    };
    fetchItems();
  }, [toast, user]);

  const addItem = async (name: string, category: string = 'Other', bypassPantryCheck: boolean = false) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "Please log in to add items." });
      return;
    }
    const trimmedName = name.trim();
    if (trimmedName === '') {
        toast({ variant: "destructive", title: "Invalid Input", description: "Item name cannot be empty." });
        return;
    }

    if (!bypassPantryCheck) {
      startPantryCheckTransition(async () => {
        try {
          const pantryQuery = query(collection(firestore, "pantryItems"), where("name", "==", trimmedName), where("userId", "==", user.uid));
          const pantrySnapshot = await getDocs(pantryQuery);
          
          let matchedPantryItem: PantryItemInfo | undefined = undefined;
          if (!pantrySnapshot.empty) {
            const pantryDoc = pantrySnapshot.docs[0];
            const data = pantryDoc.data();
            matchedPantryItem = {
                id: pantryDoc.id,
                name: data.name,
                quantity: data.quantity,
                unit: data.unit,
                expirationDate: data.expirationDate ? (data.expirationDate as Timestamp).toDate() : undefined
            };
          }

          if (matchedPantryItem) {
            setPantryCheckDetails({ groceryItemName: trimmedName, groceryItemCategory: category, matchedPantryItem });
            setItemToAddAfterPantryCheck({ name: trimmedName, category });
            setIsPantryCheckModalOpen(true);
            return;
          } else {
            await CcontinueAddItemFlow(trimmedName, category);
          }
        } catch (error) {
          console.error("Error checking pantry:", error);
          toast({ variant: "destructive", title: "Pantry Check Error", description: "Could not check pantry. Adding item directly." });
          await CcontinueAddItemFlow(trimmedName, category);
        }
      });
    } else {
      await CcontinueAddItemFlow(trimmedName, category);
    }
  };

  const CcontinueAddItemFlow = async (name: string, category: string) => {
     if (!user) return; // Guard clause
     const newItemData = {
      name: name,
      category: category.trim() || 'Other',
      checked: false,
      userId: user.uid,
    };

    startSavingTransition(async () => {
      try {
        const docRef = await addDoc(collection(firestore, "groceryItems"), newItemData);
        setItems(prevItems => [...prevItems, { id: docRef.id, ...newItemData }].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
        
        if (name === newItemName) { 
            setNewItemName('');
            setNewItemCategory('Other');
        }
        toast({ title: "Item Added", description: `${newItemData.name} was added to your list.` });

        try {
            const alternativeResult = await handleSuggestHealthierAlternative({ itemName: name });
            if (alternativeResult.suggestion) {
                toast({
                    title: `Nutrition Tip for ${name}`,
                    description: alternativeResult.suggestion,
                    duration: 7000, 
                });
            }
        } catch (altError) {
            console.warn("Could not fetch healthier alternative:", altError);
        }

      } catch (error) {
        console.error("Error adding item: ", error);
        toast({ variant: "destructive", title: "Save Error", description: `Could not add ${name}.` });
      }
    });
  };

  const handleManualAddItem = () => {
    addItem(newItemName, newItemCategory);
  }

  const toggleItemChecked = (id: string) => {
    const item = items.find(item => item.id === id);
    if (!item) return;

    const newCheckedState = !item.checked;

    startSavingTransition(async () => {
      try {
        const itemRef = doc(firestore, "groceryItems", id);
        await updateDoc(itemRef, { checked: newCheckedState });
        setItems(items.map(i => i.id === id ? { ...i, checked: newCheckedState } : i));
      } catch (error) {
        console.error("Error updating item: ", error);
        toast({ variant: "destructive", title: "Update Error", description: "Could not update item status." });
      }
    });
  };

  const removeItem = (id: string) => {
    const itemToRemove = items.find(i => i.id === id);
    startSavingTransition(async () => {
      try {
        await deleteDoc(doc(firestore, "groceryItems", id));
        setItems(items.filter(item => item.id !== id));
        if (itemToRemove) {
          toast({ title: "Item Removed", description: `${itemToRemove.name} was removed from your list.` });
        }
      } catch (error) {
        console.error("Error removing item: ", error);
        toast({ variant: "destructive", title: "Delete Error", description: "Could not remove the item." });
      }
    });
  };

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    const setupCamera = async () => {
      if (!isScanModalOpen || ocrImagePreview || ocrResults) { 
        if (ocrStreamRef.current) {
          ocrStreamRef.current.getTracks().forEach(track => track.stop());
          ocrStreamRef.current = null;
        }
        if (ocrVideoRef.current) ocrVideoRef.current.srcObject = null;
        return;
      }

      setHasOcrCameraPermission(null);
      if (ocrStreamRef.current) ocrStreamRef.current.getTracks().forEach(track => track.stop());
      if (ocrVideoRef.current) ocrVideoRef.current.srcObject = null;

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: ocrCameraFacingMode } });
        ocrStreamRef.current = currentStream;
        if (ocrVideoRef.current) {
          ocrVideoRef.current.srcObject = currentStream;
          await ocrVideoRef.current.play();
          setHasOcrCameraPermission(true);
        }
      } catch (error) {
        console.error('Error accessing OCR camera:', error);
        setHasOcrCameraPermission(false);
        toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera permissions.' });
      }
    };
    setupCamera();
    return () => {
      if (ocrStreamRef.current) ocrStreamRef.current.getTracks().forEach(track => track.stop());
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      if (ocrVideoRef.current) ocrVideoRef.current.srcObject = null;
    };
  }, [isScanModalOpen, ocrImagePreview, ocrResults, toast, ocrCameraFacingMode]);

  const handleOpenScanModal = () => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "Please log in to scan items." });
      return;
    }
    setOcrImagePreview(null);
    setOcrResults(null);
    setAddedOcrItems([]);
    setIsScanModalOpen(true);
  };

  const handleCloseScanModal = () => {
    setIsScanModalOpen(false);
  };

  const handleCaptureOcrPhoto = () => {
    if (ocrVideoRef.current && ocrCanvasRef.current && ocrVideoRef.current.srcObject && ocrVideoRef.current.readyState >= ocrVideoRef.current.HAVE_ENOUGH_DATA) {
      const video = ocrVideoRef.current;
      const canvas = ocrCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setOcrImagePreview(canvas.toDataURL('image/jpeg'));
      }
    } else {
      toast({ variant: "destructive", title: "Capture Error", description: "Camera not ready." });
    }
  };

  const handleRetakeOcrPhoto = () => {
    setOcrImagePreview(null);
    setOcrResults(null);
    setAddedOcrItems([]);
  };

  const handleUseOcrPhoto = async () => {
    if (!ocrImagePreview) return;
    startRecognizingOcrTransition(async () => {
      try {
        const result = await handleOcrGroceryList({ photoDataUri: ocrImagePreview });
        setOcrResults(result);
        if (!result.potentialItems || result.potentialItems.length === 0) {
          toast({ title: "OCR Complete", description: "No distinct grocery items found, or list was empty. You can view the raw text if available." });
        } else {
          toast({ title: "OCR Complete", description: "Potential items identified. Review and add them to your list." });
        }
      } catch (error) {
        toast({ variant: "destructive", title: "OCR Error", description: (error as Error).message });
        setOcrResults({potentialItems: [], rawExtractedText: "Error during OCR processing."});
      }
    });
  };

  const handleAddOcrItemToList = (itemName: string) => {
    addItem(itemName, "Scanned"); 
    setAddedOcrItems(prev => [...prev, itemName]);
  };

  const handlePantryCheckConfirm = () => {
    if (itemToAddAfterPantryCheck) {
      addItem(itemToAddAfterPantryCheck.name, itemToAddAfterPantryCheck.category, true);
    }
    setIsPantryCheckModalOpen(false);
    setItemToAddAfterPantryCheck(null);
    setPantryCheckDetails(null);
  };

  const handlePantryCheckCancel = () => {
    setIsPantryCheckModalOpen(false);
    setItemToAddAfterPantryCheck(null);
    setPantryCheckDetails(null);
    if (pantryCheckDetails?.groceryItemName) {
        toast({ title: "Item Not Added", description: `${pantryCheckDetails.groceryItemName} was not added to the grocery list.`});
    }
  };


  const groupedItems = items.reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  if (isLoading) {
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
                        Please log in to manage your grocery list.
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
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Grocery List</h1>
            <p className="text-muted-foreground">
            Manage your shopping list efficiently. Items from meal plans will appear here.
            </p>
        </div>
        <Button variant="outline" disabled> 
            <ListChecks className="mr-2 h-4 w-4" />
            Optimize List (Soon)
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add New Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Item name (e.g., Organic Spinach)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-grow"
              disabled={isSaving || isCheckingPantry}
            />
            <Input
              placeholder="Category (e.g., Produce)"
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              className="w-1/3"
              disabled={isSaving || isCheckingPantry}
            />
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={handleManualAddItem} size="icon" disabled={isSaving || isCheckingPantry || newItemName.trim() === ''}>
                        {(isSaving && newItemName.trim() !== '') || isCheckingPantry ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Add item manually</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={handleOpenScanModal} variant="outline" size="icon" disabled={isSaving || isCheckingPantry} aria-label="Scan handwritten list">
                            <Camera className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Scan handwritten list with OCR</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isScanModalOpen} onOpenChange={setIsScanModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Scan Handwritten Grocery List</DialogTitle>
            <DialogDescription>
              Capture an image of your list. The AI will try to extract items.
              Ensure good lighting and clear handwriting for best results.
            </DialogDescription>
          </DialogHeader>
          
          {!ocrResults ? ( 
            <div className="space-y-4 py-4">
              <div className={cn("relative aspect-video w-full overflow-hidden rounded-md border bg-muted", { 'hidden': ocrImagePreview })}>
                  <video ref={ocrVideoRef} className={cn("h-full w-full object-cover", {'hidden': !hasOcrCameraPermission || ocrImagePreview })} autoPlay muted playsInline />
                  {hasOcrCameraPermission === null && !ocrImagePreview && ( <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70"><Loader2 className="h-8 w-8 animate-spin text-white" /><p className="mt-2 text-white">Requesting camera...</p></div> )}
                  {hasOcrCameraPermission === false && !ocrImagePreview && ( <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4"><Alert variant="destructive"><Camera className="h-5 w-5" /><AlertTitle>Camera Issue</AlertTitle><AlertDescription>Could not access camera. Grant permission & refresh if needed.</AlertDescription></Alert></div> )}
                  {hasOcrCameraPermission && !ocrImagePreview && ( <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-3/4 h-2/3 border-2 border-dashed border-green-500 rounded-lg opacity-75"></div></div> )}
              </div>
              {ocrImagePreview && ( <div className="flex justify-center"><Image src={ocrImagePreview} alt="Grocery list preview" width={320} height={240} className="rounded-md object-cover" data-ai-hint="handwritten list"/></div> )}
              <canvas ref={ocrCanvasRef} className="hidden"></canvas>
            </div>
          ) : ( 
            <div className="py-4 space-y-3">
              <h3 className="font-semibold text-lg">Potential Items Identified:</h3>
              {isRecognizingOcr && (
                <div className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing image with AI...</div>
              )}
              {!isRecognizingOcr && ocrResults && ocrResults.potentialItems.length > 0 && (
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  <ul className="space-y-2">
                    {ocrResults.potentialItems.map((item, index) => (
                      <li key={index} className="flex items-center justify-between">
                        <span>{item}</span>
                        <Button
                          size="sm"
                          variant={addedOcrItems.includes(item) ? "ghost" : "default"}
                          onClick={() => handleAddOcrItemToList(item)}
                          disabled={addedOcrItems.includes(item) || isSaving || isCheckingPantry}
                        >
                          {addedOcrItems.includes(item) ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                          {addedOcrItems.includes(item) ? 'Added' : 'Add'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
              {!isRecognizingOcr && ocrResults && ocrResults.potentialItems.length === 0 && (
                <p className="text-muted-foreground">No distinct grocery items were identified by the AI. You can try again with a clearer image.</p>
              )}
              {ocrResults?.rawExtractedText && (
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="raw-text">
                    <AccordionTrigger className="text-sm">View Raw Extracted Text (for debugging)</AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-[100px] bg-muted/50 p-2 rounded-md">
                        <pre className="text-xs whitespace-pre-wrap">{ocrResults.rawExtractedText}</pre>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-center">
            {!ocrImagePreview && !ocrResults && (
              <div className='flex w-full justify-between items-center'>
                <Button variant="outline" size="icon" onClick={() => setOcrCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user')} disabled={!hasOcrCameraPermission || isRecognizingOcr}>
                    <RotateCw className='h-4 w-4' />
                </Button>
                <Button onClick={handleCaptureOcrPhoto} className="flex-grow ml-2" disabled={!hasOcrCameraPermission || isRecognizingOcr}>Capture Photo</Button>
              </div>
            )}
            {ocrImagePreview && !ocrResults && (
              <>
                <Button variant="outline" onClick={handleRetakeOcrPhoto} disabled={isRecognizingOcr}>Retake</Button>
                <Button onClick={handleUseOcrPhoto} disabled={isRecognizingOcr} className="w-full sm:w-auto">
                  {isRecognizingOcr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Use Photo & Recognize
                </Button>
              </>
            )}
            {ocrResults && (
                <Button variant="outline" onClick={handleRetakeOcrPhoto}>Scan New List</Button>
            )}
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={isRecognizingOcr}>
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isPantryCheckModalOpen} onOpenChange={setIsPantryCheckModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Item Already in Pantry</AlertDialogTitle>
            <AlertDialogDescription>
              {pantryCheckDetails?.matchedPantryItem ? (
                <>
                  You seem to already have <strong>{pantryCheckDetails.matchedPantryItem.name}</strong> (Quantity: {pantryCheckDetails.matchedPantryItem.quantity} {pantryCheckDetails.matchedPantryItem.unit}) in your pantry.
                  <br />
                  Do you still want to add <strong>{pantryCheckDetails.groceryItemName}</strong> to your grocery list?
                </>
              ) : (
                `Checking pantry for ${pantryCheckDetails?.groceryItemName}...`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handlePantryCheckCancel}>No, Don't Add</AlertDialogCancel>
            <AlertDialogAction onClick={handlePantryCheckConfirm} disabled={!pantryCheckDetails?.matchedPantryItem}>Yes, Add to List</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Card>
        <CardHeader>
          <CardTitle>Your Shopping List</CardTitle>
          <CardDescription>
            Items are grouped by category. Check them off as you shop.
            {(isLoading || isCheckingPantry) && <Loader2 className="inline ml-2 h-4 w-4 animate-spin" />}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 text-center">
                <PackageSearch className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Your grocery list is empty. Add items manually or from a scan!</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {Object.entries(groupedItems).map(([category, categoryItems]) => (
                  <div key={category}>
                    <h3 className="mb-2 text-lg font-semibold text-primary">{category}</h3>
                    <ul className="space-y-2">
                      {categoryItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50"
                        >
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={`item-${item.id}`}
                              checked={item.checked}
                              onCheckedChange={() => toggleItemChecked(item.id)}
                              disabled={isSaving}
                            />
                            <label
                              htmlFor={`item-${item.id}`}
                              className={`text-sm ${item.checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                            >
                              {item.name}
                            </label>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} disabled={isSaving}>
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

      