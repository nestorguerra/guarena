// The look of the game, chosen before anything is built: 'anime' (flat colours, two tones of light, ink lines, a
// painted sky — after the web game Messenger) or 'real' (the photographic town). Read by the textures, materials,
// sky, trees and characters while they are made; changing it needs a restart.
export const STYLE = { anime: true, name: 'anime' };
export function setStyle(name) {
  STYLE.name = name === 'real' ? 'real' : 'anime';
  STYLE.anime = STYLE.name === 'anime';
}
