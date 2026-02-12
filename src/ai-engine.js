import { FilesetResolver, LlmInference } from "@mediapipe/tasks-genai";

const MODEL_URL = "https://storage.googleapis.com/jmstore/gemma_2b_it_gpu_int4.bin";
const SYSTEM_PROMPT = "You are a helpful tutor. Ask guiding questions. Be brief. Use emojis.";

let llmInference = null;
let history = [];

export async function loadAI(statusCb) {
  if (llmInference) return;
  
  statusCb("Loading WebGPU...");
  const fileset = await FilesetResolver.forGenAiTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm"
  );

  statusCb("Checking Model (1.3GB)...");
  // We fetch explicitly to track progress, Service Worker handles caching
  const response = await fetch(MODEL_URL);
  const total = +response.headers.get('Content-Length');
  let loaded = 0;
  
  const stream = new ReadableStream({
    start(ctrl) {
      const reader = response.body.getReader();
      function push() {
        reader.read().then(({done, value}) => {
          if (done) { ctrl.close(); return; }
          loaded += value.byteLength;
          statusCb(`Downloading Brain: ${Math.round((loaded/total)*100)}%`);
          ctrl.enqueue(value);
          push();
        });
      }
      push();
    }
  });

  const modelBlob = await new Response(stream).blob();
  const modelUrl = URL.createObjectURL(modelBlob);

  statusCb("Booting up AI...");
  llmInference = await LlmInference.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelUrl },
    maxTokens: 1000, temperature: 0.7, topK: 40
  });
  URL.revokeObjectURL(modelUrl);
  statusCb("Ready");
}

export async function askGemma(text) {
  history.push(`<start_of_turn>user\n${text}<end_of_turn>`);
  const context = `<start_of_turn>user\n${SYSTEM_PROMPT}<end_of_turn>\n` + history.slice(-4).join("\n") + `\n<start_of_turn>model\n`;
  const response = await llmInference.generateResponse(context);
  history.push(`<start_of_turn>model\n${response}<end_of_turn>`);
  return response;
}

export function unloadAI() { if(llmInference) { llmInference.close(); llmInference = null; } }
export function isReady() { return !!llmInference; }
export function clearChat() { history = []; }