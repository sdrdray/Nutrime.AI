// src/ai/flows/ocr-grocery-list-flow.ts
'use server';
/**
 * @fileOverview AI-powered OCR for grocery lists and item refinement.
 *
 * - ocrGroceryList - A function that takes an image of a grocery list, extracts text,
 *   identifies potential grocery items, corrects them, and filters non-grocery entries.
 * - OcrGroceryListInput - The input type for the ocrGroceryList function.
 * - OcrGroceryListOutput - The return type for the ocrGroceryList function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OcrGroceryListInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a handwritten or printed grocery list, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type OcrGroceryListInput = z.infer<typeof OcrGroceryListInputSchema>;

const OcrGroceryListOutputSchema = z.object({
  potentialItems: z
    .array(z.string())
    .describe(
      'A list of potential grocery items identified and corrected from the image. Non-grocery items should be filtered out. Each item should be a distinct grocery product.'
    ),
  rawExtractedText: z
    .string()
    .describe('The raw text extracted from the image before any refinement or filtering.'),
});
export type OcrGroceryListOutput = z.infer<typeof OcrGroceryListOutputSchema>;

export async function ocrGroceryList(
  input: OcrGroceryListInput
): Promise<OcrGroceryListOutput> {
  return ocrGroceryListFlow(input);
}

const ocrGroceryListPrompt = ai.definePrompt({
  name: 'ocrGroceryListPrompt',
  input: {schema: OcrGroceryListInputSchema},
  output: {schema: OcrGroceryListOutputSchema},
  prompt: `You are an AI assistant highly skilled in Optical Character Recognition (OCR) and interpreting handwritten or printed grocery lists from images.

Your task is to analyze the provided image of a grocery list and perform the following steps:
1.  Extract all lines of text that you can discern from the image. This will form the 'rawExtractedText'.
2.  From these extracted lines, identify entries that are plausible grocery items.
3.  For each plausible grocery item, correct any common OCR misspellings or errors that might occur from interpreting handwriting (e.g., "mil" should become "milk", "bannna" to "banana", "aooles" to "apples"). Try to identify the most likely intended grocery item.
4.  Filter out any lines or entries that are clearly not grocery items. This includes headings (like "Shopping List", "Groceries"), dates, prices, quantities (unless part of the item name itself, e.g. "2L Milk"), or random scribbles/marks that do not resemble food or household products typically found on a grocery list.
5.  Compile a clean list of these corrected and filtered grocery item names. This list should be returned as 'potentialItems'. Each string in this array should represent a single, distinct grocery item.

Image for analysis:
{{media url=photoDataUri}}

Provide the output strictly in the specified JSON format. The 'potentialItems' array should only contain the names of the grocery items. 'rawExtractedText' should be a single string containing all text as initially extracted.
`,
});

const ocrGroceryListFlow = ai.defineFlow(
  {
    name: 'ocrGroceryListFlow',
    inputSchema: OcrGroceryListInputSchema,
    outputSchema: OcrGroceryListOutputSchema,
  },
  async input => {
    const {output} = await ocrGroceryListPrompt(input);
    
    if (!output) {
      // Handle cases where the model might not return the expected output structure
      return { 
        potentialItems: [], 
        rawExtractedText: "Error: Could not process the image or the model did not return valid output."
      };
    }

    // Ensure potentialItems is always an array, even if the model returns something else or it's missing
    const items = Array.isArray(output.potentialItems) ? output.potentialItems : [];
    // Ensure rawExtractedText is always a string
    const rawText = typeof output.rawExtractedText === 'string' ? output.rawExtractedText : "No raw text extracted or an error occurred.";

    return { potentialItems: items, rawExtractedText: rawText };
  }
);
