import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertDrillSchema, insertWorkoutSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Serve uploaded videos
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get upload URL for videos
  app.post("/api/videos/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Create drill after video upload
  app.post("/api/drills", async (req, res) => {
    try {
      const validatedData = insertDrillSchema.parse(req.body);
      
      // Normalize video path if it's a full URL
      if (validatedData.videoPath.startsWith("https://")) {
        validatedData.videoPath = objectStorageService.normalizeObjectEntityPath(validatedData.videoPath);
      }
      
      const drill = await storage.createDrill(validatedData);
      res.json(drill);
    } catch (error) {
      console.error("Error creating drill:", error);
      res.status(400).json({ error: "Invalid drill data" });
    }
  });

  // Get all drills
  app.get("/api/drills", async (req, res) => {
    try {
      const category = req.query.category as string;
      const drills = await storage.getDrills(category);
      res.json(drills);
    } catch (error) {
      console.error("Error fetching drills:", error);
      res.status(500).json({ error: "Failed to fetch drills" });
    }
  });

  // Get single drill
  app.get("/api/drills/:id", async (req, res) => {
    try {
      const drill = await storage.getDrill(req.params.id);
      if (!drill) {
        return res.status(404).json({ error: "Drill not found" });
      }
      res.json(drill);
    } catch (error) {
      console.error("Error fetching drill:", error);
      res.status(500).json({ error: "Failed to fetch drill" });
    }
  });

  // Update drill
  app.put("/api/drills/:id", async (req, res) => {
    try {
      const validatedData = insertDrillSchema.partial().parse(req.body);
      const drill = await storage.updateDrill(req.params.id, validatedData);
      if (!drill) {
        return res.status(404).json({ error: "Drill not found" });
      }
      res.json(drill);
    } catch (error) {
      console.error("Error updating drill:", error);
      res.status(400).json({ error: "Invalid drill data" });
    }
  });

  // Delete drill
  app.delete("/api/drills/:id", async (req, res) => {
    try {
      const success = await storage.deleteDrill(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Drill not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting drill:", error);
      res.status(500).json({ error: "Failed to delete drill" });
    }
  });

  // Create workout
  app.post("/api/workouts", async (req, res) => {
    try {
      const validatedData = insertWorkoutSchema.parse(req.body);
      const workout = await storage.createWorkout(validatedData);
      res.json(workout);
    } catch (error) {
      console.error("Error creating workout:", error);
      res.status(400).json({ error: "Invalid workout data" });
    }
  });

  // Get all workouts
  app.get("/api/workouts", async (req, res) => {
    try {
      const workouts = await storage.getWorkouts();
      res.json(workouts);
    } catch (error) {
      console.error("Error fetching workouts:", error);
      res.status(500).json({ error: "Failed to fetch workouts" });
    }
  });

  // Get single workout with drill details
  app.get("/api/workouts/:id", async (req, res) => {
    try {
      const workout = await storage.getWorkoutWithDrills(req.params.id);
      if (!workout) {
        return res.status(404).json({ error: "Workout not found" });
      }
      res.json(workout);
    } catch (error) {
      console.error("Error fetching workout:", error);
      res.status(500).json({ error: "Failed to fetch workout" });
    }
  });

  // Update workout
  app.put("/api/workouts/:id", async (req, res) => {
    try {
      const validatedData = insertWorkoutSchema.partial().parse(req.body);
      const workout = await storage.updateWorkout(req.params.id, validatedData);
      if (!workout) {
        return res.status(404).json({ error: "Workout not found" });
      }
      res.json(workout);
    } catch (error) {
      console.error("Error updating workout:", error);
      res.status(400).json({ error: "Invalid workout data" });
    }
  });

  // Delete workout
  app.delete("/api/workouts/:id", async (req, res) => {
    try {
      const success = await storage.deleteWorkout(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Workout not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting workout:", error);
      res.status(500).json({ error: "Failed to delete workout" });
    }
  });

  // Get stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
