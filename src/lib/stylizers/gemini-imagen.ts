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
    const watermarkWidth = Math.round(200 * scaleFactor);
    const watermarkHeight = Math.round(28 * scaleFactor);

    // SVG watermark with text as paths (font-independent rendering)
    // Text: "$WOJAK @WojakOnX" - converted to SVG paths for consistent rendering
    const svgWatermark = Buffer.from(`<svg width="${watermarkWidth}" height="${watermarkHeight}" viewBox="0 0 200 28" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="28" rx="4" fill="rgba(0,0,0,0.5)"/>
  <g fill="white" transform="translate(8, 19)">
    <!-- $ -->
    <path d="M5.5 0.5v-2h1v2c1.5.2 2.5.8 3 1.8l-1.2.8c-.3-.7-1-1.2-1.8-1.3v3.2c2 .5 3.2 1.3 3.2 2.9 0 1.7-1.3 2.7-3.2 2.9v2h-1v-2c-1.7-.2-2.8-1-3.4-2.2l1.2-.7c.4.9 1.2 1.5 2.2 1.6v-3.4c-1.9-.5-3-1.3-3-2.8 0-1.6 1.2-2.6 3-2.8zm0 1.3c-.9.1-1.5.6-1.5 1.3 0 .6.5 1 1.5 1.3v-2.6zm1 6.8c1-.1 1.6-.6 1.6-1.4 0-.7-.5-1.1-1.6-1.4v2.8z"/>
    <!-- W -->
    <path d="M12 1h1.8l2 7.5 2-7.5h1.5l2 7.5 2-7.5h1.8l-2.8 10h-1.8l-2-7.2-2 7.2h-1.8z"/>
    <!-- O -->
    <path d="M27 6c0-3 2-5.2 4.5-5.2s4.5 2.2 4.5 5.2-2 5.2-4.5 5.2S27 9 27 6zm1.7 0c0 2.1 1.2 3.6 2.8 3.6s2.8-1.5 2.8-3.6-1.2-3.6-2.8-3.6-2.8 1.5-2.8 3.6z"/>
    <!-- J -->
    <path d="M38 1h1.7v7.2c0 1.5-.4 2.5-2.5 2.5-.8 0-1.4-.2-1.8-.5l.5-1.3c.3.2.7.3 1.1.3.7 0 1-.4 1-1.2z"/>
    <!-- A -->
    <path d="M42 11l3.5-10h1.8l3.5 10h-1.8l-.8-2.3h-3.6l-.8 2.3zm3.2-3.8h2.4l-1.2-3.8z"/>
    <!-- K -->
    <path d="M52 1h1.7v4l3.3-4h2l-3.3 4 3.5 6h-2l-2.7-4.5-.8 1v3.5H52z"/>
    <!-- space + @ -->
    <path d="M68 6c0-3.3 2.5-5.5 5.5-5.5 2 0 3.5.9 4.3 2.3l-1.4.8c-.5-.9-1.5-1.5-2.9-1.5-2.2 0-3.8 1.6-3.8 3.9 0 1.5.7 2.6 1.8 3.2v.3c-.3.5-.4 1-.4 1.4 0 .9.6 1.4 1.8 1.4h2.2c1.8 0 2.8-.6 2.8-1.8 0-.8-.5-1.3-1.5-1.5l.3-1.2c1.7.3 2.7 1.3 2.7 2.8 0 1.9-1.5 3-4.2 3h-2.3c-2 0-3.2-.9-3.2-2.5 0-.6.2-1.2.5-1.8-1.4-.9-2.2-2.4-2.2-4.3zm3.5.2c0 1.2.8 2 2 2s2-.8 2-2-.8-2-2-2-2 .8-2 2z"/>
    <!-- W -->
    <path d="M82 1h1.6l1.8 7.5 1.8-7.5h1.4l1.8 7.5 1.8-7.5h1.6l-2.5 10h-1.6l-1.8-7.2-1.8 7.2h-1.6z"/>
    <!-- o -->
    <path d="M95 7.5c0-2.2 1.5-3.8 3.5-3.8s3.5 1.6 3.5 3.8-1.5 3.8-3.5 3.8-3.5-1.6-3.5-3.8zm1.5 0c0 1.4.8 2.4 2 2.4s2-1 2-2.4-.8-2.4-2-2.4-2 1-2 2.4z"/>
    <!-- j -->
    <path d="M104 4h1.5v6.5c0 1.3-.6 2-1.8 2-.5 0-.9-.1-1.2-.3l.4-1.1c.2.1.4.2.6.2.4 0 .5-.2.5-.7zm0-3h1.5v1.7h-1.5z"/>
    <!-- a -->
    <path d="M108 9c0-1.5 1.2-2.2 3-2.2h1.2v-.3c0-.9-.5-1.3-1.4-1.3-.7 0-1.2.3-1.6.7l-.8-1c.6-.6 1.5-1 2.6-1 1.7 0 2.7.9 2.7 2.5v4.6h-1.4v-.9c-.4.6-1.1 1-2 1-1.3 0-2.3-.8-2.3-2.1zm4.2-.5v-.7h-1.1c-1 0-1.5.4-1.5 1s.5 1 1.2 1c.8 0 1.4-.5 1.4-1.3z"/>
    <!-- k -->
    <path d="M116 1h1.5v5.8l2.3-2.8h1.8l-2.5 3 2.7 4h-1.8l-1.9-3-.6.7v2.3H116z"/>
    <!-- O -->
    <path d="M123 7.5c0-2.2 1.5-3.8 3.5-3.8s3.5 1.6 3.5 3.8-1.5 3.8-3.5 3.8-3.5-1.6-3.5-3.8zm1.5 0c0 1.4.8 2.4 2 2.4s2-1 2-2.4-.8-2.4-2-2.4-2 1-2 2.4z"/>
    <!-- n -->
    <path d="M132 4h1.4v1c.4-.7 1.2-1.1 2.1-1.1 1.5 0 2.4 1 2.4 2.6v4.5h-1.5v-4.2c0-1-.5-1.5-1.4-1.5s-1.5.6-1.5 1.6v4.1H132z"/>
    <!-- X -->
    <path d="M140 1h1.8l2.2 4 2.2-4h1.8l-3.2 5.2 3.4 4.8h-1.8l-2.4-3.5-2.4 3.5h-1.8l3.4-4.8z"/>
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
