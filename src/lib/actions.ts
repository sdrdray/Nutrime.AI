// src/lib/actions.ts
"use server";

import { generateRecipe, type GenerateRecipeInput, type GenerateRecipeOutput } from "@/ai/flows/ai-recipe-generation";
import { fridgeAiChef, type FridgeAiChefInput, type FridgeAiChefOutput } from "@/ai/flows/fridge-ai-chef";
import { adaptRecipe, type AdaptRecipeInput, type AdaptRecipeOutput } from "@/ai/flows/recipe-adaptation";
import { recognizeFood, type RecognizeFoodInput, type RecognizeFoodOutput } from "@/ai/flows/food-recognition";
import { symptomCorrelation, type SymptomCorrelationInput, type SymptomCorrelationOutput } from "@/ai/flows/symptom-correlation";
import { personalizedMealPlanner, type PersonalizedMealPlannerInput, type PersonalizedMealPlannerOutput } from "@/ai/flows/personalized-meal-planner";
import { estimateNutrition, type NutritionalEstimationInput, type NutritionalEstimationOutput } from "@/ai/flows/nutritional-estimation";
import { ocrGroceryList, type OcrGroceryListInput, type OcrGroceryListOutput } from "@/ai/flows/ocr-grocery-list-flow";
import { suggestHealthierAlternative, type SuggestHealthierAlternativeInput, type SuggestHealthierAlternativeOutput } from "@/ai/flows/suggest-healthier-alternative-flow";
import { suggestRecipeAdaptations, type SuggestRecipeAdaptationsInput, type SuggestRecipeAdaptationsOutput } from "@/ai/flows/community-recipe-adaptation-flow";
import { generateMealPrepPlan, type MealPrepPlannerInput, type MealPrepPlannerOutput } from "@/ai/flows/meal-prep-planner-flow";
import { firestore } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc, arrayUnion, arrayRemove, deleteDoc, setDoc, runTransaction } from 'firebase/firestore';
import { revalidatePath } from "next/cache";


export async function handleGenerateRecipe(input: GenerateRecipeInput): Promise<GenerateRecipeOutput> {
  try {
    return await generateRecipe(input);
  } catch (error) {
    console.error("Error in handleGenerateRecipe:", error);
    throw new Error("Failed to generate recipe. Please try again.");
  }
}

export async function handleFridgeAiChef(input: FridgeAiChefInput): Promise<FridgeAiChefOutput> {
  try {
    return await fridgeAiChef(input);
  } catch (error)
  {
    console.error("Error in handleFridgeAiChef:", error);
    throw new Error("Failed to get recipes from fridge. Please try again.");
  }
}

export async function handleAdaptRecipe(input: AdaptRecipeInput): Promise<AdaptRecipeOutput> {
  try {
    return await adaptRecipe(input);
  } catch (error) {
    console.error("Error in handleAdaptRecipe:", error);
    throw new Error("Failed to adapt recipe. Please try again.");
  }
}

export async function handleRecognizeFood(input: RecognizeFoodInput): Promise<RecognizeFoodOutput> {
  try {
    return await recognizeFood(input);
  } catch (error) {
    console.error("Error in handleRecognizeFood:", error);
    throw new Error("Failed to recognize food. Please try again.");
  }
}

export async function handleSymptomCorrelation(input: SymptomCorrelationInput): Promise<SymptomCorrelationOutput> {
  try {
    return await symptomCorrelation(input);
  } catch (error) {
    console.error("Error in handleSymptomCorrelation:", error);
    throw new Error("Failed to correlate symptoms. Please try again.");
  }
}

export async function handlePersonalizedMealPlanner(input: PersonalizedMealPlannerInput): Promise<PersonalizedMealPlannerOutput> {
  try {
    return await personalizedMealPlanner(input);
  } catch (error) {
    console.error("Error in handlePersonalizedMealPlanner:", error);
    throw new Error("Failed to generate meal plan. Please try again.");
  }
}

export async function handleNutritionalEstimation(input: NutritionalEstimationInput): Promise<NutritionalEstimationOutput> {
  try {
    return await estimateNutrition(input);
  } catch (error) {
    console.error("Error in handleNutritionalEstimation:", error);
    throw new Error("Failed to estimate nutrition. Please try again.");
  }
}

export async function handleOcrGroceryList(input: OcrGroceryListInput): Promise<OcrGroceryListOutput> {
  try {
    return await ocrGroceryList(input);
  } catch (error) {
    console.error("Error in handleOcrGroceryList:", error);
    throw new Error("Failed to process grocery list image. Please try again.");
  }
}

export async function handleSuggestHealthierAlternative(input: SuggestHealthierAlternativeInput): Promise<SuggestHealthierAlternativeOutput> {
  try {
    return await suggestHealthierAlternative(input);
  } catch (error) {
    console.error("Error in handleSuggestHealthierAlternative:", error);
    // Gracefully fail, don't throw an error that breaks the grocery list adding flow
    return { suggestion: "Could not fetch an alternative suggestion at this time." };
  }
}

export async function handleGenerateMealPrepPlan(input: MealPrepPlannerInput): Promise<MealPrepPlannerOutput> {
    try {
        return await generateMealPrepPlan(input);
    } catch (error) {
        console.error("Error in handleGenerateMealPrepPlan:", error);
        throw new Error("Failed to generate meal prep plan. Please try again.");
    }
}


// Community Actions
export async function handleSuggestRecipeAdaptations(input: SuggestRecipeAdaptationsInput): Promise<SuggestRecipeAdaptationsOutput> {
  try {
    return await suggestRecipeAdaptations(input);
  } catch (error) {
    console.error("Error in handleSuggestRecipeAdaptations:", error);
    return { suggestion: "Could not generate an AI adaptation suggestion at this time." };
  }
}

export async function handlePostRecipe(formData: { title: string; description: string; ingredients: string[]; instructions: string; userId: string; author: string; }) {
  const { title, description, ingredients, instructions, userId, author } = formData;
  if (!userId) throw new Error("You must be logged in to post a recipe.");

  const recipeData = {
    title,
    description,
    ingredients,
    instructions,
    author,
    userId,
    createdAt: serverTimestamp(),
    feedbackStats: { symptomFree: 0, mildSymptoms: 0, significantSymptoms: 0 },
    aiAdaptationSuggestion: "",
    flaggedBy: [],
  };

  try {
    const docRef = await addDoc(collection(firestore, "communityRecipes"), recipeData);

    // After saving, call AI to get adaptation suggestion and update the doc
    const adaptationResult = await handleSuggestRecipeAdaptations({ ingredients });
    if (adaptationResult.suggestion) {
      await updateDoc(doc(firestore, "communityRecipes", docRef.id), {
        aiAdaptationSuggestion: adaptationResult.suggestion,
      });
    }

    revalidatePath("/community");
    revalidatePath("/community/recipes");
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error posting recipe:", error);
    return { success: false, message: "Failed to post recipe." };
  }
}

export async function handleAddRecipeComment(formData: { recipeId: string; userId: string; author: string; text: string; }) {
  const { recipeId, userId, author, text } = formData;
  if (!userId) throw new Error("You must be logged in to comment.");
  if (!text.trim()) throw new Error("Comment cannot be empty.");

  const commentData = {
    recipeId,
    userId,
    author,
    text,
    createdAt: serverTimestamp(),
    upvotes: 0,
  };

  try {
    await addDoc(collection(firestore, "communityRecipes", recipeId, "comments"), commentData);
    revalidatePath("/community");
    revalidatePath(`/community/recipes/${recipeId}`);
    return { success: true };
  } catch (error) {
    console.error("Error adding comment:", error);
    return { success: false, message: "Failed to add comment." };
  }
}

export async function handleAddRecipeTag(formData: { recipeId: string; userId: string; tag: string; }) {
  const { recipeId, userId, tag } = formData;
  const cleanedTag = tag.trim().toLowerCase().replace(/\s+/g, '-');
  if (!userId) throw new Error("You must be logged in to add a tag.");
  if (!cleanedTag) throw new Error("Tag cannot be empty.");

  try {
    const tagRef = doc(firestore, "communityRecipes", recipeId, "tags", cleanedTag);
    const tagSnap = await getDoc(tagRef);
    
    if (tagSnap.exists()) {
      // Tag exists, add user to confirmed list if not already there
      await updateDoc(tagRef, {
        confirmedBy: arrayUnion(userId)
      });
    } else {
      // Tag doesn't exist, create it
      await setDoc(tagRef, {
        name: cleanedTag,
        submittedBy: userId,
        confirmedBy: [userId],
        createdAt: serverTimestamp()
      });
    }

    revalidatePath("/community");
    revalidatePath(`/community/recipes/${recipeId}`);
    return { success: true };
  } catch (error) {
    console.error("Error adding tag:", error);
    return { success: false, message: "Failed to add tag." };
  }
}

export async function handleRecipeFeedback(formData: { recipeId: string; userId: string; feedback: 'symptomFree' | 'mildSymptoms' | 'significantSymptoms'; }) {
  const { recipeId, userId, feedback } = formData;
  if (!userId) throw new Error("You must be logged in to give feedback.");

  try {
    const feedbackRef = doc(firestore, "communityRecipes", recipeId, "feedback", userId);
    const recipeRef = doc(firestore, "communityRecipes", recipeId);
    const feedbackSnap = await getDoc(feedbackRef);

    if (feedbackSnap.exists()) {
      const previousFeedback = feedbackSnap.data().feedback;
      if (previousFeedback === feedback) {
        // User is clicking the same button again, so we can assume they want to undo their feedback.
        await updateDoc(recipeRef, {
          [`feedbackStats.${feedback}`]: increment(-1)
        });
        await deleteDoc(feedbackRef);
        revalidatePath("/community");
        revalidatePath(`/community/recipes/${recipeId}`);
        return { success: true, message: "Feedback removed." };
      } else {
        // User is changing their feedback
        await updateDoc(recipeRef, {
          [`feedbackStats.${previousFeedback}`]: increment(-1),
          [`feedbackStats.${feedback}`]: increment(1)
        });
        await updateDoc(feedbackRef, { feedback });
      }
    } else {
      // New feedback
      await updateDoc(recipeRef, {
        [`feedbackStats.${feedback}`]: increment(1)
      });
       await setDoc(doc(firestore, "communityRecipes", recipeId, "feedback", userId), {
        feedback,
      });
    }
    
    revalidatePath("/community");
    revalidatePath(`/community/recipes/${recipeId}`);
    return { success: true, message: "Feedback recorded." };

  } catch (error) {
    console.error("Error recording feedback:", error);
    return { success: false, message: "Failed to record feedback." };
  }
}

export async function handleFlagRecipe(formData: { recipeId: string; userId: string; }) {
    const { recipeId, userId } = formData;
    if (!userId) return { success: false, message: "You must be logged in to flag a recipe." };

    try {
        const recipeRef = doc(firestore, "communityRecipes", recipeId);
        const recipeSnap = await getDoc(recipeRef);
        
        if (!recipeSnap.exists()) {
            return { success: false, message: "Recipe not found." };
        }
        
        const flaggedBy = recipeSnap.data().flaggedBy || [];

        if (flaggedBy.includes(userId)) {
            // User has already flagged, so un-flag
            await updateDoc(recipeRef, {
                flaggedBy: arrayRemove(userId)
            });
            revalidatePath("/community");
            revalidatePath(`/community/recipes/${recipeId}`);
            return { success: true, message: "Flag removed." };
        } else {
            // New flag
            await updateDoc(recipeRef, {
                flaggedBy: arrayUnion(userId)
            });
            revalidatePath("/community");
            revalidatePath(`/community/recipes/${recipeId}`);
            return { success: true, message: "Recipe flagged for review." };
        }
    } catch (error) {
        console.error("Error flagging recipe:", error);
        return { success: false, message: "Failed to process flag." };
    }
}

// Symptom Discussion Actions
export async function handleCreateDiscussion(formData: { title: string; description: string; tags: string; userId: string; author: string; }) {
  const { title, description, tags, userId, author } = formData;
  if (!userId) return { success: false, message: "You must be logged in to create a discussion." };
  
  const tagsArray = tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t);

  const discussionData = {
    title,
    description,
    tags: tagsArray,
    userId,
    author,
    createdAt: serverTimestamp(),
    lastActivity: serverTimestamp(),
    postCount: 0,
  };

  try {
    const docRef = await addDoc(collection(firestore, "symptomDiscussions"), discussionData);
    revalidatePath("/community");
    revalidatePath("/community/discussions");
    revalidatePath(`/community/discussions/${docRef.id}`);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating discussion:", error);
    return { success: false, message: "Failed to create discussion." };
  }
}

export async function handleAddPostToDiscussion(formData: { discussionId: string; text: string; userId: string; author: string; }) {
  const { discussionId, text, userId, author } = formData;
  if (!userId) return { success: false, message: "You must be logged in to post a reply." };

  const discussionRef = doc(firestore, "symptomDiscussions", discussionId);
  const postCollectionRef = collection(discussionRef, "posts");

  const postData = {
    discussionId,
    text,
    userId,
    author,
    createdAt: serverTimestamp(),
    upvotes: 0,
    isTopAnswer: false,
  };

  try {
    await runTransaction(firestore, async (transaction) => {
      // Add the new post
      transaction.set(doc(postCollectionRef), postData);

      // Update the main discussion document
      transaction.update(discussionRef, {
        postCount: increment(1),
        lastActivity: serverTimestamp(),
      });
    });

    revalidatePath(`/community/discussions/${discussionId}`);
    return { success: true };
  } catch (error) {
    console.error("Error adding post to discussion:", error);
    return { success: false, message: "Failed to add post." };
  }
}

// Ingredient Substitute Actions
export async function handleSuggestSubstitute(formData: { originalIngredient: string; substituteIngredient: string; notes: string; userId: string; author: string; }) {
  const { originalIngredient, substituteIngredient, notes, userId, author } = formData;
  if (!userId) return { success: false, message: "You must be logged in." };

  try {
    const substituteData = {
      originalIngredient,
      substituteIngredient,
      notes,
      author,
      userId,
      createdAt: serverTimestamp(),
      confirmedBy: [userId], // Automatically confirmed by the suggester
      dislikedBy: [],
      confirmedByCount: 1,
      dislikedByCount: 0,
    };
    const docRef = await addDoc(collection(firestore, "ingredientSubstitutes"), substituteData);
    
    revalidatePath('/community/substitutes');
    revalidatePath('/community');
    
    return { success: true, newSubstitute: { id: docRef.id, ...substituteData, dislikedBy: [], dislikedByCount: 0, createdAt: new Date() } }; // Return optimistic data
  } catch (error) {
    console.error("Error suggesting substitute:", error);
    return { success: false, message: "Failed to suggest substitute." };
  }
}

export async function handleConfirmSubstitute(formData: { substituteId: string; userId: string; }) {
  const { substituteId, userId } = formData;
  if (!userId) return { success: false, message: "You must be logged in." };

  const substituteRef = doc(firestore, "ingredientSubstitutes", substituteId);
  
  try {
    await runTransaction(firestore, async (transaction) => {
      const substituteDoc = await transaction.get(substituteRef);
      if (!substituteDoc.exists()) throw new Error("Substitute not found.");
      
      const data = substituteDoc.data();
      const confirmedBy = data.confirmedBy || [];
      const dislikedBy = data.dislikedBy || [];
      
      if (confirmedBy.includes(userId)) {
        // User is un-confirming
        transaction.update(substituteRef, {
          confirmedBy: arrayRemove(userId),
          confirmedByCount: increment(-1),
        });
      } else {
        // User is confirming, remove from disliked if present
        const updates: any = {
          confirmedBy: arrayUnion(userId),
          confirmedByCount: increment(1),
        };
        if (dislikedBy.includes(userId)) {
          updates.dislikedBy = arrayRemove(userId);
          updates.dislikedByCount = increment(-1);
        }
        transaction.update(substituteRef, updates);
      }
    });
    
    revalidatePath('/community/substitutes');
    revalidatePath('/community');
    return { success: true, message: "Vote recorded." };
  } catch (error) {
    console.error("Error confirming substitute:", error);
    return { success: false, message: "Failed to record vote." };
  }
}


export async function handleDislikeSubstitute(formData: { substituteId: string; userId: string; }) {
    const { substituteId, userId } = formData;
    if (!userId) return { success: false, message: "You must be logged in." };
  
    const substituteRef = doc(firestore, "ingredientSubstitutes", substituteId);
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const substituteDoc = await transaction.get(substituteRef);
        if (!substituteDoc.exists()) throw new Error("Substitute not found.");
        
        const data = substituteDoc.data();
        const confirmedBy = data.confirmedBy || [];
        const dislikedBy = data.dislikedBy || [];
  
        if (dislikedBy.includes(userId)) {
          // User is un-disliking
          transaction.update(substituteRef, {
            dislikedBy: arrayRemove(userId),
            dislikedByCount: increment(-1),
          });
        } else {
          // User is disliking, remove from confirmed if present
          const updates: any = {
            dislikedBy: arrayUnion(userId),
            dislikedByCount: increment(1),
          };
          if (confirmedBy.includes(userId)) {
            updates.confirmedBy = arrayRemove(userId);
            updates.confirmedByCount = increment(-1);
          }
          transaction.update(substituteRef, updates);
        }
      });
      
      revalidatePath('/community/substitutes');
      revalidatePath('/community');
      return { success: true, message: "Vote recorded." };
    } catch (error) {
      console.error("Error disliking substitute:", error);
      return { success: false, message: "Failed to record vote." };
    }
  }


// Poll Actions
export async function handleCreatePoll(formData: { question: string; category: string; options: string[]; userId: string; author: string; }) {
    const { question, category, options, userId, author } = formData;
    if (!userId) return { success: false, message: "You must be logged in." };
    if (options.length < 2) return { success: false, message: "A poll must have at least two options." };

    try {
        const pollOptions = options.map((optionText, index) => ({
            id: `option-${index + 1}`,
            text: optionText,
            votes: 0
        }));

        await addDoc(collection(firestore, "communityPolls"), {
            question,
            category,
            options: pollOptions,
            totalVotes: 0,
            userId,
            author,
            createdAt: serverTimestamp()
        });

        revalidatePath('/community/polls');
        revalidatePath('/community');
        return { success: true, message: "Poll created successfully!" };
    } catch (error) {
        console.error("Error creating poll:", error);
        return { success: false, message: "Failed to create poll." };
    }
}

export async function handlePollVote(formData: { pollId: string; optionId: string; userId: string; }) {
    const { pollId, optionId, userId } = formData;
    if (!userId) return { success: false, message: "You must be logged in to vote." };

    const pollRef = doc(firestore, "communityPolls", pollId);
    const voteRef = doc(firestore, "communityPolls", pollId, "votes", userId);

    try {
        await runTransaction(firestore, async (transaction) => {
            const voteDoc = await transaction.get(voteRef);
            if (voteDoc.exists()) {
                throw new Error("You have already voted in this poll.");
            }

            const pollDoc = await transaction.get(pollRef);
            if (!pollDoc.exists()) {
                throw new Error("Poll not found.");
            }

            const pollData = pollDoc.data();
            const newOptions = pollData.options.map((opt: any) => {
                if (opt.id === optionId) {
                    return { ...opt, votes: opt.votes + 1 };
                }
                return opt;
            });

            transaction.update(pollRef, {
                options: newOptions,
                totalVotes: increment(1)
            });

            transaction.set(voteRef, {
                userId,
                optionId,
                createdAt: serverTimestamp()
            });
        });

        revalidatePath(`/community/polls/${pollId}`);
        revalidatePath('/community');
        return { success: true, message: "Your vote has been recorded." };
    } catch (error: any) {
        console.error("Error recording vote:", error);
        return { success: false, message: error.message || "Failed to record vote." };
    }
}


// Safe List Actions
export async function handleCreateSafeList(formData: { title: string; description: string; category: string; userId: string; author: string; }) {
    const { title, description, category, userId, author } = formData;
    if (!userId) return { success: false, message: "You must be logged in." };

    try {
        const docRef = await addDoc(collection(firestore, "safeLists"), {
            title,
            description,
            category,
            userId,
            author,
            createdAt: serverTimestamp(),
            itemCount: 0
        });
        revalidatePath('/community/safe-lists');
        revalidatePath('/community');
        return { success: true, listId: docRef.id };
    } catch (error) {
        console.error("Error creating safe list:", error);
        return { success: false, message: "Failed to create safe list." };
    }
}

export async function handleAddItemToSafeList(formData: { listId: string; text: string; userId: string; author: string; }) {
    const { listId, text, userId, author } = formData;
    if (!userId) return { success: false, message: "You must be logged in." };

    const listRef = doc(firestore, "safeLists", listId);
    const itemCollectionRef = collection(listRef, "items");

    try {
        await runTransaction(firestore, async (transaction) => {
            transaction.set(doc(itemCollectionRef), {
                text,
                userId,
                author,
                createdAt: serverTimestamp()
            });
            transaction.update(listRef, { itemCount: increment(1) });
        });
        
        revalidatePath(`/community/safe-lists/${listId}`);
        return { success: true };
    } catch (error) {
        console.error("Error adding item to safe list:", error);
        return { success: false, message: "Failed to add item." };
    }
}

export async function handleDeleteSavedFridgeRecipe(formData: { recipeId: string; userId: string; }) {
  const { recipeId, userId } = formData;
  if (!userId) {
    return { success: false, message: "You must be logged in to delete a recipe." };
  }

  const recipeRef = doc(firestore, "userSavedFridgeRecipes", recipeId);

  try {
    const recipeDoc = await getDoc(recipeRef);
    if (!recipeDoc.exists()) {
      return { success: false, message: "Recipe not found." };
    }
    if (recipeDoc.data().userId !== userId) {
      return { success: false, message: "You are not authorized to delete this recipe." };
    }
    
    await deleteDoc(recipeRef);

    revalidatePath('/my-fridge');
    return { success: true };
  } catch (error) {
    console.error("Error deleting saved fridge recipe:", error);
    return { success: false, message: "Failed to delete recipe." };
  }
}

// Meal Prep Plan Actions
export async function handleSavePrepPlan(formData: { userId: string; originalMealPlanId: string; prepPlan: MealPrepPlannerOutput; }): Promise<{ success: boolean; message: string; }> {
    const { userId, originalMealPlanId, prepPlan } = formData;
    if (!userId) {
        return { success: false, message: "You must be logged in to save a prep plan." };
    }
    
    const prepPlanData = {
        userId,
        originalMealPlanId,
        prepPlan,
        savedAt: serverTimestamp(),
    };

    try {
        await addDoc(collection(firestore, "userSavedPrepPlans"), prepPlanData);
        revalidatePath('/meal-planner'); // Revalidate the page to potentially show saved status
        return { success: true, message: "Meal prep plan saved successfully!" };
    } catch (error) {
        console.error("Error saving meal prep plan:", error);
        return { success: false, message: "Failed to save the meal prep plan." };
    }
}
