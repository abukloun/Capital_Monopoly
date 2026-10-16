// Run with a locally installed Playwright, e.g.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/stability.mjs
// Test hooks exist only in the intercepted HTML response, never in the game.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const modulePath=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath?pathToFileURL(modulePath).href:'playwright');
const browser=await chromium.launch({headless:true,
  executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],contexts=[];
const url=process.env.GAME_URL||'http://127.0.0.1:8000/index.html';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const hook=`window.__moneySeen=[];
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){
  if(node.nodeType!==1)continue;
  if(node.matches('.capital-rent-gain,.capital-float-amount'))window.__moneySeen.push({className:node.className,text:node.textContent});
  for(const child of node.querySelectorAll('.capital-rent-gain,.capital-float-amount'))window.__moneySeen.push({className:child.className,text:child.textContent});
}}).observe(document.body,{subtree:true,childList:true});
window.__test={mp,mpConnect,mpStartGame,mpSnapshot,mpPublishSnapshot,mpHandle,mpSend,
  mpTeardownTransport,mpRestoreAuthority,mpServerClearState,mpSubscribeChannel,mpReconnectChannel,
  beginTurnRoll,showRentIncome,renderPlayers,renderTokens,cap3d,cap3dFx,setBoardView,
  TILES,startHumanAuction,requirePayment,mpRequestSync,resetState,drawCard,pauseGame,resumeGame,whenRunning,
  get settings(){return gameSettings;},applySettings:applyGameSettings,settingsDefaults:()=>({...GAME_SETTINGS_DEFAULTS}),openSettings:openGameSettings,
  get players(){return players;},get auction(){return activeAuction;},
  get state(){return state;},get walkCount(){return walkTimers.size;},
  get pauseCount(){return pausedSteps.length;},get eventCount(){return actionEventQueue.length;},
  prepareTurn(i,pos){clearModal();turn=i;state=STATES.WAITING_FOR_ROLL;players[i].pos=pos;renderTokens();renderPlayers();},
  land(i,pos){clearModal();turn=i;state=STATES.TILE_ACTION;players[i].pos=pos;onTileLand(players[i]);},
  startAuction(i,tid){clearModal();turn=i;state=STATES.TILE_ACTION;startHumanAuction(players[i],TILES[tid]);},
  forceDice(a,b){devDiceOverride=[a,b];},
  stopBots(){cancelBotTimers();players.forEach(p=>p.human=true);},
  get dirty(){return boardVisualDirty;},get snapshots(){return mp.latestSnapshot;}
};`;
async function page(){
  const context=await browser.newContext({viewport:{width:1280,height:900}});contexts.push(context);
  const p=await context.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/index.html',r=>r.fulfill({contentType:'text/html',body:source.replace('  window.Capital={',hook+'\n  window.Capital={')}));
  await p.goto(url);await p.waitForFunction(()=>!!window.__test);return p;
}
async function wait(p,fn,arg){
  try{await p.waitForFunction(fn,arg,{timeout:15000});}
  catch(e){console.error('State at failure',await p.evaluate(()=>({info:Capital.mpInfo(),snapshot:__test.snapshots,modal:document.querySelector('#modalRoot')?.textContent?.slice(0,200)})));throw e;}
}
function pass(name){console.log('PASS',name);}
try{
  const single=await page();
  await single.evaluate(()=>{Capital.play();Capital.select(2);Capital.start();__test.stopBots();});
  await single.evaluate(()=>{__test.TILES[3].owner=1;__test.prepareTurn(0,0);__test.beginTurnRoll(__test.players[0],false,1,2);});
  await wait(single,()=>__test.players[1].money===1504);
  assert.equal(await single.locator('.capital-rent-gain').textContent(),'+$4');
  assert.ok(await single.evaluate(()=>__moneySeen.some(e=>e.className.includes('capital-float-amount')&&e.text==='+$4')));
  const identity=await single.evaluate(()=>{const r=document.querySelector('#players .player-row');for(let i=0;i<300;i++)__test.renderPlayers();return r===document.querySelector('#players .player-row');});
  assert.ok(identity);pass('real rent payment, 2D +$, stable panel rows');
  await single.evaluate(()=>{__test.showRentIncome(__test.players[1],__test.players[0],12,__test.TILES[3]);__test.players[1].doubles=1;__test.renderPlayers();});
  assert.equal(await single.locator('.capital-rent-gain').textContent(),'+$12');
  await single.waitForTimeout(2500);assert.equal(await single.locator('.capital-rent-gain').count(),0);
  pass('rent indicator survives row updates and expires');
  await single.evaluate(()=>{__test.prepareTurn(0,0);__test.beginTurnRoll(__test.players[0],false,1,2);Capital.back();Capital.play();Capital.start();__test.stopBots();});
  await single.waitForTimeout(1800);
  assert.equal(await single.evaluate(()=>__test.players[0].pos),0);
  assert.equal(await single.evaluate(()=>__test.state),'WAITING_FOR_ROLL');
  pass('old dice callbacks cannot mutate a new game');

  /* ---------- Game settings: each switch must change real gameplay ---------- */
  // GO bonus off: 35 + 3 + 3 passes GO, balance stays exactly 1500.
  await single.evaluate(()=>__test.applySettings({...__test.settingsDefaults,goBonus:0}));
  await single.evaluate(()=>{__test.TILES[1].owner=1;__test.TILES[3].owner=1;__test.prepareTurn(0,35);__test.beginTurnRoll(__test.players[0],false,3,3);});
  await wait(single,()=>__test.state==='WAITING_FOR_ROLL'&&__test.players[0].pos===1);
  assert.equal(await single.evaluate(()=>__test.players[0].money),1496);
  pass('GO bonus 0 = passing GO pays nothing');
  // GO bonus 400: same move pays 400 on top of the starting balance.
  await single.evaluate(()=>{__test.applySettings({...__test.settingsDefaults,goBonus:400});__test.prepareTurn(0,35);__test.beginTurnRoll(__test.players[0],false,3,3);});
  await wait(single,()=>__test.players[0].pos===1&&__test.state==='WAITING_FOR_ROLL');
  assert.equal(await single.evaluate(()=>__test.players[0].money),1892);
  pass('GO bonus 400 pays through the same walk');
  // Monopoly rent doubling off: full brown set rents for 4, not 8.
  await single.evaluate(()=>{__test.applySettings({...__test.settingsDefaults,doubleRentOnMonopoly:false});__test.players[1].money=1500;__test.prepareTurn(0,0);__test.beginTurnRoll(__test.players[0],false,1,2);});
  await wait(single,()=>__test.state==='WAITING_FOR_ROLL');
  assert.equal(await single.evaluate(()=>__test.players[1].money),1504);
  pass('double-rent-off: complete group no longer doubles base rent');
  // Auctions off: declining keeps the property with the bank and still ends the turn.
  await single.evaluate(()=>{__test.applySettings({...__test.settingsDefaults,auctionOnDecline:false});__test.TILES[5].owner=null;__test.TILES[1].owner=null;__test.TILES[3].owner=null;__test.prepareTurn(0,5);__test.land(0,5);});
  await wait(single,()=>!!document.querySelector('#buyNo'));
  await single.locator('#buyNo').click();
  await wait(single,()=>__test.state==='WAITING_FOR_ROLL');
  assert.equal(await single.evaluate(()=>__test.TILES[5].owner),null);
  assert.equal(await single.evaluate(()=>__test.auction),null);
  pass('auctions off: decline ends the turn with the bank');
  // Free Parking pot: the tax lands in the pot, landing on the corner pays it.
  await single.evaluate(()=>{__test.applySettings({...__test.settingsDefaults,freeParkingPot:true});__test.players[0].money=1000;__test.prepareTurn(0,4);__test.land(0,4);});
  await wait(single,()=>__test.state==='WAITING_FOR_ROLL'||!!document.querySelector('#debtPay'));
  await single.evaluate(()=>{if(document.querySelector('#debtPay'))document.querySelector('#debtPay').click();});
  await wait(single,()=>__test.state==='WAITING_FOR_ROLL');
  await single.evaluate(()=>{__test.prepareTurn(0,20);__test.land(0,20);});
  await wait(single,()=>__test.players[0].money===1000);
  assert.equal(await single.evaluate(()=>__test.players[0].money),1000);
  pass('Free Parking pot collects the tax and pays the corner');
  // Sanitizer clamps hostile values.
  await single.evaluate(()=>Capital.applySettings({startingCash:99999,goBonus:-5,jailFine:99999,incomeTaxMode:'percent',incomeTaxPercent:400,turnTimer:99999,botDifficulty:'god'}));
  assert.deepEqual(await single.evaluate(()=>__test.settings),{startingCash:3000,goBonus:0,jailFine:1000,incomeTaxMode:'percent',incomeTaxPercent:50,turnTimer:300,auctionOnDecline:true,doubleRentOnMonopoly:true,evenBuild:true,freeParkingPot:false,botDifficulty:'normal',randomizePlayerOrder:false,rentWhileInJail:true,mortgageEnabled:true});
  pass('settings sanitizer clamps every field');
  await single.evaluate(()=>__test.applySettings({...__test.settingsDefaults}));

  const host=await page(),guest=await page(),observer=await page();
  const code='T'+Date.now().toString(36).slice(-5).toUpperCase();
  assert.ok(await host.evaluate(c=>__test.mpConnect(c,true,'Host'),code));
  assert.ok(await guest.evaluate(c=>__test.mpConnect(c,false,'Guest'),code));
  assert.ok(await observer.evaluate(c=>__test.mpConnect(c,false,'Observer'),code));
  await wait(host,()=>__test.mp.members.length===3);
  // Host rules must reach every client before the match starts.
  await host.evaluate(()=>__test.applySettings({...__test.settingsDefaults,goBonus:123,turnTimer:60}));
  await host.evaluate(()=>__test.mpStartGame());
  await wait(guest,()=>__test.players.length===3&&__test.settings.goBonus===123);
  await wait(observer,()=>__test.players.length===3&&__test.settings.goBonus===123&&__test.settings.turnTimer===60);
  pass('three real Supabase clients join and start');
  // Settings are locked once the match is running: a late lobby update is ignored.
  await host.evaluate(()=>__test.mpSend({kind:'lobbySettings',settings:{...__test.settingsDefaults,goBonus:777}}));
  await host.waitForTimeout(900);
  assert.equal(await guest.evaluate(()=>__test.settings.goBonus),123);
  pass('settings lock after start: late lobby updates are ignored');
  await guest.evaluate(()=>__test.setBoardView('3d'));
  await wait(guest,()=>__test.cap3d.ready);
  await host.evaluate(()=>{__test.TILES[3].owner=1;__test.prepareTurn(0,0);__test.players[1].pos=10;__test.renderTokens();__test.mpPublishSnapshot(true);__test.beginTurnRoll(__test.players[0],false,1,2);});
  await wait(guest,()=>!!Capital.mpInfo().remoteMove);
  const first=await guest.evaluate(()=>__test.cap3d.tokens.get(0).group.position.x);
  await guest.waitForTimeout(250);
  const second=await guest.evaluate(()=>__test.cap3d.tokens.get(0).group.position.x);
  assert.notEqual(first,second);
  await wait(guest,()=>__test.players[1].money===1504);
  assert.ok(await guest.evaluate(()=>__moneySeen.some(e=>e.className.includes('capital-rent-gain')&&e.text==='+$4')));
  assert.ok(await guest.evaluate(()=>__test.cap3dFx.floaters.length>0));
  await wait(observer,()=>__test.players[1].money===1504);
  assert.ok(await observer.evaluate(()=>__moneySeen.some(e=>e.className.includes('capital-rent-gain')&&e.text==='+$4')));
  pass('guest 3D model moves; rent +$ reaches all clients');
  await host.evaluate(()=>__test.startAuction(0,6));
  await wait(guest,()=>!!document.querySelector('.auction-live-bg'));
  await guest.evaluate(()=>window.__auctionNode=document.querySelector('.auction-live-bg'));
  for(let i=1;i<=4;i++){
    const p=i%2?guest:host;
    await p.evaluate(amount=>__test.mp.host?document.querySelector('.auction-bid-controls button')?.click():__test.mp.channel.send({type:'broadcast',event:'capital',payload:{kind:'action',_capitalSender:__test.mp.clientId,playerId:__test.mp.clientId,action:{type:'auctionBid',amount,tileId:6}}}),i*10);
    await host.waitForTimeout(400);
  }
  assert.ok(await guest.evaluate(()=>window.__auctionNode===document.querySelector('.auction-live-bg')));
  await wait(guest,()=>!document.querySelector('.auction-live-bg'));
  assert.ok(await guest.evaluate(()=>__test.TILES[6].owner!=null));
  assert.equal(await host.evaluate(()=>__test.walkCount),0);
  pass('auction stays mounted while bidding and settles with no timer backlog');
  await guest.reload();await wait(guest,()=>__test.players.length===3&&__test.mp.connected);
  assert.deepEqual(await guest.evaluate(()=>__test.players.map(p=>p.money)),await host.evaluate(()=>__test.players.map(p=>p.money)));
  pass('guest refresh restores balances and turn');
  await host.reload();await wait(host,()=>__test.players.length===3&&__test.mp.connected);
  await wait(guest,()=>__test.mp.authorityTerm>=1);
  assert.deepEqual(await guest.evaluate(()=>__test.players.map(p=>p.money)),await host.evaluate(()=>__test.players.map(p=>p.money)));
  pass('host refresh resumes without resetting the match');

  // Host refresh while the guest must decide whether to buy.
  await host.evaluate(()=>{__test.TILES[8].owner=null;__test.land(1,8);});
  await wait(guest,()=>!!document.querySelector('#buyYes'));
  await host.reload();await wait(host,()=>__test.players.length===3&&__test.mp.connected);
  await guest.locator('#buyYes').click();await wait(host,()=>__test.TILES[8].owner===1);
  await wait(host,()=>__test.state==='WAITING_FOR_ROLL');
  pass('pending purchase survives host refresh and still accepts guest input');

  // A remote debtor remains able to confirm/cancel bankruptcy after rebuilding
  // the dialog; the host can restore the same pending payment after refresh.
  await host.evaluate(()=>{__test.players[1].money=0;__test.TILES[3].owner=0;__test.land(1,3);});
  await wait(guest,()=>!!document.querySelector('#debtAskBankrupt'));
  await guest.locator('#debtAskBankrupt').click();
  assert.ok(await guest.locator('#debtCancel').count());
  await guest.locator('#debtCancel').click();
  await host.reload();await wait(host,()=>__test.players.length===3&&__test.mp.connected);
  await wait(guest,()=>!!document.querySelector('[data-kind="mortgage"]'));
  await guest.locator('[data-kind="mortgage"]').first().click();
  await wait(host,()=>__test.players[1].money>0&&__test.mpSnapshot().pendingDebt===null);
  pass('debt confirmation/cancel, host refresh and mortgage settlement');

  // Reject a non-host game-start and stale state packet without resetting the game.
  const snapshotBefore=await guest.evaluate(()=>({money:__test.players[0].money,turn:__test.mpSnapshot().turn}));
  await guest.evaluate(()=>{
    __test.mpHandle({kind:'start',_capitalSender:'not-the-host',members:[]});
    const s=__test.mpSnapshot();s.players[0].money=999999;
    __test.mpHandle({kind:'snapshot',_capitalSender:__test.mp.hostId,_capitalSeq:1,snapshot:s});
  });
  assert.deepEqual(await guest.evaluate(()=>({money:__test.players[0].money,turn:__test.mpSnapshot().turn})),snapshotBefore);
  pass('non-host start and stale packets are ignored');

  // A real temporary offline period, then a new full authoritative state.
  await guest.context().setOffline(true);await guest.waitForTimeout(2200);
  await host.evaluate(()=>{__test.players[0].money+=17;__test.mpPublishSnapshot(true);});
  const target=await host.evaluate(()=>__test.players[0].money);
  await guest.context().setOffline(false);
  await wait(guest,v=>__test.mp.connected&&__test.players[0].money===v,target);
  pass('offline/reconnect catches up to authoritative balances');

  // Keep two survivors; the old host has no timers or room subscription left.
  const survivors=[guest,observer];
  await host.evaluate(()=>__test.mpTeardownTransport());
  await wait(guest,()=>__test.mp.host||(__test.mp.hostId!==__test.players[0].mpClientId));
  await guest.waitForTimeout(1200);
  const flags=await Promise.all(survivors.map(p=>p.evaluate(()=>__test.mp.host)));
  assert.equal(flags.filter(Boolean).length,1);
  const successor=survivors[flags.indexOf(true)],other=survivors[flags.indexOf(false)];
  await successor.evaluate(()=>{__test.players[1].money+=19;__test.mpPublishSnapshot(true);});
  const target2=await successor.evaluate(()=>__test.players[1].money);
  await wait(other,v=>__test.players[1].money===v,target2);
  pass('host migration elects exactly one successor and keeps synchronizing');
  await successor.evaluate(()=>__test.mpServerClearState());
  await single.evaluate(()=>{__test.pauseGame();__test.whenRunning(()=>window.__stalePause=true);__test.resetState();__test.resumeGame();});
  assert.equal(await single.evaluate(()=>!!window.__stalePause),false);
  assert.equal(await single.evaluate(()=>__test.pauseCount),0);
  pass('reset discards paused callbacks');
  assert.deepEqual(errors,[]);pass('no uncaught browser errors');
}finally{await browser.close();}
