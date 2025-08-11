// src/components/community/reply-form.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useToast } from "@/hooks/use-toast";
import { handleAddPostToDiscussion } from '@/lib/actions';

interface ReplyFormProps {
  discussionId: string;
}

export default function ReplyForm({ discussionId }: ReplyFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [replyText, setReplyText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to reply." });
      return;
    }
    if (!replyText.trim()) return;

    startTransition(async () => {
      const result = await handleAddPostToDiscussion({
        discussionId,
        text: replyText,
        userId: user.uid,
        author: user.displayName || user.email || "Anonymous",
      });

      if (result.success) {
        setReplyText('');
        toast({ title: "Reply Posted" });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  if (!user) {
    return <p className="text-sm text-muted-foreground">Please log in to reply.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        placeholder="Share your thoughts or experiences..."
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        disabled={isPending}
        rows={4}
      />
      <Button disabled={isPending || !replyText.trim()}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Post Reply
      </Button>
    </form>
  );
}
