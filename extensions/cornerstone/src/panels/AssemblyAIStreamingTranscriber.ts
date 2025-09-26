type TranscriptCallback = (text: string, isFinal: boolean) => void;
type CommandCallback = (command: string) => void;
type ErrorCallback = (error: string) => void;

interface AssemblyAIConfig {
  apiKey: string;
  endpoint: string;
  params: {
    sample_rate: number;
    format_turns: boolean;
  };
}

export default class AssemblyAIStreamingTranscriber {
  private onTranscript: TranscriptCallback;
  private onCommand: CommandCallback;
  private onError: ErrorCallback;

  private ws: WebSocket | null = null;
  public isRecording: boolean = false;
  private config: AssemblyAIConfig | null = null;
  private mediaStream: MediaStream | null = null;
  public audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  // After executing a voice command, temporarily suppress residual ASR turns
  private suppressUntilEpochMs: number = 0;

  // Voice commands that should trigger cursor movement
  private readonly voiceCommands = {
    'next line': 'nextLine',
    'next paragraph': 'nextParagraph',
    'go to next line': 'nextLine',
    'go to next paragraph': 'nextParagraph',
    'move to next line': 'nextLine',
    'move to next paragraph': 'nextParagraph',
    // punctuation
    comma: 'comma',
    'full stop': 'period',
    'question mark': 'question',
    period: 'period',
    exclamation: 'exclamation',
    colon: 'colon',
    semicolon: 'semicolon',
    dash: 'dash',
    hyphen: 'hyphen',
    asterisk: 'asterisk',
  };

  // Commands that must be exact matches (no substring detection)
  private readonly exactOnlyPhrases: Set<string> = new Set([
    'comma',
    'full stop',
    'question mark',
    'period',
    'exclamation',
    'colon',
    'semicolon',
    'dash',
    'hyphen',
    'asterisk',
  ]);

  constructor(
    onTranscript: TranscriptCallback,
    onError: ErrorCallback,
    onCommand?: CommandCallback
  ) {
    this.onTranscript = onTranscript;
    this.onCommand = onCommand || (() => {});
    this.onError = onError;
  }

  async start(): Promise<void> {
    try {
      console.log('🎤 Starting AssemblyAI Universal Streaming...');

      const configResponse = await fetch('/api/assemblyai/config');
      if (!configResponse.ok) {
        throw new Error(`Config request failed: ${configResponse.status}`);
      }

      this.config = await configResponse.json();
      console.log('✅ Got streaming configuration');

      const queryParams = new URLSearchParams({
        sample_rate: this.config.params.sample_rate.toString(),
        format_turns: this.config.params.format_turns.toString(),
        token: this.config.apiKey,
      });

      const wsUrl = `${this.config.endpoint}?${queryParams.toString()}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🎤 WebSocket connected');
        this.startRecording();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'Begin') {
            console.log(`🟢 Session started: ${data.id}`);
          } else if (data.type === 'PartialTranscript') {
            if (data.text?.trim()) {
              console.log('🔄 Partial:', data.text);
            }
          } else if (data.type === 'FinalTranscript') {
            if (data.text?.trim()) {
              console.log('✅ Final:', data.text);
              const command = this.detectVoiceCommand(data.text);
              if (command) {
                console.log('🎯 Voice command detected:', command);
                this.onCommand(command);
                // Suppress residual ASR turns briefly
                this.suppressUntilEpochMs = Date.now() + 800;
              } else {
                if (Date.now() >= this.suppressUntilEpochMs) {
                  this.onTranscript(data.text, true);
                } else {
                  console.log('⏸️ Suppressed residual transcript (FinalTranscript).');
                }
              }
            }
          } else if (data.type === 'Turn') {
            if (data.turn_is_formatted && data.transcript?.trim()) {
              console.log('🎯 Turn:', data.transcript);
              const command = this.detectVoiceCommand(data.transcript);
              if (command) {
                console.log('🎯 Voice command detected in Turn:', command);
                this.onCommand(command);
                this.suppressUntilEpochMs = Date.now() + 800;
              } else {
                if (Date.now() >= this.suppressUntilEpochMs) {
                  this.onTranscript(data.transcript, true);
                } else {
                  console.log('⏸️ Suppressed residual transcript (Turn).');
                }
              }
            }
          } else if (data.type === 'Termination') {
            console.log(`🛑 Session ended after ${data.audio_duration_seconds}s`);
          } else if (data.type === 'Error') {
            this.onError(`AssemblyAI error: ${data.error}`);
            console.error('❌ WebSocket error:', data.error);
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      this.ws.onerror = (event: Event) => {
        console.error('WebSocket error', event);
        this.onError('WebSocket connection error');
      };

      this.ws.onclose = (event: CloseEvent) => {
        console.log('🛑 WebSocket closed', event.code, event.reason);
        this.stopRecording();
      };
    } catch (err: any) {
      console.error('Streaming start error:', err);
      this.onError(`Failed to start streaming: ${err.message}`);
    }
  }

  private async startRecording(): Promise<void> {
    try {
      console.log('🎙️ Accessing microphone...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          const input = event.inputBuffer.getChannelData(0);
          const int16Array = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const sample = Math.max(-1, Math.min(1, input[i]));
            int16Array[i] = sample * 0x7fff;
          }
          this.ws.send(int16Array.buffer);
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isRecording = true;
      console.log('✅ Recording started');
    } catch (err: any) {
      this.onError(`Failed to access microphone: ${err.message}`);
      console.error('Mic access error:', err);
    }
  }

  public stopRecording(): void {
    console.log('🎙️ Stopping recording...');

    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Track stopped: ${track.kind}`);
      });
    }

    this.audioContext = null;
    this.mediaStream = null;
    this.isRecording = false;
  }

  private detectVoiceCommand(text: string): string | null {
    const lowerText = text.toLowerCase().trim();
    // Remove trailing punctuation for comparison (prevents 'semicolon.' from matching 'colon')
    const normalized = lowerText.replace(/[.,!?;:*/\-]+$/g, '').trim();
    console.log('🔍 Checking for voice command in:', lowerText);

    // 1) Exact-match check for punctuation and sensitive words
    for (const phrase of this.exactOnlyPhrases) {
      if (normalized === phrase) {
        const command = this.voiceCommands[phrase as keyof typeof this.voiceCommands];
        console.log('✅ Exact-only match:', phrase, '->', command);
        return command;
      }
    }

    // 2) General exact match for remaining commands
    for (const [phrase, command] of Object.entries(this.voiceCommands)) {
      if (!this.exactOnlyPhrases.has(phrase) && normalized === phrase) {
        console.log('✅ Exact match found:', phrase, '->', command);
        return command;
      }
    }

    // 3) Substring fallback only for navigation commands
    for (const [phrase, command] of Object.entries(this.voiceCommands)) {
      if (!this.exactOnlyPhrases.has(phrase)) {
        if (command === 'nextLine' || command === 'nextParagraph') {
          // Use word boundaries to avoid matching inside other words
          const boundaryRegex = new RegExp(`\\b${this.escapeRegExp(phrase)}\\b`);
          if (boundaryRegex.test(normalized)) {
            console.log('✅ Partial match found:', phrase, '->', command);
            return command;
          }
        }
      }
    }

    console.log('❌ No voice command detected');
    return null;
  }

  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  public stop(): void {
    console.log('🛑 Stopping AssemblyAI stream');
    this.stopRecording();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'Terminate' }));
      this.ws.close();
    }

    this.ws = null;
    this.config = null;
  }
}
