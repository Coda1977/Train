import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

export interface VideoProcessingOptions {
  startTime: number;
  endTime: number;
  loop: boolean;
  compress: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

export class VideoProcessor {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;

  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    this.ffmpeg = new FFmpeg();
    
    // Load FFmpeg with CDN URLs
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    this.isLoaded = true;
  }

  async processVideo(
    videoFile: File, 
    options: VideoProcessingOptions,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    if (!this.ffmpeg) {
      await this.initialize();
    }

    if (!this.ffmpeg) {
      throw new Error('Failed to initialize FFmpeg');
    }

    // Set up progress monitoring
    if (onProgress) {
      this.ffmpeg.on('progress', ({ progress }) => {
        onProgress(progress * 100);
      });
    }

    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    // Write input file to FFmpeg filesystem
    await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

    // Build FFmpeg command
    const command = this.buildFFmpegCommand(inputFileName, outputFileName, options);
    
    // Execute FFmpeg command
    await this.ffmpeg.exec(command);

    // Read the processed video
    const data = await this.ffmpeg.readFile(outputFileName);
    
    // Clean up
    await this.ffmpeg.deleteFile(inputFileName);
    await this.ffmpeg.deleteFile(outputFileName);

    return new Blob([data], { type: 'video/mp4' });
  }

  private buildFFmpegCommand(
    input: string,
    output: string,
    options: VideoProcessingOptions
  ): string[] {
    const command: string[] = [
      '-i', input,
      '-ss', options.startTime.toString(),
      '-to', options.endTime.toString(),
    ];

    // Video encoding settings
    command.push('-c:v', 'libx264');
    command.push('-preset', 'fast');
    command.push('-crf', options.compress ? '28' : '23');

    // Resolution scaling
    if (options.maxWidth || options.maxHeight) {
      const scale = this.buildScaleFilter(options.maxWidth, options.maxHeight);
      command.push('-vf', scale);
    }

    // Audio handling
    command.push('-c:a', 'aac');
    command.push('-b:a', '128k');

    // Create seamless loop if requested
    if (options.loop) {
      const duration = options.endTime - options.startTime;
      command.push('-stream_loop', '2'); // Repeat 3 times total
      command.push('-t', (duration * 3).toString()); // Total duration
    }

    // Output format settings
    command.push('-movflags', '+faststart'); // Enable web streaming
    command.push('-y'); // Overwrite output file
    command.push(output);

    return command;
  }

  private buildScaleFilter(maxWidth?: number, maxHeight?: number): string {
    if (maxWidth && maxHeight) {
      return `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`;
    } else if (maxWidth) {
      return `scale='min(${maxWidth},iw)':-1`;
    } else if (maxHeight) {
      return `scale=-1:'min(${maxHeight},ih)'`;
    }
    return 'scale=iw:ih'; // No scaling
  }

  async createThumbnail(videoFile: File, timeSeconds: number = 1): Promise<Blob> {
    if (!this.ffmpeg) {
      await this.initialize();
    }

    if (!this.ffmpeg) {
      throw new Error('Failed to initialize FFmpeg');
    }

    const inputFileName = 'input.mp4';
    const outputFileName = 'thumbnail.jpg';

    await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

    await this.ffmpeg.exec([
      '-i', inputFileName,
      '-ss', timeSeconds.toString(),
      '-vframes', '1',
      '-vf', 'scale=320:180',
      '-q:v', '2',
      '-y',
      outputFileName
    ]);

    const data = await this.ffmpeg.readFile(outputFileName);
    
    await this.ffmpeg.deleteFile(inputFileName);
    await this.ffmpeg.deleteFile(outputFileName);

    return new Blob([data], { type: 'image/jpeg' });
  }

  async extractFrames(
    videoFile: File, 
    startTime: number, 
    endTime: number, 
    frameRate: number = 1
  ): Promise<Blob[]> {
    if (!this.ffmpeg) {
      await this.initialize();
    }

    if (!this.ffmpeg) {
      throw new Error('Failed to initialize FFmpeg');
    }

    const inputFileName = 'input.mp4';
    
    await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

    await this.ffmpeg.exec([
      '-i', inputFileName,
      '-ss', startTime.toString(),
      '-to', endTime.toString(),
      '-vf', `fps=${frameRate}`,
      '-q:v', '2',
      'frame_%03d.jpg'
    ]);

    const frames: Blob[] = [];
    let frameIndex = 1;

    try {
      while (true) {
        const frameName = `frame_${frameIndex.toString().padStart(3, '0')}.jpg`;
        const data = await this.ffmpeg.readFile(frameName);
        frames.push(new Blob([data], { type: 'image/jpeg' }));
        await this.ffmpeg.deleteFile(frameName);
        frameIndex++;
      }
    } catch {
      // No more frames
    }

    await this.ffmpeg.deleteFile(inputFileName);
    return frames;
  }

  destroy(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.isLoaded = false;
    }
  }
}