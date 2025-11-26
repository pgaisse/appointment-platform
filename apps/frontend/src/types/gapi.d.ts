/**
 * TypeScript declarations for Google API (gapi)
 * This provides type safety for Google Calendar API integration
 */

declare namespace gapi {
  function load(apiName: string, callback: () => void): void;

  namespace auth2 {
    interface GoogleAuth {
      isSignedIn: {
        get(): boolean;
        listen(callback: (isSignedIn: boolean) => void): void;
      };
      signIn(): Promise<void>;
      signOut(): Promise<void>;
    }

    function getAuthInstance(): GoogleAuth;
  }

  namespace client {
    interface InitConfig {
      discoveryDocs: string[];
      clientId: string;
      scope: string;
    }

    function init(config: InitConfig): Promise<void>;

    namespace calendar {
      namespace events {
        interface InsertParams {
          calendarId: string;
          resource: {
            summary: string;
            description?: string;
            start: {
              dateTime: string;
              timeZone: string;
            };
            end: {
              dateTime: string;
              timeZone: string;
            };
            attendees?: Array<{
              email: string;
            }>;
            reminders?: {
              useDefault: boolean;
            };
          };
        }

        interface EventResponse {
          result: {
            id?: string;
            htmlLink?: string;
            summary?: string;
            description?: string;
            start?: {
              dateTime: string;
            };
            end?: {
              dateTime: string;
            };
          };
        }

        function insert(params: InsertParams): Promise<EventResponse>;
        function list(params: {
          calendarId: string;
          timeMin?: string;
          timeMax?: string;
          maxResults?: number;
          singleEvents?: boolean;
          orderBy?: string;
        }): Promise<{
          result: {
            items: Array<{
              id: string;
              summary: string;
              description?: string;
              start: {
                dateTime: string;
              };
              end: {
                dateTime: string;
              };
            }>;
          };
        }>;
      }
    }
  }
}

declare const gapi: typeof gapi;
declare global {
  interface Window {
    gapi: typeof gapi;
  }
}

export {};
