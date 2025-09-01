// Simplified video analyzer that skips MediaPipe entirely for now
// Focus on getting basic functionality working first

export interface DrillAnalysis {
  duration: number;
  repetitions: number;
  keyFrames: number[];
  loopStart: number;
  loopEnd: number;
  confidence: number;
  poses: any[];
}

export class VideoAnalyzerSimplified {
  
  async analyzeVideo(videoFile: File): Promise<DrillAnalysis> {
    console.log('Using simplified analyzer (MediaPipe bypassed for testing)');
    
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = () => {
        console.log(`Video loaded: ${video.duration}s`);
        
        // For now, just return mock data based on video duration
        // This proves the flow works without MediaPipe
        const mockAnalysis: DrillAnalysis = {
          duration: video.duration,
          repetitions: Math.floor(video.duration / 3), // Assume 3 seconds per rep
          keyFrames: [10, 20, 30], // Mock key frames
          loopStart: Math.floor(video.duration * 0.2), // Start at 20%
          loopEnd: Math.floor(video.duration * 0.8),   // End at 80%
          confidence: 0.75,
          poses: []
        };
        
        console.log('Mock analysis result:', mockAnalysis);
        
        // Clean up
        URL.revokeObjectURL(video.src);
        video.remove();
        
        resolve(mockAnalysis);
      };

      video.onerror = (e) => {
        console.error('Video loading error:', e);
        reject(new Error('Failed to load video file'));
      };

      video.src = URL.createObjectURL(videoFile);
    });
  }
}