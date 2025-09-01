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
    const frameRate = 10; // Extract 10 frames per second for better detail
    const totalFrames = Math.min(Math.ceil(video.duration * frameRate), 300); // Max 300 frames
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
    const allRepetitions: number[][] = [];
    
    // Try different window sizes to catch different drill speeds
    const windowSizes = [
      Math.floor(this.frames.length / 15), // Short reps
      Math.floor(this.frames.length / 10), // Medium reps
      Math.floor(this.frames.length / 5),  // Long reps
    ].filter(w => w >= 5); // Minimum 5 frames
    
    console.log(`Trying window sizes: ${windowSizes}`);
    
    for (const windowSize of windowSizes) {
      const threshold = 0.75; // Slightly lower threshold for better detection
      const motionThreshold = 0.05; // Minimum motion to be considered active
      
      // Find all potential cycle starts (high motion after low motion)
      const cycleStarts: number[] = [];
      for (let i = 1; i < this.frames.length - 1; i++) {
        const prevMotion = this.frames[i - 1].motion;
        const currMotion = this.frames[i].motion;
        const nextMotion = this.frames[i + 1].motion;
        
        // Detect motion increase (potential rep start)
        if (prevMotion < motionThreshold && currMotion > motionThreshold && nextMotion > currMotion) {
          cycleStarts.push(i);
        }
      }
      
      console.log(`Found ${cycleStarts.length} potential cycle starts`);
      
      // Compare each cycle start with others
      for (let i = 0; i < cycleStarts.length - 1; i++) {
        const start1 = cycleStarts[i];
        const end1 = Math.min(start1 + windowSize, this.frames.length);
        const pattern1 = this.frames.slice(start1, end1).map(f => f.hash);
        
        for (let j = i + 1; j < cycleStarts.length; j++) {
          const start2 = cycleStarts[j];
          const end2 = Math.min(start2 + windowSize, this.frames.length);
          const pattern2 = this.frames.slice(start2, end2).map(f => f.hash);
          
          const similarity = this.comparePatterns(pattern1, pattern2);
          
          if (similarity > threshold) {
            allRepetitions.push([start1, start2]);
            console.log(`Rep ${i+1} to ${j+1}: frames ${start1}-${end1} similar to ${start2}-${end2} (${Math.round(similarity * 100)}% match)`);
          }
        }
      }
    }
    
    // Deduplicate and sort by confidence
    const uniqueReps = this.deduplicateRepetitions(allRepetitions);
    console.log(`Found ${uniqueReps.length} unique repetitions`);
    
    return uniqueReps;
  }
  
  private deduplicateRepetitions(reps: number[][]): number[][] {
    const unique: number[][] = [];
    
    for (const rep of reps) {
      const isDuplicate = unique.some(u => 
        Math.abs(u[0] - rep[0]) < 5 && Math.abs(u[1] - rep[1]) < 5
      );
      
      if (!isDuplicate) {
        unique.push(rep);
      }
    }
    
    return unique;
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
    
    // Find the most consistent repetition pattern
    let bestStart = repetitions[0][0];
    let bestEnd = repetitions[0][1];
    let bestScore = 0;
    
    for (const [start1, start2] of repetitions) {
      // Calculate the duration of this repetition
      const duration = start2 - start1;
      
      // Count how many similar durations we have
      let consistencyScore = 0;
      for (const [s1, s2] of repetitions) {
        const d = s2 - s1;
        if (Math.abs(d - duration) < 5) { // Similar duration
          consistencyScore++;
        }
      }
      
      // Also factor in motion quality
      const avgMotion = this.frames.slice(start1, start2)
        .reduce((sum, f) => sum + f.motion, 0) / duration;
      
      const score = consistencyScore * avgMotion;
      
      if (score > bestScore) {
        bestScore = score;
        bestStart = start1;
        bestEnd = start2;
      }
    }
    
    console.log(`Best loop: frames ${bestStart} to ${bestEnd}`);
    return { loopStart: bestStart, loopEnd: bestEnd };
  }

  private calculateConfidence(repetitions: number[][]): number {
    if (repetitions.length === 0) return 0.3; // Low confidence if no reps found
    if (repetitions.length === 1) return 0.6; // Medium for single rep
    if (repetitions.length >= 3) return 0.9; // High for multiple reps
    return 0.75; // Good for 2 reps
  }
}