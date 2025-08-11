// src/app/insights/page.tsx
"use client";

import React, { useState, useTransition, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { handleSymptomCorrelation } from '@/lib/actions';
import type { SymptomCorrelationOutput } from '@/ai/flows/symptom-correlation'; // Updated import
import { useToast } from "@/hooks/use-toast";
import { Loader2, BarChartHorizontalBig, Activity, TrendingUp, LineChart, ListChecks, Clock, Salad, ShoppingBasket, PlusCircle, AlertTriangle, Lightbulb, ShieldCheck } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import { firestore } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, Timestamp, where } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';

interface LoggedMealForInsights {
    id: string;
    type: 'photo' | 'manual' | 'barcode';
    content: string | string[];
    loggedAt: Timestamp;
    estimatedCalories?: number;
    estimatedProtein?: number;
    estimatedCarbs?: number;
    estimatedFat?: number;
    nutritionNotes?: string;
}

const symptomCorrelationSchema = z.object({
  symptoms: z.string().min(1, "Symptoms are required (comma-separated)."),
  foodLog: z.string().min(1, "Food log is required (comma-separated items from logged meals). Suggestion: Use data from your recent logs."),
});
type SymptomCorrelationFormValues = z.infer<typeof symptomCorrelationSchema>;

const chartConfig = {
  calories: { label: "Calories (kcal)", color: "hsl(var(--chart-1))" },
  protein: { label: "Protein (g)", color: "hsl(var(--chart-2))" },
  carbs: { label: "Carbs (g)", color: "hsl(var(--chart-3))" },
  fat: { label: "Fat (g)", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;


export default function InsightsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCorrelating, startCorrelatingTransition] = useTransition();
  const [correlationResults, setCorrelationResults] = useState<SymptomCorrelationOutput | null>(null); // Updated state name and type
  const [recentMealLogs, setRecentMealLogs] = useState<LoggedMealForInsights[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isMealSelectModalOpen, setIsMealSelectModalOpen] = useState(false);

  const correlationForm = useForm<SymptomCorrelationFormValues>({
    resolver: zodResolver(symptomCorrelationSchema),
    defaultValues: { symptoms: "", foodLog: "" },
  });

  useEffect(() => {
    const fetchMealLogs = async () => {
      if (!user) {
        setIsLoadingLogs(false);
        setRecentMealLogs([]);
        setChartData([]);
        return;
      }

      setIsLoadingLogs(true);
      try {
        const q = query(
          collection(firestore, "mealLogs"), 
          where("userId", "==", user.uid), // <-- CRITICAL FIX: Filter by user ID
          orderBy("loggedAt", "desc"), 
          limit(30)
        );
        const querySnapshot = await getDocs(q);
        const logs: LoggedMealForInsights[] = [];
        querySnapshot.forEach((doc) => {
          logs.push({ id: doc.id, ...doc.data() } as LoggedMealForInsights);
        });
        setRecentMealLogs(logs);

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const dailyAggregates: { [key: string]: { date: string; calories: number; protein: number; carbs: number; fat: number; count: number} } = {};

        logs.filter(log => log.loggedAt.toDate() >= oneWeekAgo)
            .forEach(log => {
                const dateStr = log.loggedAt.toDate().toLocaleDateString('en-CA'); 
                if (!dailyAggregates[dateStr]) {
                    dailyAggregates[dateStr] = { date: log.loggedAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric'}), calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
                }
                dailyAggregates[dateStr].calories += log.estimatedCalories || 0;
                dailyAggregates[dateStr].protein += log.estimatedProtein || 0;
                dailyAggregates[dateStr].carbs += log.estimatedCarbs || 0;
                dailyAggregates[dateStr].fat += log.estimatedFat || 0;
                dailyAggregates[dateStr].count +=1;
            });
        
        const aggregatedData = Object.values(dailyAggregates)
                                .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) 
                                .map(d => ({...d, calories: d.count > 0 ? d.calories : 0})); 

        setChartData(aggregatedData.slice(-7));

      } catch (error) {
        console.error("Error fetching meal logs: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch your meal logs." });
      }
      setIsLoadingLogs(false);
    };
    fetchMealLogs();
  }, [toast, user]);


  const onCorrelateSubmit: SubmitHandler<SymptomCorrelationFormValues> = (data) => {
    startCorrelatingTransition(async () => {
      setCorrelationResults(null); // Clear previous results
      try {
        const symptomsArray = data.symptoms.split(',').map(s => s.trim()).filter(s => s);
        const foodLogArray = data.foodLog.split(',').map(f => f.trim()).filter(f => f);
        if(symptomsArray.length === 0 || foodLogArray.length === 0) {
            toast({ variant: "destructive", title: "Error", description: "Please provide valid, comma-separated symptoms and food items." });
            return;
        }
        const result = await handleSymptomCorrelation({ symptoms: symptomsArray, foodLog: foodLogArray });
        setCorrelationResults(result);
        toast({ title: "Correlation Analysis Complete!", description: "Detailed insights generated below." });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: (error as Error).message });
      }
    });
  };

  const handleSelectMealForFoodLog = (log: LoggedMealForInsights) => {
    const currentFoodLogValue = correlationForm.getValues("foodLog");
    let itemsToAdd = "";
    if (Array.isArray(log.content)) {
      itemsToAdd = log.content.join(', ');
    } else if (typeof log.content === 'string') {
      itemsToAdd = log.content;
      if (log.type === 'barcode' && log.content.startsWith("Scanned: ")) {
        itemsToAdd = `Scanned item (${log.content.replace("Scanned: ", "")})`;
      }
    }

    if (itemsToAdd) {
      const newValue = currentFoodLogValue ? `${currentFoodLogValue}, ${itemsToAdd}` : itemsToAdd;
      correlationForm.setValue("foodLog", newValue);
      toast({ title: "Items Added", description: `Added "${itemsToAdd}" to your food log input.`});
    }
    setIsMealSelectModalOpen(false);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Health Insights</h1>
        <p className="text-muted-foreground">
          Discover patterns in your diet and track your progress towards health goals.
        </p>
      </header>

      <Tabs defaultValue="progress" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="progress"><TrendingUp className="mr-2 h-4 w-4 sm:hidden md:inline-block" />Progress Tracking</TabsTrigger>
          <TabsTrigger value="correlation"><Activity className="mr-2 h-4 w-4 sm:hidden md:inline-block" />Symptom Correlation</TabsTrigger>
        </TabsList>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Progress Tracking</CardTitle>
              <CardDescription>Visualize your journey. Data based on your logged meals with estimated nutrition.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><LineChart className="mr-2 h-5 w-5 text-primary" />Caloric Intake (Last 7 Logged Periods)</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingLogs ? (
                         <div className="flex items-center justify-center h-[250px]">
                            <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /> Loading chart data...
                        </div>
                    ): chartData.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                            <BarChart accessibilityLayer data={chartData} margin={{left: 0, right: 20, top: 5, bottom: 5}}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(value) => value.toLocaleString()} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="calories" fill="var(--color-calories)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    ) : (
                        <p className="text-muted-foreground text-center py-10">Not enough data for the chart. Log some meals with nutritional info!</p>
                    )}
                </CardContent>
              </Card>
             
              <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-accent" />Recent Meal Logs (with Estimates)</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingLogs ? (
                        <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading logs...
                        </div>
                    ) : recentMealLogs.length > 0 ? (
                        <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                            {recentMealLogs.map(log => (
                                <li key={log.id} className="border-b pb-2">
                                    <p className="font-semibold text-sm">
                                        <Salad className="inline mr-1 h-4 w-4 text-primary" /> 
                                        {Array.isArray(log.content) ? log.content.join(', ') : log.content} ({log.type})
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        <Clock className="inline mr-1 h-3 w-3" /> {log.loggedAt.toDate().toLocaleString()}
                                    </p>
                                    {log.estimatedCalories !== undefined && (
                                        <p className="text-xs text-muted-foreground">
                                            Est: {log.estimatedCalories} kcal, {log.estimatedProtein}g P, {log.estimatedCarbs}g C, {log.estimatedFat}g F
                                        </p>
                                    )}
                                     {log.nutritionNotes && <p className="text-xs text-muted-foreground italic">Note: {log.nutritionNotes}</p>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground">No meal logs with nutritional estimates found. Start logging your meals!</p>
                    )}
                </CardContent>
              </Card>
               <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-accent" />Macronutrient Distribution (Avg)</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Average daily macronutrient breakdown. (Placeholder chart)</p>
                    <div className="h-[200px] flex items-center justify-center bg-muted rounded-md mt-4">
                        <p className="text-sm text-muted-foreground">Macronutrient chart coming soon, once more data is available.</p>
                    </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlation">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Symptom & Food Correlation</CardTitle>
              <CardDescription>Identify potential links between what you eat and how you feel. Input symptoms and food items (from your logs) separated by commas. AI will provide detailed explanations and suggestions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...correlationForm}>
                <form onSubmit={correlationForm.handleSubmit(onCorrelateSubmit)} className="space-y-6">
                  <FormField control={correlationForm.control} name="symptoms" render={({ field }) => (
                    <FormItem><FormLabel>Symptoms Experienced</FormLabel><FormControl><Textarea placeholder="e.g., headache, bloating, fatigue" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={correlationForm.control} name="foodLog" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Logged Food Items (Consumed Recently)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., milk, bread, peanuts, eggs. Type or select from recent logs." {...field} rows={3} /></FormControl>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setIsMealSelectModalOpen(true)} 
                            className="mt-2"
                            disabled={isLoadingLogs || recentMealLogs.length === 0}
                        >
                            <ShoppingBasket className="mr-2 h-4 w-4" /> 
                            {isLoadingLogs ? "Loading Logs..." : "Select from Recent Logs"}
                        </Button>
                        <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={isCorrelating} className="w-full md:w-auto">
                    {isCorrelating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />} Analyze Correlations
                  </Button>
                </form>
              </Form>
              {isCorrelating && (
                <div className="mt-6 flex items-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating detailed analysis... This may take a moment.
                </div>
              )}
              {correlationResults && !isCorrelating && (
                <div className="mt-8 space-y-6">
                  <h2 className="text-2xl font-semibold border-b pb-2">Correlation Analysis Results</h2>
                  
                  {correlationResults.analysis && correlationResults.analysis.length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-4">
                      {correlationResults.analysis.map((item, index) => (
                        <AccordionItem value={`item-${index}`} key={index} className="border rounded-lg shadow-sm">
                          <AccordionTrigger className="p-4 hover:bg-muted/50 rounded-t-lg">
                            <div className="flex items-center justify-between w-full">
                                <span className="text-lg font-medium text-primary">{item.symptom}</span>
                                {item.confidenceLevel && (
                                <Badge 
                                    variant={item.confidenceLevel === "High" ? "destructive" : item.confidenceLevel === "Medium" ? "secondary" : "outline"}
                                    className="ml-auto mr-2"
                                >
                                    {item.confidenceLevel} Confidence
                                </Badge>
                                )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="p-4 pt-0 space-y-3">
                            <div>
                                <h4 className="font-semibold text-sm">Potentially Linked Foods:</h4>
                                {item.potentiallyLinkedFoods.length > 0 ? (
                                     <ul className="list-disc list-inside text-muted-foreground text-sm pl-2">
                                        {item.potentiallyLinkedFoods.map((food, foodIdx) => <li key={foodIdx}>{food}</li>)}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No specific foods from your log were strongly linked by the AI.</p>
                                )}
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">Explanation:</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.explanation}</p>
                            </div>
                             <div>
                                <h4 className="font-semibold text-sm">Suggested Actions:</h4>
                                {item.suggestedActions.length > 0 ? (
                                    <ul className="list-decimal list-inside text-muted-foreground text-sm pl-2 space-y-1">
                                        {item.suggestedActions.map((action, actionIdx) => <li key={actionIdx}>{action}</li>)}
                                    </ul>
                                ) : (
                                     <p className="text-sm text-muted-foreground">No specific actions suggested for this item.</p>
                                )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <p className="text-muted-foreground">No specific correlations or detailed analysis points were found based on the provided data. Try being more specific or adding more data points over time.</p>
                  )}

                  {correlationResults.overallSummary && (
                    <Card className="bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center"><Lightbulb className="mr-2 h-5 w-5 text-accent" /> Overall Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{correlationResults.overallSummary}</p>
                        </CardContent>
                    </Card>
                  )}
                  
                  <Card className="border-destructive/50 bg-destructive/5">
                     <CardHeader>
                        <CardTitle className="text-base flex items-center text-destructive"><ShieldCheck className="mr-2 h-5 w-5" /> Important Disclaimer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-destructive/90">{correlationResults.importantDisclaimer}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isMealSelectModalOpen} onOpenChange={setIsMealSelectModalOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Select Meals to Add</DialogTitle>
                <DialogDescription>Click on a meal to add its contents to the food log input for correlation.</DialogDescription>
            </DialogHeader>
            {isLoadingLogs ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="ml-2">Loading meal logs...</p>
                </div>
            ) : recentMealLogs.length === 0 ? (
                <p className="p-4 text-center text-muted-foreground">No recent meal logs found to select from.</p>
            ) : (
                <ScrollArea className="h-[300px] pr-3">
                    <div className="space-y-2">
                        {recentMealLogs.map((log) => (
                            <Button
                                key={log.id}
                                variant="outline"
                                className="w-full justify-start text-left h-auto py-2 flex items-center space-x-3 group"
                                onClick={() => handleSelectMealForFoodLog(log)}
                            >
                                <Salad className="h-5 w-5 text-primary flex-shrink-0" />
                                <div className="flex-grow">
                                    <p className="font-medium text-sm break-words">
                                        {Array.isArray(log.content) ? log.content.join(', ') : log.content} 
                                        <span className="text-xs text-muted-foreground ml-1">({log.type})</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        <Clock className="inline mr-1 h-3 w-3" />
                                        {log.loggedAt.toDate().toLocaleString()}
                                    </p>
                                </div>
                                <PlusCircle className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            )}
            <DialogClose asChild className="mt-4">
                <Button type="button" variant="outline" className="w-full">Close</Button>
            </DialogClose>
        </DialogContent>
      </Dialog>

    </div>
  );
}
