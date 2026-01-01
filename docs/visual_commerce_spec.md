# Visual Commerce Agent (VCA) - Feature Specification

## 1. Overview
This document outlines the architecture and implementation details for the **Visual Commerce Agent (VCA)** module. 
The goal of this module is to automate the generation of high-fidelity, physically accurate product scenario images for e-commerce, specifically focusing on "Digital Planting" (combining plants with pots) and "Contextual Storytelling" (placing products in lifestyle scenes with consistent models).

**Source of Truth:** Based on the successful manual workflow executed for the "Gum Tree + Kristina" project (Dec 2025).

---

## 2. Core Architecture

The VCA operates on a 4-stage pipeline:

1.  **The Calculator (Logic Layer)**: Validates physical feasibility.
2.  **The Assembler (Asset Layer)**: Creates the trusted "Base Image".
3.  **The Director (Scene Layer)**: Injects the Base Image into scenarios.
4.  **The Retoucher (Refinement Layer)**: Handles Face Swaps and Detail Correction.

---

## 3. Data Schema (Typescript Interfaces)

Use these interfaces to structure the React State or API payload.

```typescript
// Core Product Specs
interface ProductSpecs {
  id: string;
  name: string; // e.g., "Gum Tree"
  type: 'Plant' | 'Furniture' | 'Decor';
  dimensions: {
    height_cm: number; // e.g., 180
    width_cm?: number;
    pot_height_cm?: number; // Height of the original black plastic pot (e.g., 18)
  };
  assets: {
    main_image: string; // URL
    detail_images: string[];
  };
}

// Target Container Specs
interface ContainerSpecs {
  id: string;
  name: string; // e.g., "White Textured Pot"
  dimensions: {
    height_cm: number; // e.g., 30
    diameter_cm: number; // e.g., 31
  };
  styling: {
    topping: 'White Pebbles' | 'Bark' | 'Soil';
    color: string;
  };
}

// Model Identity (For Consistency)
interface ModelIdentity {
  name: string; // e.g., "Demo1"
  face_reference_image: string; // The "Golden Sample" face image
  height_cm: number; // e.g., 175
}

// Scene Configuration
interface SceneConfig {
  id: string;
  type: 'Travel' | 'Home_Living' | 'Window_Scale' | 'Detail';
  prompt_modifier: string; // e.g., "12 Apostles background", "Cozy sofa"
  outfit_ref?: string; // Reference image for clothing
  force_scale_check?: boolean; // If true, requires height comparison logic
}
```

---

## 4. The Calculator: Height Logic Algorithm

**Problem:** How to ensure the tree looks 192cm when the product is only 180cm?
**Logic:** When a plant is placed in a decorative pot, it usually sits on top of filler implementation, raising its total height.

```javascript
/**
 * Calculates the visual total height of the planted product.
 */
function calculateVisualHeight(product: ProductSpecs, container: ContainerSpecs): number {
  // Logic: The original pot (18cm) is often placed on a riser or filler inside the new pot (30cm)
  // so that the plant base sits flush with the new pot rim.
  // Elevation Gain = Container Height - Original Pot Height (approx, or flush fit)
  
  // Simplified Logic used in Prototyping:
  // If Container > Original Pot, we assume index elevation to maximize height.
  // Effective Height = Plant Height + (Container Height - Original Pot Height * Overlap_Factor)
  
  // Visual Rule of Thumb used in Gum Tree Project:
  // Original (180) + Lift (12) = 192cm.
  
  const lift = Math.max(0, container.dimensions.height_cm - product.dimensions.pot_height_cm);
  return product.dimensions.height_cm + lift;
}
```

---

## 5. Prompt Engineering Templates (JSON)

These are the "Golden Prompts" verified to work. Inject variables where you see `{{ variable }}`.

### Phase 1: The Base Asset (Digital Planting)
```json
{
  "task": "Product Composition",
  "base_prompt": "A photorealistic high-key studio product shot. Front view. A tall {{ product.name }} ({{ product.height }}cm) planted naturally in a large {{ container.color }} {{ container.name }} ({{ container.height }}cm).",
  "details": [
    "The tree grows out of clean {{ container.topping }} within the pot.",
    "Maintain a visual scale of approx {{ scale_ratio }} (tree vs pot).",
    "White background."
  ],
  "negative_prompt": "blurry, low resolution, multiple pots, distorted leaves"
}
```

### Phase 2: Scenario Injection
```json
{
  "scenarios": {
    "Home_Living": "Interior shot. {{ model.name }} sitting naturally on a sofa. Next to the sofa is the {{ product.name }} in {{ container.name }}. Warm home atmosphere. The tree height is visibly {{ relation_to_model }} the seated person.",
    "Window_Scale": "Full body shot against a bright floor-to-ceiling window. {{ model.name }} ({{ model.height }}cm) standing next to the {{ product.name }} ({{ total_height }}cm). The tree is slighty taller than her. City skyline view."
  }
}
```

### Phase 3: Face Swap / Consistency Refinement
*Note: This is an Image-to-Image operational step, not just a text prompt.*
**Instruction:** "Editing task: Face swap ONLY. Replace the face of the person in the image with the reference face provided. DO NOT CHANGE the lighting, outfit, or background plant details."

---

## 6. Implementation Workflow (State Machine)

1.  **Input State**: User uploads Product Image, Pot Image, and Model Face.
2.  **Validation State**: System calculates `Total Height`.
    *   *UI Feedback*: "Projected Height: 192cm (17cm taller than Model)."
3.  **Generation State A (planting)**:
    *   Generate 4 variations of the "Planted Pot".
    *   **User Action**: Select Best Edge/Shape (The "Locked Asset").
4.  **Generation State B (Scenarios)**:
    *   Use "Locked Asset" + "Scene Prompts" to generate scenes.
    *   *Crucial*: Use Inpainting/img2img to preserve the plant shape.
5.  **Refinement State**:
    *   Iterate through selected scenes and apply Face Swap using the `model.face_reference_image`.
    *   Check specific details (e.g., leaf size < 4cm) using Inpainting on specific regions.
6.  **Final Output**: Downloadable Assets.

---

## 7. Lessons Learned & Edge Cases

*   **Leaf Scale Bug**: AI tends to make leaves too large in macro shots.
    *   *Fix*: Explicitly state physical size (e.g., "3-4cm diameter", "coin sized") in prompts for close-ups.
*   **Asset Drift**: Regenerating a scene often changes the plant's shape.
    *   *Fix*: Once the Phase 1 Plant is approved, treat it as a immutable visual anchor. Use it as an image prompt input with high weight (0.7+) for subsequent generations.
*   **Height Consistency**:
    *   *Fix*: Always include the specific heights (e.g. "192cm vs 175cm") in the prompt to force the model to respect scale.
