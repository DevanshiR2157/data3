import { loadAllRows, groupCountyStats, filterYears, fmt } from './common.js';

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
  el.innerHTML = '';
  const trh = document.createElement('tr');
  for(const c of ['#','County','State','Mean Median AQI','Mean Max AQI']){
    const th=document.createElement('th');
    th.textContent=c;
    th.style.textAlign='left';
    th.style.padding='10px 8px';
    th.style.borderBottom='1px solid var(--border)';
    th.style.color='var(--muted2)';
    th.style.fontWeight='800';
    th.style.fontSize='.8rem';
    trh.appendChild(th);
  }
  const thead=document.createElement('thead');
  thead.appendChild(trh);
  el.appendChild(thead);
  const tbody=document.createElement('tbody');
  rows.forEach((r,i)=>{
    const tr=document.createElement('tr');
    const cells=[String(i+1), r.County, r.State, fmt(r.mean_median_aqi,1), fmt(r.mean_max_aqi,1)];
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
  const countyBase = groupCountyStats(filterYears(rows, years[0], years[years.length-1]));

  const stateSel = document.getElementById('stateSelect');
  setOptions(stateSel, ['All States', ...Array.from(new Set(countyBase.map(d=>d.State))).sort()], 'All States');

  const topN = document.getElementById('topN');
  const topNVal = document.getElementById('topNVal');
  const outlier = document.getElementById('outlier');
  const outlierNote = document.getElementById('outlierNote');

  function applyOutlier(values){
    if(outlier.value==='cap500') return values.map(v => Math.min(v, 500));
    if(outlier.value==='winsor1'){
      const sorted=[...values].sort((a,b)=>a-b);
      const idx=Math.floor(0.99*(sorted.length-1));
      const p99=sorted[idx];
      return values.map(v => Math.min(v, p99));
    }
    return values;
  }

  async function render(){
    const st = stateSel.value;
    const n = Number(topN.value);
    topNVal.textContent = String(n);
    document.getElementById('titleTop').textContent = `Top ${n} Counties by Acute Pollution`;

    let data = countyBase;
    if(st !== 'All States') data = data.filter(d=>d.State===st);

    const sorted = [...data].sort((a,b)=>b.mean_max_aqi-a.mean_max_aqi);
    const top = sorted.slice(0,n);

    const xTrue = top.map(d=>d.mean_max_aqi);
    const xDisp = applyOutlier(xTrue);

    outlierNote.style.display = (outlier.value==='none') ? 'none' : 'block';

    Plotly.newPlot('bar', [{
      type:'bar', orientation:'h',
      x: xDisp.reverse(),
      y: top.map(d=>d.County).reverse(),
      customdata: top.map(d=>[d.State, d.mean_median_aqi, d.mean_max_aqi]).reverse(),
      marker:{color: top.map(d=>d.State).reverse(), colorscale:'Magma'},
      hovertemplate:'<b>%{y}</b><br>State: %{customdata[0]}<br>Mean Max AQI: %{customdata[2]:.1f}<br>Mean Median AQI: %{customdata[1]:.1f}<extra></extra>'
    }], {
      margin:{t:20,b:40,l:160,r:20},
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'white',
      xaxis:{title:'Average Max AQI (Extreme Events)', gridcolor:'#e2e8f0', zeroline:true, zerolinecolor:'#cbd5e0'},
      yaxis:{gridcolor:'#e2e8f0'},
      height: Math.max(420, n*28 + 220),
      shapes:[
        {type:'line', x0:150, x1:150, y0:0, y1:1, yref:'paper', line:{dash:'dash', color:'#c53030', width:2}},
        {type:'line', x0:300, x1:300, y0:0, y1:1, yref:'paper', line:{dash:'dash', color:'#742a2a', width:2}},
      ],
      annotations:[
        {x:150, y:1.05, yref:'paper', text:'Unhealthy (150)', showarrow:false, font:{color:'#c53030', size:11}},
        {x:300, y:1.05, yref:'paper', text:'Hazardous (300)', showarrow:false, font:{color:'#742a2a', size:11}}
      ]
    }, {responsive:true, displaylogo:false});

    renderTable(document.getElementById('table'), top);
  }

  stateSel.addEventListener('change', render);
  topN.addEventListener('input', render);
  outlier.addEventListener('change', render);

  await render();
}

main().catch(e => { console.error(e); alert('Failed to load. Ensure CSVs are in site root.'); });
