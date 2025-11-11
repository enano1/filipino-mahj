import React from 'react';
import './ProfileWidget.css';

function formatPercentage(numerator, denominator) {
  if (!denominator || denominator === 0) {
    return '0%';
  }
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function ProfileWidget({
  user,
  stats,
  loading,
  onSignOut,
  signingOut,
  showSignOut = true
}) {
  if (!user) {
    return (
      <div className="profile-widget profile-widget--signed-out">
        <h3>Your Mahjong Profile</h3>
        <p>Sign in to start tracking your wins and see how you stack up.</p>
      </div>
    );
  }

  const displayName = user.displayName || user.email || 'Mahjong Player';
  const games = stats?.totalGames || 0;
  const wins = stats?.wins || 0;
  const losses = stats?.losses || 0;
  const lastResult = stats?.lastResult || null;
  const lastRoom = stats?.lastRoom || null;

  return (
    <div className="profile-widget">
      <div className="profile-widget__header">
        {user.photoURL ? (
          <img
            className="profile-widget__avatar"
            src={user.photoURL}
            alt={displayName}
          />
        ) : (
          <div className="profile-widget__avatar profile-widget__avatar--placeholder">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h3>{displayName}</h3>
          <p className="profile-widget__subtitle">
            {user.email || 'Signed in'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="profile-widget__loading">
          <div className="profile-widget__spinner" />
          <p>Loading your stats…</p>
        </div>
      ) : (
        <>
          <div className="profile-widget__stats">
            <div className="profile-widget__stat">
              <span className="profile-widget__stat-label">Games</span>
              <span className="profile-widget__stat-value">{games}</span>
            </div>
            <div className="profile-widget__stat">
              <span className="profile-widget__stat-label">Wins</span>
              <span className="profile-widget__stat-value">{wins}</span>
            </div>
            <div className="profile-widget__stat">
              <span className="profile-widget__stat-label">Losses</span>
              <span className="profile-widget__stat-value">{losses}</span>
            </div>
            <div className="profile-widget__stat">
              <span className="profile-widget__stat-label">Win Rate</span>
              <span className="profile-widget__stat-value">
                {formatPercentage(wins, games)}
              </span>
            </div>
          </div>

          {games > 0 && (
            <div className="profile-widget__footnote">
              <span>
                Last game: {lastResult ? lastResult.toUpperCase() : 'N/A'}
              </span>
              {lastRoom && (
                <span className="profile-widget__room">
                  Room {lastRoom}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {showSignOut && onSignOut && (
        <button
          className="profile-widget__signout"
          onClick={onSignOut}
          disabled={signingOut}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      )}
    </div>
  );
}

export default ProfileWidget;

