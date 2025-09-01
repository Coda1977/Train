import { Pose, Results } from '@mediapipe/pose';

export interface DrillAnalysis {
  duration: number;
  repetitions: number;
  keyFrames: number[];
  loopStart: number;
  loopEnd: number;
  confidence: number;
  poses: PoseData[];
}

export interface PoseData {
  timestamp: number;
  landmarks: any[];
  visibility: number[];
}

export class VideoAnalyzer {
  private pose: Pose | null = null;
  private poses: PoseData[] = [];
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.doInitialize();
    await this.initializationPromise;
    this.isInitialized = true;
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log('Initializing MediaPipe Pose...');
      
      this.pose = new Pose({
        locateFile: (file) => {
          const url = `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          console.log('Loading MediaPipe file:', url);
          return url;
        }
      });

      this.pose.setOptions({
        modelComplexity: 1, // Use lighter model for better performance
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.pose.onResults(this.onResults.bind(this));

      // Test that pose detection is working
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MediaPipe initialization timeout'));
        }, 30000); // 30 second timeout

        // Create a test canvas to verify MediaPipe is ready
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 100;
        testCanvas.height = 100;
        const ctx = testCanvas.getContext('2d')!;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 100, 100);

        let resultReceived = false;
        
        const testResultsHandler = (results: Results) => {
          if (!resultReceived) {
            resultReceived = true;
            clearTimeout(timeout);
            // Restore original onResults
            this.pose!.onResults(this.onResults.bind(this));
            console.log('MediaPipe Pose initialized successfully');
            resolve();
          }
        };
        
        this.pose!.onResults(testResultsHandler);

        this.pose!.send({ image: testCanvas }).catch(reject);
      });

    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      throw new Error(`MediaPipe initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private onResults(results: Results): void {
    if (results.poseLandmarks && this.video) {
      const poseData: PoseData = {
        timestamp: this.video.currentTime,
        landmarks: results.poseLandmarks,
        visibility: results.poseLandmarks.map(landmark => landmark.visibility || 1)
      };
      this.poses.push(poseData);
    }
  }

  async analyzeVideo(videoFile: File): Promise<DrillAnalysis> {
    console.log('Starting video analysis for:', videoFile.name);
    this.poses = [];
    
    try {
      await this.initialize();
    } catch (error) {
      console.error('Initialization failed:', error);
      throw error;
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      
      this.video = video;
      this.canvas = canvas;

      // Set up timeout protection
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Video analysis timeout - processing took too long'));
      }, 120000); // 2 minute timeout

      const cleanup = () => {
        clearTimeout(timeout);
        if (video.src) {
          URL.revokeObjectURL(video.src);
        }
        video.remove();
        canvas.remove();
      };

      video.onloadedmetadata = () => {
        console.log(`Video loaded: ${video.duration}s, ${video.videoWidth}x${video.videoHeight}`);
        
        canvas.width = Math.min(video.videoWidth, 640); // Limit size for performance
        canvas.height = Math.min(video.videoHeight, 480);
        
        // Wait for video to be fully loaded
        video.oncanplaythrough = () => {
          console.log('Video ready for processing');
          this.processVideo(video, canvas, resolve, reject, cleanup);
        };
      };

      video.onerror = (e) => {
        console.error('Video error:', e);
        cleanup();
        reject(new Error('Failed to load video file'));
      };

      video.crossOrigin = 'anonymous';
      video.src = URL.createObjectURL(videoFile);
      video.load();
    });
  }

  private async processVideo(
    video: HTMLVideoElement, 
    canvas: HTMLCanvasElement,
    resolve: (analysis: DrillAnalysis) => void,
    reject: (error: Error) => void,
    cleanup: () => void
  ): Promise<void> {
    const ctx = canvas.getContext('2d')!;
    const frameRate = 5; // Reduce to 5 FPS for better performance
    const stepSize = 1 / frameRate; // Step in seconds
    let currentTime = 0;
    let processedFrames = 0;
    const maxFrames = Math.min(Math.ceil(video.duration * frameRate), 300); // Limit to 300 frames max

    console.log(`Processing video: ${video.duration}s, target ${maxFrames} frames`);

    const processFrame = async () => {
      try {
        if (currentTime >= video.duration || processedFrames >= maxFrames) {
          // Analysis complete
          console.log(`Analysis complete: ${processedFrames} frames processed`);
          const analysis = this.analyzePoses();
          cleanup();
          resolve(analysis);
          return;
        }

        // Seek to specific time
        if (Math.abs(video.currentTime - currentTime) > 0.1) {
          video.currentTime = currentTime;
          
          // Wait for seek to complete
          await new Promise<void>((seekResolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              seekResolve();
            };
            video.addEventListener('seeked', onSeeked);
            
            // Fallback timeout
            setTimeout(seekResolve, 500);
          });
        }

        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Send to MediaPipe
        if (this.pose) {
          await this.pose.send({ image: canvas });
        }

        processedFrames++;
        currentTime += stepSize;
        
        // Progress callback could be added here
        const progress = (processedFrames / maxFrames) * 100;
        if (processedFrames % 10 === 0) {
          console.log(`Processing progress: ${progress.toFixed(1)}%`);
        }

        // Schedule next frame with a small delay
        setTimeout(() => processFrame(), 100);

      } catch (error) {
        console.error('Error processing frame:', error);
        cleanup();
        reject(error instanceof Error ? error : new Error('Frame processing failed'));
      }
    };

    // Start processing
    processFrame();
  }

  private analyzePoses(): DrillAnalysis {
    console.log(`Analyzing ${this.poses.length} poses...`);
    
    if (this.poses.length === 0) {
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

    const repetitions = this.detectRepetitions();
    const duration = this.poses[this.poses.length - 1].timestamp;
    const keyFrames = this.findKeyFrames();
    const { loopStart, loopEnd } = this.findBestLoop(repetitions);
    const confidence = this.calculateConfidence();

    console.log(`Analysis results: ${repetitions.length} repetitions, ${confidence.toFixed(2)} confidence`);

    return {
      duration,
      repetitions: repetitions.length,
      keyFrames,
      loopStart,
      loopEnd,
      confidence,
      poses: this.poses
    };
  }

  private detectRepetitions(): number[][] {
    if (this.poses.length < 10) return [];

    const sequences: number[][] = [];
    const windowSize = Math.min(15, Math.floor(this.poses.length / 4)); // Adaptive window size
    const threshold = 0.3; // Lower threshold for easier detection

    for (let i = 0; i < this.poses.length - windowSize * 2; i += 3) {
      const sequence1 = this.poses.slice(i, i + windowSize);
      
      for (let j = i + windowSize; j < this.poses.length - windowSize; j += 3) {
        const sequence2 = this.poses.slice(j, j + windowSize);
        const similarity = this.calculateSequenceSimilarity(sequence1, sequence2);
        
        if (similarity > threshold) {
          sequences.push([i, j]);
          i = j - windowSize; // Allow some overlap
          break;
        }
      }
    }

    return sequences;
  }

  private calculateSequenceSimilarity(seq1: PoseData[], seq2: PoseData[]): number {
    if (seq1.length !== seq2.length || seq1.length === 0) return 0;

    let totalSimilarity = 0;
    // Focus on key body joints for movement detection
    const keyJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]; // Shoulders, arms, hips, legs

    for (let i = 0; i < seq1.length; i++) {
      let frameSimilarity = 0;
      let validJoints = 0;
      
      for (const jointIndex of keyJoints) {
        if (seq1[i].landmarks[jointIndex] && seq2[i].landmarks[jointIndex]) {
          const joint1 = seq1[i].landmarks[jointIndex];
          const joint2 = seq2[i].landmarks[jointIndex];
          
          const distance = Math.sqrt(
            Math.pow(joint1.x - joint2.x, 2) + 
            Math.pow(joint1.y - joint2.y, 2)
          );
          
          frameSimilarity += Math.max(0, 1 - distance * 2); // Less strict distance penalty
          validJoints++;
        }
      }
      
      if (validJoints > 0) {
        totalSimilarity += frameSimilarity / validJoints;
      }
    }

    return totalSimilarity / seq1.length;
  }

  private findKeyFrames(): number[] {
    const keyFrames: number[] = [];
    const motionThreshold = 0.03;

    for (let i = 1; i < this.poses.length - 1; i++) {
      const prevPose = this.poses[i - 1];
      const currentPose = this.poses[i];
      const nextPose = this.poses[i + 1];

      const motionBefore = this.calculateMotion(prevPose, currentPose);
      const motionAfter = this.calculateMotion(currentPose, nextPose);

      // Find peaks and valleys in motion
      if (motionBefore > motionThreshold && motionAfter < motionBefore * 0.6) {
        keyFrames.push(i);
      }
    }

    return keyFrames;
  }

  private calculateMotion(pose1: PoseData, pose2: PoseData): number {
    const keyJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    let totalMotion = 0;
    let validJoints = 0;

    for (const jointIndex of keyJoints) {
      if (pose1.landmarks[jointIndex] && pose2.landmarks[jointIndex]) {
        const joint1 = pose1.landmarks[jointIndex];
        const joint2 = pose2.landmarks[jointIndex];
        
        const distance = Math.sqrt(
          Math.pow(joint1.x - joint2.x, 2) + 
          Math.pow(joint1.y - joint2.y, 2)
        );
        
        totalMotion += distance;
        validJoints++;
      }
    }

    return validJoints > 0 ? totalMotion / validJoints : 0;
  }

  private findBestLoop(repetitions: number[][]): { loopStart: number; loopEnd: number } {
    if (repetitions.length === 0) {
      // Use middle portion of video as fallback
      const start = Math.floor(this.poses.length * 0.3);
      const end = Math.floor(this.poses.length * 0.7);
      return { loopStart: start, loopEnd: end };
    }

    // Find the longest repetition pattern
    const bestRep = repetitions.reduce((best, current) => {
      const currentLength = current[1] - current[0];
      const bestLength = best[1] - best[0];
      return currentLength > bestLength ? current : best;
    });

    return {
      loopStart: bestRep[0],
      loopEnd: bestRep[1]
    };
  }

  private calculateConfidence(): number {
    if (this.poses.length === 0) return 0;

    const keyJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    let totalVisibility = 0;
    let validFrames = 0;

    for (const pose of this.poses) {
      let frameVisibility = 0;
      let visibleJoints = 0;

      for (const jointIndex of keyJoints) {
        if (pose.landmarks[jointIndex]) {
          const visibility = pose.landmarks[jointIndex].visibility || 1;
          frameVisibility += visibility;
          visibleJoints++;
        }
      }

      if (visibleJoints > 0) {
        totalVisibility += frameVisibility / visibleJoints;
        validFrames++;
      }
    }

    return validFrames > 0 ? Math.min(totalVisibility / validFrames, 1) : 0;
  }
}