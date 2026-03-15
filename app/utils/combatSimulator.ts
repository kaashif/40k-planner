// Pure analytical combat simulator for Warhammer 40k
// Computes exact expected values through the hit → wound → save → damage pipeline

export interface AttackerInput {
  attacks: string;       // e.g. "3", "D6", "D3+1"
  skill: number;         // BS or WS as number (e.g. 3 for 3+)
  strength: number;
  ap: number;            // positive number, e.g. AP -2 is stored as 2
  damage: string;        // e.g. "1", "D3", "D6+1"
  keywords: string[];    // weapon keywords
  modelCount: number;    // number of attacking models
}

export interface DefenderInput {
  toughness: number;
  save: number;          // armor save (e.g. 3 for 3+)
  invuln: number | null; // invuln save or null
  wounds: number;        // wounds per model
  modelCount: number;
  fnp: number | null;    // feel no pain (e.g. 5 for 5+) or null
  keywords: string[];    // unit keywords (for Anti-X)
}

export interface ModifierToggles {
  stationary: boolean;   // for Heavy
  charged: boolean;      // for Lance
  halfRange: boolean;    // for Melta
  cover: boolean;        // target in cover
  rapidFire: boolean;    // for Rapid Fire
}

export interface CombatResult {
  expectedAttacks: number;
  expectedHits: number;
  expectedWounds: number;
  expectedUnsavedWounds: number;
  expectedDamage: number;
  expectedModelsKilled: number;
  expectedSelfMortals: number;
  mortalWoundDamage: number;
  expectedDamagePerWound: number;
  // Intermediate probabilities for display
  hitProbability: number;
  woundProbability: number;
  saveFailProbability: number;
  // Roll needed (for display)
  hitRollNeeded: number | null; // null = auto-hit (Torrent)
  woundRollNeeded: number;
  saveRollNeeded: number; // effective save the defender needs
  // Keyword effects active
  hitNotes: string[];
  woundNotes: string[];
  saveNotes: string[];
  damageNotes: string[];
}

/**
 * Parse a dice expression and return its expected value.
 * Examples: "3" → 3, "D6" → 3.5, "D3" → 2, "D3+1" → 3, "2D6" → 7, "D6+3" → 6.5
 */
export function parseDiceExpected(expr: string): number {
  if (!expr || expr === '-' || expr === 'N/A') return 0;

  const s = expr.trim().toUpperCase();

  // Match patterns like "2D6+3", "D3+1", "D6", "3"
  const diceMatch = s.match(/^(\d*)D(\d+)([+-]\d+)?$/);
  if (diceMatch) {
    const count = diceMatch[1] ? parseInt(diceMatch[1]) : 1;
    const sides = parseInt(diceMatch[2]);
    const modifier = diceMatch[3] ? parseInt(diceMatch[3]) : 0;
    return count * (sides + 1) / 2 + modifier;
  }

  // Plain number
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse a stat value like "3+" → 3, "4" → 4
 */
export function parseStatValue(str: string): number {
  if (!str) return 0;
  return parseInt(str.replace('+', '').replace('"', '').trim());
}

/**
 * Get a keyword's numeric parameter.
 * e.g. getKeywordParam(keywords, "Sustained Hits") → 1 from "Sustained Hits 1"
 *      getKeywordParam(keywords, "Anti-Infantry") → 4 from "Anti-Infantry 4+"
 */
export function getKeywordParam(keywords: string[], prefix: string): number | null {
  for (const kw of keywords) {
    if (kw.toLowerCase().startsWith(prefix.toLowerCase())) {
      const rest = kw.slice(prefix.length).trim().replace('+', '');
      const num = parseInt(rest);
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

/**
 * Check if keywords contain a specific keyword (case-insensitive)
 */
export function hasKeyword(keywords: string[], keyword: string): boolean {
  return keywords.some(kw => kw.toLowerCase() === keyword.toLowerCase());
}

/**
 * Check if keywords contain a keyword starting with prefix
 */
export function hasKeywordPrefix(keywords: string[], prefix: string): boolean {
  return keywords.some(kw => kw.toLowerCase().startsWith(prefix.toLowerCase()));
}

/**
 * Calculate wound threshold based on Strength vs Toughness
 */
export function calculateWoundThreshold(strength: number, toughness: number): number {
  if (strength >= 2 * toughness) return 2;
  if (strength > toughness) return 3;
  if (strength === toughness) return 4;
  if (strength * 2 <= toughness) return 6;
  return 5; // strength < toughness
}

/**
 * Probability of rolling N+ on a D6, with nat 1 always failing and nat 6 always succeeding
 */
function probOfNPlus(n: number): number {
  if (n <= 1) return 1;
  if (n >= 7) return 0;
  // Nat 1 always fails, nat 6 always succeeds
  return Math.min(5 / 6, Math.max(1 / 6, (7 - n) / 6));
}

/**
 * Main calculation: compute exact expected values for the full combat pipeline
 */
export function calculateResults(
  attacker: AttackerInput,
  defender: DefenderInput,
  modifiers: ModifierToggles
): CombatResult {
  const weaponKw = attacker.keywords;

  // --- Attack count ---
  let expectedAttacksPerModel = parseDiceExpected(attacker.attacks);

  // Blast: +1 attack per 5 defender models
  if (hasKeyword(weaponKw, 'Blast')) {
    expectedAttacksPerModel += Math.floor(defender.modelCount / 5);
  }

  // Rapid Fire X: +X attacks if toggled
  if (modifiers.rapidFire) {
    const rfVal = getKeywordParam(weaponKw, 'Rapid Fire');
    if (rfVal !== null) {
      expectedAttacksPerModel += rfVal;
    }
  }

  const totalExpectedAttacks = expectedAttacksPerModel * attacker.modelCount;

  // --- Hit probability ---
  let effectiveSkill = attacker.skill;
  const isTorrent = hasKeyword(weaponKw, 'Torrent');
  const isHeavy = hasKeyword(weaponKw, 'Heavy');
  const isIndirectFire = hasKeyword(weaponKw, 'Indirect Fire');

  if (isIndirectFire) {
    effectiveSkill += 1; // worse to hit
  }
  if (isHeavy && modifiers.stationary) {
    effectiveSkill -= 1; // better to hit
  }

  const hitProb = isTorrent ? 1.0 : probOfNPlus(effectiveSkill);

  // Sustained Hits X: nat 6 generates X extra hits
  const sustainedX = getKeywordParam(weaponKw, 'Sustained Hits');
  let expectedHitsPerAttack = hitProb;
  if (sustainedX !== null) {
    // 1/6 of attacks are nat 6s that generate X extra hits
    expectedHitsPerAttack = hitProb + (1 / 6) * sustainedX;
  }

  const totalExpectedHits = totalExpectedAttacks * expectedHitsPerAttack;

  // Lethal Hits: 1/6 of hits auto-wound (skip wound roll)
  const isLethalHits = hasKeyword(weaponKw, 'Lethal Hits');
  let normalHits = totalExpectedHits;
  let lethalHits = 0;
  if (isLethalHits) {
    // 1/6 of the attacks that hit are nat 6s → auto-wound
    // Fraction of hits that are lethal = (1/6) / hitProb (since 1/6 of attacks are nat 6)
    // But if hitProb includes sustained hits bonus, we need base hit prob
    const fractionLethal = isTorrent ? 0 : (1 / 6) / hitProb;
    lethalHits = totalExpectedHits * Math.min(fractionLethal, 1);
    normalHits = totalExpectedHits - lethalHits;
  }

  // Hazardous: 1/6 chance of mortal wound to self per attack
  const isHazardous = hasKeyword(weaponKw, 'Hazardous');
  const expectedSelfMortals = isHazardous ? totalExpectedAttacks * (1 / 6) : 0;

  // --- Wound probability ---
  let woundThreshold = calculateWoundThreshold(attacker.strength, defender.toughness);

  // Anti-KEYWORD: check if target has relevant keyword
  for (const kw of weaponKw) {
    const antiMatch = kw.match(/^Anti-(.+?)\s+(\d)\+?$/i);
    if (antiMatch) {
      const antiKeyword = antiMatch[1];
      const antiThreshold = parseInt(antiMatch[2]);
      // Check if defender has that keyword
      if (defender.keywords.some(dk => dk.toLowerCase().includes(antiKeyword.toLowerCase()))) {
        woundThreshold = Math.min(woundThreshold, antiThreshold);
      }
    }
  }

  // Lance: +1 to wound if charged
  if (hasKeyword(weaponKw, 'Lance') && modifiers.charged) {
    woundThreshold = Math.max(2, woundThreshold - 1);
  }

  let woundProb = probOfNPlus(woundThreshold);

  // Twin-linked: re-roll failed wounds
  if (hasKeyword(weaponKw, 'Twin-linked')) {
    const failProb = 1 - woundProb;
    woundProb = woundProb + failProb * woundProb;
  }

  // Devastating Wounds: nat 6 to wound = mortal wound (bypass saves)
  const isDevastatingWounds = hasKeyword(weaponKw, 'Devastating Wounds');
  let normalWounds = normalHits * woundProb;
  let mortalWoundsFromDev = 0;
  if (isDevastatingWounds) {
    // 1/6 of wound rolls are nat 6 → mortal wound
    const fractionDev = (1 / 6) / woundProb;
    mortalWoundsFromDev = normalWounds * Math.min(fractionDev, 1);
    normalWounds = normalWounds - mortalWoundsFromDev;
  }

  // Lethal hits go straight to wound (auto-wound), add them
  const totalExpectedWounds = normalWounds + lethalHits + mortalWoundsFromDev;

  // --- Save calculation ---
  let effectiveSave = defender.save + attacker.ap; // AP makes save worse

  // Cover: improves save by 1 (unless Ignores Cover)
  const ignoresCover = hasKeyword(weaponKw, 'Ignores Cover');
  if (modifiers.cover && !ignoresCover) {
    effectiveSave -= 1;
  }

  // Indirect Fire: target gets cover benefit
  if (isIndirectFire && !ignoresCover) {
    effectiveSave -= 1;
  }

  // Use invuln if better
  let bestSave = effectiveSave;
  if (defender.invuln !== null) {
    bestSave = Math.min(effectiveSave, defender.invuln);
  }

  const saveProb = probOfNPlus(bestSave);
  const saveFailProb = 1 - saveProb;

  // Normal wounds go through saves; lethal hits that auto-wounded also go through saves
  // Mortal wounds from Devastating Wounds bypass saves
  const woundsToSave = normalWounds + lethalHits;
  const unsavedWounds = woundsToSave * saveFailProb + mortalWoundsFromDev;

  // --- Damage ---
  let expectedDamagePerWound = parseDiceExpected(attacker.damage);

  // Melta X: +X to damage if half range toggled
  if (modifiers.halfRange) {
    const meltaX = getKeywordParam(weaponKw, 'Melta');
    if (meltaX !== null) {
      expectedDamagePerWound += meltaX;
    }
  }

  let totalExpectedDamage = unsavedWounds * expectedDamagePerWound;

  // Mortal wound damage (from Devastating Wounds) is just the mortal wounds themselves
  // Actually, mortal wounds do 1 damage each, already counted in unsavedWounds
  // The "mortalWoundsFromDev" bypass saves and do damage equal to the weapon damage?
  // No - devastating wounds in 10th edition: the wound becomes mortal wounds equal to the damage characteristic
  // Actually in current 10th ed, devastating wounds just bypass the save - they don't become mortal wounds that equal the damage.
  // The unsaved wounds calculation already accounts for this correctly.

  const mortalWoundDamage = mortalWoundsFromDev * expectedDamagePerWound;

  // FNP: each point of damage has chance to be ignored
  if (defender.fnp !== null) {
    const fnpProb = probOfNPlus(defender.fnp);
    totalExpectedDamage *= (1 - fnpProb);
  }

  // Models killed (approximate)
  const expectedModelsKilled = defender.wounds > 0
    ? Math.min(Math.floor(totalExpectedDamage / defender.wounds), defender.modelCount)
    : 0;

  // Build explanation notes
  const hitNotes: string[] = [];
  if (isTorrent) hitNotes.push('Torrent: auto-hits');
  if (isHeavy && modifiers.stationary) hitNotes.push('Heavy + Stationary: +1 to hit');
  if (isIndirectFire) hitNotes.push('Indirect Fire: -1 to hit');
  if (sustainedX !== null) hitNotes.push(`Sustained Hits ${sustainedX}: 6s generate ${sustainedX} extra hit${sustainedX > 1 ? 's' : ''}`);
  if (isLethalHits) hitNotes.push('Lethal Hits: 6s auto-wound');
  if (isHazardous) hitNotes.push('Hazardous: 1/6 chance mortal to self per attack');

  const woundNotes: string[] = [];
  woundNotes.push(`S${attacker.strength} vs T${defender.toughness}`);
  for (const kw of weaponKw) {
    const antiMatch = kw.match(/^Anti-(.+?)\s+(\d)\+?$/i);
    if (antiMatch && defender.keywords.some(dk => dk.toLowerCase().includes(antiMatch[1].toLowerCase()))) {
      woundNotes.push(`${kw}: overrides to ${antiMatch[2]}+`);
    }
  }
  if (hasKeyword(weaponKw, 'Lance') && modifiers.charged) woundNotes.push('Lance + Charged: +1 to wound');
  if (hasKeyword(weaponKw, 'Twin-linked')) woundNotes.push('Twin-linked: re-roll failed wounds');
  if (isDevastatingWounds) woundNotes.push('Devastating Wounds: 6s bypass saves');

  const saveNotes: string[] = [];
  saveNotes.push(`${defender.save}+ save, AP -${attacker.ap}`);
  if (modifiers.cover && !ignoresCover) saveNotes.push('Cover: +1 to save');
  if (isIndirectFire && !ignoresCover) saveNotes.push('Indirect Fire: target gets cover');
  if (ignoresCover) saveNotes.push('Ignores Cover');
  if (defender.invuln !== null && defender.invuln < effectiveSave) saveNotes.push(`Using ${defender.invuln}+ invuln (better than modified ${effectiveSave}+)`);

  const damageNotes: string[] = [];
  damageNotes.push(`${attacker.damage} damage per wound`);
  if (modifiers.halfRange && getKeywordParam(weaponKw, 'Melta') !== null) {
    damageNotes.push(`Melta + half range: +${getKeywordParam(weaponKw, 'Melta')} damage`);
  }
  if (defender.fnp !== null) damageNotes.push(`FNP ${defender.fnp}+: ${((1 - probOfNPlus(defender.fnp)) * 100).toFixed(0)}% damage ignored`);

  return {
    expectedAttacks: totalExpectedAttacks,
    expectedHits: totalExpectedHits,
    expectedWounds: totalExpectedWounds,
    expectedUnsavedWounds: unsavedWounds,
    expectedDamage: totalExpectedDamage,
    expectedModelsKilled,
    expectedSelfMortals,
    mortalWoundDamage,
    expectedDamagePerWound,
    hitProbability: hitProb,
    woundProbability: woundProb,
    saveFailProbability: saveFailProb,
    hitRollNeeded: isTorrent ? null : effectiveSkill,
    woundRollNeeded: woundThreshold,
    saveRollNeeded: bestSave,
    hitNotes,
    woundNotes,
    saveNotes,
    damageNotes,
  };
}

/**
 * Parse weapon keywords string into array
 */
export function parseKeywords(keywordsStr: string): string[] {
  if (!keywordsStr || keywordsStr === '-') return [];
  return keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
}
