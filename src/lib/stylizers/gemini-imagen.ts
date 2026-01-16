import { ImageStylizerInput, ImageStylizerOutput } from '@/types';
import { BaseImageStylizer } from './base';
import sharp from 'sharp';

interface GeminiImagenConfig {
  projectId: string;
  location: string;
  apiKey?: string;
}

interface VertexAIResponse {
  predictions?: Array<{
    bytesBase64Encoded?: string;
    mimeType?: string;
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export class GeminiImagenStylizer extends BaseImageStylizer {
  private config: GeminiImagenConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config?: Partial<GeminiImagenConfig>) {
    super();
    this.config = {
      projectId: config?.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID || '',
      location: config?.location || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      apiKey: config?.apiKey || process.env.GOOGLE_API_KEY,
    };

    if (!this.config.projectId && !this.config.apiKey) {
      throw new Error('Either GOOGLE_CLOUD_PROJECT_ID or GOOGLE_API_KEY must be set');
    }
  }

  private async getAccessToken(): Promise<string> {
    // If using API key, we don't need an access token
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Get token from Google Cloud metadata or service account
    try {
      // Try to use Google Auth Library if available
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();

      if (tokenResponse.token) {
        this.accessToken = tokenResponse.token;
        // Token expires in 1 hour, refresh 5 minutes early
        this.tokenExpiry = Date.now() + 55 * 60 * 1000;
        return this.accessToken;
      }
    } catch {
      // If google-auth-library fails, try metadata server (for GCP environments)
      try {
        const response = await fetch(
          'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
          { headers: { 'Metadata-Flavor': 'Google' } }
        );
        if (response.ok) {
          const data = await response.json();
          const token = data.access_token as string;
          this.accessToken = token;
          this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
          return token;
        }
      } catch {
        // Not running on GCP
      }
    }

    throw new Error('Unable to obtain Google Cloud access token. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_API_KEY.');
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

    // Call Vertex AI Imagen API
    const result = await this.callImagenAPI(imageBase64, prompt);

    // Convert result to WebP at 1024px
    const outputBuffer = await this.processOutput(result, metadata.width, metadata.height);

    return {
      imageBuffer: outputBuffer,
      mimeType: 'image/webp',
    };
  }

  private async callImagenAPI(imageBase64: string, prompt: string): Promise<Buffer> {
    const token = await this.getAccessToken();

    // Using Imagen 3 for image editing/stylization
    const endpoint = `https://${this.config.location}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/imagen-3.0-generate-001:predict`;

    // For image-to-image transformation, we use the edit endpoint
    const editEndpoint = `https://${this.config.location}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/imagegeneration@006:predict`;

    const requestBody = {
      instances: [
        {
          prompt: prompt,
          image: {
            bytesBase64Encoded: imageBase64,
          },
        },
      ],
      parameters: {
        sampleCount: 1,
        // Guidance scale affects how closely the output follows the prompt
        guidanceScale: 15,
        // For edit mode, controls how much of the original image to preserve
        editConfig: {
          editMode: 'EDIT_MODE_INPAINT_INSERTION',
        },
        negativePrompt: this.negativePrompt,
        outputOptions: {
          mimeType: 'image/png',
        },
      },
    };

    // First, try the Gemini multimodal approach for better stylization
    try {
      const geminiResult = await this.callGeminiMultimodal(imageBase64, prompt, token);
      if (geminiResult) {
        return geminiResult;
      }
    } catch (error) {
      console.log('Gemini multimodal not available, falling back to Imagen');
    }

    // Fallback to Imagen API
    const response = await fetch(editEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Imagen API error:', errorText);
      throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
    }

    const data: VertexAIResponse = await response.json();

    if (data.error) {
      throw new Error(`Imagen API error: ${data.error.message}`);
    }

    if (!data.predictions || data.predictions.length === 0 || !data.predictions[0].bytesBase64Encoded) {
      throw new Error('No image generated from Imagen API');
    }

    return Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
  }

  private async callGeminiMultimodal(imageBase64: string, prompt: string, token: string): Promise<Buffer | null> {
    // Use Gemini 2.0 Flash with image generation capability
    const endpoint = `https://${this.config.location}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/gemini-2.0-flash-exp:generateContent`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: imageBase64,
              },
            },
            {
              text: `You are an image transformation AI. Transform the provided photo into a Wojak meme style illustration.

${prompt}

IMPORTANT: Generate an image that is a Wojak-style transformation of the input photo. The output must be an image, not text.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 0.4,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Extract image from response
    const candidates = data.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
    }

    return null;
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
