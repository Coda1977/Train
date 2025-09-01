// Creates actual video loops by extracting and combining frames
// Uses Canvas API and MediaRecorder for real video processing

export class VideoLoopCreator {
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
    console.log(`Creating loop from ${startTime}s to ${endTime}s`);
    
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = async () => {
        // Set canvas to video dimensions
        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;
        
        try {
          // Create the loop
          const loopBlob = await this.extractAndLoop(video, startTime, endTime, onProgress);
          
          // Clean up
          URL.revokeObjectURL(video.src);
          video.remove();
          
          resolve(loopBlob);
          
        } catch (error) {
          console.error('Loop creation error:', error);
          reject(error);
        }
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
    });
  }

  private async extractAndLoop(
    video: HTMLVideoElement,
    startTime: number,
    endTime: number,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const fps = 10; // Reduced frame rate for more reliable seeking
    const duration = endTime - startTime;
    const totalFrames = Math.ceil(duration * fps);
    
    // Validate bounds
    if (startTime < 0 || endTime > video.duration || duration <= 0) {
      throw new Error(`Invalid loop bounds: ${startTime}s to ${endTime}s (video duration: ${video.duration}s)`);
    }
    
    // Check if MediaRecorder is available and supports webm
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    
    // Create a MediaRecorder to capture canvas
    const stream = this.canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    });
    
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    
    return new Promise((resolve, reject) => {
      // Add overall timeout for loop creation
      const overallTimeout = setTimeout(() => {
        recorder.stop();
        reject(new Error('Loop creation timed out after 30 seconds'));
      }, 30000);
      
      recorder.onstop = () => {
        clearTimeout(overallTimeout);
        const blob = new Blob(chunks, { type: mimeType });
        console.log(`Created loop video: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
        resolve(blob);
      };
      
      recorder.onerror = (error) => {
        clearTimeout(overallTimeout);
        reject(error);
      };
      
      recorder.start();
      
      // Play the loop 3 times for seamless looping
      let frameCount = 0;
      const totalLoopFrames = totalFrames * 3;
      
      const captureFrame = async () => {
        try {
          if (frameCount >= totalLoopFrames) {
            recorder.stop();
            return;
          }
          
          // Calculate time within the loop
          const loopFrame = frameCount % totalFrames;
          const currentTime = startTime + (loopFrame / fps);
          
          // Validate time is within bounds
          if (currentTime < 0 || currentTime > video.duration) {
            console.warn(`Skipping out-of-bounds frame at ${currentTime}s`);
            frameCount++;
            setTimeout(captureFrame, 1000 / fps);
            return;
          }
          
          // Seek and draw frame
          video.currentTime = currentTime;
          
          await new Promise<void>((resolve, reject) => {
            let seekTimeout: NodeJS.Timeout;
            
            const onSeeked = () => {
              clearTimeout(seekTimeout);
              video.removeEventListener('seeked', onSeeked);
              
              // Draw frame to canvas
              this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
              
              resolve();
            };
            
            video.addEventListener('seeked', onSeeked);
            
            // Longer timeout for seeking
            seekTimeout = setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              // Draw current frame anyway
              this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
              resolve();
            }, 200);
          });
          
          frameCount++;
          
          // Progress callback
          if (onProgress) {
            onProgress((frameCount / totalLoopFrames) * 100);
          }
          
          // Continue to next frame
          setTimeout(captureFrame, 1000 / fps);
          
        } catch (error) {
          console.error('Frame capture error:', error);
          // Try to continue with next frame
          frameCount++;
          if (frameCount < totalLoopFrames) {
            setTimeout(captureFrame, 1000 / fps);
          } else {
            recorder.stop();
          }
        }
      };
      
      // Start capturing
      captureFrame();
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