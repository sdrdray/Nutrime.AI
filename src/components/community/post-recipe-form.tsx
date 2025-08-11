// src/components/community/post-recipe-form.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2 } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useToast } from "@/hooks/use-toast";
import { handlePostRecipe } from '@/lib/actions';
import Link from 'next/link';

export default function PostRecipeForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to post a recipe." });
      return;
    }
    if (!title.trim() || !ingredients.trim() || !instructions.trim()) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill out the title, ingredients, and instructions." });
      return;
    }

    startTransition(async () => {
      const ingredientsArray = ingredients.split('\n').filter(line => line.trim() !== '');
      const result = await handlePostRecipe({
        title,
        description,
        ingredients: ingredientsArray,
        instructions,
        userId: user.uid,
        author: user.displayName || user.email || 'Anonymous',
      });

      if (result.success) {
        toast({ title: "Recipe Posted!", description: "Your recipe is now live for the community to see." });
        setTitle('');
        setDescription('');
        setIngredients('');
        setInstructions('');
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Share Your Culinary Creations!</CardTitle>
          <CardDescription>
            <Link href="/settings" className="text-primary underline">Log in</Link> to share your recipes with the community.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Share Your Culinary Creations!</CardTitle>
        <CardDescription>Have a recipe that works well for you? Share it with the community.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Your Recipe Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isPending} required />
          <Textarea placeholder="A brief description of your recipe..." value={description} onChange={(e) => setDescription(e.target.value)} disabled={isPending} />
          <Textarea placeholder="Ingredients (one per line)..." value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={5} disabled={isPending} required />
          <Textarea placeholder="Instructions..." value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={7} disabled={isPending} required />
          <Button className="w-full md:w-auto" disabled={isPending} type="submit">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Post Recipe
          </Button>
          <p className="text-xs text-muted-foreground">AI suggestions for adaptations will be added after posting.</p>
        </form>
      </CardContent>
    </Card>
  );
}
