
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'amani_salt_2026'); // Simple salt
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateDataSignature(data: any): string {
  // Simple deterministic string representation for signing
  const content = JSON.stringify(data, Object.keys(data).sort());
  // Using a simple hash function as a "signature" for local integrity check
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

export function verifyDataIntegrity(data: any, expectedSignature: string): boolean {
  if (!expectedSignature) return false;
  const { signature, ...dataWithoutSignature } = data;
  return generateDataSignature(dataWithoutSignature) === expectedSignature;
}
