import React, { useEffect, useRef } from 'react';

export function BannerAd() {
  const bannerRef = useRef(null);

  useEffect(() => {
    if (bannerRef.current && !bannerRef.current.firstChild) {
      const conf = document.createElement('script');
      conf.type = 'text/javascript';
      conf.innerHTML = `atOptions = {'key' : 'c5d1fb6d0b482d9418432b9d7446b16e','format' : 'iframe','height' : 250,'width' : 300,'params' : {}};`;
      bannerRef.current.appendChild(conf);

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://www.highperformanceformat.com/c5d1fb6d0b482d9418432b9d7446b16e/invoke.js';
      bannerRef.current.appendChild(script);
    }
  }, []);

  return <div ref={bannerRef} style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}></div>;
}

export function NativeAd() {
  const bannerRef = useRef(null);

  useEffect(() => {
    if (bannerRef.current && !bannerRef.current.firstChild) {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.dataset.cfasync = 'false';
      script.src = 'https://pl30327897.effectivecpmnetwork.com/787bd0ccaf5fc32eb262022b81c76e7e/invoke.js';
      bannerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div style={{ margin: '20px 0', textAlign: 'center' }}>
      <div ref={bannerRef}></div>
      <div id="container-787bd0ccaf5fc32eb262022b81c76e7e"></div>
    </div>
  );
}
