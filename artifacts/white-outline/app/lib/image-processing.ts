export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const INF = 1e20;

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace("#", "").trim();
  const fallback = { r: 255, g: 255, b: 255 };
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function distanceTransform1d(f: Float64Array, n: number, d: Float64Array) {
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;

  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;

  for (let q = 1; q < n; q += 1) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k -= 1;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }

  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const distance = q - v[k];
    d[q] = distance * distance + f[v[k]];
  }
}

export function computeAlphaDistanceField(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const rowInput = new Float64Array(Math.max(width, height));
  const rowOutput = new Float64Array(Math.max(width, height));
  const grid = new Float64Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      rowInput[x] = alpha[rowOffset + x] > 8 ? 0 : INF;
    }
    distanceTransform1d(rowInput, width, rowOutput);
    for (let x = 0; x < width; x += 1) {
      grid[rowOffset + x] = rowOutput[x];
    }
  }

  const distances = new Float32Array(width * height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      rowInput[y] = grid[y * width + x];
    }
    distanceTransform1d(rowInput, height, rowOutput);
    for (let y = 0; y < height; y += 1) {
      distances[y * width + x] = rowOutput[y];
    }
  }

  return distances;
}

export function extractAlpha(imageData: ImageData) {
  const alpha = new Uint8ClampedArray(imageData.width * imageData.height);
  const data = imageData.data;
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = data[pixel * 4 + 3];
  }
  return alpha;
}

export function makeOutlineImageData(
  distances: Float32Array,
  width: number,
  height: number,
  radius: number,
  color: RgbColor,
) {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  const radiusSquared = radius * radius;

  if (radius <= 0) return imageData;

  for (let pixel = 0; pixel < distances.length; pixel += 1) {
    if (distances[pixel] <= radiusSquared) {
      const offset = pixel * 4;
      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
      data[offset + 3] = 255;
    }
  }

  return imageData;
}

export async function loadImage(src: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await image.decode();
  return image;
}
