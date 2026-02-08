import { loadAllRows, filterYears, groupCountyStats, computeDoubleJeopardy, fmt, downloadCSV } from './common.js';

function setOptions(sel, opts, selected){
  sel.innerHTML='';
  for(const o of opts){
    const op=document.createElement('option');
    op.value=o;
    op.textContent=o;
    if(String(o)===String(selected)) op.selected=true;
    sel.appendChild(op);
  }
}

function renderTable(el, rows){
  el.innerHTML='';
  if(!rows.length){ el.textContent = 'No rows.'; return; }
  const cols = ['Year','Median AQI','Max AQI','Days with AQI','Good Days','Unhealthy Days'];
  const thead=document.createElement('thead');
  const trh=document.createElement('tr');
  cols.forEach(h=>{
    const th=document.createElement('th');
    th.textContent=h;
    th.style.textAlign='left';
    th.style.padding='10px 8px';
    th.style.borderBottom='1px solid var(--border)';
    th.style.color='var(--muted2)';
    th.style.fontWeight='800';
    th.style.fontSize='.8rem';
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  el.appendChild(thead);
  const tbody=document.createElement('tbody');
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    cols.forEach((c)=>{
      const td=document.createElement('td');
      const v = r[c];
      td.textContent = (typeof v==='number') ? (Number.isInteger(v)? v.toLocaleString(): v.toFixed(1)) : String(v??'');
      td.style.padding='10px 8px';
      td.style.borderBottom='1px solid #f1f5f9';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  el.appendChild(tbody);
}

async function main(){
  const all = await loadAllRows();
  const years = Array.from(new Set(all.map(r=>Number(r.Year)).filter(Number.isFinite))).sort((a,b)=>a-b);
  const baseCounty = groupCountyStats(filterYears(all, years[0], years[years.length-1]));

  const stateSel = document.getElementById('stateSelect');
  const countySel = document.getElementById('countySelect');
  const pct = document.getElementById('pct');
  const pctVal = document.getElementById('pctVal');
  const downloadBtn = document.getElementById('download');

  const states = Array.from(new Set(all.map(r=>String(r.State||'').trim()).filter(Boolean))).sort();
  setOptions(stateSel, states, states[0]);

  function countiesForState(st){
    return Array.from(new Set(all.filter(r=>String(r.State||'').trim()===st).map(r=>String(r.County||'').trim()).filter(Boolean))).sort();
  }

  function updateCounties(){
    const st = stateSel.value;
    const counties = countiesForState(st);
    setOptions(countySel, counties, counties[0]);
  }

  async function render(){
    pctVal.textContent = pct.value;
    const st = stateSel.value;
    const ct = countySel.value;
    document.getElementById('profileTitle').textContent = `Profile: ${ct}, ${st}`;

    // County data rows
    const countyRows = all.filter(r => String(r.State||'').trim()===st && String(r.County||'').trim()===ct);

    // yearly aggregates
    const byYear = new Map();
    for(const r of countyRows){
      const y = Number(r.Year);
      if(!Number.isFinite(y)) continue;
      if(!byYear.has(y)) byYear.set(y, {Year:y, medSum:0, maxSum:0, n:0, days:0, good:0, unhealthy:0});
      const obj = byYear.get(y);
      const med = Number(r['Median AQI']);
      const mx = Number(r['Max AQI']);
      if(Number.isFinite(med)){ obj.medSum += med; }
      if(Number.isFinite(mx)){ obj.maxSum += mx; }
      obj.n += 1;
      obj.days += Number(r['Days with AQI']||0);
      obj.good += Number(r['Good Days']||0);
      obj.unhealthy += Number(r['Unhealthy Days']||0);
    }
    const yearly = Array.from(byYear.values()).sort((a,b)=>a.Year-b.Year).map(o => ({
      Year:o.Year,
      'Median AQI': o.medSum/o.n,
      'Max AQI': o.maxSum/o.n,
      'Days with AQI': o.days,
      'Good Days': o.good,
      'Unhealthy Days': o.unhealthy
    }));

    // county aggregate from baseCounty
    const agg = baseCounty.find(d=>d.State===st && d.County===ct);

    // thresholds
    const pctNum = Number(pct.value);
    const {stats, medThr, maxThr} = computeDoubleJeopardy(baseCounty, pctNum);

    const isHighChronic = agg.mean_median_aqi >= medThr;
    const isHighAcute = agg.mean_max_aqi >= maxThr;
    const isDJ = isHighChronic && isHighAcute;

    // ranks (1 is worst)
    const chronicRank = [...baseCounty].sort((a,b)=>b.mean_median_aqi-a.mean_median_aqi).findIndex(d=>d.State===st && d.County===ct) + 1;
    const acuteRank = [...baseCounty].sort((a,b)=>b.mean_max_aqi-a.mean_max_aqi).findIndex(d=>d.State===st && d.County===ct) + 1;

    document.getElementById('mMed').textContent = fmt(agg.mean_median_aqi,1);
    document.getElementById('mMax').textContent = fmt(agg.mean_max_aqi,1);
    document.getElementById('dMed').textContent = `${isHighChronic?'Above':'Below'} ${pctNum}th %ile (thr ${medThr.toFixed(1)})`;
    document.getElementById('dMax').textContent = `${isHighAcute?'Above':'Below'} ${pctNum}th %ile (thr ${maxThr.toFixed(1)})`;
    document.getElementById('mCR').textContent = `#${chronicRank}`;
    document.getElementById('dCR').textContent = `of ${baseCounty.length} counties`;
    document.getElementById('mAR').textContent = `#${acuteRank}`;
    document.getElementById('dAR').textContent = `of ${baseCounty.length} counties`;

    const statusBox = document.getElementById('statusBox');
    if(isDJ){
      statusBox.innerHTML = `<div class="callout red"><strong>⚠️ DOUBLE JEOPARDY STATUS: YES</strong><br>${ct} exceeds both chronic threshold (${medThr.toFixed(1)}) and acute threshold (${maxThr.toFixed(1)}).</div>`;
    }else{
      const parts=[];
      if(isHighChronic) parts.push('High Chronic');
      if(isHighAcute) parts.push('High Acute');
      if(!parts.length) parts.push('Low Risk');
      statusBox.innerHTML = `<div class="callout teal"><strong>✓ DOUBLE JEOPARDY STATUS: NO</strong><br>Status: ${parts.join(', ')} at ${pctNum}th percentile thresholds.</div>`;
    }

    // Trend chart
    Plotly.newPlot('trend', [
      {type:'scatter', mode:'lines+markers', x:yearly.map(d=>d.Year), y:yearly.map(d=>d['Median AQI']), name:'Median AQI', line:{color:'#3182ce', width:3}, marker:{size:9}},
      {type:'scatter', mode:'lines+markers', x:yearly.map(d=>d.Year), y:yearly.map(d=>d['Max AQI']), name:'Max AQI', line:{color:'#c53030', width:3}, marker:{size:9}, xaxis:'x2', yaxis:'y2'}
    ], {
      grid: {rows:1, columns:2, pattern:'independent'},
      margin:{t:40,b:40,l:60,r:20},
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'white',
      xaxis:{title:'Year', dtick:1, gridcolor:'#e2e8f0'},
      yaxis:{title:'Median AQI', gridcolor:'#e2e8f0'},
      xaxis2:{title:'Year', dtick:1, gridcolor:'#e2e8f0'},
      yaxis2:{title:'Max AQI', gridcolor:'#e2e8f0'},
      shapes:[
        {type:'line', xref:'x', yref:'y', x0:Math.min(...yearly.map(d=>d.Year)), x1:Math.max(...yearly.map(d=>d.Year)), y0:medThr, y1:medThr, line:{dash:'dash', color:'#dd6b20', width:2}},
        {type:'line', xref:'x2', yref:'y2', x0:Math.min(...yearly.map(d=>d.Year)), x1:Math.max(...yearly.map(d=>d.Year)), y0:maxThr, y1:maxThr, line:{dash:'dash', color:'#dd6b20', width:2}},
      ]
    }, {responsive:true, displaylogo:false});

    // Table
    renderTable(document.getElementById('table'), yearly);

    // download raw rows
    downloadBtn.onclick = () => {
      downloadCSV(`${ct}_${st}_aqi_rows.csv`, countyRows);
    };
  }

  updateCounties();
  pctVal.textContent = pct.value;

  stateSel.addEventListener('change', () => { updateCounties(); render(); });
  countySel.addEventListener('change', render);
  pct.addEventListener('input', render);

  await render();
}

main().catch(e => { console.error(e); alert('Failed to load. Ensure CSVs are in site root.'); });
