// src/app/community/discussions/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { SymptomDiscussion } from '@/lib/types';
import DiscussionListItem from '@/components/community/discussion-list-item';
import { Input } from '@/components/ui/input';
import { useDebounce } from 'use-debounce';
import { Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PostForm from '@/components/community/post-form';

export default function AllDiscussionsPage() {
  const [allDiscussions, setAllDiscussions] = useState<SymptomDiscussion[]>([]);
  const [filteredDiscussions, setFilteredDiscussions] = useState<SymptomDiscussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  useEffect(() => {
    async function fetchAllDiscussions() {
      setIsLoading(true);
      const discussionsCollection = collection(firestore, "symptomDiscussions");
      const q = query(discussionsCollection, orderBy("lastActivity", "desc"));
      const querySnapshot = await getDocs(q);

      const discussions: SymptomDiscussion[] = [];
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        discussions.push({
          id: doc.id,
          ...data,
        } as SymptomDiscussion);
      }
      setAllDiscussions(discussions);
      setFilteredDiscussions(discussions);
      setIsLoading(false);
    }
    fetchAllDiscussions();
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm) {
      const lowercasedTerm = debouncedSearchTerm.toLowerCase();
      const filtered = allDiscussions.filter(discussion => 
        discussion.title.toLowerCase().includes(lowercasedTerm) ||
        discussion.description.toLowerCase().includes(lowercasedTerm) ||
        discussion.tags.some(tag => tag.toLowerCase().includes(lowercasedTerm))
      );
      setFilteredDiscussions(filtered);
    } else {
      setFilteredDiscussions(allDiscussions);
    }
  }, [debouncedSearchTerm, allDiscussions]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Symptom Discussions</h1>
          <p className="mt-1 text-muted-foreground">
            Browse, search, and engage in conversations with the community.
          </p>
        </div>
        <Button asChild>
          <Link href="/community">Back to Community Hub</Link>
        </Button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search discussions by title, content, or tags..."
          className="w-full pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <PostForm />

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDiscussions.length > 0 ? (
            filteredDiscussions.map((discussion) => (
              <DiscussionListItem key={discussion.id} discussion={{
                ...discussion,
                createdAt: (discussion.createdAt as Timestamp).toMillis(),
                lastActivity: (discussion.lastActivity as Timestamp).toMillis(),
              }} />
            ))
          ) : (
            <p className="text-muted-foreground text-center col-span-full py-10">
              No discussions found matching your search term.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
