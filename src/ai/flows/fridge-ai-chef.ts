// src/ai/flows/fridge-ai-chef.ts
'use server';
/**
 * @fileOverview AI agent that suggests recipes based on available ingredients.
 *
 * - fridgeAiChef - A function that takes a list of ingredients and returns recipe suggestions.
 * - FridgeAiChefInput - The input type for the fridgeAiChef function.
 * - FridgeAiChefOutput - The return type for the fridgeAiChef function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FridgeAiChefInputSchema = z.object({
  ingredients: z
    .array(z.string())
    .describe('A list of ingredients available in the fridge.'),
  dietaryPreferences: z
    .string()
    .optional()
    .describe('Any dietary preferences or restrictions (e.g., vegetarian, gluten-free).'),
});
export type FridgeAiChefInput = z.infer<typeof FridgeAiChefInputSchema>;

const FridgeAiChefOutputSchema = z.object({
  recipes: z.array(
    z.object({
      name: z.string().describe('The name of the recipe.'),
      ingredients: z.array(z.string()).describe('The ingredients required for the recipe.'),
      instructions: z.string().describe('The instructions for preparing the recipe.'),
    })
  ).describe('A list of recipe suggestions based on the available ingredients.'),
});
export type FridgeAiChefOutput = z.infer<typeof FridgeAiChefOutputSchema>;

export async function fridgeAiChef(input: FridgeAiChefInput): Promise<FridgeAiChefOutput> {
  return fridgeAiChefFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fridgeAiChefPrompt',
  input: {schema: FridgeAiChefInputSchema},
  output: {schema: FridgeAiChefOutputSchema},
  prompt: `You are a chef specializing in creating recipes based on available ingredients.

  Given the following ingredients:
  {{#each ingredients}}- {{this}}\n{{/each}}

  {{#if dietaryPreferences}}
  Considering the following dietary preferences: {{dietaryPreferences}}
  {{/if}}

  Suggest a few recipes that can be made using these ingredients. Provide the recipe name, a list of ingredients, and instructions for each recipe.
  Recipes:
  {{ingredients}}`,
});

const fridgeAiChefFlow = ai.defineFlow(
  {
    name: 'fridgeAiChefFlow',
    inputSchema: FridgeAiChefInputSchema,
    outputSchema: FridgeAiChefOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
