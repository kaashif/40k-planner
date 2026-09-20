'use client';
import {selectedProbabilityRange,meanRoll,type ThreatSettings} from './threat-utils';
import {applyThreatRules} from './threat-rules';
export default function ThreatPercentile({value,onChange,ruleTags=[]}:{value:ThreatSettings;onChange:(value:ThreatSettings)=>void;ruleTags?:string[]}){
 const effective=applyThreatRules(value,ruleTags),percent=value.percentile??50;
 const total=selectedProbabilityRange(effective,'charge');
 const sequence=[...(effective.useScout&&effective.scout>0?['Scout']:[]),'Move',...(effective.useAdvance&&effective.advanceCharge?['Advance']:[]),'Charge'].join(' + ');
 return <section className="threat-percentile" aria-label="Overall reach probability">
  <label htmlFor="threat-percentile">Overall probability <strong>{percent}%{percent===50?' · median':''}</strong></label>
  <input id="threat-percentile" aria-label="Overall reach probability" title="Chance of reaching the displayed total; higher percentages give shorter, safer reach" type="range" min="1" max="100" step="1" value={percent} onChange={e=>onChange({...value,percentile:Number(e.target.value)})}/>
  <div className="percentile-distances" aria-live="polite"><span>Total reach <b>{total>0?`${total}″`:'No eligible charge'}</b></span></div>
  <div className="percentile-rerolls">
   <label><input type="checkbox" aria-label="Advance reroll" checked={value.rerollAdvance??false} onChange={e=>onChange({...value,rerollAdvance:e.target.checked})}/>Advance reroll</label>
   <label title={ruleTags.includes('battle-lust')?'Battle-lust: built-in charge reroll':''}><input type="checkbox" aria-label="Charge reroll" checked={effective.rerollCharge??false} disabled={ruleTags.includes('battle-lust')} onChange={e=>onChange({...value,rerollCharge:e.target.checked})}/>Charge reroll{ruleTags.includes('battle-lust')?' (built-in)':''}</label>
  </div>
  <small className="mean-rolls" title="Mean raw dice before modifiers, rerolling a below-average result once. Percentile bands instead optimise the chance to reach each target distance.">Mean dice: Advance {meanRoll('advance',effective.rerollAdvance).toFixed(2)}″ · Charge {meanRoll('charge',effective.rerollCharge).toFixed(2)}″</small>
  <small className="overall-sequence" title="One joint probability across the entire sequence, including enabled rerolls. Scout and normal movement are fixed; Advance is included only when Advance and Charge is permitted.">{sequence} · one combined probability</small>
  <small title="50% shows median reach. With an unmodified D6 the median and mean Advance are both 3.5 inches; rerolls can make the mean and median differ.">Chance to reach: higher % = safer, shorter reach.</small>
 </section>;
}
