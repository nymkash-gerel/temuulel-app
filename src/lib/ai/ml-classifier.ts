/**
 * ML-based intent classifier using TF-IDF + Multinomial Naive Bayes.
 * Pure TypeScript implementation without external ML libraries.
 */

import { normalizeText } from '../text-normalizer'
import { stemTextDeep } from '../mn-stemmer'
import { extractMorphFeatures } from '../morphological-features'
import trainingData from './training-data.json'

interface TrainingExample {
  text: string
  intent: string
}

interface VocabularyTerm {
  term: string
  documentFrequency: number  // Number of documents containing this term
}

interface IntentClassData {
  termCounts: Map<string, number>  // Term -> count in this intent
  totalTerms: number  // Total terms in this intent
  documentCount: number  // Number of documents for this intent
}

interface MLClassificationResult {
  intent: string
  confidence: number
}

class MLClassifier {
  private vocabulary: Map<string, VocabularyTerm> = new Map()
  private intentData: Map<string, IntentClassData> = new Map()
  private totalDocuments: number = 0
  private isTrained: boolean = false

  constructor() {
    this.train()
  }

  /**
   * Tokenize text: normalize -> deep-stem -> split -> filter + morph features
   * Morphological feature tokens (__MORPH_*) inject suffix-based intent signals
   * into the TF-IDF feature space.
   */
  private tokenize(text: string): string[] {
    const normalized = normalizeText(text)
    const stemmed = stemTextDeep(normalized)
    const tokens = stemmed
      .split(' ')
      .filter(token => token.length >= 2)

    // Inject morphological feature tokens
    const features = extractMorphFeatures(normalized)
    if (features.hasNegative) tokens.push('__MORPH_NEG__')
    if (features.hasDesiderative) tokens.push('__MORPH_DESIRE__')
    if (features.hasPastQuestion) tokens.push('__MORPH_PASTQ__')
    if (features.hasProgressive) tokens.push('__MORPH_PROG__')
    if (features.hasImperative) tokens.push('__MORPH_IMP__')
    if (features.hasPassive) tokens.push('__MORPH_PASSIVE__')
    if (features.hasPast) tokens.push('__MORPH_PAST__')

    return tokens
  }

  /**
   * Train the classifier with the provided training data
   */
  private train(): void {
    console.log(`Training ML classifier with ${trainingData.length} examples...`)
    
    const examples = trainingData as TrainingExample[]
    this.totalDocuments = examples.length

    // Initialize intent data
    for (const example of examples) {
      if (!this.intentData.has(example.intent)) {
        this.intentData.set(example.intent, {
          termCounts: new Map(),
          totalTerms: 0,
          documentCount: 0
        })
      }
      this.intentData.get(example.intent)!.documentCount++
    }

    // Process each document
    const documentTerms: string[][] = []
    for (const example of examples) {
      const tokens = this.tokenize(example.text)
      documentTerms.push(tokens)

      const intentData = this.intentData.get(example.intent)!
      
      // Count terms for this intent
      for (const token of tokens) {
        intentData.termCounts.set(token, (intentData.termCounts.get(token) || 0) + 1)
        intentData.totalTerms++
      }
    }

    // Build vocabulary with document frequencies
    const termDocumentSets = new Map<string, Set<number>>()
    
    for (let docIndex = 0; docIndex < documentTerms.length; docIndex++) {
      const uniqueTerms = new Set(documentTerms[docIndex])
      for (const term of uniqueTerms) {
        if (!termDocumentSets.has(term)) {
          termDocumentSets.set(term, new Set())
        }
        termDocumentSets.get(term)!.add(docIndex)
      }
    }

    // Create vocabulary with document frequencies
    for (const [term, docSet] of termDocumentSets.entries()) {
      this.vocabulary.set(term, {
        term,
        documentFrequency: docSet.size
      })
    }

    this.isTrained = true
    console.log(`ML classifier trained with ${this.vocabulary.size} terms and ${this.intentData.size} intents`)
  }

  /**
   * Calculate TF-IDF weight for a term in a document
   */
  private calculateTfIdf(term: string, termFreq: number, docLength: number): number {
    if (!this.vocabulary.has(term)) {
      return 0
    }

    const tf = termFreq / docLength  // Term frequency
    const df = this.vocabulary.get(term)!.documentFrequency
    const idf = Math.log(this.totalDocuments / df)  // Inverse document frequency
    
    return tf * idf
  }

  /**
   * Classify text using Multinomial Naive Bayes with TF-IDF features
   */
  classify(text: string): MLClassificationResult {
    if (!this.isTrained) {
      throw new Error('Classifier not trained')
    }

    const tokens = this.tokenize(text)
    if (tokens.length === 0) {
      return { intent: 'general', confidence: 0 }
    }

    // Calculate term frequencies for the input
    const termFreqs = new Map<string, number>()
    for (const token of tokens) {
      termFreqs.set(token, (termFreqs.get(token) || 0) + 1)
    }

    let bestIntent = 'general'
    let bestScore = -Infinity

    const intentScores: { [intent: string]: number } = {}

    // Calculate probability for each intent using Naive Bayes
    for (const [intent, data] of this.intentData.entries()) {
      // Prior probability P(intent)
      const priorProb = data.documentCount / this.totalDocuments
      let logScore = Math.log(priorProb)

      // For each unique term in the input document
      for (const [term, freq] of termFreqs.entries()) {
        // Laplace smoothing: add 1 to term count, add vocabulary size to total
        const termCountInIntent = data.termCounts.get(term) || 0
        const smoothedCount = termCountInIntent + 1
        const smoothedTotal = data.totalTerms + this.vocabulary.size

        // P(term|intent) with Laplace smoothing
        const termProb = smoothedCount / smoothedTotal
        
        // Weight by TF-IDF
        const tfIdf = this.calculateTfIdf(term, freq, tokens.length)
        
        // Add weighted log probability (multiply by frequency for multiple occurrences)
        logScore += freq * Math.log(termProb) * (1 + tfIdf)
      }

      intentScores[intent] = logScore
      
      if (logScore > bestScore) {
        bestScore = logScore
        bestIntent = intent
      }
    }

    // (Debug logging removed for production)

    // Convert log score to confidence
    // Map log scores to a 0-1 confidence range
    if (bestScore === -Infinity) {
      return { intent: 'general', confidence: 0 }
    }

    // Calculate relative confidence by comparing to second-best score
    const sortedScores = Object.values(intentScores).sort((a, b) => b - a)
    const secondBest = sortedScores[1] || bestScore - 1

    // Confidence based on margin between best and second best
    const margin = bestScore - secondBest
    const confidence = Math.max(0.1, Math.min(1.0, margin / 5 + 0.3))

    return {
      intent: bestIntent,
      confidence: confidence
    }
  }
}

// Create singleton instance
const mlClassifier = new MLClassifier()

/**
 * Classify intent using ML approach
 */
export function mlClassify(message: string): MLClassificationResult {
  return mlClassifier.classify(message)
}