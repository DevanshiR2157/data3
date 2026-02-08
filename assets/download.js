import { loadAllRows, filterYears, groupCountyStats, computeDoubleJeopardy, minMaxNormalize, downloadCSV } from './common.js';

async function main(){
  const rows = await loadAllRows();
  const years = Array.from(new Set(rows.map(r=>Number(r.Year)).filter(Number.isFinite))).sort((a,b)=>a-b);
  const base = groupCountyStats(filterYears(rows, years[0], years[years.length-1]));

  const pct = document.getElementById('pct');
  const pctVal = document.getElementById('pctVal');
  const dlDJ = document.getElementById('dlDJ');
  const dlTop50 = document.getElementById('dlTop50');
  const dlAll = document.getElementById('dlAll');

  function computeSeverity(all){
    const normMed = minMaxNormalize(all.map(d=>d.mean_median_aqi));
    const normMax = minMaxNormalize(all.map(d=>d.mean_max_aqi));
    const out = all.map((d,i)=>({
      ...d,
      norm_median: normMed[i],
      norm_max: normMax[i],
      severity_score: (normMed[i]+normMax[i])/2
    }));
    // ranks
    const chronicSorted=[...out].sort((a,b)=>b.mean_median_aqi-a.mean_median_aqi);
    const acuteSorted=[...out].sort((a,b)=>b.mean_max_aqi-a.mean_max_aqi);
    const sevSorted=[...out].sort((a,b)=>b.severity_score-a.severity_score);
    const cRank=new Map(chronicSorted.map((d,i)=>[d.State+'|'+d.County,i+1]));
    const aRank=new Map(acuteSorted.map((d,i)=>[d.State+'|'+d.County,i+1]));
    const sRank=new Map(sevSorted.map((d,i)=>[d.State+'|'+d.County,i+1]));
    out.forEach(d=>{
      const k=d.State+'|'+d.County;
      d.Chronic_Rank=cRank.get(k);
      d.Acute_Rank=aRank.get(k);
      d.Severity_Rank=sRank.get(k);
    });
    return out;
  }

  const scored = computeSeverity(base);

  function update(){
    pctVal.textContent = pct.value;
  }

  pct.addEventListener('input', update);
  update();

  dlDJ.onclick = () => {
    const p = Number(pct.value);
    const {stats} = computeDoubleJeopardy(base, p);
    // join with severity
    const sevMap = new Map(scored.map(d=>[d.State+'|'+d.County, d]));
    const dj = stats.filter(d=>d.Risk_Category==='Double Jeopardy').map(d=>{
      const s = sevMap.get(d.State+'|'+d.County);
      return {
        County:d.County,
        State:d.State,
        Mean_Median_AQI:d.mean_median_aqi,
        Mean_Max_AQI:d.mean_max_aqi,
        Chronic_Rank:s?.Chronic_Rank,
        Acute_Rank:s?.Acute_Rank,
        Severity_Score:s?.severity_score,
        Severity_Rank:s?.Severity_Rank
      };
    }).sort((a,b)=>b.Severity_Score-a.Severity_Score);
    downloadCSV('double_jeopardy_counties.csv', dj);
  };

  dlTop50.onclick = () => {
    const top = [...scored].sort((a,b)=>b.severity_score-a.severity_score).slice(0,50).map(d=>({
      County:d.County,
      State:d.State,
      Mean_Median_AQI:d.mean_median_aqi,
      Mean_Max_AQI:d.mean_max_aqi,
      Norm_Chronic:d.norm_median,
      Norm_Acute:d.norm_max,
      Severity_Score:d.severity_score,
      Severity_Rank:d.Severity_Rank
    }));
    downloadCSV('top_severity_counties.csv', top);
  };

  dlAll.onclick = () => {
    const p = Number(pct.value);
    const {stats} = computeDoubleJeopardy(base, p);
    const sevMap = new Map(scored.map(d=>[d.State+'|'+d.County, d]));
    const allOut = stats.map(d=>{
      const s = sevMap.get(d.State+'|'+d.County);
      return {
        County:d.County,
        State:d.State,
        Mean_Median_AQI:d.mean_median_aqi,
        Mean_Max_AQI:d.mean_max_aqi,
        Norm_Chronic:s?.norm_median,
        Norm_Acute:s?.norm_max,
        Severity_Score:s?.severity_score,
        Risk_Category:d.Risk_Category,
        Chronic_Rank:s?.Chronic_Rank,
        Acute_Rank:s?.Acute_Rank,
        Severity_Rank:s?.Severity_Rank
      };
    }).sort((a,b)=>b.Severity_Score-a.Severity_Score);
    downloadCSV('all_county_statistics.csv', allOut);
  };
}

main().catch(e => { console.error(e); alert('Failed to load. Ensure CSVs are in site root.'); });
