import React, { useState } from 'react';
import './GameBoard.css';
import Tile from './Tile';
import PlayerHand from './PlayerHand';
import OpponentDisplay from './OpponentDisplay';
import DiscardPile from './DiscardPile';
import ActionPanel from './ActionPanel';

function GameBoard({ gameState, playerIndex, onDraw, onDiscard, onClaim, onPass, actionAvailable, isTestRoom, onResetTestRoom, message }) {
  const [selectedTile, setSelectedTile] = useState(null);
  const [selectedChowOption, setSelectedChowOption] = useState(null);

  // Safety checks for gameState properties
  if (!gameState || !gameState.hand || !gameState.melds || !gameState.players) {
    return (
      <div className="game-board">
        <div className="loading">Loading game state...</div>
      </div>
    );
  }

  const isMyTurn = gameState.currentTurn === playerIndex;
  const canDraw = isMyTurn && gameState.hand.length === 13;
  const canDiscard = isMyTurn && (gameState.hand.length === 14 || gameState.hand.length === 11);
  
  // Debug logging
  console.log(`GameBoard Debug: isMyTurn=${isMyTurn}, hand.length=${gameState.hand.length}, canDiscard=${canDiscard}, currentTurn=${gameState.currentTurn}, playerIndex=${playerIndex}`);

  const handleTileClick = (tile) => {
    if (canDiscard) {
      setSelectedTile(tile);
    }
  };

  const handleDiscard = () => {
    if (selectedTile) {
      onDiscard(selectedTile);
      setSelectedTile(null);
    }
  };

  const handleClaim = (claimType) => {
    if (claimType === 'chow' && selectedChowOption) {
      onClaim(claimType, selectedChowOption);
      setSelectedChowOption(null);
    } else if (claimType !== 'chow') {
      onClaim(claimType);
    }
  };

  // Calculate opponent positions from your perspective
  // Turn order: 1 → 2 → 3 → 4 → 1
  // If you are Player 1:
  //   - Player 4 discards → YOU can chow (they're to your RIGHT)
  //   - YOU discard → Player 2 can chow (they're to your LEFT)
  // 
  // Layout:
  //        [TOP]
  //      Player 3
  //        
  // [LEFT]        [RIGHT]
  // Player 4      Player 2 (you can chow from them!)
  //
  //       [YOU]
  //     Player 1
  
  const getPosition = (opponentIndex) => {
    const diff = (opponentIndex - playerIndex + 4) % 4;
    if (diff === 1) return 'right';  // Next in turn (they can chow from YOU) - moved to right
    if (diff === 2) return 'top';   // Opposite player
    if (diff === 3) return 'left';  // Previous in turn (YOU can chow from them!) - moved to left
    return 'right';
  };

  const opponents = [1, 2, 3].map(offset => {
    const idx = (playerIndex + offset) % 4;
    return {
      position: getPosition(idx),
      playerIndex: idx,
      melds: gameState.melds[idx] || [],
      isAI: gameState.players[idx]?.isAI || false,
      name: gameState.players[idx]?.name || `Player ${idx + 1}`
    };
  });

  return (
    <div className="game-board">
      {/* Turn Indicator */}
      <div className="turn-indicator">
        <div className="turn-info">
          {isMyTurn ? (
            <span className="your-turn">🎯 Your Turn</span>
          ) : (
            <span className="waiting">
              Waiting for Player {gameState.currentTurn + 1}
            </span>
          )}
          <span className="wall-count">Wall: {gameState.wallRemaining} tiles</span>
        </div>
        
        {isTestRoom && (
          <button 
            className="reset-test-btn"
            onClick={onResetTestRoom}
            title="Reset test room with new hands"
          >
            🔄 Reset Game
          </button>
        )}
      </div>

      {/* Game Area */}
      <div className="game-area">
        {/* Opponents */}
        {opponents.map(opp => (
          <OpponentDisplay
            key={opp.playerIndex}
            position={opp.position}
            playerIndex={opp.playerIndex}
            melds={opp.melds}
            isActive={gameState.currentTurn === opp.playerIndex}
            isAI={opp.isAI}
            name={opp.name}
          />
        ))}

        {/* Center Area - Discard Pile */}
        <div className="center-area">
          <div className="center-content">
            <DiscardPile
              tiles={gameState.discardPile}
              lastDiscard={gameState.lastDiscard}
            />
            
            {/* Message banner below discard pile */}
            {message && (
              <div className="game-message-banner">
                {message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player's Hand and Melds */}
      <div className="player-area">
        <div className="player-melds">
          <h3>Your Melds ({(gameState.melds[playerIndex] || []).length}/4)</h3>
          <div className="melds-container">
            {(gameState.melds[playerIndex] || []).map((meld, idx) => (
              <div key={idx} className={`meld meld-${meld.type}`}>
                {meld.tiles.map((tile, tileIdx) => (
                  <Tile key={tileIdx} tile={tile} size="small" />
                ))}
                <span className="meld-label">{meld.type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detected Melds in Hand */}
        {gameState.detectedMelds && gameState.detectedMelds.length > 0 && (
          <div className="detected-melds">
            <h4>
              🎯 Detected in Hand: {gameState.detectedMelds.length} meld(s) 
              <span className="total-melds-count">
                {' '}(Total: {(gameState.melds[playerIndex] || []).length + gameState.detectedMelds.length}/4)
              </span>
            </h4>
            <div className="detected-melds-container">
              {gameState.detectedMelds.map((meld, idx) => (
                <div key={idx} className={`detected-meld detected-meld-${meld.type}`}>
                  {meld.tiles.map((tile, tileIdx) => (
                    <Tile key={tileIdx} tile={tile} size="tiny" />
                  ))}
                  <span className="detected-meld-label">{meld.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <PlayerHand
          hand={gameState.hand}
          selectedTile={selectedTile}
          onTileClick={handleTileClick}
          canSelect={canDiscard}
          drawnTile={gameState.drawnTile}
        />

        <ActionPanel
          canDraw={canDraw}
          canDiscard={canDiscard && selectedTile !== null}
          onDraw={onDraw}
          onDiscard={handleDiscard}
          actionAvailable={actionAvailable}
          onClaim={handleClaim}
          onPass={onPass}
          selectedChowOption={selectedChowOption}
          onSelectChowOption={setSelectedChowOption}
        />
      </div>

      {/* Winner Display */}
      {gameState.winner !== null && (
        <div className="winner-overlay">
          <div className="winner-card">
            <h2>🎉 Game Over! 🎉</h2>
            <p className="winner-text">
              {gameState.winner === playerIndex
                ? 'You Win!'
                : `Player ${gameState.winner + 1} Wins!`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameBoard;

