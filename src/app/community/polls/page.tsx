// src/app/community/polls/page.tsx
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { CommunityPoll } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import PollCard from '@/components/community/poll-card';
import CreatePollForm from '@/components/community/create-poll-form';

async function getAllPolls(): Promise<CommunityPoll[]> {
  const pollsCollection = collection(firestore, "communityPolls");
  const q = query(pollsCollection, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<CommunityPoll, 'id' | 'createdAt'>),
    createdAt: doc.data().createdAt as Timestamp,
  }));
}

export default async function AllPollsPage() {
  const polls = await getAllPolls();

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Community Polls</h1>
          <p className="mt-1 text-muted-foreground">
            See what the community thinks, cast your own vote, or start a new poll.
          </p>
        </div>
        <Button asChild>
          <Link href="/community">Back to Community Hub</Link>
        </Button>
      </header>
      
      <CreatePollForm />

      {polls.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {polls.map((poll) => (
            <PollCard key={poll.id} poll={{...poll, createdAt: poll.createdAt.toMillis()}} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-10">
          No community polls have been created yet. Be the first to start one!
        </p>
      )}
    </div>
  );
}
