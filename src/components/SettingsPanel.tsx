'use client';

import { WojakifySettings, WojakArchetype, ARCHETYPE_LABELS, ARCHETYPE_DESCRIPTIONS } from '@/types';

interface SettingsPanelProps {
  settings: WojakifySettings;
  onChange: (settings: WojakifySettings) => void;
  disabled?: boolean;
}

export default function SettingsPanel({
  settings,
  onChange,
  disabled = false,
}: SettingsPanelProps) {
  const archetypes: WojakArchetype[] = ['neutral', 'doomer', 'npc', 'chad'];

  return (
    <div className={`space-y-6 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Archetype Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Archetype
        </label>
        <div className="grid grid-cols-2 gap-2">
          {archetypes.map((archetype) => (
            <button
              key={archetype}
              onClick={() => onChange({ ...settings, archetype })}
              disabled={disabled}
              className={`
                relative p-3 rounded-xl text-left transition-all duration-200
                ${
                  settings.archetype === archetype
                    ? 'bg-gray-900 text-white ring-2 ring-gray-900 ring-offset-2'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <span className="block font-medium text-sm">
                {ARCHETYPE_LABELS[archetype]}
              </span>
              <span
                className={`block text-xs mt-0.5 ${
                  settings.archetype === archetype ? 'text-gray-300' : 'text-gray-400'
                }`}
              >
                {ARCHETYPE_DESCRIPTIONS[archetype].split(',')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Simplify Background Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Simplify Background
          </label>
          <p className="text-xs text-gray-400 mt-0.5">
            Flatten background into solid colors
          </p>
        </div>
        <button
          onClick={() =>
            onChange({ ...settings, simplifyBackground: !settings.simplifyBackground })
          }
          disabled={disabled}
          className="toggle-switch"
          data-state={settings.simplifyBackground ? 'checked' : 'unchecked'}
          role="switch"
          aria-checked={settings.simplifyBackground}
        >
          <span className="toggle-switch-thumb" />
        </button>
      </div>

      {/* Identity Strength Slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Keep Identity
          </label>
          <span className="text-sm text-gray-500 tabular-nums">
            {settings.identityStrength}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.identityStrength}
          onChange={(e) =>
            onChange({ ...settings, identityStrength: parseInt(e.target.value, 10) })
          }
          disabled={disabled}
          className="w-full"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">More Wojak</span>
          <span className="text-xs text-gray-400">More You</span>
        </div>
      </div>
    </div>
  );
}
