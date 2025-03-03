import { Frog } from 'frog';
import { handle } from 'frog/next';

// Create a new Frog instance
const app = new Frog({
  assetsPath: '/api/dev',
  basePath: '/api/dev',
  // This will proxy requests to your existing frame endpoint
  // for validation and testing
  browserLocation: '/api/frame',
});

// Define the frame that will be used for validation
app.frame('/', (c) => {
  const { buttonValue, inputText, status } = c;
  
  // Display different messages based on user interaction
  const message = buttonValue
    ? `You clicked: ${buttonValue}`
    : inputText
    ? `You entered: ${inputText}`
    : 'Welcome to the Frame Validator!';

  return c.res({
    image: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/frame_image.png`,
    intents: [
      { type: 'button', value: 'validate', label: 'Validate Frame' },
      { type: 'button', value: 'test', label: 'Test Frame' },
      { type: 'text_input', placeholder: 'Enter your FID' },
    ],
    text: message,
  });
});

// Export the Next.js route handler
export const GET = handle(app);
export const POST = handle(app); 