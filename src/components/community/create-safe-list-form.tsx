// src/components/community/create-safe-list-form.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2 } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useToast } from "@/hooks/use-toast";
import { handleCreateSafeList } from '@/lib/actions';
import { useRouter } from 'next/navigation';

export default function CreateSafeListForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to create a list." });
      return;
    }
    if (!title.trim() || !description.trim() || !category.trim()) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill out all fields." });
      return;
    }

    startTransition(async () => {
      const result = await handleCreateSafeList({
        title,
        description,
        category,
        userId: user.uid,
        author: user.displayName || user.email || 'Anonymous',
      });

      if (result.success && result.listId) {
        toast({ title: "Safe List Created!", description: "You can now start adding items." });
        setTitle('');
        setDescription('');
        setCategory('');
        setShowForm(false);
        router.push(`/community/safe-lists/${result.listId}`);
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  if (!user) {
    return null; // Don't show the create button if not logged in
  }
  
  if (!showForm) {
      return (
          <Button onClick={() => setShowForm(true)} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Start a New Safe List
          </Button>
      )
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Start a New Safe List</CardTitle>
        <CardDescription>Create a new list for the community to contribute to.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="List Title (e.g., Corn-Free Snacks)" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isPending} required />
          <Textarea placeholder="Brief description of what this list is for..." value={description} onChange={(e) => setDescription(e.target.value)} disabled={isPending} required />
          <Input placeholder="Category (e.g., Corn-Free, Gluten-Free)" value={category} onChange={(e) => setCategory(e.target.value)} disabled={isPending} required />
          <div className="flex gap-2">
            <Button className="w-full md:w-auto" disabled={isPending} type="submit">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Create List
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>
                Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
