import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function ContactUs() {
  const [status, setStatus] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus('Thanks for contacting us! We will get back to you soon.');
    e.target.reset();
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'Inter, sans-serif', lineHeight: '1.6', color: '#333' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: '20px', color: '#1a56db', textDecoration: 'none', fontWeight: 'bold' }}>
        &larr; Back to Home
      </Link>
      <h1 style={{ color: '#1a56db', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>Contact Us</h1>
      
      <p>Have any questions? We'd love to hear from you.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '30px' }}>
        <div>
          <h3>Get in Touch</h3>
          <p><strong>Email:</strong> your-email@gmail.com</p>
          <p><strong>Business Hours:</strong> Monday - Friday, 9:00 AM - 6:00 PM</p>
          <p>Whether you have a question about features, trials, pricing, need a demo, or anything else, our team is ready to answer all your questions.</p>
        </div>

        <div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Name</label>
              <input type="text" required style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} placeholder="Your Name" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email</label>
              <input type="email" required style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} placeholder="your@email.com" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Message</label>
              <textarea required rows="4" style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} placeholder="How can we help?"></textarea>
            </div>
            <button type="submit" style={{ padding: '12px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              Send Message
            </button>
            {status && <p style={{ color: 'green', marginTop: '10px' }}>{status}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

export default ContactUs;
