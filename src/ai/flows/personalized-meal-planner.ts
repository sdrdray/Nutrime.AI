// src/ai/flows/personalized-meal-planner.ts
'use server';

/**
 * @fileOverview A personalized meal planner AI agent.
 *
 * - personalizedMealPlanner - A function that handles the meal planning process.
 * - PersonalizedMealPlannerInput - The input type for the personalizedMealPlanner function.
 * - PersonalizedMealPlannerOutput - The return type for the personalizedMealPlanner function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedMealPlannerInputSchema = z.object({
  dietaryNeeds: z.string().describe('The dietary needs of the user (e.g., vegetarian, vegan, gluten-free).'),
  healthGoals: z.string().describe('The health goals of the user (e.g., weight loss, muscle gain).'),
  tastePreferences: z.string().describe('The taste preferences of the user (e.g., likes spicy food, dislikes seafood).'),
  cookingTime: z.string().describe('The maximum cooking time the user is willing to spend on each meal (e.g., 30 minutes, 1 hour).'),
  budget: z.string().describe('The budget the user has for groceries (e.g., low, medium, high).'),
  seasonalProduce: z.string().describe('The seasonal produce available to the user (e.g., summer fruits, winter vegetables).'),
});
export type PersonalizedMealPlannerInput = z.infer<typeof PersonalizedMealPlannerInputSchema>;

const PersonalizedMealPlannerOutputSchema = z.object({
  mealPlan: z.string().describe('A personalized meal plan for the user, considering their dietary needs, health goals, taste preferences, cooking time, budget, and seasonal produce.'),
});
export type PersonalizedMealPlannerOutput = z.infer<typeof PersonalizedMealPlannerOutputSchema>;

export async function personalizedMealPlanner(
  input: PersonalizedMealPlannerInput
): Promise<PersonalizedMealPlannerOutput> {
  return personalizedMealPlannerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedMealPlannerPrompt',
  input: {schema: PersonalizedMealPlannerInputSchema},
  output: {schema: PersonalizedMealPlannerOutputSchema},
  prompt: `You are a personal meal planner. You will create a personalized meal plan for the user, considering their dietary needs, health goals, taste preferences, cooking time, budget, and seasonal produce.

Dietary Needs: {{{dietaryNeeds}}}
Health Goals: {{{healthGoals}}}
Taste Preferences: {{{tastePreferences}}}
Cooking Time: {{{cookingTime}}}
Budget: {{{budget}}}
Seasonal Produce: {{{seasonalProduce}}}

Create a meal plan that considers all of these factors. Return the meal plan as a string.
`,
});

const personalizedMealPlannerFlow = ai.defineFlow(
  {
    name: 'personalizedMealPlannerFlow',
    inputSchema: PersonalizedMealPlannerInputSchema,
    outputSchema: PersonalizedMealPlannerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
