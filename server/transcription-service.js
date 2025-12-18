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
  // transcription-service.js - Add silence padding

  async startTranscription(callId, speaker, onTranscript) {
    console.log(`\n🎙️ ========== STARTING TRANSCRIPTION ==========`);
    console.log(`   Call ID: ${callId}`);
    console.log(`   Speaker: ${speaker}`);
    console.log(`==============================================\n`);

    const audioStream = new PassThrough({ highWaterMark: 1024 * 16 });
    let isClosed = false;
    let chunkCount = 0;
    let lastAudioTime = Date.now();

    // ✅ Send silence every 100ms to keep stream alive
    const silenceInterval = setInterval(() => {
      if (!isClosed && !audioStream.destroyed) {
        const timeSinceLastAudio = Date.now() - lastAudioTime;

        // If no audio received for 100ms, send silence
        if (timeSinceLastAudio > 100) {
          const silenceBuffer = Buffer.alloc(320); // 20ms of silence at 16kHz
          audioStream.write(silenceBuffer);
        }
      } else {
        clearInterval(silenceInterval);
      }
    }, 100);

    const audioGenerator = async function* () {
      try {
        for await (const chunk of audioStream) {
          if (chunk && chunk.length > 0) {
            chunkCount++;
            lastAudioTime = Date.now(); // Update last audio time

            if (chunkCount === 1) {
              console.log(
                `✅ First audio chunk sent to AWS Transcribe for ${speaker}`
              );
              console.log(`   Chunk size: ${chunk.length} bytes`);
            }
            if (chunkCount % 50 === 0) {
              console.log(`📊 Sent ${chunkCount} chunks to AWS for ${speaker}`);
            }
            yield { AudioEvent: { AudioChunk: chunk } };
          }
        }
      } catch (error) {
        if (!isClosed) {
          console.error(
            `❌ Error in audio generator for ${speaker}: `,
            error.message
          );
        }
      } finally {
        clearInterval(silenceInterval);
      }
    };

    const params = {
      LanguageCode: "en-US",
      MediaEncoding: "pcm",
      MediaSampleRateHertz: 16000,
      AudioStream: audioGenerator(),
      EnablePartialResultsStabilization: true,
      PartialResultsStability: "high",
    };

    try {
      console.log(
        `🚀 Sending StartStreamTranscriptionCommand for ${speaker}...`
      );
      const command = new StartStreamTranscriptionCommand(params);
      const response = await this.client.send(command);

      console.log(`✅ AWS Transcribe stream started for ${speaker}`);

      this.processTranscriptionEvents(
        response.TranscriptResultStream,
        callId,
        speaker,
        onTranscript
      ).catch((error) => {
        if (!isClosed) {
          console.error(
            `❌ Transcription processing error for ${speaker}:`,
            error.message
          );
        }
      });

      return {
        stream: audioStream,
        close: () => {
          if (!isClosed) {
            console.log(
              `🛑 Closing transcription for ${speaker} in call ${callId}`
            );
            console.log(`   Total chunks sent: ${chunkCount}`);
            isClosed = true;
            clearInterval(silenceInterval);

            if (!audioStream.destroyed) {
              audioStream.end();
            }
          }
        },
      };
    } catch (error) {
      console.error(
        `❌ Error starting transcription for ${speaker}:`,
        error.message
      );
      clearInterval(silenceInterval);

      if (!audioStream.destroyed) {
        audioStream.destroy();
      }

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
