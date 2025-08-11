// src/app/community/polls/[id]/page.tsx
"use client";

import { useEffect, useState, useTransition } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { CommunityPoll, PollVote } from '@/lib/types';
import { notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { handlePollVote } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

export default function PollDetailsPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [poll, setPoll] = useState<CommunityPoll | null>(null);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, startVotingTransition] = useTransition();

  useEffect(() => {
    const pollRef = doc(firestore, "communityPolls", params.id);
    const unsubscribe = onSnapshot(pollRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPoll({ 
            id: docSnap.id, 
            ...data,
            createdAt: data.createdAt as Timestamp,
        } as CommunityPoll);
      } else {
        setPoll(null); // Will lead to notFound()
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [params.id]);

  useEffect(() => {
    const checkUserVote = async () => {
      if (user && poll) {
        // Reset vote status when poll changes
        setUserVote(null); 
        const voteRef = doc(firestore, "communityPolls", poll.id, "votes", user.uid);
        const voteSnap = await getDoc(voteRef);
        if (voteSnap.exists()) {
          setUserVote(voteSnap.data().optionId);
        }
      }
    };
    checkUserVote();
  }, [user, poll]);

  const onVote = (optionId: string) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to vote." });
      return;
    }
    startVotingTransition(async () => {
      const result = await handlePollVote({ pollId: params.id, optionId, userId: user.uid });
      if (result.success) {
        toast({ title: "Vote Recorded!", description: "Thank you for your feedback." });
      } else {
        toast({ variant: "destructive", title: "Voting Error", description: result.message });
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

  if (!poll) {
    notFound();
  }

  const showResults = !!userVote || !user;

  return (
    <div className="space-y-6">
      <header>
        <Button asChild variant="outline" size="sm">
          <Link href="/community/polls">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to All Polls
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{poll.question}</CardTitle>
          <CardDescription>
            Category: <span className='font-medium'>{poll.category}</span> | Created by {poll.author} on {format(poll.createdAt.toDate(), "PPP")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {poll.options.map(option => {
            const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
            return (
              <div key={option.id}>
                {showResults ? (
                  // Results view
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <div className="flex items-center">
                        {userVote === option.id && <CheckCircle className="mr-2 h-4 w-4 text-primary" />}
                        <span>{option.text}</span>
                      </div>
                      <span>{percentage}% ({option.votes})</span>
                    </div>
                    <Progress value={percentage} />
                  </div>
                ) : (
                  // Voting view
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => onVote(option.id)}
                    disabled={isVoting}
                  >
                    {isVoting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <span>{option.text}</span>
                  </Button>
                )}
              </div>
            );
          })}
           <p className="text-sm text-muted-foreground pt-4">{poll.totalVotes.toLocaleString()} total votes</p>
           {!user && <p className='text-sm text-muted-foreground'>Please log in to vote.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
