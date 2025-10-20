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

  return (
    <div className="action-panel">
      <div className="action-section">
        <h4>Your Actions</h4>
        
        {/* Chow selector dropdown (appears above buttons when needed) */}
        {hasChow && actionAvailable.options && (
          <div className="chow-selector">
            <label>Select Chow:</label>
            <select 
              value={selectedChowOption ? JSON.stringify(selectedChowOption) : ''}
              onChange={(e) => onSelectChowOption(e.target.value ? JSON.parse(e.target.value) : null)}
              className="chow-dropdown"
            >
              <option value="">-- Select combination --</option>
              {actionAvailable.options.map((option, idx) => (
                <option key={idx} value={JSON.stringify(option)}>
                  {option.join(' ')}
                </option>
              ))}
            </select>
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

