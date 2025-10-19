import React from 'react';
import './Tile.css';

const TILE_EMOJIS = {
  'bamboo-1': '🀐', 'bamboo-2': '🀑', 'bamboo-3': '🀒', 'bamboo-4': '🀓', 'bamboo-5': '🀔',
  'bamboo-6': '🀕', 'bamboo-7': '🀖', 'bamboo-8': '🀗', 'bamboo-9': '🀘',
  'character-1': '🀇', 'character-2': '🀈', 'character-3': '🀉', 'character-4': '🀊', 'character-5': '🀋',
  'character-6': '🀌', 'character-7': '🀍', 'character-8': '🀎', 'character-9': '🀏',
  'dot-1': '🀙', 'dot-2': '🀚', 'dot-3': '🀛', 'dot-4': '🀜', 'dot-5': '🀝',
  'dot-6': '🀞', 'dot-7': '🀟', 'dot-8': '🀠', 'dot-9': '🀡',
  'dragon-red': '🀄', 'dragon-green': '🀅', 'dragon-white': '🀆',
  'wind-east': '🀀', 'wind-south': '🀁', 'wind-west': '🀂', 'wind-north': '🀃',
  'flower-1': '🀢', 'flower-2': '🀣', 'flower-3': '🀤', 'flower-4': '🀥'
};

function Tile({ tile, size = 'normal', selected = false, highlighted = false, onClick }) {
  const emoji = TILE_EMOJIS[tile] || '🀫';
  
  return (
    <div
      className={`tile tile-${size} ${selected ? 'tile-selected' : ''} ${highlighted ? 'tile-highlighted' : ''} ${onClick ? 'tile-clickable' : ''}`}
      onClick={onClick}
      title={tile}
    >
      <span className="tile-emoji">{emoji}</span>
    </div>
  );
}

export default Tile;

