// apps/frontend/src/Pages/PublicReviewPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface ReviewData {
  clinicName: string;
  organizationName: string;
  reviewUrl: string;
  patientName: string;
  status: string;
}

// Inline styles for maximum performance (no Chakra UI overhead)
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#F7FAFC',
    padding: '2.5rem 1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '2rem',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: '1rem',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '1.125rem',
    color: '#718096',
    marginBottom: '2rem',
    textAlign: 'center' as const,
  },
  button: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.125rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    transition: 'all 0.2s',
  },
  primaryButton: {
    backgroundColor: '#3182CE',
    color: 'white',
  },
  disclaimer: {
    fontSize: '0.875rem',
    color: '#A0AEC0',
    textAlign: 'center' as const,
    marginTop: '2rem',
    lineHeight: '1.5',
  },
  spinner: {
    textAlign: 'center' as const,
    padding: '4rem 1rem',
  },
  error: {
    backgroundColor: '#FED7D7',
    color: '#C53030',
    padding: '1rem',
    borderRadius: '8px',
    textAlign: 'center' as const,
  },
};

// Cache API URL
const API_URL = import.meta.env.VITE_BASE_URL;

export const PublicReviewPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (!requestId) return;

    // Use fetch instead of axios (lighter, native)
    fetch(`${API_URL}/google-reviews/review-page/${requestId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Review link not found or expired');
        setLoading(false);
      });
  }, [requestId]);

  const handleContinueWithGoogle = () => {
    if (!data?.reviewUrl || !requestId) return;

    // Fire and forget tracking (don't wait for response)
    fetch(`${API_URL}/google-reviews/track-google-click/${requestId}`, {
      method: 'POST',
      keepalive: true, // Send even if page unloads
    }).catch(() => {}); // Ignore errors

    // Immediate redirect
    window.location.href = data.reviewUrl;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p style={{ color: '#718096' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, maxWidth: '500px' }}>
          <div style={styles.error}>
            {error || 'Review link not found or expired'}
          </div>
        </div>
      </div>
    );
  }

  const displayName = data.clinicName || data.organizationName || 'Our Clinic';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ ...styles.icon, textAlign: 'center' }}>⭐</div>
          <h2 style={{ 
            fontSize: '1.25rem', 
            color: '#4A5568', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: '600',
          }}>
            {displayName}
          </h2>
        </div>

        {/* Main Content */}
        <div>
          <h1 style={styles.title}>
            {displayName} has invited you to review their business
          </h1>
          
          <p style={styles.subtitle}>
            Submit your review on Google, or select a different review site
          </p>

          <hr style={{ 
            border: 'none', 
            borderTop: '1px solid #E2E8F0', 
            margin: '2rem 0' 
          }} />

          {/* Continue with Google Button */}
          <button
            style={{
              ...styles.button,
              ...styles.primaryButton,
              backgroundColor: hovering ? '#2C5AA0' : '#3182CE',
            }}
            onClick={handleContinueWithGoogle}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Select Different Site Button */}
          <button
            style={{
              ...styles.button,
              backgroundColor: 'transparent',
              border: '2px solid #E2E8F0',
              color: '#A0AEC0',
              cursor: 'not-allowed',
            }}
            disabled
          >
            Select a different site
          </button>

          {/* Disclaimer */}
          <p style={styles.disclaimer}>
            Google reviews are public forums. Providing feedback about your personal health care in a
            public or private forum is completely optional and voluntary. {displayName} will never
            disclose your healthcare information on public forums. Choosing to leave, or not leave a
            review shall have no impact on the care you receive by {displayName}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicReviewPage;
