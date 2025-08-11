// src/app/community/recipes/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { CommunityRecipe, RecipeComment, RecipeTag } from '@/lib/types';
import CommunityRecipeCard from '@/components/community/community-recipe-card';
import { Input } from '@/components/ui/input';
import { useDebounce } from 'use-debounce';
import { Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';


export default function AllCommunityRecipesPage() {
  const [allRecipes, setAllRecipes] = useState<CommunityRecipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<CommunityRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  useEffect(() => {
    async function fetchAllRecipes() {
      setIsLoading(true);
      const recipesCollection = collection(firestore, "communityRecipes");
      const q = query(recipesCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      const recipes: CommunityRecipe[] = [];
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const commentsCollection = collection(firestore, "communityRecipes", doc.id, "comments");
        const commentsSnapshot = await getDocs(query(commentsCollection, orderBy("createdAt", "desc")));
        const comments = commentsSnapshot.docs.map(commentDoc => ({
          id: commentDoc.id,
          ...commentDoc.data()
        })) as RecipeComment[];

        const tagsCollection = collection(firestore, "communityRecipes", doc.id, "tags");
        const tagsSnapshot = await getDocs(query(tagsCollection));
        const tags = tagsSnapshot.docs.map(tagDoc => ({
          id: tagDoc.id,
          ...tagDoc.data()
        })) as RecipeTag[];

        recipes.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          ingredients: data.ingredients,
          instructions: data.instructions,
          author: data.author,
          userId: data.userId,
          createdAt: data.createdAt as Timestamp,
          aiAdaptationSuggestion: data.aiAdaptationSuggestion,
          feedbackStats: data.feedbackStats,
          comments: comments,
          tags: tags,
        });
      }
      setAllRecipes(recipes);
      setFilteredRecipes(recipes);
      setIsLoading(false);
    }
    fetchAllRecipes();
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm) {
      const lowercasedTerm = debouncedSearchTerm.toLowerCase();
      const filtered = allRecipes.filter(recipe => 
        recipe.title.toLowerCase().includes(lowercasedTerm) ||
        recipe.description.toLowerCase().includes(lowercasedTerm) ||
        recipe.ingredients.some(ing => ing.toLowerCase().includes(lowercasedTerm)) ||
        recipe.tags.some(tag => tag.name.toLowerCase().includes(lowercasedTerm))
      );
      setFilteredRecipes(filtered);
    } else {
      setFilteredRecipes(allRecipes);
    }
  }, [debouncedSearchTerm, allRecipes]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">All Community Recipes</h1>
            <p className="mt-1 text-muted-foreground">
            Browse, search, and discover recipes shared by the community.
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
          placeholder="Search recipes by title, ingredients, or tags..."
          className="w-full pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRecipes.length > 0 ? (
            filteredRecipes.map((recipe) => (
              <CommunityRecipeCard key={recipe.id} recipe={{
                ...recipe,
                createdAt: recipe.createdAt.toMillis(), // Serialize Timestamp
              }} />
            ))
          ) : (
            <p className="text-muted-foreground text-center col-span-full py-10">
              No recipes found matching your search term.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
