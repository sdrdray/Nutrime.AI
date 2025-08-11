// src/lib/types.ts
import type { Timestamp } from 'firebase/firestore';
import type { MealPrepPlannerOutput } from '@/ai/flows/meal-prep-planner-flow';

export interface CommunityRecipe {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string;
  author: string;
  userId: string;
  createdAt: Timestamp;
  aiAdaptationSuggestion: string;
  feedbackStats: {
    symptomFree: number;
    mildSymptoms: number;
    significantSymptoms: number;
  };
  comments: RecipeComment[];
  tags: RecipeTag[];
  flaggedBy: string[]; // Array of user IDs who have flagged this
}

export interface RecipeComment {
  id: string;
  recipeId: string;
  author: string;
  userId: string;
  text: string;
  createdAt: Timestamp;
  upvotes: number;
}

export interface RecipeTag {
  id: string;
  name: string;
  submittedBy: string;
  confirmedBy: string[]; // Array of userIds
  createdAt: Timestamp;
}

// New types for Symptom Discussions
export interface SymptomDiscussion {
    id: string;
    title: string;
    description: string;
    author: string;
    userId: string;
    createdAt: Timestamp;
    tags: string[];
    postCount: number;
    lastActivity: Timestamp;
    topAnswerId?: string;
}

export interface DiscussionPost {
    id: string;
    discussionId: string;
    author: string;
    userId: string;
    text: string;
    createdAt: Timestamp;
    upvotes: number;
    isTopAnswer: boolean;
}

// New type for Ingredient Substitutes
export interface IngredientSubstitute {
    id: string;
    originalIngredient: string;
    substituteIngredient: string;
    notes: string;
    author: string;
    userId: string;
    createdAt: Timestamp;
    confirmedBy: string[]; // Array of user IDs who liked
    dislikedBy: string[]; // Array of user IDs who disliked
    confirmedByCount: number;
    dislikedByCount: number;
}

// New types for Community Polls
export interface PollOption {
  id: string; // e.g., 'option-1'
  text: string;
  votes: number;
}

export interface CommunityPoll {
  id: string;
  question: string;
  category: string;
  options: PollOption[];
  totalVotes: number;
  createdAt: Timestamp;
  author: string;
  userId: string;
}

export interface PollVote {
  userId: string;
  pollId: string;
  optionId: string;
  createdAt: Timestamp;
}


// New types for Safe Lists
export interface SafeList {
    id: string;
    title: string;
    description: string;
    category: string;
    author: string;
    userId: string;
    createdAt: Timestamp;
    itemCount: number;
}

export interface SafeListItem {
    id: string;
    listId: string;
    text: string;
    author: string;
    userId: string;
    createdAt: Timestamp;
}

// New type for saved meal prep plans
export interface UserSavedPrepPlan {
    id: string;
    userId: string;
    originalMealPlanId: string;
    prepPlan: MealPrepPlannerOutput;
    savedAt: Timestamp;
}
