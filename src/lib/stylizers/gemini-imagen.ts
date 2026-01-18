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

    // Prepare the image - resize and compress to reduce API costs
    let processedImage = sharp(input.imageBuffer);
    const metadata = await processedImage.metadata();

    // Resize to max 768px on long edge - sufficient for Wojak-style output
    const maxDimension = 768;
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

    // Convert to JPEG at 85% quality - 60-80% smaller than PNG, reduces API input costs
    const jpegBuffer = await processedImage.jpeg({ quality: 85 }).toBuffer();
    const imageBase64 = jpegBuffer.toString('base64');

    // Call Gemini API (Google AI Studio)
    const result = await this.callGeminiAPI(imageBase64, prompt);

    // Convert result to WebP at 1024px
    const outputBuffer = await this.processOutput(result, metadata.width, metadata.height);

    return {
      imageBuffer: outputBuffer,
      mimeType: 'image/png',
    };
  }

  private async callGeminiAPI(imageBase64: string, prompt: string): Promise<Buffer> {
    // Use Nano Banana Pro (Gemini 3 Pro Image) for superior image generation
    // API key is passed via x-goog-api-key header for security (not in URL)
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';

    const requestBody = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              text: `You are a Wojak meme art generator. Your task is to REPLACE the face in this photo with a classic Wojak meme face and convert the entire image to Wojak art style.

REFERENCE: The Wojak meme face has these features:
- Pure white/off-white skin (#FFFFFF to #F5F5F5)
- Simple black outline around the head
- Eyes: oval shapes with small black dots for pupils
- Nose: minimal, just 2-3 simple curved lines
- Mouth: thin curved line (up for happy, down for sad, straight for neutral)
- Eyebrows: thin curved black lines
- Simple curved lines for any wrinkles or expression lines
- NO realistic skin tones, NO complex shading

${prompt}

IMPORTANT INSTRUCTIONS:
1. The output MUST look like the classic Wojak meme drawings you see on the internet
2. The face MUST be replaced with Wojak-style features (white skin, simple line art)
3. Keep the EXACT same head angle, pose, and composition
4. Keep all original colors for hair, clothes, background - ONLY make skin white
5. Match the emotional expression using simple Wojak-style lines
6. The person should still be recognizable by their hair, accessories, face shape, and body
7. Convert the ENTIRE image to this flat, simple, hand-drawn meme style

Generate the Wojak-style image now.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 0.8,
      },
    };

    console.log('Calling Nano Banana Pro (Gemini 3 Pro Image) API...');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
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
      .png()
      .toBuffer();
  }
}
