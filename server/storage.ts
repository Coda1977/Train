import { type Drill, type InsertDrill, type Workout, type InsertWorkout } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Drill operations
  createDrill(drill: InsertDrill): Promise<Drill>;
  getDrills(category?: string): Promise<Drill[]>;
  getDrill(id: string): Promise<Drill | undefined>;
  updateDrill(id: string, drill: Partial<InsertDrill>): Promise<Drill | undefined>;
  deleteDrill(id: string): Promise<boolean>;

  // Workout operations
  createWorkout(workout: InsertWorkout): Promise<Workout>;
  getWorkouts(): Promise<Workout[]>;
  getWorkout(id: string): Promise<Workout | undefined>;
  getWorkoutWithDrills(id: string): Promise<(Workout & { drills: Drill[] }) | undefined>;
  updateWorkout(id: string, workout: Partial<InsertWorkout>): Promise<Workout | undefined>;
  deleteWorkout(id: string): Promise<boolean>;

  // Stats
  getStats(): Promise<{
    totalDrills: number;
    totalWorkouts: number;
    hoursAnalyzed: number;
  }>;
}

export class MemStorage implements IStorage {
  private drills: Map<string, Drill>;
  private workouts: Map<string, Workout>;

  constructor() {
    this.drills = new Map();
    this.workouts = new Map();
  }

  // Drill operations
  async createDrill(insertDrill: InsertDrill): Promise<Drill> {
    const id = randomUUID();
    const drill: Drill = {
      ...insertDrill,
      id,
      createdAt: new Date(),
      duration: insertDrill.duration || 0,
      repetitions: insertDrill.repetitions || 1,
      accuracy: insertDrill.accuracy || 0,
      notes: insertDrill.notes || null,
      thumbnailPath: insertDrill.thumbnailPath || null,
    };
    this.drills.set(id, drill);
    return drill;
  }

  async getDrills(category?: string): Promise<Drill[]> {
    const allDrills = Array.from(this.drills.values());
    if (category && category !== "All") {
      return allDrills.filter(drill => drill.category === category);
    }
    return allDrills.sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getDrill(id: string): Promise<Drill | undefined> {
    return this.drills.get(id);
  }

  async updateDrill(id: string, drillUpdate: Partial<InsertDrill>): Promise<Drill | undefined> {
    const existing = this.drills.get(id);
    if (!existing) return undefined;

    const updated: Drill = { ...existing, ...drillUpdate };
    this.drills.set(id, updated);
    return updated;
  }

  async deleteDrill(id: string): Promise<boolean> {
    return this.drills.delete(id);
  }

  // Workout operations
  async createWorkout(insertWorkout: InsertWorkout): Promise<Workout> {
    const id = randomUUID();
    const workout: Workout = {
      ...insertWorkout,
      id,
      createdAt: new Date(),
      drillIds: (insertWorkout.drillIds as string[]) || [],
      estimatedDuration: insertWorkout.estimatedDuration || 0,
    };
    this.workouts.set(id, workout);
    return workout;
  }

  async getWorkouts(): Promise<Workout[]> {
    return Array.from(this.workouts.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getWorkout(id: string): Promise<Workout | undefined> {
    return this.workouts.get(id);
  }

  async getWorkoutWithDrills(id: string): Promise<(Workout & { drills: Drill[] }) | undefined> {
    const workout = this.workouts.get(id);
    if (!workout) return undefined;

    const drills = workout.drillIds.map(drillId => this.drills.get(drillId)).filter(Boolean) as Drill[];
    return { ...workout, drills };
  }

  async updateWorkout(id: string, workoutUpdate: Partial<InsertWorkout>): Promise<Workout | undefined> {
    const existing = this.workouts.get(id);
    if (!existing) return undefined;

    const updated: Workout = { 
      ...existing, 
      ...workoutUpdate,
      drillIds: (workoutUpdate.drillIds as string[]) || existing.drillIds,
      estimatedDuration: workoutUpdate.estimatedDuration || existing.estimatedDuration,
    };
    this.workouts.set(id, updated);
    return updated;
  }

  async deleteWorkout(id: string): Promise<boolean> {
    return this.workouts.delete(id);
  }

  // Stats
  async getStats(): Promise<{ totalDrills: number; totalWorkouts: number; hoursAnalyzed: number }> {
    const totalDrills = this.drills.size;
    const totalWorkouts = this.workouts.size;
    
    // Calculate total hours from drill durations
    const totalSeconds = Array.from(this.drills.values())
      .reduce((sum, drill) => sum + (drill.duration || 0), 0);
    const hoursAnalyzed = Math.round((totalSeconds / 3600) * 10) / 10;

    return {
      totalDrills,
      totalWorkouts,
      hoursAnalyzed,
    };
  }
}

export const storage = new MemStorage();
