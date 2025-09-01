// Simple fallback video analyzer that doesn't require MediaPipe
// Uses basic frame analysis and motion detection

export interface SimpleAnalysis {
  duration: number;
  repetitions: number;
  keyFrames: number[];
  loopStart: number;
  loopEnd: number;
  confidence: number;
  method: 'simple' | 'mediapipe';
}

export class SimpleVideoAnalyzer {
  
  async analyzeVideo(videoFile: File): Promise<SimpleAnalysis> {
    console.log('Using simple video analysis (fallback mode)');
    
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      
      video.onloadedmetadata = () => {
        canvas.width = Math.min(video.videoWidth, 320);
        canvas.height = Math.min(video.videoHeight, 240);
        
        video.oncanplaythrough = () => {
          this.processVideoSimple(video, canvas, resolve, reject);
        };
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      video.src = URL.createObjectURL(videoFile);
    });
  }

  private async processVideoSimple(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    resolve: (analysis: SimpleAnalysis) => void,
    reject: (error: Error) => void
  ) {
    const ctx = canvas.getContext('2d')!;
    const frameData: ImageData[] = [];
    const frameRate = 3; // Very low frame rate for simple analysis
    const stepSize = 1 / frameRate;
    let currentTime = 0;
    const maxFrames = Math.min(Math.ceil(video.duration * frameRate), 60);

    const processFrame = async () => {
      if (currentTime >= video.duration || frameData.length >= maxFrames) {
        // Analysis complete
        const analysis = this.analyzeFrames(frameData, video.duration);
        URL.revokeObjectURL(video.src);
        resolve(analysis);
        return;
      }

      video.currentTime = currentTime;
      
      // Wait for seek
      await new Promise<void>((seekResolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          seekResolve();
        };
        video.addEventListener('seeked', onSeeked);
        setTimeout(seekResolve, 200); // Fallback
      });

      // Capture frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      frameData.push(imageData);

      currentTime += stepSize;
      
      // Continue processing
      setTimeout(processFrame, 100);
    };

    processFrame();
  }

  private analyzeFrames(frames: ImageData[], duration: number): SimpleAnalysis {
    if (frames.length === 0) {
      return {
        duration: 0,
        repetitions: 0,
        keyFrames: [],
        loopStart: 0,
        loopEnd: 0,
        confidence: 0,
        method: 'simple'
      };
    }

    // Calculate frame differences to detect motion
    const motionScores = this.calculateMotionScores(frames);
    
    // Find repetitive patterns in motion
    const repetitions = this.findRepetitiveMotion(motionScores);
    
    // Find key frames (high motion changes)
    const keyFrames = this.findKeyMotionFrames(motionScores);
    
    // Determine best loop section
    const { loopStart, loopEnd } = this.findBestLoopSection(motionScores);

    return {
      duration,
      repetitions: repetitions.length,
      keyFrames,
      loopStart,
      loopEnd,
      confidence: Math.min(repetitions.length > 0 ? 0.6 : 0.3, 1),
      method: 'simple'
    };
  }

  private calculateMotionScores(frames: ImageData[]): number[] {
    const scores: number[] = [0]; // First frame has no motion

    for (let i = 1; i < frames.length; i++) {
      const score = this.compareFrames(frames[i - 1], frames[i]);
      scores.push(score);
    }

    return scores;
  }

  private compareFrames(frame1: ImageData, frame2: ImageData): number {
    const data1 = frame1.data;
    const data2 = frame2.data;
    let totalDiff = 0;
    let pixels = 0;

    // Sample every 16th pixel for performance (4x4 skip)
    for (let i = 0; i < data1.length; i += 64) {
      const r1 = data1[i];
      const g1 = data1[i + 1];
      const b1 = data1[i + 2];
      
      const r2 = data2[i];
      const g2 = data2[i + 1];
      const b2 = data2[i + 2];

      const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
      totalDiff += diff;
      pixels++;
    }

    return pixels > 0 ? totalDiff / pixels / 765 : 0; // Normalize to 0-1
  }

  private findRepetitiveMotion(motionScores: number[]): number[][] {
    const repetitions: number[][] = [];
    const windowSize = Math.max(3, Math.floor(motionScores.length / 6));
    const threshold = 0.7; // Motion similarity threshold

    for (let i = 0; i < motionScores.length - windowSize * 2; i++) {
      const pattern1 = motionScores.slice(i, i + windowSize);
      
      for (let j = i + windowSize; j < motionScores.length - windowSize; j++) {
        const pattern2 = motionScores.slice(j, j + windowSize);
        const similarity = this.calculatePatternSimilarity(pattern1, pattern2);
        
        if (similarity > threshold) {
          repetitions.push([i, j]);
          i = j - 1; // Skip to avoid overlaps
          break;
        }
      }
    }

    return repetitions;
  }

  private calculatePatternSimilarity(pattern1: number[], pattern2: number[]): number {
    if (pattern1.length !== pattern2.length) return 0;

    let similarity = 0;
    const maxDiff = Math.max(...pattern1) + Math.max(...pattern2);
    
    if (maxDiff === 0) return 1; // Both patterns are flat

    for (let i = 0; i < pattern1.length; i++) {
      const diff = Math.abs(pattern1[i] - pattern2[i]);
      similarity += 1 - (diff / maxDiff);
    }

    return similarity / pattern1.length;
  }

  private findKeyMotionFrames(motionScores: number[]): number[] {
    const keyFrames: number[] = [];
    const threshold = this.calculateMotionThreshold(motionScores);

    for (let i = 1; i < motionScores.length - 1; i++) {
      const prev = motionScores[i - 1];
      const curr = motionScores[i];
      const next = motionScores[i + 1];

      // Find peaks in motion (high motion followed by lower motion)
      if (curr > threshold && curr > prev && curr > next) {
        keyFrames.push(i);
      }
    }

    return keyFrames;
  }

  private calculateMotionThreshold(motionScores: number[]): number {
    const sorted = [...motionScores].sort((a, b) => a - b);
    const percentile75 = sorted[Math.floor(sorted.length * 0.75)];
    return Math.max(percentile75, 0.1); // At least some minimum threshold
  }

  private findBestLoopSection(motionScores: number[]): { loopStart: number; loopEnd: number } {
    // Find section with most consistent motion patterns
    const sectionSize = Math.floor(motionScores.length / 3);
    let bestStart = 0;
    let bestEnd = Math.min(sectionSize, motionScores.length - 1);
    let bestVariance = Infinity;

    for (let start = 0; start < motionScores.length - sectionSize; start++) {
      const end = Math.min(start + sectionSize, motionScores.length - 1);
      const section = motionScores.slice(start, end);
      const variance = this.calculateVariance(section);
      
      if (variance < bestVariance) {
        bestVariance = variance;
        bestStart = start;
        bestEnd = end;
      }
    }

    return { loopStart: bestStart, loopEnd: bestEnd };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }
}