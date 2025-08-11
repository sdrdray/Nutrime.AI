'use server';
/**
 * @fileOverview AI Recipe Generation flow.
 *
 * - generateRecipe - A function that generates a recipe based on dietary preferences and available ingredients.
 * - GenerateRecipeInput - The input type for the generateRecipe function.
 * - GenerateRecipeOutput - The return type for the generateRecipe function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRecipeInputSchema = z.object({
  dietaryPreferences: z
    .string()
    .describe('The dietary preferences of the user, e.g., vegetarian, vegan, gluten-free.'),
  availableIngredients: z
    .string()
    .describe('The ingredients available to the user, e.g., chicken, rice, vegetables.'),
  cuisine: z.string().optional().describe('The desired cuisine of the recipe, e.g., Italian, Mexican, Indian.'),
  maxCookingTime: z.number().optional().describe('The maximum cooking time in minutes.'),
});
export type GenerateRecipeInput = z.infer<typeof GenerateRecipeInputSchema>;

const GenerateRecipeOutputSchema = z.object({
  recipeName: z.string().describe('The name of the generated recipe.'),
  ingredients: z.string().describe('The list of ingredients required for the recipe.'),
  instructions: z.string().describe('The step-by-step instructions for preparing the recipe.'),
});
export type GenerateRecipeOutput = z.infer<typeof GenerateRecipeOutputSchema>;

export async function generateRecipe(input: GenerateRecipeInput): Promise<GenerateRecipeOutput> {
  return generateRecipeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRecipePrompt',
  input: {schema: GenerateRecipeInputSchema},
  output: {schema: GenerateRecipeOutputSchema},
  prompt: `You are a recipe generation AI. You will generate a recipe based on the user's dietary preferences, available ingredients and desired cuisine.

Dietary Preferences: {{{dietaryPreferences}}}
Available Ingredients: {{{availableIngredients}}}
Cuisine: {{{cuisine}}}
Maximum Cooking Time: {{{maxCookingTime}}} minutes

Recipe Name:
Ingredients:
Instructions:`,
});

const generateRecipeFlow = ai.defineFlow(
  {
    name: 'generateRecipeFlow',
    inputSchema: GenerateRecipeInputSchema,
    outputSchema: GenerateRecipeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
