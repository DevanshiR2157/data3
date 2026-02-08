import { loadAllRows, filterYears, groupCountyStats, computeDoubleJeopardy, fmt, fmtInt, isScatterExcluded } from './common.js';

const colorMap = {
  'Low Risk': '#48bb78',
  'High Chronic': '#ecc94b',
  'High Acute': '#ed8936',
  'Double Jeopardy': '#c53030'
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

function uniqueStates(countyStats){
  const s = Array.from(new Set(countyStats.map(d=>d.State))).sort();
  return ['All States', ...s];
}

async function main(){
  const allRows = await loadAllRows();
  const years = Array.from(new Set(allRows.map(r=>Number(r.Year)).filter(Number.isFinite))).sort((a,b)=>a-b);
  const yearMinSel = document.getElementById('yearMin');
  const yearMaxSel = document.getElementById('yearMax');
  setOptions(yearMinSel, years, years[0]);
  setOptions(yearMaxSel, years, years[years.length-1]);

  const topN = document.getElementById('topN');
  const topNVal = document.getElementById('topNVal');
  topNVal.textContent = topN.value;

  // initial compute with all years to populate states
  let baseCounty = groupCountyStats(filterYears(allRows, years[0], years[years.length-1]));
  const stateSel = document.getElementById('stateSelect');
  setOptions(stateSel, uniqueStates(baseCounty), 'All States');

  async function recompute(){
    const y0 = Number(yearMinSel.value);
    const y1 = Number(yearMaxSel.value);
    const ymin = Math.min(y0,y1);
    const ymax = Math.max(y0,y1);

    // rebuild state list based on chosen years
    const rowsY = filterYears(allRows, ymin, ymax);
    let county = groupCountyStats(rowsY);

    // state filter
    const st = stateSel.value;
    if(st !== 'All States') county = county.filter(d=>d.State===st);

    // compute DJ thresholds (90th percentile)
    const {stats, medThr, maxThr} = computeDoubleJeopardy(county, 90);

    // KPIs
    document.getElementById('kpiTotal').textContent = fmtInt(stats.length);
    document.getElementById('kpiYears').textContent = (ymin===ymax) ? String(ymin) : `${ymin}-${ymax}`;
    document.getElementById('kpiGeo').textContent = st;

    const djCount = stats.filter(d=>d.Risk_Category==='Double Jeopardy').length;
    document.getElementById('kpiDJ').textContent = String(djCount);
    document.getElementById('kpiDJDelta').textContent = stats.length ? `${(djCount/stats.length*100).toFixed(1)}% of total` : '—';

    document.getElementById('thrMed').textContent = fmt(medThr,1);
    document.getElementById('thrMax').textContent = fmt(maxThr,1);

    // Pie
    const counts = { 'Low Risk':0,'High Chronic':0,'High Acute':0,'Double Jeopardy':0 };
    for(const d of stats) counts[d.Risk_Category] = (counts[d.Risk_Category]||0)+1;
    Plotly.newPlot('pie', [{
      type:'pie',
      labels:Object.keys(counts),
      values:Object.values(counts),
      hole:0.5,
      marker:{ colors:['#48bb78','#ecc94b','#ed8936','#c53030'] },
      textinfo:'percent+label',
      textposition:'outside'
    }], {
      margin:{t:30,b:10,l:10,r:10},
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'rgba(0,0,0,0)',
      showlegend:false
    }, {responsive:true, displayModeBar:false});

    // Scatter (exclude Mono, CA)
    const scatterData = stats.filter(d=>!isScatterExcluded(d));

    const traces = ['Low Risk','High Chronic','High Acute','Double Jeopardy'].map(cat => {
      const pts = scatterData.filter(d=>d.Risk_Category===cat);
      return {
        type:'scatter',
        mode:'markers',
        name:cat,
        x: pts.map(d=>d.mean_median_aqi),
        y: pts.map(d=>d.mean_max_aqi),
        marker:{ size:10, color:colorMap[cat], line:{width:1,color:'white'}, opacity:0.82 },
        text: pts.map(d=>`${d.County}, ${d.State}`),
        hovertemplate:'<b>%{text}</b><br>Mean Median AQI: %{x:.1f}<br>Mean Max AQI: %{y:.1f}<br>Risk: '+cat+'<extra></extra>'
      };
    });

    const shapes = [
      {type:'line', x0:medThr, x1:medThr, y0:0, y1:1, yref:'paper', line:{dash:'dash', color:'#3182ce', width:2}},
      {type:'line', y0:maxThr, y1:maxThr, x0:0, x1:1, xref:'paper', line:{dash:'dash', color:'#dd6b20', width:2}}
    ];

    Plotly.newPlot('scatter', traces, {
      margin:{t:40,b:50,l:60,r:20},
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'white',
      xaxis:{title:'Mean Median AQI (Chronic)', gridcolor:'#e2e8f0', zeroline:false},
      yaxis:{title:'Mean Max AQI (Acute)', gridcolor:'#e2e8f0', zeroline:false},
      shapes,
      legend:{orientation:'h', y:1.08, x:0.5, xanchor:'center'}
    }, {responsive:true, displaylogo:false});

    // Top N bar preview (by mean_median_aqi)
    const n = Number(topN.value);
    const top = [...stats].sort((a,b)=>b.mean_median_aqi-a.mean_median_aqi).slice(0,n);
    const y = top.map(d=>d.County).reverse();
    const x = top.map(d=>d.mean_median_aqi).reverse();
    const hover = top.map(d=>`<b>${d.County}, ${d.State}</b><br>Mean Median AQI: ${d.mean_median_aqi.toFixed(1)}<br>Mean Max AQI: ${d.mean_max_aqi.toFixed(1)}<extra></extra>`).reverse();
    Plotly.newPlot('barTop', [{
      type:'bar', orientation:'h',
      x, y,
      marker:{color:'#3182ce'},
      hovertemplate:hover
    }], {
      margin:{t:30,b:40,l:160,r:20},
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'white',
      xaxis:{title:'Mean Median AQI', gridcolor:'#e2e8f0'},
      yaxis:{gridcolor:'#e2e8f0'}
    }, {responsive:true, displayModeBar:false});
  }

  // listeners
  yearMinSel.addEventListener('change', recompute);
  yearMaxSel.addEventListener('change', recompute);
  stateSel.addEventListener('change', recompute);
  topN.addEventListener('input', () => { topNVal.textContent = topN.value; recompute(); });

  await recompute();
}

main().catch(err => {
  console.error(err);
  alert('Failed to load data. Ensure CSV files are in the site root and you are running on GitHub Pages or a local server.');
});
