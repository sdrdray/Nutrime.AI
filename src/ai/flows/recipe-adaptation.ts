// Recipe adaptation flow to modify recipes based on user needs.
'use server';
/**
 * @fileOverview Recipe adaptation AI agent.
 *
 * - adaptRecipe - A function that adapts a recipe based on provided instructions.
 * - AdaptRecipeInput - The input type for the adaptRecipe function.
 * - AdaptRecipeOutput - The return type for the adaptRecipe function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdaptRecipeInputSchema = z.object({
  recipe: z.string().describe('The original recipe to adapt.'),
  instructions: z.string().describe('Instructions for adapting the recipe (e.g., dietary restrictions, ingredient substitutions).'),
});
export type AdaptRecipeInput = z.infer<typeof AdaptRecipeInputSchema>;

const AdaptRecipeOutputSchema = z.object({
  adaptedRecipe: z.string().describe('The adapted recipe based on the instructions.'),
  reasoning: z.string().describe('Explanation of the changes made to the recipe.'),
});
export type AdaptRecipeOutput = z.infer<typeof AdaptRecipeOutputSchema>;

export async function adaptRecipe(input: AdaptRecipeInput): Promise<AdaptRecipeOutput> {
  return adaptRecipeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adaptRecipePrompt',
  input: {schema: AdaptRecipeInputSchema},
  output: {schema: AdaptRecipeOutputSchema},
  prompt: `You are a culinary expert skilled at adapting recipes to meet various dietary needs and ingredient constraints.

  Original Recipe: {{{recipe}}}

  Adaptation Instructions: {{{instructions}}}

  Please adapt the recipe according to the instructions provided, while maintaining the integrity and deliciousness of the dish. Explain your changes in the reasoning field.
  Output the adapted recipe and your reasoning for the changes. Make sure the adapted recipe is complete, with ingredients and instructions.
  `,
});

const adaptRecipeFlow = ai.defineFlow(
  {
    name: 'adaptRecipeFlow',
    inputSchema: AdaptRecipeInputSchema,
    outputSchema: AdaptRecipeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
