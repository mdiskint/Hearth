// core/dimensionDetector.js - Simplified for extension (no API)

export class DimensionDetector {
    constructor() {
        this.patterns = {
            domains: {
                Work: /\b(work|job|career|boss|colleague|project|deadline|meeting|salary|promotion|business|company|client|task)\b/i,
                Relationships: /\b(family|friend|partner|wife|husband|kid|parent|relationship|love|marriage|dating|social|connection)\b/i,
                Creative: /\b(create|build|write|design|art|music|idea|invent|imagine|story|paint|draw|code|develop|make)\b/i,
                Self: /\b(I feel|I am|myself|identity|who I am|self|personal|me|my life|growth|health|body)\b/i,
                Decisions: /\b(decide|choice|option|should I|considering|weighing|torn|dilemma|choose|pick|select|path)\b/i,
                Resources: /\b(money|budget|invest|cost|afford|financial|savings|debt|buy|purchase|price|expensive|cheap)\b/i,
                Values: /\b(believe|value|important|principle|integrity|right|wrong|ethics|moral|truth|honest|fair)\b/i,
            },
            emotions: {
                Fear: /\b(afraid|scared|fear|worry|anxious|terrified|nervous|dread|panic)\b/i,
                Anger: /\b(angry|frustrated|annoyed|furious|mad|irritated|pissed|rage|resent)\b/i,
                Shame: /\b(ashamed|embarrassed|guilty|regret|humiliated|stupid|foolish|sorry)\b/i,
                Grief: /\b(loss|grief|mourn|miss|died|death|gone|sad|sorrow|cry|tears)\b/i,
                Anxiety: /\b(anxious|stressed|overwhelmed|panic|worried|uncertain|pressure|tense|uneasy)\b/i,
                Joy: /\b(happy|excited|thrilled|delighted|joyful|wonderful|great|good|smile|laugh|fun)\b/i,
                Pride: /\b(proud|accomplished|achieved|success|nailed|crushed it|won|victory|best)\b/i,
                Love: /\b(love|adore|cherish|care for|devoted|affection|like|fond)\b/i,
                Curiosity: /\b(curious|wonder|interesting|fascinated|intrigued|explore|learn|why|how|what if)\b/i,
                Peace: /\b(calm|peaceful|serene|content|relaxed|at ease|quiet|still|rest)\b/i,
            }
        };
    }

    async detect(message) {
        const result = {
            domains: [],
            emotions: []
        };

        for (const [domain, pattern] of Object.entries(this.patterns.domains)) {
            if (pattern.test(message)) {
                result.domains.push(domain);
            }
        }

        for (const [emotion, pattern] of Object.entries(this.patterns.emotions)) {
            if (pattern.test(message)) {
                result.emotions.push(emotion);
            }
        }

        return result;
    }
}
