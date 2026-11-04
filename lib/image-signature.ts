export function matchesImageSignature(mime: string, bytes: Uint8Array): boolean {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte)
  switch (mime) {
    case 'image/jpeg':
      return startsWith(0xff, 0xd8, 0xff)
    case 'image/png':
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    case 'image/webp':
      return bytes.length >= 12 &&
        startsWith(0x52, 0x49, 0x46, 0x46) &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    case 'image/gif':
      return startsWith(0x47, 0x49, 0x46, 0x38) &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
    case 'image/avif':
      return bytes.length >= 12 &&
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 &&
        ['avif', 'avis'].includes(String.fromCharCode(...bytes.slice(8, 12)))
    default:
      return false
  }
}
