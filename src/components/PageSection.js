import React from 'react';
import { BannerAd, NativeAd } from './AdsterraAds';

function PageSection({ eyebrow, title, description, actions, children }) {
  return (
    <>
      <header className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">{title}</h2>
          <p className="page-breadcrumb">
            {eyebrow ? `${eyebrow}  /  ` : ''} {description || ''}
          </p>
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </header>
      <section className="page-section">
        <NativeAd />
        {children}
        <BannerAd />
        <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '20px' }}>
          <a href="https://www.effectivecpmnetwork.com/q8kxujad2?key=6b17e45207e4f3df9e6653b05155503d" target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#9ca3af', textDecoration: 'underline' }}>
            Sponsored: View Special Offers
          </a>
        </div>
      </section>
    </>
  );
}

export default PageSection;
