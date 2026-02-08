import { loadAllRows, groupCountyStats, filterYears, fmt, fmtInt } from './common.js';

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
  const cols = ['County','State','mean_median_aqi','mean_max_aqi'];
  el.innerHTML = '';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for(const c of ['#', 'County','State','Mean Median AQI','Mean Max AQI']){
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
  thead.appendChild(trh);
  el.appendChild(thead);
  const tbody = document.createElement('tbody');
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
  const county = groupCountyStats(filterYears(rows, years[0], years[years.length-1]));

  const stateSel = document.getElementById('stateSelect');
  setOptions(stateSel, ['All States', ...Array.from(new Set(county.map(d=>d.State))).sort()], 'All States');

  const topN = document.getElementById('topN');
  const topNVal = document.getElementById('topNVal');
  topNVal.textContent = topN.value;

  async function render(){
    const st = stateSel.value;
    const n = Number(topN.value);
    topNVal.textContent = String(n);

    let data = county;
    if(st !== 'All States') data = data.filter(d=>d.State===st);
    const top = [...data].sort((a,b)=>b.mean_median_aqi-a.mean_median_aqi).slice(0,n);

    document.getElementById('titleTop').textContent = `Top ${n} Counties by Chronic Pollution`;

    Plotly.newPlot('bar', [{
      type:'bar', orientation:'h',
      x: top.map(d=>d.mean_median_aqi).reverse(),
      y: top.map(d=>d.County).reverse(),
      marker:{color: top.map(d=>d.State).reverse(), colorscale:'Viridis'},
      customdata: top.map(d=>[d.State, d.mean_max_aqi]).reverse(),
      hovertemplate:'<b>%{y}</b><br>State: %{customdata[0]}<br>Mean Median AQI: %{x:.1f}<br>Mean Max AQI: %{customdata[1]:.1f}<extra></extra>'
    }], {
      margin:{t:20,b:40,l:160,r:20},
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'white',
      xaxis:{title:'Average Median AQI (Daily Exposure)', gridcolor:'#e2e8f0', zeroline:true, zerolinecolor:'#cbd5e0'},
      yaxis:{gridcolor:'#e2e8f0'},
      height: Math.max(420, n*28 + 220)
    }, {responsive:true, displaylogo:false});

    renderTable(document.getElementById('table'), top.map(d=>({...d})) );
  }

  stateSel.addEventListener('change', render);
  topN.addEventListener('input', render);
  await render();
}

main().catch(e => { console.error(e); alert('Failed to load. Ensure CSVs are in site root.'); });
