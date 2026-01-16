import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-4 py-4 sm:py-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl sm:text-2xl font-bold text-gray-900">
            Wojakify
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Back
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-4 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                About Wojakify
              </h1>
              <p className="text-gray-600 leading-relaxed">
                Wojakify transforms your photos into Wojak-style meme illustrations.
                Inspired by the iconic internet meme character, our AI-powered tool
                converts portraits into that distinctive hand-drawn look with simple
                outlines, flat colors, and expressive features that have made Wojak
                one of the most recognizable characters in internet culture.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                How It Works
              </h2>
              <ol className="space-y-2 text-gray-600">
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                    1
                  </span>
                  <span>Upload a photo (selfie works best)</span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                    2
                  </span>
                  <span>Choose your Wojak archetype (Neutral, Doomer, NPC, or Chad)</span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                    3
                  </span>
                  <span>Adjust settings to balance between Wojak style and your likeness</span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                    4
                  </span>
                  <span>Download and share your Wojakified creation</span>
                </li>
              </ol>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Privacy
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Your privacy matters to us. Uploaded images are processed in memory
                and are never stored permanently on our servers. We do not save, share,
                or use your photos for any purpose other than generating your Wojakified
                result. All image data is automatically discarded after processing.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                The Archetypes
              </h2>
              <div className="grid gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">Neutral Wojak</h3>
                  <p className="text-sm text-gray-500">
                    The classic, contemplative Wojak with a hint of melancholy
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">Doomer</h3>
                  <p className="text-sm text-gray-500">
                    Black hoodie, cigarette, existential dread, dark circles
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">NPC</h3>
                  <p className="text-sm text-gray-500">
                    Gray skin, blank expression, emotionless and generic
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">Chad</h3>
                  <p className="text-sm text-gray-500">
                    Strong jawline, confident smirk, heroic presence
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                Wojakify is a fun creative tool. Please use responsibly and
                respect others when sharing your creations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
