// Common utilities for all pages

export const DATA_FILES = [
  '../annual_aqi_by_county_2021.csv',
  '../annual_aqi_by_county_2022.csv',
  '../annual_aqi_by_county_2023.csv',
  '../annual_aqi_by_county_2024.csv',
  '../annual_aqi_by_county_2025.csv'
];

export const OUTLIER_SCATTER_EXCLUDE = [
  { state: 'california', county: 'mono' }
];

export function isScatterExcluded(row){
  const st = String(row.State||'').trim().toLowerCase();
  const ct = String(row.County||'').trim().toLowerCase();
  return OUTLIER_SCATTER_EXCLUDE.some(o => o.state===st && o.county===ct);
}

export function fmt(n, digits=1){
  if(!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function fmtInt(n){
  if(!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString();
}

export function percentile(values, p){
  const arr = values.filter(v => Number.isFinite(v)).sort((a,b)=>a-b);
  if(!arr.length) return NaN;
  const idx = (arr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if(lo===hi) return arr[lo];
  return arr[lo] + (arr[hi]-arr[lo])*(idx-lo);
}

export function downloadCSV(filename, rows){
  const header = Object.keys(rows[0]||{});
  const lines = [header.join(',')].concat(rows.map(r => header.map(k => {
    const v = r[k];
    const s = (v===null || v===undefined) ? '' : String(v);
    const esc = s.replace(/"/g,'""');
    return /[",
]/.test(esc) ? `"${esc}"` : esc;
  }).join(',')));
  const blob = new Blob([lines.join('
')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

// Load + cache all annual CSV rows in memory for this session.
let __ALL_ROWS = null;

export async function loadAllRows(){
  if(__ALL_ROWS) return __ALL_ROWS;
  const rows = [];
  for(const f of DATA_FILES){
    try{
      const parsed = await new Promise((resolve, reject) => {
        Papa.parse(f, { download:true, header:true, dynamicTyping:true, skipEmptyLines:true,
          complete: (res) => res.errors?.length ? reject(res.errors[0]) : resolve(res.data),
          error: reject
        });
      });
      // add year from filename
      const m = /_(\d{4})\.csv$/.exec(f);
      const year = m ? Number(m[1]) : null;
      for(const r of parsed){
        if(year) r.Year = year;
        rows.push(r);
      }
    }catch(e){
      console.warn('Could not load', f, e);
    }
  }
  __ALL_ROWS = rows;
  return rows;
}

export function filterYears(rows, yearMin, yearMax){
  return rows.filter(r => {
    const y = Number(r.Year);
    return Number.isFinite(y) && y>=yearMin && y<=yearMax;
  });
}

export function groupCountyStats(rows){
  // mean of Median AQI and Max AQI by State, County
  const map = new Map();
  for(const r of rows){
    const st = String(r.State||'').trim();
    const ct = String(r.County||'').trim();
    if(!st || !ct) continue;
    const med = Number(r['Median AQI']);
    const mx = Number(r['Max AQI']);
    if(!Number.isFinite(med) || !Number.isFinite(mx)) continue;
    const key = st + '|' + ct;
    if(!map.has(key)) map.set(key, {State:st, County:ct, medSum:0, maxSum:0, n:0});
    const obj = map.get(key);
    obj.medSum += med;
    obj.maxSum += mx;
    obj.n += 1;
  }
  const out = [];
  for(const obj of map.values()){
    out.push({
      State: obj.State,
      County: obj.County,
      mean_median_aqi: obj.medSum/obj.n,
      mean_max_aqi: obj.maxSum/obj.n
    });
  }
  return out;
}

export function computeDoubleJeopardy(countyStats, percentilePct){
  const p = percentilePct/100;
  const medThr = percentile(countyStats.map(d=>d.mean_median_aqi), p);
  const maxThr = percentile(countyStats.map(d=>d.mean_max_aqi), p);
  const stats = countyStats.map(d => {
    let Risk_Category = 'Low Risk';
    if(d.mean_median_aqi >= medThr) Risk_Category = 'High Chronic';
    if(d.mean_max_aqi >= maxThr) Risk_Category = 'High Acute';
    if(d.mean_median_aqi >= medThr && d.mean_max_aqi >= maxThr) Risk_Category = 'Double Jeopardy';
    return {...d, Risk_Category};
  });
  return {stats, medThr, maxThr};
}

export function minMaxNormalize(values){
  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  if(!Number.isFinite(vmin) || !Number.isFinite(vmax) || vmax===vmin){
    return values.map(_=>0.5);
  }
  return values.map(v => (v - vmin)/(vmax-vmin));
}
