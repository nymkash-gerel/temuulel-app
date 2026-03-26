/**
 * Persona definitions for simulation testing.
 * Each persona represents a different type of customer with distinct
 * communication patterns, expectations, and behavior.
 */

export interface Persona {
  name: string
  description: string
  style: 'polite' | 'angry' | 'confused' | 'tech_savvy' | 'vip' | 'adversarial' | 'latin_typer' | 'returning'
  language: 'cyrillic' | 'latin' | 'mixed'
}

export const PERSONAS: Persona[] = [
  {
    name: 'Эелдэг хэрэглэгч',
    description: 'Polite customer browsing products',
    style: 'polite',
    language: 'cyrillic',
  },
  {
    name: 'Ууртай хэрэглэгч',
    description: 'Angry customer with complaint',
    style: 'angry',
    language: 'cyrillic',
  },
  {
    name: 'Төөрөлдсөн хэрэглэгч',
    description: 'Confused customer switching topics',
    style: 'confused',
    language: 'cyrillic',
  },
  {
    name: 'VIP худалдан авагч',
    description: 'Repeat buyer who knows what they want',
    style: 'vip',
    language: 'cyrillic',
  },
  {
    name: 'Латин бичигч',
    description: 'Types in Latin script (transliteration)',
    style: 'latin_typer',
    language: 'latin',
  },
  {
    name: 'Буцаалт хийгч',
    description: 'Customer requesting return/exchange',
    style: 'returning',
    language: 'mixed',
  },
  {
    name: 'Халдагч',
    description: 'Adversarial user testing system boundaries',
    style: 'adversarial',
    language: 'mixed',
  },
]
