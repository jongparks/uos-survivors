export const SERVER_MESSAGES = {
  welcome: "server:welcome",
} as const;

export interface WelcomeMessage {
  roomId: string;
  sessionId: string;
}

