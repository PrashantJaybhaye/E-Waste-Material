import {integer, varchar, pgTable, serial, text, timestamp, jsonb, boolean} from "drizzle-orm/pg-core"
import { DESTRUCTION } from "node:dns";

export const Users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const Reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => Users.id).notNull(),
  location: text('location').notNull(),
  wasteType: varchar('waste_type', { length: 255 }).notNull(),
  amount: varchar('amount', { length: 255 }).notNull(),
  imageUrl: text('image_url'),
  verificationresult: jsonb('verification_result'),
  status:varchar('status', { length: 255 }).notNull().default ('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(), 
  collectorId: integer('collector_id').references(() => Users.id),
});

export const Reward = pgTable('reward', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => Users.id).notNull(),
  points:integer('points').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isAvailable: boolean('is_available').notNull().default(true),
  description:text('description'),
  name:varchar('name', { length: 255 }).notNull(),
  collectioninfo:text('collection_info').notNull(),  
});
 
export const CollectedWaste = pgTable('collected_waste', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id').references(() => Reports.id).notNull(),
  collectorId: integer('collector_id').references(() => Users.id).notNull(),
  collectionDate: timestamp('collection_date').notNull(),
  status:varchar('status', { length: 255 }).notNull().default ('collected'),
});

export const Notification = pgTable('notification', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => Users.id).notNull(),
  title: varchar('title', { length:50 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trasaction = pgTable('transaction', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => Users.id).notNull(),
  type: varchar('type', { length:20}).notNull(),
  amount: integer('amount').notNull(),
  decscription: text('description').notNull(),
  date:timestamp('date').defaultNow().notNull(),
});

