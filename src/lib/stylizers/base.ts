import { ImageStylizer, ImageStylizerInput, ImageStylizerOutput } from '@/types';

export abstract class BaseImageStylizer implements ImageStylizer {
  abstract stylize(input: ImageStylizerInput): Promise<ImageStylizerOutput>;

  protected buildWojakPrompt(settings: ImageStylizerInput['settings']): string {
    const baseStyle = `CRITICAL TASK: Replace the person's face with a Wojak meme face while converting the ENTIRE image to Wojak art style.

FACE REPLACEMENT REQUIREMENTS (MOST IMPORTANT):
- REPLACE the actual face with the classic Wojak drawn face
- The Wojak face must have: simple oval eyes with small black pupils, minimal nose (just 2-3 simple lines), thin curved mouth line
- Skin MUST be pure white/off-white (#FFFFFF to #F5F5F5) like the original Wojak meme - NO realistic skin tones
- Simple black outlines (2-3px) around facial features
- Thin curved eyebrows as simple black lines
- Small simplified ears as curved shapes

EXACT POSE & ANGLE MATCHING (CRITICAL):
- Match the EXACT head angle, tilt, and rotation from the original photo
- If head is turned 3/4 view, draw Wojak face at 3/4 view
- If looking up/down, match that exact angle
- Preserve the exact body pose and positioning
- Keep the same framing and composition

EMOTION & EXPRESSION MATCHING:
- Detect the emotion in the original photo (happy, sad, surprised, angry, neutral, etc.)
- Express that SAME emotion using Wojak-style simple lines
- Smiling = curved upward mouth line
- Sad = downturned mouth, droopy eyes
- Surprised = wide oval eyes, open mouth
- The expression must clearly convey the same feeling as the original

COLOR PRESERVATION:
- Keep ALL original colors for: clothing, hair color, background, accessories
- ONLY change skin to white (Wojak white)
- Hair should be simplified but keep original color
- Clothes keep original colors, just simplified/flattened style
- Background colors stay the same, just simplified to flat colors

ART STYLE CONVERSION:
- Convert entire image to Wojak/MS Paint meme style
- Simple black outlines around everything
- Flat colors with minimal to no gradients
- Clean vector-like edges
- Limited color palette per object (flatten complex patterns)
- Everything should look hand-drawn in simple style`;

    const archetypeModifiers: Record<string, string> = {
      neutral: `
ARCHETYPE - Classic Wojak:
- Standard Wojak face with slightly melancholic/contemplative expression
- Simple curved eyebrows, subtle line under eyes
- Thin neutral or slightly downturned mouth
- Pure white skin tone`,
      doomer: `
ARCHETYPE - Doomer Wojak:
- Wojak face with tired, exhausted expression
- Dark circles under eyes (simple curved lines)
- Heavier eyelids, droopy expression
- Pale white/slightly gray skin
- Keep original clothing but simplify to Wojak style
- Melancholic, world-weary look`,
      npc: `
ARCHETYPE - NPC Wojak:
- Wojak face with completely blank, empty expression
- Gray-tinted white skin (#E0E0E0)
- No individual expression - robotic neutrality
- Simple dot eyes, straight line mouth
- Generic, unremarkable appearance`,
      chad: `
ARCHETYPE - Chad Wojak:
- Strong defined jawline in Wojak style
- Confident smirk expression
- Well-defined angular face shape
- Still white/light skin but more defined features
- Heroic, confident expression
- Slightly more detailed face while maintaining Wojak simplicity`,
    };

    const backgroundInstruction = settings.simplifyBackground
      ? `
BACKGROUND:
- Convert to flat solid color or simple gradient
- Use the dominant color from original background
- Remove complex details entirely
- Keep it minimal and clean`
      : `
BACKGROUND:
- Simplify background to Wojak style but keep scene elements
- Flatten colors, add simple outlines to objects
- Maintain scene context in simplified form
- Keep original color palette`;

    const identityInstruction = `
IDENTITY PRESERVATION (${settings.identityStrength}% strength):
- ${settings.identityStrength > 70 ? 'STRONGLY' : settings.identityStrength > 40 ? 'MODERATELY' : 'LOOSELY'} preserve recognizable features
- MUST keep: exact hairstyle shape and color, facial hair if present, glasses/accessories
- MUST keep: face shape proportions (round face stays round, long face stays long)
- MUST keep: distinctive features (big nose = simplified big nose, etc.)
- The person MUST be immediately recognizable to someone who knows them
- This should look like "that person as a Wojak" not just "a Wojak"`;

    return `${baseStyle}

${archetypeModifiers[settings.archetype] || archetypeModifiers.neutral}

${backgroundInstruction}

${identityInstruction}

FINAL CHECK:
- Face is replaced with Wojak face (white skin, simple features)?
- Exact same pose/angle as original?
- Same emotion expressed in Wojak style?
- Original colors preserved (except white skin)?
- Person is still recognizable?
- Entire image is in Wojak/meme art style?`;
  }

  protected get negativePrompt(): string {
    return `photorealistic, 3D render, CGI, realistic skin texture, realistic skin color,
complex shading, realistic human face, normal skin tones, tan skin, brown skin, pink skin,
text, watermark, logo, signature, extra faces, multiple people,
deformed eyes, asymmetrical eyes, crossed eyes, extra limbs,
mutated hands, distorted features, blurry, low quality,
anime style, manga style, Disney style, Pixar style, cartoon style,
AI art style, digital painting, oil painting, watercolor,
changing the pose, different angle, different composition`;
  }
}
