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
    const fps = 30; // Target frame rate
    const duration = endTime - startTime;
    const totalFrames = Math.ceil(duration * fps);
    
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
    
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        console.log(`Created loop video: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
        resolve(blob);
      };
      
      recorder.start();
      
      // Play the loop 3 times for seamless looping
      let frameCount = 0;
      const totalLoopFrames = totalFrames * 3;
      
      const captureFrame = async () => {
        if (frameCount >= totalLoopFrames) {
          recorder.stop();
          return;
        }
        
        // Calculate time within the loop
        const loopFrame = frameCount % totalFrames;
        const currentTime = startTime + (loopFrame / fps);
        
        // Seek and draw frame
        video.currentTime = currentTime;
        
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            
            // Draw frame to canvas
            this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
            
            resolve();
          };
          
          video.addEventListener('seeked', onSeeked);
          
          // Fallback
          setTimeout(() => resolve(), 50);
        });
        
        frameCount++;
        
        // Progress callback
        if (onProgress) {
          onProgress((frameCount / totalLoopFrames) * 100);
        }
        
        // Continue to next frame
        setTimeout(captureFrame, 1000 / fps);
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