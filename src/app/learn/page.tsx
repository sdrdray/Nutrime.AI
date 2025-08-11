// src/app/learn/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Lightbulb, UtensilsCrossed, Zap } from "lucide-react";
import Image from "next/image";

const educationalContent = [
  {
    title: "The Science of Macronutrients",
    category: "Nutrition Science",
    summary: "Understand the roles of protein, carbs, and fats in your body and how to balance them for optimal health.",
    icon: Zap,
    image: "https://images.unsplash.com/photo-1543353071-873f17a7a088?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw0fHxIZWFsdGh5JTIwZm9vZHxlbnwwfHx8fDE3NTMyOTY2NzN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    imageHint: "healthy food"
  },
  {
    title: "Mindful Eating 101",
    category: "Mindful Eating",
    summary: "Learn techniques to eat more consciously, improve digestion, and develop a healthier relationship with food.",
    icon: Lightbulb,
    image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw1fHxIZWFsdGh5JTIwc2FsYWR8ZW58MHx8fHwxNzUzMjk2Njc1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    imageHint: "healthy salad"
  },
  {
    title: "Quick Meal Prep Hacks",
    category: "Cooking Hacks",
    summary: "Discover time-saving tips and tricks for efficient meal prepping that doesn't compromise on taste or nutrition.",
    icon: UtensilsCrossed,
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxIZWFsdGh5JTIwZm9vZHxlbnwwfHx8fDE3NTMyOTY2NzN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    imageHint: "meal prep"
  },
   {
    title: "Understanding Food Labels",
    category: "Nutrition Science",
    summary: "Decode nutrition labels like a pro to make informed choices at the grocery store.",
    icon: Zap,
    image: "https://images.unsplash.com/photo-1584306670957-acf935f5033c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxOdXRyaXRpb24lMjBMYWJlbHxlbnwwfHx8fDE3NTMzMDc1NDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    imageHint: "nutrition label"
  }
];

export default function LearnPage() {
  return (
    <div className="space-y-8">
      <header className="text-center">
        <BookOpen className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Educational Hub</h1>
        <p className="mt-2 text-xl text-muted-foreground">
          Bite-sized nutrition wisdom, cooking tips, and mindful eating guides. This feature is coming soon with more content!
        </p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {educationalContent.map((content, index) => (
          <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <content.icon className="h-6 w-6 text-accent" />
                <CardTitle className="text-xl">{content.title}</CardTitle>
              </div>
              <CardDescription className="text-sm font-medium text-primary">{content.category}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video w-full overflow-hidden rounded-md mb-4">
                  <Image 
                    src={content.image}
                    alt={content.title}
                    width={400}
                    height={225}
                    className="w-full h-full object-cover"
                    data-ai-hint={content.imageHint}
                  />
              </div>
              <p className="text-sm text-muted-foreground">{content.summary}</p>
            </CardContent>
          </Card>
        ))}
      </div>
       <div className="text-center mt-8">
         <p className="text-lg text-muted-foreground">More curated content is on its way to help you on your wellness journey!</p>
       </div>
    </div>
  );
}
