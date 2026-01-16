'use client';

import { useEffect, useState } from 'react';

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
      {/* Animated Wojak-style face */}
      <div className="relative w-24 h-24 mb-6">
        <div className="absolute inset-0 rounded-full bg-wojak-skin border-2 border-wojak-outline loading-pulse" />
        {/* Eyes */}
        <div className="absolute top-8 left-5 w-3 h-4 bg-wojak-outline rounded-full" />
        <div className="absolute top-8 right-5 w-3 h-4 bg-wojak-outline rounded-full" />
        {/* Mouth */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-1 bg-wojak-outline rounded-full" />
      </div>

      {/* Loading spinner */}
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 border-3 border-gray-200 rounded-full" />
        <div className="absolute inset-0 border-3 border-gray-900 rounded-full border-t-transparent animate-spin" />
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
