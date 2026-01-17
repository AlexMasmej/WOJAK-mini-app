import { ImageStylizerInput, ImageStylizerOutput } from '@/types';
import { BaseImageStylizer } from './base';
import sharp from 'sharp';

interface GeminiConfig {
  apiKey: string;
}

export class GeminiImagenStylizer extends BaseImageStylizer {
  private config: GeminiConfig;

  constructor(config?: Partial<GeminiConfig>) {
    super();
    this.config = {
      apiKey: config?.apiKey || process.env.GOOGLE_API_KEY || '',
    };

    if (!this.config.apiKey) {
      throw new Error('GOOGLE_API_KEY must be set');
    }
  }

  async stylize(input: ImageStylizerInput): Promise<ImageStylizerOutput> {
    const prompt = this.buildWojakPrompt(input.settings);

    // Prepare the image - convert to PNG and resize if needed
    let processedImage = sharp(input.imageBuffer);
    const metadata = await processedImage.metadata();

    // Resize to max 1024px on long edge for processing
    const maxDimension = 1024;
    if (metadata.width && metadata.height) {
      const scale = Math.min(maxDimension / Math.max(metadata.width, metadata.height), 1);
      if (scale < 1) {
        processedImage = processedImage.resize(
          Math.round(metadata.width * scale),
          Math.round(metadata.height * scale),
          { fit: 'inside' }
        );
      }
    }

    // Convert to PNG for the API
    const pngBuffer = await processedImage.png().toBuffer();
    const imageBase64 = pngBuffer.toString('base64');

    // Call Gemini API (Google AI Studio)
    const result = await this.callGeminiAPI(imageBase64, prompt);

    // Convert result to WebP at 1024px
    const outputBuffer = await this.processOutput(result, metadata.width, metadata.height);

    return {
      imageBuffer: outputBuffer,
      mimeType: 'image/webp',
    };
  }

  private async callGeminiAPI(imageBase64: string, prompt: string): Promise<Buffer> {
    // Use Gemini 2.0 Flash Experimental with image generation (Google AI Studio API)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.config.apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: imageBase64,
              },
            },
            {
              text: `Transform this photo into a Wojak meme style illustration.

${prompt}

Generate a new image that transforms the input photo into Wojak meme art style.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 1,
      },
    };

    console.log('Calling Gemini API...');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Gemini API error response:', responseText);
      throw new Error(`Gemini API error: ${response.status} - ${responseText.substring(0, 200)}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse response:', responseText.substring(0, 500));
      throw new Error('Invalid response from Gemini API');
    }

    console.log('Gemini response structure:', JSON.stringify(Object.keys(data)));

    // Extract image from response
    const candidates = data.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          console.log('Found image in response');
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
      // Log what parts we got
      console.log('Parts received:', candidates[0].content.parts.map((p: Record<string, unknown>) => Object.keys(p)));
    }

    // Check for blocked content or other issues
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Content blocked: ${data.promptFeedback.blockReason}`);
    }

    throw new Error('No image generated from Gemini API - model may not support image output');
  }

  private async processOutput(
    imageBuffer: Buffer,
    originalWidth?: number,
    originalHeight?: number
  ): Promise<Buffer> {
    let output = sharp(imageBuffer);

    // Calculate output dimensions (1024px on long edge, preserve aspect ratio)
    const metadata = await output.metadata();
    const currentWidth = metadata.width || originalWidth || 1024;
    const currentHeight = metadata.height || originalHeight || 1024;

    const maxDimension = 1024;
    const scale = maxDimension / Math.max(currentWidth, currentHeight);

    const newWidth = Math.round(currentWidth * scale);
    const newHeight = Math.round(currentHeight * scale);

    return output
      .resize(newWidth, newHeight, { fit: 'inside' })
      .webp({ quality: 85 })
      .toBuffer();
  }
}
