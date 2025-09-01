import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, MoreHorizontal } from "lucide-react";
import { type Drill } from "@shared/schema";
import { cn } from "@/lib/utils";

interface DrillCardProps {
  drill: Drill;
  onClick?: () => void;
  className?: string;
}

export default function DrillCard({ drill, onClick, className }: DrillCardProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAccuracyColor = (accuracy?: number) => {
    if (!accuracy) return "bg-muted";
    if (accuracy >= 90) return "bg-chart-1";
    if (accuracy >= 80) return "bg-chart-2";
    if (accuracy >= 70) return "bg-chart-3";
    return "bg-chart-4";
  };

  return (
    <Card
      className={cn(
        "drill-card overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        className
      )}
      onClick={onClick}
      data-testid={`card-drill-${drill.id}`}
    >
      <div className="relative aspect-video">
        {drill.thumbnailPath ? (
          <img
            src={drill.thumbnailPath}
            alt={drill.name}
            className="w-full h-full object-cover"
            data-testid={`img-drill-thumbnail-${drill.id}`}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Play className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 bg-primary/90 rounded-full flex items-center justify-center">
            <Play className="h-5 w-5 text-primary-foreground ml-1" />
          </div>
        </div>
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {formatDuration(drill.duration || 0)}
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm mb-1" data-testid={`text-drill-name-${drill.id}`}>
          {drill.name}
        </h3>
        <p className="text-xs text-muted-foreground mb-2" data-testid={`text-drill-details-${drill.id}`}>
          {drill.repetitions} reps • {drill.category}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <div className={cn("w-2 h-2 rounded-full", getAccuracyColor(drill.accuracy || 0))} />
            <span className="text-xs text-muted-foreground" data-testid={`text-accuracy-${drill.id}`}>
              {drill.accuracy || 0}% accuracy
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-auto hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Implement drill options menu
            }}
            data-testid={`button-drill-options-${drill.id}`}
          >
            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
