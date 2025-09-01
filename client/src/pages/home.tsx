import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Dumbbell } from "lucide-react";
import DrillCard from "@/components/drill-card";
import { type Drill } from "@shared/schema";
import { cn } from "@/lib/utils";

const categories = ["All", "Basketball", "Soccer", "Tennis", "Boxing", "Other"];

export default function Home() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("All");

  const { data: stats } = useQuery<{
    totalDrills: number;
    totalWorkouts: number;
    hoursAnalyzed: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: drills = [], isLoading } = useQuery<Drill[]>({
    queryKey: ["/api/drills", selectedCategory !== "All" ? selectedCategory : undefined],
  });

  const handleDrillClick = (drillId: string) => {
    setLocation(`/drill/${drillId}`);
  };

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4 text-center animate-pulse">
              <div className="h-6 bg-muted rounded mb-2" />
              <div className="h-3 bg-muted rounded" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Stats Section */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-primary" data-testid="text-stats-drills">
            {stats?.totalDrills || 0}
          </div>
          <div className="text-xs text-muted-foreground">Total Drills</div>
        </Card>
        <Card className="p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-primary" data-testid="text-stats-workouts">
            {stats?.totalWorkouts || 0}
          </div>
          <div className="text-xs text-muted-foreground">Workouts</div>
        </Card>
        <Card className="p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-primary" data-testid="text-stats-hours">
            {stats?.hoursAnalyzed || 0}
          </div>
          <div className="text-xs text-muted-foreground">Hours</div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6">
        <Button
          className="flex-1 py-3 shadow-lg"
          onClick={() => setLocation("/upload")}
          data-testid="button-add-drill"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Drill
        </Button>
        <Button
          variant="outline"
          className="flex-1 py-3"
          onClick={() => setLocation("/workout")}
          data-testid="button-workout"
        >
          <Dumbbell className="h-4 w-4 mr-2" />
          Workout
        </Button>
      </div>

      {/* Drill Categories */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-4">Your Drills</h2>
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              className={cn(
                "rounded-full text-sm font-medium whitespace-nowrap",
                selectedCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
              onClick={() => setSelectedCategory(category)}
              data-testid={`button-category-${category.toLowerCase()}`}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Drill Cards Grid */}
      {drills.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground mb-4">
            {selectedCategory === "All" 
              ? "No drills created yet. Upload your first training video to get started!"
              : `No ${selectedCategory} drills found.`
            }
          </div>
          <Button onClick={() => setLocation("/upload")} data-testid="button-upload-first">
            <Plus className="h-4 w-4 mr-2" />
            Upload Video
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {drills.map((drill) => (
            <DrillCard
              key={drill.id}
              drill={drill}
              onClick={() => handleDrillClick(drill.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
