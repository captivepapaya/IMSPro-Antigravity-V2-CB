
// Standard RGB values for common plant colors
const COLOR_PALETTE: Record<string, [number, number, number]> = {
  // Reds / Pinks
  "red": [255, 0, 0],
  "burgundy": [128, 0, 32],
  "beauty": [199, 21, 133], // Medium Violet Red
  "pink": [255, 192, 203],
  "dark pink": [231, 84, 128],
  "dk pink": [231, 84, 128],
  "hot pink": [255, 105, 180],
  "rose": [255, 0, 127],
  "mauve": [224, 176, 255],
  "lavender": [230, 230, 250],
  "purple": [128, 0, 128],
  "lilac": [200, 162, 200],
  "dusty pink": [216, 167, 177],
  
  // Yellows / Oranges
  "yellow": [255, 255, 0],
  "gold": [255, 215, 0],
  "orange": [255, 165, 0],
  "peach": [255, 218, 185],
  "apricot": [251, 206, 177],
  "champagne": [247, 231, 206],
  
  // Whites / Creams
  "white": [255, 255, 255],
  "cream": [255, 253, 208],
  "ivory": [255, 255, 240],
  "vanilla": [243, 229, 171],
  
  // Greens
  "green": [0, 128, 0],
  "dark green": [0, 100, 0],
  "grey green": [94, 113, 106],
  "lime": [50, 205, 50],
  "olive": [128, 128, 0],
  "sage": [188, 184, 138],
  "variegated": [144, 238, 144], // Light Green approx
  
  // Blues
  "blue": [0, 0, 255],
  "navy": [0, 0, 128],
  
  // Neutrals
  "black": [0, 0, 0],
  "grey": [128, 128, 128],
  "silver": [192, 192, 192],
  "brown": [165, 42, 42],
  "chocolate": [123, 63, 0],
  "rust": [183, 65, 14],
  "natural": [139, 69, 19], // SaddleBrown
  "mixed": [128, 128, 128], // Neutral
};

// The 23 Cluster Colors allowed
export const CLUSTER_COLORS = [
  "White", "Green", "Variegated", "Red", "Burgundy", "Pink", "Ivory", "Peach", 
  "Cream", "Dusty Pink", "Grey Green", "Blue", "Orange", "Purple", "Natural", 
  "Grey", "Dark Green", "Yellow", "Black", "Mauve", "Lilac", "Mixed", "Beauty"
];

// Default distance for unknown colors (Max possible distance in RGB cube is ~441)
const MAX_RGB_DISTANCE = 442; 

/**
 * Tries to map a loose string (e.g., "Dk Pink/Cream") to an RGB tuple.
 * If multiple colors found (slash separated), takes the first recognized one.
 */
export const getRgbFromColorName = (colorName: string): [number, number, number] | null => {
  if (!colorName) return null;
  
  const clean = colorName.toLowerCase().trim();
  
  // 1. Direct match
  if (COLOR_PALETTE[clean]) return COLOR_PALETTE[clean];
  
  // 2. Split by / or space and try to find keywords
  const parts = clean.split(/[\/\s,&]+/);
  
  for (const part of parts) {
    if (COLOR_PALETTE[part]) return COLOR_PALETTE[part];
  }
  
  // 3. Try to find keys inside the string (e.g. "darkpink")
  for (const key in COLOR_PALETTE) {
    if (clean.includes(key)) return COLOR_PALETTE[key];
  }
  
  return null;
};

/**
 * Calculates Euclidean distance between two colors in 3D RGB space.
 * d = sqrt((r2-r1)^2 + (g2-g1)^2 + (b2-b1)^2)
 */
export const calculateColorDistance = (
  rgb1: [number, number, number] | null, 
  rgb2: [number, number, number] | null
): number => {
  if (!rgb1 || !rgb2) return MAX_RGB_DISTANCE; // Treat as max distance if unknown
  
  return Math.sqrt(
    Math.pow(rgb2[0] - rgb1[0], 2) +
    Math.pow(rgb2[1] - rgb1[1], 2) +
    Math.pow(rgb2[2] - rgb1[2], 2)
  );
};

export const findClosestClusterColor = (inputColor: string): string => {
    const inputRgb = getRgbFromColorName(inputColor);
    if (!inputRgb) return ""; // Cannot map, user must select manually

    let minDistance = Number.MAX_VALUE;
    let closestCluster = "";

    for (const cluster of CLUSTER_COLORS) {
        const clusterRgb = getRgbFromColorName(cluster);
        if (clusterRgb) {
            const dist = calculateColorDistance(inputRgb, clusterRgb);
            if (dist < minDistance) {
                minDistance = dist;
                closestCluster = cluster;
            }
        }
    }
    
    return closestCluster;
};
