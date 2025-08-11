'use server';
/**
 * @fileOverview AI flow to suggest adaptations for community recipes.
 *
 * - suggestRecipeAdaptations - A function that suggests adaptations for a given recipe's ingredients.
 * - SuggestRecipeAdaptationsInput - The input type.
 * - SuggestRecipeAdaptationsOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRecipeAdaptationsInputSchema = z.object({
  ingredients: z
    .array(z.string())
    .describe('The list of ingredients from the user-submitted recipe.'),
});
export type SuggestRecipeAdaptationsInput = z.infer<typeof SuggestRecipeAdaptationsInputSchema>;

const SuggestRecipeAdaptationsOutputSchema = z.object({
  suggestion: z
    .string()
    .describe(
      'A concise suggestion for adapting the recipe based on common sensitivities (e.g., gluten, dairy, FODMAPs). If no obvious adaptations are needed, it can state that. Example: "This recipe contains gluten in the pasta. For a gluten-free version, consider using rice noodles or chickpea-based pasta."'
    ),
});
export type SuggestRecipeAdaptationsOutput = z.infer<typeof SuggestRecipeAdaptationsOutputSchema>;

export async function suggestRecipeAdaptations(
  input: SuggestRecipeAdaptationsInput
): Promise<SuggestRecipeAdaptationsOutput> {
  return suggestRecipeAdaptationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRecipeAdaptationsPrompt',
  input: {schema: SuggestRecipeAdaptationsInputSchema},
  output: {schema: SuggestRecipeAdaptationsOutputSchema},
  prompt: `You are a helpful nutrition assistant reviewing a community-submitted recipe.
Analyze the following list of ingredients and provide a single, concise suggestion for how it could be adapted for common dietary sensitivities.
Focus on major sensitivities like gluten, dairy, high-FODMAP ingredients (like onions, garlic), nuts, etc.
Keep the suggestion to one or two short, helpful sentences. If the recipe seems generally friendly to most diets, you can provide a positive affirmation.

Ingredients:
{{#each ingredients}}
- {{this}}
{{/each}}

Adaptation Suggestion:
`,
});

const suggestRecipeAdaptationsFlow = ai.defineFlow(
  {
    name: 'suggestRecipeAdaptationsFlow',
    inputSchema: SuggestRecipeAdaptationsInputSchema,
    outputSchema: SuggestRecipeAdaptationsOutputSchema,
  },
  async input => {
    // Return empty suggestion if no ingredients are provided
    if (!input.ingredients || input.ingredients.length === 0) {
      return { suggestion: "No ingredients provided to analyze." };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
