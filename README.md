# NutriMe.AI - Nutrition Management App

A Next.js application for nutrition tracking, meal planning, and AI-powered recipe generation.

## Getting Started

### Prerequisites
- Node.js 18+ 
- Firebase project
- Google AI (Gemini) API key

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd nutrime
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Fill in your actual values in `.env.local`:
   - Get Firebase config from your Firebase project settings
   - Get Google AI API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

This project requires the following environment variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain  
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` - Firebase app ID
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` - Firebase measurement ID
- `GOOGLE_GENAI_API_KEY` - Google AI (Gemini) API key

### Deployment

When deploying to platforms like Netlify or Vercel, make sure to add all environment variables in your deployment platform's settings.

## Features

- User authentication with Firebase Auth
- Nutrition tracking and meal logging
- AI-powered recipe generation
- Meal planning and grocery lists
- Community features for sharing recipes
- Pantry and fridge management

## Tech Stack

- Next.js 15
- TypeScript
- Firebase (Auth, Firestore)
- Google AI (Gemini)
- Tailwind CSS
- Shadcn/ui Components
