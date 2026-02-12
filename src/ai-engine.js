import { FilesetResolver, LlmInference } from "@mediapipe/tasks-genai";

const MODEL_URL = "https://storage.googleapis.com/jmstore/gemma_2b_it_gpu_int4.bin";
const SYSTEM_PROMPT = "You are a helpful tutor. Ask guiding questions. Be brief. Use emojis.";

let llmInference = null;
let history = [];

export async function loadAI(statusCb, progressCb) {
  if (llmInference) return;

  try {
    statusCb("Initializing WebGPU...");
    const fileset = await FilesetResolver.forGenAiTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm"
    );

    statusCb("Checking for AI Model...");
    
    // Check if we already have it in cache to avoid re-downloading
    const cache = await caches.open('tutor-v1');
    let response = await cache.match(MODEL_URL);
    
    if (!response) {
      statusCb("Downloading Brain (1.3GB)...");
      // Fetch from network with progress tracking
      response = await fetch(MODEL_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.status} ${response.statusText}`);
      }

      // Ensure we didn't get an HTML error page (common cause of 'No model format matched')
      const type = response.headers.get('Content-Type');
      if (type && type.includes('text/html')) {
        throw new Error(`Model URL returned HTML instead of binary. Check URL.`);
      }

      const total = +response.headers.get('Content-Length') || 1300000000; // Fallback to 1.3GB
      let loaded = 0;
      
      const stream = new ReadableStream({
        start(ctrl) {
          const reader = response.body.getReader();
          function push() {
            reader.read().then(({done, value}) => {
              if (done) { ctrl.close(); return; }
              loaded += value.byteLength;
              if (progressCb) progressCb(Math.round((loaded/total)*100));
              ctrl.enqueue(value);
              push();
            });
          }
          push();
        }
      });

      // Create a new response from the stream
      const newResponse = new Response(stream, { headers: response.headers });
      
      // We must clone it: one for the Cache, one for the Blob
      const cacheResponse = newResponse.clone();
      const blobResponse = newResponse.clone();
      
      // Save to cache for offline use
      cache.put(MODEL_URL, cacheResponse);
      
      // Convert to blob for immediate loading
      response = blobResponse;
    } else {
      statusCb("Loading from Cache (Offline Ready)...");
      if (progressCb) progressCb(100);
    }

    const modelBlob = await response.blob();
    const modelUrl = URL.createObjectURL(modelBlob);

    statusCb("Booting up AI (this takes 10s)...");
    
    llmInference = await LlmInference.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl },
      maxTokens: 1000, 
      temperature: 0.7, 
      topK: 40
    });
    
    URL.revokeObjectURL(modelUrl); // Cleanup
    statusCb("Ready");
    return true;

  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function askGemma(text) {
  if (!llmInference) throw new Error("AI is starting up...");
  history.push(`<start_of_turn>user\n${text}<end_of_turn>`);
  
  // Use sliding window context (last 3 turns) to save memory
  const recentHistory = history.slice(-3).join("\n");
  const context = `<start_of_turn>user\n${SYSTEM_PROMPT}<end_of_turn>\n${recentHistory}\n<start_of_turn>model\n`;
  
  const reply = await llmInference.generateResponse(context);
  history.push(`<start_of_turn>model\n${reply}<end_of_turn>`);
  return reply;
}

export function unloadAI() { 
  if(llmInference) { llmInference.close(); llmInference = null; } 
}
export function isReady() { return !!llmInference; }
export function clearChat() { history = []; }