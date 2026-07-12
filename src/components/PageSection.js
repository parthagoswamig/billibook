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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {actions ? <div className="page-header-actions">{actions}</div> : null}
          <a 
            href="https://www.effectivecpmnetwork.com/q8kxujad2?key=6b17e45207e4f3df9e6653b05155503d" 
            target="_blank" 
            rel="noreferrer" 
            style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              color: '#db2777', 
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#fce7f3',
              padding: '6px 12px',
              borderRadius: '20px',
              boxShadow: '0 2px 4px rgba(219, 39, 119, 0.1)',
              border: '1px solid #fbcfe8',
              whiteSpace: 'nowrap'
            }}
          >
            🎁 Special Offers
          </a>
        </div>
      </header>
      <section className="page-section">
        <NativeAd />
        {children}
        <BannerAd />
      </section>
    </>
  );
}

export default PageSection;
