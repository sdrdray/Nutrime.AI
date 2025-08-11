// src/components/community/poll-card.tsx
"use client";

import type { CommunityPoll } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface PollCardProps {
  poll: Omit<CommunityPoll, 'createdAt'> & { createdAt: number };
}

export default function PollCard({ poll }: PollCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">{poll.question}</CardTitle>
        <CardDescription>
          <Badge variant="outline">{poll.category}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-2">
          {poll.options.slice(0, 3).map(option => { // Show max 3 options on card
            const percentage = poll.totalVotes > 0 ? (option.votes / poll.totalVotes) * 100 : 0;
            return (
              <div key={option.id} className="text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className='truncate pr-2'>{option.text}</span>
                  <span className="font-semibold text-muted-foreground">{Math.round(percentage)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                </div>
              </div>
            );
          })}
           {poll.options.length > 3 && <p className="text-xs text-muted-foreground text-center mt-2">...and more options</p>}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start mt-auto pt-4">
        <p className="text-sm text-muted-foreground">{poll.totalVotes} total votes</p>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href={`/community/polls/${poll.id}`}>View Poll & Vote</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
