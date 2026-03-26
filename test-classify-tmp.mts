import { classifyIntent } from './src/lib/intent-classifier.js'

const msg = 'Hi minii zahialsan boolt havchaar unuudur ireh uu☺️'
const result = classifyIntent(msg)
console.log('Intent:', result.intent)
console.log('Scores:', JSON.stringify(result.scores))
