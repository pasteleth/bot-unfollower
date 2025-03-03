declare module '@farcaster/frame-sdk' {
  export interface FrameContext {
    user: {
      fid: number;
      username?: string;
      displayName?: string;
      pfp?: string;
    };
  }

  export interface FrameActions {
    addFrame: () => Promise<void>;
    ready: () => void;
  }

  interface FrameSDK {
    context: Promise<FrameContext>;
    actions: FrameActions;
  }

  const sdk: FrameSDK;
  export default sdk;
} 