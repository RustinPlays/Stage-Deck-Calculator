/* Stage Deck Calculator add-on: Auto Build. Loads after app.js. */
(() => {
  'use strict';
  const KEY = 'stage-deck-calculator-v1';
  const families = {
    av: [{type:'1800x1200', w:1800,h:1200}, {type:'2400x1200',w:2400,h:1200}],
    euro: [{type:'1000x2000',w:1000,h:2000}, {type:'2000x500',w:2000,h:500}]
  };
  const rotate = v => [{...v},{...v,w:v.h,h:v.w}];
  const section = document.querySelector('.layout-controls');
  if (!section) return;
  const panel = document.createElement('div');
  panel.className = 'control-cluster divided';
  panel.innerHTML = `<span class="control-section-title">Auto Build</span>
    <label><span>Width (m)</span><input id="autoWidth" type="number" min="0.5" max="50" step="0.1" value="8"></label>
    <label><span>Depth (m)</span><input id="autoDepth" type="number" min="0.5" max="50" step="0.1" value="3"></label>
    <label><span>Deck system</span><select id="autoSystem"><option value="av">AV — 1.2×1.8 / 1.2×2.4</option><option value="euro">Euro — 1×2 / 0.5×2</option></select></label>
    <button class="button primary" type="button" id="autoBuildBtn">✦ Auto Build</button>
    <small id="autoSummary" role="status" style="color:var(--muted);line-height:1.4">Closest equal-or-larger stage size, with the fewest decks where possible.</small>`;
  const add = [...section.querySelectorAll('.control-cluster')].find(x=>x.textContent.includes('Add deck'));
  section.insertBefore(panel, add || section.firstChild);
  const $ = id => document.getElementById(id);

  // Tiling strategy: pack each full-width horizontal strip with valid module orientations.
  // Width DP for every strip height; depth DP then combines strips into a gap-free rectangle.
  function bestPlan(targetW, targetH, system) {
    const options = families[system].flatMap(rotate);
    const unit = 100; // existing calculator's 100 mm grid
    const W = Math.ceil(targetW / unit), H = Math.ceil(targetH / unit);
    if (W > 500 || H > 500) throw new Error('Maximum stage size is 50 × 50 m.');
    const uniqueHeights = [...new Set(options.map(o => o.h / unit))];
    const maxW = W + Math.max(...options.map(o=>o.w/unit)) * 3;
    const strips = [];
    for (const height of uniqueHeights) {
      const opts = options.filter(o=>o.h/unit===height);
      const dp = Array(maxW+1).fill(null); dp[0] = {count:0, prev:-1, option:null};
      for (let x=1;x<=maxW;x++) for (const opt of opts) {
        const step=opt.w/unit, prior=dp[x-step];
        if (prior && (!dp[x] || prior.count+1<dp[x].count)) dp[x]={count:prior.count+1,prev:x-step,option:opt};
      }
      for (let x=W;x<=maxW;x++) if(dp[x]) {
        const parts=[];let cur=x;
        while(cur>0){parts.push(dp[cur].option);cur=dp[cur].prev;}
        strips.push({height,width:x,parts,count:parts.length});
      }
    }
    if (!strips.length) throw new Error('No stage build was found.');
    // Widths must match across all strips: no holes or staggered edges.
    const widths=[...new Set(strips.map(s=>s.width))].sort((a,b)=>a-b);
    let best=null;
    for (const width of widths) {
      if(best && width > best.width && width*H > best.area) break;
      const candidates=strips.filter(s=>s.width===width);
      const maxD=H+Math.max(...uniqueHeights)*2;
      const dp=Array(maxD+1).fill(null);dp[0]={count:0,prev:-1,strip:null};
      for(let d=1;d<=maxD;d++)for(const strip of candidates){
        const before=dp[d-strip.height];
        if(before && (!dp[d] || before.count+strip.count<dp[d].count)) dp[d]={count:before.count+strip.count,prev:d-strip.height,strip};
      }
      for(let d=H;d<=maxD;d++) if(dp[d]) {
        const score=[width*d, (width-W)+(d-H), dp[d].count];
        if(!best || score[0]<best.score[0] || (score[0]===best.score[0] && (score[1]<best.score[1] || (score[1]===best.score[1] && score[2]<best.score[2])))) best={width,depth:d,dp,score,area:score[0]};
      }
    }
    if(!best) throw new Error('No rectangular deck layout was found.');
    const decks=[];let y=0,d=best.depth;
    const rows=[];
    while(d>0){const item=best.dp[d];rows.push(item.strip);d=item.prev;}
    for(const strip of rows.reverse()){
      let x=0;
      for(const p of strip.parts){decks.push({id:`auto-${decks.length+1}`,x:x*unit,y:y*unit,type:p.type,size:Math.max(p.w,p.h),width:p.w,height:p.h,legs:6});x+=p.w/unit;}
      y+=strip.height;
    }
    return {decks,width:best.width*unit,depth:best.depth*unit};
  }
  $('autoBuildBtn').addEventListener('click', () => {
    const w=Number($('autoWidth').value),d=Number($('autoDepth').value);
    if(!(w>0&&d>0)) {$('autoSummary').textContent='Enter positive width and depth values.';return;}
    try{
      const plan=bestPlan(Math.ceil(w*1000),Math.ceil(d*1000),$('autoSystem').value);
      const counts={};for(const deck of plan.decks)counts[deck.type]=(counts[deck.type]||0)+1;
      const summary=`${(plan.width/1000).toFixed(1)} × ${(plan.depth/1000).toFixed(1)} m · ${plan.decks.length} decks (${Object.entries(counts).map(([k,v])=>`${v} × ${k}`).join(', ')})`;
      if(!confirm(`Replace the current stage layout with Auto Build?\n\n${summary}`))return;
      const old=JSON.parse(localStorage.getItem(KEY)||'{}');
      old.decks=plan.decks;
      old.skirtBackOpen=true;
      localStorage.setItem(KEY,JSON.stringify(old));
      sessionStorage.setItem('auto-build-notice',summary);
      location.reload(); // existing app reloads its own calculator and renders/supports manual editing
    }catch(e){$('autoSummary').textContent=e.message;}
  });
  const notice=sessionStorage.getItem('auto-build-notice');
  if(notice){sessionStorage.removeItem('auto-build-notice');$('autoSummary').textContent=`Built: ${notice}`;}
})();
