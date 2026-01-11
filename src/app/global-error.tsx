'use client';

// This is a global error boundary that doesn't use providers
// to avoid issues during build/prerender
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh',
          padding: '20px',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Une erreur s'est produite</h1>
          <p style={{ marginBottom: '24px', color: '#666' }}>
            Désolé, une erreur inattendue s'est produite.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
