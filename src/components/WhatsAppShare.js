import React, { useState } from 'react';
import { useBusiness } from '../lib/BusinessContext';
import { 
  buildWhatsAppUrl, 
  buildInvoiceWhatsAppMessage, 
  buildPaymentReminderMessage, 
  buildThankYouMessage 
} from '../lib/utils';

function WhatsAppShare({ 
  invoice, 
  customer, 
  phone, 
  messageType = 'invoice', 
  customMessage = null,
  buttonLabel = 'Share on WhatsApp',
  buttonClassName = 'whatsapp-button'
}) {
  const { business_name, currency } = useBusiness();
  const [showMenu, setShowMenu] = useState(false);

  const getMessage = (type = messageType) => {
    if (customMessage) return customMessage;
    
    switch (type) {
      case 'invoice':
        return buildInvoiceWhatsAppMessage(invoice, customer, business_name, currency);
      case 'reminder':
        return buildPaymentReminderMessage(invoice, customer, business_name, currency);
      case 'thankyou':
        return buildThankYouMessage(invoice, customer, business_name, currency);
      default:
        return customMessage || '';
    }
  };

  const handleShare = (type) => {
    const message = getMessage(type);
    const phoneNumber = phone || customer?.phone;
    if (phoneNumber && message) {
      const url = buildWhatsAppUrl(phoneNumber, message);
      window.open(url, '_blank');
    }
    setShowMenu(false);
  };

  const messageTypes = [
    { id: 'invoice', label: '📄 Send Invoice', icon: '📄' },
    { id: 'reminder', label: '⏰ Payment Reminder', icon: '⏰' },
    { id: 'thankyou', label: '🙏 Thank You', icon: '🙏' },
  ];

  return (
    <div className="whatsapp-share-container">
      <button
        className={buttonClassName}
        onClick={() => {
          if (messageType === 'custom' || customMessage) {
            handleShare();
          } else {
            setShowMenu(!showMenu);
          }
        }}
        type="button"
      >
        <span className="whatsapp-icon">📱</span>
        {buttonLabel}
      </button>

      {showMenu && (
        <div className="whatsapp-menu">
          <div className="whatsapp-menu-header">
            <span>Choose Message Type</span>
            <button 
              className="close-menu" 
              onClick={() => setShowMenu(false)}
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="whatsapp-menu-items">
            {messageTypes.map((type) => (
              <button
                key={type.id}
                className="whatsapp-menu-item"
                onClick={() => handleShare(type.id)}
                type="button"
              >
                <span className="menu-icon">{type.icon}</span>
                <span className="menu-label">{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsAppShare;
