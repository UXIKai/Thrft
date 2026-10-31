import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'
const ART='/opt/cursor/artifacts'
const MEDIA='/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media'
fs.mkdirSync(ART,{recursive:true}); fs.mkdirSync(MEDIA,{recursive:true})
const browser=await chromium.launch({headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2})
async function shot(n){await page.waitForTimeout(300); const f=`${n}.png`; await page.screenshot({path:path.join(ART,f)}); fs.copyFileSync(path.join(ART,f),path.join(MEDIA,f)); console.log('saved',f)}
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'})
await page.locator('input[type=email]').first().fill('cloud@thrft.local')
await page.locator('input[type=password]').first().fill('cloud-cloud-cloud')
await page.getByRole('button',{name:/sign in/i}).click()
await page.waitForSelector('nav.tab-bar',{timeout:25000})
await page.getByRole('button',{name:'Chat', exact:true}).click()
await page.waitForTimeout(700)
const idle=await page.evaluate(()=>{
  const dock=document.querySelector('.chat-bottom-dock')
  const bar=document.querySelector('.chat-search-bar')
  const add=document.querySelector('.chat-search-add')
  const d=dock.getBoundingClientRect(), b=bar.getBoundingClientRect(), a=add.getBoundingClientRect()
  const cs=getComputedStyle(dock)
  return {
    dir: cs.flexDirection,
    gap: cs.gap,
    sameRow: Math.abs((b.top+b.bottom)/2 - (a.top+a.bottom)/2)<10,
    plusAfterBar: a.left >= b.right - 2,
    plusCx: (a.left+a.right)/2,
    plusCy: (a.top+a.bottom)/2,
    dockRight: d.right,
  }
})
console.log('idle', JSON.stringify(idle))
await shot('chat_search_plus_row_idle')
await page.getByRole('button',{name:'New chat'}).click()
await page.waitForTimeout(500)
const open=await page.evaluate(()=>{
  const bar=document.querySelector('.chat-search-bar')
  const add=document.querySelector('.chat-search-add')
  const a=add.getBoundingClientRect()
  return {
    searchGone: !bar,
    rotated: add.classList.contains('is-sheet-open'),
    plusCx: (a.left+a.right)/2,
    plusCy: (a.top+a.bottom)/2,
  }
})
console.log('open', JSON.stringify(open))
await shot('chat_search_plus_row_open')
await browser.close()
if(idle.dir!=='row' || !idle.sameRow || !idle.plusAfterBar){ console.error('FAIL idle layout', idle); process.exit(1)}
if(!open.searchGone || !open.rotated){ console.error('FAIL open', open); process.exit(1)}
if(Math.abs(open.plusCx - idle.plusCx)>3 || Math.abs(open.plusCy - idle.plusCy)>3){
  console.error('FAIL plus center jumped', {idle, open}); process.exit(1)
}
console.log('OK')
