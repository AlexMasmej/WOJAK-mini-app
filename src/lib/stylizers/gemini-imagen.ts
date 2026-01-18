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

    // Resize first
    output = output.resize(newWidth, newHeight, { fit: 'inside' });
    const resizedBuffer = await output.toBuffer();

    // Add watermark
    const watermarkedBuffer = await this.addWatermark(resizedBuffer, newWidth, newHeight);

    return watermarkedBuffer;
  }

  private async addWatermark(
    imageBuffer: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> {
    // Calculate inset (4% from edges)
    const insetX = Math.round(width * 0.04);
    const insetY = Math.round(height * 0.04);

    // Scale watermark based on image width (base size designed for 1024px width)
    const scaleFactor = width / 1024;
    const watermarkWidth = Math.round(140 * scaleFactor);
    const watermarkHeight = Math.round(45 * scaleFactor);

    // SVG watermark: "$WOJAK" bubble letter logo with shadow, transparent background
    const svgWatermark = Buffer.from(`<svg width="${watermarkWidth}" height="${watermarkHeight}" viewBox="0 0 140 45" xmlns="http://www.w3.org/2000/svg">
  <!-- Shadow layer (offset down-right) -->
  <g transform="translate(3, 3)" fill="#1a1a1a">
    <path d="M6 5C6 3 8 1 11 1L11 0L13 0L13 1C16 1.5 18 3 19 5L17 7C16 5 15 4 13 4L13 12C17 13 19 15 19 19C19 23 16 25 13 25.5L13 28L11 28L11 25.5C8 25 5 23 4 19L7 17C8 20 9 21 11 22L11 14C7 13 5 11 5 7C5 6 5.5 5.5 6 5ZM11 11L11 4C9 4.5 8 6 8 7.5C8 9 9 10 11 11ZM13 16L13 22C15 21.5 16 20 16 18C16 16.5 15 15.5 13 16Z"/>
    <path d="M22 5L26 5L30 18L34 5L38 5L42 18L46 5L50 5L44 28L40 28L36 15L32 28L28 28Z"/>
    <path d="M52 16.5C52 9 57 4 63 4C69 4 74 9 74 16.5C74 24 69 29 63 29C57 29 52 24 52 16.5ZM56 16.5C56 22 59 26 63 26C67 26 70 22 70 16.5C70 11 67 7 63 7C59 7 56 11 56 16.5Z"/>
    <path d="M78 5L88 5L88 8L82 8L82 18C82 22 80 25 76 25C74 25 72 24 71 23L73 20C74 21 75 21.5 76 21.5C78 21.5 78 20 78 18L78 5Z"/>
    <path d="M106 28L102 28L100 22L92 22L90 28L86 28L94 5L98 5ZM96 8L93 18L99 18Z"/>
    <path d="M108 5L112 5L112 14L120 5L126 5L117 15L127 28L121 28L114 19L112 21L112 28L108 28Z"/>
  </g>
  <!-- Main letters: white fill with dark outline -->
  <g fill="white" stroke="#2d2d2d" stroke-width="2" stroke-linejoin="round">
    <path d="M6 5C6 3 8 1 11 1L11 0L13 0L13 1C16 1.5 18 3 19 5L17 7C16 5 15 4 13 4L13 12C17 13 19 15 19 19C19 23 16 25 13 25.5L13 28L11 28L11 25.5C8 25 5 23 4 19L7 17C8 20 9 21 11 22L11 14C7 13 5 11 5 7C5 6 5.5 5.5 6 5ZM11 11L11 4C9 4.5 8 6 8 7.5C8 9 9 10 11 11ZM13 16L13 22C15 21.5 16 20 16 18C16 16.5 15 15.5 13 16Z"/>
    <path d="M22 5L26 5L30 18L34 5L38 5L42 18L46 5L50 5L44 28L40 28L36 15L32 28L28 28Z"/>
    <path d="M52 16.5C52 9 57 4 63 4C69 4 74 9 74 16.5C74 24 69 29 63 29C57 29 52 24 52 16.5ZM56 16.5C56 22 59 26 63 26C67 26 70 22 70 16.5C70 11 67 7 63 7C59 7 56 11 56 16.5Z"/>
    <path d="M78 5L88 5L88 8L82 8L82 18C82 22 80 25 76 25C74 25 72 24 71 23L73 20C74 21 75 21.5 76 21.5C78 21.5 78 20 78 18L78 5Z"/>
    <path d="M106 28L102 28L100 22L92 22L90 28L86 28L94 5L98 5ZM96 8L93 18L99 18Z"/>
    <path d="M108 5L112 5L112 14L120 5L126 5L117 15L127 28L121 28L114 19L112 21L112 28L108 28Z"/>
  </g>
</svg>`);

    // Position watermark at bottom-right with inset
    const left = width - watermarkWidth - insetX;
    const top = height - watermarkHeight - insetY;

    return sharp(imageBuffer)
      .composite([
        {
          input: svgWatermark,
          left: Math.max(0, left),
          top: Math.max(0, top),
        },
      ])
      .png()
      .toBuffer();
  }
}
