const endpoints = [
  { method:'GET', path:'/api/gen', description:'Generate a new random disposable email address.', type:'none', schema:{}, example:{} },
  { method:'GET', path:'/api/use', description:'Format a custom disposable email address.', type:'query', schema:{user:{type:'string',required:true,description:'Custom email username',example:'aixi'}}, example:{user:'aixi'} },
  { method:'GET', path:'/api/inbox', description:'Get the inbox message list for a disposable email user.', type:'query', schema:{user:{type:'string',required:true,description:'Disposable email username',example:'aixi'}}, example:{user:'aixi'} },
  { method:'GET', path:'/api/read', description:'Read one email by its message index or key.', type:'query', schema:{user:{type:'string',required:true,description:'Disposable email username',example:'aixi'},index:{type:'string',required:true,description:'Message index or message key',example:'1'}}, example:{user:'aixi',index:'1'} },
  { method:'GET', path:'/api/dump', description:'Read all messages for a disposable email user.', type:'query', schema:{user:{type:'string',required:true,description:'Disposable email username',example:'aixi'}}, example:{user:'aixi'} },
  { method:'GET', path:'/api/stream', description:'Stream new messages with Server-Sent Events (SSE).', type:'query', schema:{user:{type:'string',required:true,description:'Disposable email username',example:'aixi'}}, example:{user:'aixi'} }
]

const $ = id => document.getElementById(id)
const baseUrl = location.origin
let active = null

function copyText(text){
  return navigator.clipboard?.writeText(text).then(()=>true).catch(()=>fallbackCopy(text))
}
function fallbackCopy(text){
  try{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();return Promise.resolve(true)}catch{return Promise.resolve(false)}}
function pretty(value){return JSON.stringify(value,null,2)}
function encodeQuery(data){const p=new URLSearchParams();Object.entries(data||{}).forEach(([k,v])=>{if(String(v).trim()!=='')p.set(k,String(v))});return p.toString()}
function buildUrl(endpoint,data={}){let url=baseUrl+endpoint.path;if(endpoint.type==='query'){const q=encodeQuery(data);if(q)url+='?'+q}return url}
function buildCurl(endpoint,data){let url=buildUrl(endpoint,data);return `curl -X ${endpoint.method} '${url}'`}
function setButton(btn,text){const old=btn.textContent;btn.textContent=text;setTimeout(()=>btn.textContent=old,1200)}

$('baseUrl').textContent=baseUrl
$('copyBase').onclick=async()=>{const ok=await copyText(baseUrl);setButton($('copyBase'),ok?'COPIED ✓':'FAILED')}
$('copyBaseLarge').onclick=async()=>{const ok=await copyText(baseUrl);setButton($('copyBaseLarge'),ok?'COPIED ✓':'COPY BASE URL')}

function renderEndpoints(){
  $('endpointList').innerHTML=endpoints.map((e,i)=>{
    const example=pretty(e.example)
    return `<article class="endpoint">
      <div class="endpoint-top">
        <div class="endpoint-title"><span class="method">${e.method}</span><span class="path">${e.path}</span></div>
        <button class="action execute" data-exec="${i}">EXECUTE</button>
      </div>
      <p class="endpoint-desc">${e.description}</p>
      <div class="url-label">URL</div>
      <div class="endpoint-url">${baseUrl+e.path}</div>
      <div class="endpoint-actions">
        <button class="action" data-copy-url="${i}">COPY URL</button>
        <button class="action" data-example="${i}">EXAMPLE</button>
        <button class="action" data-curl="${i}">COPY CURL</button>
      </div>
      <div class="example-box" id="example-${i}" hidden>
        <div class="example-head"><span>REQUEST EXAMPLE</span><button class="small-action" data-copy-example="${i}">COPY</button></div>
        <pre>${example}</pre>
      </div>
    </article>`
  }).join('')

  document.querySelectorAll('[data-exec]').forEach(b=>b.onclick=()=>openModal(endpoints[Number(b.dataset.exec)]))
  document.querySelectorAll('[data-copy-url]').forEach(b=>b.onclick=async()=>{const ok=await copyText(baseUrl+endpoints[Number(b.dataset.copyUrl)].path);setButton(b,ok?'COPIED ✓':'FAILED')})
  document.querySelectorAll('[data-curl]').forEach(b=>b.onclick=async()=>{const e=endpoints[Number(b.dataset.curl)];const ok=await copyText(buildCurl(e,e.example));setButton(b,ok?'COPIED ✓':'FAILED')})
  document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{const box=$('example-'+b.dataset.example);box.hidden=!box.hidden;b.textContent=box.hidden?'EXAMPLE':'HIDE EXAMPLE'})
  document.querySelectorAll('[data-copy-example]').forEach(b=>b.onclick=async()=>{const ok=await copyText(pretty(endpoints[Number(b.dataset.copyExample)].example));setButton(b,ok?'COPIED ✓':'FAILED')})
}

function renderFields(e){
  if(e.type==='none') return '<div class="field"><small>No parameters required for this endpoint.</small></div>'
  return Object.entries(e.schema).map(([key,cfg])=>`<div class="field"><label>${key}${cfg.required===false?'':' *'}</label><input id="field-${key}" value="${String(cfg.example??'').replace(/"/g,'&quot;')}" placeholder="${String(cfg.example??'').replace(/"/g,'&quot;')}"><small>${cfg.description||''}</small></div>`).join('')
}
function collectData(e){
  const data={};if(e.type==='none')return data
  Object.keys(e.schema).forEach(key=>{const v=$('field-'+key)?.value??'';if(v.trim()!=='')data[key]=v})
  return data
}

function openModal(e){
  active=e
  $('modalMethod').textContent=e.method
  $('modalTitle').textContent=e.path
  $('modalUrl').textContent=baseUrl+e.path
  $('requestType').textContent=e.type==='none'?'NO PARAMETERS':'QUERY PARAMETERS'
  $('requestFields').innerHTML=renderFields(e)
  $('modalExample').textContent=pretty(e.example)
  $('modalExamplePanel').hidden=false
  $('modalResponse').textContent='Response will appear here…'
  $('modalStatus').textContent=''
  $('modalBackdrop').hidden=false
}
function closeModal(){$('modalBackdrop').hidden=true;active=null}
$('modalClose').onclick=closeModal
$('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeModal()}
$('copyModalUrl').onclick=async()=>{const ok=await copyText($('modalUrl').textContent);setButton($('copyModalUrl'),ok?'COPIED ✓':'FAILED')}
$('copyModalExample').onclick=async()=>{const ok=await copyText($('modalExample').textContent);setButton($('copyModalExample'),ok?'COPIED ✓':'FAILED')}
$('copyCurl').onclick=async()=>{if(!active)return;const data=collectData(active);const ok=await copyText(buildCurl(active,data));setButton($('copyCurl'),ok?'COPIED ✓':'FAILED')}

$('executeBtn').onclick=async()=>{
  if(!active)return
  const btn=$('executeBtn'),response=$('modalResponse'),status=$('modalStatus')
  try{
    const data=collectData(active)
    for(const [key,cfg] of Object.entries(active.schema)){if(cfg.required!==false&&!String(data[key]??'').trim())throw new Error(`${key} wajib diisi.`)}
    const url=buildUrl(active,data)
    btn.disabled=true;btn.textContent='EXECUTING…';status.textContent=''

    if(active.path==='/api/stream'){
      response.textContent='Connecting to SSE stream…\n'
      const es=new EventSource(url)
      let count=0
      es.onmessage=event=>{response.textContent+=event.data+'\n';if(++count>=10)es.close()}
      es.onerror=()=>{response.textContent+='\nStream closed or connection failed.';es.close()}
      status.textContent='SSE stream opened. Showing incoming events.'
      return
    }

    const r=await fetch(url,{method:active.method})
    const text=await r.text()
    let out=text;try{out=JSON.stringify(JSON.parse(text),null,2)}catch{}
    response.textContent=`HTTP ${r.status}\n\n${out}`
    status.textContent=r.ok?'Request berhasil dikirim.':`Request selesai dengan HTTP ${r.status}.`
  }catch(err){response.textContent=err.message||'Request gagal.';status.textContent='Gagal mengirim request.'}
  finally{btn.disabled=false;btn.textContent='EXECUTE'}
}

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modalBackdrop').hidden)closeModal()})
renderEndpoints()
