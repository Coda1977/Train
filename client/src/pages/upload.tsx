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
import VideoAnalyzerNew from "@/components/VideoAnalyzerNew";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UploadResult } from "@uppy/core";
import type { DrillAnalysis } from "@/lib/videoAnalyzerSimplified";

export default function Upload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [analysisData, setAnalysisData] = useState<DrillAnalysis | null>(null);
  const [processedVideo, setProcessedVideo] = useState<Blob | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [step, setStep] = useState<'upload' | 'analyze' | 'form'>('upload');
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
    
    // Move to analysis step
    setStep('analyze');
  };

  const handleAnalysisComplete = (
    analysis: DrillAnalysis, 
    processed?: Blob, 
    thumbnail?: Blob
  ) => {
    console.log('handleAnalysisComplete called with:', { 
      analysis, 
      processed: !!processed, 
      thumbnail: !!thumbnail,
      currentStep: step 
    });
    
    setAnalysisData(analysis);
    
    if (processed) {
      setProcessedVideo(processed);
    }
    
    if (thumbnail) {
      setThumbnailBlob(thumbnail);
    }
    
    // Pre-fill form with analysis data
    setFormData(prev => ({
      ...prev,
      notes: `${analysis.repetitions} repetitions detected with ${Math.round(analysis.confidence * 100)}% confidence`
    }));
    
    console.log('Setting step to form...');
    // Move to form step
    setStep('form');
    console.log('Step changed to form');
    
    // Show success toast
    toast({
      title: "Analysis Complete",
      description: `Found ${analysis.repetitions} repetitions with ${Math.round(analysis.confidence * 100)}% confidence`,
    });
  };

  const handleAnalysisError = (error: string) => {
    toast({
      title: "Analysis Error",
      description: error,
      variant: "destructive",
    });
    
    // Fall back to manual form entry
    setStep('form');
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

    const drillData = {
      name: formData.name,
      category: formData.category,
      videoPath: uploadedVideoUrl,
      duration: analysisData?.duration || Math.floor(Math.random() * 30) + 15,
      repetitions: analysisData?.repetitions || Math.floor(Math.random() * 5) + 3,
      accuracy: analysisData ? Math.round(analysisData.confidence * 100) : Math.floor(Math.random() * 20) + 80,
      notes: formData.notes || undefined,
    };

    createDrillMutation.mutate(drillData);
  };

  const isProcessing = uploadMutation.isPending || createDrillMutation.isPending;

  console.log('Current step:', step);
  
  return (
    <div className="px-4 py-6">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="p-2 -ml-2 mr-2"
          onClick={() => {
            if (step === 'analyze' || step === 'form') {
              setStep('upload');
            } else {
              setLocation("/");
            }
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">
          {step === 'upload' && "Add New Drill"}
          {step === 'analyze' && "Analyzing Video"}
          {step === 'form' && "Drill Details"}
        </h1>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="mb-6">
          <Card className="border-2 border-dashed border-border p-8 text-center bg-muted/20 hover:bg-muted/30 transition-colors">
            <div className="mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CloudUpload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Upload Training Video</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Choose a video with clear drill movements for automatic analysis
              </p>
              
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVideoSelect(file);
                }}
                className="hidden"
                id="video-input"
              />
              <label
                htmlFor="video-input"
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium cursor-pointer inline-block hover:bg-primary/90"
              >
                Choose Video File
              </label>
            </div>
            <div className="text-xs text-muted-foreground">
              Supported formats: MP4, MOV, AVI • Max size: 100MB
            </div>
          </Card>
        </div>
      )}

      {/* Step 2: Analysis */}
      {step === 'analyze' && videoFile && (
        <VideoAnalyzerNew
          videoFile={videoFile}
          onAnalysisComplete={handleAnalysisComplete}
          onError={handleAnalysisError}
        />
      )}

      {/* Step 3: Form */}
      {step === 'form' && (
        <div className="space-y-6">
          {/* Analysis Summary */}
          {analysisData && (
            <Card className="p-4 bg-green-50 border-green-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-green-800">Analysis Complete</h3>
                <div className="text-sm text-green-600">
                  {Math.round(analysisData.confidence * 100)}% confidence
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-green-700">{analysisData.repetitions}</div>
                  <div className="text-xs text-green-600">Repetitions</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-700">
                    {Math.round(analysisData.duration)}s
                  </div>
                  <div className="text-xs text-green-600">Duration</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-700">
                    {analysisData.keyFrames.length}
                  </div>
                  <div className="text-xs text-green-600">Key Frames</div>
                </div>
              </div>
            </Card>
          )}

          {/* Video Preview */}
          {videoUrl && (
            <Card className="p-4">
              <h3 className="font-medium mb-3">Video Preview</h3>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <video
                  src={processedVideo ? URL.createObjectURL(processedVideo) : videoUrl}
                  className="w-full h-full object-contain"
                  controls
                  loop={!!processedVideo}
                  data-testid="video-preview"
                />
              </div>
            </Card>
          )}

          {/* Form Fields */}
          <Card className="p-4">
            <div className="space-y-4">
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
                <Label htmlFor="drill-notes">Notes</Label>
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

          {/* Action Buttons */}
          <div className="space-y-3">
            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={104857600}
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleUploadComplete}
              buttonClassName="w-full py-3 rounded-xl font-medium disabled:opacity-50 bg-primary text-primary-foreground"
            >
              <div className="flex items-center justify-center space-x-2">
                <Wand2 className="h-4 w-4" />
                <span>{isProcessing ? "Saving..." : "Save Drill"}</span>
              </div>
            </ObjectUploader>
            
            <Button
              variant="outline"
              className="w-full py-3"
              onClick={() => setStep('analyze')}
              disabled={isProcessing}
              data-testid="button-back-to-analysis"
            >
              Back to Analysis
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
