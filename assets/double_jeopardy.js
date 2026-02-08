import { loadAllRows, filterYears, groupCountyStats, minMaxNormalize, fmt, percentile } from './common.js';

const barColors = {
  'Low Risk': '#48bb78',
  'High Vulnerability': '#ecc94b',
  'High Hazard': '#ed8936',
  'Double Jeopardy': '#c53030'
};

const scatterColors = {
  'Low Risk': '#1a9850',
  'High Vulnerability': '#d9ef8b',
  'High Hazard': '#fdae61',
  'Double Jeopardy': '#d73027'
};

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
  const header = ['#','County','State','Vulnerability Score','Hazard Score','Severity Score','Mean Median AQI','Mean Max AQI'];
  const thead=document.createElement('thead');
  const trh=document.createElement('tr');
  header.forEach(h=>{
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
  rows.forEach((r,i)=>{
    const tr=document.createElement('tr');
    const cells=[
      String(i+1), r.County, r.State,
      fmt(r.vulnerability_score,3), fmt(r.hazard_score,3), fmt(r.severity_score,3),
      fmt(r.mean_median_aqi,1), fmt(r.mean_max_aqi,1)
    ];
    cells.forEach((v,idx)=>{
      const td=document.createElement('td');
      td.textContent=v;
      td.style.padding='10px 8px';
      td.style.borderBottom='1px solid #f1f5f9';
      td.style.color= idx==0 ? 'var(--muted2)' : 'var(--muted)';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  el.appendChild(tbody);
}

async function main(){
  const rows = await loadAllRows();
  const years = Array.from(new Set(rows.map(r=>Number(r.Year)).filter(Number.isFinite))).sort((a,b)=>a-b);
  const base = groupCountyStats(filterYears(rows, years[0], years[years.length-1]));

  const stateSel = document.getElementById('stateSelect');
  setOptions(stateSel, ['All States', ...Array.from(new Set(base.map(d=>d.State))).sort()], 'All States');

  const pct = document.getElementById('pct');
  const pctVal = document.getElementById('pctVal');
  const topN = document.getElementById('topN');
  const topNVal = document.getElementById('topNVal');

  pctVal.textContent = pct.value;
  topNVal.textContent = topN.value;

  function computeScores(data){
    const medNorm = minMaxNormalize(data.map(d=>d.mean_median_aqi));
    const maxNorm = minMaxNormalize(data.map(d=>d.mean_max_aqi));

    const out = data.map((d,i)=>({
      ...d,
      vulnerability_score: medNorm[i],
      hazard_score: maxNorm[i]
    }));

    const meanV = out.reduce((a,b)=>a+b.vulnerability_score,0)/out.length;
    const meanH = out.reduce((a,b)=>a+b.hazard_score,0)/out.length;

    for(const d of out){
      d.risk_category = 'Low Risk';
      if(d.vulnerability_score >= meanV && d.hazard_score < meanH) d.risk_category='High Vulnerability';
      if(d.vulnerability_score < meanV && d.hazard_score >= meanH) d.risk_category='High Hazard';
      if(d.vulnerability_score >= meanV && d.hazard_score >= meanH) d.risk_category='Double Jeopardy';
      d.severity_score = (d.vulnerability_score + d.hazard_score)/2;
    }

    // ranks
    const vulnSorted=[...out].sort((a,b)=>b.vulnerability_score-a.vulnerability_score);
    const hazSorted=[...out].sort((a,b)=>b.hazard_score-a.hazard_score);
    const vRank=new Map(vulnSorted.map((d,i)=>[d.State+'|'+d.County,i+1]));
    const hRank=new Map(hazSorted.map((d,i)=>[d.State+'|'+d.County,i+1]));
    out.forEach(d=>{
      const k=d.State+'|'+d.County;
      d.Vulnerability_Rank=vRank.get(k);
      d.Hazard_Rank=hRank.get(k);
    });

    return {out, meanV, meanH};
  }

  function recompute(){
    pctVal.textContent = pct.value;
    topNVal.textContent = topN.value;

    let data = base;
    if(stateSel.value !== 'All States') data = data.filter(d=>d.State===stateSel.value);

    const {out, meanV, meanH} = computeScores(data);

    // metrics
    const dj = out.filter(d=>d.risk_category==='Double Jeopardy').length;
    const hv = out.filter(d=>d.risk_category==='High Vulnerability').length;
    const hh = out.filter(d=>d.risk_category==='High Hazard').length;
    const lr = out.filter(d=>d.risk_category==='Low Risk').length;

    document.getElementById('mDJ').textContent = String(dj);
    document.getElementById('mHV').textContent = String(hv);
    document.getElementById('mHH').textContent = String(hh);
    document.getElementById('mLR').textContent = String(lr);

    // Bar chart (top N by severity)
    const n = Number(topN.value);
    const top = [...out].sort((a,b)=>b.severity_score-a.severity_score).slice(0,n);
    const topAsc = [...top].sort((a,b)=>a.severity_score-b.severity_score);

    Plotly.newPlot('bar', [
      {
        type:'bar', orientation:'h',
        x: topAsc.map(d=>d.severity_score),
        y: topAsc.map(d=>d.County),
        marker:{color: topAsc.map(d=>barColors[d.risk_category])},
        customdata: topAsc.map(d=>[d.State, d.vulnerability_score, d.hazard_score, d.mean_median_aqi, d.mean_max_aqi, d.risk_category]),
        hovertemplate:'<b>%{y}, %{customdata[0]}</b><br>Severity: %{x:.3f}<br>Vulnerability: %{customdata[1]:.3f}<br>Hazard: %{customdata[2]:.3f}<br>Mean Median AQI: %{customdata[3]:.1f}<br>Mean Max AQI: %{customdata[4]:.1f}<br>Risk: %{customdata[5]}<extra></extra>'
      }
    ], {
      margin:{t:20,b:40,l:160,r:10},
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'white',
      xaxis:{title:'Combined Severity Score', range:[0,1], gridcolor:'#e2e8f0', zeroline:true, zerolinecolor:'#cbd5e0'},
      yaxis:{gridcolor:'#e2e8f0'},
      height: Math.max(420, n*35 + 220),
      legend:{orientation:'h', y:1.05, x:0.5, xanchor:'center'}
    }, {responsive:true, displaylogo:false});

    // Scatter (Graph Objects style)
    const maxScore = 1.0;
    const traces = [];
    for(const cat of ['Low Risk','High Vulnerability','High Hazard','Double Jeopardy']){
      const pts = out.filter(d=>d.risk_category===cat);
      if(!pts.length) continue;
      traces.push({
        type:'scatter', mode:'markers', name:cat,
        x: pts.map(d=>d.vulnerability_score),
        y: pts.map(d=>d.hazard_score),
        marker:{size:10,color:scatterColors[cat],line:{width:1,color:'white'},opacity:0.8},
        text: pts.map(d=>`${d.County}, ${d.State}`),
        hovertemplate:'<b>%{text}</b><br>Vulnerability: %{x:.3f}<br>Hazard: %{y:.3f}<br>Risk: '+cat+'<extra></extra>'
      });
    }
    // diag
    traces.push({type:'scatter', mode:'lines', x:[0,maxScore], y:[0,maxScore], line:{dash:'dash',color:'gray',width:1.5}, showlegend:false, hoverinfo:'skip'});

    const layout = {
      margin:{t:40,b:50,l:60,r:140},
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'white',
      xaxis:{title:'Vulnerability Score', range:[-0.05,1.1], gridcolor:'#e2e8f0', zeroline:true, zerolinecolor:'#cbd5e0'},
      yaxis:{title:'Hazard Score', range:[-0.05,1.1], gridcolor:'#e2e8f0', zeroline:true, zerolinecolor:'#cbd5e0'},
      legend:{title:{text:'Risk Category'}, x:1.02, y:0.99, bgcolor:'rgba(255,255,255,0.9)', bordercolor:'#e2e8f0', borderwidth:1}
    };

    // mean lines
    layout.shapes = [
      {type:'line', x0:meanV, x1:meanV, y0:-0.05, y1:1.1, line:{dash:'dot',color:'gray',width:1}},
      {type:'line', y0:meanH, y1:meanH, x0:-0.05, x1:1.1, line:{dash:'dot',color:'gray',width:1}}
    ];

    layout.annotations = [
      {x:0.75, y:0.85, xref:'x', yref:'y', text:'High Vulnerability<br>High Hazard', showarrow:false, font:{size:10,color:'#666'}, opacity:0.7, align:'center'},
      {x:0.25, y:0.85, xref:'x', yref:'y', text:'Low Vulnerability<br>High Hazard', showarrow:false, font:{size:10,color:'#666'}, opacity:0.7, align:'center'},
      {x:0.25, y:0.15, xref:'x', yref:'y', text:'Low Vulnerability<br>Low Hazard', showarrow:false, font:{size:10,color:'#666'}, opacity:0.7, align:'center'},
      {x:0.75, y:0.15, xref:'x', yref:'y', text:'High Vulnerability<br>Low Hazard', showarrow:false, font:{size:10,color:'#666'}, opacity:0.7, align:'center'},
      {x:1.08, y:meanH, xref:'paper', yref:'y', text:`Mean Hazard (${meanH.toFixed(2)})`, showarrow:false, font:{size:9,color:'gray'}},
      {x:meanV, y:1.08, xref:'x', yref:'paper', text:`Mean Vuln (${meanV.toFixed(2)})`, showarrow:false, font:{size:9,color:'gray'}}
    ];

    Plotly.newPlot('scatter', traces, layout, {responsive:true, displaylogo:false});

    // DJ table
    const djRows = out.filter(d=>d.risk_category==='Double Jeopardy')
      .sort((a,b)=>b.severity_score-a.severity_score);
    renderTable(document.getElementById('table'), djRows);
  }

  pct.addEventListener('input', recompute);
  stateSel.addEventListener('change', recompute);
  topN.addEventListener('input', recompute);

  recompute();
}

main().catch(e => { console.error(e); alert('Failed to load. Ensure CSVs are in site root.'); });
