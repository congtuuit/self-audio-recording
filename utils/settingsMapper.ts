/**
 * Utility functions to map between client-side flat settings
 * and server-side nested settings structure
 */

export interface ClientSettings {
  whisperKey?: string;
  openaiKey?: string;
  geminiKey?: string;
  geminiModel?: string;
  openaiModel?: string;
  sampleRate?: number;
  autoGain?: boolean;
  providerPreference?: 'auto' | 'gemini' | 'openai' | 'local' | 'custom';
  customEndpointUrl?: string;
  customEndpointKey?: string;
  customEndpointModel?: string;
  uiLanguage?: 'vi' | 'en';
}

export interface ServerSettings {
  ai: {
    providerPreference: string;
    openai: {
      apiKey: string;
      model: string;
      whisperKey: string;
    };
    gemini: {
      apiKey: string;
      model: string;
    };
    custom: {
      endpointUrl: string;
      apiKey: string;
      model: string;
    };
  };
  audio: {
    sampleRate: number;
    autoGain: boolean;
  };
  ui: {
    language: string;
  };
}

/**
 * Map flat client settings to nested server settings structure
 */
export function mapClientToServerSettings(client: ClientSettings): ServerSettings {
  return {
    ai: {
      providerPreference: client.providerPreference || 'openai',
      openai: {
        apiKey: client.openaiKey || '',
        model: client.openaiModel || 'gpt-4o-mini',
        whisperKey: client.whisperKey || client.openaiKey || ''
      },
      gemini: {
        apiKey: client.geminiKey || '',
        model: client.geminiModel || 'gemini-2.0-flash'
      },
      custom: {
        endpointUrl: client.customEndpointUrl || '',
        apiKey: client.customEndpointKey || '',
        model: client.customEndpointModel || ''
      }
    },
    audio: {
      sampleRate: Number(client.sampleRate) || 44100,
      autoGain: client.autoGain !== undefined ? Boolean(client.autoGain) : true
    },
    ui: {
      language: client.uiLanguage || 'vi'
    }
  };
}

/**
 * Map nested server settings to flat client settings structure
 */
export function mapServerToClientSettings(server: ServerSettings): ClientSettings {
  return {
    providerPreference: (server.ai?.providerPreference as any) || 'auto',
    openaiKey: server.ai?.openai?.apiKey || '',
    whisperKey: server.ai?.openai?.whisperKey || server.ai?.openai?.apiKey || '',
    openaiModel: server.ai?.openai?.model || 'gpt-4o-mini',
    geminiKey: server.ai?.gemini?.apiKey || '',
    geminiModel: server.ai?.gemini?.model || 'gemini-2.0-flash',
    customEndpointUrl: server.ai?.custom?.endpointUrl || '',
    customEndpointKey: server.ai?.custom?.apiKey || '',
    customEndpointModel: server.ai?.custom?.model || '',
    sampleRate: server.audio?.sampleRate || 44100,
    autoGain: server.audio?.autoGain !== undefined ? server.audio.autoGain : true,
    uiLanguage: (server.ui?.language as 'vi' | 'en') || 'vi'
  };
}
