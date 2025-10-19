import React from 'react';
import './ActionPanel.css';
import Tile from './Tile';

function ActionPanel({
  canDraw,
  canDiscard,
  onDraw,
  onDiscard,
  actionAvailable,
  onClaim,
  onPass,
  selectedChowOption,
  onSelectChowOption
}) {
  return (
    <div className="action-panel">
      <div className="action-section">
        <h4>Your Actions</h4>
        <div className="action-buttons">
          <button
            className="action-btn draw-btn"
            onClick={onDraw}
            disabled={!canDraw}
          >
            🎴 Draw Tile
          </button>
          <button
            className="action-btn discard-btn"
            onClick={onDiscard}
            disabled={!canDiscard}
          >
            🗑️ Discard Selected
          </button>
        </div>
      </div>

      {actionAvailable && (
        <div className="claim-section">
          <h4>⚡ Claim Available!</h4>
          <p className="claim-message">
            You can <strong>{actionAvailable.type}</strong> the discarded tile
          </p>

          {actionAvailable.type === 'chow' && actionAvailable.options && (
            <div className="chow-options">
              <p className="options-label">Select chow combination:</p>
              {actionAvailable.options.map((option, idx) => (
                <div
                  key={idx}
                  className={`chow-option ${selectedChowOption === option ? 'selected' : ''}`}
                  onClick={() => onSelectChowOption(option)}
                >
                  {option.map((tile, tileIdx) => (
                    <Tile key={tileIdx} tile={tile} size="small" />
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="claim-buttons">
            <button
              className="action-btn claim-btn"
              onClick={() => onClaim(actionAvailable.type, selectedChowOption)}
              disabled={actionAvailable.type === 'chow' && !selectedChowOption}
            >
              ✅ Claim {actionAvailable.type.toUpperCase()}
            </button>
            <button
              className="action-btn pass-btn"
              onClick={onPass}
            >
              ⏭️ Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActionPanel;

