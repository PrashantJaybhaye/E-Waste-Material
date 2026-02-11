
# ♻️ Zero-to-Hero Waste Management AI App

A comprehensive, AI-enhanced platform dedicated to streamlining the waste collection process along with **E-Waste**. This system bridges the gap between individuals, waste collectors, and recycling organizations by incentivizing responsible waste disposal through a gamified reward structure.

## 🌟 Overview

The **Waste Management System** empowers users to report waste, which is then verified using **Google Gemini AI** to ensure accuracy. Collectors can efficiently locate and pick up reported waste, earning rewards for their efforts. The platform fosters a community of eco-conscious individuals competing on a dynamic leaderboard while making a tangible environmental impact.

## ✨ Key Features

### 📱 For Users (Reporters)

- **AI Verification**: Automatically identifies and estimates the quantity of waste from uploaded images using **Google Gemini AI**.
- **Easy Reporting**: Simple interface to submit waste details, including type, estimated quantity, and precise location.
- **Reward Points**: Earn points for every verified report, which accumulate in a personal wallet.
- **Real-time Notifications**: Get instant alerts when your report is verified or collected.
- **Dynamic Leaderboard**: Compete with others and track your ranking based on total points earned.

### 🚛 For Collectors

- **Task Management**: View a list of available waste collection tasks with filtering options.
- **Status Updates**: Mark tasks as "Collected" to trigger verification and reward distribution.
- **Verification**: Ensure the collected waste matches the report for system integrity.

### 🏆 Gamification & Social

- **Leaderboard**: dynamic ranking system based on total points earned, encouraging healthy competition.
- **Levels**: Progress through levels (e.g., Level 1, Level 2) based on your contribution history.
- **Impact Tracking**: Visualize total waste collected and reports submitted.

### ⚙️ Core System

- **Secure Authentication**: Powered by **Clerk** for seamless sign-up and login.
- **Database**: Robust real-time data management using **Firebase Firestore**.
- **Responsive Design**: Built with **Next.js 15+** and **Tailwind CSS v4** for a premium experience on mobile and desktop.
- **Smart Location**: Integrated location search and mapping features.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React
- **Backend**: Next.js Server Actions
- **Database**: Firebase Firestore
- **Authentication**: Clerk
- **AI Integration**: Google Generative AI (Gemini)
- **Notifications**: React Hot Toast
- **Language**: TypeScript

---

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

- Node.js (v18+)
- npm or yarn
- A Firebase project
- A Clerk account
- A Google Cloud Console account (for Gemini API)

### 1. Clone the Repository

```bash
git clone https://github.com/rxhul05/E-Waste-Material.git
cd E-Waste-Material
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory and populate it with your credentials:

```env
# Google Gemini AI
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSy...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

### 4. Run the Application

Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the app.

---

## 📂 Project Structure

```bash
E-Waste-Material/
├── 📂 app/                            # Application routes (Next.js App Router)
│   ├── 📂 (auth)/                     # Authentication routes (Clerk)
│   ├── 📂 api/                        # API endpoints
│   ├── 📂 collect/
│   │   └── page.tsx                   # Waste collection interface & verification
│   ├── 📂 leaderboard/
│   │   └── page.tsx                   # User rankings & points display
│   ├── 📂 report/
│   │   └── page.tsx                   # AI-powered waste reporting form
│   ├── 📂 rewards/
│   │   └── page.tsx                   # Check balance & redeem rewards
│   ├── globals.css                    # Global styles & Tailwind directives
│   ├── layout.tsx                     # Root layout (includes Header & Sidebar)
│   └── page.tsx                       # Landing page / Home
├── 📂 components/                     # Reusable UI components
│   ├── Header.tsx                     # Top navigation bar
│   └── Sidebar.tsx                    # Side navigation menu
├── 📂 hooks/                          # Custom React hooks
│   └── useMediaQuery.ts               # Hook for responsive design measurements
├── 📂 utils/                          # Backend utilities
│   └── 📂 db/
│       ├── actions.ts                 # Server Actions for Firestore operations
│       └── dbConfig.ts                # Firebase configuration and initialization
├── .env.local                         # Environment variables
├── next.config.ts                     # Next.js configuration
├── package.json                       # Dependencies & scripts
└── tailwind.config.ts                 # Tailwind CSS configuration
```

## 🤝 Contributing

We welcome contributions! Please fork the repository and submit a pull request for any features, bug fixes, or documentation improvements.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
