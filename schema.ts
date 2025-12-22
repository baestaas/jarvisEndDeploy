import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  gender: text("gender").default("male"), // "male" | "female"
  preferences: text("preferences").default("{}"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  backupCodes: text("backup_codes").array(),
  telegramChatId: varchar("telegram_chat_id", { length: 36 }),
  telegramLinkCode: varchar("telegram_link_code", { length: 8 }),
  telegramLinked: boolean("telegram_linked").default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  passwordHash: true,
  role: true,
  gender: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const events = pgTable("events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("meeting"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  location: text("location"),
  isVirtual: boolean("is_virtual").default(false),
  isNotified: boolean("is_notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export const financeRecords = pgTable("finance_records", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull(),
  recordType: text("record_type").notNull().default("expense"),
  description: text("description"),
  date: timestamp("date").defaultNow(),
});

export const insertFinanceRecordSchema = createInsertSchema(financeRecords).omit({
  id: true,
});

export type InsertFinanceRecord = z.infer<typeof insertFinanceRecordSchema>;
export type FinanceRecord = typeof financeRecords.$inferSelect;

export const moodEntries = pgTable("mood_entries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  mood: text("mood").notNull(),
  score: integer("score"),
  notes: text("notes"),
  recommendation: text("recommendation"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMoodEntrySchema = createInsertSchema(moodEntries).omit({
  id: true,
  createdAt: true,
});

export type InsertMoodEntry = z.infer<typeof insertMoodEntrySchema>;
export type MoodEntry = typeof moodEntries.$inferSelect;

export const reminders = pgTable("reminders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  remindAt: timestamp("remind_at").notNull(),
  isCompleted: boolean("is_completed").default(false),
  isNotified: boolean("is_notified").default(false),
  repeatType: text("repeat_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReminderSchema = createInsertSchema(reminders).omit({
  id: true,
  createdAt: true,
});

export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  message: text("message"),
  notificationType: text("notification_type").default("info"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const directives = pgTable("directives", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priority: integer("priority").default(0),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDirectiveSchema = createInsertSchema(directives).omit({
  id: true,
  createdAt: true,
});

export type InsertDirective = z.infer<typeof insertDirectiveSchema>;
export type Directive = typeof directives.$inferSelect;

export interface SmartDevice {
  id: string;
  name: string;
  type: "light" | "ac" | "tv" | "lock" | "vacuum";
  room: string;
  isOn: boolean;
  brightness?: number;
  temperature?: number;
  mode?: string;
}

export interface SmartScene {
  id: string;
  name: string;
  icon: string;
  devices: { deviceId: string; settings: Record<string, unknown> }[];
}

export interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  description: string;
  icon: string;
}

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
}

export interface VoiceSettings {
  voice: string;
  emotion: string;
  dialogMode: boolean;
  wakeWord: string;
}

export interface Translation {
  original: string;
  translated: string;
  targetLang: string;
}

// AI Chat tables for IDE
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Self-learning: User preferences and patterns
export const userLearning = pgTable("user_learning", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  category: text("category").notNull(), // "preference", "command", "pattern", "feedback"
  key: text("key").notNull(),
  value: text("value").notNull(),
  weight: integer("weight").default(1).notNull(), // importance/frequency
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const jarvisMemory = pgTable("jarvis_memory", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  interaction: text("interaction").notNull(), // user input
  response: text("response").notNull(), // jarvis response
  feedback: text("feedback"), // "positive", "negative", null
  context: text("context"), // JSON with additional context
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserLearningSchema = createInsertSchema(userLearning).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJarvisMemorySchema = createInsertSchema(jarvisMemory).omit({
  id: true,
  createdAt: true,
});

export type UserLearning = typeof userLearning.$inferSelect;
export type InsertUserLearning = z.infer<typeof insertUserLearningSchema>;
export type JarvisMemory = typeof jarvisMemory.$inferSelect;
export type InsertJarvisMemory = z.infer<typeof insertJarvisMemorySchema>;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const familyGroups = pgTable("family_groups", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: varchar("owner_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  inviteCode: varchar("invite_code", { length: 8 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFamilyGroupSchema = createInsertSchema(familyGroups).omit({
  id: true,
  createdAt: true,
});

export type InsertFamilyGroup = z.infer<typeof insertFamilyGroupSchema>;
export type FamilyGroup = typeof familyGroups.$inferSelect;

export const familyMembers = pgTable("family_members", {
  id: varchar("id", { length: 36 }).primaryKey(),
  groupId: varchar("group_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;

export const sharedLists = pgTable("shared_lists", {
  id: varchar("id", { length: 36 }).primaryKey(),
  groupId: varchar("group_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  listType: text("list_type").notNull().default("shopping"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSharedListSchema = createInsertSchema(sharedLists).omit({
  id: true,
  createdAt: true,
});

export type InsertSharedList = z.infer<typeof insertSharedListSchema>;
export type SharedList = typeof sharedLists.$inferSelect;

export const sharedListItems = pgTable("shared_list_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  listId: varchar("list_id", { length: 36 }).notNull(),
  text: text("text").notNull(),
  completed: boolean("completed").default(false),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSharedListItemSchema = createInsertSchema(sharedListItems).omit({
  id: true,
  createdAt: true,
});

export type InsertSharedListItem = z.infer<typeof insertSharedListItemSchema>;
export type SharedListItem = typeof sharedListItems.$inferSelect;
