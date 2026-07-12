import React from 'react';
import { Link } from 'react-router-dom';

function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'Inter, sans-serif', lineHeight: '1.6', color: '#333' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: '20px', color: '#1a56db', textDecoration: 'none', fontWeight: 'bold' }}>
        &larr; Back to Home
      </Link>
      <h1 style={{ color: '#1a56db', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>Privacy Policy</h1>
      <p><strong>Effective Date:</strong> {new Date().toISOString().slice(0,10)}</p>
      
      <p>Welcome to KhataPe ("we", "our", or "us"). We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about our policy, or our practices with regards to your personal information, please contact us.</p>

      <h2>1. Information We Collect</h2>
      <p>We collect personal information that you voluntarily provide to us when you register on the KhataPe platform, express an interest in obtaining information about us or our products and services, or otherwise when you contact us. This includes your name, email address, phone number, and business details.</p>

      <h2>2. How We Use Your Information</h2>
      <p>We use personal information collected via our platform for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.</p>

      <h2>3. Third-Party Advertisements (Google AdSense)</h2>
      <p>We use third-party advertising companies, including Google, to serve ads when you visit our Website/App. These companies may use information about your visits to this and other Web sites in order to provide advertisements about goods and services of interest to you.</p>
      <ul>
        <li>Google, as a third-party vendor, uses cookies to serve ads on our site.</li>
        <li>Google's use of the DART cookie enables it to serve ads to our users based on their visit to our site and other sites on the Internet.</li>
        <li>Users may opt out of the use of the DART cookie by visiting the Google ad and content network privacy policy.</li>
      </ul>

      <h2>4. Cookies and Web Beacons</h2>
      <p>We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information. Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Policy.</p>

      <h2>5. Security of Your Information</h2>
      <p>We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.</p>

      <h2>6. Contact Us</h2>
      <p>If you have questions or comments about this policy, you may email us at your-email@gmail.com.</p>
    </div>
  );
}

export default PrivacyPolicy;
