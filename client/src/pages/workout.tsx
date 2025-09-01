import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play, Save, Plus, X, GripVertical } from "lucide-react";
import DrillCard from "@/components/drill-card";
import { type Drill, type Workout } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function WorkoutBuilder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [workoutName, setWorkoutName] = useState("");
  const [selectedDrills, setSelectedDrills] = useState<Drill[]>([]);

  const { data: drills = [] } = useQuery<Drill[]>({
    queryKey: ["/api/drills"],
  });

  const { data: workouts = [] } = useQuery<Workout[]>({
    queryKey: ["/api/workouts"],
  });

  const createWorkoutMutation = useMutation({
    mutationFn: async (workoutData: any) => {
      return apiRequest("POST", "/api/workouts", workoutData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Workout saved successfully!",
      });
      setWorkoutName("");
      setSelectedDrills([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save workout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addDrillToWorkout = (drill: Drill) => {
    if (selectedDrills.find(d => d.id === drill.id)) return;
    setSelectedDrills(prev => [...prev, drill]);
  };

  const removeDrillFromWorkout = (drillId: string) => {
    setSelectedDrills(prev => prev.filter(d => d.id !== drillId));
  };

  const calculateEstimatedTime = () => {
    const totalSeconds = selectedDrills.reduce((sum, drill) => 
      sum + ((drill.duration || 0) * (drill.repetitions || 1)), 0
    );
    return Math.ceil(totalSeconds / 60);
  };

  const handleSaveWorkout = () => {
    if (!workoutName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a workout name.",
        variant: "destructive",
      });
      return;
    }

    if (selectedDrills.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one drill to the workout.",
        variant: "destructive",
      });
      return;
    }

    const workoutData = {
      name: workoutName,
      drillIds: selectedDrills.map(d => d.id),
      estimatedDuration: calculateEstimatedTime(),
    };

    createWorkoutMutation.mutate(workoutData);
  };

  const handleStartWorkout = () => {
    if (selectedDrills.length === 0) {
      toast({
        title: "Error",
        description: "Please add drills to start a workout.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Coming Soon",
      description: "Workout playback feature coming soon!",
    });
  };

  const availableDrills = drills.filter(drill => 
    !selectedDrills.find(selected => selected.id === drill.id)
  );

  return (
    <div className="px-4 py-6">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="p-2 -ml-2 mr-2"
          onClick={() => setLocation("/")}
          data-testid="button-back-workout"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Workout Builder</h1>
      </div>

      {/* Workout Info */}
      <div className="mb-6">
        <Card className="p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">New Workout</h3>
            <Button
              variant="ghost"
              className="text-primary text-sm font-medium"
              onClick={handleSaveWorkout}
              disabled={createWorkoutMutation.isPending}
              data-testid="button-save-workout"
            >
              Save
            </Button>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="workout-name">Workout Name</Label>
              <Input
                id="workout-name"
                placeholder="Enter workout name"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                data-testid="input-workout-name"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total drills:</span>
              <span className="font-medium" data-testid="text-drill-count">
                {selectedDrills.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estimated time:</span>
              <span className="font-medium" data-testid="text-estimated-time">
                {calculateEstimatedTime()} minutes
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Current Workout Drills */}
      <div className="mb-6">
        <h3 className="font-medium mb-3">Workout Sequence</h3>
        <div className="space-y-3">
          {selectedDrills.length === 0 ? (
            <Card className="border-2 border-dashed border-border p-8 text-center text-muted-foreground">
              <Plus className="h-8 w-8 mx-auto mb-2" />
              <div className="text-sm font-medium">Add drills to build your workout</div>
            </Card>
          ) : (
            selectedDrills.map((drill, index) => (
              <Card key={drill.id} className="p-3 flex items-center shadow-sm">
                <div className="w-2 h-8 bg-muted-foreground/20 rounded mr-3 cursor-move">
                  <GripVertical className="w-2 h-8 text-muted-foreground/40" />
                </div>
                <div className="w-12 h-12 rounded-lg mr-3 overflow-hidden">
                  {drill.thumbnailPath ? (
                    <img
                      src={drill.thumbnailPath}
                      alt={drill.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Play className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm" data-testid={`text-selected-drill-name-${drill.id}`}>
                    {drill.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {drill.repetitions} reps • {Math.ceil((drill.duration || 0) / 60)}:{((drill.duration || 0) % 60).toString().padStart(2, "0")} each
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto hover:bg-muted rounded"
                    onClick={() => removeDrillFromWorkout(drill.id)}
                    data-testid={`button-remove-drill-${drill.id}`}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Available Drills */}
      {availableDrills.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium mb-3">Available Drills</h3>
          <div className="grid grid-cols-2 gap-3">
            {availableDrills.map((drill) => (
              <div key={drill.id} className="relative">
                <DrillCard
                  drill={drill}
                  onClick={() => addDrillToWorkout(drill)}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                  <div className="w-8 h-8 bg-primary/90 rounded-full flex items-center justify-center">
                    <Plus className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Workouts */}
      {workouts.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium mb-3">Saved Workouts</h3>
          <div className="space-y-3">
            {workouts.map((workout) => (
              <Card key={workout.id} className="p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium" data-testid={`text-workout-name-${workout.id}`}>
                      {workout.name}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {workout.drillIds.length} drills • {workout.estimatedDuration} min
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleStartWorkout}
                    data-testid={`button-start-workout-${workout.id}`}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          className="w-full py-3"
          onClick={handleStartWorkout}
          disabled={selectedDrills.length === 0}
          data-testid="button-start-new-workout"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Workout
        </Button>
        <Button
          variant="outline"
          className="w-full py-3"
          onClick={handleSaveWorkout}
          disabled={selectedDrills.length === 0 || createWorkoutMutation.isPending}
          data-testid="button-save-new-workout"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Workout
        </Button>
      </div>
    </div>
  );
}
