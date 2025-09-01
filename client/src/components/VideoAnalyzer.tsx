import { useState, useRef, useEffect } from 'react';
import { VideoAnalyzer, type DrillAnalysis } from '@/lib/videoAnalyzer';
import { SimpleVideoAnalyzer } from '@/lib/simpleVideoAnalyzer';
import { VideoProcessor, type VideoProcessingOptions } from '@/lib/videoProcessor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Wand2, Download, Play, Pause, RotateCcw } from 'lucide-react';

interface VideoAnalyzerProps {
  videoFile: File;
  onAnalysisComplete: (analysis: DrillAnalysis, processedVideo?: Blob, thumbnail?: Blob) => void;
  onError: (error: string) => void;
}

export default function VideoAnalyzerComponent({ 
  videoFile, 
  onAnalysisComplete, 
  onError 
}: VideoAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<DrillAnalysis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const analyzerRef = useRef<VideoAnalyzer | null>(null);
  const simpleAnalyzerRef = useRef<SimpleVideoAnalyzer | null>(null);
  const processorRef = useRef<VideoProcessor | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setPreviewUrl(url);
    
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    // Initialize processors
    analyzerRef.current = new VideoAnalyzer();
    simpleAnalyzerRef.current = new SimpleVideoAnalyzer();
    processorRef.current = new VideoProcessor();
    
    return () => {
      processorRef.current?.destroy();
    };
  }, []);

  const handleAnalyze = async () => {
    if (!analyzerRef.current || !simpleAnalyzerRef.current) return;

    setIsAnalyzing(true);
    setProgress(0);

    try {
      console.log('Starting video analysis...');
      
      let result: DrillAnalysis;
      
      try {
        // Try MediaPipe analysis first
        console.log('Attempting MediaPipe analysis...');
        result = await analyzerRef.current.analyzeVideo(videoFile);
        console.log('MediaPipe analysis completed:', result);
        
      } catch (mediaPipeError) {
        console.warn('MediaPipe analysis failed, falling back to simple analysis:', mediaPipeError);
        
        // Fallback to simple analysis
        const simpleResult = await simpleAnalyzerRef.current.analyzeVideo(videoFile);
        
        // Convert simple analysis to DrillAnalysis format
        result = {
          ...simpleResult,
          poses: [] // Simple analyzer doesn't provide pose data
        };
        
        console.log('Simple analysis completed:', result);
      }
      
      setProgress(100);
      setAnalysis(result);
      
      // Auto-process if we found good repetitions
      if (result.repetitions > 0 && result.confidence > 0.4) {
        console.log('Auto-processing video with good analysis results');
        await handleProcessVideo(result);
      } else {
        console.log('Analysis complete but auto-processing skipped - low confidence or no repetitions');
      }

    } catch (error) {
      console.error('All analysis methods failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      onError(`Video analysis failed: ${errorMessage}. Please try with a different video.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleProcessVideo = async (analysisData: DrillAnalysis) => {
    if (!processorRef.current || !analysisData) return;

    setIsProcessing(true);

    try {
      const options: VideoProcessingOptions = {
        startTime: analysisData.loopStart / 10, // Convert frame to seconds (assuming 10 FPS)
        endTime: analysisData.loopEnd / 10,
        loop: true,
        compress: true,
        maxWidth: 720,
        maxHeight: 1280
      };

      const processedVideo = await processorRef.current.processVideo(
        videoFile,
        options,
        (progress) => setProgress(progress)
      );

      // Generate thumbnail
      const thumbnail = await processorRef.current.createThumbnail(
        videoFile,
        (analysisData.loopStart / 10) + 0.5
      );

      // Create preview URL for processed video
      const processedUrl = URL.createObjectURL(processedVideo);
      setProcessedVideoUrl(processedUrl);

      onAnalysisComplete(analysisData, processedVideo, thumbnail);

    } catch (error) {
      console.error('Processing failed:', error);
      onError('Failed to process video. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number): string => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Original Video Preview */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">Original Video</h3>
        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={previewUrl}
            className="w-full h-full object-contain"
            controls
          />
        </div>
      </Card>

      {/* Analysis Controls */}
      {!analysis && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Drill Analysis</h3>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-32"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>
          
          {isAnalyzing && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                Detecting movement patterns and repetitions...
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && (
        <Card className="p-4">
          <h3 className="font-medium mb-4">Analysis Results</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{analysis.repetitions}</div>
              <div className="text-xs text-muted-foreground">Repetitions Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {Math.round(analysis.confidence * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">Confidence</div>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Duration:</span>
              <span>{formatTime(analysis.duration)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Best Loop:</span>
              <span>
                {formatTime(analysis.loopStart / 10)} - {formatTime(analysis.loopEnd / 10)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Key Frames:</span>
              <span>{analysis.keyFrames.length} detected</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Badge variant={analysis.confidence > 0.8 ? "default" : "secondary"}>
              {analysis.confidence > 0.8 ? "High Quality" : "Medium Quality"}
            </Badge>
            <Badge variant="outline">
              {analysis.repetitions} reps
            </Badge>
          </div>
        </Card>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">Creating Loop</h3>
          <Progress value={progress} className="w-full mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            Processing video and creating seamless loop...
          </p>
        </Card>
      )}

      {/* Processed Video Preview */}
      {processedVideoUrl && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Processed Loop</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleProcessVideo(analysis!)}
              disabled={isProcessing}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reprocess
            </Button>
          </div>
          
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            <video
              src={processedVideoUrl}
              className="w-full h-full object-contain"
              controls
              loop
              autoPlay
              muted
            />
          </div>
          
          <div className="mt-3 text-center">
            <Badge className="bg-green-500">
              Ready for Upload
            </Badge>
          </div>
        </Card>
      )}

      {/* Manual Processing Trigger */}
      {analysis && !processedVideoUrl && !isProcessing && (
        <Card className="p-4">
          <Button
            onClick={() => handleProcessVideo(analysis)}
            className="w-full"
            disabled={isProcessing}
          >
            <Download className="h-4 w-4 mr-2" />
            Create Loop from Analysis
          </Button>
        </Card>
      )}
    </div>
  );
}