// Real video analyzer using Canvas API and frame comparison
// No external dependencies - just pure JavaScript video processing

export interface DrillAnalysis {
  duration: number;
  repetitions: number;
  keyFrames: number[];
  loopStart: number;
  loopEnd: number;
  confidence: number;
  poses: any[];
}

interface FrameData {
  time: number;
  hash: string;
  motion: number;
  pixels: Uint8ClampedArray;
}

export class RealVideoAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frames: FrameData[] = [];
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  async analyzeVideo(videoFile: File): Promise<DrillAnalysis> {
    console.log('🚀🚀🚀 CANVAS-BASED ANALYZER (NO MEDIAPIPE!) 🚀🚀🚀');
    console.log('Starting REAL video analysis...');
    
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = async () => {
        console.log(`Video loaded: ${video.duration}s, ${video.videoWidth}x${video.videoHeight}`);
        
        // Set canvas size (reduce for performance)
        this.canvas.width = Math.min(video.videoWidth, 320);
        this.canvas.height = Math.min(video.videoHeight, 240);
        
        try {
          // Extract frames
          await this.extractFrames(video);
          
          // Analyze the frames
          const analysis = this.analyzeFrames(video.duration);
          
          // Clean up
          URL.revokeObjectURL(video.src);
          video.remove();
          
          console.log('Analysis complete:', analysis);
          resolve(analysis);
          
        } catch (error) {
          console.error('Analysis error:', error);
          reject(error);
        }
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
    });
  }

  private async extractFrames(video: HTMLVideoElement): Promise<void> {
    const frameRate = 5; // Extract 5 frames per second
    const totalFrames = Math.min(Math.ceil(video.duration * frameRate), 150); // Max 150 frames
    const interval = video.duration / totalFrames;
    
    console.log(`Extracting ${totalFrames} frames...`);
    
    for (let i = 0; i < totalFrames; i++) {
      const time = i * interval;
      
      // Seek to frame time
      await this.seekToTime(video, time);
      
      // Draw frame to canvas
      this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
      
      // Get frame data
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      // Calculate frame hash for similarity comparison
      const hash = this.calculateFrameHash(imageData);
      
      // Calculate motion from previous frame
      const motion = i > 0 ? this.calculateMotion(this.frames[i - 1].pixels, imageData.data) : 0;
      
      this.frames.push({
        time,
        hash,
        motion,
        pixels: imageData.data
      });
      
      // Progress update
      if (i % 10 === 0) {
        console.log(`Extracted ${i}/${totalFrames} frames`);
      }
    }
    
    console.log(`Extracted ${this.frames.length} frames`);
  }

  private seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
    return new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
      
      // Fallback in case seeked doesn't fire
      setTimeout(resolve, 100);
    });
  }

  private calculateFrameHash(imageData: ImageData): string {
    // Simple perceptual hash - divide image into blocks and get average color
    const blockSize = 8;
    const blocksX = Math.floor(imageData.width / blockSize);
    const blocksY = Math.floor(imageData.height / blockSize);
    let hash = '';
    
    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        let sum = 0;
        let count = 0;
        
        // Average brightness in this block
        for (let y = by * blockSize; y < (by + 1) * blockSize && y < imageData.height; y++) {
          for (let x = bx * blockSize; x < (bx + 1) * blockSize && x < imageData.width; x++) {
            const idx = (y * imageData.width + x) * 4;
            // Get grayscale value
            sum += (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
            count++;
          }
        }
        
        // Quantize to 0 or 1 based on average
        hash += (sum / count) > 128 ? '1' : '0';
      }
    }
    
    return hash;
  }

  private calculateMotion(pixels1: Uint8ClampedArray, pixels2: Uint8ClampedArray): number {
    let totalDiff = 0;
    const sampleRate = 16; // Sample every 16th pixel for speed
    let samples = 0;
    
    for (let i = 0; i < pixels1.length; i += sampleRate * 4) {
      const r1 = pixels1[i];
      const g1 = pixels1[i + 1];
      const b1 = pixels1[i + 2];
      
      const r2 = pixels2[i];
      const g2 = pixels2[i + 1];
      const b2 = pixels2[i + 2];
      
      const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
      totalDiff += diff;
      samples++;
    }
    
    return samples > 0 ? (totalDiff / samples / 765) : 0; // Normalize to 0-1
  }

  private analyzeFrames(duration: number): DrillAnalysis {
    if (this.frames.length === 0) {
      return {
        duration: 0,
        repetitions: 0,
        keyFrames: [],
        loopStart: 0,
        loopEnd: 0,
        confidence: 0,
        poses: []
      };
    }

    // Find repetitive patterns
    const repetitions = this.findRepetitions();
    
    // Find key frames (high motion points)
    const keyFrames = this.findKeyFrames();
    
    // Determine best loop section
    const { loopStart, loopEnd } = this.findBestLoop(repetitions);
    
    // Calculate confidence based on pattern consistency
    const confidence = this.calculateConfidence(repetitions);

    // Convert frame indices to seconds
    // frames were extracted at specific times, use actual frame times
    const loopStartTime = this.frames[Math.min(loopStart, this.frames.length - 1)]?.time || 0;
    const loopEndTime = this.frames[Math.min(loopEnd, this.frames.length - 1)]?.time || duration;
    
    return {
      duration,
      repetitions: repetitions.length,
      keyFrames,
      loopStart: loopStartTime,
      loopEnd: loopEndTime,
      confidence,
      poses: [] // We don't have pose data, but that's ok
    };
  }

  private findRepetitions(): number[][] {
    const repetitions: number[][] = [];
    const windowSize = Math.max(10, Math.floor(this.frames.length / 10)); // Adaptive window
    const threshold = 0.8; // 80% similarity threshold
    
    console.log(`Looking for repetitions with window size ${windowSize}...`);
    
    for (let i = 0; i < this.frames.length - windowSize * 2; i += 5) {
      // Get hash pattern for this window
      const pattern1 = this.frames.slice(i, i + windowSize).map(f => f.hash);
      
      // Look for similar patterns later in video
      for (let j = i + windowSize; j < this.frames.length - windowSize; j += 5) {
        const pattern2 = this.frames.slice(j, j + windowSize).map(f => f.hash);
        
        const similarity = this.comparePatterns(pattern1, pattern2);
        
        if (similarity > threshold) {
          repetitions.push([i, j]);
          console.log(`Found repetition: frames ${i}-${i + windowSize} similar to ${j}-${j + windowSize} (${Math.round(similarity * 100)}% match)`);
          i = j - 5; // Skip ahead to avoid overlaps
          break;
        }
      }
    }
    
    console.log(`Found ${repetitions.length} repetitions`);
    return repetitions;
  }

  private comparePatterns(pattern1: string[], pattern2: string[]): number {
    if (pattern1.length !== pattern2.length) return 0;
    
    let matches = 0;
    
    for (let i = 0; i < pattern1.length; i++) {
      // Compare frame hashes
      const hash1 = pattern1[i];
      const hash2 = pattern2[i];
      
      // Calculate Hamming distance
      let distance = 0;
      for (let j = 0; j < hash1.length; j++) {
        if (hash1[j] !== hash2[j]) distance++;
      }
      
      // Convert distance to similarity (0-1)
      const frameSimilarity = 1 - (distance / hash1.length);
      if (frameSimilarity > 0.7) matches++;
    }
    
    return matches / pattern1.length;
  }

  private findKeyFrames(): number[] {
    const keyFrames: number[] = [];
    const motionValues = this.frames.map(f => f.motion);
    
    // Calculate motion threshold (75th percentile)
    const sortedMotion = [...motionValues].sort((a, b) => a - b);
    const threshold = sortedMotion[Math.floor(sortedMotion.length * 0.75)];
    
    // Find peaks in motion
    for (let i = 1; i < this.frames.length - 1; i++) {
      const prev = motionValues[i - 1];
      const curr = motionValues[i];
      const next = motionValues[i + 1];
      
      // Peak detection
      if (curr > threshold && curr > prev && curr > next) {
        keyFrames.push(i);
      }
    }
    
    console.log(`Found ${keyFrames.length} key frames`);
    return keyFrames;
  }

  private findBestLoop(repetitions: number[][]): { loopStart: number; loopEnd: number } {
    if (repetitions.length === 0) {
      // No repetitions found - use middle section
      const start = Math.floor(this.frames.length * 0.2);
      const end = Math.floor(this.frames.length * 0.8);
      return { loopStart: start, loopEnd: end };
    }
    
    // Use the first good repetition
    const [start, end] = repetitions[0];
    return { 
      loopStart: start, 
      loopEnd: Math.min(end, start + Math.floor(this.frames.length / 3)) // Limit loop length
    };
  }

  private calculateConfidence(repetitions: number[][]): number {
    if (repetitions.length === 0) return 0.3; // Low confidence if no reps found
    if (repetitions.length === 1) return 0.6; // Medium for single rep
    if (repetitions.length >= 3) return 0.9; // High for multiple reps
    return 0.75; // Good for 2 reps
  }
}