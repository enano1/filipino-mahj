import React from 'react';
import './OpponentDisplay.css';
import Tile from './Tile';

function OpponentDisplay({ position, playerIndex, melds, isActive }) {
  return (
    <div className={`opponent-display opponent-${position} ${isActive ? 'active' : ''}`}>
      <div className="opponent-header">
        <span className="opponent-name">Player {playerIndex + 1}</span>
        {isActive && <span className="active-indicator">🎯</span>}
      </div>
      <div className="opponent-melds">
        {melds.map((meld, idx) => (
          <div key={idx} className="opponent-meld">
            {meld.tiles.map((tile, tileIdx) => (
              <Tile key={tileIdx} tile={tile} size="tiny" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default OpponentDisplay;

