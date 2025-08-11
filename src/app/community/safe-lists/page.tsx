// src/app/community/safe-lists/page.tsx
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { SafeList } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import SafeListCard from '@/components/community/safe-list-card';
import CreateSafeListForm from '@/components/community/create-safe-list-form';

async function getAllSafeLists(): Promise<SafeList[]> {
  const safeListsCollection = collection(firestore, "safeLists");
  const q = query(safeListsCollection, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as SafeList[];
}

export default async function AllSafeListsPage() {
  const safeLists = await getAllSafeLists();

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Community-Curated Safe Lists</h1>
          <p className="mt-1 text-muted-foreground">
            Browse and contribute to lists of "safe" products and meal ideas.
          </p>
        </div>
        <Button asChild>
          <Link href="/community">Back to Community Hub</Link>
        </Button>
      </header>
      
      <CreateSafeListForm />

      {safeLists.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {safeLists.map((list) => (
            <SafeListCard key={list.id} list={list} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-10">
          No safe lists have been created yet. Be the first to start one!
        </p>
      )}
    </div>
  );
}
