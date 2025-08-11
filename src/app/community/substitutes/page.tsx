// src/app/community/substitutes/page.tsx
"use client";

import React, { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, GitMerge } from 'lucide-react';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { IngredientSubstitute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { handleSuggestSubstitute } from '@/lib/actions';
import SubstituteCard from '@/components/community/substitute-card';
import Link from 'next/link';

export default function AllSubstitutesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allSubstitutes, setAllSubstitutes] = useState<IngredientSubstitute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, startSubmittingTransition] = useTransition();

  const [original, setOriginal] = useState('');
  const [substitute, setSubstitute] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchAllSubstitutes() {
      setIsLoading(true);
      const substitutesCollection = collection(firestore, "ingredientSubstitutes");
      const q = query(substitutesCollection, orderBy("confirmedByCount", "desc"));
      const querySnapshot = await getDocs(q);
      const subs: IngredientSubstitute[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IngredientSubstitute[];
      setAllSubstitutes(subs);
      setIsLoading(false);
    }
    fetchAllSubstitutes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to suggest a substitute." });
      return;
    }
    if (!original.trim() || !substitute.trim()) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill out the ingredient and its substitute." });
      return;
    }

    startSubmittingTransition(async () => {
      const result = await handleSuggestSubstitute({
        originalIngredient: original,
        substituteIngredient: substitute,
        notes,
        userId: user.uid,
        author: user.displayName || user.email || 'Anonymous',
      });

      if (result.success && result.newSubstitute) {
        toast({ title: "Suggestion Submitted!", description: "Thank you for contributing to the community." });
        setOriginal('');
        setSubstitute('');
        setNotes('');
        // Optimistically add to list or re-fetch
        setAllSubstitutes(prev => [{...result.newSubstitute, dislikedBy: [], dislikedByCount: 0}, ...prev]);
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <GitMerge className="mr-3 h-8 w-8 text-primary" />
            Ingredient Substitute Helper
          </h1>
          <p className="mt-1 text-muted-foreground">
            Find and share crowd-sourced alternatives for common ingredients.
          </p>
        </div>
        <Button asChild>
          <Link href="/community">Back to Community Hub</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Suggest a New Substitute</CardTitle>
          <CardDescription>
            Help others by sharing an alternative that works for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input placeholder="Original Ingredient (e.g., Onion)" value={original} onChange={(e) => setOriginal(e.target.value)} disabled={isSubmitting} required />
                <Input placeholder="Substitute Ingredient (e.g., Asafoetida)" value={substitute} onChange={(e) => setSubstitute(e.target.value)} disabled={isSubmitting} required />
              </div>
              <Textarea placeholder="Notes (optional, e.g., 'Use sparingly' or 'Best for soups')" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isSubmitting} />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Submit Suggestion
              </Button>
            </form>
          ) : (
            <p className="text-muted-foreground">
              Please <Link href="/settings" className="text-primary underline">log in</Link> to suggest a substitute.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">Community-Sourced Substitutes</h2>
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allSubstitutes.length > 0 ? (
              allSubstitutes.map((sub) => (
                <SubstituteCard key={sub.id} substitute={sub} />
              ))
            ) : (
              <p className="text-muted-foreground text-center col-span-full py-10">
                No substitutes found. Be the first to add one!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
