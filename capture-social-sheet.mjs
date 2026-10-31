import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'
const ART='/opt/cursor/artifacts'
const MEDIA='/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media'
fs.mkdirSync(ART,{recursive:true}); fs.mkdirSync(MEDIA,{recursive:true})
const browser=await chromium.launch({headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2})
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'})
await page.locator('input[type=email]').first().fill('cloud@thrft.local')
await page.locator('input[type=password]').first().fill('cloud-cloud-cloud')
await page.getByRole('button',{name:/sign in/i}).click()
await page.waitForSelector('nav.tab-bar',{timeout:25000})
await page.getByRole('button',{name:'Profile', exact:true}).click()
await page.waitForTimeout(800)
// scroll to links
await page.locator('#links-label').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.getByRole('button',{name:/TikTok handle|TikTok @/}).click()
await page.waitForSelector('.glass-sheet-card')
await page.waitForTimeout(350)
const info=await page.evaluate(()=>({
  title: document.querySelector('.profile-social-sheet-title')?.textContent || null,
  hasIcon: !!document.querySelector('.profile-social-sheet-icon'),
  usernameLabel: document.querySelector('.glass-field-label')?.textContent || null,
}))
console.log(JSON.stringify(info))
const file='thrft_links_sheet_no_title.png'
await page.screenshot({path:path.join(ART,file), fullPage:false})
fs.copyFileSync(path.join(ART,file), path.join(MEDIA,file))
console.log('saved', file)
await browser.close()
if(info.title){ console.error('FAIL title still present', info); process.exit(1)}
if(!info.hasIcon){ console.error('FAIL missing icon', info); process.exit(1)}
console.log('OK')
