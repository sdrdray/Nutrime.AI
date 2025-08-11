// src/ai/flows/nutritional-estimation.ts
'use server';
/**
 * @fileOverview AI-powered nutritional estimation flow.
 *
 * - estimateNutrition - A function that estimates nutritional information for a given meal description.
 * - NutritionalEstimationInput - The input type for the estimateNutrition function.
 * - NutritionalEstimationOutput - The return type for the estimateNutrition function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const NutritionalEstimationInputSchema = z.object({
  mealDescription: z
    .string()
    .describe(
      'A textual description of the meal, including items and approximate quantities if known (e.g., "Chicken breast 150g, steamed broccoli 1 cup, and quinoa 0.5 cup" or "Recognized items: apple, banana, handful of almonds").'
    ),
});
export type NutritionalEstimationInput = z.infer<typeof NutritionalEstimationInputSchema>;

const NutritionalEstimationOutputSchema = z.object({
  calories: z.number().describe('Estimated total calories in kcal.'),
  protein: z.number().describe('Estimated total protein in grams.'),
  carbs: z.number().describe('Estimated total carbohydrates in grams.'),
  fat: z.number().describe('Estimated total fat in grams.'),
  notes: z
    .string()
    .optional()
    .describe(
      'Any other relevant nutritional notes, key micronutrients, or disclaimers about the estimation.'
    ),
});
export type NutritionalEstimationOutput = z.infer<typeof NutritionalEstimationOutputSchema>;

export async function estimateNutrition(
  input: NutritionalEstimationInput
): Promise<NutritionalEstimationOutput> {
  return nutritionalEstimationFlow(input);
}

const nutritionalEstimationPrompt = ai.definePrompt({
  name: 'nutritionalEstimationPrompt',
  input: {schema: NutritionalEstimationInputSchema},
  output: {schema: NutritionalEstimationOutputSchema},
  prompt: `You are a nutritional analysis AI.
Given the following meal description, provide an estimate of its nutritional content.
Focus on calories, protein, carbohydrates, and fats.
If quantities are not precise, provide a reasonable estimate for a typical serving.

Meal Description: {{{mealDescription}}}

Return the estimated nutritional information.
Consider common portion sizes if not specified. For example, if "apple" is mentioned, assume one medium apple.
Be as accurate as possible based on the description.
If the description is very vague (e.g., "a snack"), you can state that estimation is difficult but still try to provide a very rough ballpark or ask for more details in the notes.
`,
});

const nutritionalEstimationFlow = ai.defineFlow(
  {
    name: 'nutritionalEstimationFlow',
    inputSchema: NutritionalEstimationInputSchema,
    outputSchema: NutritionalEstimationOutputSchema,
  },
  async input => {
    // Basic check for very generic input
    if (input.mealDescription.toLowerCase().trim().split(' ').length < 2 && !input.mealDescription.includes(',')) {
        // If input is too vague, return a default or error-like structure
        return {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            notes: "Meal description too vague for accurate estimation. Please provide more details."
        };
    }
    const {output} = await nutritionalEstimationPrompt(input);
    return output!;
  }
);
