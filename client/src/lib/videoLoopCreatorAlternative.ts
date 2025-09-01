// Alternative video loop creator using a simpler, more reliable approach
// Uses video playback recording instead of frame-by-frame extraction

export class VideoLoopCreatorAlternative {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  async createLoop(
    videoFile: File, 
    startTime: number, 
    endTime: number,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    console.log('🎬 USING ALTERNATIVE VIDEO LOOP CREATOR (Playback Recording)');
    console.log(`Creating loop using playback recording from ${startTime}s to ${endTime}s`);
    
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = async () => {
        // Set canvas to video dimensions
        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;
        
        try {
          // Use the simpler playback approach
          const loopBlob = await this.recordVideoPlayback(video, startTime, endTime, onProgress);
          
          // Clean up
          URL.revokeObjectURL(video.src);
          video.remove();
          
          resolve(loopBlob);
          
        } catch (error) {
          console.error('Loop creation error:', error);
          URL.revokeObjectURL(video.src);
          video.remove();
          reject(error);
        }
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      // Important: Add video to DOM (hidden) for better compatibility
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      document.body.appendChild(video);
    });
  }

  private async recordVideoPlayback(
    video: HTMLVideoElement,
    startTime: number,
    endTime: number,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const duration = endTime - startTime;
    
    // Validate bounds
    if (startTime < 0 || endTime > video.duration || duration <= 0) {
      throw new Error(`Invalid loop bounds: ${startTime}s to ${endTime}s (video duration: ${video.duration}s)`);
    }
    
    // Setup MediaRecorder with canvas stream
    const fps = 30;
    const stream = this.canvas.captureStream(fps);
    
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';
    
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2500000
    });
    
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    
    return new Promise((resolve, reject) => {
      let animationId: number;
      let recordingStartTime: number;
      const loopCount = 3; // Number of times to loop
      const totalDuration = duration * loopCount * 1000; // in ms
      
      recorder.onstop = () => {
        cancelAnimationFrame(animationId);
        const blob = new Blob(chunks, { type: mimeType });
        console.log(`Created loop video: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
        resolve(blob);
      };
      
      recorder.onerror = (error) => {
        cancelAnimationFrame(animationId);
        reject(error);
      };
      
      // Seek to start position first
      video.currentTime = startTime;
      
      video.onseeked = () => {
        // Start recording
        recorder.start();
        recordingStartTime = performance.now();
        
        // Use requestAnimationFrame for smooth rendering
        const render = () => {
          const elapsed = performance.now() - recordingStartTime;
          
          if (elapsed >= totalDuration) {
            // Stop recording
            recorder.stop();
            video.pause();
            return;
          }
          
          // Calculate which frame of the loop we're in
          const loopProgress = (elapsed % (duration * 1000)) / 1000;
          const currentVideoTime = startTime + loopProgress;
          
          // Update video position if needed (for looping)
          if (Math.abs(video.currentTime - currentVideoTime) > 0.1) {
            video.currentTime = currentVideoTime;
          }
          
          // Draw current frame to canvas
          this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
          
          // Update progress
          if (onProgress) {
            onProgress((elapsed / totalDuration) * 100);
          }
          
          // Continue rendering
          animationId = requestAnimationFrame(render);
        };
        
        // Start playback and rendering
        video.play().then(() => {
          render();
        }).catch((error) => {
          console.error('Playback failed:', error);
          // Fallback to manual frame stepping
          render();
        });
      };
      
      // Add timeout protection
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          video.pause();
          reject(new Error('Recording timeout after 60 seconds'));
        }
      }, 60000);
    });
  }

  async createThumbnail(videoFile: File, time: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = async () => {
        // Set canvas size for thumbnail
        const aspectRatio = video.videoWidth / video.videoHeight;
        this.canvas.width = 320;
        this.canvas.height = Math.floor(320 / aspectRatio);
        
        // Seek to time
        video.currentTime = time;
        
        video.onseeked = () => {
          // Draw frame
          this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
          
          // Convert to blob
          this.canvas.toBlob((blob) => {
            if (blob) {
              URL.revokeObjectURL(video.src);
              video.remove();
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail'));
            }
          }, 'image/jpeg', 0.8);
        };
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
    });
  }
}