const signatures: Record<string, Uint8Array> = {
  "application/pdf": Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
  "image/jpeg": Uint8Array.from([0xff, 0xd8, 0xff]),
  "image/png": Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

export function matchesClaimEvidenceSignature(contentType: string, content: Uint8Array): boolean {
  const signature = signatures[contentType];
  return Boolean(signature && content.length >= signature.length && signature.every((byte, index) => content[index] === byte));
}