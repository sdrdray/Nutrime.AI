// src/components/community/discussion-list-item.tsx
import type { SymptomDiscussion } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DiscussionListItemProps {
  discussion: Omit<SymptomDiscussion, 'createdAt' | 'lastActivity'> & { 
    createdAt: number;
    lastActivity: number;
  };
}

export default function DiscussionListItem({ discussion }: DiscussionListItemProps) {
  return (
    <Link href={`/community/discussions/${discussion.id}`} className="block hover:bg-muted/50 transition-colors rounded-lg">
        <Card className="h-full">
        <CardHeader>
            <CardTitle className="text-xl flex items-center justify-between">
            <span className="hover:underline">
                {discussion.title}
            </span>
            <div className="flex gap-2">
                {discussion.tags.map(tag => (
                <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
            </div>
            </CardTitle>
            <CardDescription>
                Started by {discussion.author}
            </CardDescription>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground justify-between">
            <span><MessageSquare className="inline h-4 w-4 mr-1"/> {discussion.postCount} posts</span>
            <span>Last activity: {formatDistanceToNow(new Date(discussion.lastActivity), { addSuffix: true })}</span>
        </CardFooter>
        </Card>
    </Link>
  );
}