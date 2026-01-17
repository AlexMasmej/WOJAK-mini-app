'use client';

import { useState, useCallback } from 'react';

interface ResultViewerProps {
  originalImage: string;
  resultImage: string;
  onReset: () => void;
}

export default function ResultViewer({
  originalImage,
  resultImage,
  onReset,
}: ResultViewerProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  const handleDownload = useCallback(() => {
    // Create download link
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${resultImage}`;
    link.download = `wojakified-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [resultImage]);

  const handleShareOnX = useCallback(async () => {
    try {
      // Convert base64 to blob
      const response = await fetch(`data:image/png;base64,${resultImage}`);
      const blob = await response.blob();
      const file = new File([blob], 'wojakified.png', { type: 'image/png' });

      // Only use Web Share API on mobile devices
      // On desktop (macOS, Windows, Linux), it shows native share sheet instead of sharing to X
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            text: 'I just wojakified this picture @wojakonX',
            files: [file],
          });
          return; // Success, exit early
        } catch (shareError) {
          // User cancelled or share failed, fall through to clipboard method
          if ((shareError as Error).name === 'AbortError') {
            return; // User cancelled, don't open X
          }
        }
      }

      // Fallback: Copy image to clipboard and open X
      if (navigator.clipboard && 'write' in navigator.clipboard) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
        } catch {
          console.log('Could not copy image to clipboard');
        }
      }

      // Open X with pre-filled text (user can paste the image)
      const tweetText = encodeURIComponent('I just wojakified this picture @wojakonX\n\n(Image copied to clipboard - paste it!)');
      window.open(`https://x.com/intent/tweet?text=${tweetText}`, '_blank');
    } catch (error) {
      console.log('Share on X failed:', error);
      // Still try to open X
      const tweetText = encodeURIComponent('I just wojakified this picture @wojakonX');
      window.open(`https://x.com/intent/tweet?text=${tweetText}`, '_blank');
    }
  }, [resultImage]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Image display */}
      <div className="relative aspect-square sm:aspect-[4/3] w-full rounded-2xl overflow-hidden bg-white border border-gray-200">
        <img
          src={showOriginal ? originalImage : `data:image/png;base64,${resultImage}`}
          alt={showOriginal ? 'Original photo' : 'Wojakified result'}
          className="w-full h-full object-contain"
        />

        {/* Before/After label */}
        <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full">
          <span className="text-white text-xs font-medium">
            {showOriginal ? 'Before' : 'After'}
          </span>
        </div>
      </div>

      {/* Before/After Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setShowOriginal(false)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              !showOriginal
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Wojakified
          </button>
          <button
            onClick={() => setShowOriginal(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              showOriginal
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Original
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button onClick={handleShareOnX} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share on X
        </button>
        <button onClick={handleDownload} className="btn-secondary flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Save
        </button>
        <button onClick={onReset} className="btn-secondary flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          New
        </button>
      </div>
    </div>
  );
}
