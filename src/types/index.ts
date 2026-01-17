export type WojakArchetype = 'neutral' | 'doomer' | 'npc' | 'chad';

export interface WojakifySettings {
  archetype: WojakArchetype;
  simplifyBackground: boolean;
  identityStrength: number; // 0-100, maps to how much to preserve original features
}

export interface WojakifyRequest {
  image: File | Blob;
  settings: WojakifySettings;
}

export interface WojakifyResponse {
  success: boolean;
  imageBase64?: string;
  error?: string;
}

export interface ImageStylizerInput {
  imageBuffer: Buffer;
  mimeType: string;
  settings: WojakifySettings;
}

export interface ImageStylizerOutput {
  imageBuffer: Buffer;
  mimeType: 'image/png' | 'image/webp';
}

export interface ImageStylizer {
  stylize(input: ImageStylizerInput): Promise<ImageStylizerOutput>;
}

export const ARCHETYPE_LABELS: Record<WojakArchetype, string> = {
  neutral: 'Neutral Wojak',
  doomer: 'Doomer',
  npc: 'NPC',
  chad: 'Chad',
};

export const ARCHETYPE_DESCRIPTIONS: Record<WojakArchetype, string> = {
  neutral: 'The classic, expressionless Wojak with a hint of melancholy',
  doomer: 'Black hoodie, cigarette, existential dread, dark circles under eyes',
  npc: 'Gray skin tone, blank expression, generic features, emotionless',
  chad: 'Chiseled jaw, confident smirk, well-defined features, heroic pose',
};
