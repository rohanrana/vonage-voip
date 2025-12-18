import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";

const client = new TranscribeStreamingClient({
  region: process.env.AWS_REGION,
});

const sessions = new Map();

export function getTranscriber(sessionId, onTranscript) {
  if (sessions.has(sessionId)) return sessions.get(sessionId);

  let audioQueue = [];
  let resolve;

  async function* audioStream() {
    while (true) {
      if (!audioQueue.length) {
        await new Promise((r) => (resolve = r));
      }
      const chunk = audioQueue.shift();
      if (chunk) {
        yield { AudioEvent: { AudioChunk: chunk } };
      }
    }
  }

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: "en-US",
    MediaEncoding: "pcm",
    MediaSampleRateHertz: 16000,
    AudioStream: audioStream(),
  });

  client.send(command).then(async (res) => {
    for await (const evt of res.TranscriptResultStream) {
      const results = evt.TranscriptEvent?.Transcript?.Results;
      if (!results?.length) continue;

      const r = results[0];
      if (r.IsPartial) continue;

      onTranscript(r.Alternatives[0].Transcript);
    }
  });

  const session = {
    push(chunk) {
      audioQueue.push(chunk);
      resolve?.();
      resolve = null;
    },
    close() {
      sessions.delete(sessionId);
    },
  };

  sessions.set(sessionId, session);
  return session;
}
