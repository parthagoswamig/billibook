import React from 'react';
import { Link } from 'react-router-dom';

function TermsAndConditions() {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'Inter, sans-serif', lineHeight: '1.6', color: '#333' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: '20px', color: '#1a56db', textDecoration: 'none', fontWeight: 'bold' }}>
        &larr; Back to Home
      </Link>
      <h1 style={{ color: '#1a56db', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>Terms and Conditions</h1>
      <p><strong>Effective Date:</strong> {new Date().toISOString().slice(0,10)}</p>

      <h2>1. Agreement to Terms</h2>
      <p>By accessing or using KhataPe (the "Service"), you agree to be bound by these Terms and Conditions. If you disagree with any part of the terms, then you may not access the Service.</p>

      <h2>2. Intellectual Property</h2>
      <p>The Service and its original content, features, and functionality are and will remain the exclusive property of KhataPe and its licensors. The Service is protected by copyright, trademark, and other laws of both the country and foreign countries.</p>

      <h2>3. User Accounts</h2>
      <p>When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.</p>

      <h2>4. Prohibited Uses</h2>
      <p>You may use Service only for lawful purposes and in accordance with Terms. You agree not to use Service:</p>
      <ul>
        <li>In any way that violates any applicable national or international law or regulation.</li>
        <li>To engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Service, or which, as determined by us, may harm the Company or users of the Service or expose them to liability.</li>
      </ul>

      <h2>5. Links to Other Web Sites</h2>
      <p>Our Service may contain links to third-party web sites or services that are not owned or controlled by KhataPe. KhataPe has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party web sites or services.</p>

      <h2>6. Changes to Terms</h2>
      <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>

      <h2>7. Contact Us</h2>
      <p>If you have any questions about these Terms, please contact us at parthagoswamig@gmail.com.</p>
    </div>
  );
}

export default TermsAndConditions;
