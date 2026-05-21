/**
 * 展示分额预警
 *
 * Alerts by email when brand campaign search impression share drops or changes sharply.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

/**
 * Brand‑IS Alert v1.3 – 链接版
 */
const EMAIL="YOUR_EMAIL@example.com",DAYS=4,IS_TH=0.90,ROAS_TH=1,IS_DELTA=0.05;
function main(){
  const tz=AdsApp.currentAccount().getTimeZone(),fmt=d=>Utilities.formatDate(d,tz,'yyyy-MM-dd');
  const cidAcct=AdsApp.currentAccount().getCustomerId();
  Logger.log('[START] acct %s',cidAcct);

  const d=shift=>{const x=new Date();x.setDate(x.getDate()+shift);return x};
  const rng={now:[d(-DAYS),d(-1)],prev:[d(-(2*DAYS)),d(-(DAYS+1))]};

  const now=collect(gaql(fmt(rng.now[0]),fmt(rng.now[1]))),
        prev=collect(gaql(fmt(rng.prev[0]),fmt(rng.prev[1])));
  const rows=[];
  for(const id in now){
    const n=now[id],p=prev[id]||{is:0},roas=n.cost?n.revenue/n.cost:0,
          isNow=n.is,isDiff=p.is?(isNow-p.is)/p.is:0;
    if((isNow<IS_TH&&roas>ROAS_TH)||Math.abs(isDiff)>IS_DELTA){rows.push({...n,roas,isDiff})}
  }
  Logger.log('flagged=%s',rows.length);
  if(rows.length){
    MailApp.sendEmail({
      to:EMAIL,
      subject:'Brand‑IS Alert – '+cidAcct,
      htmlBody:buildBody(rows,fmt(rng.now[0])+'—'+fmt(rng.now[1]),fmt(rng.prev[0])+'—'+fmt(rng.prev[1]),cidAcct)
    });
    Logger.log('mail sent');
  }
  Logger.log('[END]');
}
function gaql(f,t){return`
SELECT campaign.id,campaign.name,metrics.cost_micros,metrics.conversions_value,
       metrics.conversions,metrics.clicks,metrics.impressions,
       metrics.search_impression_share
FROM campaign
WHERE campaign.status='ENABLED'
  AND campaign.advertising_channel_type IN ('SEARCH','PERFORMANCE_MAX')
  AND campaign.name LIKE '%brand%'
  AND segments.date BETWEEN '${f}' AND '${t}'`;}
function collect(q){
  const m={};
  for(const r of AdsApp.search(q)){
    const id=r.campaign.id;
    if(!m[id])m[id]={id,name:r.campaign.name,cost:0,revenue:0,conv:0,clicks:0,impr:0,is:0};
    const o=m[id];
    o.cost+=r.metrics.costMicros/1e6;
    o.revenue+=r.metrics.conversionsValue;
    o.conv+=r.metrics.conversions;
    o.clicks+=r.metrics.clicks;
    o.impr+=r.metrics.impressions;
    o.is=r.metrics.searchImpressionShare;
  }
  return m;
}
function buildBody(rows,rNow,rPrev,cidAcct){
  let h=`<h3>Brand Campaign IS Alert</h3><p><b>Now:</b> ${rNow}<br><b>Prev:</b> ${rPrev}</p>
<table border=1 cellpadding=4 style="border-collapse:collapse">
<tr><th>Campaign</th><th>Cost</th><th>Revenue</th><th>ROAS</th><th>IS %</th><th>ΔIS %</th><th>Impr</th><th>Clicks</th><th>Conv</th></tr>`;
  rows.forEach(r=>{
    const link=`https://ads.google.com/aw/campaigns?cid=${cidAcct}&campaignId=${r.id}`;
    h+=`<tr><td><a href="${link}" target="_blank">${r.name}</a></td>
         <td>${r.cost.toFixed(2)}</td><td>${r.revenue.toFixed(2)}</td>
         <td>${r.roas.toFixed(2)}</td><td>${(r.is*100).toFixed(2)}</td>
         <td>${(r.isDiff*100).toFixed(2)}</td><td>${r.impr}</td>
         <td>${r.clicks}</td><td>${r.conv}</td></tr>`;
  });
  h+='</table>';
  return h;
}
