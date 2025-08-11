// 'use server'

/**
 * @fileOverview AI-powered food recognition flow using Google Gemini API.
 *
 * - recognizeFood - A function that takes an image of a meal and identifies the food items.
 * - RecognizeFoodInput - The input type for the recognizeFood function.
 * - RecognizeFoodOutput - The return type for the recognizeFood function.
 */

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecognizeFoodInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a meal, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type RecognizeFoodInput = z.infer<typeof RecognizeFoodInputSchema>;

const RecognizeFoodOutputSchema = z.object({
  foodItems: z
    .array(z.string())
    .describe('A list of food items identified in the photo.'),
});
export type RecognizeFoodOutput = z.infer<typeof RecognizeFoodOutputSchema>;

export async function recognizeFood(input: RecognizeFoodInput): Promise<RecognizeFoodOutput> {
  return recognizeFoodFlow(input);
}

const recognizeFoodPrompt = ai.definePrompt({
  name: 'recognizeFoodPrompt',
  input: {schema: RecognizeFoodInputSchema},
  output: {schema: RecognizeFoodOutputSchema},
  prompt: `You are an AI food recognition expert.

You will be provided with a photo of a meal. Your task is to identify the individual food items present in the meal.

Analyze the following photo and list the food items you can identify. Be specific (e.g., instead of "salad", say "mixed green salad with tomatoes and cucumbers").

Photo: {{media url=photoDataUri}}

Return a list of strings representing the identified food items.  Don't include any extra conversational text. Just return the list.
`,
});

const recognizeFoodFlow = ai.defineFlow(
  {
    name: 'recognizeFoodFlow',
    inputSchema: RecognizeFoodInputSchema,
    outputSchema: RecognizeFoodOutputSchema,
  },
  async input => {
    const {output} = await recognizeFoodPrompt(input);
    return output!;
  }
);
