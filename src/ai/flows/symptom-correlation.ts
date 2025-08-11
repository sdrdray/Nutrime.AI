// src/ai/flows/symptom-correlation.ts
'use server';
/**
 * @fileOverview Identifies potential correlations between logged symptoms and ingested foods,
 * providing detailed explanations and actionable suggestions.
 *
 * - symptomCorrelation - A function that identifies correlations between symptoms and foods.
 * - SymptomCorrelationInput - The input type for the symptomCorrelation function.
 * - SymptomCorrelationOutput - The return type for the symptomCorrelation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SymptomCorrelationInputSchema = z.object({
  symptoms: z
    .array(z.string().min(1))
    .min(1)
    .describe('An array of symptoms experienced by the user (e.g., "headache", "bloating").'),
  foodLog: z
    .array(z.string().min(1))
    .min(1)
    .describe('An array of foods the user has logged as eaten recently (e.g., "milk", "bread", "peanuts").'),
});
export type SymptomCorrelationInput = z.infer<typeof SymptomCorrelationInputSchema>;

const SymptomCorrelationOutputSchema = z.object({
  analysis: z.array(z.object({
    symptom: z.string().describe("The specific symptom being analyzed from the user's input."),
    potentiallyLinkedFoods: z.array(z.string()).describe("A list of specific foods from the user's food log that are potentially linked to this symptom."),
    explanation: z.string().describe("A detailed explanation of why these foods might be linked to the symptom. This should include information on common intolerances, allergens, FODMAP content, digestive effects, or other relevant nutritional science. Be specific if a particular ingredient within a logged food item (e.g., onion in pico de gallo) is the likely cause."),
    confidenceLevel: z.enum(["Low", "Medium", "High"]).optional().describe("The AI's estimated confidence in this particular food-symptom linkage (Low, Medium, or High)."),
    suggestedActions: z.array(z.string()).describe("Clear, actionable suggestions or potential remedies the user can consider. Examples: 'Try eliminating [specific food] for 1-2 weeks and monitor symptoms.', 'Keep a detailed food and symptom diary focusing on [specific food group].', 'Consider consulting a dietitian to discuss a low-FODMAP diet if bloating is persistent.'"),
  })).describe("An array of detailed analyses for each identified symptom-food correlation. If no clear correlations are found for a symptom, provide a general statement for that symptom."),
  overallSummary: z.string().optional().describe("A brief overall summary, general advice, or patterns observed based on the entire analysis. This could also be a place to suggest broader dietary approaches if multiple sensitivities seem to point in a similar direction."),
  importantDisclaimer: z.string().describe("A standard disclaimer stating: 'This analysis is AI-generated for informational purposes only and does not constitute medical advice. Please consult with a qualified healthcare professional or registered dietitian for any health concerns or before making any changes to your diet or treatment plan.'"),
});
export type SymptomCorrelationOutput = z.infer<typeof SymptomCorrelationOutputSchema>;

export async function symptomCorrelation(input: SymptomCorrelationInput): Promise<SymptomCorrelationOutput> {
  return symptomCorrelationFlow(input);
}

const symptomCorrelationPrompt = ai.definePrompt({
  name: 'symptomCorrelationPrompt',
  input: {schema: SymptomCorrelationInputSchema},
  output: {schema: SymptomCorrelationOutputSchema},
  prompt: `You are an expert nutritionist and dietary consultant specializing in food sensitivities, intolerances, and digestive health.
Your task is to analyze the user's reported symptoms and their recent food log to identify potential correlations between specific foods and experienced symptoms.
Provide a detailed, insightful, and actionable analysis.

User's Reported Symptoms:
{{#each symptoms}}- {{this}}\n{{/each}}

User's Recent Food Log:
{{#each foodLog}}- {{this}}\n{{/each}}

Based on this information, please perform the following:
1.  For each significant symptom reported by the user, identify specific food items from their log that could potentially be linked to it.
2.  For each identified link, provide a comprehensive 'explanation' detailing the physiological or biochemical reasons why that food (or its components) might cause the symptom. Mention common intolerances (e.g., lactose, gluten), high FODMAP content, allergens, histamine content, or other relevant factors. If a general food item like "pico de gallo" is logged, try to identify potential trigger ingredients within it (e.g., onions, tomatoes, spices) if relevant to the symptom.
3.  If possible, assign a 'confidenceLevel' (Low, Medium, High) to each food-symptom link based on commonality and scientific understanding.
4.  For each identified link, provide a list of 'suggestedActions'. These should be practical steps the user can take, such as specific elimination diet approaches for a short period, food diary recommendations, alternative food choices, or suggestions to consult a healthcare professional for specific tests or advice.
5.  If no clear correlations are found for a particular symptom, state that and perhaps offer general advice for managing that symptom if appropriate (e.g., for general fatigue, ensure adequate hydration and sleep).
6.  Provide an 'overallSummary' if there are any overarching patterns or general advice emerging from the analysis.
7.  Crucially, include the 'importantDisclaimer': "This analysis is AI-generated for informational purposes only and does not constitute medical advice. Please consult with a qualified healthcare professional or registered dietitian for any health concerns or before making any changes to your diet or treatment plan."

Return your response strictly in the structured JSON format defined by the output schema.
Focus on providing helpful, scientifically-grounded insights. Avoid making definitive diagnoses.
`,
});

const symptomCorrelationFlow = ai.defineFlow(
  {
    name: 'symptomCorrelationFlow',
    inputSchema: SymptomCorrelationInputSchema,
    outputSchema: SymptomCorrelationOutputSchema,
  },
  async input => {
    const {output} = await symptomCorrelationPrompt(input);
    // Ensure the disclaimer is always present, even if the model somehow misses it.
    const defaultDisclaimer = "This analysis is AI-generated for informational purposes only and does not constitute medical advice. Please consult with a qualified healthcare professional or registered dietitian for any health concerns or before making any changes to your diet or treatment plan.";
    
    if (!output) {
        // Fallback for extremely rare cases where the model returns nothing
        return {
            analysis: [{
                symptom: "Analysis Error",
                potentiallyLinkedFoods: [],
                explanation: "The AI was unable to process your request at this time. Please try again later.",
                suggestedActions: ["Retry the analysis.", "If the problem persists, simplify your input or check the service status."]
            }],
            importantDisclaimer: defaultDisclaimer,
        };
    }
    
    return {
        ...output,
        importantDisclaimer: output.importantDisclaimer || defaultDisclaimer,
    };
  }
);

