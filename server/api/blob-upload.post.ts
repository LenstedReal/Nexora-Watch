import { handleNexoraBlobUpload } from "../../src/lib/nexora/blob-handler";

export default async function handler(event: unknown) {
  return handleNexoraBlobUpload(event);
}
