import { inspectFile } from "../lib/inspect-file";
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    self.postMessage(await inspectFile(event.data));
  } catch {
    self.postMessage({
      error:
        "This file could not be inspected. Try exporting it to PDF, text, or ZIP.",
    });
  }
};
