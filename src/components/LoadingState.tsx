'use client';

import { useEffect, useState } from 'react';

const WOJAK_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/en/c/cc/Wojak_cropped.jpg';

const LOADING_MESSAGES = [
  'Analyzing your photo...',
  'Drawing the outlines...',
  'Applying Wojak aesthetics...',
  'Simplifying colors...',
  'Adding that meme magic...',
  'Almost there...',
];

export default function LoadingState() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
      {/* Animated Wojak image with zoom effect */}
      <div className="relative w-32 h-32 mb-6">
        <img
          src={WOJAK_IMAGE_URL}
          alt="Wojak loading"
          className="w-full h-full object-contain wojak-zoom"
        />
      </div>

      {/* Progress text */}
      <p className="text-gray-600 font-medium text-center transition-all duration-300">
        {LOADING_MESSAGES[messageIndex]}
      </p>
      <p className="text-gray-400 text-sm mt-1">
        This may take a few seconds
      </p>
    </div>
  );
}
