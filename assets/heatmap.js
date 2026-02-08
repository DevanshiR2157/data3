import { loadAllRows, filterYears, fmtInt } from './common.js';

const US_STATES = new Set([
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District Of Columbia','District of Columbia',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland',
  'Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
]);

const STATE_TO_ABBR = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE',
  'District Of Columbia':'DC','District of Columbia':'DC','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
  'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM',
  'New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI',
  'South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA',
  'West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'
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

function sumHighDays(r){
  return (Number(r['Unhealthy for Sensitive Groups Days'])||0) +
         (Number(r['Unhealthy Days'])||0) +
         (Number(r['Very Unhealthy Days'])||0) +
         (Number(r['Hazardous Days'])||0);
}

async function main(){
  const allRows = await loadAllRows();
  const years = Array.from(new Set(allRows.map(r=>Number(r.Year)).filter(Number.isFinite))).sort((a,b)=>a-b);

  const yearMinSel = document.getElementById('yearMin');
  const yearMaxSel = document.getElementById('yearMax');
  setOptions(yearMinSel, years, years[0]);
  setOptions(yearMaxSel, years, years[years.length-1]);

  const scopeSel = document.getElementById('scope');

  function render(){
    const y0 = Number(yearMinSel.value);
    const y1 = Number(yearMaxSel.value);
    const ymin=Math.min(y0,y1), ymax=Math.max(y0,y1);
    const scope = scopeSel.value;

    const rows = filterYears(allRows, ymin, ymax);

    const byState = new Map();
    for(const r of rows){
      const st = String(r.State||'').trim();
      if(!st) continue;
      if(scope==='us' && !US_STATES.has(st) && st!=='District Of Columbia' && st!=='District of Columbia') continue;
      const v = sumHighDays(r);
      byState.set(st, (byState.get(st)||0) + v);
    }

    const labels=[]; const locations=[]; const z=[];
    for(const [st,val] of byState.entries()){
      const abbr=STATE_TO_ABBR[st];
      if(!abbr) continue;
      labels.push(st);
      locations.push(abbr);
      z.push(val);
    }

    document.getElementById('kStates').textContent = String(locations.length);
    const total = z.reduce((a,b)=>a+b,0);
    document.getElementById('kTotal').textContent = fmtInt(total);

    let maxVal = -Infinity, maxIdx=-1;
    z.forEach((v,i)=>{ if(v>maxVal){maxVal=v; maxIdx=i;} });
    document.getElementById('kMax').textContent = maxIdx>=0 ? `${labels[maxIdx]}` : '—';
    document.getElementById('kMax2').textContent = maxIdx>=0 ? `${fmtInt(maxVal)} days` : '';

    // files loaded = count of distinct years present
    const filesLoaded = new Set(rows.map(r=>r.Year)).size;
    document.getElementById('kFiles').textContent = String(filesLoaded);

    Plotly.newPlot('map', [{
      type:'choropleth',
      locationmode:'USA-states',
      locations,
      z,
      text: labels,
      hovertemplate:'<b>%{text}</b><br>High AQI days: %{z:,}<extra></extra>',
      colorscale:'OrRd',
      marker:{line:{color:'rgba(255,255,255,0.5)', width:0.7}},
      colorbar:{title:'High AQI days'}
    }], {
      margin:{t:40,b:10,l:20,r:20},
      paper_bgcolor:'rgba(0,0,0,0)',
      geo:{scope:'usa', bgcolor:'rgba(0,0,0,0)'},
      height:760
    }, {responsive:true, displaylogo:false});
  }

  yearMinSel.addEventListener('change', render);
  yearMaxSel.addEventListener('change', render);
  scopeSel.addEventListener('change', render);

  render();
}

main().catch(e => { console.error(e); alert('Failed to load. Ensure CSVs are in site root.'); });
