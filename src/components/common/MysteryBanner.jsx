import React from 'react';

export default function MysteryBanner() {
  return (
    <section className="mystery-banner" aria-labelledby="ghostchat-title">
      <div className="mystery-banner__veil" aria-hidden="true" />
      <div className="mystery-banner__moon" aria-hidden="true" />
      <div className="mystery-banner__mist mystery-banner__mist--one" aria-hidden="true" />
      <div className="mystery-banner__mist mystery-banner__mist--two" aria-hidden="true" />
      <div className="mystery-banner__stars" aria-hidden="true" />
      <div className="mystery-banner__content">
        <div className="mystery-banner__ghost" aria-hidden="true">👻</div>
        <div className="mystery-banner__copy">
          <span className="mystery-banner__kicker">Canal en penumbra</span>
          <h1 id="ghostchat-title" className="mystery-banner__title">GhostChat</h1>
          <p className="mystery-banner__text">
            Salas efimeras y privadas en tiempo real, con presencia P2P y rastro local.
          </p>
        </div>
      </div>
    </section>
  );
}
