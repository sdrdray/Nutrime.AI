// src/components/community/create-poll-form.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, Loader2, XCircle } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useToast } from "@/hooks/use-toast";
import { handleCreatePoll } from '@/lib/actions';
import Link from 'next/link';

const pollSchema = z.object({
  question: z.string().min(10, 'The poll question must be at least 10 characters long.'),
  category: z.string().min(2, 'Category is required.'),
  options: z.array(z.object({ text: z.string().min(1, 'Option cannot be empty.') })).min(2, 'You must provide at least two options.'),
});

type PollFormValues = z.infer<typeof pollSchema>;

export default function CreatePollForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<PollFormValues>({
    resolver: zodResolver(pollSchema),
    defaultValues: {
      question: '',
      category: '',
      options: [{ text: '' }, { text: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const onSubmit = (data: PollFormValues) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "You must be logged in to create a poll." });
      return;
    }

    startTransition(async () => {
      const result = await handleCreatePoll({
        question: data.question,
        category: data.category,
        options: data.options.map(o => o.text),
        userId: user.uid,
        author: user.displayName || user.email || 'Anonymous',
      });

      if (result.success) {
        toast({ title: "Poll Created!", description: "Your poll is now live for the community." });
        form.reset();
        setShowForm(false);
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };
  
  if (!user) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Create a Poll</CardTitle>
                <CardDescription>
                    <Link href="/settings" className="text-primary underline">Log in</Link> to create a poll and gather community insights.
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }

  if (!showForm) {
    return (
      <Button onClick={() => setShowForm(true)} className="w-full">
        <PlusCircle className="mr-2 h-4 w-4" /> Start a New Poll
      </Button>
    )
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Start a New Poll</CardTitle>
        <CardDescription>Create a new poll for the community to vote on.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="question" render={({ field }) => (
              <FormItem><FormLabel>Poll Question</FormLabel><FormControl><Input placeholder="e.g., Which dairy-free milk do you prefer?" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem><FormLabel>Category</FormLabel><FormControl><Input placeholder="e.g., Dairy Alternatives" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div>
              <FormLabel>Options</FormLabel>
              <div className="space-y-2 pt-2">
                {fields.map((field, index) => (
                  <FormField key={field.id} control={form.control} name={`options.${index}.text`} render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl><Input {...field} placeholder={`Option ${index + 1}`} /></FormControl>
                        {fields.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4"/> Add Option
              </Button>
            </div>

            <div className="flex gap-2">
              <Button disabled={isPending} type="submit">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Create Poll
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
