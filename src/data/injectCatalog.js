export const INJECT_CATALOG = {
  sda: [
    {
      id: 'satellite-dropout',
      title: 'Satellite Dropout',
      description: 'One satellite disappears for 2 minutes. EW must transmit recovery signal.',
      icon: '🛰️'
    },
    {
      id: 'unknown-satellite',
      title: 'Unknown Satellite Over Kish Island',
      description: 'New satellite appears over 26.5325° N, 53.9868° E. SDA must classify and report.',
      icon: '❓'
    }
  ],
  cyber: [
    {
      id: 'virus-detected',
      title: 'Virus Detected',
      description: 'Virus appears in terminal subsystem. Cadets must detect and remove via terminal.',
      icon: '🦠'
    },
    {
      id: 'enemy-website',
      title: 'New Enemy Website Appears',
      description: 'Suspicious website link sent to terminal. Cadets must investigate for intel.',
      icon: '🌐'
    }
  ],
  intel: [
    {
      id: 'asat-imagery',
      title: 'ASAT Prep Imagery',
      description: 'New images show crews prepping suspected ASAT payload.',
      icon: '📸'
    },
    {
      id: 'cryptic-tweet',
      title: 'Cryptic Tweet Code',
      description: 'Tweet contains hidden cipher revealing launch window.',
      icon: '🐦'
    }
  ],
  ew: [
    {
      id: 'unidentified-signal',
      title: 'New Unidentified Signal',
      description: 'New signal appears on spectrum. EW must detect, characterize, and report.',
      icon: '📡'
    },
    {
      id: 'spectrum-outage',
      title: 'Spectrum Outage',
      description: 'EW visualization goes dark. Requires Cyber to enter repair code.',
      icon: '⚡'
    }
  ]
};

export function getInjectDefinition(teamId, injectId) {
  return INJECT_CATALOG[teamId]?.find((inject) => inject.id === injectId);
}

export function listAllInjects() {
  return Object.entries(INJECT_CATALOG).flatMap(([teamId, injects]) =>
    injects.map((inject) => ({ teamId, ...inject }))
  );
}
