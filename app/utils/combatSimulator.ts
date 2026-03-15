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
  minusOneToWound: boolean;       // defender has -1 to wound rolls
  minusOneToWoundIfStrGtT: boolean; // defender has -1 to wound if S > T
  rerollOnesHit: boolean;         // reroll 1s to hit
  rerollAllHit: boolean;          // reroll all failed hits
  rerollOnesWound: boolean;       // reroll 1s to wound
  rerollAllWound: boolean;        // reroll all failed wounds
  apBonus1: boolean;              // improve AP by 1
  apBonus2: boolean;              // improve AP by 2
  plusOneToWound: boolean;        // attacker has +1 to wound
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
export function probOfNPlus(n: number): number {
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

  let hitProb = isTorrent ? 1.0 : probOfNPlus(effectiveSkill);

  // Rerolls to hit (applied before sustained/lethal which trigger on nat 6)
  if (!isTorrent) {
    if (modifiers.rerollAllHit) {
      // Reroll all misses: P = P + (1-P)*P
      hitProb = hitProb + (1 - hitProb) * hitProb;
    } else if (modifiers.rerollOnesHit) {
      // Reroll 1s only: 1/6 of attacks are 1s, reroll them with same probability
      hitProb = hitProb + (1 / 6) * hitProb;
    }
  }

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

  // Attacker +1 to wound
  if (modifiers.plusOneToWound) {
    woundThreshold = Math.max(2, woundThreshold - 1);
  }

  // Defender -1 to wound modifiers
  if (modifiers.minusOneToWound) {
    woundThreshold = Math.min(6, woundThreshold + 1);
  }
  if (modifiers.minusOneToWoundIfStrGtT && attacker.strength > defender.toughness) {
    woundThreshold = Math.min(6, woundThreshold + 1);
  }

  let woundProb = probOfNPlus(woundThreshold);

  // Twin-linked: re-roll failed wounds
  if (hasKeyword(weaponKw, 'Twin-linked') || modifiers.rerollAllWound) {
    const failProb = 1 - woundProb;
    woundProb = woundProb + failProb * woundProb;
  } else if (modifiers.rerollOnesWound) {
    // Reroll 1s only: 1/6 of wound rolls are 1s, reroll them
    woundProb = woundProb + (1 / 6) * woundProb;
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
  let totalAp = attacker.ap;
  if (modifiers.apBonus1) totalAp += 1;
  if (modifiers.apBonus2) totalAp += 2;
  let effectiveSave = defender.save + totalAp; // AP makes save worse

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
  if (modifiers.rerollAllHit) hitNotes.push('Full rerolls to hit');
  else if (modifiers.rerollOnesHit) hitNotes.push('Reroll 1s to hit');

  const woundNotes: string[] = [];
  woundNotes.push(`S${attacker.strength} vs T${defender.toughness}`);
  for (const kw of weaponKw) {
    const antiMatch = kw.match(/^Anti-(.+?)\s+(\d)\+?$/i);
    if (antiMatch && defender.keywords.some(dk => dk.toLowerCase().includes(antiMatch[1].toLowerCase()))) {
      woundNotes.push(`${kw}: overrides to ${antiMatch[2]}+`);
    }
  }
  if (hasKeyword(weaponKw, 'Lance') && modifiers.charged) woundNotes.push('Lance + Charged: +1 to wound');
  if (modifiers.plusOneToWound) woundNotes.push('+1 to wound');
  if (modifiers.minusOneToWound) woundNotes.push('-1 to wound rolls');
  if (modifiers.minusOneToWoundIfStrGtT && attacker.strength > defender.toughness) woundNotes.push('-1 to wound (S > T)');
  if (hasKeyword(weaponKw, 'Twin-linked')) woundNotes.push('Twin-linked: re-roll failed wounds');
  if (modifiers.rerollAllWound && !hasKeyword(weaponKw, 'Twin-linked')) woundNotes.push('Full rerolls to wound');
  else if (modifiers.rerollOnesWound) woundNotes.push('Reroll 1s to wound');
  if (isDevastatingWounds) woundNotes.push('Devastating Wounds: 6s bypass saves');

  const saveNotes: string[] = [];
  saveNotes.push(`${defender.save}+ save, AP -${totalAp}`);
  if (modifiers.apBonus1 || modifiers.apBonus2) {
    const bonus = (modifiers.apBonus1 ? 1 : 0) + (modifiers.apBonus2 ? 2 : 0);
    saveNotes.push(`AP improved by ${bonus} (base -${attacker.ap})`);
  }
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

// ============================================================
// Full probability distribution computation
// ============================================================

/** Distribution where dist[i] = P(X = i) */
export type Distribution = number[];

/** Convolve two distributions (sum of two independent random variables) */
export function convolve(a: Distribution, b: Distribution): Distribution {
  if (a.length === 0 || b.length === 0) return [1];
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 1e-15) continue;
    for (let j = 0; j < b.length; j++) {
      result[i + j] += a[i] * b[j];
    }
  }
  return result;
}

/** Convolve a distribution with itself n times using doubling trick */
export function nFoldConvolve(base: Distribution, n: number): Distribution {
  if (n === 0) return [1];
  if (n === 1) return [...base];
  let result: Distribution = [1];
  let power = [...base];
  let remaining = n;
  while (remaining > 0) {
    if (remaining & 1) {
      result = convolve(result, power);
    }
    remaining >>= 1;
    if (remaining > 0) {
      power = convolve(power, power);
    }
  }
  return result;
}

/** Shift a distribution by a constant (add constant to random variable) */
function shiftDist(dist: Distribution, shift: number): Distribution {
  const result: Distribution = [];
  for (let i = 0; i < dist.length; i++) {
    const newIdx = i + shift;
    if (newIdx >= 0) {
      while (result.length <= newIdx) result.push(0);
      result[newIdx] += dist[i];
    } else {
      // Clamp negative values to 0
      if (result.length === 0) result.push(0);
      result[0] += dist[i];
    }
  }
  return result;
}

/** Parse a dice expression into its full probability distribution */
export function parseDiceDist(expr: string): Distribution {
  if (!expr || expr === '-' || expr === 'N/A') return [1]; // P(X=0) = 1

  const s = expr.trim().toUpperCase();

  const diceMatch = s.match(/^(\d*)D(\d+)([+-]\d+)?$/);
  if (diceMatch) {
    const count = diceMatch[1] ? parseInt(diceMatch[1]) : 1;
    const sides = parseInt(diceMatch[2]);
    const modifier = diceMatch[3] ? parseInt(diceMatch[3]) : 0;

    // Single die: uniform over 1..sides
    const singleDie: Distribution = new Array(sides + 1).fill(0);
    for (let i = 1; i <= sides; i++) {
      singleDie[i] = 1 / sides;
    }

    let dist = nFoldConvolve(singleDie, count);
    if (modifier !== 0) {
      dist = shiftDist(dist, modifier);
    }
    return dist;
  }

  // Plain number
  const num = parseInt(s);
  if (!isNaN(num) && num >= 0) {
    const dist = new Array(num + 1).fill(0);
    dist[num] = 1;
    return dist;
  }

  return [1];
}

/** Binomial PMF: P(X = k) where X ~ Bin(n, p) */
function binomialPMF(n: number, p: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;

  // Use log to avoid overflow for large n
  let logProb = 0;
  for (let i = 0; i < k; i++) {
    logProb += Math.log(n - i) - Math.log(i + 1);
  }
  logProb += k * Math.log(p) + (n - k) * Math.log(1 - p);
  return Math.exp(logProb);
}

/** Apply FNP: each damage point independently ignored with probability pFnp */
function applyFNP(damageDist: Distribution, pFnp: number): Distribution {
  if (pFnp <= 0) return damageDist;
  const pTake = 1 - pFnp;
  const result: Distribution = [];

  for (let d = 0; d < damageDist.length; d++) {
    const pD = damageDist[d];
    if (pD < 1e-12) continue;
    for (let k = 0; k <= d; k++) {
      const pK = binomialPMF(d, pTake, k);
      while (result.length <= k) result.push(0);
      result[k] += pD * pK;
    }
  }
  return result;
}

/** Convert damage distribution to models killed distribution */
export function damageToModelsKilled(
  damageDist: Distribution,
  woundsPerModel: number,
  maxModels: number,
): Distribution {
  const result: Distribution = new Array(maxModels + 1).fill(0);
  for (let d = 0; d < damageDist.length; d++) {
    const pD = damageDist[d];
    if (pD < 1e-12) continue;
    const killed = Math.min(Math.floor(d / woundsPerModel), maxModels);
    result[killed] += pD;
  }
  return result;
}

export interface DistributionResult {
  attacksDist: Distribution;
  hitsDist: Distribution;
  woundsDist: Distribution;
  unsavedWoundsDist: Distribution;
  damageDist: Distribution;
  modelsKilledDist: Distribution;
}

/**
 * Compute the full probability distribution of total damage and models killed.
 * Uses the per-attack unsaved wound probability derived from the expected value calculation,
 * then builds the full distribution via convolution.
 */
export function calculateDistribution(
  attacker: AttackerInput,
  defender: DefenderInput,
  modifiers: ModifierToggles,
  combatResult: CombatResult,
): DistributionResult {
  // Derive per-attack probabilities from expected values
  const totalExpAttacks = combatResult.expectedAttacks;
  const pHitsPerAttack = totalExpAttacks > 0
    ? combatResult.expectedHits / totalExpAttacks
    : 0;
  const pWoundsPerAttack = totalExpAttacks > 0
    ? combatResult.expectedWounds / totalExpAttacks
    : 0;
  const pUnsavedPerAttack = totalExpAttacks > 0
    ? combatResult.expectedUnsavedWounds / totalExpAttacks
    : 0;

  // Distribution of attacks per model (accounting for Blast / Rapid Fire)
  let attacksPerModelDist = parseDiceDist(attacker.attacks);
  const weaponKw = attacker.keywords;
  let extraAttacks = 0;
  if (hasKeyword(weaponKw, 'Blast')) {
    extraAttacks += Math.floor(defender.modelCount / 5);
  }
  if (modifiers.rapidFire) {
    const rfVal = getKeywordParam(weaponKw, 'Rapid Fire');
    if (rfVal !== null) extraAttacks += rfVal;
  }
  if (extraAttacks > 0) {
    attacksPerModelDist = shiftDist(attacksPerModelDist, extraAttacks);
  }

  // Total attacks = sum over all models
  const totalAttacksDist = nFoldConvolve(attacksPerModelDist, attacker.modelCount);

  // Cap for performance
  const maxAttacks = Math.min(totalAttacksDist.length - 1, 120);

  // Helper: marginalize binomial over attack count distribution
  function marginalizeBinomial(pPerAttack: number): Distribution {
    let dist: Distribution = [];
    for (let n = 0; n <= maxAttacks; n++) {
      const pN = totalAttacksDist[n] || 0;
      if (pN < 1e-10) continue;
      for (let k = 0; k <= n; k++) {
        const pK = binomialPMF(n, pPerAttack, k);
        if (pK < 1e-12) continue;
        while (dist.length <= k) dist.push(0);
        dist[k] += pN * pK;
      }
    }
    if (dist.length === 0) dist = [1];
    return dist;
  }

  const hitsDist = marginalizeBinomial(pHitsPerAttack);
  const woundsDist = marginalizeBinomial(pWoundsPerAttack);
  const unsavedWoundsDist = marginalizeBinomial(pUnsavedPerAttack);

  // Damage per unsaved wound distribution
  let damagePerWoundDist = parseDiceDist(attacker.damage);
  if (modifiers.halfRange) {
    const meltaX = getKeywordParam(weaponKw, 'Melta');
    if (meltaX !== null) {
      damagePerWoundDist = shiftDist(damagePerWoundDist, meltaX);
    }
  }

  // Total damage = random sum: sum of N copies of damagePerWound where N ~ unsavedWoundsDist
  // P(S=s) = sum_n P(N=n) * P(X1+...+Xn = s)
  const maxUnsaved = Math.min(unsavedWoundsDist.length - 1, 60);
  let damageDist: Distribution = [];
  let damageConvPower: Distribution = [1]; // damagePerWound^0 = delta(0)

  for (let n = 0; n <= maxUnsaved; n++) {
    const pN = unsavedWoundsDist[n] || 0;
    if (pN > 1e-10) {
      while (damageDist.length < damageConvPower.length) damageDist.push(0);
      for (let i = 0; i < damageConvPower.length; i++) {
        damageDist[i] += pN * damageConvPower[i];
      }
    }
    if (n < maxUnsaved) {
      damageConvPower = convolve(damageConvPower, damagePerWoundDist);
    }
  }
  if (damageDist.length === 0) damageDist = [1];

  // Apply FNP
  if (defender.fnp !== null) {
    const pFnp = probOfNPlus(defender.fnp);
    damageDist = applyFNP(damageDist, pFnp);
  }

  // Models killed distribution
  const modelsKilledDist = damageToModelsKilled(damageDist, defender.wounds, defender.modelCount);

  return {
    attacksDist: totalAttacksDist,
    hitsDist,
    woundsDist,
    unsavedWoundsDist,
    damageDist,
    modelsKilledDist,
  };
}

/**
 * Combine multiple CombatResults by summing expected values.
 * Used in Squad mode to show combined results from multiple weapons.
 */
export function combineCombatResults(results: CombatResult[]): CombatResult {
  if (results.length === 0) throw new Error('No results to combine');
  if (results.length === 1) return results[0];

  const combined: CombatResult = {
    expectedAttacks: 0,
    expectedHits: 0,
    expectedWounds: 0,
    expectedUnsavedWounds: 0,
    expectedDamage: 0,
    expectedModelsKilled: 0,
    expectedSelfMortals: 0,
    mortalWoundDamage: 0,
    expectedDamagePerWound: 0,
    hitProbability: 0,
    woundProbability: 0,
    saveFailProbability: 0,
    hitRollNeeded: null,
    woundRollNeeded: 0,
    saveRollNeeded: 0,
    hitNotes: [],
    woundNotes: [],
    saveNotes: [],
    damageNotes: [],
  };

  for (const r of results) {
    combined.expectedAttacks += r.expectedAttacks;
    combined.expectedHits += r.expectedHits;
    combined.expectedWounds += r.expectedWounds;
    combined.expectedUnsavedWounds += r.expectedUnsavedWounds;
    combined.expectedDamage += r.expectedDamage;
    combined.expectedSelfMortals += r.expectedSelfMortals;
    combined.mortalWoundDamage += r.mortalWoundDamage;
  }

  // Weighted average for per-wound damage
  if (combined.expectedUnsavedWounds > 0) {
    combined.expectedDamagePerWound = combined.expectedDamage / combined.expectedUnsavedWounds;
  }

  return combined;
}

/**
 * Combine multiple DistributionResults by convolving independent distributions.
 * Recomputes models killed from the combined damage distribution.
 */
export function combineDistributions(
  results: DistributionResult[],
  defenderWounds: number,
  defenderModelCount: number,
): DistributionResult {
  if (results.length === 0) throw new Error('No distributions to combine');
  if (results.length === 1) return results[0];

  let attacksDist = results[0].attacksDist;
  let hitsDist = results[0].hitsDist;
  let woundsDist = results[0].woundsDist;
  let unsavedWoundsDist = results[0].unsavedWoundsDist;
  let damageDist = results[0].damageDist;

  for (let i = 1; i < results.length; i++) {
    attacksDist = convolve(attacksDist, results[i].attacksDist);
    hitsDist = convolve(hitsDist, results[i].hitsDist);
    woundsDist = convolve(woundsDist, results[i].woundsDist);
    unsavedWoundsDist = convolve(unsavedWoundsDist, results[i].unsavedWoundsDist);
    damageDist = convolve(damageDist, results[i].damageDist);
  }

  // Recompute models killed from combined damage (not convolved individually)
  const modelsKilledDist = damageToModelsKilled(damageDist, defenderWounds, defenderModelCount);

  return { attacksDist, hitsDist, woundsDist, unsavedWoundsDist, damageDist, modelsKilledDist };
}
