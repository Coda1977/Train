import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Play, Pause, RotateCcw, Maximize, Share2, Heart, Plus, Edit } from "lucide-react";
import { type Drill } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function DrillView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [progress, setProgress] = useState(0);

  const { data: drill, isLoading } = useQuery<Drill>({
    queryKey: ["/api/drills", id],
    enabled: !!id,
  });

  const addToWorkoutMutation = useMutation({
    mutationFn: async () => {
      // For now, just show a success message
      // In a real app, this would open a workout selection dialog
      return Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Drill added to workout!",
      });
    },
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    // Auto-play and loop
    video.loop = isLooping;
    if (isPlaying) {
      video.play().catch(console.error);
    }

    return () => {
      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [drill, isLooping, isPlaying]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.error);
    }
  };

  const toggleLoop = () => {
    setIsLooping(prev => !prev);
    if (videoRef.current) {
      videoRef.current.loop = !isLooping;
    }
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen().catch(console.error);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="relative h-screen bg-black">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    );
  }

  if (!drill) {
    return (
      <div className="relative h-screen bg-black">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-xl mb-4">Drill not found</div>
            <Button onClick={() => setLocation("/")} variant="outline">
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-black">
      {/* Video Player */}
      <div className="relative h-2/3">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          src={drill.videoPath}
          loop={isLooping}
          muted
          playsInline
          data-testid="video-drill-player"
        />
        
        {/* Video Controls Overlay */}
        <div className="absolute inset-0 flex items-end">
          <div className="w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between text-white mb-2">
              <Button
                variant="ghost"
                size="icon"
                className="p-2 rounded-full bg-black/50 hover:bg-black/70"
                onClick={() => setLocation("/")}
                data-testid="button-back-drill"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-2 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={togglePlayback}
                  data-testid="button-play-pause"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-1" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "p-2 rounded-full bg-black/50 hover:bg-black/70",
                    isLooping && "text-primary"
                  )}
                  onClick={toggleLoop}
                  data-testid="button-toggle-loop"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-2 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={toggleFullscreen}
                  data-testid="button-fullscreen"
                >
                  <Maximize className="h-5 w-5" />
                </Button>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1 bg-white/30 rounded-full">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Drill Information */}
      <div className="h-1/3 bg-card p-4 overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold mb-1" data-testid="text-drill-name">
              {drill.name}
            </h1>
            <p className="text-muted-foreground text-sm mb-2" data-testid="text-drill-category">
              {drill.category} • {drill.repetitions} reps
            </p>
            
            {/* Stats */}
            <div className="flex space-x-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  (drill.accuracy || 0) >= 90 ? "bg-chart-1" : 
                  (drill.accuracy || 0) >= 80 ? "bg-chart-2" : 
                  (drill.accuracy || 0) >= 70 ? "bg-chart-3" : "bg-chart-4"
                )} />
                <span className="text-sm text-muted-foreground" data-testid="text-drill-accuracy">
                  {drill.accuracy || 0}% accuracy
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-muted" />
                <span className="text-sm text-muted-foreground" data-testid="text-drill-duration">
                  {formatDuration(drill.duration || 0)} loop
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg bg-muted hover:bg-muted/80"
              data-testid="button-share-drill"
            >
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg bg-muted hover:bg-muted/80"
              data-testid="button-favorite-drill"
            >
              <Heart className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Drill Analysis */}
        <div className="mb-4">
          <h3 className="font-medium mb-2">Analysis</h3>
          <Card className="bg-muted/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Movement Consistency</span>
              <span className="text-sm font-medium" data-testid="text-movement-consistency">
                {drill.accuracy || 0}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-chart-1 h-2 rounded-full transition-all"
                style={{ width: `${drill.accuracy || 0}%` }}
              />
            </div>
          </Card>
        </div>

        {/* Training Notes */}
        {drill.notes && (
          <div className="mb-4">
            <h3 className="font-medium mb-2">Training Notes</h3>
            <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-drill-notes">
              {drill.notes}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            className="flex-1 py-3"
            onClick={() => addToWorkoutMutation.mutate()}
            disabled={addToWorkoutMutation.isPending}
            data-testid="button-add-to-workout"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Workout
          </Button>
          <Button
            variant="outline"
            className="flex-1 py-3"
            onClick={() => {
              // TODO: Implement edit drill functionality
              toast({
                title: "Coming Soon",
                description: "Edit drill functionality coming soon!",
              });
            }}
            data-testid="button-edit-drill"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Drill
          </Button>
        </div>
      </div>
    </div>
  );
}
