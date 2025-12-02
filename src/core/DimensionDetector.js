/**
 * DimensionDetector - Detects which dimensions a prompt activates
 * 
 * Uses a hybrid approach:
 * 1. Fast keyword/semantic matching for initial detection
 * 2. Optional AI classification for more nuanced detection
 */

import dimensions from '../../dimensions.json' assert { type: 'json' };

export class DimensionDetector {
  constructor(config = {}) {
    this.config = {
      useAI: false,              // Whether to use AI for classification
      keywordWeight: 0.6,        // Weight for keyword matching
      semanticWeight: 0.4,       // Weight for semantic similarity
      domainThreshold: 0.3,      // Minimum score to activate a domain
      emotionThreshold: 0.15,    // Lower threshold for emotions (they're always present)
      maxDomainActivations: 3,   // Max domains to activate
      maxEmotionActivations: 4,  // Max emotions to activate (more than domains)
      ...config
    };

    // Build keyword maps from dimension descriptions
    this.domainKeywords = this._buildKeywordMap(dimensions.domains);
    this.emotionKeywords = this._buildKeywordMap(dimensions.emotions);
  }

  /**
   * Build a keyword map from dimension descriptions
   */
  _buildKeywordMap(dimensionSet) {
    const keywordMap = {};
    
    for (const [name, data] of Object.entries(dimensionSet)) {
      // Extract meaningful words from description
      const description = data.description.toLowerCase();
      const words = description.match(/\b[a-z]{4,}\b/g) || [];
      
      // Filter out common words and keep distinctive ones
      const stopWords = new Set([
        'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they',
        'their', 'what', 'when', 'where', 'which', 'would', 'could',
        'should', 'about', 'into', 'your', 'more', 'some', 'than',
        'them', 'these', 'being', 'other', 'also', 'just', 'over'
      ]);
      
      const keywords = [...new Set(words)]
        .filter(w => !stopWords.has(w))
        .slice(0, 30); // Keep top 30 keywords per dimension
      
      keywordMap[name] = {
        keywords,
        description: data.description
      };
    }
    
    return keywordMap;
  }

  /**
   * Detect dimensions from a prompt using keyword matching
   */
  detectFromKeywords(prompt) {
    const promptLower = prompt.toLowerCase();
    const promptWords = new Set(promptLower.match(/\b[a-z]{4,}\b/g) || []);
    
    const domainScores = {};
    const emotionScores = {};
    
    // Score domains
    for (const [domain, data] of Object.entries(this.domainKeywords)) {
      const matches = data.keywords.filter(kw => promptWords.has(kw) || promptLower.includes(kw));
      domainScores[domain] = matches.length / Math.max(data.keywords.length, 1);
    }
    
    // Score emotions
    for (const [emotion, data] of Object.entries(this.emotionKeywords)) {
      const matches = data.keywords.filter(kw => promptWords.has(kw) || promptLower.includes(kw));
      emotionScores[emotion] = matches.length / Math.max(data.keywords.length, 1);
    }
    
    return { domainScores, emotionScores };
  }

  /**
   * Apply contextual boosts based on prompt patterns
   */
  _applyContextualBoosts(prompt, domainScores, emotionScores) {
    const promptLower = prompt.toLowerCase();
    
    // Domain boosts
    if (/\b(ship|deploy|build|code|project|deadline|work|job|career)\b/.test(promptLower)) {
      domainScores.Work = (domainScores.Work || 0) + 0.2;
    }
    // Law school / education context → Work
    if (/\b(law school|school|degree|studying|classes|homework|exam|semester)\b/.test(promptLower)) {
      domainScores.Work = (domainScores.Work || 0) + 0.3;
    }
    if (/\b(wife|husband|kid|kids|child|children|family|parent|son|daughter|partner|marriage)\b/.test(promptLower)) {
      domainScores.Relationships = (domainScores.Relationships || 0) + 0.35;
    }
    // Creative - more patterns
    if (/\b(idea|emerge|design|imagine)\b/.test(promptLower)) {
      domainScores.Creative = (domainScores.Creative || 0) + 0.2;
    }
    if (/\b(creative work|creative|art|writing|music|build|make|ship)\b/.test(promptLower)) {
      domainScores.Creative = (domainScores.Creative || 0) + 0.35;
    }
    // Self - expanded patterns
    if (/\b(who am i|identity|value|believe|growth|myself|my life|becoming)\b/.test(promptLower)) {
      domainScores.Self = (domainScores.Self || 0) + 0.25;
    }
    if (/part of me|who i am|matters to me|what i really|actually matters/.test(promptLower)) {
      domainScores.Self = (domainScores.Self || 0) + 0.35;
    }
    // Decisions - expanded patterns
    if (/\b(decide|decision|choice|option|commit|considering|weighing)\b/.test(promptLower)) {
      domainScores.Decisions = (domainScores.Decisions || 0) + 0.35;
    }
    if (/should i|part of me|torn|instead of|or should/.test(promptLower)) {
      domainScores.Decisions = (domainScores.Decisions || 0) + 0.3;
    }
    if (/\b(money|budget|invest|cost|afford|save|spend|financial|salary)\b/.test(promptLower)) {
      domainScores.Resources = (domainScores.Resources || 0) + 0.3;
    }
    
    // Emotion boosts - MORE SENSITIVE
    if (/\b(scared|afraid|worry|worried|risk|protect|fear|terrified|dread)\b/.test(promptLower)) {
      emotionScores.Fear = (emotionScores.Fear || 0) + 0.4;
    }
    if (/\b(angry|furious|frustrat|annoyed|pissed|mad|irritat|rage)\b/.test(promptLower)) {
      emotionScores.Anger = (emotionScores.Anger || 0) + 0.4;
    }
    if (/\b(embarrass|ashamed|shame|hide|exposed|stupid|failure|inadequate|look bad|judg)\b/.test(promptLower)) {
      emotionScores.Shame = (emotionScores.Shame || 0) + 0.4;
    }
    // Shame - avoidance/procrastination patterns
    if (/hiding|avoiding|instead of doing|should be doing|not doing/.test(promptLower)) {
      emotionScores.Shame = (emotionScores.Shame || 0) + 0.35;
    }
    if (/\b(lost|miss|gone|death|griev|died|losing|mourn)\b/.test(promptLower)) {
      emotionScores.Grief = (emotionScores.Grief || 0) + 0.4;
    }
    if (/\b(anxious|nervous|stress|overwhelm|spinning|uncertain|tense|on edge|worried)\b/.test(promptLower)) {
      emotionScores.Anxiety = (emotionScores.Anxiety || 0) + 0.35;
    }
    if (/\b(happy|excited|love it|amazing|great|wonderful|thrilled|joy|delighted)\b/.test(promptLower)) {
      emotionScores.Joy = (emotionScores.Joy || 0) + 0.35;
    }
    if (/\b(proud|accomplish|built|achieved|made|success|nailed|crushed it)\b/.test(promptLower)) {
      emotionScores.Pride = (emotionScores.Pride || 0) + 0.35;
    }
    if (/\b(love|care|protect|family|heart|cherish|adore|wife|husband|kids|son|daughter)\b/.test(promptLower)) {
      emotionScores.Love = (emotionScores.Love || 0) + 0.3;
    }
    if (/\b(curious|wonder|why|how come|interest|fascin|intrigu|what if)\b/.test(promptLower)) {
      emotionScores.Curiosity = (emotionScores.Curiosity || 0) + 0.3;
    }
    if (/\b(calm|peace|settled|resolved|accept|okay with|at ease|content)\b/.test(promptLower)) {
      emotionScores.Peace = (emotionScores.Peace || 0) + 0.3;
    }
    
    // Compound patterns - catch emotional subtext
    if (/\b(against|disagree|conflict|tension)\b/.test(promptLower)) {
      emotionScores.Anxiety = (emotionScores.Anxiety || 0) + 0.2;
      emotionScores.Fear = (emotionScores.Fear || 0) + 0.15;
    }
    if (/\b(drop|quit|leave|stop|give up)\b/.test(promptLower)) {
      emotionScores.Anxiety = (emotionScores.Anxiety || 0) + 0.2;
      emotionScores.Shame = (emotionScores.Shame || 0) + 0.15;
    }
    
    return { domainScores, emotionScores };
  }

  /**
   * Main detection method - returns activated dimensions
   */
  detect(prompt) {
    // Get keyword-based scores
    let { domainScores, emotionScores } = this.detectFromKeywords(prompt);
    
    // Apply contextual boosts
    ({ domainScores, emotionScores } = this._applyContextualBoosts(
      prompt, domainScores, emotionScores
    ));
    
    // Filter domains by threshold
    const activatedDomains = Object.entries(domainScores)
      .filter(([_, score]) => score >= this.config.domainThreshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxDomainActivations)
      .map(([name, score]) => ({ name, score }));
    
    // Filter emotions by lower threshold
    let activatedEmotions = Object.entries(emotionScores)
      .filter(([_, score]) => score >= this.config.emotionThreshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxEmotionActivations)
      .map(([name, score]) => ({ name, score }));
    
    // Emotions should always fire - if nothing hit threshold, infer from tone
    if (activatedEmotions.length === 0) {
      activatedEmotions = this._inferBaselineEmotions(prompt);
    }
    
    // If no domains activated, do broad activation
    if (activatedDomains.length === 0) {
      return {
        ...this._broadActivation(prompt),
        emotions: activatedEmotions.length > 0 ? activatedEmotions : this._inferBaselineEmotions(prompt)
      };
    }
    
    return {
      domains: activatedDomains,
      emotions: activatedEmotions,
      method: 'keyword'
    };
  }

  /**
   * Infer baseline emotions when nothing else fires
   */
  _inferBaselineEmotions(prompt) {
    const promptLower = prompt.toLowerCase();
    const emotions = [];
    
    // Question = curiosity
    if (/\?/.test(prompt) || /^(how|what|why|should|can|could|would)/i.test(prompt)) {
      emotions.push({ name: 'Curiosity', score: 0.3 });
    }
    
    // Uncertainty language = anxiety
    if (/\b(maybe|might|not sure|don't know|uncertain|wondering)\b/i.test(promptLower)) {
      emotions.push({ name: 'Anxiety', score: 0.25 });
    }
    
    // Negative framing = fear or anxiety
    if (/\b(worried|concern|afraid|scared|nervous)\b/i.test(promptLower)) {
      emotions.push({ name: 'Fear', score: 0.35 });
    }
    
    // Positive language = joy
    if (/\b(excited|happy|great|love|amazing|awesome)\b/i.test(promptLower)) {
      emotions.push({ name: 'Joy', score: 0.3 });
    }
    
    // Default: curiosity (they're asking something)
    if (emotions.length === 0) {
      emotions.push({ name: 'Curiosity', score: 0.2 });
    }
    
    return emotions;
  }

  /**
   * Broad activation for ambiguous prompts
   * Returns multiple plausible dimensions at low confidence
   */
  _broadActivation(prompt) {
    const promptLower = prompt.toLowerCase();
    
    // Default broad activations based on common patterns
    const domains = [];
    const emotions = [];
    
    // Check for question patterns
    if (/\?/.test(prompt) || /^(how|what|why|should|can|could)/i.test(prompt)) {
      emotions.push({ name: 'Curiosity', score: 0.3 });
    }
    
    // Check for "I" statements (self-referential)
    if (/\bi\b.*\b(am|feel|think|want|need)\b/i.test(prompt)) {
      domains.push({ name: 'Self', score: 0.3 });
    }
    
    // Default fallbacks
    if (domains.length === 0) {
      domains.push({ name: 'Work', score: 0.2 });
      domains.push({ name: 'Self', score: 0.2 });
    }
    
    if (emotions.length === 0) {
      emotions.push({ name: 'Curiosity', score: 0.2 });
    }
    
    return {
      domains,
      emotions,
      method: 'broad'
    };
  }

  /**
   * AI-powered detection (optional, for more nuanced classification)
   * This would call Claude to classify the prompt
   */
  async detectWithAI(prompt, anthropicClient) {
    if (!anthropicClient) {
      return this.detect(prompt); // Fall back to keyword detection
    }

    const classificationPrompt = `Analyze this user message and determine which dimensions it activates.

DOMAINS (pick 1-3):
- Work: Projects, professional tasks, shipping, building
- Relationships: Family, partners, collaborators, interpersonal
- Creative: Ideas, art, writing, emergence, inspiration
- Self: Identity, values, growth, personal reflection
- Decisions: Choices, uncertainty, weighing options
- Resources: Money, time, energy, security

EMOTIONS (pick 1-3):
- Fear: Protection, risk, worry
- Anger: Frustration, boundaries, irritation
- Shame: Exposure, inadequacy, hiding
- Grief: Loss, letting go, weight
- Anxiety: Uncertainty, spinning, future-worry
- Joy: Energy, excitement, aliveness
- Pride: Accomplishment, recognition, satisfaction
- Love: Care, protection, connection
- Curiosity: Questions, exploration, interest
- Peace: Calm, resolution, acceptance

USER MESSAGE: "${prompt}"

Respond with JSON only:
{
  "domains": [{"name": "DomainName", "score": 0.0-1.0, "reason": "brief reason"}],
  "emotions": [{"name": "EmotionName", "score": 0.0-1.0, "reason": "brief reason"}]
}`;

    try {
      const response = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: classificationPrompt }]
      });

      const result = JSON.parse(response.content[0].text);
      return {
        domains: result.domains,
        emotions: result.emotions,
        method: 'ai'
      };
    } catch (error) {
      console.error('AI detection failed, falling back to keywords:', error);
      return this.detect(prompt);
    }
  }
}

export default DimensionDetector;
