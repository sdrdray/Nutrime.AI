// src/components/auth/phone-signin-form.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/auth-context';
import { Loader2, Phone } from 'lucide-react';
import { RecaptchaVerifier, type ConfirmationResult } from 'firebase/auth';
import { auth as firebaseAuth } from '@/lib/firebase'; 
import { useToast } from '@/hooks/use-toast';


const phoneSchema = z.object({
  phoneNumber: z.string().min(10, "Phone number seems too short. Include country code, e.g., +1XXXXXXXXXX."),
});
type PhoneFormValues = z.infer<typeof phoneSchema>;

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits."),
});
type OtpFormValues = z.infer<typeof otpSchema>;


export default function PhoneSignInForm() {
  const { signInWithPhoneNumberFlow, confirmOtpFlow, loading } = useAuth();
  const { toast } = useToast();
  
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const [appVerifier, setAppVerifier] = useState<RecaptchaVerifier | null>(null);


  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: "" },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  useEffect(() => {
    let verifierInstance: RecaptchaVerifier | null = null;

    if (recaptchaContainerRef.current && !appVerifier && !isOtpSent) {
      verifierInstance = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current, {
        'size': 'invisible',
        'callback': (response: any) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        },
        'expired-callback': () => {
          toast({ variant: "destructive", title: "reCAPTCHA Expired", description: "Please try sending OTP again."});
          if (appVerifier) {
            appVerifier.clear();
            setAppVerifier(null); // Trigger re-initialization in next effect run
          }
        }
      });

      verifierInstance.render().then(() => {
        setAppVerifier(verifierInstance);
      }).catch(renderError => {
        console.error("Initial reCAPTCHA render failed:", renderError);
        toast({ variant: "destructive", title: "reCAPTCHA Error", description: "Failed to initialize reCAPTCHA. Please refresh."});
      });
    }
    
    return () => {
      // Use the appVerifier from state for cleanup, as verifierInstance might be stale
      if (appVerifier) {
        appVerifier.clear(); 
        setAppVerifier(null); // Explicitly nullify on cleanup path as well
      } else if (verifierInstance) { 
        // Fallback if state update hasn't happened but instance was created
        verifierInstance.clear();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOtpSent]); // Removed appVerifier from deps to avoid loop, toast is stable. isOtpSent handles re-init on going back.

  const onSendOtpSubmit: SubmitHandler<PhoneFormValues> = async (data) => {
    if (!appVerifier) {
      toast({ variant: "destructive", title: "reCAPTCHA Error", description: "reCAPTCHA not ready. Please wait a moment and try again." });
      // Attempt to force re-initialization if appVerifier is null
      // This can happen if the initial setup failed or was cleared.
      if (recaptchaContainerRef.current && !isOtpSent) {
        const verifier = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current, {
          'size': 'invisible',
          'callback': () => {},
          'expired-callback': () => {
            toast({ variant: "destructive", title: "reCAPTCHA Expired", description: "Please try sending OTP again."});
            if (appVerifier) appVerifier.clear(); // Use state version if available
            setAppVerifier(null);
           }
        });
        try {
          await verifier.render();
          setAppVerifier(verifier); // Set it to state
          // Now call the flow with the newly set verifier
          const result = await signInWithPhoneNumberFlow(data.phoneNumber, verifier);
           if (result) {
            setConfirmationResult(result);
            setIsOtpSent(true);
          }
          return; // Exit after attempting re-initialization
        } catch (e) {
            toast({ variant: "destructive", title: "reCAPTCHA Error", description: "Failed to initialize reCAPTCHA. Please refresh and try again." });
            return;
        }
      }
      return;
    }
    
    const result = await signInWithPhoneNumberFlow(data.phoneNumber, appVerifier);
    if (result) {
      setConfirmationResult(result);
      setIsOtpSent(true);
    } else {
      // Error is handled in signInWithPhoneNumberFlow.
      // Consider if reCAPTCHA needs explicit reset here on certain auth errors.
      // For now, relying on expired-callback and re-initialization logic.
    }
  };

  const onVerifyOtpSubmit: SubmitHandler<OtpFormValues> = async (data) => {
    if (!confirmationResult) {
      toast({ variant: "destructive", title: "Verification Error", description: "No OTP confirmation context found." });
      return;
    }
    await confirmOtpFlow(confirmationResult, data.otp);
  };

  const handleGoBackToPhoneNumber = () => {
    setIsOtpSent(false); 
    setConfirmationResult(null); 
    otpForm.reset(); 
    // appVerifier will be cleared and re-initialized by the useEffect due to isOtpSent change
  };

  return (
    <div className="space-y-6">
      {/* This div is used by reCAPTCHA, must be present in the DOM when form is active */}
      {/* It's inside the form, so it mounts/unmounts with the form, handled by useEffect */}
      <div id="recaptcha-container-id" ref={recaptchaContainerRef}></div>

      {!isOtpSent ? (
        <Form {...phoneForm}>
          <form onSubmit={phoneForm.handleSubmit(onSendOtpSubmit)} className="space-y-4">
            <FormField
              control={phoneForm.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="+1 123 456 7890" 
                      {...field} 
                      autoComplete="tel" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loading || !appVerifier} className="w-full">
              {(loading || !appVerifier) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send OTP
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onVerifyOtpSubmit)} className="space-y-4">
            <FormField
              control={otpForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enter OTP</FormLabel>
                  <FormControl><Input type="text" placeholder="••••••" {...field} maxLength={6} autoComplete="one-time-code" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify OTP
            </Button>
            <Button variant="link" onClick={handleGoBackToPhoneNumber} className="w-full" type="button" disabled={loading}>
              Change phone number or try again
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}

