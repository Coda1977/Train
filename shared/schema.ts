import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const drills = pgTable("drills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  videoPath: text("video_path").notNull(),
  thumbnailPath: text("thumbnail_path"),
  duration: integer("duration").default(0), // in seconds
  repetitions: integer("repetitions").default(1),
  accuracy: integer("accuracy").default(0), // percentage 0-100
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workouts = pgTable("workouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  drillIds: jsonb("drill_ids").$type<string[]>().notNull().default([]),
  estimatedDuration: integer("estimated_duration").default(0), // in minutes
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDrillSchema = createInsertSchema(drills).omit({
  id: true,
  createdAt: true,
});

export const insertWorkoutSchema = createInsertSchema(workouts).omit({
  id: true,
  createdAt: true,
});

export type InsertDrill = z.infer<typeof insertDrillSchema>;
export type Drill = typeof drills.$inferSelect;
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Workout = typeof workouts.$inferSelect;
