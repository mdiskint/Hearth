/**
 * Hearth - A dimensional memory system for personalized AI context
 * 
 * Hearth tracks which parts of your personality are "hot" during a conversation
 * and retrieves relevant memories based on what the conversation is actually about.
 */

export { Hearth, default } from './core/Hearth.js';
export { HeatTracker } from './core/HeatTracker.js';
export { DimensionDetector } from './core/DimensionDetector.js';
export { MemoryRetriever } from './core/MemoryRetriever.js';
