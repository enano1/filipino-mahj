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
  const hasPong = actionAvailable && actionAvailable.type === 'pong';
  const hasKong = actionAvailable && actionAvailable.type === 'kong';
  const hasChow = actionAvailable && actionAvailable.type === 'chow';
  const hasAnyClaim = hasPong || hasKong || hasChow;
  
  // Auto-select chow option if there's only one
  React.useEffect(() => {
    if (hasChow && actionAvailable.options && actionAvailable.options.length === 1 && !selectedChowOption) {
      onSelectChowOption(actionAvailable.options[0]);
    }
  }, [hasChow, actionAvailable, selectedChowOption, onSelectChowOption]);

  return (
    <div className="action-panel">
      <div className="action-section">
        <h4>Your Actions</h4>
        
        {/* Chow selector - inline with buttons when needed */}
        {hasChow && actionAvailable.options && actionAvailable.options.length > 1 && (
          <div className="chow-selector-inline">
            <label>Chow Options:</label>
            <div className="chow-options">
              {actionAvailable.options.map((option, idx) => (
                <button
                  key={idx}
                  className={`chow-option-btn ${selectedChowOption && JSON.stringify(selectedChowOption) === JSON.stringify(option) ? 'selected' : ''}`}
                  onClick={() => onSelectChowOption(option)}
                >
                  {option.join(' ')}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="action-buttons-row">
          {/* Main actions */}
          <button
            className="action-btn draw-btn"
            onClick={onDraw}
            disabled={!canDraw}
          >
            🎴 Draw
          </button>
          
          <button
            className="action-btn discard-btn"
            onClick={onDiscard}
            disabled={!canDiscard}
          >
            🗑️ Discard
          </button>
          
          <div className="button-divider"></div>
          
          {/* Claim actions - always visible */}
          <button
            className={`action-btn claim-btn pong-btn ${hasPong ? 'available' : ''}`}
            onClick={() => onClaim('pong')}
            disabled={!hasPong}
            title={hasPong ? "Claim 3 of the same tile" : "No Pong available"}
          >
            🀄 Pong
          </button>
          
          <button
            className={`action-btn claim-btn kong-btn ${hasKong ? 'available' : ''}`}
            onClick={() => onClaim('kong')}
            disabled={!hasKong}
            title={hasKong ? "Claim 4 of the same tile" : "No Kong available"}
          >
            🀅 Kong
          </button>
          
          <button
            className={`action-btn claim-btn chow-btn ${hasChow ? 'available' : ''}`}
            onClick={() => onClaim('chow', selectedChowOption)}
            disabled={!hasChow || (hasChow && !selectedChowOption)}
            title={hasChow ? "Claim sequence" : "No Chow available"}
          >
            🀆 Chow
          </button>
          
          {hasAnyClaim && (
            <button
              className="action-btn pass-btn"
              onClick={onPass}
            >
              ⏭️ Pass
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActionPanel;

