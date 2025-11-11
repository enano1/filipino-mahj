import React, { useState, useEffect } from 'react';
import './GameBoard.css';
import Tile from './Tile';
import PlayerHand from './PlayerHand';
import OpponentDisplay from './OpponentDisplay';
import DiscardPile from './DiscardPile';
import ActionPanel from './ActionPanel';

function GameBoard({ gameState, playerIndex, onDraw, onDiscard, onClaim, onPass, onForceDraw, actionAvailable, isTestRoom, onResetTestRoom, message }) {
  const [selectedTile, setSelectedTile] = useState(null);
  const [selectedChowOption, setSelectedChowOption] = useState(null);
  const [recentlyDiscarded, setRecentlyDiscarded] = useState(false);
  const [drawLocked, setDrawLocked] = useState(false);
  const [winnerVisible, setWinnerVisible] = useState(false);

  const hasState =
    gameState &&
    Array.isArray(gameState.hand) &&
    Array.isArray(gameState.melds) &&
    Array.isArray(gameState.players);

  const safeHand = hasState ? gameState.hand : [];
  const safeMelds = hasState ? gameState.melds : [[], [], [], []];
  const safePlayers = hasState ? gameState.players : [];
  const safeCurrentTurn = hasState ? gameState.currentTurn : 0;
  const safeLastDiscard = hasState ? gameState.lastDiscard : null;

  const serverSaysMyTurn = hasState && safeCurrentTurn === playerIndex;
  const meldTileCount = (safeMelds[playerIndex] || []).reduce(
    (sum, meld) => sum + (meld?.tiles?.length || 0),
    0
  );
  const totalTilesHeld = safeHand.length + meldTileCount;
  const effectiveMyTurn = serverSaysMyTurn && !recentlyDiscarded;
  const canDraw = effectiveMyTurn && totalTilesHeld === 13 && !safeLastDiscard;
  const canDiscard = serverSaysMyTurn && totalTilesHeld === 14;
  const canForceDraw = serverSaysMyTurn && !canDraw && !canDiscard;
  const drawButtonEnabled = (canDraw || canForceDraw) && !drawLocked;
  
  // Debug logging
  console.log(
    `GameBoard Debug: hasState=${hasState}, serverTurn=${serverSaysMyTurn}, effectiveMyTurn=${effectiveMyTurn}, hand.length=${safeHand.length}, meldTileCount=${meldTileCount}, totalTiles=${totalTilesHeld}, canDraw=${canDraw}, canDiscard=${canDiscard}, lastDiscard=${safeLastDiscard ? safeLastDiscard.tile : 'none'}, currentTurn=${safeCurrentTurn}, playerIndex=${playerIndex}`
  );

  useEffect(() => {
    if (!canDiscard && selectedTile !== null) {
      setSelectedTile(null);
    }
  }, [canDiscard, selectedTile]);

  useEffect(() => {
    if (!recentlyDiscarded) {
      return;
    }

    if (!serverSaysMyTurn) {
      setRecentlyDiscarded(false);
      return;
    }

    if (!safeLastDiscard) {
      setRecentlyDiscarded(false);
      return;
    }

    if (safeLastDiscard.playerIndex !== playerIndex) {
      setRecentlyDiscarded(false);
    }
  }, [recentlyDiscarded, serverSaysMyTurn, safeLastDiscard, playerIndex]);

  useEffect(() => {
    if (!canDraw && !canForceDraw) {
      setDrawLocked(false);
    }
  }, [canDraw, canForceDraw]);

  useEffect(() => {
    if (gameState?.winner !== null) {
      setWinnerVisible(true);
    } else {
      setWinnerVisible(false);
    }
  }, [gameState?.winner]);

  if (!hasState) {
    return (
      <div className="game-board">
        <div className="loading">Loading game state...</div>
      </div>
    );
  }

  const handleTileClick = (tile) => {
    if (canDiscard) {
      setSelectedTile(tile);
    }
  };

  const handleDraw = () => {
    if (!drawButtonEnabled) {
      return;
    }

    setDrawLocked(true);

    if (canDraw) {
      onDraw();
    } else if (canForceDraw) {
      onForceDraw();
    }
  };

  const handleDiscard = () => {
    if (selectedTile) {
      onDiscard(selectedTile);
      setSelectedTile(null);
      setRecentlyDiscarded(true);
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
      melds: safeMelds[idx] || [],
      isAI: safePlayers[idx]?.isAI || false,
      name: safePlayers[idx]?.name || `Player ${idx + 1}`
    };
  });

  return (
    <div className="game-board">
      {/* Turn Indicator */}
      <div className="turn-indicator">
        <div className="turn-info">
          {effectiveMyTurn ? (
            <span className="your-turn">🎯 Your Turn</span>
          ) : (
            <span className="waiting">
              Waiting for Player {gameState.currentTurn + 1}
            </span>
          )}
          <span className="wall-count">Wall: {gameState.wallRemaining} tiles</span>
        </div>
        
        {isTestRoom && (
          <div className="test-controls">
            <button 
              className="reset-test-btn"
              onClick={onResetTestRoom}
              title="Reset test room with new hands"
            >
              🔄 Reset Game
            </button>
            <button
              className="test-win-btn"
              onClick={() => {
                setWinnerVisible(true);
                if (typeof gameState.winner !== 'number') {
                  gameState.winner = playerIndex;
                }
              }}
              title="Show win overlay"
            >
              🏆 Show Win
            </button>
          </div>
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
          drawEnabled={drawButtonEnabled}
          drawLabel={canForceDraw ? '⚙️ Force Draw' : '🎴 Draw'}
          canDiscard={canDiscard && selectedTile !== null}
          onDraw={handleDraw}
          onDiscard={handleDiscard}
          actionAvailable={actionAvailable}
          onClaim={handleClaim}
          onPass={onPass}
          selectedChowOption={selectedChowOption}
          onSelectChowOption={setSelectedChowOption}
        />
      </div>

      {winnerVisible && gameState.winner !== null && (
        <div
          className="winner-overlay"
          onClick={() => setWinnerVisible(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setWinnerVisible(false);
            }
          }}
        >
          <div className="winner-card">
            <h2>🎉 Game Over! 🎉</h2>
            <p className="winner-text">
              {gameState.winner === playerIndex
                ? 'You Win!'
                : `Player ${gameState.winner + 1} Wins!`}
            </p>
            <p className="winner-dismiss">Click anywhere to continue</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameBoard;

