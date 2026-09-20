import type {ThreatSettings} from './threat-utils';
export const WE_SOURCE='https://wahapedia.ru/wh40k11ed/factions/world-eaters/';
export const AM_SOURCE='https://wahapedia.ru/wh40k11ed/factions/adeptus-mechanicus/';
export const ruleOptions=[
 {id:'bloodlust',tag:'we',label:'Unbridled Bloodlust active: +1 charge',note:'Army blessing, selected at the start of the battle round. Battle-lust adds another +1 for its attached unit.',source:WE_SOURCE},
 {id:'frenzy',tag:'berzerkers',label:'Apoplectic Frenzy · 1CP: advance and charge',note:'Berzerkers only; use just after selecting the unit to Advance.',source:WE_SOURCE},
 {id:'motive',tag:'vehicle',label:'Motive Imperative · 1CP: +3 Move, +1 Advance/charge',note:'Select one AdMech VEHICLE unit in your Command phase; lasts until your next Command phase. Does not itself allow advance and charge.',source:AM_SOURCE},
 {id:'devotion',tag:'thulia',label:'Thulia: Fanatical Devotion — advance and charge',note:'Choose this Icon of War option in your Command phase, selecting one SKITARII or THULIA GHULD unit within 6″. Not Kastelans. No automatic proximity check.',source:AM_SOURCE+'Thulia-Ghuld'},
];
export function applyThreatRules(s:ThreatSettings,tags:string[]){
 const active=s.activeRules??[];const on=(id:string)=>active.includes(id)&&ruleOptions.some(r=>r.id===id&&tags.includes(r.tag));
 return {...s,move:s.move+(on('motive')?3:0),advanceBonus:(s.advanceBonus??0)+(on('motive')?1:0),chargeBonus:s.chargeBonus+(on('bloodlust')?(tags.includes('battle-lust')?2:1):0)+(on('motive')?1:0),rerollCharge:s.rerollCharge||tags.includes('battle-lust'),advanceCharge:s.advanceCharge||tags.includes('advance-charge')||on('frenzy')||on('devotion')};
}
