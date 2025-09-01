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

  async initialize(): Promise<void> {
    this.pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.pose.onResults((results: Results) => {
      this.onResults(results);
    });
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
    this.poses = [];
    
    if (!this.pose) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      
      this.video = video;
      this.canvas = canvas;

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        this.processVideo(video, canvas, resolve, reject);
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(videoFile);
    });
  }

  private async processVideo(
    video: HTMLVideoElement, 
    canvas: HTMLCanvasElement,
    resolve: (analysis: DrillAnalysis) => void,
    reject: (error: Error) => void
  ): Promise<void> {
    const ctx = canvas.getContext('2d')!;
    const frameRate = 10; // Process 10 frames per second
    const interval = 1000 / frameRate;

    video.currentTime = 0;
    
    const processFrame = async () => {
      if (video.currentTime >= video.duration) {
        // Analysis complete
        const analysis = this.analyzePoses();
        resolve(analysis);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      if (this.pose) {
        await this.pose.send({ image: canvas });
      }

      video.currentTime += interval / 1000;
      
      // Wait a bit to avoid overwhelming the browser
      setTimeout(processFrame, 50);
    };

    processFrame();
  }

  private analyzePoses(): DrillAnalysis {
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

    return {
      duration,
      repetitions: repetitions.length,
      keyFrames,
      loopStart,
      loopEnd,
      confidence: this.calculateConfidence(),
      poses: this.poses
    };
  }

  private detectRepetitions(): number[][] {
    if (this.poses.length < 10) return [];

    const sequences: number[][] = [];
    const windowSize = 30; // frames
    const threshold = 0.15; // similarity threshold

    for (let i = 0; i < this.poses.length - windowSize * 2; i += 5) {
      const sequence1 = this.poses.slice(i, i + windowSize);
      
      for (let j = i + windowSize; j < this.poses.length - windowSize; j += 5) {
        const sequence2 = this.poses.slice(j, j + windowSize);
        const similarity = this.calculateSequenceSimilarity(sequence1, sequence2);
        
        if (similarity > threshold) {
          sequences.push([i, j]);
          i = j; // Skip ahead to avoid overlapping
          break;
        }
      }
    }

    return sequences;
  }

  private calculateSequenceSimilarity(seq1: PoseData[], seq2: PoseData[]): number {
    if (seq1.length !== seq2.length) return 0;

    let totalSimilarity = 0;
    const keyJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]; // Key body joints

    for (let i = 0; i < seq1.length; i++) {
      let frameSimilarity = 0;
      
      for (const jointIndex of keyJoints) {
        if (seq1[i].landmarks[jointIndex] && seq2[i].landmarks[jointIndex]) {
          const joint1 = seq1[i].landmarks[jointIndex];
          const joint2 = seq2[i].landmarks[jointIndex];
          
          const distance = Math.sqrt(
            Math.pow(joint1.x - joint2.x, 2) + 
            Math.pow(joint1.y - joint2.y, 2)
          );
          
          frameSimilarity += Math.max(0, 1 - distance * 5);
        }
      }
      
      totalSimilarity += frameSimilarity / keyJoints.length;
    }

    return totalSimilarity / seq1.length;
  }

  private findKeyFrames(): number[] {
    const keyFrames: number[] = [];
    const motionThreshold = 0.05;

    for (let i = 1; i < this.poses.length - 1; i++) {
      const prevPose = this.poses[i - 1];
      const currentPose = this.poses[i];
      const nextPose = this.poses[i + 1];

      // Calculate motion between frames
      const motionBefore = this.calculateMotion(prevPose, currentPose);
      const motionAfter = this.calculateMotion(currentPose, nextPose);

      // Find peaks (high motion) and valleys (low motion)
      if (motionBefore > motionThreshold && motionAfter < motionBefore * 0.5) {
        keyFrames.push(i);
      }
    }

    return keyFrames;
  }

  private calculateMotion(pose1: PoseData, pose2: PoseData): number {
    const keyJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    let totalMotion = 0;

    for (const jointIndex of keyJoints) {
      if (pose1.landmarks[jointIndex] && pose2.landmarks[jointIndex]) {
        const joint1 = pose1.landmarks[jointIndex];
        const joint2 = pose2.landmarks[jointIndex];
        
        const distance = Math.sqrt(
          Math.pow(joint1.x - joint2.x, 2) + 
          Math.pow(joint1.y - joint2.y, 2)
        );
        
        totalMotion += distance;
      }
    }

    return totalMotion / keyJoints.length;
  }

  private findBestLoop(repetitions: number[][]): { loopStart: number; loopEnd: number } {
    if (repetitions.length === 0) {
      return { loopStart: 0, loopEnd: this.poses.length - 1 };
    }

    // Find the most consistent repetition pattern
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

    // Calculate average visibility of key joints
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

    return validFrames > 0 ? totalVisibility / validFrames : 0;
  }
}