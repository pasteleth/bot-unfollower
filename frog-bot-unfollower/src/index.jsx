import pkg from 'frog';
const { Button, Frog } = pkg;
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';

// Create a new Frog app
export const app = new Frog({
  assetsPath: '/',
  basePath: '/',
});

// Define the main frame route
app.frame('/', (c) => {
  const { buttonValue, status } = c;
  
  // Initial frame
  if (!status) {
    return c.res({
      image: '/assets/scanner-start.png',
      imageAspectRatio: '1.91:1',
      intents: [
        <Button value="scan">Scan My Following List</Button>
      ],
    });
  }
  
  // Handle the scan button click
  if (buttonValue === 'scan') {
    return c.res({
      image: ({ url }) => {
        return (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#1E1E1E',
            color: 'white',
            padding: '20px',
            fontFamily: 'sans-serif'
          }}>
            <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Scan Complete!</h1>
            <p style={{ fontSize: '16px', textAlign: 'center' }}>
              We've analyzed your following list and found potential bots.
            </p>
          </div>
        );
      },
      intents: [
        <Button value="results">View Results</Button>
      ],
    });
  }
  
  // Handle the results button click
  if (buttonValue === 'results') {
    return c.res({
      image: ({ url }) => {
        return (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#1E1E1E',
            color: 'white',
            padding: '20px',
            fontFamily: 'sans-serif'
          }}>
            <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Bot Detection Results</h1>
            <p style={{ fontSize: '16px', textAlign: 'center' }}>
              3 potential bots detected in your following list.
            </p>
            <ul style={{ fontSize: '14px', textAlign: 'left', marginTop: '10px' }}>
              <li>High spam score: 2 accounts</li>
              <li>High AI score: 1 account</li>
            </ul>
          </div>
        );
      },
      intents: [
        <Button value="restart">Scan Again</Button>
      ],
    });
  }
  
  // Handle the restart button click
  if (buttonValue === 'restart') {
    return c.res({
      image: '/assets/scanner-start.png',
      imageAspectRatio: '1.91:1',
      intents: [
        <Button value="scan">Scan My Following List</Button>
      ],
    });
  }
});

// Serve static assets
app.use('/*', serveStatic({ root: './src' }));

// Start the server
const port = process.env.PORT || 3000;
console.log(`Server running at http://localhost:${port}`);
serve({
  fetch: app.fetch,
  port,
}); 