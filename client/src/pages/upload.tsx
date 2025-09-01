import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, CloudUpload, Wand2 } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UploadResult } from "@uppy/core";

export default function Upload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    notes: "",
    autoDetect: true,
    generateThumbnails: true,
    createLoops: true,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/videos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to get upload URL");
      return response.json();
    },
  });

  const createDrillMutation = useMutation({
    mutationFn: async (drillData: any) => {
      return apiRequest("POST", "/api/drills", drillData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Drill created successfully!",
      });
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create drill. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVideoSelect = (file: File) => {
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    
    // Auto-populate name from filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    setFormData(prev => ({ ...prev, name: nameWithoutExt }));
  };

  const handleGetUploadParameters = async () => {
    const result = await uploadMutation.mutateAsync();
    return {
      method: "PUT" as const,
      url: result.uploadURL,
    };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    const uploadedFile = result.successful?.[0];
    if (uploadedFile?.uploadURL) {
      // Process the video and create drill
      handleProcessVideo(uploadedFile.uploadURL);
    }
  };

  const handleProcessVideo = async (uploadedVideoUrl: string) => {
    if (!formData.name || !formData.category) {
      toast({
        title: "Error",
        description: "Please fill in drill name and category.",
        variant: "destructive",
      });
      return;
    }

    // Mock video analysis - in real app this would involve ML processing
    const mockDuration = Math.floor(Math.random() * 30) + 15; // 15-45 seconds
    const mockRepetitions = Math.floor(Math.random() * 5) + 3; // 3-8 reps
    const mockAccuracy = Math.floor(Math.random() * 20) + 80; // 80-100% accuracy

    const drillData = {
      name: formData.name,
      category: formData.category,
      videoPath: uploadedVideoUrl,
      duration: mockDuration,
      repetitions: mockRepetitions,
      accuracy: mockAccuracy,
      notes: formData.notes || undefined,
    };

    createDrillMutation.mutate(drillData);
  };

  const isProcessing = uploadMutation.isPending || createDrillMutation.isPending;

  return (
    <div className="px-4 py-6">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="p-2 -ml-2 mr-2"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Add New Drill</h1>
      </div>

      {/* Upload Area */}
      <div className="mb-6">
        <Card className="border-2 border-dashed border-border p-8 text-center bg-muted/20 hover:bg-muted/30 transition-colors">
          <div className="mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CloudUpload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">Upload Training Video</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Drag and drop your video file here, or click to browse
            </p>
            
            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={104857600} // 100MB
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleUploadComplete}
              buttonClassName="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium"
            >
              Choose File
            </ObjectUploader>
          </div>
          <div className="text-xs text-muted-foreground">
            Supported formats: MP4, MOV, AVI • Max size: 100MB
          </div>
        </Card>
      </div>

      {/* Video Preview */}
      {videoUrl && (
        <div className="mb-6">
          <Card className="p-4 shadow-sm">
            <h3 className="font-medium mb-3">Video Preview</h3>
            <div className="aspect-video bg-muted rounded-lg mb-4 relative overflow-hidden">
              <video
                src={videoUrl}
                className="w-full h-full object-cover"
                controls
                data-testid="video-preview"
              />
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="drill-name">Drill Name</Label>
                <Input
                  id="drill-name"
                  placeholder="e.g., Basketball Crossover"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-drill-name"
                />
              </div>
              <div>
                <Label htmlFor="drill-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basketball">Basketball</SelectItem>
                    <SelectItem value="Soccer">Soccer</SelectItem>
                    <SelectItem value="Tennis">Tennis</SelectItem>
                    <SelectItem value="Boxing">Boxing</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="drill-notes">Notes (Optional)</Label>
                <Textarea
                  id="drill-notes"
                  placeholder="Add any training notes or instructions..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="h-24 resize-none"
                  data-testid="textarea-notes"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Analysis Options */}
      <div className="mb-6">
        <Card className="p-4 shadow-sm">
          <h3 className="font-medium mb-3">Analysis Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Auto-detect repetitions</div>
                <div className="text-xs text-muted-foreground">Find the best repeated movements</div>
              </div>
              <Switch
                checked={formData.autoDetect}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoDetect: checked }))}
                data-testid="switch-auto-detect"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Generate thumbnails</div>
                <div className="text-xs text-muted-foreground">Create preview images automatically</div>
              </div>
              <Switch
                checked={formData.generateThumbnails}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, generateThumbnails: checked }))}
                data-testid="switch-thumbnails"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Create seamless loops</div>
                <div className="text-xs text-muted-foreground">Generate smooth looping animations</div>
              </div>
              <Switch
                checked={formData.createLoops}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, createLoops: checked }))}
                data-testid="switch-loops"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <ObjectUploader
          maxNumberOfFiles={1}
          maxFileSize={104857600}
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleUploadComplete}
          buttonClassName="w-full py-3 rounded-xl font-medium disabled:opacity-50"
        >
          <div className="flex items-center justify-center space-x-2">
            <Wand2 className="h-4 w-4" />
            <span>{isProcessing ? "Processing..." : "Analyze & Process Video"}</span>
          </div>
        </ObjectUploader>
        
        <Button
          variant="outline"
          className="w-full py-3"
          onClick={() => setLocation("/")}
          disabled={isProcessing}
          data-testid="button-cancel"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
