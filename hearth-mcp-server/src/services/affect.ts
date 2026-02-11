import type { AffectShape, AffectComplement } from "../types.js";

/**
 * Affect detection keywords mapped to axis shifts.
 * Each keyword nudges one or more axes.
 * This is the lightweight client-side version — no API calls needed.
 */
const AFFECT_SIGNALS: Record<
  string,
  { expansion?: number; activation?: number; certainty?: number }
> = {
  // Contracted signals
  stuck: { expansion: -0.4, activation: -0.2, certainty: -0.3 },
  confused: { expansion: -0.2, certainty: -0.5 },
  "not sure": { certainty: -0.4 },
  uncertain: { certainty: -0.5 },
  overwhelmed: { expansion: -0.5, activation: 0.3, certainty: -0.3 },
  anxious: { expansion: -0.3, activation: 0.4, certainty: -0.3 },
  worried: { expansion: -0.2, activation: 0.2, certainty: -0.3 },
  afraid: { expansion: -0.5, activation: 0.3, certainty: -0.4 },
  lost: { expansion: -0.3, activation: -0.2, certainty: -0.5 },
  struggling: { expansion: -0.3, activation: 0.2, certainty: -0.2 },
  frustrated: { expansion: -0.3, activation: 0.4, certainty: -0.1 },
  "give up": { expansion: -0.5, activation: -0.4, certainty: -0.2 },

  // Expanded signals
  excited: { expansion: 0.5, activation: 0.5, certainty: 0.2 },
  curious: { expansion: 0.4, activation: 0.3 },
  "what if": { expansion: 0.5, certainty: -0.1 },
  exploring: { expansion: 0.5, activation: 0.2 },
  possible: { expansion: 0.3, certainty: 0.1 },
  idea: { expansion: 0.4, activation: 0.2 },
  interesting: { expansion: 0.3, activation: 0.2 },
  inspired: { expansion: 0.5, activation: 0.4, certainty: 0.2 },

  // Certain signals
  decided: { certainty: 0.5, activation: 0.2 },
  "going to": { certainty: 0.4, activation: 0.3 },
  clear: { certainty: 0.4, expansion: 0.2 },
  obvious: { certainty: 0.5 },
  definitely: { certainty: 0.5 },
  sure: { certainty: 0.3 },
  confident: { certainty: 0.4, expansion: 0.2 },

  // Frozen/flooded signals
  "can't think": { activation: -0.5, expansion: -0.4, certainty: -0.3 },
  numb: { activation: -0.5, expansion: -0.3 },
  blank: { activation: -0.4, expansion: -0.3, certainty: -0.2 },
  shutdown: { activation: -0.5, expansion: -0.5 },
  "too much": { activation: 0.3, expansion: -0.5, certainty: -0.4 },
  panicking: { activation: 0.5, expansion: -0.5, certainty: -0.5 },
};

/**
 * Detect affect shape from a user message.
 * Returns a 3-axis vector representing emotional state.
 */
export function detectAffectShape(message: string): AffectShape {
  const lower = message.toLowerCase();
  const shape: AffectShape = { expansion: 0, activation: 0, certainty: 0 };
  let signalCount = 0;

  for (const [signal, shifts] of Object.entries(AFFECT_SIGNALS)) {
    if (lower.includes(signal)) {
      if (shifts.expansion) shape.expansion += shifts.expansion;
      if (shifts.activation) shape.activation += shifts.activation;
      if (shifts.certainty) shape.certainty += shifts.certainty;
      signalCount++;
    }
  }

  // Normalize if multiple signals detected
  if (signalCount > 1) {
    const dampening = 1 / Math.sqrt(signalCount);
    shape.expansion *= dampening;
    shape.activation *= dampening;
    shape.certainty *= dampening;
  }

  // Clamp to [-1, 1]
  shape.expansion = Math.max(-1, Math.min(1, shape.expansion));
  shape.activation = Math.max(-1, Math.min(1, shape.activation));
  shape.certainty = Math.max(-1, Math.min(1, shape.certainty));

  // Round to 2 decimal places
  shape.expansion = Math.round(shape.expansion * 100) / 100;
  shape.activation = Math.round(shape.activation * 100) / 100;
  shape.certainty = Math.round(shape.certainty * 100) / 100;

  return shape;
}

/**
 * Map a shape vector to an affect label and conversational strategy.
 * This is the core of the Affect Complement system.
 */
export function shapeToComplement(shape: AffectShape): AffectComplement {
  const { expansion, activation, certainty } = shape;

  // Determine primary state
  if (expansion < -0.3 && certainty < -0.3) {
    return {
      shape,
      label: "contracted/uncertain",
      strategy: "anchor",
      complement_text:
        `Shape: expansion=${expansion}, activation=${activation}, certainty=${certainty}\n\n` +
        `They're contracted and uncertain. Don't pile on options or ask open-ended questions. ` +
        `Offer one concrete frame or anchor. "Here's one way to think about this." ` +
        `Name what seems true from what they've said. Give them something solid to push against.`,
    };
  }

  if (expansion > 0.3 && certainty > 0.3) {
    return {
      shape,
      label: "expanded/certain",
      strategy: "spar",
      complement_text:
        `Shape: expansion=${expansion}, activation=${activation}, certainty=${certainty}\n\n` +
        `They're expanded and certain — energy is high, conviction is strong. ` +
        `Don't anchor or validate. Spar with them. Ask the question they haven't asked themselves. ` +
        `Challenge the premise, not the person. "What's the version of this that fails?"`,
    };
  }

  if (activation < -0.3) {
    return {
      shape,
      label: "frozen/flooded",
      strategy: "ground",
      complement_text:
        `Shape: expansion=${expansion}, activation=${activation}, certainty=${certainty}\n\n` +
        `They're frozen or flooded — system is overwhelmed or shut down. ` +
        `Don't push for insight or action. Start small and concrete. ` +
        `"We don't have to solve this. Let's just name what's here." ` +
        `Offer small, low-stakes starting points. Use "we" language.`,
    };
  }

  if (activation > 0.3 && certainty < -0.2) {
    return {
      shape,
      label: "activated/uncertain",
      strategy: "channel",
      complement_text:
        `Shape: expansion=${expansion}, activation=${activation}, certainty=${certainty}\n\n` +
        `They're energized but scattered — activation without direction. ` +
        `Help them find the thread. Don't dampen the energy, channel it. ` +
        `"There are three things alive here. Which one has the most charge?"`,
    };
  }

  if (expansion > 0.2 && certainty < -0.2) {
    return {
      shape,
      label: "seeking/uncertain",
      strategy: "anchor",
      complement_text:
        `Shape: expansion=${expansion}, activation=${activation}, certainty=${certainty}\n\n` +
        `They're seeking and unsure. Don't pile on more options. ` +
        `Offer one concrete frame or anchor. "Here's one way to think about this." ` +
        `Name what seems true from what they've said. Give them something solid to push against.`,
    };
  }

  // Neutral / low-signal — no active modulation
  return {
    shape,
    label: "neutral",
    strategy: "none",
    complement_text:
      `Shape: expansion=${expansion}, activation=${activation}, certainty=${certainty}\n` +
      `No active modulation — neutral container.`,
  };
}

/**
 * Full affect detection pipeline: message → shape → complement.
 */
export function detectAffect(message: string): AffectComplement {
  const shape = detectAffectShape(message);
  return shapeToComplement(shape);
}
