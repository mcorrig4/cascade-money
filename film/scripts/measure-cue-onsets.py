#!/usr/bin/env python3
"""W2 zero-lead decision: inspect PCM envelopes, preserving approved scene-2 measurements.

Whisper supplies search anchors, not final reveal times. RMS rises estimate acoustic
onsets; connected voiced words can have no unique consonant boundary. The evidence
records these cases instead of claiming phonetic precision from amplitude alone.
"""
import json, re, hashlib, subprocess
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
phrases=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {CUE_PHRASES} from './film/src/cues.ts'; console.log(JSON.stringify(CUE_PHRASES))"],cwd=ROOT.parent))
meta=json.loads((ROOT/'public/narration/narration.json').read_text())
normalize=lambda s: re.sub('[^a-z0-9$]','',s.lower())
approved={'hook-open':2.036,'stat-suppliers':5.416,'stat-factories':7.202,'stat-countries':9.148}
# Independent W2 audit: these transcript anchors fell in silence or a prior vowel.
# Explicit absolute source-time windows isolate the next acoustic event, rather
# than allowing the nearest noise-floor fluctuation to masquerade as speech.
review_windows={(9,'window-center'):(.32,.52), (9,'stress-flash'):(16.34,16.58),
 (9,'stress-end'):(24.6,24.86), (10,'zoom-out-again'):(.50,.72),
 (10,'word-forwards'):(5.62,5.84), (10,'money-plus-time'):(15.70,15.90),
 (10,'money-plus'):(16.20,16.40)}
rows=[]; overrides={}
for ss, items in phrases.items():
 s=int(ss)
 if s not in range(2,11):continue
 wav=ROOT/f'public/narration/scene-{s:02}.wav'
 words=json.loads((ROOT/f'public/narration/words/scene-{s:02}.json').read_text())['words']
 entry=next(x for x in meta if x['scene']==s)
 source=[(wav,0)]
 if entry.get('tailFile'):
  offset=entry['duration']+entry.get('tailGapSec',.25)
  tail=ROOT/'public/narration'/entry['tailFile']; source.append((tail,offset))
  tw=json.loads((ROOT/'public/narration/words'/Path(entry['tailFile']).with_suffix('.json')).read_text())['words']
  words += [dict(w,start=w['start']+offset,end=w['end']+offset) for w in tw]
 envelopes=[]
 for file,offset in source:
  pcm=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-f','f32le','-ac','1','-ar','24000','pipe:1']),dtype='<f4').astype(float)
  win=192; hop=48
  energy=np.convolve(pcm*pcm,np.ones(win)/win,mode='valid')[::hop]**.5
  envelopes.append((file,offset,energy,pcm))
 overrides[ss]={'wavMd5':hashlib.md5(wav.read_bytes()).hexdigest(),'cues':{}}
 if len(source)>1:overrides[ss]['tailMd5']=hashlib.md5(source[1][0].read_bytes()).hexdigest()
 cursor=0
 for item in items:
  tokens=[normalize(t) for t in item['phrase'].split()]
  match=next((i for i in range(cursor,len(words)-len(tokens)+1) if [normalize(w['word']) for w in words[i:i+len(tokens)]]==tokens),None)
  if match is None:continue
  cursor=match
  anchor=words[match]['start']; file,offset,env,pcm=next(x for x in reversed(envelopes) if anchor>=x[1])
  t=anchor-offset; lo=max(0,round((t-.12)/.002)); hi=min(len(env),round((t+.22)/.002)+1)
  review=review_windows.get((s,item['cue']))
  if review:lo=max(0,round(review[0]/.002));hi=min(len(env),round(review[1]/.002)+1)
  local=env[lo:hi]; peak=float(np.max(local)); floor=float(np.percentile(local,10))
  # A 12 dB rise from the local floor marks a burst following a pause.
  threshold=max(floor*10**(12/20),peak*.035)
  candidates=[j for j in range(lo+1,hi) if env[j-1]<threshold<=env[j] and np.mean(env[j:min(j+4,len(env))])>=threshold]
  strong=bool(candidates) and floor<peak*.20
  if strong:
   index=candidates[0] if review else min(candidates,key=lambda j:abs(j*.002-t)); onset=round(offset+index*.002,3); status='RMS rise in independently reviewed search window' if review else 'RMS rise'
  else:
   # Continuous speech: strongest positive envelope slope near transcript anchor.
   a=max(lo+1,round((t-.04)/.002)); b=min(hi,round((t+.06)/.002)+1)
   index=max(range(a,b),key=lambda j:env[j]-env[j-1]); onset=round(offset+index*.002,3); status='connected-speech estimate; phonetic review needed'
  if s==7 and item['cue']=='coin-pair':
   # RMS rise at 2.140 belongs to the preceding voiced word. /s/ enters
   # as a sustained high-frequency band before the vowel's 2.31s rise.
   ratios=[]
   for j in range(round(2.17/.002),round(2.24/.002)):
    chunk=pcm[j*48:j*48+192];power=np.abs(np.fft.rfft(chunk*np.hanning(192)))**2
    ratios.append((j,float(np.sum(power[np.fft.rfftfreq(192,1/24000)>3000])/np.sum(power))))
   index=next(j for k,(j,ratio) in enumerate(ratios[:-2]) if ratio>.5 and all(x[1]>.5 for x in ratios[k:k+3]))
   onset=round(index*.002,3);status='fricative-band estimate (>3kHz energy majority, 3 hops); phonetic review needed'
  if s==2 and item['cue'] in approved:onset=approved[item['cue']];status='approved prior waveform measurement'
  overrides[ss]['cues'][item['cue']]=onset
  rows.append(dict(scene=s,cue=item['cue'],phrase=item['phrase'],wordAnchor=anchor,onset=onset,frame30=int(onset*30+.5),method=status,reviewWindow=review,wav=file.name,localFloorRms=round(floor,7),localPeakRms=round(peak,7)))
(ROOT/'src/generated/onset-overrides.json').write_text(json.dumps(overrides,indent=2)+'\n')
(ROOT/'analysis/W2-onset-evidence.json').write_text(json.dumps(rows,indent=2)+'\n')
lines=['# W2 cue onset evidence','','PCM measurement: ffmpeg mono float32 at 24 kHz; 8 ms RMS windows, 2 ms hops; local search −120/+220 ms from transcript anchor. Select nearest sustained 12 dB rise above the local floor. Continuous voiced boundaries use the strongest local rising slope (−40/+60 ms), explicitly marked for phonetic review. An independent second pass widened or shifted seven named search windows where transcript anchors were in silence or the prior vowel; these explicit bounds are recorded in the evidence JSON. RMS analysis cannot establish exact consonant identity. This waveform audit used no Chrome, browser, or renderer. Four approved scene-2 measurements are retained. Onsets have zero lead and frames use `Math.round(seconds × 30)`. WAV MD5 guards are in `src/generated/onset-overrides.json`, including scene 7’s tail.','','| Scene | Cue | Onset (s) | Frame (30 fps) | Evidence |','|---|---|---:|---:|---|']
lines += [f"| {r['scene']} | `{r['cue']}` | {r['onset']:.3f} | {r['frame30']} | {r['method']} |" for r in rows]
(ROOT/'analysis/W2-cue-table.md').write_text('\n'.join(lines)+'\n')
