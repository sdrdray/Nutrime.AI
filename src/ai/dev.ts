import { config } from 'dotenv';
config();

import '@/ai/flows/ai-recipe-generation.ts';
import '@/ai/flows/fridge-ai-chef.ts';
import '@/ai/flows/recipe-adaptation.ts';
import '@/ai/flows/food-recognition.ts';
import '@/ai/flows/symptom-correlation.ts';
import '@/ai/flows/personalized-meal-planner.ts';
import '@/ai/flows/nutritional-estimation.ts'; 
import '@/ai/flows/ocr-grocery-list-flow.ts';
import '@/ai/flows/suggest-healthier-alternative-flow.ts';
import '@/ai/flows/community-recipe-adaptation-flow.ts';
import '@/ai/flows/meal-prep-planner-flow.ts'; // Added new flow
