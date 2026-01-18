import { ImageStylizerInput, ImageStylizerOutput } from '@/types';
import { BaseImageStylizer } from './base';
import sharp from 'sharp';

interface GeminiConfig {
  apiKey: string;
  projectId?: string;
  location?: string;
  useVertexAI?: boolean;
}

// Primary model (best quality) and fallback (when rate limited)
const PRIMARY_MODEL = 'gemini-2.0-flash-exp';
const FALLBACK_MODEL = 'gemini-2.0-flash-exp';

export class GeminiImagenStylizer extends BaseImageStylizer {
  private config: GeminiConfig;

  constructor(config?: Partial<GeminiConfig>) {
    super();

    // Check for Vertex AI config first (higher rate limits)
    const vertexApiKey = config?.apiKey || process.env.VERTEX_API_KEY;
    const projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
    const location = config?.location || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    if (vertexApiKey && projectId) {
      // Use Vertex AI
      this.config = {
        apiKey: vertexApiKey,
        projectId,
        location,
        useVertexAI: true,
      };
      console.log('Using Vertex AI for image generation');
    } else {
      // Fall back to Google AI Studio
      const aiStudioKey = process.env.GOOGLE_API_KEY || '';
      if (!aiStudioKey) {
        throw new Error('Either VERTEX_API_KEY + GOOGLE_CLOUD_PROJECT or GOOGLE_API_KEY must be set');
      }
      this.config = {
        apiKey: aiStudioKey,
        useVertexAI: false,
      };
      console.log('Using Google AI Studio for image generation');
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

    // Call Gemini API with fallback
    const result = await this.callGeminiAPIWithFallback(imageBase64, prompt);

    // Convert result to PNG at 1024px
    const outputBuffer = await this.processOutput(result, metadata.width, metadata.height);

    return {
      imageBuffer: outputBuffer,
      mimeType: 'image/png',
    };
  }

  private async callGeminiAPIWithFallback(imageBase64: string, prompt: string): Promise<Buffer> {
    // Try primary model first (best quality)
    try {
      console.log(`Trying primary model: ${PRIMARY_MODEL}`);
      return await this.callGeminiModel(PRIMARY_MODEL, imageBase64, prompt);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's a rate limit or quota error
      const isRateLimited =
        errorMessage.includes('429') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('rate limit');

      if (isRateLimited) {
        console.log(`Primary model rate limited, falling back to ${FALLBACK_MODEL}`);
        return await this.callGeminiModel(FALLBACK_MODEL, imageBase64, prompt);
      }

      // For other errors, rethrow
      throw error;
    }
  }

  private getEndpoint(modelName: string): string {
    if (this.config.useVertexAI) {
      // Vertex AI endpoint format
      const { projectId, location } = this.config;
      return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:generateContent`;
    } else {
      // Google AI Studio endpoint
      return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    }
  }

  private async callGeminiModel(modelName: string, imageBase64: string, prompt: string): Promise<Buffer> {
    const endpoint = this.getEndpoint(modelName);

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

    const apiType = this.config.useVertexAI ? 'Vertex AI' : 'AI Studio';
    console.log(`Calling ${apiType} with model: ${modelName}...`);

    // Different auth methods for Vertex AI vs AI Studio
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let url = endpoint;
    if (this.config.useVertexAI) {
      // Vertex AI uses API key as query parameter
      url = `${endpoint}?key=${this.config.apiKey}`;
    } else {
      // AI Studio uses header
      headers['x-goog-api-key'] = this.config.apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`Gemini API error response (${modelName}):`, responseText);
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
          console.log(`Found image in response from ${modelName}`);
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
