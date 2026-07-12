import React, { useEffect, useRef } from 'react';

export function BannerAd() {
  const bannerRef = useRef(null);

  useEffect(() => {
    if (bannerRef.current && !bannerRef.current.firstChild) {
      const conf = document.createElement('script');
      conf.type = 'text/javascript';
      conf.innerHTML = `atOptions = {'key' : 'c7d2f4d417b67d8e041cb73f91fc4241','format' : 'iframe','height' : 50,'width' : 320,'params' : {}};`;
      bannerRef.current.appendChild(conf);

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://www.highperformanceformat.com/c7d2f4d417b67d8e041cb73f91fc4241/invoke.js';
      bannerRef.current.appendChild(script);
    }
  }, []);

  return <div ref={bannerRef} style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}></div>;
}

export function NativeAd() {
  const bannerRef = useRef(null);

  useEffect(() => {
    if (bannerRef.current && !bannerRef.current.firstChild) {
      const conf = document.createElement('script');
      conf.type = 'text/javascript';
      conf.innerHTML = `atOptions = {'key' : '4103aecec2220fa5ea0bb8bdad9fa5be','format' : 'iframe','height' : 300,'width' : 160,'params' : {}};`;
      bannerRef.current.appendChild(conf);

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://www.highperformanceformat.com/4103aecec2220fa5ea0bb8bdad9fa5be/invoke.js';
      bannerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
      <div ref={bannerRef}></div>
    </div>
  );
}
