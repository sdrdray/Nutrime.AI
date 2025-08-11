// src/components/community/safe-list-card.tsx
import type { SafeList } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { List } from 'lucide-react';

interface SafeListCardProps {
  list: SafeList;
}

export default function SafeListCard({ list }: SafeListCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <List className="mr-2 h-5 w-5 text-primary"/>
          {list.title}
        </CardTitle>
        <CardDescription>
            <Badge variant="secondary">{list.category}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground">{list.description}</p>
      </CardContent>
      <CardFooter className="flex-col items-start mt-auto">
        <p className="text-sm text-muted-foreground">{list.itemCount} items on this list.</p>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href={`/community/safe-lists/${list.id}`}>View & Contribute</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
