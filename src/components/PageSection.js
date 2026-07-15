import React from 'react';

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
        {actions ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div className="page-header-actions">{actions}</div>
          </div>
        ) : null}
      </header>
      <section className="page-section">
        {children}
      </section>
    </>
  );
}

export default PageSection;
