// src/components/community/substitute-card.tsx
"use client";

import React, { useTransition } from 'react';
import type { IngredientSubstitute } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { handleConfirmSubstitute, handleDislikeSubstitute } from '@/lib/actions';

interface SubstituteCardProps {
  substitute: IngredientSubstitute;
}

export default function SubstituteCard({ substitute }: SubstituteCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConfirming, startConfirming] = useTransition();
  const [isDisliking, startDisliking] = useTransition();

  const userHasConfirmed = user ? substitute.confirmedBy?.includes(user.uid) : false;
  const userHasDisliked = user ? substitute.dislikedBy?.includes(user.uid) : false;

  const onConfirm = () => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must log in to vote." });
      return;
    }
    startConfirming(async () => {
      const result = await handleConfirmSubstitute({ substituteId: substitute.id, userId: user.uid });
      if (!result.success) {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  const onDislike = () => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must log in to vote." });
      return;
    }
    startDisliking(async () => {
      const result = await handleDislikeSubstitute({ substituteId: substitute.id, userId: user.uid });
      if (!result.success) {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  return (
    <div className="p-4 rounded-lg bg-background border shadow-sm h-full flex flex-col">
      <div className="flex-grow">
        <p className="text-sm text-muted-foreground">Instead of <span className="font-semibold text-foreground">{substitute.originalIngredient}</span>:</p>
        <p className="font-medium mt-1">Try "{substitute.substituteIngredient}"</p>
        {substitute.notes && <p className="text-xs text-muted-foreground mt-1 italic">Note: {substitute.notes}</p>}
        <p className="text-xs text-muted-foreground mt-1">Suggested by: {substitute.author}</p>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t">
         <div className="flex items-center gap-4">
            <div className="text-xs text-green-600 font-semibold flex items-center">
                <ThumbsUp className="h-3 w-3 mr-1"/> {substitute.confirmedByCount ?? 0}
            </div>
             <div className="text-xs text-red-600 font-semibold flex items-center">
                <ThumbsDown className="h-3 w-3 mr-1"/> {substitute.dislikedByCount ?? 0}
            </div>
        </div>
        <div className="flex gap-2">
            <Button 
                size="sm" 
                variant="ghost" 
                className="text-xs text-red-600 hover:bg-destructive/10 hover:text-red-700 data-[active=true]:bg-destructive/20" 
                onClick={onDislike}
                disabled={isDisliking || isConfirming || !user}
                data-active={userHasDisliked}
            >
                {isDisliking ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsDown className="h-4 w-4"/>}
            </Button>
            <Button 
                size="sm" 
                variant="ghost" 
                className="text-xs text-green-600 hover:bg-green-600/10 hover:text-green-700 data-[active=true]:bg-green-600/20" 
                onClick={onConfirm}
                disabled={isConfirming || isDisliking || !user}
                data-active={userHasConfirmed}
            >
                {isConfirming ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsUp className="h-4 w-4"/>}
            </Button>
        </div>
      </div>
    </div>
  );
}
