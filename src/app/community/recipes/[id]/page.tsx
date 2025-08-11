// src/app/community/recipes/[id]/page.tsx
import { firestore } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { CommunityRecipe, RecipeComment, RecipeTag } from '@/lib/types';
import { notFound } from 'next/navigation';
import CommunityRecipeCard from '@/components/community/community-recipe-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';


async function getRecipeDetails(id: string): Promise<CommunityRecipe | null> {
    const recipeDocRef = doc(firestore, "communityRecipes", id);
    const recipeSnap = await getDoc(recipeDocRef);

    if (!recipeSnap.exists()) {
        return null;
    }

    const data = recipeSnap.data();

    const commentsCollection = collection(firestore, "communityRecipes", id, "comments");
    const commentsSnapshot = await getDocs(query(commentsCollection, orderBy("createdAt", "desc")));
    const comments = commentsSnapshot.docs.map(commentDoc => ({
        id: commentDoc.id,
        ...commentDoc.data()
    })) as RecipeComment[];

    const tagsCollection = collection(firestore, "communityRecipes", id, "tags");
    const tagsSnapshot = await getDocs(query(tagsCollection));
    const tags = tagsSnapshot.docs.map(tagDoc => ({
        id: tagDoc.id,
        ...tagDoc.data()
    })) as RecipeTag[];

    return {
        id: recipeSnap.id,
        title: data.title,
        description: data.description,
        ingredients: data.ingredients,
        instructions: data.instructions,
        author: data.author,
        userId: data.userId,
        createdAt: data.createdAt as Timestamp,
        aiAdaptationSuggestion: data.aiAdaptationSuggestion,
        feedbackStats: data.feedbackStats,
        flaggedBy: data.flaggedBy || [],
        comments: comments,
        tags: tags,
    };
}


export default async function RecipeDetailsPage({ params }: { params: { id: string } }) {
    const recipe = await getRecipeDetails(params.id);

    if (!recipe) {
        notFound();
    }
    
    // Convert timestamp to number for client component prop
    const recipeForClient = {
        ...recipe,
        createdAt: recipe.createdAt.toMillis(),
        comments: recipe.comments.map(c => ({...c, createdAt: c.createdAt.toMillis()}))
    };

    return (
        <div className="space-y-8">
            <header>
                <Button asChild variant="outline" size="sm">
                    <Link href="/community/recipes">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Recipes
                    </Link>
                </Button>
            </header>
            <div className="max-w-4xl mx-auto">
                 <CommunityRecipeCard recipe={recipeForClient} isDetailedView={true} />
            </div>
        </div>
    );
}