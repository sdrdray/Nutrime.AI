// src/app/community/safe-lists/[id]/page.tsx
"use client";

import { useEffect, useState, useTransition } from 'react';
import { doc, getDoc, collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { SafeList, SafeListItem } from '@/lib/types';
import { notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Loader2, PlusCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { handleAddItemToSafeList } from '@/lib/actions';
import { format } from 'date-fns';

export default function SafeListDetailsPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [list, setList] = useState<SafeList | null>(null);
  const [items, setItems] = useState<SafeListItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, startAddingTransition] = useTransition();

  useEffect(() => {
    const listRef = doc(firestore, "safeLists", params.id);
    const unsubscribeList = onSnapshot(listRef, (docSnap) => {
      if (docSnap.exists()) {
        setList({ id: docSnap.id, ...docSnap.data() } as SafeList);
      } else {
        setList(null);
      }
      setIsLoading(false);
    });

    const itemsQuery = query(collection(firestore, "safeLists", params.id, "items"), orderBy("createdAt", "asc"));
    const unsubscribeItems = onSnapshot(itemsQuery, (querySnapshot) => {
        const fetchedItems: SafeListItem[] = [];
        querySnapshot.forEach((doc) => {
            fetchedItems.push({ id: doc.id, ...doc.data() } as SafeListItem);
        });
        setItems(fetchedItems);
    });

    return () => {
      unsubscribeList();
      unsubscribeItems();
    };
  }, [params.id]);

  const onAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to add items." });
      return;
    }
    if (!newItemText.trim()) return;

    startAddingTransition(async () => {
      const result = await handleAddItemToSafeList({
        listId: params.id,
        text: newItemText,
        userId: user.uid,
        author: user.displayName || user.email || 'Anonymous',
      });

      if (result.success) {
        setNewItemText('');
        toast({ title: "Item Added!" });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!list) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <Button asChild variant="outline" size="sm">
          <Link href="/community/safe-lists">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to All Safe Lists
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{list.title}</CardTitle>
          <CardDescription>{list.description}</CardDescription>
          <CardDescription>Created by {list.author} on {format((list.createdAt as Timestamp).toDate(), "PPP")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.length > 0 ? (
              <ul className="list-disc pl-5 space-y-2">
                {items.map(item => (
                  <li key={item.id} className="text-sm">
                    {item.text}
                    <span className="text-xs text-muted-foreground ml-2"> (added by {item.author})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No items have been added to this list yet. Be the first!</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Contribute to the List</CardTitle>
        </CardHeader>
        <CardContent>
            {user ? (
                <form onSubmit={onAddItem} className="flex gap-2">
                    <Input 
                        placeholder="Add a safe product or meal idea..."
                        value={newItemText}
                        onChange={e => setNewItemText(e.target.value)}
                        disabled={isAdding}
                    />
                    <Button type="submit" disabled={isAdding || !newItemText.trim()}>
                        {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                        Add
                    </Button>
                </form>
            ): (
                <p className="text-sm text-muted-foreground">
                    Please <Link href="/settings" className="text-primary underline">log in</Link> to contribute to this list.
                </p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
