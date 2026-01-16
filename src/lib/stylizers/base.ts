import { ImageStylizer, ImageStylizerInput, ImageStylizerOutput } from '@/types';

export abstract class BaseImageStylizer implements ImageStylizer {
  abstract stylize(input: ImageStylizerInput): Promise<ImageStylizerOutput>;

  protected buildWojakPrompt(settings: ImageStylizerInput['settings']): string {
    const baseStyle = `Transform this photo into a Wojak meme art style illustration.
Style requirements:
- Simple black outlines (2-3px weight), clean vector-like edges
- Flat shading with minimal gradients
- Limited color palette (max 8-10 colors)
- Slightly exaggerated facial features while keeping the person recognizable
- Simplified ears as small curved shapes
- Eyes as simple ovals with small pupils
- Simple nose as minimal lines or small shape
- Mouth as simple curved line`;

    const archetypeModifiers: Record<string, string> = {
      neutral: `
- Classic Wojak expression: slightly sad, contemplative
- Pale beige/cream skin tone (#FFEFC3)
- Thin eyebrows, subtle bags under eyes
- Neutral, slightly downturned mouth`,
      doomer: `
- Doomer Wojak style: black hoodie or beanie
- Pale gray-ish skin, dark circles under eyes
- Cigarette optional, melancholic expression
- Stubble or unkempt appearance
- Dark, muted color palette`,
      npc: `
- NPC Wojak style: completely gray skin tone
- Perfectly blank, emotionless expression
- Generic, unremarkable features
- Simple gray clothing
- No individual characteristics, robotic feel`,
      chad: `
- Chad/GigaChad Wojak style: strong jawline
- Confident, knowing smirk
- Well-defined cheekbones and brow
- Heroic, slightly upward gaze
- Golden/tan healthy skin tone
- More detailed but still simplified features`,
    };

    const backgroundInstruction = settings.simplifyBackground
      ? `
Background:
- Simplify into flat solid colors or gentle gradient
- Remove complex details, keep it minimal
- Use colors that complement the Wojak style`
      : `
Background:
- Keep a simplified version of the original background
- Reduce detail but maintain context`;

    const identityInstruction = `
Identity preservation (${settings.identityStrength}% strength):
- ${settings.identityStrength > 70 ? 'Strongly preserve' : settings.identityStrength > 40 ? 'Moderately preserve' : 'Loosely preserve'} recognizable features
- Keep distinctive elements like hair style, facial hair, glasses if present
- Maintain overall face shape and proportions`;

    return `${baseStyle}

${archetypeModifiers[settings.archetype] || archetypeModifiers.neutral}

${backgroundInstruction}

${identityInstruction}`;
  }

  protected get negativePrompt(): string {
    return `photorealistic, 3D render, CGI, realistic skin texture, complex shading,
text, watermark, logo, signature, extra faces, multiple people,
deformed eyes, asymmetrical eyes, crossed eyes, extra limbs,
mutated hands, distorted features, blurry, low quality,
anime style, manga style, Disney style, Pixar style`;
  }
}
