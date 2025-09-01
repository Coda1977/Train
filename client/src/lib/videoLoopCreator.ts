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
    const fps = 30; // Use standard frame rate for smoother output
    const duration = endTime - startTime;
    const frameInterval = 1000 / fps; // milliseconds between frames
    
    // Validate bounds
    if (startTime < 0 || endTime > video.duration || duration <= 0) {
      throw new Error(`Invalid loop bounds: ${startTime}s to ${endTime}s (video duration: ${video.duration}s)`);
    }
    
    // Check if MediaRecorder is available and supports webm
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    
    // FIXED: Use requestAnimationFrame-based approach for consistent frame delivery
    // Create a MediaRecorder to capture canvas at 0 fps (manual frame control)
    const stream = this.canvas.captureStream(0); // 0 = manual frame control
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
      
      // FIXED: First collect all frames, then encode them
      const collectFrames = async () => {
        const frames: ImageData[] = [];
        const frameTimes: number[] = [];
        const totalFrames = Math.ceil(duration * fps);
        
        console.log(`Collecting ${totalFrames} frames from ${startTime}s to ${endTime}s`);
        
        // Collect frames sequentially with proper seeking
        for (let i = 0; i < totalFrames; i++) {
          const frameTime = startTime + (i / fps);
          
          // Seek to frame time and wait for seek to complete
          await new Promise<void>((seekResolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onError);
              
              // Draw frame to canvas
              this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
              
              // Store frame data
              const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
              frames.push(imageData);
              frameTimes.push(frameTime);
              
              seekResolve();
            };
            
            const onError = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onError);
              console.warn(`Failed to seek to ${frameTime}s, using current frame`);
              
              // Use current frame as fallback
              this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
              const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
              frames.push(imageData);
              frameTimes.push(frameTime);
              
              seekResolve();
            };
            
            video.addEventListener('seeked', onSeeked);
            video.addEventListener('error', onError);
            video.currentTime = frameTime;
            
            // Fallback timeout
            setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onError);
              
              // Use current frame as fallback
              this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
              const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
              frames.push(imageData);
              frameTimes.push(frameTime);
              
              seekResolve();
            }, 500); // Longer timeout for seeking
          });
          
          // Update progress
          if (onProgress) {
            onProgress((i / totalFrames) * 50); // First 50% for frame collection
          }
        }
        
        console.log(`Collected ${frames.length} frames, now encoding...`);
        
        // Now encode the collected frames at consistent FPS
        recorder.start();
        
        // Play the loop 3 times for seamless looping
        const totalLoopFrames = frames.length * 3;
        let frameIndex = 0;
        let lastFrameTime = performance.now();
        
        const encodeFrame = () => {
          if (frameIndex >= totalLoopFrames) {
            // Ensure recorder stops properly
            recorder.stop();
            return;
          }
          
          // Get the frame to encode (loop through collected frames)
          const frame = frames[frameIndex % frames.length];
          
          // Put frame on canvas
          this.ctx.putImageData(frame, 0, 0);
          
          // CRITICAL: Manually request frame from stream
          const track = stream.getVideoTracks()[0];
          if (track && 'requestFrame' in track) {
            (track as any).requestFrame();
          }
          
          frameIndex++;
          
          // Update progress
          if (onProgress) {
            onProgress(50 + (frameIndex / totalLoopFrames) * 50); // Second 50% for encoding
          }
          
          // Schedule next frame at consistent interval
          const now = performance.now();
          const elapsed = now - lastFrameTime;
          const delay = Math.max(0, frameInterval - elapsed);
          lastFrameTime = now + delay;
          
          setTimeout(encodeFrame, delay);
        };
        
        // Start encoding frames
        encodeFrame();
      };
      
      // Start the frame collection and encoding process
      collectFrames().catch((error) => {
        clearTimeout(overallTimeout);
        reject(error);
      });
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