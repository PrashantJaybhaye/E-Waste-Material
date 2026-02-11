import { pgTable, serial, text, varchar, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core';

export const Users = pgTable('users', {
  id: varchar('id').primaryKey(),
  email: varchar('email').notNull(),
  name: varchar('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const Reports = pgTable('reports', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  location: text('location').notNull(),
  wasteType: varchar('waste_type').notNull(),
  amount: varchar('amount').notNull(),
  imageUrl: text('image_url'),
  verificationResult: jsonb('verification_result'),
  status: varchar('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  collectorId: varchar('collector_id'),
});

export const Rewards = pgTable('rewards', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  points: integer('points').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
  description: text('description'),
  name: varchar('name').notNull(),
  collectionInfo: text('collection_info').notNull(),
});

export const CollectedWaste = pgTable('collected_waste', {
  id: varchar('id').primaryKey(),
  reportId: varchar('report_id').notNull(),
  collectorId: varchar('collector_id').notNull(),
  collectionDate: timestamp('collection_date').notNull(),
  status: varchar('status').notNull().default('collected'),
  verificationResult: jsonb('verification_result'),
});

export const Notification = pgTable('notifications', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  message: text('message').notNull(),
  type: varchar('type').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const Transaction = pgTable('transactions', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  type: varchar('type').notNull(), // 'earned_report' | 'earned_collect' | 'redeemed'
  amount: integer('amount').notNull(),
  description: text('description').notNull(),
  date: timestamp('date').defaultNow().notNull(),
});

// Interfaces (kept for compatibility with existing code that uses them as types)
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Report {
  id: string;
  userId: string;
  location: string;
  wasteType: string;
  amount: string;
  imageUrl?: string;
  verificationResult?: any;
  status: string;
  createdAt: Date;
  collectorId?: string;
}

export interface Reward {
  id: string;
  userId: string;
  points: number;
  createdAt: Date;
  updatedAt: Date;
  isAvailable: boolean;
  description?: string;
  name: string;
  collectionInfo: string;
}

export interface CollectedWaste {
  id: string;
  reportId: string;
  collectorId: string;
  collectionDate: Date;
  status: string;
  verificationResult?: any;
}

export interface Notification { // Note: This conflicts with the table export name 'Notification' above if imported as value?
  // If imported as type "import { Notification }", it works (interface merging or just one is type).
  // But if imported as value 'Notification', it will be the table.
  // The prompt asked to restore pgTable exports "Notifications" (actually prompt said Notification).
  // I will check if I can rename the interface or table?
  // "Using pgTable... ensure the exported table symbols (Users, Reports, Rewards, CollectedWaste, Notification, Transaction) match..."
  // So 'Notification' MUST be the table.
  // The existing code has `interface Notification`.
  // TypeScript allows merging interface and const if they have same name? No, only class/interface or function/namespace.
  // I cannot export `const Notification` and `interface Notification`.
  // I MUST rename the interface or the table.
  // But usage in `Header.tsx` imports `Notification`.
  // `Header.tsx` line 21: `interface Notification { ... }` locally defined!
  // It commented out `// import { Notification } from "@/utils/db/schema"`.
  // So Header is safe.
  // What about other files?
  // If I export `const Notification`, I cannot export `interface Notification`.
  // I'll assume users want the Table as `Notification`.
  // I will comment out the interfaces that conflict, or rename them `NotificationType` etc.
  // But that breaks type imports.
  // Maybe I export `type Notification = typeof Notification.$inferSelect`?
  // But validationResult is JSON, so inferred type is `unknown`.
  // I will try to export the type using helper.
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'earned_report' | 'earned_collect' | 'redeemed';
  amount: number;
  description: string;
  date: Date;
}
