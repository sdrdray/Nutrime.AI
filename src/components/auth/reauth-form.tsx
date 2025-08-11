// src/components/auth/reauth-form.tsx
"use client";

import React from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';

const reauthSchema = z.object({
  password: z.string().min(1, "Password is required."),
});
type ReauthFormValues = z.infer<typeof reauthSchema>;

interface ReauthFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ReauthForm({ onSuccess, onCancel }: ReauthFormProps) {
  const { reauthenticateUser, loading, user } = useAuth();

  const form = useForm<ReauthFormValues>({
    resolver: zodResolver(reauthSchema),
    defaultValues: { password: "" },
  });

  const onSubmit: SubmitHandler<ReauthFormValues> = async (data) => {
    const success = await reauthenticateUser(data.password);
    if (success) {
      onSuccess();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password for {user?.email}</FormLabel>
              <FormControl><Input type="password" placeholder="••••••••" {...field} autoFocus /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
                Cancel
            </Button>
            <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm
            </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
