import React from 'react';
import './PlayerHand.css';
import Tile from './Tile';

function PlayerHand({ hand, selectedTile, onTileClick, canSelect }) {
  return (
    <div className="player-hand">
      <h3>Your Hand ({hand.length} tiles)</h3>
      <div className="hand-tiles">
        {hand.map((tile, index) => (
          <Tile
            key={`${tile}-${index}`}
            tile={tile}
            size="normal"
            selected={selectedTile === tile}
            onClick={canSelect ? () => onTileClick(tile) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default PlayerHand;

