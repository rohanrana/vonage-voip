// transcription-service.js
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import { PassThrough } from "stream";

class TranscriptionService {
  constructor(region, accessKeyId, secretAccessKey) {
    this.client = new TranscribeStreamingClient({
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  }

  /**
   * Start transcription for a stream
   * @param {string} callId - Unique call identifier
   * @param {string} speaker - 'phone' or 'browser'
   * @param {function} onTranscript - Callback for transcription results
   * @returns {object} - Stream and close function
   */
  async startTranscription(callId, speaker, onTranscript) {
    console.log(`🎙️ Starting transcription for ${speaker} in call ${callId}`);

    // Create a PassThrough stream for audio data
    const audioStream = new PassThrough();

    // Audio stream generator for AWS
    const audioGenerator = async function* () {
      for await (const chunk of audioStream) {
        yield { AudioEvent: { AudioChunk: chunk } };
      }
    };

    const params = {
      LanguageCode: "en-US",
      MediaEncoding: "pcm",
      MediaSampleRateHertz: 16000,
      AudioStream: audioGenerator(),
    };

    try {
      const command = new StartStreamTranscriptionCommand(params);
      const response = await this.client.send(command);

      console.log(`✅ Transcription stream started for ${speaker}`);

      // Process transcription results
      this.processTranscriptionEvents(
        response.TranscriptResultStream,
        callId,
        speaker,
        onTranscript
      );

      return {
        stream: audioStream,
        close: () => {
          console.log(
            `🛑 Closing transcription for ${speaker} in call ${callId}`
          );
          audioStream.end();
        },
      };
    } catch (error) {
      console.error(`❌ Error starting transcription for ${speaker}:`, error);
      throw error;
    }
  }

  async processTranscriptionEvents(
    transcriptStream,
    callId,
    speaker,
    onTranscript
  ) {
    try {
      for await (const event of transcriptStream) {
        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript.Results;

          for (const result of results) {
            if (result.Alternatives && result.Alternatives.length > 0) {
              const transcript = result.Alternatives[0].Transcript;
              const isPartial = !result.IsPartial;

              if (transcript && transcript.trim().length > 0) {
                console.log(
                  `📝 [${speaker}] ${
                    isPartial ? "FINAL" : "PARTIAL"
                  }: ${transcript}`
                );

                // Call the callback with transcription data
                onTranscript({
                  callId,
                  speaker,
                  transcript,
                  isFinal: isPartial,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error processing transcription events: `, error);
    }
  }
}

export default TranscriptionService;
