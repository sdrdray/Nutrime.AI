// src/components/community/community-recipe-card.tsx
"use client";

import React, { useState, useTransition } from 'react';
import type { CommunityRecipe } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle, AlertCircle, ThumbsDown, Tag, PlusCircle, Send, ThumbsUp, Flag, Loader2 } from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { handleAddRecipeComment, handleAddRecipeTag, handleRecipeFeedback, handleFlagRecipe } from '@/lib/actions';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CommunityRecipeCardProps {
  recipe: Omit<CommunityRecipe, 'createdAt' | 'comments'> & { 
    createdAt: number;
    comments: (Omit<CommunityRecipe['comments'][0], 'createdAt'> & { createdAt: number })[];
  };
  isDetailedView?: boolean;
}

export default function CommunityRecipeCard({ recipe, isDetailedView = false }: CommunityRecipeCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');

  const userHasFlagged = user ? recipe.flaggedBy?.includes(user.uid) : false;
  
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must log in to comment." });
      return;
    }
    if (!newComment.trim()) return;

    startTransition(async () => {
      const result = await handleAddRecipeComment({
        recipeId: recipe.id,
        userId: user.uid,
        author: user.displayName || user.email || "Anonymous",
        text: newComment,
      });

      if (result.success) {
        setNewComment('');
        toast({ title: "Comment Added" });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
     if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must log in to add a tag." });
      return;
    }
    if (!newTag.trim()) return;

    startTransition(async () => {
      const result = await handleAddRecipeTag({
        recipeId: recipe.id,
        userId: user.uid,
        tag: newTag,
      });

      if (result.success) {
        setNewTag('');
        toast({ title: "Tag Added!" });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  const handleFeedbackClick = (feedback: 'symptomFree' | 'mildSymptoms' | 'significantSymptoms') => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must log in to give feedback." });
      return;
    }
    
    startTransition(async () => {
      const result = await handleRecipeFeedback({
        recipeId: recipe.id,
        userId: user.uid,
        feedback,
      });

      if (result.success) {
        toast({ title: result.message || "Feedback Recorded" });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  const onFlagRecipe = () => {
    if (!user) {
        toast({ variant: "destructive", title: "Not Logged In", description: "You must log in to flag a recipe." });
        return;
    }
    startTransition(async () => {
        const result = await handleFlagRecipe({ recipeId: recipe.id, userId: user.uid });
         if (result.success) {
            toast({ title: result.message });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.message });
        }
    });
  };

  return (
    <Card className={cn("flex flex-col", isDetailedView ? "" : "h-full")}>
      <CardHeader>
        <CardTitle className="text-xl">{recipe.title}</CardTitle>
        <CardDescription>By: {recipe.author}</CardDescription>
        <CardDescription className="italic text-sm pt-1">{recipe.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <Accordion type="single" collapsible className="w-full" defaultValue='ingredients'>
          <AccordionItem value="ingredients">
            <AccordionTrigger>Ingredients</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="instructions">
            <AccordionTrigger>Instructions</AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-[150px]">
                <p className="whitespace-pre-wrap text-sm">{recipe.instructions}</p>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {recipe.aiAdaptationSuggestion && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700"><span className="font-semibold">AI Tip:</span> {recipe.aiAdaptationSuggestion}</p>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="font-semibold text-sm flex items-center"><Tag className="mr-2 h-4 w-4 text-muted-foreground"/>Tags:</h4>
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map(tag => (
              <Badge key={tag.id} variant="secondary">
                {tag.name} ({tag.confirmedBy.length})
              </Badge>
            ))}
             {recipe.tags.length === 0 && <p className="text-xs text-muted-foreground">No tags yet.</p>}
          </div>
           <form onSubmit={handleTagSubmit} className="flex items-center gap-2 pt-1">
               <Input placeholder="Suggest a tag" className="h-8 text-xs flex-grow" value={newTag} onChange={(e) => setNewTag(e.target.value)} disabled={isPending || !user} />
               <Button size="sm" variant="outline" className="text-xs" disabled={isPending || !user || !newTag.trim()} type="submit">
                 {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin"/>}
                 {!isPending && <PlusCircle className="mr-1 h-3 w-3"/>}
                 Add Tag
               </Button>
           </form>
           <p className="text-xs text-muted-foreground">Add a tag or click on an existing one to confirm it (feature coming soon).</p>
        </div>
        
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Did this recipe work for you?</h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => handleFeedbackClick('symptomFree')} disabled={isPending || !user}>
              <CheckCircle className="mr-1 h-3 w-3 text-green-500"/>Symptom-Free ({recipe.feedbackStats.symptomFree})
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => handleFeedbackClick('mildSymptoms')} disabled={isPending || !user}>
              <AlertCircle className="mr-1 h-3 w-3 text-yellow-500"/>Mild Symptoms ({recipe.feedbackStats.mildSymptoms})
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => handleFeedbackClick('significantSymptoms')} disabled={isPending || !user}>
              <ThumbsDown className="mr-1 h-3 w-3 text-red-500"/>Caused Issues ({recipe.feedbackStats.significantSymptoms})
            </Button>
          </div>
        </div>
        
         <div className="space-y-2 pt-2">
            <h4 className="font-semibold text-sm">Comments ({recipe.comments.length})</h4>
            <ScrollArea className={cn("border rounded-md p-2 bg-muted/30", isDetailedView ? "h-[300px]" : "h-[100px]")}>
                {recipe.comments.map((comment) => (
                    <div key={comment.id} className="text-xs border-b last:border-b-0 py-1.5">
                        <p><span className="font-medium">{comment.author}:</span> {comment.text}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Button variant="ghost" size="icon" className="h-5 w-5" disabled><ThumbsUp className="h-3 w-3"/></Button><span className="text-muted-foreground">{comment.upvotes || 0}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" disabled><Flag className="h-3 w-3"/></Button>
                        </div>
                    </div>
                ))}
                {recipe.comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No comments yet.</p>}
            </ScrollArea>
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1">
               <Textarea placeholder="Add a comment..." className="text-xs flex-grow" rows={1} value={newComment} onChange={(e) => setNewComment(e.target.value)} disabled={isPending || !user} />
               <Button size="sm" variant="outline" className="text-xs" disabled={isPending || !user || !newComment.trim()} type="submit">
                 {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Send className="mr-1 h-3 w-3"/>}
                 Post
               </Button>
           </form>
        </div>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button variant="link" size="sm" className="text-xs" onClick={onFlagRecipe} disabled={isPending || !user}>
          <Flag className="mr-1 h-3 w-3" />
          {userHasFlagged ? "Flagged" : "Flag Recipe"}
        </Button>
        {!isDetailedView && (
            <Button asChild variant="link" size="sm" className="text-xs ml-auto">
                <Link href={`/community/recipes/${recipe.id}`}>View Full Details</Link>
            </Button>
        )}
      </CardFooter>
    </Card>
  );
}
