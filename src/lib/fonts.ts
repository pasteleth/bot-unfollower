import { Inter } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

// For direct use in frame HTML
export const getInterCssUrl = () => {
  return 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
};

// Get CSS for directly embedding in a Frame HTML
export const getInterCss = () => {
  return `
    /* Inter font styles */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    /* Font fallback system */
    :root {
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    
    body {
      font-family: var(--font-sans);
    }
  `;
}; 