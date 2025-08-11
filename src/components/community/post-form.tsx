// src/components/community/post-form.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2 } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useToast } from "@/hooks/use-toast";
import { handleCreateDiscussion } from '@/lib/actions';
import Link from 'next/link';

export default function PostForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to post a discussion." });
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill out the title and description." });
      return;
    }

    startTransition(async () => {
      const result = await handleCreateDiscussion({
        title,
        description,
        tags,
        userId: user.uid,
        author: user.displayName || user.email || 'Anonymous',
      });

      if (result.success) {
        toast({ title: "Discussion Posted!", description: "Your discussion is now live for the community to see." });
        setTitle('');
        setDescription('');
        setTags('');
        setShowForm(false);
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start a Discussion</CardTitle>
          <CardDescription>
            <Link href="/settings" className="text-primary underline">Log in</Link> to share your questions and experiences with the community.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  if (!showForm) {
      return (
          <Button onClick={() => setShowForm(true)} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Start a New Discussion
          </Button>
      )
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Start a New Discussion</CardTitle>
        <CardDescription>Ask a question or share your experience with the community.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Discussion Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isPending} required />
          <Textarea placeholder="What's on your mind? Provide some context or details for your discussion." value={description} onChange={(e) => setDescription(e.target.value)} disabled={isPending} required />
          <Input placeholder="Tags (comma-separated, e.g., bloating, low-fodmap, tips)" value={tags} onChange={(e) => setTags(e.target.value)} disabled={isPending} />
          <div className="flex gap-2">
            <Button className="w-full md:w-auto" disabled={isPending} type="submit">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Post Discussion
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
