'use server';
/**
 * @fileOverview AI flow to generate a meal prep plan from a given meal plan.
 *
 * - generateMealPrepPlan - A function that takes a meal plan and returns a structured prep plan.
 * - MealPrepPlannerInput - The input type for the function.
 * - MealPrepPlannerOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MealPrepPlannerInputSchema = z.object({
  mealPlan: z
    .string()
    .describe(
      'The full text of the user\'s meal plan, including meals for several days.'
    ),
});
export type MealPrepPlannerInput = z.infer<typeof MealPrepPlannerInputSchema>;

const MealPrepPlannerOutputSchema = z.object({
  prepTasks: z.array(z.object({
      day: z.string().describe("The day this prep task should be performed (e.g., Sunday Prep, Wednesday)."),
      tasks: z.array(z.object({
          type: z.enum(["Chopping", "Cooking", "Portioning", "Storing"]).describe("The category of the prep task."),
          description: z.string().describe("A specific, actionable prep task (e.g., 'Chop all onions and bell peppers for the week', 'Cook a large batch of quinoa')."),
      })).describe("A list of tasks for that specific prep day.")
  })).describe("A structured list of prep tasks, grouped by the day they should be performed on."),
  storageTips: z.string().optional().describe("General tips on how to best store the prepped ingredients or meals to maintain freshness."),
});
export type MealPrepPlannerOutput = z.infer<typeof MealPrepPlannerOutputSchema>;

export async function generateMealPrepPlan(
  input: MealPrepPlannerInput
): Promise<MealPrepPlannerOutput> {
  return mealPrepPlannerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'mealPrepPlannerPrompt',
  input: {schema: MealPrepPlannerInputSchema},
  output: {schema: MealPrepPlannerOutputSchema},
  prompt: `You are a meal prep expert. Your task is to analyze the following meal plan and create a strategic, step-by-step meal prep plan that helps the user save time during the week.

Analyze the entire meal plan to identify common ingredients and opportunities for batch cooking. Group tasks logically by day (e.g., a main prep day like Sunday) and by type (Chopping, Cooking, Portioning, Storing).

**Meal Plan for Analysis:**
\`\`\`
{{{mealPlan}}}
\`\`\`

**Your Output Constraints:**
1.  **Group by Day:** Create logical prep days. For a 7-day plan, a large "Sunday Prep" session is typical, maybe with a smaller "Wednesday Prep" for fresh items.
2.  **Categorize Tasks:** For each prep day, categorize tasks into "Chopping", "Cooking", "Portioning", and "Storing".
3.  **Be Actionable:** Make each task description a clear, actionable instruction.
    -   *Good Example:* "Cook 3 cups of brown rice."
    -   *Bad Example:* "Rice for the week."
4.  **Consolidate:** Combine tasks. Instead of "chop onions for Monday" and "chop onions for Tuesday", create one task: "Chop 2 onions and store in an airtight container."
5.  **Provide Storage Tips:** Include a brief section with general tips for storing the prepped food to ensure it stays fresh.

Generate the structured meal prep plan based on these rules.
`,
});

const mealPrepPlannerFlow = ai.defineFlow(
  {
    name: 'mealPrepPlannerFlow',
    inputSchema: MealPrepPlannerInputSchema,
    outputSchema: MealPrepPlannerOutputSchema,
  },
  async input => {
    if (!input.mealPlan.trim()) {
        return { prepTasks: [] };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
