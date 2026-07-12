import React from 'react';
import { Link } from 'react-router-dom';

function AboutUs() {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'Inter, sans-serif', lineHeight: '1.6', color: '#333' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: '20px', color: '#1a56db', textDecoration: 'none', fontWeight: 'bold' }}>
        &larr; Back to Home
      </Link>
      <h1 style={{ color: '#1a56db', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>About Us</h1>
      
      <p>Welcome to <strong>KhataPe</strong>, your number one source for all things related to cloud-based billing, invoicing, and inventory management. We're dedicated to giving you the very best platform, with a focus on dependability, customer service, and uniqueness.</p>
      
      <h2>Our Mission</h2>
      <p>Our mission is to simplify business operations for small and medium enterprises. We believe that managing invoices, tracking expenses, and maintaining inventory should not be a complex or time-consuming task. KhataPe provides an intuitive, easy-to-use interface that empowers business owners to take control of their finances effortlessly.</p>
      
      <h2>What We Offer</h2>
      <ul>
        <li><strong>Smart Invoicing:</strong> Create professional GST/Non-GST invoices in seconds and share them with clients easily.</li>
        <li><strong>Inventory Management:</strong> Track your stock levels in real-time, get low-stock alerts, and manage product variants seamlessly.</li>
        <li><strong>Expense Tracking:</strong> Keep a close eye on your outgoing cash flow to maximize profitability.</li>
        <li><strong>Comprehensive Analytics:</strong> View live app stats, sales trends, and deep analytics to make informed business decisions.</li>
      </ul>

      <h2>Why Choose Us?</h2>
      <p>We now serve customers all over the country and are thrilled to be a part of the quirky, eco-friendly, fair trade wing of the tech industry. We hope you enjoy our products as much as we enjoy offering them to you.</p>

      <p>If you have any questions or comments, please don't hesitate to contact us.</p>

      <p>Sincerely,<br /><strong>The KhataPe Team</strong></p>
    </div>
  );
}

export default AboutUs;
