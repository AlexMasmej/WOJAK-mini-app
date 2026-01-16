export { BaseImageStylizer } from './base';
export { GeminiImagenStylizer } from './gemini-imagen';

import { ImageStylizer } from '@/types';
import { GeminiImagenStylizer } from './gemini-imagen';

// Factory function to get the configured stylizer
// This makes it easy to swap implementations
export function createStylizer(): ImageStylizer {
  // Default to Gemini Imagen
  // Add more providers here as needed:
  // - 'replicate' -> ReplicateStylizer
  // - 'stability' -> StabilityAIStylizer
  // - 'openai' -> DALLEStylizer

  const provider = process.env.IMAGE_PROVIDER || 'gemini';

  switch (provider) {
    case 'gemini':
    default:
      return new GeminiImagenStylizer();
  }
}
