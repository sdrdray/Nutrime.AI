// src/app/community/page.tsx
import { Users, MessageSquare, ThumbsUp, GitMerge, CheckSquare, List } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import PostRecipeForm from "@/components/community/post-recipe-form";
import CommunityRecipeCard from "@/components/community/community-recipe-card";
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp, limit, where } from 'firebase/firestore'; 
import type { CommunityRecipe, RecipeComment, RecipeTag, SymptomDiscussion, IngredientSubstitute, CommunityPoll, SafeList } from '@/lib/types';
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import DiscussionListItem from "@/components/community/discussion-list-item";
import SubstituteCard from "@/components/community/substitute-card";
import PollCard from "@/components/community/poll-card"; // New import
import SafeListCard from "@/components/community/safe-list-card"; // New import


async function getCommunityRecipes(): Promise<CommunityRecipe[]> {
  const recipesCollection = collection(firestore, "communityRecipes");
  const q = query(recipesCollection, orderBy("createdAt", "desc"), limit(2));
  const querySnapshot = await getDocs(q);

  const recipes: CommunityRecipe[] = [];
  
  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();

    const commentsCollection = collection(firestore, "communityRecipes", docSnap.id, "comments");
    const commentsSnapshot = await getDocs(query(commentsCollection, orderBy("createdAt", "desc")));
    const comments = commentsSnapshot.docs.map(commentDoc => ({
      id: commentDoc.id,
      ...commentDoc.data()
    })) as RecipeComment[];

    const tagsCollection = collection(firestore, "communityRecipes", docSnap.id, "tags");
    const tagsSnapshot = await getDocs(query(tagsCollection));
    const tags = tagsSnapshot.docs.map(tagDoc => ({
      id: tagDoc.id,
      ...tagDoc.data()
    })) as RecipeTag[];

    recipes.push({
      id: docSnap.id,
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
    });
  }

  return recipes;
}

async function getDiscussions(): Promise<SymptomDiscussion[]> {
    const discussionsCollection = collection(firestore, "symptomDiscussions");
    const q = query(discussionsCollection, orderBy("lastActivity", "desc"), limit(2));
    const querySnapshot = await getDocs(q);
    const discussions: SymptomDiscussion[] = [];
    
    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        let topAnswerText = "No top answer yet.";

        if(data.topAnswerId) {
            const postSnap = await getDocs(query(collection(firestore, "symptomDiscussions", docSnap.id, "posts"), where("isTopAnswer", "==", true), limit(1)));
            if (!postSnap.empty) {
                topAnswerText = postSnap.docs[0].data().text;
            }
        }

        discussions.push({
            id: docSnap.id,
            title: data.title,
            description: data.description,
            author: data.author,
            userId: data.userId,
            createdAt: data.createdAt as Timestamp,
            tags: data.tags,
            postCount: data.postCount,
            lastActivity: data.lastActivity as Timestamp,
            topAnswerId: data.topAnswerId,
        });
    }
    return discussions;
}

async function getTopSubstitutes(): Promise<IngredientSubstitute[]> {
    const substitutesCollection = collection(firestore, "ingredientSubstitutes");
    const q = query(substitutesCollection, orderBy("confirmedByCount", "desc"), limit(2));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as IngredientSubstitute));
}

async function getLatestPoll(): Promise<CommunityPoll | null> {
    const pollsCollection = collection(firestore, "communityPolls");
    const q = query(pollsCollection, orderBy("createdAt", "desc"), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const pollData = querySnapshot.docs[0].data() as Omit<CommunityPoll, 'id' | 'createdAt'>;
    return { 
        id: querySnapshot.docs[0].id, 
        ...pollData,
        createdAt: pollData.createdAt as Timestamp
    };
}

async function getLatestSafeList(): Promise<SafeList | null> {
    const safeListsCollection = collection(firestore, "safeLists");
    const q = query(safeListsCollection, orderBy("createdAt", "desc"), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as SafeList;
}


export default async function CommunityPage() {
  const recipes = await getCommunityRecipes();
  const discussions = await getDiscussions();
  const substitutes = await getTopSubstitutes();
  const latestPoll = await getLatestPoll();
  const latestSafeList = await getLatestSafeList();
  
  return (
    <div className="space-y-12">
      <header className="text-center">
        <Users className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Community Hub</h1>
        <p className="mt-2 text-xl text-muted-foreground">
          Connect, Share, and Learn with fellow NutriMe.AI users.
        </p>
      </header>
      
      <PostRecipeForm />
      
      {/* Shared Recipes Section */}
      <section>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Latest Community Recipes</h2>
            <Button asChild variant="outline">
                <Link href="/community/recipes">View All Recipes</Link>
            </Button>
        </div>
         {recipes.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(350px,1fr))] gap-6">
            {recipes.map((recipe) => (
              <CommunityRecipeCard key={recipe.id} recipe={{
                ...recipe,
                createdAt: recipe.createdAt.toMillis(), 
                comments: recipe.comments.map(c => ({...c, createdAt: c.createdAt.toMillis()}))
              }} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No community recipes have been posted yet. Be the first to share!
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Symptom Discussions Section */}
       <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Active Discussions</h2>
          <Button asChild variant="outline">
            <Link href="/community/discussions">Explore All Discussions</Link>
          </Button>
        </div>
         <div className="grid md:grid-cols-1 gap-6">
            {discussions.map(discussion => (
              <DiscussionListItem key={discussion.id} discussion={{
                  ...discussion,
                  createdAt: discussion.createdAt.toMillis(),
                  lastActivity: discussion.lastActivity.toMillis(),
              }} />
            ))}
        </div>
        {discussions.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">No discussions started yet. Be the first!</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Ingredient Substitute Helper Section */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Top Ingredient Substitutes</h2>
          <Button asChild variant="outline">
            <Link href="/community/substitutes">Find/Add Substitutes</Link>
          </Button>
        </div>
        <Card className="bg-muted/30">
            <CardContent className="pt-6 grid md:grid-cols-1 lg:grid-cols-2 gap-6">
                {substitutes.length > 0 ? (
                    substitutes.map(sub => (
                        <SubstituteCard key={sub.id} substitute={sub} />
                    ))
                ) : (
                    <p className="text-muted-foreground text-center col-span-full">No substitutes have been added yet. Be the first!</p>
                )}
            </CardContent>
        </Card>
      </section>
      
      {/* Polls and Safe Lists Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Community Polls Section */}
        <section>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Community Poll</h2>
                <Button asChild variant="outline">
                    <Link href="/community/polls">View All Polls</Link>
                </Button>
            </div>
            {latestPoll ? (
                <PollCard poll={{...latestPoll, createdAt: latestPoll.createdAt.toMillis() }} />
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">No Polls Yet</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">There are no community polls available yet. Check back soon!</p>
                    </CardContent>
                </Card>
            )}
        </section>

        {/* Community Safe Lists Section */}
        <section>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Curated Safe List</h2>
                 <Button asChild variant="outline">
                    <Link href="/community/safe-lists">Explore All Lists</Link>
                </Button>
            </div>
            {latestSafeList ? (
                <SafeListCard list={latestSafeList} />
             ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">No Safe Lists Yet</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">There are no community-curated safe lists yet. Why not start one?</p>
                    </CardContent>
                </Card>
             )}
        </section>
      </div>

       {/* Final Teaser Section */}
      <section className="text-center mt-12 border-t pt-12">
        <h2 className="text-3xl font-bold">Share Your Journey</h2>
        <p className="mt-6 text-lg text-muted-foreground">
         Our vision includes a place for success stories and a peer support "buddy up" system. Stay tuned!
        </p>
         <Image 
            src={`https://images.unsplash.com/photo-1547592180-85f173990554?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxIZWFsdGh5JTIwZm9vZHxlbnwwfHx8fDE3NTMyOTY2NzN8MA&ixlib=rb-4.1.0&q=80&w=1080`}
            alt="Community collage"
            width={800}
            height={300}
            className="rounded-lg object-cover mt-8 w-full max-w-4xl mx-auto"
            data-ai-hint="community people diverse"
        />
      </section>

    </div>
  );
}
