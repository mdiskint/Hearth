/**
 * Test Hearth - Demonstrates the heat dynamics and memory retrieval
 * 
 * Run with: node src/test-hearth.js
 */

import { Hearth } from './core/Hearth.js';

// Initialize Hearth with debug mode
const hearth = new Hearth({ debug: true });

// Simulate a conversation
const prompts = [
  // Turn 1: Ambiguous start - should activate broad/shallow
  "I've been thinking about something and I'm not sure what to do.",
  
  // Turn 2: Work-related - should activate Work domain
  "It's about this project I'm building. The deployment keeps failing.",
  
  // Turn 3: Emotional layer emerges - should activate Anxiety/Frustration
  "I keep hitting these technical blockers and it's really frustrating. I feel like I'm running out of time.",
  
  // Turn 4: Deepens into Work + Anxiety - heat should build
  "This is supposed to be my big swing, you know? The thing I've been building toward.",
  
  // Turn 5: Family enters - should activate Relationships + Love
  "And my wife keeps asking how it's going. I don't want to worry her.",
  
  // Turn 6: Back to Work - should reinforce that dimension
  "Anyway, I think the issue is with how Vercel handles the package.json. Let me try something.",
  
  // Turn 7: Decision point - should activate Decisions
  "Should I just scrap this approach and try something simpler? Or push through?"
];

async function runTest() {
  console.log('\n========================================');
  console.log('        HEARTH TEST SIMULATION');
  console.log('========================================\n');
  
  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n--- TURN ${i + 1} ---`);
    console.log(`User: "${prompts[i]}"\n`);
    
    const result = await hearth.process(prompts[i]);
    
    console.log('Detection:', {
      domains: result.detection.domains.map(d => `${d.name}(${d.score.toFixed(2)})`),
      emotions: result.detection.emotions.map(e => `${e.name}(${e.score.toFixed(2)})`)
    });
    
    console.log('Hottest dimensions:', result.meta.hottestDimensions.map(d => 
      `${d.name}(${d.heat.toFixed(2)})`
    ));
    
    console.log('Memories retrieved:', result.memories.length);
    if (result.memories.length > 0) {
      console.log('Top memories:');
      result.memories.slice(0, 3).forEach(m => {
        console.log(`  - ${m.summary}`);
      });
    }
    
    // Small delay for readability
    await new Promise(r => setTimeout(r, 100));
  }
  
  // Final summary
  console.log('\n========================================');
  console.log('        CONVERSATION SUMMARY');
  console.log('========================================');
  
  const summary = hearth.getConversationSummary();
  console.log(`\nTotal turns: ${summary.turns}`);
  console.log(`Hot domains: ${summary.hotDomains.join(', ') || 'none'}`);
  console.log(`Hot emotions: ${summary.hotEmotions.join(', ') || 'none'}`);
  console.log(`\n${summary.summary}`);
  
  // Final heat map
  console.log(hearth.visualize());
}

// Run the test
runTest().catch(console.error);
