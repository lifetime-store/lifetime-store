
export function makeBatchCode(productShortCode, quantity) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `LT-${stamp}-${productShortCode}-${quantity}-${random}`;
}

export function makeSerialCode({ year, productCode, colorCode, sizeCode, sequence }) {
  const seq = String(sequence).padStart(6, "0");
  return `LT-${year}-${productCode}-${colorCode}-${sizeCode}-${seq}`;
}

export function yearShort() {
  return new Date().getFullYear().toString().slice(-2);
}
