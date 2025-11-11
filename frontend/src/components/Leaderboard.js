import React from 'react';
import './Leaderboard.css';

function Leaderboard({ entries, loading }) {
  return (
    <div className="leaderboard-card">
      <div className="leaderboard-card__header">
        <h3>Leaderboard</h3>
        <span>Top 10 winners</span>
      </div>

      {loading ? (
        <div className="leaderboard-card__loading">
          <div className="leaderboard-card__spinner" />
          <span>Fetching standings…</span>
        </div>
      ) : entries && entries.length > 0 ? (
        <ol className="leaderboard-card__list">
          {entries.map((entry, index) => (
            <li key={entry.id || index} className="leaderboard-card__item">
              <div className="leaderboard-card__rank">#{index + 1}</div>
              <div className="leaderboard-card__player">
                <span className="leaderboard-card__name">
                  {entry.displayName || entry.email || 'Anonymous Player'}
                </span>
                <span className="leaderboard-card__meta">
                  {entry.totalGames || 0} games · {entry.wins || 0} wins
                </span>
              </div>
              <div className="leaderboard-card__stat">
                <span className="leaderboard-card__stat-label">Win %</span>
                <span className="leaderboard-card__stat-value">
                  {entry.winRate ?? '0%'}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="leaderboard-card__empty">
          <p>No games played yet. Be the first to claim the top spot!</p>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;

