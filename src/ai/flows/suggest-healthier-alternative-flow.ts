// src/ai/flows/suggest-healthier-alternative-flow.ts
'use server';
/**
 * @fileOverview AI flow to suggest healthier alternatives for grocery items.
 *
 * - suggestHealthierAlternative - A function that suggests a healthier alternative for a given grocery item.
 * - SuggestHealthierAlternativeInput - The input type.
 * - SuggestHealthierAlternativeOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestHealthierAlternativeInputSchema = z.object({
  itemName: z.string().describe('The name of the grocery item for which to suggest an alternative.'),
});
export type SuggestHealthierAlternativeInput = z.infer<typeof SuggestHealthierAlternativeInputSchema>;

const SuggestHealthierAlternativeOutputSchema = z.object({
  suggestion: z
    .string()
    .describe(
      'A healthier alternative suggestion for the item, or an affirmation if the item is already a good choice. For example, "Instead of white rice, consider brown rice for more fiber." or "Spinach is a great choice for iron and vitamins!"'
    ),
});
export type SuggestHealthierAlternativeOutput = z.infer<typeof SuggestHealthierAlternativeOutputSchema>;

export async function suggestHealthierAlternative(
  input: SuggestHealthierAlternativeInput
): Promise<SuggestHealthierAlternativeOutput> {
  return suggestHealthierAlternativeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestHealthierAlternativePrompt',
  input: {schema: SuggestHealthierAlternativeInputSchema},
  output: {schema: SuggestHealthierAlternativeOutputSchema},
  prompt: `You are a helpful nutrition assistant.
For the given grocery item, provide a concise suggestion for a healthier alternative if a common one exists.
If the item is generally considered healthy, provide a brief positive affirmation about it.
Keep the suggestion to one short sentence.

Grocery Item: {{{itemName}}}

Suggestion:
`,
});

const suggestHealthierAlternativeFlow = ai.defineFlow(
  {
    name: 'suggestHealthierAlternativeFlow',
    inputSchema: SuggestHealthierAlternativeInputSchema,
    outputSchema: SuggestHealthierAlternativeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
