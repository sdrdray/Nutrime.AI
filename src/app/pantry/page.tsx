// src/app/pantry/page.tsx
"use client";

import React, { useState, useEffect, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Minus, Plus, Edit2, PackageSearch, Loader2, Camera, RotateCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { handleRecognizeFood } from '@/lib/actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';


interface PantryItem {
  id: string; // Firestore document ID
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: Date | Timestamp; // Can be Date for input, Timestamp from Firestore
  barcode?: string;
  userId?: string;
}

export default function PantryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);

  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemExpirationDate, setNewItemExpirationDate] = useState<Date | undefined>(undefined);
  const [newItemBarcode, setNewItemBarcode] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  // Camera Scan States
  const [isCameraScanMode, setIsCameraScanMode] = useState(false);
  const [pantryScanImagePreview, setPantryScanImagePreview] = useState<string | null>(null);
  const [hasPantryScanCameraPermission, setHasPantryScanCameraPermission] = useState<boolean | null>(null);
  const [isRecognizingPantryItem, startRecognizingPantryItemTransition] = useTransition();
  const pantryScanVideoRef = useRef<HTMLVideoElement>(null);
  const pantryScanCanvasRef = useRef<HTMLCanvasElement>(null);
  const pantryScanStreamRef = useRef<MediaStream | null>(null);
  const [pantryCameraFacingMode, setPantryCameraFacingMode] = useState<'environment' | 'user'>('environment');


  // Multi-item OCR states
  const [ocrRecognizedItems, setOcrRecognizedItems] = useState<string[] | null>(null);
  const [showOcrPantryResultsList, setShowOcrPantryResultsList] = useState(false);
  const [selectedOcrItemForFormFill, setSelectedOcrItemForFormFill] = useState<string | null>(null);


  useEffect(() => {
    const fetchItems = async () => {
      if (!user) {
        setIsLoading(false);
        setItems([]);
        return;
      }
      setIsLoading(true);
      try {
        const q = query(collection(firestore, "pantryItems"), where("userId", "==", user.uid), orderBy("name"));
        const querySnapshot = await getDocs(q);
        const pantryList: PantryItem[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          pantryList.push({
            id: doc.id,
            name: data.name,
            quantity: data.quantity,
            unit: data.unit,
            expirationDate: data.expirationDate ? (data.expirationDate as Timestamp).toDate() : undefined,
            barcode: data.barcode,
            userId: data.userId,
          });
        });
        setItems(pantryList);
      } catch (error) {
        console.error("Error fetching pantry items: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch pantry items." });
      }
      setIsLoading(false);
    };
    fetchItems();
  }, [toast, user]);

  const resetFormFields = () => {
    setNewItemName('');
    setNewItemQuantity(1);
    setNewItemUnit('');
    setNewItemExpirationDate(undefined);
    setNewItemBarcode('');
  };

  const resetOcrStates = () => {
    setPantryScanImagePreview(null);
    setOcrRecognizedItems(null);
    setShowOcrPantryResultsList(false);
    setSelectedOcrItemForFormFill(null);
    setIsCameraScanMode(false); 
     if (pantryScanStreamRef.current) {
        pantryScanStreamRef.current.getTracks().forEach(track => track.stop());
        pantryScanStreamRef.current = null;
    }
    if (pantryScanVideoRef.current) pantryScanVideoRef.current.srcObject = null;
  };

  const handleOpenModal = (item?: PantryItem, scanFirst: boolean = false) => {
    resetOcrStates(); 
    if (scanFirst) {
      setEditingItem(null);
      resetFormFields();
      setIsCameraScanMode(true); 
    } else if (item) {
      setEditingItem(item);
      setNewItemName(item.name);
      setNewItemQuantity(item.quantity);
      setNewItemUnit(item.unit);
      setNewItemExpirationDate(item.expirationDate instanceof Timestamp ? item.expirationDate.toDate() : item.expirationDate);
      setNewItemBarcode(item.barcode || '');
      setIsCameraScanMode(false);
    } else { 
      setEditingItem(null);
      resetFormFields();
      setIsCameraScanMode(false);
    }
    setIsModalOpen(true);
  };
  
  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      resetOcrStates();
      setEditingItem(null); 
      resetFormFields();
    }
  };


  const handleSaveItem = () => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "Please log in to save items." });
      return;
    }
    if (newItemName.trim() === '' || newItemUnit.trim() === '' || newItemQuantity < 0) {
        toast({ variant: "destructive", title: "Invalid Input", description: "Item name, unit, and a valid quantity are required." });
        return;
    }

    startSavingTransition(async () => {
      const itemDataToSave = {
        name: newItemName.trim(),
        quantity: newItemQuantity,
        unit: newItemUnit.trim(),
        expirationDate: newItemExpirationDate ? Timestamp.fromDate(newItemExpirationDate) : null,
        barcode: newItemBarcode.trim() || null,
        userId: user.uid,
      };

      try {
        let savedItemSuccess = false;
        if (editingItem) {
          const itemRef = doc(firestore, "pantryItems", editingItem.id);
          await updateDoc(itemRef, itemDataToSave);
          setItems(items.map(i => i.id === editingItem.id ? { ...i, ...itemDataToSave, expirationDate: newItemExpirationDate } : i).sort((a, b) => a.name.localeCompare(b.name)));
          toast({ title: "Item Updated", description: `${itemDataToSave.name} was successfully updated.` });
          savedItemSuccess = true;
        } else {
          const docRef = await addDoc(collection(firestore, "pantryItems"), itemDataToSave);
          setItems([...items, { id: docRef.id, ...itemDataToSave, expirationDate: newItemExpirationDate }].sort((a, b) => a.name.localeCompare(b.name)));
          toast({ title: "Item Added", description: `${itemDataToSave.name} was successfully added to your pantry.` });
          savedItemSuccess = true;
        }
        
        if (savedItemSuccess) {
            const cameFromOcrSelection = selectedOcrItemForFormFill !== null;
            resetFormFields(); 

            if (cameFromOcrSelection) {
                const updatedOcrItems = ocrRecognizedItems?.filter(i => i !== selectedOcrItemForFormFill) || [];
                setSelectedOcrItemForFormFill(null);

                if (updatedOcrItems.length > 0) {
                    setOcrRecognizedItems(updatedOcrItems);
                    setShowOcrPantryResultsList(true); 
                } else {
                    setOcrRecognizedItems(null);
                    setShowOcrPantryResultsList(false);
                    setPantryScanImagePreview(null); 
                    handleModalOpenChange(false); 
                }
            } else {
                setOcrRecognizedItems(null);
                setShowOcrPantryResultsList(false);
                setSelectedOcrItemForFormFill(null);
                setPantryScanImagePreview(null);
                handleModalOpenChange(false);
            }
        }

      } catch (error) {
        console.error("Error saving item: ", error);
        toast({ variant: "destructive", title: "Save Error", description: "Could not save the item." });
      }
    });
  };

  const removeItem = async (id: string) => {
    startSavingTransition(async () => {
      try {
        await deleteDoc(doc(firestore, "pantryItems", id));
        setItems(items.filter(item => item.id !== id));
        toast({ title: "Item Removed", description: "The item was removed from your pantry." });
      } catch (error) {
        console.error("Error removing item: ", error);
        toast({ variant: "destructive", title: "Delete Error", description: "Could not remove the item." });
      }
    });
  };

  const updateQuantity = async (id: string, amount: number) => {
    const itemToUpdate = items.find(item => item.id === id);
    if (!itemToUpdate) return;

    const newQuantity = Math.max(0, itemToUpdate.quantity + amount);

    startSavingTransition(async () => {
      try {
        if (newQuantity === 0) {
          await deleteDoc(doc(firestore, "pantryItems", id));
          setItems(items.filter(item => item.id !== id));
          toast({ title: "Item Removed", description: `${itemToUpdate.name} was removed as quantity reached zero.` });
        } else {
          const itemRef = doc(firestore, "pantryItems", id);
          await updateDoc(itemRef, { quantity: newQuantity });
          setItems(items.map(item => item.id === id ? { ...item, quantity: newQuantity } : item));
           toast({ title: "Quantity Updated", description: `Quantity for ${itemToUpdate.name} updated.` });
        }
      } catch (error) {
        console.error("Error updating quantity: ", error);
        toast({ variant: "destructive", title: "Update Error", description: "Could not update item quantity." });
      }
    });
  };
  
  const getExpirationDateDisplay = (dateValue?: Date | Timestamp): string => {
    if (!dateValue) return 'N/A';
    const date = dateValue instanceof Timestamp ? dateValue.toDate() : dateValue;
    return format(date, 'MMM dd, yyyy');
  };

  const isItemExpired = (dateValue?: Date | Timestamp): boolean => {
    if (!dateValue) return false;
    const date = dateValue instanceof Timestamp ? dateValue.toDate() : dateValue;
    const today = new Date();
    today.setHours(0,0,0,0);
    date.setHours(0,0,0,0);
    return date < today;
  };

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    const setupCamera = async () => {
      if (!isModalOpen || !isCameraScanMode || pantryScanImagePreview || showOcrPantryResultsList) {
        if (pantryScanStreamRef.current) {
          pantryScanStreamRef.current.getTracks().forEach(track => track.stop());
          pantryScanStreamRef.current = null;
        }
        if (pantryScanVideoRef.current) pantryScanVideoRef.current.srcObject = null;
        return;
      }

      setHasPantryScanCameraPermission(null);
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: pantryCameraFacingMode } });
        pantryScanStreamRef.current = currentStream;
        if (pantryScanVideoRef.current) {
          pantryScanVideoRef.current.srcObject = currentStream;
          await pantryScanVideoRef.current.play();
          setHasPantryScanCameraPermission(true);
        }
      } catch (error) {
        console.error('Error accessing pantry scan camera:', error);
        setHasPantryScanCameraPermission(false);
        toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera permissions.' });
      }
    };
    setupCamera();
    return () => { 
      if (pantryScanStreamRef.current) pantryScanStreamRef.current.getTracks().forEach(track => track.stop());
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      if (pantryScanVideoRef.current) pantryScanVideoRef.current.srcObject = null;
    };
  }, [isModalOpen, isCameraScanMode, pantryScanImagePreview, showOcrPantryResultsList, toast, pantryCameraFacingMode]);

  const handleCapturePantryPhoto = () => {
    if (pantryScanVideoRef.current && pantryScanCanvasRef.current && pantryScanVideoRef.current.srcObject && pantryScanVideoRef.current.readyState >= pantryScanVideoRef.current.HAVE_ENOUGH_DATA) {
      const video = pantryScanVideoRef.current;
      const canvas = pantryScanCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPantryScanImagePreview(canvas.toDataURL('image/jpeg'));
      }
    } else {
      toast({ variant: "destructive", title: "Capture Error", description: "Camera not ready." });
    }
  };

  const handleRetakePantryPhoto = () => {
    setPantryScanImagePreview(null); 
    setOcrRecognizedItems(null);    
    setShowOcrPantryResultsList(false); 
    setSelectedOcrItemForFormFill(null); 
    resetFormFields(); 
    setIsCameraScanMode(true); 
  };

  const handleUsePantryPhotoAndRecognize = async () => {
    if (!pantryScanImagePreview) return;
    startRecognizingPantryItemTransition(async () => {
      try {
        const result = await handleRecognizeFood({ photoDataUri: pantryScanImagePreview });
        if (result.foodItems && result.foodItems.length > 0) {
          setOcrRecognizedItems(result.foodItems);
          setShowOcrPantryResultsList(true);
          setIsCameraScanMode(false); 
          setSelectedOcrItemForFormFill(null);
          toast({ title: "Items Recognized!", description: "Select items from the list to add." });
        } else {
          toast({ title: "No Items Recognized", description: "Could not recognize items. Please enter details manually." });
          setShowOcrPantryResultsList(false);
          setIsCameraScanMode(false); 
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Recognition Error", description: (error as Error).message });
        setShowOcrPantryResultsList(false);
        setIsCameraScanMode(false); 
      }
    });
  };

  const handlePrepareFormWithOcrItem = (itemName: string) => {
    setNewItemName(itemName);
    setNewItemQuantity(1);
    setNewItemUnit('');
    setNewItemExpirationDate(undefined);
    setNewItemBarcode('');
    setSelectedOcrItemForFormFill(itemName);
    setShowOcrPantryResultsList(false); 
    setPantryScanImagePreview(null); 
    setIsCameraScanMode(false); 
  };

  const dialogContent = () => {
    if (isCameraScanMode && !pantryScanImagePreview && !showOcrPantryResultsList) { 
      return (
        <div className="space-y-4 py-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
            <video ref={pantryScanVideoRef} className={cn("h-full w-full object-cover", {'hidden': !hasPantryScanCameraPermission })} autoPlay muted playsInline />
            {hasPantryScanCameraPermission === null && ( <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70"><Loader2 className="h-8 w-8 animate-spin text-white" /><p className="mt-2 text-white">Requesting camera...</p></div> )}
            {hasPantryScanCameraPermission === false && ( <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4"><Alert variant="destructive"><Camera className="h-5 w-5" /><AlertTitle>Camera Issue</AlertTitle><AlertDescription>Could not access camera. Grant permission & refresh.</AlertDescription></Alert></div> )}
          </div>
          <canvas ref={pantryScanCanvasRef} className="hidden"></canvas>
        </div>
      );
    } else if (pantryScanImagePreview && !showOcrPantryResultsList && isCameraScanMode) { 
      return (
        <div className="space-y-4 py-4">
          <div className="flex justify-center"><Image src={pantryScanImagePreview} alt="Pantry item preview" width={240} height={180} className="rounded-md object-cover" data-ai-hint="food product"/></div>
          <canvas ref={pantryScanCanvasRef} className="hidden"></canvas>
        </div>
      );
    } else if (showOcrPantryResultsList && ocrRecognizedItems && ocrRecognizedItems.length > 0) { 
      return (
        <div className="py-4 space-y-3">
          <h3 className="font-semibold">Recognized Items:</h3>
          <ScrollArea className="h-[200px] border rounded-md p-2">
            <ul className="space-y-2">
              {ocrRecognizedItems.map((item, index) => (
                <li key={index} className="flex items-center justify-between p-1 hover:bg-muted/50 rounded-md">
                  <span>{item}</span>
                  <Button size="sm" onClick={() => handlePrepareFormWithOcrItem(item)} disabled={isSaving || isRecognizingPantryItem}>
                    Add This
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      );
    } else { 
      return (
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="col-span-3" placeholder="e.g., Quinoa" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">Quantity</Label>
            <Input id="quantity" type="number" value={newItemQuantity} onChange={(e) => setNewItemQuantity(parseInt(e.target.value) < 0 ? 0 : parseInt(e.target.value))} className="col-span-3" min="0"/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unit" className="text-right">Unit</Label>
            <Input id="unit" value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} className="col-span-3" placeholder="e.g., kg, pack, can"/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="expiration" className="text-right">Expires</Label>
            <DatePicker date={newItemExpirationDate} setDate={setNewItemExpirationDate} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="barcode" className="text-right">Barcode</Label>
            <Input id="barcode" value={newItemBarcode} onChange={(e) => setNewItemBarcode(e.target.value)} className="col-span-3" placeholder="Scan or enter manually (optional)" />
          </div>
        </div>
      );
    }
  };

  const dialogFooterContent = () => {
    if (isCameraScanMode && !pantryScanImagePreview && !showOcrPantryResultsList) { 
      return (
        <>
            <div className='flex w-full justify-between items-center'>
                <Button variant="outline" size="icon" onClick={() => setPantryCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user')} disabled={!hasPantryScanCameraPermission || isRecognizingPantryItem}>
                    <RotateCw className='h-4 w-4' />
                </Button>
                <Button onClick={handleCapturePantryPhoto} className="flex-grow ml-2" disabled={!hasPantryScanCameraPermission || isRecognizingPantryItem}>Capture Photo</Button>
            </div>
          <DialogClose asChild><Button type="button" variant="outline" onClick={() => handleModalOpenChange(false)} className="w-full sm:w-auto mt-2 sm:mt-0">Cancel Scan</Button></DialogClose>
        </>
      );
    } else if (pantryScanImagePreview && !showOcrPantryResultsList && isCameraScanMode) { 
      return (
        <>
          <Button variant="outline" onClick={handleRetakePantryPhoto} disabled={isRecognizingPantryItem}>Retake</Button>
          <Button onClick={handleUsePantryPhotoAndRecognize} disabled={isRecognizingPantryItem} className="w-full sm:w-auto">
            {isRecognizingPantryItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Use Photo & Recognize
          </Button>
          <DialogClose asChild><Button type="button" variant="outline" onClick={() => handleModalOpenChange(false)} className="w-full sm:w-auto">Cancel Scan</Button></DialogClose>
        </>
      );
    } else if (showOcrPantryResultsList) { 
       return (
        <>
            <Button variant="outline" onClick={handleRetakePantryPhoto} disabled={isRecognizingPantryItem || isSaving}>
            Scan New Photo
          </Button>
          <DialogClose asChild><Button type="button" variant="secondary" onClick={() => handleModalOpenChange(false)} className="w-full sm:w-auto" disabled={isRecognizingPantryItem || isSaving}>Done Adding</Button></DialogClose>
        </>
       );
    } else { 
      return (
        <>
          <DialogClose asChild><Button type="button" variant="outline" onClick={() => handleModalOpenChange(false)} disabled={isSaving}>Cancel</Button></DialogClose>
          <Button type="submit" onClick={handleSaveItem} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </>
      );
    }
  };


  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Pantry Inventory</h1>
            <p className="text-muted-foreground">
            Manage your pantry items, track quantities, and set expiration dates.
            </p>
        </div>
        <div className="flex space-x-2">
            <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
                <DialogTrigger asChild>
                    <Button onClick={() => handleOpenModal(undefined, true)} disabled={!user}>
                        <Camera className="mr-2 h-4 w-4" /> Scan Item
                    </Button>
                </DialogTrigger>
                <DialogTrigger asChild>
                    <Button onClick={() => handleOpenModal()} disabled={!user}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Manually
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                    <DialogTitle>
                        {editingItem ? 'Edit Item' : 
                         (isCameraScanMode && !pantryScanImagePreview && !showOcrPantryResultsList) ? 'Scan New Item' : 
                         (pantryScanImagePreview && !showOcrPantryResultsList && isCameraScanMode) ? 'Confirm Photo' :
                         showOcrPantryResultsList ? 'Select Recognized Item' : 
                         'Add New Item'}
                    </DialogTitle>
                    <DialogDescription>
                        {editingItem ? 'Update the details of your pantry item.' :
                         (isCameraScanMode && !pantryScanImagePreview && !showOcrPantryResultsList) ? 'Position the item in front of the camera and capture a photo.' :
                         (pantryScanImagePreview && !showOcrPantryResultsList && isCameraScanMode) ? 'Review the captured photo. Use it or retake.' :
                         showOcrPantryResultsList ? 'Select an item recognized from your photo to add to the form.' :
                         'Add a new item to your pantry inventory.'}
                    </DialogDescription>
                    </DialogHeader>
                    
                    {dialogContent()}

                    <DialogFooter className="gap-2 sm:justify-center">
                       {dialogFooterContent()}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Your Pantry Items</CardTitle>
          <CardDescription>
            View and manage your current pantry stock. {isLoading && <Loader2 className="inline ml-2 h-4 w-4 animate-spin" />}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : !user ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <PackageSearch className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Please log in to view and manage your pantry.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <PackageSearch className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Your pantry is empty. Add some items to get started!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className={isItemExpired(item.expirationDate) ? "bg-destructive/10" : ""}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, -1)} disabled={isSaving || isRecognizingPantryItem}><Minus className="h-3 w-3" /></Button>
                        <span>{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, 1)} disabled={isSaving || isRecognizingPantryItem}><Plus className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      {getExpirationDateDisplay(item.expirationDate)}
                      {isItemExpired(item.expirationDate) && <span className="ml-2 text-xs text-destructive font-semibold">(Expired)</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(item)} disabled={isSaving || isRecognizingPantryItem}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(item.id)} disabled={isSaving || isRecognizingPantryItem}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
       {/* Placeholder for barcode scanning */}
        <Card>
            <CardHeader>
            <CardTitle>Quick Add with Product Barcode (Coming Soon)</CardTitle>
            </CardHeader>
            <CardContent>
            <p className="text-muted-foreground">Soon you'll be able to quickly add items by scanning their product barcodes.</p>
            <Button disabled className="mt-2">Scan Product Barcode</Button>
            </CardContent>
        </Card>
    </div>
  );
}
