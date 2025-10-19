import React from 'react';
import './DiscardPile.css';
import Tile from './Tile';

function DiscardPile({ tiles, lastDiscard }) {
  const displayTiles = tiles.slice(-20); // Show last 20 tiles

  return (
    <div className="discard-pile">
      <h3>Discard Pile ({tiles.length})</h3>
      <div className="discard-tiles">
        {displayTiles.length === 0 ? (
          <div className="empty-message">No discards yet</div>
        ) : (
          displayTiles.map((tile, index) => (
            <Tile
              key={`discard-${index}`}
              tile={tile}
              size="small"
              highlighted={
                lastDiscard && 
                index === displayTiles.length - 1 &&
                tile === lastDiscard.tile
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

export default DiscardPile;

